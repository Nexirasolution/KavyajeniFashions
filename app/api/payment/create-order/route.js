import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getRazorpay } from '@/lib/razorpay';
import Order from '@/models/Order';
import { genOrderNumber } from '@/lib/utils';
import {
  reserveItemsAndBuildOrder,
  rollbackStock,
  applyCouponToSubtotal,
  computeShippingFee
} from '@/lib/orderCreation';

const RESERVATION_WINDOW_MS = 15 * 60 * 1000; // 15 min to complete payment

export async function POST(req) {
  try {
    await dbConnect();
    const { items, customer, shippingAddress, couponCode } = await req.json();

    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (!customer?.name || !customer?.phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }
    if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.pincode) {
      return NextResponse.json({ error: 'Shipping address is incomplete' }, { status: 400 });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return NextResponse.json(
        { error: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env' },
        { status: 500 }
      );
    }

    // Reserve stock atomically BEFORE the customer ever sees the payment
    // modal. This is what fixes "paid but closed the tab" — the order
    // already exists and stock is already held before Razorpay opens.
    let reserved;
    try {
      reserved = await reserveItemsAndBuildOrder(items);
    } catch (err) {
      return NextResponse.json({ error: err.message || 'Could not reserve items' }, { status: err.status || 400 });
    }
    const { orderItems, subtotal, decremented } = reserved;

    // Recompute discount + shipping server-side — never trust a client total.
    const { discount, appliedCoupon } = await applyCouponToSubtotal(couponCode, subtotal);
    const shippingFee = await computeShippingFee(subtotal - discount);
    const total = Math.round(subtotal - discount + shippingFee);

    if (total <= 0) {
      await rollbackStock(decremented);
      return NextResponse.json({ error: 'Invalid order total' }, { status: 400 });
    }

    let dbOrder;
    try {
      dbOrder = await Order.create({
        orderNumber: genOrderNumber(),
        items: orderItems,
        customer,
        shippingAddress,
        subtotal,
        discount,
        couponCode: appliedCoupon,
        shippingFee,
        total,
        paymentMethod: 'razorpay',
        paymentStatus: 'pending',
        status: 'placed',
        stockReservations: decremented,
        expiresAt: new Date(Date.now() + RESERVATION_WINDOW_MS)
      });
    } catch (err) {
      await rollbackStock(decremented);
      throw err;
    }

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
      await rollbackStock(decremented);
      await Order.deleteOne({ _id: dbOrder._id });
      console.error('Razorpay order creation failed:', err);
      return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
    }

    return NextResponse.json({
      order: rzpOrder,
      keyId: process.env.RAZORPAY_KEY_ID,
      dbOrderId: dbOrder._id,
      total
    });
  } catch (err) {
    console.error('create-order failed:', err);
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 });
  }
}