// Save as: src/app/api/payment/verify/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

// Payment statuses that mean "online money still outstanding".
const UNPAID = ['pending', 'cod_fee_pending'];

// Called by the browser right after Razorpay reports success. This is a
// fast path for good UX — NOT the only way an order gets marked paid.
// The webhook is the source of truth if this call never happens
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

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const existing = await Order.findOne({ _id: dbOrderId, razorpayOrderId: razorpay_order_id });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // A COD order only ever charges the handling fee online — the rest is
    // cash on delivery, so it must never be marked 'paid' (that would say
    // the whole order is settled). Every other order is a full online payment.
    const paidStatus = existing.paymentMethod === 'cod' ? 'cod_fee_paid' : 'paid';

    // Atomic: only flips the order if it is STILL a live, unpaid order. If the
    // expiry sweep cancelled it (and gave the stock back) a split second
    // earlier, this matches nothing, so we never mark a stock-less order paid.
    const updated = await Order.findOneAndUpdate(
      {
        _id: dbOrderId,
        razorpayOrderId: razorpay_order_id,
        status: 'placed',
        paymentStatus: { $in: UNPAID }
      },
      {
        $set: { paymentStatus: paidStatus, razorpayPaymentId: razorpay_payment_id },
        $unset: { expiresAt: 1 }
      },
      { new: true }
    );

    if (updated) {
      return NextResponse.json({ order: updated });
    }

    // Nothing matched — work out why.
    const current = await Order.findById(dbOrderId);

    // Already marked paid (webhook got there first, or a repeat call): fine.
    if (current && current.paymentStatus === paidStatus) {
      return NextResponse.json({ order: current });
    }

    // The payment window had expired and the order was cancelled, but the
    // customer's payment still went through. Record the payment ID so it can
    // be refunded, and tell the customer clearly.
    if (current && current.status === 'cancelled') {
      await Order.updateOne({ _id: dbOrderId }, { $set: { razorpayPaymentId: razorpay_payment_id } });
      console.error('Payment received for an expired/cancelled order — refund needed:', {
        orderNumber: current.orderNumber,
        razorpay_payment_id
      });
      return NextResponse.json(
        {
          error:
            'Your payment window expired before the payment completed, so this order was cancelled. Please contact support with your payment ID and we will refund any amount that was charged.'
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Order could not be confirmed' }, { status: 409 });
  } catch (err) {
    console.error('Payment verify failed:', err);
    return NextResponse.json(
      { error: 'Could not confirm order. If you were charged, contact support with your payment ID.' },
      { status: 500 }
    );
  }
}