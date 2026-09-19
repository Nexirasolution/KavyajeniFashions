import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const review = await Review.findByIdAndUpdate(params.id, body, { new: true });

  // recompute product rating
  const all = await Review.find({ product: review.product, isApproved: true });
  if (all.length) {
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await Product.findByIdAndUpdate(review.product, { rating: Math.round(avg * 10) / 10, reviewCount: all.length });
  }
  return NextResponse.json({ review });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Review.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
});
