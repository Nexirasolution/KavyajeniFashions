'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';

const emptyForm = { code: '', type: 'percent', value: '', minOrderValue: '', maxDiscount: '', expiresAt: '', usageLimit: '' };

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch('/api/coupons');
    const data = await res.json();
    setCoupons(data.coupons || []);
  }
  useEffect(() => { load(); }, []);

  function updateField(key, val) {
    setForm({ ...form, [key]: val });
    if (errors[key]) setErrors({ ...errors, [key]: null });
  }

  function validate() {
    const e = {};
    if (!form.code.trim()) e.code = 'Coupon code is required';
    else if (!/^[A-Za-z0-9_-]+$/.test(form.code.trim())) e.code = 'Use letters, numbers, - or _ only';

    if (!form.value || Number(form.value) <= 0) e.value = 'Enter a discount value greater than 0';
    if (form.type === 'percent' && Number(form.value) > 100) e.value = 'Percentage cannot exceed 100';

    if (form.expiresAt && new Date(form.expiresAt) < new Date(new Date().toDateString())) {
      e.expiresAt = 'Expiry date is in the past';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      value: Number(form.value),
      minOrderValue: Number(form.minOrderValue) || 0,
      maxDiscount: form.type === 'percent' ? (Number(form.maxDiscount) || 0) : 0,
      usageLimit: Number(form.usageLimit) || 0,
      expiresAt: form.expiresAt || null
    };
    try {
      const res = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Coupon "${payload.code}" created`);
        setShowForm(false);
        setForm(emptyForm);
        setErrors({});
        load();
      } else {
        toast.error(data.error || 'Could not create coupon');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setErrors({});
  }

  async function toggleActive(c) {
    await fetch(`/api/coupons/${c._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !c.isActive }) });
    load();
  }

  async function remove(id, code) {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
    toast.success('Coupon deleted');
    load();
  }

  const previewText = form.value
    ? form.type === 'percent'
      ? `${form.value}% off${form.maxDiscount ? `, capped at ₹${form.maxDiscount}` : ''}`
      : `₹${form.value} off`
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Coupons</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Coupon
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex justify-between items-center">
            <h2 className="font-semibold text-lg">New Coupon</h2>
            <button type="button" onClick={closeForm} className="text-brand-ink/50 hover:text-brand-ink">
              <X size={18} />
            </button>
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Coupon Code</label>
            <input
              placeholder="e.g. WELCOME10"
              className={`w-full border rounded-lg px-3 py-2 text-sm uppercase ${errors.code ? 'border-red-400' : 'border-gray-300'}`}
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Discount Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => updateField('type', e.target.value)}
            >
              <option value="percent">Percentage off (%)</option>
              <option value="flat">Flat amount off (₹)</option>
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">
              {form.type === 'percent' ? 'Percentage' : 'Amount'}
            </label>
            <input
              type="number"
              min="0"
              placeholder={form.type === 'percent' ? 'e.g. 10' : 'e.g. 100'}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.value ? 'border-red-400' : 'border-gray-300'}`}
              value={form.value}
              onChange={(e) => updateField('value', e.target.value)}
            />
            {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value}</p>}
          </div>

          {/* Min order value */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Minimum Order Value (optional)</label>
            <input
              type="number"
              min="0"
              placeholder="0 = no minimum"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.minOrderValue}
              onChange={(e) => updateField('minOrderValue', e.target.value)}
            />
          </div>

          {/* Max discount — only relevant for percent */}
          {form.type === 'percent' && (
            <div>
              <label className="block text-xs font-medium text-brand-ink/60 mb-1">Max Discount Cap (optional)</label>
              <input
                type="number"
                min="0"
                placeholder="0 = no cap"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.maxDiscount}
                onChange={(e) => updateField('maxDiscount', e.target.value)}
              />
              <p className="text-xs text-brand-ink/40 mt-1">Caps the rupee value of a percentage discount</p>
            </div>
          )}

          {/* Usage limit */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Usage Limit (optional)</label>
            <input
              type="number"
              min="0"
              placeholder="0 = unlimited"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.usageLimit}
              onChange={(e) => updateField('usageLimit', e.target.value)}
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.expiresAt ? 'border-red-400' : 'border-gray-300'}`}
              value={form.expiresAt}
              onChange={(e) => updateField('expiresAt', e.target.value)}
            />
            {errors.expiresAt && <p className="text-xs text-red-500 mt-1">{errors.expiresAt}</p>}
            <p className="text-xs text-brand-ink/40 mt-1">Leave blank if the coupon never expires</p>
          </div>

          {/* Live preview */}
          {previewText && (
            <div className="sm:col-span-2 bg-brand-magenta/5 border border-brand-magenta/20 rounded-lg px-3 py-2 text-sm text-brand-magenta font-medium">
              Preview: {form.code.trim() || 'CODE'} → {previewText}
              {form.minOrderValue > 0 && ` on orders above ₹${form.minOrderValue}`}
            </div>
          )}

          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Creating…' : 'Create Coupon'}
            </button>
            <button type="button" onClick={closeForm} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-brand-ink/70 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
              <th className="p-3">Code</th><th className="p-3">Discount</th><th className="p-3">Used</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c._id} className="border-b border-brand-ink/5">
                <td className="p-3 font-medium">{c.code}</td>
                <td className="p-3">{c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</td>
                <td className="p-3">{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''}</td>
                <td className="p-3">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : 'Never'}</td>
                <td className="p-3"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.isActive} onChange={() => toggleActive(c)} /> Active</label></td>
                <td className="p-3"><button onClick={() => remove(c._id, c.code)} className="text-brand-magenta"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="text-center text-brand-ink/40 py-10">No coupons yet.</p>}
      </div>
    </div>
  );
}