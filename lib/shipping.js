import mongoose from 'mongoose';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Settings from '@/models/Settings';
import {
  DEFAULT_RULE,
  tnPreset,
  parseKeywords,
  evaluateCod
} from '@/lib/shippingConfig';

// Returns the global settings as a plain object. Creates the document on first
// use, and upgrades old documents (that only had shippingFee / freeShippingAbove)
// to the new state-wise structure.
export async function getShippingSettings() {
  let s = await Settings.findOne({ key: 'global' });

  if (!s) {
    try {
      s = await Settings.create({
        key: 'global',
        defaultRule: { ...DEFAULT_RULE },
        shippingRules: [tnPreset()]
      });
    } catch (err) {
      // Two requests created the document at the same moment (unique `key`).
      // The other one won — just read what it saved.
      if (err?.code !== 11000) throw err;
      s = await Settings.findOne({ key: 'global' });
    }
  } else if (!s.defaultRule) {
    const fee = s.shippingFee ?? DEFAULT_RULE.shippingFee;
    s.defaultRule = { ...DEFAULT_RULE, shippingFee: fee };
    if (!s.shippingRules?.length) s.shippingRules = [tnPreset(fee)];
    await s.save();
  }

  return s.toObject();
}

function productText(p) {
  return [p.name, p.slug, p.category, p.subCategory, ...(Array.isArray(p.tags) ? p.tags : [])]
    .filter((x) => typeof x === 'string')
    .join(' ')
    .toLowerCase();
}

// lines: [{ productId, comboId, isCombo, qty }]
// Returns how many units are in the cart in total, and how many of them match
// one of the keywords. Combos are counted by the products inside them.
export async function countCartQuantities(lines, keywordsCsv) {
  const keywords = parseKeywords(keywordsCsv);
  const isId = (id) => mongoose.Types.ObjectId.isValid(id);

  const productIds = new Set();
  const comboIds = new Set();
  for (const l of lines) {
    if (l.isCombo === true && l.comboId) {
      if (isId(l.comboId)) comboIds.add(String(l.comboId));
    } else if (isId(l.productId)) {
      productIds.add(String(l.productId));
    }
  }

  const combos = comboIds.size
    ? await Combo.find({ _id: { $in: [...comboIds] } }).select('products').lean()
    : [];
  const comboMap = new Map(combos.map((c) => [String(c._id), c]));
  for (const c of combos) {
    for (const sp of c.products || []) productIds.add(String(sp.product));
  }

  const products = productIds.size
    ? await Product.find({ _id: { $in: [...productIds] } })
        .select('name slug category subCategory tags')
        .lean()
    : [];
  const matchMap = new Map(
    products.map((p) => [String(p._id), keywords.some((k) => productText(p).includes(k))])
  );

  let totalQty = 0;
  let matchedQty = 0;
  for (const l of lines) {
    const qty = Math.max(0, Math.floor(Number(l.qty) || 0));
    if (l.isCombo === true && l.comboId) {
      const combo = comboMap.get(String(l.comboId));
      if (!combo) continue;
      for (const sp of combo.products || []) {
        totalQty += qty;
        if (matchMap.get(String(sp.product))) matchedQty += qty;
      }
    } else {
      const key = String(l.productId);
      if (!matchMap.has(key)) continue; // unknown product — same as being skipped at order time
      totalQty += qty;
      if (matchMap.get(key)) matchedQty += qty;
    }
  }

  return { totalQty, matchedQty };
}

// Async wrapper: only touches the DB when the rule actually needs cart counts.
export async function getCodStatus(rule, lines, stateLabel) {
  const counts =
    rule.codMode === 'conditional'
      ? await countCartQuantities(lines, rule.codCategoryKeywords)
      : null;
  return evaluateCod(rule, counts, stateLabel);
}

// Turns validated Order items (from reserveItemsAndBuildOrder) into "lines".
export function orderItemsToLines(orderItems) {
  return orderItems.map((oi) => ({
    productId: oi.product,
    comboId: oi.comboId,
    isCombo: oi.isCombo === true,
    qty: oi.qty
  }));
}
