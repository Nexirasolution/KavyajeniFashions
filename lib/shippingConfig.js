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

// Courier shown to the customer under the selected payment method.
// Admin can change both names from the settings page.
export const DEFAULT_COURIERS = {
  online: 'ST Courier',
  cod: 'Postal Courier'
};

// "Tamil Nadu", "tamilnadu", "TAMIL  NADU" all become "tamilnadu".
export function normalizeState(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

// Rule applied to any state that has no state-specific rule.
//
// Shipping is worked out from the NUMBER OF MATCHING PRODUCTS (e.g. nighties)
// in the cart. `productKeywords` says which products count. If it is empty,
// the total quantity of the cart is used instead.
export const DEFAULT_RULE = {
  // Keywords matched against product name / category, e.g. "nighty, nighties"
  productKeywords: '',

  // ── Online payment (delivered by the "online" courier) ──
  shippingFee: 49,              // used when no quantity row matches
  freeShippingAbove: 0,         // 0 = never free (online orders only)
  onlineShippingTiers: [],      // [{ qty, fee }]

  // ── Cash on Delivery (delivered by the "COD" courier) ──
  // COD is NOT prepaid: nothing is charged online. Items + shipping are all
  // collected in cash on delivery.
  codMode: 'disabled',          // 'disabled' | 'enabled' | 'conditional'
  codShippingFee: 49,           // used when no quantity row matches
  codShippingTiers: [],         // [{ qty, fee }]
  // Only used when codMode === 'conditional':
  codMinQty: 0,                 // matching items needed (0 = no minimum)
  codMaxQty: 0,                 // matching items allowed (0 = no maximum)
  codCartOnlyMatching: false    // true = cart may contain nothing except matching items
};

// Starting point for Tamil Nadu. The numbers are only examples - change them
// on the admin settings page.
export const tnPreset = (shippingFee = DEFAULT_RULE.shippingFee) => ({
  state: 'Tamil Nadu',
  ...DEFAULT_RULE,
  productKeywords: 'nighty, nighties',
  shippingFee,
  freeShippingAbove: 800,
  onlineShippingTiers: [
    { qty: 1, fee: 60 },
    { qty: 2, fee: 80 },
    { qty: 3, fee: 99 }
  ],
  codMode: 'conditional',
  codShippingFee: 90,
  codShippingTiers: [
    { qty: 1, fee: 90 },
    { qty: 2, fee: 110 },
    { qty: 3, fee: 130 }
  ],
  codMinQty: 1,
  codMaxQty: 3,
  codCartOnlyMatching: false
});

const COD_MODES = ['disabled', 'enabled', 'conditional'];
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Keeps valid rows only, removes duplicate quantities (first wins), sorts by qty.
export function sanitizeTiers(tiers = []) {
  const seen = new Map();
  for (const t of Array.isArray(tiers) ? tiers : []) {
    const qty = Math.floor(Number(t?.qty));
    const fee = Number(t?.fee);
    if (!Number.isFinite(qty) || qty < 1) continue;
    if (!Number.isFinite(fee) || fee < 0) continue;
    if (!seen.has(qty)) seen.set(qty, { qty, fee });
  }
  return [...seen.values()].sort((a, b) => a.qty - b.qty);
}

// Fills in defaults and upgrades rules saved by older versions:
//   • codCategoryKeywords  -> productKeywords
//   • codExactQty          -> codMinQty = codMaxQty
// Safe to call on the client and the server.
export function migrateRule(r = {}) {
  const m = { ...DEFAULT_RULE, ...r };

  if (!String(m.productKeywords || '').trim() && r.codCategoryKeywords) {
    m.productKeywords = r.codCategoryKeywords;
  }
  if (!(Number(m.codMinQty) > 0) && !(Number(m.codMaxQty) > 0) && Number(r.codExactQty) > 0) {
    m.codMinQty = Math.floor(Number(r.codExactQty));
    m.codMaxQty = Math.floor(Number(r.codExactQty));
  }

  m.onlineShippingTiers = sanitizeTiers(m.onlineShippingTiers);
  m.codShippingTiers = sanitizeTiers(m.codShippingTiers);
  return m;
}

export function sanitizeRule(r = {}) {
  const m = migrateRule(r);
  return {
    productKeywords: String(m.productKeywords || '').trim(),
    shippingFee: num(m.shippingFee),
    freeShippingAbove: num(m.freeShippingAbove),
    onlineShippingTiers: sanitizeTiers(m.onlineShippingTiers),
    codMode: COD_MODES.includes(m.codMode) ? m.codMode : 'disabled',
    codShippingFee: num(m.codShippingFee),
    codShippingTiers: sanitizeTiers(m.codShippingTiers),
    codMinQty: Math.floor(num(m.codMinQty)),
    codMaxQty: Math.floor(num(m.codMaxQty)),
    codCartOnlyMatching: !!m.codCartOnlyMatching
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
  return { ...migrateRule(base), matchedState: match ? match.state : null };
}

export function parseKeywords(csv) {
  return String(csv || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

// counts = { totalQty, matchedQty }
// The quantity that drives shipping: matching products when keywords are set,
// otherwise every item in the cart.
export function tierQty(rule, counts) {
  const hasKeywords = parseKeywords(rule.productKeywords).length > 0;
  return hasKeywords ? counts?.matchedQty ?? 0 : counts?.totalQty ?? 0;
}

// Picks the fee for `qty`:
//   • the row with the highest qty that is <= the cart quantity
//     (so 5 items with rows for 1,2,3 uses the row for 3)
//   • `fallback` if the quantity is below every row (or there are no rows)
export function pickTierFee(tiers, qty, fallback) {
  let fee = fallback;
  for (const t of sanitizeTiers(tiers)) {
    if (t.qty <= qty) fee = t.fee;
  }
  return fee;
}

// method: 'online' | 'cod'
// Free shipping above a certain amount applies to ONLINE orders only.
export function computeShipping(rule, amountAfterDiscount, counts, method = 'online') {
  const qty = tierQty(rule, counts);

  if (method === 'cod') {
    return pickTierFee(rule.codShippingTiers, qty, num(rule.codShippingFee));
  }

  const isFree = rule.freeShippingAbove > 0 && amountAfterDiscount >= rule.freeShippingAbove;
  return isFree ? 0 : pickTierFee(rule.onlineShippingTiers, qty, num(rule.shippingFee));
}

// counts = { totalQty, matchedQty } — only read when the rule is 'conditional'.
export function evaluateCod(rule, counts, stateLabel) {
  if (rule.codMode === 'enabled') {
    return { available: true, reason: '' };
  }

  const notAvailable = `Cash on Delivery is not available for ${stateLabel}.`;
  if (rule.codMode !== 'conditional') {
    return { available: false, reason: notAvailable };
  }

  const keyword = parseKeywords(rule.productKeywords)[0];
  const min = Math.floor(rule.codMinQty || 0);
  const max = Math.floor(rule.codMaxQty || 0);
  if (!keyword || min < 1) {
    return { available: false, reason: notAvailable };
  }

  const matched = counts?.matchedQty ?? 0;
  const total = counts?.totalQty ?? 0;
  const inRange = matched >= min && (max < 1 || matched <= max);
  const ok = inRange && (!rule.codCartOnlyMatching || total === matched);

  if (ok) return { available: true, reason: '' };

  const range =
    max === min ? `exactly ${min}` : max > 0 ? `between ${min} and ${max}` : `at least ${min}`;
  const plural = max === 1 && min === 1 ? '' : 's';

  return {
    available: false,
    reason:
      `Cash on Delivery in ${stateLabel} is available only when you order ${range} ` +
      `${keyword} item${plural}${rule.codCartOnlyMatching ? ' and nothing else' : ''}.`
  };
}