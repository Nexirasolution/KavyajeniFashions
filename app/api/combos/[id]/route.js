import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import { requireAdmin } from '@/lib/apiAuth';

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  const combo = await Combo.findByIdAndUpdate(params.id, body, { new: true });
  return NextResponse.json({ combo });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Combo.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
});
