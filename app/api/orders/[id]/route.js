// Location: app/api/orders/[id]/route.js

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';

// Public: track/view a single order (used on order-success page)
export async function GET(req, props) {
  const { id } = await props.params;
  await dbConnect();

  // Only match _id when the value is a valid ObjectId. Otherwise Mongoose throws a
  // CastError for order numbers and the request returns a 500 instead of a 404.
  const filter = mongoose.isValidObjectId(id)
    ? { $or: [{ _id: id }, { orderNumber: id }] }
    : { orderNumber: id };

  const order = await Order.findOne(filter);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export const PUT = requireAdmin(async (req, { params }) => {
  const { id } = await params; // Next.js 15+: params is a Promise
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const order = await Order.findByIdAndUpdate(id, body, { new: true });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
});