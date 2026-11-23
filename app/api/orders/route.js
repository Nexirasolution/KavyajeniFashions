import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';
import { VISIBLE_ORDER_FILTER } from '@/lib/orderFilters';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = (searchParams.get('search') || '').trim();

  // NOTE: any `paymentStatus` query param is deliberately ignored, so an old
  // client can't hide COD orders. Visibility is decided only by VISIBLE_ORDER_FILTER.
  // Every clause goes into $and so the payment $or and the search $or
  // never overwrite each other.
  const and = [VISIBLE_ORDER_FILTER];

  if (status) and.push({ status });

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };

    // Name: tolerate extra/multiple spaces ("john   doe" still matches "John Doe").
    const nameRx = {
      $regex: search.split(/\s+/).map(escapeRegex).join('\\s+'),
      $options: 'i'
    };

    const conditions = [
      { orderNumber: rx },
      { 'customer.name': nameRx },
      { 'customer.phone': rx },
      { 'courier.trackingId': rx },
      { 'courier.awbNumber': rx },
      { 'items.name': rx } // product name snapshot stored on each order item
    ];

    // Phone: match regardless of how it was typed OR how it's stored.
    // Typing "98765 43210" or "9876543210" matches a stored "+91 98765-43210".
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 3) {
      conditions.push({
        'customer.phone': {
          $regex: digits.slice(-10).split('').join('\\D*')
        }
      });
    }

    and.push({ $or: conditions });
  }

  const query = { $and: and };

  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20) || 20));

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(query)
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});