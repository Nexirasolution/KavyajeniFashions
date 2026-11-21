'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  INDIAN_STATES,
  DEFAULT_RULE,
  DEFAULT_COURIERS,
  normalizeState,
  migrateRule
} from '@/lib/shippingConfig';
import { DEFAULT_DISCOUNT_RULE } from '@/lib/discountConfig';

/* ────────────────────────────────────────────────────────────
   Constants & helpers
──────────────────────────────────────────────────────────── */

const COD_MODES = [
  { value: 'disabled', label: 'Not available', hint: 'Online payment only' },
  { value: 'enabled', label: 'Always available', hint: 'Every cart can use COD' },
  { value: 'conditional', label: 'Only some carts', hint: 'Based on a rule you set' }
];

const TABS = [
  { id: 'store', label: 'Store details' },
  { id: 'shipping', label: 'Shipping & COD' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'seo', label: 'Search & sharing' }
];

const baseInput =
  'rounded-lg border bg-white px-3 py-2 text-sm transition-colors placeholder:text-brand-ink/30 focus:outline-none focus:ring-2';
const okInput = 'border-brand-ink/20 focus:border-brand-magenta focus:ring-brand-magenta/20';
const badInput = 'border-red-400 focus:border-red-500 focus:ring-red-200';
const inputCls = (invalid) => `${baseInput} ${invalid ? badInput : okInput}`;

const money = (n) => `₹${Number(n) || 0}`;
const byQty = (a, b) => Number(a.qty) - Number(b.qty);

const hydrate = (s = {}) => ({
  ...s,
  storeName: s.storeName ?? '',
  whatsapp: s.whatsapp ?? '',
  instagram: s.instagram ?? '',
  address: s.address ?? '',
  seoTitle: s.seoTitle ?? '',
  seoDescription: s.seoDescription ?? '',
  onlineCourier: s.onlineCourier || DEFAULT_COURIERS.online,
  codCourier: s.codCourier || DEFAULT_COURIERS.cod,
  defaultRule: migrateRule(s.defaultRule || DEFAULT_RULE),
  shippingRules: (s.shippingRules || []).map((r) => migrateRule(r)),
  discountRules: s.discountRules || []
});

const sortRule = (r) => ({
  ...r,
  onlineShippingTiers: [...(r.onlineShippingTiers || [])].sort(byQty),
  codShippingTiers: [...(r.codShippingTiers || [])].sort(byQty)
});

