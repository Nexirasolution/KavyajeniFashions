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
import { getShippingSettings, getCodStatus, orderItemsToLines } from '@/lib/shipping';
import { resolveRule, computeShipping } from '@/lib/shippingConfig';

const RESERVATION_WINDOW_MS = 15 * 60 * 1000; // 15 min to complete online payment

export async function POST(req) {
  try {
    await dbConnect();
    const { items, customer, shippingAddress, couponCode, paymentMethod } = await req.json();
    const method = paymentMethod === 'cod' ? 'cod' : 'razorpay';

    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (!customer?.name || !customer?.phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }
    if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.pincode) {
      return NextResponse.json({ error: 'Shipping address is incomplete' }, { status: 400 });
    }
    if (!shippingAddress?.state) {
      return NextResponse.json({ error: 'Please select your state' }, { status: 400 });
    }

    // Razorpay is needed for a plain online order AND for a COD order that
    // carries a fee to be paid online — only a zero-fee COD order skips it.
    const razorpay = getRazorpay();

    const settings = await getShippingSettings();
    const rule = resolveRule(settings, shippingAddress.state);

    // Reserve stock atomically BEFORE the customer ever sees the payment
    // modal (or, for a zero-fee COD order, before the order is created).
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
      // COD eligibility is checked against the items that were actually
      // reserved (not the raw client payload), so it can't be bypassed by
      // sending junk lines.
      let codFee = 0;
      if (method === 'cod') {
        const cod = await getCodStatus(
          rule,
          orderItemsToLines(orderItems),
          rule.matchedState || shippingAddress.state
        );
        if (!cod.available) {
          await release();
          return NextResponse.json({ error: cod.reason }, { status: 400 });
        }
        codFee = cod.fee;
      }

      // A Razorpay charge is needed for: any online order, or a COD order
      // that has a fee to collect upfront. Only a zero-fee COD order needs
      // no gateway at all.
      const needsOnlineCharge = method === 'razorpay' || codFee > 0;
      if (needsOnlineCharge && !razorpay) {
        await release();
        return NextResponse.json(
          { error: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env' },
          { status: 500 }
        );
      }

      // Recompute discount + shipping server-side — never trust a client total.
      const couponResult = await applyCouponToSubtotal(couponCode, subtotal);
      const discount = couponResult.discount;
      appliedCoupon = couponResult.appliedCoupon;

      const shippingFee = computeShipping(rule, subtotal - discount);
      const total = Math.round(subtotal - discount + shippingFee + codFee);
      // For COD, this is what's actually charged online right now — just the
      // fee. For a plain online order it's the same as `total`.
      const amountDueOnline = method === 'cod' ? codFee : total;

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
        codFee,
        total,
        paymentMethod: method,
        // A zero-fee COD order is 'pending' (cash collected on delivery).
        // A COD order WITH a fee is 'cod_fee_pending' until that fee clears
        // Razorpay — verify() below is what should move it out of this state.
        paymentStatus: method === 'cod' ? (codFee > 0 ? 'cod_fee_pending' : 'pending') : 'pending',
        status: 'placed',
        stockReservations: decremented,
        // Anything with money still outstanding online (a plain online order,
        // or a COD order with a fee) must expire if payment is abandoned —
        // only a zero-fee COD order is exempt from the cron sweep.
        expiresAt: needsOnlineCharge ? new Date(Date.now() + RESERVATION_WINDOW_MS) : undefined
      });

      // ── Zero-fee Cash on Delivery: order is final, no payment gateway involved ──
      if (method === 'cod' && codFee === 0) {
        return NextResponse.json({
          cod: true,
          dbOrderId: dbOrder._id,
          orderNumber: dbOrder.orderNumber,
          total
        });
      }

      // ── Online charge: either a full online payment, or just the COD fee ──
      let rzpOrder;
      try {
        rzpOrder = await razorpay.orders.create({
          amount: amountDueOnline * 100, // paise
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
        cod: method === 'cod', // tells the client this Razorpay charge is the COD fee, not the full total
        total
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