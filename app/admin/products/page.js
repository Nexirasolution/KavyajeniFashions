'use client';

// Location: app/admin/products/page.js

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UploadCloud, Search, X } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { ZoomableImage } from '@/components/ImageLightbox';

const PAGE_SIZE = 100;

// Tries the common image field names. If your product model uses a different
// field, add it to this list.
function getThumb(p) {
  const candidates = [
    p.images?.[0],
    p.image,
    p.thumbnail,
    ...(p.variants || []).map((v) => v.images?.[0] ?? v.image),
  ];
  for (const c of candidates) {
    const url = typeof c === 'string' ? c : c?.url;
    if (url) return url;
  }
  return null;
}

function ProductThumb({ product }) {
  const [failed, setFailed] = useState(false);
  const src = getThumb(product);

  if (!src || failed) {
    return (
      <div className="grid h-12 w-12 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-lg bg-brand-cream font-display font-bold text-brand-magenta">
        {(product.name || '?').charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <ZoomableImage
      src={src}
      alt={product.name || ''}
      onError={() => setFailed(true)}
      className="h-12 w-12 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-brand-cream object-cover"
    />
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${active ? 'bg-brand-green/15 text-brand-deepgreen' : 'bg-brand-ink/10 text-brand-ink/50'}`}>
      {active ? 'Active' : 'Hidden'}
    </span>
  );
}

// useSearchParams() must be inside a Suspense boundary in the App Router.
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<p className="text-brand-ink/50">Loading...</p>}>
      <ProductsInner />
    </Suspense>
  );
}

function ProductsInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // The URL is the source of truth for page / search / category, so the
  // admin returns to the same place after editing a product.
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const query = sp.get('q') || '';
  const category = sp.get('category') || '';
  // Product to scroll back to after editing (set by ProductForm on save)
  const focusId = sp.get('focus') || '';
  const cleanParams = new URLSearchParams(sp.toString());
  cleanParams.delete('focus');
  const listQs = cleanParams.toString() ? `?${cleanParams.toString()}` : '';

  function setParams(updates) {
    const p = new URLSearchParams(sp.toString());
    p.delete('focus');
    for (const [k, v] of Object.entries(updates)) {
      if (v === '' || v == null || (k === 'page' && Number(v) === 1)) p.delete(k);
      else p.set(k, String(v));
    }
    const qs = p.toString();
    router.replace(`/admin/products${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState(query); // what's typed in the box
  const [categories, setCategories] = useState([]);

  // Keep the search box in sync when the URL changes (back/forward buttons)
  useEffect(() => {
    setSearch(query);
  }, [query]);

  // Load categories for the dropdown. Adjust the URL if your categories
  // endpoint is different. Accepts either an array or { categories: [...] }.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.categories || [];
        if (!cancelled) setCategories(list);
      } catch {
        /* dropdown just stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (query) params.set('search', query);
      if (category) params.set('category', category);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);

      if (typeof data.pages === 'number') {
        setTotalPages(Math.max(1, data.pages));
      } else if (typeof data.total === 'number') {
        setTotalPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
      } else {
        setTotalPages(1);
      }
    } catch {
      setProducts([]);
      setTotalPages(1);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, query, category]);

  useEffect(() => { load(); }, [load]);

  // After editing, scroll back to the product that was just updated and
  // highlight it briefly, so the admin can carry on from the same spot.
  const [highlightId, setHighlightId] = useState('');
  useEffect(() => {
    if (!focusId || loading) return undefined;
    const raf = requestAnimationFrame(() => {
      // The table and the mobile card list both render; pick the visible one
      const el = Array.from(document.querySelectorAll('[data-product-id]')).find(
        (n) => n.dataset.productId === focusId && n.offsetParent !== null
      );
      if (el) {
        el.scrollIntoView({ block: 'center' });
        setHighlightId(focusId);
        setTimeout(() => setHighlightId(''), 2500);
      }
      // Drop ?focus= so a refresh doesn't scroll again
      const p = new URLSearchParams(sp.toString());
      p.delete('focus');
      const qs = p.toString();
      router.replace(`/admin/products${qs ? `?${qs}` : ''}`, { scroll: false });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, loading, products]);

  function changeCategory(slug) {
    setSelected(new Set());
    setParams({ category: slug, page: 1 });
  }

  function applySearch() {
    setSelected(new Set());
    setParams({ q: search.trim(), page: 1 });
  }

  function clearSearch() {
    setSearch('');
    setSelected(new Set());
    setParams({ q: '', page: 1 });
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const pageIds = products.map((p) => p._id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function remove(id) {
    if (!confirm('Delete this product? This also removes its images from storage.')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Product deleted');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (products.length === 1 && page > 1) {
        setParams({ page: page - 1 });
      } else {
        load();
      }
    } else toast.error('Failed to delete');
  }

  async function bulkRemove() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected product${ids.length > 1 ? 's' : ''}? This also removes their images from storage.`)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${data.deletedCount} product${data.deletedCount === 1 ? '' : 's'}`);
        const deletedOnThisPage = products.filter((p) => ids.includes(p._id)).length;
        setSelected(new Set());
        if (deletedOnThisPage >= products.length && page > 1) {
          setParams({ page: page - 1 });
        } else {
          load();
        }
      } else {
        toast.error(data.error || 'Bulk delete failed');
      }
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  // Parents first, each followed by its subcategories (indented in the dropdown).
  const categoryOptions = (() => {
    const parentOf = (c) => (c.parent && (c.parent._id || c.parent)) || null;
    const roots = categories.filter((c) => !parentOf(c));
    const out = [];
    for (const r of roots) {
      out.push({ ...r, isChild: false });
      categories
        .filter((c) => String(parentOf(c)) === String(r._id))
        .forEach((c) => out.push({ ...c, isChild: true }));
    }
    // Anything whose parent isn't in the list still gets shown
    categories.forEach((c) => {
      if (!out.find((o) => o._id === c._id)) out.push({ ...c, isChild: true });
    });
    return out;
  })();

  const pageIds = products.map((p) => p._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const emptyMessage =
    query || category
      ? `No products match${query ? ` "${query}"` : ''}${category ? ' in this category' : ''}.`
      : 'No products yet. Add your first product!';

  return (
    <div>
      {/* Header + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkRemove}
              disabled={bulkDeleting}
              className="flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50 w-full sm:w-auto"
            >
              <Trash2 size={16} />
              {bulkDeleting ? 'Deleting…' : `Delete (${selected.size})`}
            </button>
          )}
          <Link href="/admin/products/bulk" className="btn-outline flex flex-1 sm:flex-none items-center justify-center gap-1 text-sm">
            <UploadCloud size={16} /> Bulk Upload
          </Link>
          <Link href="/admin/products/new" className="btn-primary flex flex-1 sm:flex-none items-center justify-center gap-1 text-sm">
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row mb-4">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          <button
            type="button"
            onClick={applySearch}
            aria-label="Search products"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink/50 hover:text-brand-magenta"
          >
            <Search size={16} />
          </button>
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Search by name, SKU, or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            className="w-full border rounded-lg pl-9 pr-9 py-2.5 sm:py-2 text-base sm:text-sm"
          />
          {(search || query) && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-magenta"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
            className="border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm flex-1 min-w-0 sm:flex-none sm:max-w-[220px]"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.isChild ? `— ${c.name}` : c.name}
              </option>
            ))}
          </select>
          <button onClick={applySearch} className="btn-outline text-sm shrink-0">Search</button>
        </div>
      </div>

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : products.length === 0 ? (
        <div className="card-soft">
          <p className="text-center text-brand-ink/40 py-10 px-4">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="card-soft overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Variants</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p._id}
                    data-product-id={p._id}
                    className={`border-b border-brand-ink/5 transition-colors duration-700 ${highlightId === p._id ? 'bg-brand-magenta/10' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p._id)}
                        onChange={() => toggleOne(p._id)}
                        aria-label={`Select ${p.name}`}
                      />
                    </td>
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={p} />
                        <div>
                          <span>{p.name}</span>
                          {p.sku && (
                            <div className="text-xs font-normal text-brand-ink/50">SKU: {p.sku}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-brand-ink/60">{p.category?.name}</td>
                    <td className="p-3 whitespace-nowrap">{formatINR(p.basePrice)}</td>
                    <td className="p-3">{p.variants?.length}</td>
                    <td className="p-3"><StatusBadge active={p.isActive} /></td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/admin/products/${p._id}/edit${listQs}`} className="p-1.5 text-brand-magenta" aria-label={`Edit ${p.name}`}><Pencil size={16} /></Link>
                        <button onClick={() => remove(p._id)} className="p-1.5 text-brand-magenta" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden">
            <label className="flex items-center gap-2 px-1 pb-2 text-sm text-brand-ink/60">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAllOnPage}
              />
              Select all on page
            </label>

            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p._id}
                  data-product-id={p._id}
                  className={`card-soft p-3 transition-shadow duration-700 ${highlightId === p._id ? 'ring-2 ring-brand-magenta/50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p._id)}
                      onChange={() => toggleOne(p._id)}
                      aria-label={`Select ${p.name}`}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <ProductThumb product={p} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug break-words">{p.name}</p>
                      {p.sku && (
                        <p className="text-xs text-brand-ink/50 mt-0.5 break-all">SKU: {p.sku}</p>
                      )}
                      {p.category?.name && (
                        <p className="text-xs text-brand-ink/60 mt-0.5">{p.category.name}</p>
                      )}
                    </div>
                    <StatusBadge active={p.isActive} />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-brand-ink/5 pt-3 text-sm">
                    <div>
                      <span className="font-medium">{formatINR(p.basePrice)}</span>
                      <span className="text-xs text-brand-ink/50 ml-2">
                        {p.variants?.length || 0} variant{p.variants?.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        href={`/admin/products/${p._id}/edit${listQs}`}
                        className="p-2 text-brand-magenta"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil size={18} />
                      </Link>
                      <button
                        onClick={() => remove(p._id)}
                        className="p-2 text-brand-magenta"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={(n) => setParams({ page: n })} />
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  const goTo = (p) => {
    const clamped = Math.min(Math.max(p, 1), totalPages);
    if (clamped !== page) {
      onPageChange(clamped);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page === 1}
        className="px-3 py-2 rounded-lg text-sm font-medium text-brand-ink/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-cream transition-colors"
        aria-label="Previous page"
      >
        Prev
      </button>

      {/* Phones: compact "Page x of y" instead of numbered buttons */}
      <span className="sm:hidden px-3 text-sm text-brand-ink/70">
        Page {page} of {totalPages}
      </span>

      {/* Tablet / desktop: numbered buttons */}
      <div className="hidden sm:flex items-center gap-1">
        {pageNumbers.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-brand-ink/40">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-9 h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-brand-magenta text-white' : 'text-brand-ink/70 hover:bg-brand-cream'
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => goTo(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-2 rounded-lg text-sm font-medium text-brand-ink/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-cream transition-colors"
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let last;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) {
        rangeWithDots.push(last + 1);
      } else if (i - last > 2) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    last = i;
  }

  return rangeWithDots;
}