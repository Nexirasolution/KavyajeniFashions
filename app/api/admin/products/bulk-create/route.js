import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';
import { slugify } from '@/lib/slugify';

// POST /api/admin/products/bulk-create
// body: { products: [{ name, category, fabric, tags, description, variants: [...], isActive, ... }] }
// Each entry in `products` becomes one Product document. Slugs are auto-generated
// from name and de-duplicated with a numeric suffix if they collide.
export const POST = requireAdmin(async (req) => {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { products } = body || {};
  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: 'No products provided' }, { status: 400 });
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      if (!p.name) throw new Error('Missing name');
      if (!p.category) throw new Error('Missing category');
      if (!p.variants?.length) throw new Error('Missing variants/images');

      const basePrice = Math.min(...p.variants.map((v) => Number(v.price) || 0));

      const baseSlug = slugify(p.name);
      let candidate = baseSlug;
      let suffix = 0;
      while (await Product.exists({ slug: candidate })) {
        suffix += 1;
        candidate = `${baseSlug}-${suffix}`;
      }

      const doc = await Product.create({
        ...p,
        slug: candidate,
        basePrice,
        variants: p.variants.map((v) => ({
          color: v.color || '',
          colorHex: v.colorHex || '#000000',
          images: (v.images || []).filter(Boolean),
          price: Number(v.price),
          compareAtPrice: Number(v.compareAtPrice) || 0,
          sizes: (v.sizes || []).map((s) => ({ ...s, stock: Number(s.stock) || 0 })),
        })),
      });

      created.push({ id: doc._id, name: doc.name, slug: doc.slug });
    } catch (err) {
      errors.push({ index: i, name: p.name, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    createdCount: created.length,
    created,
    errors,
  });
});