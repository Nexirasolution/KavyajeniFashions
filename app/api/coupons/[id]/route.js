import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { requireAdmin } from '@/lib/apiAuth';

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const coupon = await Coupon.findByIdAndUpdate(params.id, body, { new: true });
  return NextResponse.json({ coupon });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Coupon.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
});
