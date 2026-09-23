// Automatic, tiered discounts applied to the whole cart at checkout.
// A rule fires when the cart satisfies ALL the conditions it sets (any
// condition left at 0 is ignored). When more than one rule fires, the one
// with the highest discountPercent wins.

export const DEFAULT_DISCOUNT_RULE = {
  label: '',
  minAmount: 0,   // ₹ subtotal required, 0 = no requirement
  minQty: 0,      // minimum total item quantity across the cart, 0 = no requirement
  exactQty: 0,    // total quantity must equal this exactly, 0 = no requirement
  discountPercent: 0
};

export function sanitizeDiscountRule(rule) {
  return {
    label: String(rule?.label || '').trim(),
    minAmount: Math.max(0, Number(rule?.minAmount) || 0),
    minQty: Math.max(0, Math.floor(Number(rule?.minQty) || 0)),
    exactQty: Math.max(0, Math.floor(Number(rule?.exactQty) || 0)),
    discountPercent: Math.min(100, Math.max(0, Number(rule?.discountPercent) || 0))
  };
}

export function sanitizeDiscountRules(rules) {
  return (Array.isArray(rules) ? rules : []).map(sanitizeDiscountRule);
}

export function getTotalQty(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, i) => sum + Math.max(0, Math.floor(Number(i.qty) || 0)),
    0
  );
}

// Every condition set on a rule (> 0) must be satisfied for it to qualify.
// Among the rules the cart qualifies for, the one with the highest
// discountPercent wins. Returns null when nothing qualifies.
export function computeBestDiscount(rules, { subtotal, totalQty }) {
  const amt = Number(subtotal) || 0;
  const qty = Number(totalQty) || 0;

  const eligible = (Array.isArray(rules) ? rules : []).filter((r) => {
    if (!r || r.discountPercent <= 0) return false;
    if (r.minAmount > 0 && amt < r.minAmount) return false;
    if (r.minQty > 0 && qty < r.minQty) return false;
    if (r.exactQty > 0 && qty !== r.exactQty) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const best = eligible.reduce((a, b) => (b.discountPercent > a.discountPercent ? b : a));
  return {
    label: best.label,
    discountPercent: best.discountPercent,
    minAmount: best.minAmount,
    minQty: best.minQty,
    exactQty: best.exactQty,
    discountAmount: Math.round((amt * best.discountPercent) / 100)
  };
}