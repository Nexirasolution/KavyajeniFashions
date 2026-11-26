export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all');
    const query = all ? {} : { isActive: true };
    const banners = await Banner.find(query).sort({ sortOrder: 1, createdAt: -1 });
    return NextResponse.json(
      { banners },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = requireAdmin(async (req) => {
  try {
    await dbConnect();
    const body = await req.json();
    if (!body.image) {
      return NextResponse.json({ error: 'Banner image URL is required' }, { status: 400 });
    }
    delete body._id;
    const banner = await Banner.create(body);
    return NextResponse.json({ banner }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});