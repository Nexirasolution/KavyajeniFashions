export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { requireAdmin } from '@/lib/apiAuth';

// `await` works for both Next 14 (plain object) and Next 15+ (Promise)
async function getId(ctx) {
  const params = await ctx?.params;
  return params?.id;
}

export const PUT = requireAdmin(async (req, ctx) => {
  try {
    const id = await getId(ctx);
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await dbConnect();
    const body = await req.json();

    // never let the client overwrite these
    delete body._id;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.__v;

    const banner = await Banner.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!banner) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }
    return NextResponse.json({ banner });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req, ctx) => {
  try {
    const id = await getId(ctx);
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await dbConnect();
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});