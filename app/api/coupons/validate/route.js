import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { genCouponCheck } from '@/lib/utils';

export async function POST(req) {
  await dbConnect();
  const { code, subtotal } = await req.json();
  const coupon = await Coupon.findOne({ code: genCouponCheck(code), isActive: true });
  if (!coupon) return NextResponse.json({ valid: false, message: 'Invalid coupon code' });
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, message: 'This coupon has expired' });
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return NextResponse.json({ valid: false, message: 'This coupon has reached its usage limit' });
  }
  if (subtotal < (coupon.minOrderValue || 0)) {
    return NextResponse.json({ valid: false, message: `Minimum order value is ₹${coupon.minOrderValue}` });
  }
  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return NextResponse.json({ valid: true, discount: Math.round(discount), message: 'Coupon applied!' });
}
