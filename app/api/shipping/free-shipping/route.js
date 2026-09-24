export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getShippingSettings } from '@/lib/shipping';

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Public and read-only: returns ONLY the free shipping amount for the
// storefront marquee (no fees, COD rules or other settings).
//
// 1) Uses the default rule (every state without its own rule).
// 2) If the default is 0 ("never free"), falls back to the lowest
//    state-specific threshold and returns that state's name.
export async function GET() {
  try {
    await dbConnect();
    const settings = await getShippingSettings();

    const base = positive(settings.defaultRule?.freeShippingAbove);
    if (base) {
      return NextResponse.json({ freeShipping: { minOrderValue: base, state: null } });
    }

    const lowest = (settings.shippingRules || [])
      .map((r) => ({ state: r.state, min: positive(r.freeShippingAbove) }))
      .filter((r) => r.min > 0)
      .sort((a, b) => a.min - b.min)[0];

    return NextResponse.json({
      freeShipping: lowest ? { minOrderValue: lowest.min, state: lowest.state } : null
    });
  } catch (err) {
    console.error('Free shipping lookup error:', err);
    return NextResponse.json({ freeShipping: null });
  }
}