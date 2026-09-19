export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/products?category=slug&size=M&minPrice=0&maxPrice=2000&sort=newest&page=1&limit=20&tag=bestseller
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const query = { isActive: true };

  const categorySlug = searchParams.get('category');
  if (categorySlug) {
    const cat = await Category.findOne({ slug: categorySlug });
    if (cat) {
      // Include products tagged to this category AND to any of its subcategories,
      // so a parent category page shows all products under it, not just ones
      // tagged directly to the parent.
      const subcategoryIds = await Category.find({ parent: cat._id }).distinct('_id');
      query.category = subcategoryIds.length
        ? { $in: [cat._id, ...subcategoryIds] }
        : cat._id;
    } else {
      return NextResponse.json({ products: [], total: 0 });
    }
  }

  const size = searchParams.get('size');
  if (size) query['variants.sizes.size'] = size;

  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  if (minPrice || maxPrice) {
    query.basePrice = {};
    if (minPrice) query.basePrice.$gte = Number(minPrice);
    if (maxPrice) query.basePrice.$lte = Number(maxPrice);
  }

  const flag = searchParams.get('flag'); // bestseller | topseller | active | featured
  if (flag === 'bestseller') query.isBestSeller = true;
  if (flag === 'topseller') query.isTopSeller = true;
  if (flag === 'active') query.isActiveSeller = true;
  if (flag === 'featured') query.isFeatured = true;

  const sort = searchParams.get('sort') || 'newest';
  const sortMap = {
    newest: { createdAt: -1 },
    priceLow: { basePrice: 1 },
    priceHigh: { basePrice: -1 },
    popular: { soldCount: -1 },
    rating: { rating: -1 }
  };

  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 24);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort(sortMap[sort] || sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(query)
  ]);

  return NextResponse.json({ products, total, page, pages: Math.ceil(total / limit) });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.name || !body.category) {
    return NextResponse.json({ error: 'Product name and category are required' }, { status: 400 });
  }
  const slug = body.slug ? slugify(body.slug, { lower: true }) : slugify(body.name, { lower: true });
  const exists = await Product.findOne({ slug });
  if (exists) return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 });

  const basePrice = body.variants?.length
    ? Math.min(...body.variants.map((v) => v.price))
    : body.basePrice || 0;

  const product = await Product.create({ ...body, slug, basePrice });
  return NextResponse.json({ product }, { status: 201 });
});