// Location: app/api/admin/inventory/bulk/route.js

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';

const MAX_IDS = 1000;
const MAX_QTY = 100000;
const MODES = ['set', 'add', 'subtract', 'zero'];

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
  if (!ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
    return bad('Invalid product id');
  }

  if (action === 'delete') {
    const result = await Product.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({ deleted: result.deletedCount });
  }

  if (action === 'stock') {
    if (!MODES.includes(mode)) return bad('Invalid stock action');
    const qty = mode === 'zero' ? 0 : Number(value);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
      return bad('Enter a whole number, 0 or more');
    }

    const products = await Product.find({ _id: { $in: ids } }).select('variants').lean();
    if (products.length === 0) return NextResponse.json({ updated: 0 });

    const ops = products.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            variants: (p.variants || []).map((v) => ({
              ...v,
              sizes: (v.sizes || []).map((s) => ({ ...s, stock: nextStock(s.stock, mode, qty) })),
            })),
          },
        },
      },
    }));

    await Product.bulkWrite(ops);
    return NextResponse.json({ updated: products.length });
  }

  return bad('Unknown action');
});