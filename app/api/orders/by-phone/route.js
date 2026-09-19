import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

// --- simple in-memory rate limiter (per server instance) ---
// 5 lookups per 10 minutes per IP. Good enough for a small store;
// resets on deploy/restart, which is fine for this use case.
const RATE_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const cleaned = (body.phone || '').replace(/\D/g, '').slice(-10);

  if (cleaned.length !== 10) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 });
  }

  // only look back 12 months to limit exposure
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const orders = await Order.find({
    'customer.phone': { $regex: cleaned + '$' }, // matches with or without +91 prefix
    createdAt: { $gte: since }
  })
    .sort({ createdAt: -1 })
    .lean();

  // mask sensitive fields — only return what's needed to track an order
  const safeOrders = orders.map((o) => ({
    _id: o._id,
    orderNumber: o.orderNumber,
    items: o.items.map((i) => ({
      name: i.name,
      image: i.image,
      color: i.color,
      size: i.size,
      price: i.price,
      qty: i.qty,
      product: i.product ? String(i.product) : null,
      isCombo: i.isCombo || false
    })),
    total: o.total,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    courier: (o.courier?.trackingId || o.courier?.awbNumber)
      ? {
          partner: o.courier.partner,
          trackingId: o.courier.trackingId,
          awbNumber: o.courier.awbNumber
        }
      : null,
    createdAt: o.createdAt
  }));

  return NextResponse.json({ orders: safeOrders });
}