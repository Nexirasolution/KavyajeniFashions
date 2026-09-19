export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/admin/products?category=slug&sort=newest&page=1&limit=1000
// Admin-only: returns ALL products (active + hidden), unlike the public
// /api/products route which only ever returns active ones.
export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const query = {};

  const categorySlug = searchParams.get('category');
  if (categorySlug) {
    const cat = await Category.findOne({ slug: categorySlug });
    if (cat) {
      const subcategoryIds = await Category.find({ parent: cat._id }).distinct('_id');
      query.category = subcategoryIds.length
        ? { $in: [cat._id, ...subcategoryIds] }
        : cat._id;
    } else {
      return NextResponse.json({ products: [], total: 0 });
    }
  }

  const sort = searchParams.get('sort') || 'newest';
  const sortMap = {
    newest: { createdAt: -1 },
    priceLow: { basePrice: 1 },
    priceHigh: { basePrice: -1 },
    popular: { soldCount: -1 },
    rating: { rating: -1 },
  };

  const page = Number(searchParams.get('page') || 1);
  // Admin-only route, so default to a high limit instead of the
  // public storefront's page size of 24 — this dropdown needs every product.
  const limit = Number(searchParams.get('limit') || 1000);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort(sortMap[sort] || sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(query),
  ]);

  return NextResponse.json({ products, total, page, pages: Math.ceil(total / limit) });
});