// Location: app/api/products/[id]/route.js

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Review from '@/models/Review';
import { requireAdmin } from '@/lib/apiAuth';
import { deleteProductImagesFromR2 } from '@/lib/deleteProductImages';

function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

export async function GET(req, props) {
  const { id } = await props.params;
  await dbConnect();

  const product = await Product.findOne({
    ...getFilter(id),
    isActive: true,
  }).populate('category', 'name slug sizes');

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const reviews = await Review.find({ product: product._id, isApproved: true }).sort({ createdAt: -1 });

  const related = await Product.find({
    category: product.category._id,
    _id: { $ne: product._id },
    isActive: true,
  })
    .limit(8)
    .select('name slug basePrice variants rating');

  return NextResponse.json({ product, reviews, related });
}

export const PUT = requireAdmin(async (req, { params }) => {
  // In Next.js 15+, `params` is a Promise and must be awaited.
  const { id } = await params;
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Recompute basePrice from variant prices, ignoring any missing/invalid price
  // so a variant without one can never overwrite basePrice with NaN.
  if (body.variants?.length) {
    const prices = body.variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p));
    if (prices.length) body.basePrice = Math.min(...prices);
  }

  const product = await Product.findOneAndUpdate(getFilter(id), body, { new: true });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // The product detail page is server-rendered with a long `revalidate`
  // window (see app/product/[slug]/page.js). Invalidate its tag explicitly so
  // edits show up immediately.
  revalidateTag(`product-${product.slug}`);
  revalidateTag('product-list'); // homepage / listing tabs, if they use this tag

  return NextResponse.json({ product });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  const { id } = await params;
  await dbConnect();

  const product = await Product.findOne(getFilter(id));
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // Best-effort R2 cleanup: a storage hiccup shouldn't block the DB delete
  try {
    await deleteProductImagesFromR2(product);
  } catch (err) {
    console.error('R2 image cleanup failed:', err);
  }

  await Product.findByIdAndDelete(product._id);

  revalidateTag(`product-${product.slug}`);
  revalidateTag('product-list');

  return NextResponse.json({ success: true });
});