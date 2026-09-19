export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');
  const query = all ? {} : { isActive: true };
  const banners = await Banner.find(query).sort({ sortOrder: 1 });
  return NextResponse.json({ banners });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.image) return NextResponse.json({ error: 'Banner image URL is required' }, { status: 400 });
  const banner = await Banner.create(body);
  return NextResponse.json({ banner }, { status: 201 });
});
