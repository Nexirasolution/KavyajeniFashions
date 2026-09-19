import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getRazorpay } from '@/lib/razorpay';
import Order from '@/models/Order';
import { rollbackStock, releaseCoupon } from '@/lib/orderCreation';

// Safety net: catches orders where BOTH the client callback and the
// webhook failed to fire (e.g. tab closed AND webhook delivery failed).
// Schedule this to run every 5 minutes.
export async function POST(req) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const razorpay = getRazorpay();

  const stale = await Order.find({
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    expiresAt: { $lte: new Date() }
  });

  let released = 0;
  let confirmed = 0;

  for (const order of stale) {
    if (razorpay && order.razorpayOrderId) {
      try {
        const rzpOrder = await razorpay.orders.fetch(order.razorpayOrderId);
        if (rzpOrder.status === 'paid') {
          order.paymentStatus = 'paid';
          order.expiresAt = undefined;
          await order.save();
          confirmed += 1;
          continue;
        }
      } catch (e) {
        console.error(`Could not check Razorpay status for order ${order._id}:`, e);
        continue; // leave it for next sweep rather than guessing
      }
    }

    await rollbackStock(order.stockReservations);
    await releaseCoupon(order.couponCode);
    order.paymentStatus = 'failed';
    order.status = 'cancelled';
    order.expiresAt = undefined;
    await order.save();
    released += 1;
  }

  return NextResponse.json({ swept: stale.length, released, confirmed });
}