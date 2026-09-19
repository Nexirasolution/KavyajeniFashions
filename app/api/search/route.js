export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ products: [] });
  const products = await Product.find({
    isActive: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ]
  })
    .limit(20)
    .select('name slug basePrice variants');
  return NextResponse.json({ products });
}
