export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { requireAdmin } from '@/lib/apiAuth';
import { getShippingSettings } from '@/lib/shipping';
import { sanitizeRule, sanitizeStateRules } from '@/lib/shippingConfig';
import { sanitizeDiscountRules } from '@/lib/discountConfig';

export async function GET() {
  await dbConnect();
  // Creates the document / upgrades an old one to state-wise rules if needed.
  const settings = await getShippingSettings();
  return NextResponse.json({ settings });
}

export const PUT = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();

  // Never write Mongo-managed fields back, and never let the key change.
  delete body._id;
  delete body.__v;
  delete body.createdAt;
  delete body.updatedAt;
  delete body.key;

  if (body.defaultRule) body.defaultRule = sanitizeRule(body.defaultRule);
  if (body.shippingRules) body.shippingRules = sanitizeStateRules(body.shippingRules);
  if (body.discountRules) body.discountRules = sanitizeDiscountRules(body.discountRules);

  const settings = await Settings.findOneAndUpdate({ key: 'global' }, body, { new: true, upsert: true });
  return NextResponse.json({ settings });
});

// NOTE: the old public POST (shipping calculation) was removed.
// Checkout now uses POST /api/shipping/quote instead.