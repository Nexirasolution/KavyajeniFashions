import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const search = (searchParams.get('search') || '').trim();
  const query = {};

  if (status) query.status = status;

  if (paymentStatus) {
    // supports a single value or a comma-separated list, e.g. "paid,cod_fee_paid"
    const statuses = paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
    query.paymentStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }

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
    // Allow optional non-digit characters between each digit of the search.
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 3) {
      conditions.push({
        'customer.phone': {
          $regex: digits.slice(-10).split('').join('\\D*')
        }
      });
    }

    query.$or = conditions;
  }

  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20) || 20));

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(query)
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});