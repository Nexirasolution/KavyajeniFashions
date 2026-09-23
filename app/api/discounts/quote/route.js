export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getShippingSettings } from '@/lib/shipping';
import { computeBestDiscount, getTotalQty } from '@/lib/discountConfig';

// Public endpoint — the checkout page calls this to find out whether the
// current cart automatically qualifies for a discount, based on the rules
// the admin set on the Settings page. No coupon code involved.
export async function POST(req) {
  await dbConnect();
  const { items, subtotal } = await req.json();

  // Reuses getShippingSettings() rather than a raw Settings.findOne() so
  // discountRules always comes back as an array (schema default: []),
  // even for a settings document that predates this feature.
  const settings = await getShippingSettings();
  const totalQty = getTotalQty(items);
  const discount = computeBestDiscount(settings.discountRules, {
    subtotal: Number(subtotal) || 0,
    totalQty
  });

  // null when nothing qualifies, otherwise
  // { label, discountPercent, discountAmount, minAmount, minQty, exactQty }
  return NextResponse.json({ discount });
}