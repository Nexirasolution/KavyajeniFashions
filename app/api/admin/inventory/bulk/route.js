// Location: app/api/admin/inventory/bulk/route.js

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';
import { deleteProductImagesFromR2 } from '@/lib/deleteProductImages';

const MAX_IDS = 1000;
const MAX_QTY = 100000;
const MODES = ['set', 'add', 'subtract', 'zero'];
const OBJECT_ID = /^[a-f\d]{24}$/i; // strict: exactly 24 hex chars

const bad = (message) => NextResponse.json({ error: message }, { status: 400 });

function nextStock(current, mode, value) {
  const c = Number(current) || 0;
  switch (mode) {
    case 'set':
      return value;
    case 'zero':
      return 0;
    case 'add':
      return c + value;
    case 'subtract':
      return Math.max(0, c - value); // never goes below 0
    default:
      return c;
  }
}

// Clears the storefront caches for the given products (same tags as the
// single-product PUT/DELETE in app/api/products/[id]/route.js).
function revalidateProducts(products) {
  try {
    for (const slug of new Set(products.map((p) => p.slug).filter(Boolean))) {
      revalidateTag(`product-${slug}`);
    }
    revalidateTag('product-list');
  } catch (err) {
    console.error('Revalidation failed:', err);
  }
}

// POST /api/admin/inventory/bulk
//   { action: 'delete', ids: [...] }
//   { action: 'stock',  ids: [...], mode: 'set' | 'add' | 'subtract' | 'zero', value: 10 }
export const POST = requireAdmin(async (req) => {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return bad('Invalid request body');
  }

  const { action, ids, mode, value } = body || {};

  if (!Array.isArray(ids) || ids.length === 0) return bad('Select at least one product');
  if (ids.length > MAX_IDS) return bad(`Select at most ${MAX_IDS} products at a time`);
  if (!ids.every((id) => typeof id === 'string' && OBJECT_ID.test(id))) {
    return bad('Invalid product id');
  }

  if (action === 'delete') {
    // Load the products first: we need their images (R2 cleanup) and slugs (cache tags)
    const products = await Product.find({ _id: { $in: ids } }).lean();
    if (products.length === 0) return NextResponse.json({ deleted: 0 });

    // Best-effort R2 cleanup, one product at a time so one failure doesn't block the rest
    await Promise.all(
      products.map(async (p) => {
        try {
          await deleteProductImagesFromR2(p);
        } catch (err) {
          console.error(`R2 image cleanup failed for ${p._id}:`, err);
        }
      })
    );

    const result = await Product.deleteMany({ _id: { $in: products.map((p) => p._id) } });
    revalidateProducts(products);
    return NextResponse.json({ deleted: result.deletedCount });
  }

  if (action === 'stock') {
    if (!MODES.includes(mode)) return bad('Invalid stock action');
    const qty = mode === 'zero' ? 0 : Number(value);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
      return bad('Enter a whole number, 0 or more');
    }

    const products = await Product.find({ _id: { $in: ids } })
      .select('slug variants')
      .lean();
    if (products.length === 0) return NextResponse.json({ updated: 0 });

    // Set only each size's `stock` field by position instead of rewriting the whole
    // variants array, so other fields (and concurrent edits to them) are untouched.
    const ops = products
      .map((p) => {
        const $set = {};
        (p.variants || []).forEach((v, vi) => {
          (v.sizes || []).forEach((s, si) => {
            $set[`variants.${vi}.sizes.${si}.stock`] = nextStock(s.stock, mode, qty);
          });
        });
        if (Object.keys($set).length === 0) return null;
        return { updateOne: { filter: { _id: p._id }, update: { $set } } };
      })
      .filter(Boolean);

    if (ops.length) await Product.bulkWrite(ops);

    revalidateProducts(products);
    return NextResponse.json({ updated: products.length });
  }

  return bad('Unknown action');
});