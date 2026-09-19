export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Reel from '@/models/Reel';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');
  const query = all ? {} : { isActive: true };
  const reels = await Reel.find(query).sort({ sortOrder: 1 }).populate('product', 'name slug');
  return NextResponse.json({ reels });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.videoUrl) return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
  const reel = await Reel.create(body);
  return NextResponse.json({ reel }, { status: 201 });
});
