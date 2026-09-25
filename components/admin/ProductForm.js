'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Upload, Loader2, X } from 'lucide-react';

function emptyVariant() {
  return { color: '', images: [''], price: '', compareAtPrice: '', sizes: [{ size: '', stock: 0, sku: '' }] };
}

// Per-slot upload button with preview thumbnail
function ImageSlot({ value, onChange, onRemove, showRemove }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="w-12 h-12 rounded-lg border-2 border-dashed border-brand-ink/20 flex items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden shrink-0 relative bg-brand-cream"
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : uploading ? (
          <Loader2 size={16} className="animate-spin text-brand-magenta" />
        ) : (
          <Upload size={14} className="text-brand-ink/30" />
        )}
        {uploading && value && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-brand-magenta" />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <input
        placeholder="https://... or click thumbnail to upload"
        className="border rounded-lg px-3 py-2 text-sm flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {showRemove && (
        <button type="button" onClick={onRemove} className="text-brand-ink/40 hover:text-brand-magenta shrink-0">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export default function ProductForm({ initial, productId }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(
    initial || {
      name: '', slug: '', description: '', category: '', fabric: '', tags: [],
      variants: [emptyVariant()],
      isBestSeller: false, isTopSeller: false, isActiveSeller: true, isFeatured: false, isActive: true,
    }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function updateVariant(idx, field, value) {
    setForm((f) => { const v = [...f.variants]; v[idx] = { ...v[idx], [field]: value }; return { ...f, variants: v }; });
  }

  function updateVariantImage(vIdx, imgIdx, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = [...variants[vIdx].images];
      images[imgIdx] = value;
      variants[vIdx] = { ...variants[vIdx], images };
      return { ...f, variants };
    });
  }

  function removeVariantImage(vIdx, imgIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = variants[vIdx].images.filter((_, i) => i !== imgIdx);
      variants[vIdx] = { ...variants[vIdx], images: images.length ? images : [''] };
      return { ...f, variants };
    });
  }

  function addVariantImage(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], images: [...variants[vIdx].images, ''] };
      return { ...f, variants };
    });
  }

  function updateSize(vIdx, sIdx, field, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const sizes = [...variants[vIdx].sizes];
      sizes[sIdx] = { ...sizes[sIdx], [field]: value };
      variants[vIdx] = { ...variants[vIdx], sizes };
      return { ...f, variants };
    });
  }

  function addSize(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: [...variants[vIdx].sizes, { size: '', stock: 0, sku: '' }] };
      return { ...f, variants };
    });
  }

  function removeSize(vIdx, sIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: variants[vIdx].sizes.filter((_, i) => i !== sIdx) };
      return { ...f, variants };
    });
  }

  function addVariant() { setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] })); }
  function removeVariant(idx) { setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) })); }

  async function submit(e) {
    e.preventDefault();

    for (const v of form.variants) {
      if (v.sizes.some((s) => !String(s.size).trim())) {
        toast.error('Enter a value for every size');
        return;
      }
    }

    setSaving(true);
    const payload = {
      ...form,
      variants: form.variants.map((v) => ({
        ...v,
        color: v.color || '',
        price: Number(v.price),
        compareAtPrice: Number(v.compareAtPrice) || 0,
        images: v.images.filter(Boolean),
        sizes: v.sizes.map((s) => ({ ...s, size: String(s.size).trim(), stock: Number(s.stock) })),
      })),
    };
    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(productId ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } else {
      toast.error(data.error || 'Something went wrong');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card-soft p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Product Name *</label>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Category *</label>
          <select required className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.category?._id || form.category} onChange={(e) => update('category', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Fabric</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.fabric} onChange={(e) => update('fabric', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Tags (comma separated)</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
            onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-4">
          {[
            ['isBestSeller', 'Bestseller'], ['isTopSeller', 'Top Seller'],
            ['isActiveSeller', 'Active Seller'], ['isFeatured', 'Featured'],
            ['isActive', 'Active (visible on site)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form[key]} onChange={(e) => update(key, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Variants (Images, Price & Size Stock)</h2>
          <button type="button" onClick={addVariant} className="btn-outline text-sm flex items-center gap-1"><Plus size={16} /> Add Variant</button>
        </div>

        {form.variants.map((v, vIdx) => (
          <div key={vIdx} className="card-soft p-4 mb-4">
            <div className="flex justify-between mb-3">
              <span className="font-medium text-sm">Variant {vIdx + 1}</span>
              {form.variants.length > 1 && (
                <button type="button" onClick={() => removeVariant(vIdx)} className="text-brand-magenta"><Trash2 size={16} /></button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <input placeholder="Color (optional)" className="border rounded-lg px-3 py-2 text-sm" value={v.color} onChange={(e) => updateVariant(vIdx, 'color', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Price ₹" type="number" className="border rounded-lg px-3 py-2 text-sm" value={v.price} onChange={(e) => updateVariant(vIdx, 'price', e.target.value)} />
                <input placeholder="Compare-at price ₹" type="number" className="border rounded-lg px-3 py-2 text-sm" value={v.compareAtPrice} onChange={(e) => updateVariant(vIdx, 'compareAtPrice', e.target.value)} />
              </div>
            </div>

            <p className="text-xs font-medium text-brand-ink/60 mb-2">Images for this variant — click thumbnail to upload</p>
            {v.images.map((img, imgIdx) => (
              <ImageSlot
                key={imgIdx}
                value={img}
                onChange={(url) => updateVariantImage(vIdx, imgIdx, url)}
                onRemove={() => removeVariantImage(vIdx, imgIdx)}
                showRemove={v.images.length > 1}
              />
            ))}
            <button type="button" onClick={() => addVariantImage(vIdx)} className="text-xs text-brand-magenta mb-3">
              + Add another image
            </button>

            <p className="text-xs font-medium text-brand-ink/60 mb-1">Sizes & Stock</p>
            {v.sizes.map((s, sIdx) => (
              <div key={sIdx} className="flex gap-2 mb-2 items-center">
                <input
                  placeholder="Size (e.g. M, 32, Free Size)"
                  className="border rounded-lg px-2 py-1.5 text-sm w-36"
                  value={s.size}
                  onChange={(e) => updateSize(vIdx, sIdx, 'size', e.target.value)}
                />
                <input type="number" placeholder="Stock" className="border rounded-lg px-2 py-1.5 text-sm w-24" value={s.stock} onChange={(e) => updateSize(vIdx, sIdx, 'stock', e.target.value)} />
                <input placeholder="SKU (optional)" className="border rounded-lg px-2 py-1.5 text-sm flex-1" value={s.sku} onChange={(e) => updateSize(vIdx, sIdx, 'sku', e.target.value)} />
                <button type="button" onClick={() => removeSize(vIdx, sIdx)} className="text-brand-magenta"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => addSize(vIdx)} className="text-xs text-brand-magenta">+ Add size</button>
          </div>
        ))}
      </div>

      <button disabled={saving} className="btn-primary w-full sm:w-auto">
        {saving ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
      </button>
    </form>
  );
}