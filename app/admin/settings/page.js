'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { INDIAN_STATES, DEFAULT_RULE, normalizeState } from '@/lib/shippingConfig';
import { DEFAULT_DISCOUNT_RULE } from '@/lib/discountConfig';

const COD_MODES = [
  { value: 'disabled', label: 'COD not available' },
  { value: 'enabled', label: 'COD always available' },
  { value: 'conditional', label: 'COD only when the cart matches a rule' }
];

const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm mt-1';

// Shipping + COD fields, shared by the "other states" rule and each state rule.
function RuleFields({ rule, onChange }) {
  const set = (patch) => onChange({ ...rule, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Shipping Fee (₹)</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={rule.shippingFee}
            onChange={(e) => set({ shippingFee: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Free Shipping Above (₹)</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={rule.freeShippingAbove}
            onChange={(e) => set({ freeShippingAbove: Number(e.target.value) })}
          />
          <p className="text-xs text-brand-ink/50 mt-1">Enter 0 for no free shipping.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Cash on Delivery</label>
          <select
            className={`${inputCls} bg-white`}
            value={rule.codMode}
            onChange={(e) => set({ codMode: e.target.value })}
          >
            {COD_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        {rule.codMode !== 'disabled' && (
          <div>
            <label className="text-sm font-medium">COD Charge (₹)</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={rule.codFee}
              onChange={(e) => set({ codFee: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {rule.codMode === 'conditional' && (
        <div className="rounded-lg bg-brand-magenta/5 border border-brand-magenta/15 p-3 space-y-3">
          <div>
            <label className="text-sm font-medium">Products that count (keywords)</label>
            <input
              className={inputCls}
              placeholder="nighty, nighties"
              value={rule.codCategoryKeywords}
              onChange={(e) => set({ codCategoryKeywords: e.target.value })}
            />
            <p className="text-xs text-brand-ink/50 mt-1">
              Comma separated. A product counts if its name or category contains any of these words.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Exact quantity required</label>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={rule.codExactQty}
              onChange={(e) => set({ codExactQty: Number(e.target.value) })}
            />
            <p className="text-xs text-brand-ink/50 mt-1">
              COD is offered only when the cart has exactly this many matching items. Fewer or more turns COD off.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!rule.codCartOnlyMatching}
              onChange={(e) => set({ codCartOnlyMatching: e.target.checked })}
            />
            Cart must contain only these products
          </label>
        </div>
      )}
    </div>
  );
}

// Fields for one automatic discount tier.
function DiscountRuleFields({ rule, onChange }) {
  const set = (patch) => onChange({ ...rule, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Label (shown to customer)</label>
        <input
          className={inputCls}
          placeholder="Buy 3 or more and get 10% off"
          value={rule.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Min Amount (₹)</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={rule.minAmount}
            onChange={(e) => set({ minAmount: Number(e.target.value) })}
          />
          <p className="text-xs text-brand-ink/50 mt-1">0 = no minimum</p>
        </div>
        <div>
          <label className="text-sm font-medium">Min Quantity</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={rule.minQty}
            onChange={(e) => set({ minQty: Number(e.target.value) })}
          />
          <p className="text-xs text-brand-ink/50 mt-1">0 = no minimum</p>
        </div>
        <div>
          <label className="text-sm font-medium">Exact Quantity</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={rule.exactQty}
            onChange={(e) => set({ exactQty: Number(e.target.value) })}
          />
          <p className="text-xs text-brand-ink/50 mt-1">0 = not required</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Discount Percent (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          className={inputCls}
          value={rule.discountPercent}
          onChange={(e) => set({ discountPercent: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setForm(d.settings))
      .catch(() => toast.error('Could not load settings'));
  }, []);

  function updateStateRule(idx, next) {
    setForm((f) => ({
      ...f,
      shippingRules: f.shippingRules.map((r, i) => (i === idx ? next : r))
    }));
  }

  function removeStateRule(idx) {
    setForm((f) => ({ ...f, shippingRules: f.shippingRules.filter((_, i) => i !== idx) }));
  }

  function addStateRule() {
    const used = new Set((form.shippingRules || []).map((r) => normalizeState(r.state)));
    const next = INDIAN_STATES.find((s) => !used.has(normalizeState(s)));
    if (!next) return toast.error('Every state already has a rule');
    setForm((f) => ({
      ...f,
      shippingRules: [...(f.shippingRules || []), { state: next, ...(f.defaultRule || DEFAULT_RULE) }]
    }));
  }

  function validateRule(rule, label) {
    if (rule.codMode === 'conditional') {
      if (!String(rule.codCategoryKeywords || '').trim()) {
        toast.error(`${label}: enter the product keywords for the COD rule`);
        return false;
      }
      if (!(Number(rule.codExactQty) >= 1)) {
        toast.error(`${label}: exact quantity for COD must be at least 1`);
        return false;
      }
    }
    return true;
  }

  function updateDiscountRule(idx, next) {
    setForm((f) => ({
      ...f,
      discountRules: (f.discountRules || []).map((r, i) => (i === idx ? next : r))
    }));
  }

  function removeDiscountRule(idx) {
    setForm((f) => ({ ...f, discountRules: (f.discountRules || []).filter((_, i) => i !== idx) }));
  }

  function addDiscountRule() {
    setForm((f) => ({ ...f, discountRules: [...(f.discountRules || []), { ...DEFAULT_DISCOUNT_RULE }] }));
  }

  function validateDiscountRule(rule, label) {
    if (!(Number(rule.discountPercent) > 0)) {
      toast.error(`${label}: set a discount percent greater than 0`);
      return false;
    }
    if (!(rule.minAmount > 0) && !(rule.minQty > 0) && !(rule.exactQty > 0)) {
      toast.error(`${label}: set at least a min amount, min quantity, or exact quantity`);
      return false;
    }
    return true;
  }

  async function submit(e) {
    e.preventDefault();

    if (!validateRule(form.defaultRule, 'Other states')) return;
    for (const r of form.shippingRules) {
      if (!validateRule(r, r.state)) return;
    }
    for (const [i, r] of (form.discountRules || []).entries()) {
      if (!validateDiscountRule(r, r.label || `Discount rule ${i + 1}`)) return;
    }

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const d = await res.json();
      setForm((f) => ({ ...f, ...d.settings }));
      toast.success('Settings saved');
    } else {
      toast.error('Could not save settings');
    }
  }

  if (!form) return <p className="text-brand-ink/50">Loading...</p>;

  const defaultRule = form.defaultRule || DEFAULT_RULE;
  const shippingRules = form.shippingRules || [];
  const discountRules = form.discountRules || [];
  const usedStates = new Set(shippingRules.map((r) => normalizeState(r.state)));

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Store Settings</h1>
      <form onSubmit={submit} className="space-y-5">
        <div className="card-soft p-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Store Name</label>
            <input className={inputCls} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">WhatsApp Number (with country code)</label>
            <input className={inputCls} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Instagram Handle</label>
            <input className={inputCls} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Address</label>
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-ink">Shipping &amp; Cash on Delivery</h2>
            <p className="text-xs text-brand-ink/60 mt-1">
              Set rules per state. States without their own rule use the &ldquo;Other states&rdquo; rule.
            </p>
          </div>

          {shippingRules.map((rule, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium">State</label>
                  <select
                    className={`${inputCls} bg-white`}
                    value={rule.state}
                    onChange={(e) => updateStateRule(idx, { ...rule, state: e.target.value })}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option
                        key={s}
                        value={s}
                        disabled={usedStates.has(normalizeState(s)) && normalizeState(s) !== normalizeState(rule.state)}
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeStateRule(idx)}
                  className="text-sm text-red-600 underline pb-2"
                >
                  Remove
                </button>
              </div>
              <RuleFields rule={rule} onChange={(next) => updateStateRule(idx, next)} />
            </div>
          ))}

          <button type="button" onClick={addStateRule} className="btn-outline text-sm">
            Add state rule
          </button>

          <div className="border rounded-lg p-4 space-y-3 bg-brand-magenta/5">
            <h3 className="text-sm font-semibold text-brand-ink">Other states</h3>
            <RuleFields
              rule={defaultRule}
              onChange={(next) => setForm({ ...form, defaultRule: next })}
            />
          </div>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-ink">Automatic Discounts</h2>
            <p className="text-xs text-brand-ink/60 mt-1">
              Applies automatically at checkout — no coupon needed. Set a minimum amount, a
              minimum quantity, an exact quantity, or any mix of the three. If a cart matches
              more than one rule, the highest discount wins.
            </p>
          </div>

          {discountRules.map((rule, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeDiscountRule(idx)}
                  className="text-sm text-red-600 underline"
                >
                  Remove
                </button>
              </div>
              <DiscountRuleFields rule={rule} onChange={(next) => updateDiscountRule(idx, next)} />
            </div>
          ))}

          <button type="button" onClick={addDiscountRule} className="btn-outline text-sm">
            Add discount rule
          </button>
        </div>

        <div className="card-soft p-5 space-y-3">
          <div>
            <label className="text-sm font-medium">SEO Title</label>
            <input className={inputCls} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">SEO Description</label>
            <textarea className={inputCls} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
        </div>

        <button className="btn-primary text-sm">Save settings</button>
      </form>
    </div>
  );
}