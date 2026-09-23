'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Upload, X, ArrowLeft } from 'lucide-react';

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', '32', '34', '36', '38', '40', '75', '80', '85', '90', '95', '100'];
const GROUP_OPTIONS = [
  { value: 1, label: '1 image = 1 product' },
  { value: 2, label: '2 images = 1 product' },
  { value: 3, label: '3 images = 1 product' },
];

// Must match ALLOWED_TYPES in /api/upload/presign
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB per image
const UPLOAD_CONCURRENCY = 3;

// One entry per selected file: tracks local preview, upload state, and the
// final R2 public url once uploaded.
function useImageQueue() {
  const [items, setItems] = useState([]); // { id, file, previewUrl, url, uploading, error }
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Free blob URLs when leaving the page
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, []);

  function addFiles(fileList) {
    const files = Array.from(fileList);
    const valid = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG or WebP images are supported`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name}: larger than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`);
        continue;
      }
      valid.push(file);
    }

    const newItems = valid.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      url: '',
      uploading: false,
      error: '',
    }));
    if (newItems.length) setItems((prev) => [...prev, ...newItems]);
  }

  function removeItem(id) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  return { items, addFiles, removeItem, updateItem };
}

export default function BulkUploadPage() {
  const router = useRouter();
  const { items, addFiles, removeItem, updateItem } = useImageQueue();
  const [categories, setCategories] = useState([]);
  const [groupSize, setGroupSize] = useState(1);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [common, setCommon] = useState({
    name: '',
    description: '',
    category: '',
    fabric: '',
    tags: '',
    price: '',
    compareAtPrice: '',
    color: '',
    isBestSeller: false,
    isTopSeller: false,
    isActiveSeller: true,
    isFeatured: false,
    isActive: true,
  });

  const [sizes, setSizes] = useState([{ size: 'M', stock: 0, sku: '' }]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => toast.error('Could not load categories'));
  }, []);

  function updateCommon(field, value) {
    setCommon((f) => ({ ...f, [field]: value }));
  }

  function updateSize(idx, field, value) {
    setSizes((s) => {
      const next = [...s];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }
  function addSize() {
    setSizes((s) => [...s, { size: 'L', stock: 0, sku: '' }]);
  }
  function removeSize(idx) {
    setSizes((s) => s.filter((_, i) => i !== idx));
  }

  // Groups images in selection order, groupSize at a time.
  const groups = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < items.length; i += groupSize) {
      chunks.push(items.slice(i, i + groupSize));
    }
    return chunks;
  }, [items, groupSize]);

  const hasIncompleteGroup = items.length > 0 && items.length % groupSize !== 0;

  // Uploads straight from the browser to R2 using a presigned PUT url from
  // /api/upload/presign. This avoids the ~4.5MB serverless body limit.
  // Returns the final public url so callers never depend on React state.
  async function uploadOne(item) {
    updateItem(item.id, { uploading: true, error: '' });
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type,
          contentLength: item.file.size,
          folder: 'uploads',
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || 'Could not start upload');

      // R2 presign returns a single PUT url — send the raw file body with
      // the same Content-Type that was signed, no FormData involved.
      const res = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': item.file.type },
        body: item.file,
      });
      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      updateItem(item.id, { uploading: false, url: presign.publicUrl });
      return presign.publicUrl;
    } catch (err) {
      updateItem(item.id, { uploading: false, error: err.message });
      throw err;
    }
  }

  // Uploads every image that has no url yet (including previously failed ones)
  // and returns a local id -> url map. Using this map instead of `item.url`
  // avoids the stale-closure problem: `items` inside handleSubmit is a snapshot
  // from before the uploads finished.
  async function uploadAllPending() {
    const urlById = {};
    items.forEach((i) => {
      if (i.url) urlById[i.id] = i.url;
    });

    const pending = items.filter((i) => !i.url);
    if (!pending.length) return { ok: true, urlById };

    setUploadingAll(true);
    let ok = true;
    let cursor = 0;

    async function worker() {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        try {
          urlById[item.id] = await uploadOne(item);
        } catch {
          ok = false;
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, worker)
    );

    setUploadingAll(false);
    return { ok, urlById };
  }

  async function handleSubmit() {
    if (!items.length) return toast.error('Select at least one image');
    if (!common.name) return toast.error('Enter a product name');
    if (!common.category) return toast.error('Select a category');
    if (!common.price) return toast.error('Enter a price');

    const { ok, urlById } = await uploadAllPending();
    if (!ok) {
      toast.error('Some images failed to upload. Hover over "Failed" for the reason, then retry or remove them.');
      return;
    }

    const tags = common.tags.split(',').map((t) => t.trim()).filter(Boolean);

    // `groups` is derived from `items` in selection order, so it matches what
    // was uploaded. URLs come from the local map, not from item.url.
    const products = groups.map((group, idx) => ({
      name: groups.length > 1 ? `${common.name} ${idx + 1}` : common.name,
      description: common.description,
      category: common.category,
      fabric: common.fabric,
      tags,
      isBestSeller: common.isBestSeller,
      isTopSeller: common.isTopSeller,
      isActiveSeller: common.isActiveSeller,
      isFeatured: common.isFeatured,
      isActive: common.isActive,
      variants: [
        {
          color: common.color || '',
          images: group.map((i) => urlById[i.id]).filter(Boolean),
          price: Number(common.price),
          compareAtPrice: Number(common.compareAtPrice) || 0,
          sizes: sizes.map((s) => ({ ...s, stock: Number(s.stock) || 0 })),
        },
      ],
    }));

    // Safety net: never send a product without images
    if (products.some((p) => !p.variants[0].images.length)) {
      toast.error('An image URL is missing. Please retry the upload.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk create failed');

      if (data.createdCount) {
        toast.success(`Created ${data.createdCount} product${data.createdCount > 1 ? 's' : ''}`);
      }
      if (data.errors?.length) {
        data.errors.forEach((e) => toast.error(`Product ${e.index + 1} (${e.name || 'unnamed'}): ${e.error}`));
      }
      if (data.createdCount > 0) {
        router.push('/admin/products');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = uploadingAll || submitting;

  return (
    <div>
      <button onClick={() => router.push('/admin/products')} className="flex items-center gap-1 text-sm text-brand-ink/60 mb-4">
        <ArrowLeft size={16} /> Back to Products
      </button>

      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Bulk Upload Products</h1>

      {/* Shared fields */}
      <div className="card-soft p-5 grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-sm font-medium">Product Name *</label>
          <input
            required
            placeholder="e.g. Cotton Saree"
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            value={common.name}
            onChange={(e) => updateCommon('name', e.target.value)}
          />
          <p className="text-xs text-brand-ink/40 mt-1">
            If more than one product is created, "1", "2", "3"… is appended automatically.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Category *</label>
          <select required className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.category} onChange={(e) => updateCommon('category', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Fabric</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.fabric} onChange={(e) => updateCommon('fabric', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Color (optional)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.color} onChange={(e) => updateCommon('color', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Tags (comma separated)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.tags} onChange={(e) => updateCommon('tags', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Price ₹ *</label>
            <input required type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.price} onChange={(e) => updateCommon('price', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Compare-at ₹</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={common.compareAtPrice} onChange={(e) => updateCommon('compareAtPrice', e.target.value)} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={3} value={common.description} onChange={(e) => updateCommon('description', e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-4">
          {[
            ['isBestSeller', 'Bestseller'], ['isTopSeller', 'Top Seller'],
            ['isActiveSeller', 'Active Seller'], ['isFeatured', 'Featured'],
            ['isActive', 'Active (visible on site)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!common[key]} onChange={(e) => updateCommon(key, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </div>

      {/* Sizes/stock — applied to every product created */}
      <div className="card-soft p-5 mb-5">
        <p className="text-sm font-medium mb-2">Sizes & Stock (applied to every product created)</p>
        {sizes.map((s, sIdx) => (
          <div key={sIdx} className="flex gap-2 mb-2 items-center">
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={s.size} onChange={(e) => updateSize(sIdx, 'size', e.target.value)}>
              {SIZE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input type="number" placeholder="Stock" className="border rounded-lg px-2 py-1.5 text-sm w-24" value={s.stock} onChange={(e) => updateSize(sIdx, 'stock', e.target.value)} />
            <input placeholder="SKU (optional)" className="border rounded-lg px-2 py-1.5 text-sm flex-1" value={s.sku} onChange={(e) => updateSize(sIdx, 'sku', e.target.value)} />
            <button type="button" onClick={() => removeSize(sIdx)} className="text-brand-magenta"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addSize} className="text-xs text-brand-magenta">+ Add size</button>
      </div>

      {/* Grouping option */}
      <div className="card-soft p-5 mb-5">
        <p className="text-sm font-medium mb-2">Grouping</p>
        <div className="flex flex-wrap gap-3">
          {GROUP_OPTIONS.map((opt) => (
            <label key={opt.value} className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer ${groupSize === opt.value ? 'border-brand-magenta bg-brand-magenta/5' : 'border-brand-ink/10'}`}>
              <input type="radio" name="groupSize" checked={groupSize === opt.value} onChange={() => setGroupSize(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-brand-ink/40 mt-2">
          Images are grouped in the order you select them below. With {items.length} image{items.length === 1 ? '' : 's'} selected and a group size of {groupSize}, this will create <strong>{groups.length || 0}</strong> product{groups.length === 1 ? '' : 's'}.
        </p>
        {hasIncompleteGroup && (
          <p className="text-xs text-amber-600 mt-1">
            The last product will have fewer than {groupSize} images.
          </p>
        )}
      </div>

      {/* Image selection */}
      <div className="card-soft p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Images</p>
          <label className="btn-outline text-sm flex items-center gap-1 cursor-pointer">
            <Upload size={16} /> Select Images
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = ''; // allow re-selecting the same file
              }}
            />
          </label>
        </div>

        {items.length === 0 && <p className="text-brand-ink/40 text-sm py-6 text-center">No images selected yet.</p>}

        {groups.map((group, gIdx) => (
          <div key={gIdx} className="mb-4 border border-brand-ink/10 rounded-lg p-3">
            <p className="text-xs font-medium text-brand-ink/50 mb-2">
              Product {gIdx + 1} {groupSize > 1 ? `(${group.length} image${group.length > 1 ? 's' : ''})` : ''}
            </p>
            <div className="flex flex-wrap gap-3">
              {group.map((item) => (
                <div key={item.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-brand-ink/10 bg-brand-cream">
                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                  {item.uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin text-brand-magenta" />
                    </div>
                  )}
                  {item.url && !item.uploading && (
                    <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-brand-green/80 text-white">Uploaded</span>
                  )}
                  {item.error && !item.uploading && (
                    <span
                      title={item.error}
                      className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-red-500/90 text-white cursor-help"
                    >
                      Failed
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(item.id)}
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 disabled:opacity-40"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full sm:w-auto flex items-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {submitting ? 'Creating products...' : uploadingAll ? 'Uploading images...' : `Create ${groups.length || 0} Product${groups.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}