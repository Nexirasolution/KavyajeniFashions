import mongoose from 'mongoose';

// Fields shared by the "other states" default rule and every state-specific rule.
// Function so each schema gets its own fresh definition object.
const ruleFields = () => ({
  shippingFee: { type: Number, default: 49, min: 0 },
  freeShippingAbove: { type: Number, default: 0, min: 0 }, // 0 = never free
  codMode: { type: String, enum: ['disabled', 'enabled', 'conditional'], default: 'disabled' },
  codFee: { type: Number, default: 0, min: 0 },
  // codMode === 'conditional': cart must have EXACTLY codExactQty items whose
  // name/category matches one of these comma-separated keywords.
  codCategoryKeywords: { type: String, default: '' },
  codExactQty: { type: Number, default: 0, min: 0 },
  codCartOnlyMatching: { type: Boolean, default: false }
});

const DefaultRuleSchema = new mongoose.Schema(ruleFields(), { _id: false });

const StateRuleSchema = new mongoose.Schema(
  { state: { type: String, required: true, trim: true }, ...ruleFields() },
  { _id: false }
);

// Automatic, tiered cart discounts (e.g. "spend ₹2000+, get 10% off" or
// "buy exactly 3, get 15% off"). Evaluated against the whole cart at
// checkout — no coupon code needed. See lib/discountConfig.js.
const DiscountRuleSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    minAmount: { type: Number, default: 0, min: 0 },   // 0 = no requirement
    minQty: { type: Number, default: 0, min: 0 },       // 0 = no requirement
    exactQty: { type: Number, default: 0, min: 0 },     // 0 = no requirement
    discountPercent: { type: Number, default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    storeName: { type: String, default: 'Lakshmibala Clothing Store' },
    logo: { type: String, default: '' },
    whatsapp: { type: String, default: '918524858771' },
    instagram: { type: String, default: 'Lakshmibala_Clothing Store' },
    address: { type: String, default: 'Sivakasi, Virudhunagar Dt, Tamil Nadu' },

    // LEGACY — no longer read at checkout. Only used once, to migrate an
    // existing settings document into `defaultRule` (see getShippingSettings).
    shippingFee: { type: Number, default: 49 },
    freeShippingAbove: { type: Number, default: 999 },

    // Applies to every state that has no entry in `shippingRules`.
    // No schema default on purpose: "missing" is how we detect old documents.
    defaultRule: { type: DefaultRuleSchema, default: undefined },
    // State-specific overrides, e.g. Tamil Nadu.
    shippingRules: { type: [StateRuleSchema], default: [] },

    // Automatic cart-wide discount tiers. See lib/discountConfig.js.
    discountRules: { type: [DiscountRuleSchema], default: [] },

    seoTitle: { type: String, default: 'Lakshmibala Clothing Store - Women Kurtis, Innerwear & More' },
    seoDescription: { type: String, default: 'Shop trendy women kurtis, nighties, 2 piece sets and innerwear online from Lakshmibala Clothing Store, Sivakasi.' }
  },
  { timestamps: true }
);

// In development, drop the cached model so schema edits (like the new
// defaultRule / shippingRules / discountRules fields) take effect after a
// hot reload. Without this, Mongoose keeps serving the OLD schema and
// silently drops the new fields.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Settings) {
  delete mongoose.models.Settings;
}

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);