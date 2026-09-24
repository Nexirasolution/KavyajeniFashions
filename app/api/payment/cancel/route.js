import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getRazorpay } from '@/lib/razorpay';
import Order from '@/models/Order';
import { rollbackStock, releaseCoupon } from '@/lib/orderCreation';

// Any order whose paymentStatus is one of these still has money outstanding
// online and stock held against it — a plain online order, or a COD order
// still waiting on its handling fee.
const PENDING_STATUSES = ['pending', 'cod_fee_pending'];

// Called when the customer explicitly closes the Razorpay modal without
// paying — releases stock immediately instead of waiting for the cron
// sweep. Double-checks with Razorpay first in case payment actually
// succeeded right as the modal closed.
export async function POST(req) {
  try {
    await dbConnect();
    const { dbOrderId } = await req.json();
    if (!dbOrderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

    const order = await Order.findById(dbOrderId);
    if (!order || !PENDING_STATUSES.includes(order.paymentStatus)) {
      return NextResponse.json({ ok: true }); // nothing to release
    }

    const razorpay = getRazorpay();
    if (razorpay && order.razorpayOrderId) {
      try {
        const rzpOrder = await razorpay.orders.fetch(order.razorpayOrderId);
        if (rzpOrder.status === 'paid') {
          return NextResponse.json({ ok: true }); // let verify/webhook finalize it
        }
      } catch (e) {
        console.error('Could not confirm Razorpay order status on cancel:', e);
        return NextResponse.json({ ok: true }); // leave it for the cron sweep, don't guess
      }
    }

    await rollbackStock(order.stockReservations);
    await releaseCoupon(order.couponCode);
    order.paymentStatus = 'failed';
    order.status = 'cancelled';
    order.expiresAt = undefined;
    await order.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Cancel order failed:', err);
    return NextResponse.json({ error: 'Could not cancel order' }, { status: 500 });
  }
}