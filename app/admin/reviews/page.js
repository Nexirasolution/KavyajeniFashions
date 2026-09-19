'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Star, Trash2, Plus, Loader2, ImagePlus } from 'lucide-react';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ product: '', customerName: '', rating: 5, comment: '', images: [], isFeatured: false });

  async function load() {
    const res = await fetch('/api/reviews?all=true');
    const data = await res.json();
    setReviews(data.reviews || []);
  }
  async function loadProducts() {
    // admin-only route: returns every product (active + hidden), no pagination cap
    const res = await fetch('/api/admin/products?limit=1000');
    const data = await res.json();
    setProducts(data.products || []);
  }
  useEffect(() => { load(); loadProducts(); }, []);

  async function update(id, body) {
    await fetch(`/api/reviews/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this review?')) return;
    await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    load();
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        const url = data.url || data.secure_url;
        if (url) urls.push(url);
        else toast.error(`Could not upload ${file.name}`);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function closeForm() {
    setShowForm(false);
    setForm({ product: '', customerName: '', rating: 5, comment: '', images: [], isFeatured: false });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.product || !form.customerName.trim()) {
      toast.error('Select a product and enter a customer name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Review added');
        closeForm();
        load();
      } else {
        toast.error(data.error || 'Could not add review');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Reviews</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Review
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex justify-between items-center">
            <h2 className="font-semibold text-lg">New Review</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Product</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Customer Name</label>
            <input
              placeholder="e.g. Priya S."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Rating</label>
            <div className="flex gap-1 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <button type="button" key={i} onClick={() => setForm({ ...form, rating: i + 1 })}>
                  <Star size={22} className={i < form.rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-ink/20'} />
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Comment</label>
            <textarea
              rows={3}
              placeholder="What did the customer say?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-brand-ink/60 mb-1">Photos (optional)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.images.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-brand-ink/40">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            Feature on homepage
          </label>

          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Saving…' : 'Add Review'}
            </button>
            <button type="button" onClick={closeForm} className="text-sm px-4 py-2 rounded-lg border border-gray-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r._id} className="card-soft p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < r.rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-ink/20'} />)}
              </div>
              <p className="text-sm">{r.comment}</p>
              {r.images?.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {r.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-10 h-10 rounded-md object-cover" />
                  ))}
                </div>
              )}
              <p className="text-xs text-brand-ink/50 mt-1">{r.customerName} · {r.product?.name}</p>
              <div className="flex gap-2 mt-2 text-xs flex-wrap">
                <span className={`px-2 py-0.5 rounded-full ${r.isApproved ? 'bg-brand-green/15 text-brand-deepgreen' : 'bg-brand-gold/15 text-brand-gold'}`}>
                  {r.isApproved ? 'Approved' : 'Pending'}
                </span>
                {r.isFeatured && <span className="px-2 py-0.5 rounded-full bg-brand-pink/15 text-brand-magenta">Featured</span>}
                {r.isVerifiedPurchase && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Verified Purchase</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {!r.isApproved ? (
                <button onClick={() => update(r._id, { isApproved: true })} className="p-1.5 text-brand-deepgreen"><Check size={16} /></button>
              ) : (
                <button onClick={() => update(r._id, { isApproved: false })} className="p-1.5 text-brand-ink/40"><X size={16} /></button>
              )}
              <button onClick={() => update(r._id, { isFeatured: !r.isFeatured })} className="p-1.5 text-brand-magenta"><Star size={16} className={r.isFeatured ? 'fill-brand-magenta' : ''} /></button>
              <button onClick={() => remove(r._id)} className="p-1.5 text-brand-magenta"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-brand-ink/40 text-center py-10">No reviews yet.</p>}
      </div>
    </div>
  );
}