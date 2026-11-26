'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Upload, Loader2, Pencil } from 'lucide-react';

const emptyForm = {
  title: '', subtitle: '', image: '', link: '',
  buttonText: 'Shop Now', sortOrder: 0, isActive: true,
};

// Reads the server's error message if there is one
async function errorFrom(res, fallback) {
  const data = await res.json().catch(() => ({}));
  return data.error || `${fallback} (${res.status})`;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();

  async function load() {
    try {
      const res = await fetch('/api/banners?all=true', { cache: 'no-store' });
      const data = await res.json();
      setBanners(data.banners || []);
    } catch {
      toast.error('Failed to load banners');
    }
  }
  useEffect(() => { load(); }, []);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // local preview instantly
    setPreview(URL.createObjectURL(file));

    // upload to Cloudinary via our API route
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => ({ ...f, image: data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
      setPreview('');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = ''; // allow re-picking same file
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
    setShowForm(true);
  }

  function openEdit(b) {
    setEditingId(b._id);
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      image: b.image || '',
      link: b.link || '',
      buttonText: b.buttonText || 'Shop Now',
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive ?? true,
    });
    setPreview(b.image || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.image) { toast.error('Please upload an image'); return; }

    const isEditing = Boolean(editingId);
    setSaving(true);
    try {
      const res = await fetch(
        isEditing ? `/api/banners/${editingId}` : '/api/banners',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        toast.error(await errorFrom(res, isEditing ? 'Failed to update banner' : 'Failed to add banner'));
        return;
      }

      toast.success(isEditing ? 'Banner updated' : 'Banner added');
      closeForm();
      load();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b) {
    const next = !b.isActive;

    // optimistic update
    setBanners((list) => list.map((x) => (x._id === b._id ? { ...x, isActive: next } : x)));

    try {
      const res = await fetch(`/api/banners/${b._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, 'Failed to update banner'));
      toast.success(next ? 'Banner activated' : 'Banner deactivated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      load(); // always resync with the server
    }
  }

  async function remove(id) {
    if (!confirm('Delete this banner?')) return;
    try {
      const res = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorFrom(res, 'Failed to delete banner'));
      toast.success('Banner deleted');
      setBanners((list) => list.filter((x) => x._id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      load();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Homepage Banners</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{editingId ? 'Edit Banner' : 'New Banner'}</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          {/* Image upload */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative"
          >
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-sm">
                <Upload size={24} />
                <span>Click to choose image</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-brand-magenta" />
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {editingId && (
            <p className="text-xs text-brand-ink/50">Click the image to replace it, or leave it as is.</p>
          )}

          <input placeholder="Title" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Subtitle" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <input placeholder="Link (e.g. /category/umbrella-kurtis)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <input placeholder="Button text" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
          <input type="number" placeholder="Sort order" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>

          <button type="submit" className="btn-primary text-sm" disabled={uploading || saving}>
            {uploading ? 'Uploading…' : saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {banners.map((b) => (
          <div key={b._id} className="card-soft overflow-hidden">
            <img src={b.image} alt={b.title || 'banner'} className="w-full h-32 object-cover" />
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{b.title || '(no title)'}</p>
                <p className="text-xs text-brand-ink/50">Order: {b.sortOrder}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={!!b.isActive} onChange={() => toggleActive(b)} /> Active
                </label>
                <button type="button" onClick={() => openEdit(b)} className="text-brand-ink/60 hover:text-brand-magenta"><Pencil size={16} /></button>
                <button type="button" onClick={() => remove(b._id)} className="text-brand-magenta"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <p className="text-sm text-brand-ink/50">No banners yet.</p>
        )}
      </div>
    </div>
  );
}