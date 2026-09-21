// Pure helpers for state-wise shipping + COD rules.
// No DB / server imports here, so client components (admin settings, checkout)
// can import from this file safely.

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

// "Tamil Nadu", "tamilnadu", "TAMIL  NADU" all become "tamilnadu".
export function normalizeState(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

// Rule applied to any state that has no state-specific rule.
export const DEFAULT_RULE = {
  shippingFee: 49,
  freeShippingAbove: 0, // 0 = never free
  codMode: 'disabled', // 'disabled' | 'enabled' | 'conditional'
  codFee: 0,
  // Only used when codMode === 'conditional':
  codCategoryKeywords: '', // comma separated, matched against product name/category
  codExactQty: 0, // cart must contain EXACTLY this many matching items
  codCartOnlyMatching: false // true = cart must contain nothing except matching items
};

// Starting point for Tamil Nadu: free shipping from ₹800, COD only with
// exactly 3 nighties and a ₹75 COD charge. Admin can change all of it.
export const tnPreset = (shippingFee = DEFAULT_RULE.shippingFee) => ({
  state: 'Tamil Nadu',
  ...DEFAULT_RULE,
  shippingFee,
  freeShippingAbove: 800,
  codMode: 'conditional',
  codFee: 75,
  codCategoryKeywords: 'nighty, nighties',
  codExactQty: 3,
  codCartOnlyMatching: false
});

const COD_MODES = ['disabled', 'enabled', 'conditional'];
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function sanitizeRule(r = {}) {
  return {
    shippingFee: num(r.shippingFee),
    freeShippingAbove: num(r.freeShippingAbove),
    codMode: COD_MODES.includes(r.codMode) ? r.codMode : 'disabled',
    codFee: num(r.codFee),
    codCategoryKeywords: String(r.codCategoryKeywords || '').trim(),
    codExactQty: Math.floor(num(r.codExactQty)),
    codCartOnlyMatching: !!r.codCartOnlyMatching
  };
}

// Drops blank states and duplicates (first one wins).
export function sanitizeStateRules(rules = []) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(rules) ? rules : []) {
    const state = String(r?.state || '').trim();
    const key = normalizeState(state);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ state, ...sanitizeRule(r) });
  }
  return out;
}

// settings must be a plain object (not a Mongoose document).
export function resolveRule(settings, state) {
  const key = normalizeState(state);
  const match = key
    ? (settings.shippingRules || []).find((r) => normalizeState(r.state) === key)
    : null;
  const base = match || settings.defaultRule || {};
  return { ...DEFAULT_RULE, ...base, matchedState: match ? match.state : null };
}

export function computeShipping(rule, amountAfterDiscount) {
  const isFree = rule.freeShippingAbove > 0 && amountAfterDiscount >= rule.freeShippingAbove;
  return isFree ? 0 : rule.shippingFee;
}

export function parseKeywords(csv) {
  return String(csv || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

// counts = { totalQty, matchedQty } — only needed (and only read) when the
// rule is 'conditional'.
export function evaluateCod(rule, counts, stateLabel) {
  if (rule.codMode === 'enabled') {
    return { available: true, fee: rule.codFee || 0, reason: '' };
  }

  const notAvailable = `Cash on Delivery is not available for ${stateLabel}.`;
  if (rule.codMode !== 'conditional') {
    return { available: false, fee: 0, reason: notAvailable };
  }

  const keyword = parseKeywords(rule.codCategoryKeywords)[0];
  const need = Math.floor(rule.codExactQty || 0);
  if (!keyword || need < 1) {
    return { available: false, fee: 0, reason: notAvailable };
  }

  const matched = counts?.matchedQty ?? 0;
  const total = counts?.totalQty ?? 0;
  const ok = matched === need && (!rule.codCartOnlyMatching || total === matched);

  if (ok) return { available: true, fee: rule.codFee || 0, reason: '' };

  return {
    available: false,
    fee: 0,
    reason:
      `Cash on Delivery in ${stateLabel} is available only when you order exactly ` +
      `${need} ${keyword} item${need > 1 ? 's' : ''}` +
      `${rule.codCartOnlyMatching ? ' and nothing else' : ''}.`
  };
}
