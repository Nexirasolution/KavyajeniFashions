import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Reel from '@/models/Reel';
import { requireAdmin } from '@/lib/apiAuth';

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const reel = await Reel.findByIdAndUpdate(params.id, body, { new: true });
  return NextResponse.json({ reel });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Reel.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
});
