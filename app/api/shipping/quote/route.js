export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getShippingSettings, getCodStatus } from '@/lib/shipping';
import { resolveRule, computeShipping } from '@/lib/shippingConfig';

// Used by the checkout page to PREVIEW shipping + COD for the chosen state.
// This is display-only: /api/payment/create-order recomputes everything
// server-side and is the source of truth.
export async function POST(req) {
  try {
    const { items, state, subtotal } = await req.json();

    if (!state) {
      return NextResponse.json({ error: 'Select a state to calculate shipping' }, { status: 400 });
    }

    await dbConnect();
    const settings = await getShippingSettings();
    const rule = resolveRule(settings, state);

    const shippingFee = computeShipping(rule, Number(subtotal) || 0);
    const lines = (Array.isArray(items) ? items : []).map((i) => ({
      productId: i.productId,
      comboId: i.comboId,
      isCombo: i.isCombo === true,
      qty: i.qty
    }));
    const cod = await getCodStatus(rule, lines, rule.matchedState || state);

    return NextResponse.json({
      shippingFee,
      freeShippingAbove: rule.freeShippingAbove,
      cod
    });
  } catch (err) {
    console.error('Shipping quote error:', err);
    return NextResponse.json({ error: 'Could not calculate shipping' }, { status: 500 });
  }
}
