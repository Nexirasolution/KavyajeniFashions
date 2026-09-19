import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { requireAdmin } from '@/lib/apiAuth';

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const banner = await Banner.findByIdAndUpdate(params.id, body, { new: true });
  return NextResponse.json({ banner });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Banner.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
});
