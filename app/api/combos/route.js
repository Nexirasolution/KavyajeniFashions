export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');
  const query = all ? {} : { isActive: true };
  const combos = await Combo.find(query).populate('products.product', 'name slug variants').sort({ createdAt: -1 });
  return NextResponse.json({ combos });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.name || !body.comboPrice) return NextResponse.json({ error: 'Combo name and price are required' }, { status: 400 });
  const slug = slugify(body.name, { lower: true }) + '-' + Date.now().toString().slice(-4);
  const combo = await Combo.create({ ...body, slug });
  return NextResponse.json({ combo }, { status: 201 });
});