function feeRange(base, tiers) {
  const fees = (tiers || []).length ? tiers.map((t) => Number(t.fee) || 0) : [Number(base) || 0];
  const lo = Math.min(...fees);
  const hi = Math.max(...fees);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

function ruleChips(rule) {
  const chips = [`Online ${feeRange(rule.shippingFee, rule.onlineShippingTiers)}`];
  if (Number(rule.freeShippingAbove) > 0) chips.push(`Free above ${money(rule.freeShippingAbove)}`);
  if (rule.codMode === 'disabled') chips.push('No COD');
  else if (rule.codMode === 'enabled') chips.push(`COD ${feeRange(rule.codShippingFee, rule.codShippingTiers)}`);
  else chips.push('COD on some carts');
  return chips;
}

function discountChips(rule) {
  const chips = [`${Number(rule.discountPercent) || 0}% off`];
  if (Number(rule.minAmount) > 0) chips.push(`Cart ${money(rule.minAmount)}+`);
  if (Number(rule.minQty) > 0) chips.push(`${rule.minQty}+ items`);
  if (Number(rule.exactQty) > 0) chips.push(`Exactly ${rule.exactQty} item${Number(rule.exactQty) === 1 ? '' : 's'}`);
  if (chips.length === 1) chips.push('No condition set');
  return chips;
}

function codSentence(rule) {
  const min = Number(rule.codMinQty) || 1;
  const max = Number(rule.codMaxQty) || 0;
  const hasKeywords = String(rule.productKeywords || '').trim().length > 0;
  const single = max > 0 && min === max && min === 1;
  const range = max === 0 ? `${min} or more` : min === max ? `exactly ${min}` : `${min} to ${max}`;
  const what = hasKeywords ? (single ? 'matching product' : 'matching products') : single ? 'item' : 'items';
  return `COD is offered when the cart has ${range} ${what}${rule.codCartOnlyMatching ? ' and nothing else' : ''}.`;
}

/* ── Validation (returns a list of plain-language problems) ── */

function tierErrors(tiers, name) {
  const out = [];
  const seen = new Set();
  for (const t of tiers || []) {
    const qty = Number(t.qty);
    if (!(qty >= 1)) {
      out.push(`${name}: item count must be at least 1.`);
      continue;
    }
    if (seen.has(qty)) out.push(`${name}: ${qty} item${qty === 1 ? ' is' : 's is'} listed twice.`);
    seen.add(qty);
  }
  return [...new Set(out)];
}

function ruleErrors(rule) {
  const out = [...tierErrors(rule.onlineShippingTiers, 'Online shipping')];
  if (rule.codMode !== 'disabled') out.push(...tierErrors(rule.codShippingTiers, 'COD shipping'));
  if (rule.codMode === 'conditional') {
    if (!String(rule.productKeywords || '').trim()) out.push('Add at least one product keyword for the COD rule.');
    if (!(Number(rule.codMinQty) >= 1)) out.push('Minimum items for COD must be at least 1.');
    if (Number(rule.codMaxQty) > 0 && Number(rule.codMaxQty) < Number(rule.codMinQty)) {
      out.push("Maximum items for COD can't be less than the minimum.");
    }
  }
  return out;
}

function discountErrors(rule) {
  const out = [];
  const pct = Number(rule.discountPercent);
  if (!(pct > 0)) out.push('Set a discount greater than 0%.');
  if (pct > 100) out.push("A discount can't be more than 100%.");
  if (!(Number(rule.minAmount) > 0) && !(Number(rule.minQty) > 0) && !(Number(rule.exactQty) > 0)) {
    out.push('Set at least one condition: minimum amount, minimum quantity or exact quantity.');
  }
  return out;
}

function shiftDiscountKeys(keys, at, delta) {
  const next = new Set();
  keys.forEach((k) => {
    if (!k.startsWith('discount:')) return next.add(k);
    const i = Number(k.split(':')[1]);
    if (delta < 0) {
      if (i === at) return;
      next.add(`discount:${i > at ? i + delta : i}`);
    } else {
      next.add(`discount:${i >= at ? i + delta : i}`);
    }
  });
  return next;
}

function undoToast(message, restore) {
  toast(
    (t) => (
      <span className="flex items-center gap-3 text-sm">
        {message}
        <button
          type="button"
          className="font-semibold text-brand-magenta underline"
          onClick={() => {
            restore();
            toast.dismiss(t.id);
          }}
        >
          Undo
        </button>
      </span>
    ),
    { duration: 6000 }
  );
}

/* ────────────────────────────────────────────────────────────
   Small building blocks
──────────────────────────────────────────────────────────── */

function Field({ label, hint, error, className = '', children }) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-ink">{label}</span>
        {children}
      </label>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-brand-ink/55">{hint}</p>
      ) : null}
    </div>
  );
}

function TextInput({ invalid, className = '', ...props }) {
  return <input className={`w-full ${inputCls(invalid)} ${className}`} {...props} />;
}

