export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET() {
  await dbConnect();
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) settings = await Settings.create({ key: 'global' });
  return NextResponse.json({ settings });
}

export const PUT = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  const settings = await Settings.findOneAndUpdate({ key: 'global' }, body, { new: true, upsert: true });
  return NextResponse.json({ settings });
});


export async function POST(req) {
  try {
    const { subtotal } = await req.json();
 
    await dbConnect();
    const settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      return NextResponse.json({ error: 'Settings not configured' }, { status: 500 });
    }
 
    const { shippingFee, freeShippingAbove } = settings;
    const shippingCost = subtotal >= freeShippingAbove ? 0 : shippingFee;
 
    return NextResponse.json({ shippingCost, freeShippingAbove, shippingFee });
  } catch (err) {
    console.error('Shipping calculate error:', err);
    return NextResponse.json({ error: 'Could not calculate shipping' }, { status: 500 });
  }
}
