// Save as: src/app/api/payment/create-order/route.js
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getRazorpay } from '@/lib/razorpay';
import Order from '@/models/Order';
import { genOrderNumber } from '@/lib/utils';
import {
  reserveItemsAndBuildOrder,
  rollbackStock,
  releaseCoupon,
  applyCouponToSubtotal
} from '@/lib/orderCreation';
import { releaseExpiredOrders } from '@/lib/releaseExpiredOrders';
import { getShippingSettings, buildShippingQuote, orderItemsToLines } from '@/lib/shipping';
import { resolveRule, INDIAN_STATES } from '@/lib/shippingConfig';
import { computeBestDiscount, getTotalQty } from '@/lib/discountConfig';

const RESERVATION_WINDOW_MS = 10 * 60 * 1000; // 10 min to complete an ONLINE payment, then stock is released

// ─────────────────────────── Address validation ───────────────────────────

const NAME_RE = /^[A-Za-z][A-Za-z\s.'-]{1,}$/;
const DISTRICT_RE = /^[A-Za-z][A-Za-z\s.'()&-]{1,}$/;

const norm = (s = '') => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function cleanPhone(p = '') {
  let d = String(p).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

// Looks the pincode up on India Post. Returns:
//   { status: 'valid', state }  | { status: 'invalid' } | { status: 'unknown' }
// 'unknown' means the lookup service was unreachable — we fail open so a
// third-party outage never blocks real customers from ordering.
async function lookupPincode(pin) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!res.ok) return { status: 'unknown' };
    const data = await res.json();
    const po = data?.[0]?.PostOffice;
    if (data?.[0]?.Status === 'Success' && po?.length) {
      return { status: 'valid', state: po[0].State };
    }
    if (data?.[0]?.Status === 'Error') return { status: 'invalid' };
    return { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}

// Validates and normalises customer + address. Returns { error } or
// { customer, address } containing only whitelisted, trimmed fields.
async function validateAndCleanAddress(customer, shippingAddress) {
  const a = shippingAddress || {};
  const c = customer || {};

  const name = str(c.name) || str(a.name);
  const phone = cleanPhone(c.phone || a.phone);
  const email = str(c.email) || str(a.email);
  const line1 = str(a.line1);
  const line2 = str(a.line2);
  const city = str(a.city);
  const district = str(a.district);
  const pincode = str(a.pincode);
  const landmark = str(a.landmark);

  if (!NAME_RE.test(name)) {
    return { error: 'Please enter your full name' };
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { error: 'Please enter a valid 10-digit mobile number' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: 'Please enter a valid email address' };
  }
  if (line1.length < 5) {
    return { error: 'Please enter your house / street address' };
  }
  if (!NAME_RE.test(city)) {
    return { error: 'Please enter a valid city' };
  }
  // District is mandatory.
  if (!DISTRICT_RE.test(district)) {
    return { error: 'Please enter your district' };
  }

  // State must be one of the known states (canonical spelling is used).
  const state = INDIAN_STATES.find((s) => s === str(a.state));
  if (!state) {
    return { error: 'Please select a valid state' };
  }

  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return { error: 'Please enter a valid 6-digit pincode' };
  }
  const pin = await lookupPincode(pincode);
  if (pin.status === 'invalid') {
    return { error: 'This pincode does not exist' };
  }
  if (pin.status === 'valid' && norm(pin.state) !== norm(state)) {
    return { error: `This pincode belongs to ${pin.state}, not ${state}` };
  }

  return {
    customer: { name, phone, email },
    address: { name, phone, email, line1, line2, city, district, state, pincode, landmark }
  };
}

// ─────────────────────────────── Route ───────────────────────────────

export async function POST(req) {
  try {
    await dbConnect();
    const { items, customer: rawCustomer, shippingAddress: rawAddress, couponCode, paymentMethod } =
      await req.json();
    const method = paymentMethod === 'cod' ? 'cod' : 'razorpay';

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Validate the address BEFORE reserving any stock.
    const checked = await validateAndCleanAddress(rawCustomer, rawAddress);
    if (checked.error) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const customer = checked.customer;
    const shippingAddress = checked.address;

    // Razorpay is only needed for online orders. Cash on Delivery is NOT
    // prepaid: nothing is charged online, items + shipping are all paid in
    // cash when the parcel arrives.
    const razorpay = method === 'razorpay' ? getRazorpay() : null;
    if (method === 'razorpay' && !razorpay) {
      return NextResponse.json(
        { error: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env' },
        { status: 500 }
      );
    }

    const settings = await getShippingSettings();
    const rule = resolveRule(settings, shippingAddress.state);

    // Give back stock held by abandoned (expired, unpaid) checkouts right now,
    // so this customer isn't told "out of stock" because of someone who left.
    // Best-effort: a failure here must never block the order.
    await releaseExpiredOrders().catch((e) => console.error('releaseExpiredOrders failed:', e));

    // Reserve stock atomically BEFORE the customer ever sees the payment
    // modal (or, for a COD order, before the order is created).
    let reserved;
    try {
      reserved = await reserveItemsAndBuildOrder(items);
    } catch (err) {
      return NextResponse.json({ error: err.message || 'Could not reserve items' }, { status: err.status || 400 });
    }
    const { orderItems, subtotal, decremented } = reserved;

    // From here on, stock (and possibly a coupon use) is held. `release()`
    // gives both back, and only ever runs once — so every failure path below,
    // including an unexpected exception, can call it safely.
    let appliedCoupon = '';
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      await rollbackStock(decremented);
      await releaseCoupon(appliedCoupon);
    };

    try {
      // ── Discount (computed server-side — never trust a client total) ──
      //
      // 1) Manual coupon (if any code was sent).
      const couponResult = await applyCouponToSubtotal(couponCode, subtotal);
      const couponDiscount = couponResult.discount || 0;
      appliedCoupon = couponResult.appliedCoupon;

      // 2) Automatic tiered discount from the admin "Discounts" settings,
      //    worked out from the items that were actually reserved.
      const auto = computeBestDiscount(settings.discountRules, {
        subtotal,
        totalQty: getTotalQty(orderItems)
      });
      const autoDiscountAmount = auto?.discountAmount || 0;

      // 3) Same rule as the checkout page: the bigger one wins, no stacking.
      const usedAuto = autoDiscountAmount > couponDiscount;
      const discount = Math.min(subtotal, Math.max(couponDiscount, autoDiscountAmount));

      // If the coupon lost, give its use back so it isn't burned for nothing.
      if (usedAuto && appliedCoupon) {
        await releaseCoupon(appliedCoupon);
        appliedCoupon = '';
      }

      const amountAfterDiscount = subtotal - discount;

      // Shipping + COD eligibility are worked out from the items that were
      // actually reserved (not the raw client payload), so they can't be
      // bypassed by sending junk lines.
      const quote = await buildShippingQuote({
        settings,
        rule,
        lines: orderItemsToLines(orderItems),
        state: shippingAddress.state,
        amountAfterDiscount
      });

      if (method === 'cod' && !quote.cod.available) {
        await release();
        return NextResponse.json({ error: quote.cod.reason }, { status: 400 });
      }

      const shippingFee = method === 'cod' ? quote.cod.shippingFee : quote.online.shippingFee;
      const deliveryPartner = method === 'cod' ? quote.cod.courier : quote.online.courier;

      // Order total = items − discount + shipping.
      //   • Online order: the whole `total` is charged on Razorpay.
      //   • COD order:    nothing is charged online; the whole `total`
      //                   is collected in cash on delivery.
      const total = Math.round(amountAfterDiscount + shippingFee);

      if (total <= 0) {
        await release();
        return NextResponse.json({ error: 'Invalid order total' }, { status: 400 });
      }

      const dbOrder = await Order.create({
        orderNumber: genOrderNumber(),
        items: orderItems,
        customer,
        shippingAddress,
        subtotal,
        discount,
        couponCode: appliedCoupon,
        shippingFee,
        codFee: 0,
        total,
        paymentMethod: method,
        paymentStatus: 'pending', // COD: cash due on delivery. Online: awaiting payment.
        status: 'placed',
        deliveryPartner,
        stockReservations: decremented,
        // Only an online order with payment still outstanding expires.
        // COD orders have nothing to pay online, so they never expire.
        expiresAt: method === 'razorpay' ? new Date(Date.now() + RESERVATION_WINDOW_MS) : undefined
      });

      // ── Cash on Delivery: order is final, no payment gateway involved ──
      if (method === 'cod') {
        return NextResponse.json({
          cod: true,
          dbOrderId: dbOrder._id,
          orderNumber: dbOrder.orderNumber,
          total,
          discount,
          shippingFee,
          deliveryPartner,
          cashDue: total
        });
      }

      // ── Online payment: charge the full (discounted) total on Razorpay ──
      let rzpOrder;
      try {
        rzpOrder = await razorpay.orders.create({
          amount: total * 100, // paise
          currency: 'INR',
          receipt: dbOrder.orderNumber
        });
        dbOrder.razorpayOrderId = rzpOrder.id;
        await dbOrder.save();
      } catch (err) {
        console.error('Razorpay order creation failed:', err);
        await release();
        await Order.deleteOne({ _id: dbOrder._id });
        return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
      }

      return NextResponse.json({
        order: rzpOrder,
        keyId: process.env.RAZORPAY_KEY_ID,
        dbOrderId: dbOrder._id,
        total,
        discount,
        shippingFee,
        deliveryPartner
      });
    } catch (err) {
      // Anything unexpected after stock was reserved: give it back, then let
      // the outer handler return the 500.
      await release().catch((e) => console.error('release failed:', e));
      throw err;
    }
  } catch (err) {
    console.error('create-order failed:', err);
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 });
  }
}