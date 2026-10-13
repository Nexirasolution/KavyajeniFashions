import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';

async function recomputeProductRating(productId) {
  const approved = await Review.find({ product: productId, isApproved: true });
  const count = approved.length;
  const avg = count ? approved.reduce((s, r) => s + r.rating, 0) / count : 0;
  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  // Next.js 15+: params is a Promise. Awaiting is safe on older versions too.
  const { id } = await params;
  const body = await req.json();

  const review = await Review.findByIdAndUpdate(id, body, { new: true });
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  await recomputeProductRating(review.product);
  return NextResponse.json({ review });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const { id } = await params;

  const review = await Review.findByIdAndDelete(id);
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  // Keep the product's rating in sync after a delete too
  await recomputeProductRating(review.product);
  return NextResponse.json({ success: true });
});