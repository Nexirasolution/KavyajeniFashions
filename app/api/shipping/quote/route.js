export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getShippingSettings, buildShippingQuote } from '@/lib/shipping';
import { resolveRule, INDIAN_STATES } from '@/lib/shippingConfig';

// Display-only quote for the checkout page. The authoritative calculation is
// repeated server-side in /api/payment/create-order, so nothing sent here can
// change what the customer is actually charged.
//
// Response:
// {
//   forState, quantity, freeShippingAbove,
//   online: { shippingFee, courier },
//   cod:    { available, reason, shippingFee, courier }
// }
export async function POST(req) {
  try {
    await dbConnect();
    const { items, state, subtotal } = await req.json();

    if (!state) {
      return NextResponse.json({ error: 'Select a state to calculate shipping' }, { status: 400 });
    }

    const cartItems = Array.isArray(items) ? items : [];
    if (cartItems.length > 100) {
      return NextResponse.json({ error: 'Invalid cart' }, { status: 400 });
    }

    const stateName = INDIAN_STATES.find((s) => s === state);
    if (!stateName) {
      return NextResponse.json({ error: 'Please select a valid state' }, { status: 400 });
    }

    const settings = await getShippingSettings();
    const rule = resolveRule(settings, stateName);

    const lines = cartItems.map((i) => ({
      productId: i.productId,
      comboId: i.comboId,
      isCombo: i.isCombo === true,
      qty: i.qty
    }));

    const amountAfterDiscount = Math.max(0, Number(subtotal) || 0);

    const quote = await buildShippingQuote({
      settings,
      rule,
      lines,
      state: stateName,
      amountAfterDiscount
    });

    return NextResponse.json(quote);
  } catch (err) {
    console.error('shipping quote failed:', err);
    return NextResponse.json({ error: 'Could not calculate shipping' }, { status: 500 });
  }
}