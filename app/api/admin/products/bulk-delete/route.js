import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';
import { deleteProductImagesFromR2 } from '@/lib/deleteProductImages';

// POST /api/admin/products/bulk-delete  body: { ids: ["...", "..."] }
export const POST = requireAdmin(async (req) => {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { ids } = body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No product ids provided' }, { status: 400 });
  }

  const products = await Product.find({ _id: { $in: ids } });
  if (!products.length) {
    return NextResponse.json({ error: 'No matching products found' }, { status: 404 });
  }

  // Best-effort R2 cleanup for every matched product's images
  try {
    await deleteProductImagesFromR2(products);
  } catch (err) {
    console.error('R2 image cleanup failed:', err);
  }

  const result = await Product.deleteMany({ _id: { $in: ids } });

  return NextResponse.json({ success: true, deletedCount: result.deletedCount });
});