export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Review from '@/models/Review';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/reviews?featured=true       -> homepage review section
// GET /api/reviews?all=true            -> admin: all reviews
// GET /api/reviews?orderId=<id>        -> which products on this order already have a review
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const featured = searchParams.get('featured');
  const all = searchParams.get('all');
  const orderId = searchParams.get('orderId');

  if (orderId) {
    const reviews = await Review.find({ order: orderId }).select('product');
    return NextResponse.json({ reviewedProductIds: reviews.map((r) => String(r.product)) });
  }

  const query = all ? {} : { isApproved: true };
  if (featured) query.isFeatured = true;
  const reviews = await Review.find(query).sort({ createdAt: -1 }).populate('product', 'name slug').limit(50);
  return NextResponse.json({ reviews });
}

// Public: customer submits a review directly (no order attached) — still goes for admin approval
export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  if (!body.product || !body.customerName || !body.rating) {
    return NextResponse.json({ error: 'Product, name and rating are required' }, { status: 400 });
  }
  const review = await Review.create({ ...body, isApproved: false, isVerifiedPurchase: false });
  return NextResponse.json({ review, message: 'Thanks! Your review will appear after approval.' }, { status: 201 });
}