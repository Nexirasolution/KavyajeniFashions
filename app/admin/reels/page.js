'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, X, Upload, Loader2, Video } from 'lucide-react';

const emptyForm = { title: '', videoUrl: '', thumbnail: '', instagramLink: '', product: '', sortOrder: 0 };

// Keep this in sync with MAX_BYTES in app/api/upload/presign/route.js.
// Checking client-side first means a too-large file fails instantly with
// a clear message instead of after a wasted presign round-trip that the
// server would reject anyway.
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB

function UploadSlot({ value, accept, folder, placeholder, icon: Icon, preview: PreviewComp, onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File too large. Max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // 1. Ask our server for a short-lived signed PUT URL (tiny request, no file bytes).
      // contentLength is pinned into the signature server-side, so the
      // actual PUT below must match this exact size or R2 will reject it.
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          contentLength: file.size,
          folder,
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Could not get upload URL');
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      // 2. Upload the file straight to R2 (never touches our server).
      // Don't set Content-Length manually — the browser sets it from the
      // body automatically, and it must match what was signed above.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload to storage failed');

      onChange(publicUrl);
      toast.success('Uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file after an error
    }
  }

  return (
    <div className="space-y-1">
      {/* Click area */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative bg-brand-cream/40"
      >
        {value ? (
          PreviewComp ? <PreviewComp url={value} /> : <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-xs">
            <Icon size={22} />
            <span>{placeholder}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-brand-magenta" />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />

      {/* Manual URL fallback */}
      <input
        placeholder={`Or paste URL — ${placeholder}`}
        className="w-full border rounded-lg px-3 py-2 text-xs text-brand-ink/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VideoPreview({ url }) {
  return (
    <video src={url} className="w-full h-full object-cover" muted playsInline
      onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
    />
  );
}

export default function AdminReelsPage() {
  const [reels, setReels] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating, string = editing that reel
  const [saving, setSaving] = useState(false);

  async function load() {
    const [r1, r2] = await Promise.all([fetch('/api/reels?all=true'), fetch('/api/products?limit=200')]);
    setReels((await r1.json()).reels || []);
    setProducts((await r2.json()).products || []);
  }
  useEffect(() => { load(); }, []);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(reel) {
    setEditingId(reel._id);
    setForm({
      title: reel.title || '',
      videoUrl: reel.videoUrl || '',
      thumbnail: reel.thumbnail || '',
      instagramLink: reel.instagramLink || '',
      product: reel.product?._id || reel.product || '',
      sortOrder: reel.sortOrder ?? 0,
    });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.videoUrl) { toast.error('Please upload a video'); return; }
    const payload = { ...form, product: form.product || null };

    setSaving(true);
    try {
      const res = editingId
        ? await fetch(`/api/reels/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/reels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editingId ? 'Reel updated' : 'Reel added');
        closeForm();
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Save failed');
      }
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this reel?')) return;
    await fetch(`/api/reels/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Shop by Reels</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Reel
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{editingId ? 'Edit Reel' : 'New Reel'}</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-brand-ink/60 mb-1">Video * (.mp4, .mov, .webm)</p>
              <UploadSlot
                value={form.videoUrl}
                accept="video/mp4,video/webm,video/quicktime"
                folder="reels/videos"
                placeholder="Click to upload video"
                icon={Video}
                preview={VideoPreview}
                onChange={(url) => setForm((f) => ({ ...f, videoUrl: url }))}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-brand-ink/60 mb-1">Thumbnail image</p>
              <UploadSlot
                value={form.thumbnail}
                accept="image/jpeg,image/png,image/webp"
                folder="reels/thumbnails"
                placeholder="Click to upload thumbnail"
                icon={Upload}
                onChange={(url) => setForm((f) => ({ ...f, thumbnail: url }))}
              />
            </div>
          </div>

          <input
            placeholder="Title (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <input
            placeholder="Instagram reel link"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.instagramLink}
            onChange={(e) => setForm({ ...form, instagramLink: e.target.value })}
          />

          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.product}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
          >
            <option value="">Link to product (optional)</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>

          <input
            type="number"
            placeholder="Sort order"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
          />

          <button disabled={saving} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {reels.map((r) => (
          <div key={r._id} className="card-soft overflow-hidden">
            <div className="aspect-[9/16] bg-brand-cream overflow-hidden">
              {r.thumbnail
                ? <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover" />
                : r.videoUrl
                  ? <video src={r.videoUrl} className="w-full h-full object-cover" muted playsInline
                      onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }} />
                  : null
              }
            </div>
            <div className="p-2 flex items-center justify-between">
              <p className="text-xs line-clamp-1">{r.product?.name || r.title || 'Reel'}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className="text-brand-ink/60 hover:text-brand-magenta">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(r._id)} className="text-brand-magenta">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}