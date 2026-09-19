import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';

export async function POST(req) {
  await dbConnect();
  const { items } = await req.json(); // [{ productId, variantId, size, qty }]

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const results = items.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product || !product.isActive) {
      return { ...item, available: 0, ok: false, reason: 'Product no longer available' };
    }

    const variant = product.variants.id(item.variantId);
    if (!variant) {
      return { ...item, available: 0, ok: false, reason: 'Color no longer available' };
    }

    const sizeEntry = variant.sizes.find((s) => s.size === item.size);
    const available = sizeEntry?.stock ?? 0;

    return {
      ...item,
      available,
      ok: available >= item.qty,
      reason:
        available === 0
          ? 'Out of stock'
          : available < item.qty
          ? `Only ${available} left`
          : null
    };
  });

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ allOk, results });
}