// Number box that lets you clear it and type freely, selects on focus,
// ignores the scroll wheel, and tidies itself up on blur.
function NumInput({ value, onChange, prefix, suffix, invalid, max, ...rest }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? 0));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    if (!/^\d*\.?\d*$/.test(raw)) return;
    let n = raw === '' || raw === '.' ? 0 : Number(raw);
    if (max != null && n > max) {
      n = max;
      setDraft(String(max));
    } else {
      setDraft(raw);
    }
    onChange(n);
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink/45">
          {prefix}
        </span>
      )}
      <input
        inputMode="decimal"
        autoComplete="off"
        className={`w-full ${inputCls(invalid)} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
        value={draft}
        onChange={handleChange}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(String(value ?? 0));
        }}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink/45">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-brand-ink/50 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

function ErrorList({ errors }) {
  if (!errors?.length) return null;
  return (
    <ul
      role="alert"
      className="mb-4 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

// Collapsible card: title + a one-line summary when closed.
function RuleCard({ title, chips, open, onToggle, onRemove, hasError, children }) {
  return (
    <div className={`rounded-xl border bg-white ${hasError ? 'border-red-300' : 'border-brand-ink/15'}`}>
      <div className="flex items-center gap-1 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/30"
        >
          <Chevron open={open} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-brand-ink">{title}</span>
            {!open && chips && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-md bg-brand-ink/5 px-1.5 py-0.5 text-xs text-brand-ink/70">
                    {c}
                  </span>
                ))}
              </span>
            )}
          </span>
          {hasError && <span className="text-xs font-medium text-red-600">Needs attention</span>}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs text-brand-ink/55 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            Remove
          </button>
        )}
      </div>
      {open && <div className="border-t border-brand-ink/10 p-4">{children}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Shipping rule editor
──────────────────────────────────────────────────────────── */

function TierEditor({ tiers = [], onChange, feeLabel = 'Shipping charge' }) {
  const counts = {};
  tiers.forEach((t) => {
    counts[t.qty] = (counts[t.qty] || 0) + 1;
  });

  const setRow = (idx, patch) => onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const removeRow = (idx) => onChange(tiers.filter((_, i) => i !== idx));
  const addRow = () => {
    const maxQty = tiers.reduce((m, t) => Math.max(m, Number(t.qty) || 0), 0);
    const last = tiers[tiers.length - 1];
    onChange([...tiers, { qty: maxQty + 1, fee: Number(last?.fee) || 0 }]);
  };

  return (
    <div>
      {tiers.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 text-xs text-brand-ink/60">
            <span>Items in cart</span>
            <span>{feeLabel}</span>
            <span />
          </div>
          {tiers.map((t, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
              <NumInput
                aria-label="Items in cart"
                value={t.qty}
                invalid={!(Number(t.qty) >= 1) || counts[t.qty] > 1}
                onChange={(n) => setRow(idx, { qty: n })}
              />
              <NumInput
                aria-label={feeLabel}
                prefix="₹"
                value={t.fee}
                onChange={(n) => setRow(idx, { fee: n })}
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                aria-label={`Remove the row for ${t.qty} items`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-brand-ink/45 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-brand-ink/5 px-3 py-2 text-xs text-brand-ink/60">
          No quantity rows yet. The default charge applies to every order.
        </p>
      )}
      <button type="button" onClick={addRow} className="btn-outline mt-3 text-sm">
        Add row
      </button>
    </div>
  );
}

function SectionTitle({ title, children }) {
  return (
    <div className="mb-3">
      <h4 className="text-sm font-semibold text-brand-ink">{title}</h4>
      {children && <p className="mt-0.5 text-xs text-brand-ink/60">{children}</p>}
    </div>
  );
}

function RuleFields({ rule, onChange, errors }) {
  const uid = useId();
  const set = (patch) => onChange({ ...rule, ...patch });
  const minBad = rule.codMode === 'conditional' && !(Number(rule.codMinQty) >= 1);
  const maxBad =
    rule.codMode === 'conditional' &&
    Number(rule.codMaxQty) > 0 &&
    Number(rule.codMaxQty) < Number(rule.codMinQty);

  return (
    <div>
      <ErrorList errors={errors} />

      <div className="divide-y divide-brand-ink/10">
        <section className="pb-5">
          <Field
            label="Products that count"
            hint="Separate with commas. A product counts if its name or category contains one of these words. Leave empty to count every item in the cart."
          >
            <TextInput
              placeholder="nighty, nighties"
              value={rule.productKeywords}
              invalid={rule.codMode === 'conditional' && !String(rule.productKeywords || '').trim()}
              onChange={(e) => set({ productKeywords: e.target.value })}
            />
          </Field>
        </section>

        <section className="py-5">
          <SectionTitle title="Online payment">Shipping charged when the customer pays online.</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default shipping" hint="Used when no quantity row applies.">
              <NumInput prefix="₹" value={rule.shippingFee} onChange={(n) => set({ shippingFee: n })} />
            </Field>
            <Field label="Free shipping above" hint="0 turns free shipping off.">
              <NumInput prefix="₹" value={rule.freeShippingAbove} onChange={(n) => set({ freeShippingAbove: n })} />
            </Field>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-brand-ink">Charge by number of items</p>
            <TierEditor tiers={rule.onlineShippingTiers} onChange={(next) => set({ onlineShippingTiers: next })} />
            <p className="mt-2 text-xs text-brand-ink/55">
              Example: 1 item ₹60, 2 items ₹80. Carts with more items than the last row pay the last row&apos;s
              charge. Carts with fewer than the first row pay the default.
            </p>
          </div>
        </section>

        <section className="pt-5">
          <SectionTitle title="Cash on delivery">
            Nothing is paid online. Items and shipping are collected in cash on delivery.
          </SectionTitle>

          <div role="radiogroup" aria-label="Cash on delivery availability" className="grid gap-2 sm:grid-cols-3">
            {COD_MODES.map((m) => (
              <label key={m.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`cod-${uid}`}
                  value={m.value}
                  checked={rule.codMode === m.value}
                  onChange={() => set({ codMode: m.value })}
                  className="peer sr-only"
                />
                <span className="block h-full rounded-lg border border-brand-ink/20 px-3 py-2 text-sm transition-colors hover:border-brand-ink/40 peer-checked:border-brand-magenta peer-checked:bg-brand-magenta/5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-magenta/30">
                  <span className="block font-medium text-brand-ink">{m.label}</span>
                  <span className="block text-xs text-brand-ink/55">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {rule.codMode === 'conditional' && (
            <div className="mt-4 space-y-3 rounded-lg bg-brand-magenta/5 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minimum items" error={minBad ? 'Must be at least 1' : ''}>
                  <NumInput invalid={minBad} value={rule.codMinQty} onChange={(n) => set({ codMinQty: n })} />
                </Field>
                <Field
                  label="Maximum items"
                  hint="0 = no maximum"
                  error={maxBad ? "Can't be below the minimum" : ''}
                >
                  <NumInput invalid={maxBad} value={rule.codMaxQty} onChange={(n) => set({ codMaxQty: n })} />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm text-brand-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-brand-ink/30"
                  checked={!!rule.codCartOnlyMatching}
                  onChange={(e) => set({ codCartOnlyMatching: e.target.checked })}
                />
                <span>Cart must contain only these products</span>
              </label>
              <p className="text-xs text-brand-ink/70">{codSentence(rule)}</p>
            </div>
          )}

          {rule.codMode !== 'disabled' && (
            <div className="mt-4 space-y-4">
              <Field label="Default COD shipping" hint="Used when no quantity row applies." className="sm:w-1/2">
                <NumInput prefix="₹" value={rule.codShippingFee} onChange={(n) => set({ codShippingFee: n })} />
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-brand-ink">COD charge by number of items</p>
                <TierEditor
                  tiers={rule.codShippingTiers}
                  onChange={(next) => set({ codShippingTiers: next })}
                  feeLabel="COD shipping charge"
                />
                <p className="mt-2 text-xs text-brand-ink/55">Works like online shipping, with its own charges.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Discount rule editor
──────────────────────────────────────────────────────────── */

function DiscountRuleFields({ rule, onChange, errors }) {
  const set = (patch) => onChange({ ...rule, ...patch });
  return (
    <div className="space-y-4">
      <ErrorList errors={errors} />

      <Field label="Message shown to customers">
        <TextInput
          placeholder="Buy 3 or more and get 10% off"
          value={rule.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium text-brand-ink">Apply when the cart has</p>
        <p className="mb-2 text-xs text-brand-ink/55">Leave a box at 0 to ignore it.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Min amount">
            <NumInput prefix="₹" value={rule.minAmount} onChange={(n) => set({ minAmount: n })} />
          </Field>
          <Field label="Min quantity">
            <NumInput value={rule.minQty} onChange={(n) => set({ minQty: n })} />
          </Field>
          <Field label="Exact quantity">
            <NumInput value={rule.exactQty} onChange={(n) => set({ exactQty: n })} />
          </Field>
        </div>
      </div>

      <Field label="Discount" className="sm:w-1/3">
        <NumInput
          suffix="%"
          max={100}
          invalid={!(Number(rule.discountPercent) > 0)}
          value={rule.discountPercent}
          onChange={(n) => set({ discountPercent: n })}
        />
      </Field>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */

export default function AdminSettingsPage() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('store');
  const [attempted, setAttempted] = useState(false);
  const [openKeys, setOpenKeys] = useState(() => new Set(['default']));
  const formRef = useRef(null);
  const submitRef = useRef(null);

  const load = useCallback(() => {
    setLoadError(false);
    fetch('/api/admin/settings')
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then((d) => {
        const next = hydrate(d.settings);
        setForm(next);
        setSaved(JSON.stringify(next));
      })
      .catch(() => {
        setLoadError(true);
        toast.error("Couldn't load settings");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => (form ? JSON.stringify(form) !== saved : false), [form, saved]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Ctrl/Cmd + S saves.
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const errors = useMemo(() => {
    if (!form) return null;
    return {
      default: ruleErrors(form.defaultRule),
      states: form.shippingRules.map(ruleErrors),
      discounts: form.discountRules.map(discountErrors)
    };
  }, [form]);

  const shippingErrorCount = errors
    ? errors.default.length + errors.states.reduce((n, e) => n + e.length, 0)
    : 0;
  const discountErrorCount = errors ? errors.discounts.reduce((n, e) => n + e.length, 0) : 0;
  const tabErrors = { shipping: shippingErrorCount, discounts: discountErrorCount };

  const isOpen = (key) => openKeys.has(key);
  const toggleOpen = (key) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ── State rules ── */

  function updateStateRule(idx, next) {
    const prevState = form.shippingRules[idx].state;
    setForm((f) => ({
      ...f,
      shippingRules: f.shippingRules.map((r, i) => (i === idx ? next : r))
    }));
    if (next.state !== prevState) {
      setOpenKeys((prev) => {
        const n = new Set(prev);
        if (n.delete(`state:${prevState}`)) n.add(`state:${next.state}`);
        return n;
      });
    }
  }

  function addStateRule(stateName) {
    if (!stateName) return;
    setForm((f) => ({
      ...f,
      shippingRules: [...f.shippingRules, { ...JSON.parse(JSON.stringify(f.defaultRule)), state: stateName }]
    }));
    setOpenKeys((prev) => new Set(prev).add(`state:${stateName}`));
  }

  function removeStateRule(idx) {
    const removed = form.shippingRules[idx];
    setForm((f) => ({ ...f, shippingRules: f.shippingRules.filter((_, i) => i !== idx) }));
    undoToast(`${removed.state} rule removed.`, () =>
      setForm((f) => {
        if (f.shippingRules.some((r) => normalizeState(r.state) === normalizeState(removed.state))) return f;
        const arr = [...f.shippingRules];
        arr.splice(Math.min(idx, arr.length), 0, removed);
        return { ...f, shippingRules: arr };
      })
    );
  }

  /* ── Discount rules ── */

  function updateDiscountRule(idx, next) {
    setForm((f) => ({ ...f, discountRules: f.discountRules.map((r, i) => (i === idx ? next : r)) }));
  }

  function addDiscountRule() {
    const idx = form.discountRules.length;
    setForm((f) => ({ ...f, discountRules: [...f.discountRules, { ...DEFAULT_DISCOUNT_RULE }] }));
    setOpenKeys((prev) => new Set(prev).add(`discount:${idx}`));
  }

  function removeDiscountRule(idx) {
    const removed = form.discountRules[idx];
    setForm((f) => ({ ...f, discountRules: f.discountRules.filter((_, i) => i !== idx) }));
    setOpenKeys((prev) => shiftDiscountKeys(prev, idx, -1));
    undoToast('Discount removed.', () => {
      setForm((f) => {
        const arr = [...f.discountRules];
        arr.splice(Math.min(idx, arr.length), 0, removed);
        return { ...f, discountRules: arr };
      });
      setOpenKeys((prev) => shiftDiscountKeys(prev, idx, 1));
    });
  }

  /* ── Save / discard ── */

  async function submit(e) {
    e?.preventDefault();
    if (saving || !form) return;

    const total = shippingErrorCount + discountErrorCount;
    if (total > 0) {
      setAttempted(true);
      setOpenKeys((prev) => {
        const next = new Set(prev);
        if (errors.default.length) next.add('default');
        form.shippingRules.forEach((r, i) => errors.states[i].length && next.add(`state:${r.state}`));
        form.discountRules.forEach((_, i) => errors.discounts[i].length && next.add(`discount:${i}`));
        return next;
      });
      setTab(shippingErrorCount ? 'shipping' : 'discounts');
      toast.error(`Fix ${total} issue${total === 1 ? '' : 's'} before saving`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        defaultRule: sortRule(form.defaultRule),
        shippingRules: form.shippingRules.map(sortRule)
      };
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('save failed');
      const d = await res.json();
      const next = hydrate(d.settings);
      setForm(next);
      setSaved(JSON.stringify(next));
      setAttempted(false);
      toast.success('Settings saved');
    } catch {
      toast.error("Couldn't save settings. Your changes are still here, so try again.");
    } finally {
      setSaving(false);
    }
  }
  submitRef.current = submit;

  function discard() {
    if (!window.confirm('Discard all unsaved changes?')) return;
    setForm(JSON.parse(saved));
    setAttempted(false);
    toast.success('Changes discarded');
  }

  /* ── Loading / error states ── */

  if (loadError && !form) {
    return (
      <div className="card-soft max-w-3xl p-6">
        <p className="font-medium text-brand-ink">We couldn&apos;t load your settings.</p>
        <p className="mt-1 text-sm text-brand-ink/60">Check your connection and try again.</p>
        <button type="button" onClick={load} className="btn-outline mt-4 text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-3xl animate-pulse space-y-4" aria-busy="true" aria-label="Loading settings">
        <div className="h-8 w-48 rounded-lg bg-brand-ink/10" />
        <div className="h-10 w-full rounded-lg bg-brand-ink/5" />
        <div className="h-64 w-full rounded-xl bg-brand-ink/5" />
      </div>
    );
  }

  const usedStates = new Set(form.shippingRules.map((r) => normalizeState(r.state)));
  const freeStates = INDIAN_STATES.filter((s) => !usedStates.has(normalizeState(s)));
  const seoTitleLen = form.seoTitle.length;
  const seoDescLen = form.seoDescription.length;
  const showErrors = (list) => (attempted ? list : []);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta">Store settings</h1>
      <p className="mb-5 mt-1 text-sm text-brand-ink/60">Changes go live on your storefront after you save.</p>

      {/* Tabs */}
      <div role="tablist" aria-label="Settings sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-brand-ink/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/30 ${
              tab === t.id
                ? 'border-brand-magenta font-semibold text-brand-magenta'
                : 'border-transparent text-brand-ink/60 hover:text-brand-ink'
            }`}
          >
            {t.label}
            {attempted && tabErrors[t.id] > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {tabErrors[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <form ref={formRef} onSubmit={submit} noValidate>
        {/* ── Store details ── */}
        {tab === 'store' && (
          <section role="tabpanel" className="card-soft p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name">
                <TextInput value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
              </Field>
              <Field label="WhatsApp number" hint="Include the country code, e.g. 91 for India.">
                <TextInput
                  inputMode="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </Field>
              <Field label="Instagram handle">
                <TextInput value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <textarea
                  rows={2}
                  className={`w-full ${inputCls(false)}`}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
          </section>
        )}

        {/* ── Shipping & COD ── */}
        {tab === 'shipping' && (
          <div role="tabpanel" className="space-y-5">
            <section className="card-soft p-5">
              <h2 className="font-semibold text-brand-ink">Delivery partners</h2>
              <p className="mb-3 mt-0.5 text-xs text-brand-ink/60">
                Shown to customers at checkout, under the payment method they pick.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="For online payment">
                  <TextInput
                    placeholder={DEFAULT_COURIERS.online}
                    value={form.onlineCourier}
                    onChange={(e) => setForm({ ...form, onlineCourier: e.target.value })}
                  />
                </Field>
                <Field label="For cash on delivery">
                  <TextInput
                    placeholder={DEFAULT_COURIERS.cod}
                    value={form.codCourier}
                    onChange={(e) => setForm({ ...form, codCourier: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="card-soft space-y-4 p-5">
              <div>
                <h2 className="font-semibold text-brand-ink">Shipping &amp; cash on delivery</h2>
                <p className="mt-0.5 text-xs text-brand-ink/60">
                  Charges depend on how many matching products (for example, nighties) are in the cart.
                </p>
              </div>

              <RuleCard
                title="All other states"
                chips={ruleChips(form.defaultRule)}
                open={isOpen('default')}
                onToggle={() => toggleOpen('default')}
                hasError={attempted && errors.default.length > 0}
              >
                <RuleFields
                  rule={form.defaultRule}
                  errors={showErrors(errors.default)}
                  onChange={(next) => setForm({ ...form, defaultRule: next })}
                />
              </RuleCard>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">State exceptions</h3>
                  <p className="text-xs text-brand-ink/60">States without an exception use the rule above.</p>
                </div>
                <select
                  value=""
                  onChange={(e) => addStateRule(e.target.value)}
                  disabled={freeStates.length === 0}
                  aria-label="Add a state exception"
                  className={`${inputCls(false)} bg-white`}
                >
                  <option value="">{freeStates.length ? 'Add a state…' : 'All states added'}</option>
                  {freeStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {form.shippingRules.length === 0 && (
                <p className="rounded-lg border border-dashed border-brand-ink/20 px-4 py-6 text-center text-sm text-brand-ink/55">
                  No exceptions yet. Pick a state above to give it its own charges or COD rule.
                </p>
              )}

              {form.shippingRules.map((rule, idx) => {
                const key = `state:${rule.state}`;
                return (
                  <RuleCard
                    key={rule.state}
                    title={rule.state}
                    chips={ruleChips(rule)}
                    open={isOpen(key)}
                    onToggle={() => toggleOpen(key)}
                    onRemove={() => removeStateRule(idx)}
                    hasError={attempted && errors.states[idx].length > 0}
                  >
                    <Field label="State" className="mb-4 sm:w-1/2">
                      <select
                        className={`w-full ${inputCls(false)} bg-white`}
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
                    </Field>
                    <RuleFields
                      rule={rule}
                      errors={showErrors(errors.states[idx])}
                      onChange={(next) => updateStateRule(idx, next)}
                    />
                  </RuleCard>
                );
              })}
            </section>
          </div>
        )}

        {/* ── Discounts ── */}
        {tab === 'discounts' && (
          <section role="tabpanel" className="card-soft space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-md">
                <h2 className="font-semibold text-brand-ink">Automatic discounts</h2>
                <p className="mt-0.5 text-xs text-brand-ink/60">
                  Applied at checkout with no coupon needed. If a cart matches more than one, the biggest discount wins.
                </p>
              </div>
              {form.discountRules.length > 0 && (
                <button type="button" onClick={addDiscountRule} className="btn-outline text-sm">
                  Add discount
                </button>
              )}
            </div>

            {form.discountRules.length === 0 && (
              <div className="rounded-lg border border-dashed border-brand-ink/20 px-4 py-8 text-center">
                <p className="text-sm text-brand-ink/60">No discounts yet. Reward bigger carts with a percentage off.</p>
                <button type="button" onClick={addDiscountRule} className="btn-outline mt-3 text-sm">
                  Add discount
                </button>
              </div>
            )}

            {form.discountRules.map((rule, idx) => {
              const key = `discount:${idx}`;
              return (
                <RuleCard
                  key={idx}
                  title={rule.label || `Discount ${idx + 1}`}
                  chips={discountChips(rule)}
                  open={isOpen(key)}
                  onToggle={() => toggleOpen(key)}
                  onRemove={() => removeDiscountRule(idx)}
                  hasError={attempted && errors.discounts[idx].length > 0}
                >
                  <DiscountRuleFields
                    rule={rule}
                    errors={showErrors(errors.discounts[idx])}
                    onChange={(next) => updateDiscountRule(idx, next)}
                  />
                </RuleCard>
              );
            })}
          </section>
        )}

        {/* ── SEO ── */}
        {tab === 'seo' && (
          <section role="tabpanel" className="card-soft space-y-4 p-5">
            <Field
              label="Page title"
              hint={`${seoTitleLen}/60 characters. Longer titles may be cut off in search results.`}
            >
              <TextInput
                invalid={seoTitleLen > 60}
                value={form.seoTitle}
                onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
              />
            </Field>
            <Field
              label="Page description"
              hint={`${seoDescLen}/160 characters. Longer descriptions may be cut off.`}
            >
              <textarea
                rows={3}
                className={`w-full ${inputCls(seoDescLen > 160)}`}
                value={form.seoDescription}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
              />
            </Field>

            <div className="rounded-lg bg-brand-ink/5 p-4">
              <p className="mb-2 text-xs text-brand-ink/55">Preview in search results</p>
              <p className="truncate text-base text-blue-700">{form.seoTitle || form.storeName || 'Your page title'}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-brand-ink/70">
                {form.seoDescription || 'Your page description will appear here.'}
              </p>
            </div>
          </section>
        )}

        {/* Save bar */}
        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-xl border border-brand-ink/15 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <p role="status" className="text-sm">
            {dirty ? (
              <span className="flex items-center gap-2 font-medium text-brand-ink">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-brand-ink/55">All changes saved</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {dirty && (
              <button type="button" onClick={discard} disabled={saving} className="btn-outline text-sm">
                Discard
              </button>
            )}
            <button type="submit" disabled={!dirty || saving} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}