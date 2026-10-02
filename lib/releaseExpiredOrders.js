// Save as: src/lib/releaseExpiredOrders.js
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { getRazorpay } from '@/lib/razorpay';
import { rollbackStock, releaseCoupon } from '@/lib/orderCreation';

// Payment statuses that mean "online money still outstanding".
// (A COD order with a handling fee sits in 'cod_fee_pending'.)
const UNPAID = ['pending', 'cod_fee_pending'];

// Sweeps orders whose payment window (expiresAt) has passed and that are
// still unpaid in our database. For each one it asks Razorpay what really
// happened:
//   • a payment was captured  → the customer DID pay (client callback and
//                               webhook both missed it): mark the order paid.
//   • a payment is authorized → leave it, it may still be captured.
//   • nothing paid            → cancel the order and give stock + coupon back.
//
// Every state change is an atomic, conditional update, so this is safe to run
// from a cron job AND from other routes at the same time as verify() / the
// webhook — stock can never be restored twice and a paid order is never cancelled.
export async function releaseExpiredOrders(limit = 50) {
  await dbConnect();
  const razorpay = getRazorpay();

  // Zero-fee COD orders have no expiresAt, so they are never matched here.
  const stale = await Order.find({
    status: 'placed',
    paymentStatus: { $in: UNPAID },
    expiresAt: { $lte: new Date() }
  })
    .select('_id razorpayOrderId paymentMethod')
    .limit(limit);

  let released = 0;
  let confirmed = 0;
  let skipped = 0;

  for (const o of stale) {
    try {
      if (razorpay && o.razorpayOrderId) {
        const pays = await razorpay.orders.fetchPayments(o.razorpayOrderId);
        const items = pays?.items || [];
        const captured = items.find((p) => p.status === 'captured');

        if (captured) {
          // COD orders only ever pay the handling fee online.
          const paidStatus = o.paymentMethod === 'cod' ? 'cod_fee_paid' : 'paid';
          const done = await Order.findOneAndUpdate(
            { _id: o._id, status: 'placed', paymentStatus: { $in: UNPAID } },
            {
              $set: { paymentStatus: paidStatus, razorpayPaymentId: captured.id },
              $unset: { expiresAt: 1 }
            }
          );
          if (done) confirmed++;
          else skipped++; // verify()/webhook confirmed it first — fine
          continue;
        }

        if (items.some((p) => p.status === 'authorized')) {
          skipped++; // payment in flight; check again next sweep
          continue;
        }
      }

      // Nothing paid. Atomic claim: only one caller can flip this order to
      // cancelled; `new: false` returns it as it was, with stockReservations.
      const order = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: 'placed',
          paymentStatus: { $in: UNPAID },
          expiresAt: { $lte: new Date() }
        },
        { $set: { status: 'cancelled', paymentStatus: 'failed' }, $unset: { expiresAt: 1 } },
        { new: false }
      );
      if (!order) {
        skipped++; // paid or handled by someone else in the meantime
        continue;
      }

      await rollbackStock(order.stockReservations || []);
      await releaseCoupon(order.couponCode);
      released++;
    } catch (err) {
      // Includes failed Razorpay lookups: leave it for the next sweep
      // rather than guessing.
      console.error(`releaseExpiredOrders: failed for order ${String(o._id)}:`, err);
      skipped++;
    }
  }

  return { swept: stale.length, released, confirmed, skipped };
}