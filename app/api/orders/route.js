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
  const search = searchParams.get('search');
  const query = {};
  if (status) query.status = status;
  if (paymentStatus) {
    // supports a single value or a comma-separated list, e.g. "paid,cod_fee_paid"
    const statuses = paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
    query.paymentStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (search) {
    const safe = escapeRegex(search);
    query.$or = [
      { orderNumber: { $regex: safe, $options: 'i' } },
      { 'customer.name': { $regex: safe, $options: 'i' } },
      { 'customer.phone': { $regex: safe, $options: 'i' } }
    ];
  }
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20) || 20));
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(query)
  ]);
  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});