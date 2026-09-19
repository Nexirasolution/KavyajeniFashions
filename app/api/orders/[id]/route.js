import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';

// Public: track/view a single order (used on order-success page)
export async function GET(req, { params }) {
  await dbConnect();
  const order = await Order.findOne({ $or: [{ _id: params.id }, { orderNumber: params.id }] });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const order = await Order.findByIdAndUpdate(params.id, body, { new: true });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
});
