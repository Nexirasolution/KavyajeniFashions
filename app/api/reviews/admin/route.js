import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';

// POST /api/reviews/admin -> admin creates a review directly (e.g. seeding social proof)
export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  const { product, customerName, rating, comment, images, isFeatured } = body;

  if (!product || !customerName || !rating) {
    return NextResponse.json({ error: 'Product, name and rating are required' }, { status: 400 });
  }

  const review = await Review.create({
    product,
    customerName,
    rating: Number(rating),
    comment: comment || '',
    images: Array.isArray(images) ? images : [],
    isFeatured: !!isFeatured,
    isApproved: true, // admin-created reviews go live immediately
    isVerifiedPurchase: false
  });

  // recompute product rating, same as the approval flow
  const all = await Review.find({ product, isApproved: true });
  if (all.length) {
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await Product.findByIdAndUpdate(product, { rating: Math.round(avg * 10) / 10, reviewCount: all.length });
  }

  return NextResponse.json({ review }, { status: 201 });
});