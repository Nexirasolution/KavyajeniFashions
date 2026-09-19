import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';

export async function POST(req) {
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

  if (!ids.length) return NextResponse.json({ products: [] });

  const products = await Product.find({ _id: { $in: ids }, isActive: true }).lean();
  return NextResponse.json({ products: JSON.parse(JSON.stringify(products)) });
}