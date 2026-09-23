// Location: app/api/admin/inventory/route.js

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import '@/models/Category'; // registers the Category schema, required for .populate('category')
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/admin/inventory
// Returns EVERY active product (including ones with 0 stock) with its category and parent
// category. Pagination and category grouping happen on the client.
//
// `description` is included (but never `price`) so the bulk Share action can build a
// message from name + description without ever exposing price.
export const GET = requireAdmin(async () => {
  await dbConnect();

  const products = await Product.find({ isActive: true })
    .select('name slug description variants category images image thumbnail')
    .populate({
      path: 'category',
      select: 'name slug parent',
      populate: { path: 'parent', select: 'name' },
    })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ products });
});