import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { requireAdmin } from '@/lib/apiAuth';

export const GET = requireAdmin(async () => {
  await dbConnect();
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  return NextResponse.json({ coupons });
});

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  body.code = (body.code || '').toUpperCase().trim();
  if (!body.code || !body.value) return NextResponse.json({ error: 'Coupon code and value are required' }, { status: 400 });
  const exists = await Coupon.findOne({ code: body.code });
  if (exists) return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
  const coupon = await Coupon.create(body);
  return NextResponse.json({ coupon }, { status: 201 });
});
