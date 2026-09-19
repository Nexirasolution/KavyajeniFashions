'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Upload,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Eye,
  EyeOff,
} from 'lucide-react';

const emptyForm = { name: '', slug: '', image: '', description: '', sizes: '', parent: '' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]); // flat list, includes inactive
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  const [expanded, setExpanded] = useState({}); // { [categoryId]: boolean }
  const fileRef = useRef();

  async function load() {
    const res = await fetch('/api/categories?includeInactive=true');
    const data = await res.json();
    setCategories(data.categories || []);
  }
  useEffect(() => {
    load();
  }, []);

  const topLevel = useMemo(() => categories.filter((c) => !c.parent), [categories]);
  const childrenOf = (parentId) =>
    categories.filter((c) => c.parent && String(c.parent) === String(parentId));

  function toggleExpanded(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function startEdit(c) {
    setEditingId(c._id);
    setForm({
      name: c.name,
      slug: c.slug,
      image: c.image || '',
      description: c.description || '',
      sizes: (c.sizes || []).join(', '),
      parent: c.parent ? String(c.parent) : '',
    });
    setPreview(c.image || '');
    setShowForm(true);
  }

  function startNew(parentId = '') {
    setEditingId(null);
    setForm({ ...emptyForm, parent: parentId });
    setPreview('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setPreview('');
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
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
    }
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      sizes: form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
      parent: form.parent || null,
    };
    const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(editingId ? 'Category updated' : 'Category created');
      setShowForm(false);
      setPreview('');
      load();
    } else toast.error(data.error || 'Failed');
  }

  async function remove(id) {
    if (!confirm('Delete this category?')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success('Deleted');
      load();
    } else {
      toast.error(data.error || 'Failed to delete');
    }
  }

  async function toggleActive(c) {
    const res = await fetch(`/api/categories/${c._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (res.ok) {
      toast.success(c.isActive ? 'Category deactivated' : 'Category activated');
      load();
    } else {
      toast.error('Failed to update status');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Categories</h1>
        <button onClick={() => startNew()} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">
              {editingId ? 'Edit Category' : form.parent ? 'New Subcategory' : 'New Category'}
            </h2>
            <button type="button" onClick={closeForm}>
              <X size={18} />
            </button>
          </div>

          {/* Image upload — circular preview to match category icon style */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-cream overflow-hidden shrink-0 border-2 border-dashed border-brand-ink/20 flex items-center justify-center">
              {preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <Upload size={18} className="text-brand-ink/30" />
              )}
            </div>
            <div className="flex-1">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 hover:border-brand-magenta transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload size={14} /> {preview ? 'Change image' : 'Choose image'}
                  </>
                )}
              </button>
              <p className="text-xs text-brand-ink/40 mt-1">Shown as circular icon on homepage</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <input
            required
            placeholder="Category name (e.g. Umbrella Kurtis)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Slug (auto if blank)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />

          {/* Parent category picker - leave blank for a top-level category */}
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            value={form.parent}
            onChange={(e) => setForm({ ...form, parent: e.target.value })}
          >
            <option value="">— Top-level category (no parent) —</option>
            {topLevel
              .filter((c) => c._id !== editingId)
              .map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
          </select>
          <p className="text-xs text-brand-ink/40 -mt-2">
            Pick a parent to make this a subcategory. Categories with subcategories show a subcategory grid
            on the storefront instead of a size filter.
          </p>

          <input
            placeholder="Available sizes, comma separated (S, M, L, XL)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.sizes}
            onChange={(e) => setForm({ ...form, sizes: e.target.value })}
          />
          <textarea
            placeholder="Description"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button className="btn-primary text-sm" disabled={uploading}>
            {editingId ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {topLevel.map((c) => {
          const subs = childrenOf(c._id);
          const isOpen = !!expanded[c._id];
          return (
            <div key={c._id} className="card-soft overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                {subs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c._id)}
                    className="text-brand-ink/40 shrink-0"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                ) : (
                  <span className="w-[18px] shrink-0" />
                )}

                <div
                  className={`w-12 h-12 rounded-full bg-brand-cream overflow-hidden shrink-0 ${
                    c.isActive ? '' : 'opacity-40'
                  }`}
                >
                  {c.image && <img src={c.image} alt={c.name} className="w-full h-full object-cover" />}
                </div>

                <div className={`flex-1 ${c.isActive ? '' : 'opacity-40'}`}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-brand-ink/50">
                    /{c.slug} {subs.length > 0 && `· ${subs.length} subcategor${subs.length === 1 ? 'y' : 'ies'}`}
                  </p>
                </div>

                {!c.isActive && (
                  <span className="text-[10px] uppercase tracking-wide bg-brand-ink/10 text-brand-ink/50 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}

                <button
                  onClick={() => startNew(c._id)}
                  className="text-brand-ink/40 p-1"
                  title="Add subcategory"
                >
                  <FolderPlus size={16} />
                </button>
                <button
                  onClick={() => toggleActive(c)}
                  className="text-brand-ink/40 p-1"
                  title={c.isActive ? 'Deactivate' : 'Activate'}
                >
                  {c.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => startEdit(c)} className="text-brand-magenta p-1" title="Edit">
                  <Pencil size={16} />
                </button>
                <button onClick={() => remove(c._id)} className="text-brand-magenta p-1" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>

              {isOpen && subs.length > 0 && (
                <div className="border-t divide-y divide-brand-ink/5">
                  {subs.map((sub) => (
                    <div key={sub._id} className="pl-14 pr-4 py-3 flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full bg-brand-cream overflow-hidden shrink-0 ${
                          sub.isActive ? '' : 'opacity-40'
                        }`}
                      >
                        {sub.image && (
                          <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className={`flex-1 ${sub.isActive ? '' : 'opacity-40'}`}>
                        <p className="text-sm font-medium">{sub.name}</p>
                        <p className="text-xs text-brand-ink/50">/{sub.slug}</p>
                      </div>
                      {!sub.isActive && (
                        <span className="text-[10px] uppercase tracking-wide bg-brand-ink/10 text-brand-ink/50 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                      <button
                        onClick={() => toggleActive(sub)}
                        className="text-brand-ink/40 p-1"
                        title={sub.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {sub.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => startEdit(sub)} className="text-brand-magenta p-1" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(sub._id)} className="text-brand-magenta p-1" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {topLevel.length === 0 && (
          <p className="text-sm text-brand-ink/40 text-center py-10">No categories yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}