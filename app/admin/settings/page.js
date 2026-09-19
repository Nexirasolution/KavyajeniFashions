'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [form, setForm] = useState(null);

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((d) => setForm(d.settings));
  }, []);

  async function submit(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) toast.success('Settings saved');
  }

  if (!form) return <p className="text-brand-ink/50">Loading...</p>;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Store Settings</h1>
      <form onSubmit={submit} className="card-soft p-5 space-y-3">
        <div>
          <label className="text-sm font-medium">Store Name</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">WhatsApp Number (with country code)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Instagram Handle</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Address</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Shipping Fee (₹)</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.shippingFee} onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Free Shipping Above (₹)</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.freeShippingAbove} onChange={(e) => setForm({ ...form, freeShippingAbove: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">SEO Title</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">SEO Description</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
        </div>
        <button className="btn-primary text-sm">Save Settings</button>
      </form>
    </div>
  );
}
