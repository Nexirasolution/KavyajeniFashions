import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';

export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const search = searchParams.get('search');
  const query = {};
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { 'customer.phone': { $regex: search, $options: 'i' } }
    ];
  }
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 20);
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(query)
  ]);
  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});