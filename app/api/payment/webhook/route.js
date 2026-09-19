import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { rollbackStock, releaseCoupon } from '@/lib/orderCreation';

// Razorpay calls this directly from their servers — independent of the
// customer's browser. This is the reliable source of truth for order
// finalization; /api/payment/verify is just a faster UX path.
export async function POST(req) {
  await dbConnect();
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set — cannot verify webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.razorpayPaymentId = payment.id;
        order.expiresAt = undefined;
        await order.save();
      }
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order && order.paymentStatus === 'pending') {
        await rollbackStock(order.stockReservations);
        await releaseCoupon(order.couponCode);
        order.paymentStatus = 'failed';
        order.status = 'cancelled';
        order.expiresAt = undefined;
        await order.save();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook processing failed:', err);
    // 500 so Razorpay retries the webhook instead of silently dropping it.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}