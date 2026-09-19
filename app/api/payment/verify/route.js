import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

// Called by the browser right after Razorpay reports success. This is a
// fast path for good UX — NOT the only way an order gets marked paid.
// The webhook (below) is the source of truth if this call never happens
// (tab closed, network drop, app backgrounded, etc).
export async function POST(req) {
  try {
    await dbConnect();
    const { dbOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!dbOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification data' }, { status: 400 });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const order = await Order.findOne({ _id: dbOrderId, razorpayOrderId: razorpay_order_id });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.expiresAt = undefined;
      await order.save();
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('Payment verify failed:', err);
    return NextResponse.json(
      { error: 'Could not confirm order. If you were charged, contact support with your payment ID.' },
      { status: 500 }
    );
  }
}