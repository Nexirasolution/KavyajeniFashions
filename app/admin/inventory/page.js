'use client';

// Location: your admin inventory page (e.g. app/admin/inventory/page.js)

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';

const PAGE_SIZE = 50; // products per page
const LOW_STOCK = 5; // a size with this many units or fewer counts as "low"
const MAX_QTY = 100000;

/* ------------------------------ helpers ------------------------------ */

const keyOf = (productId, variantId, size) => `${productId}|${variantId}|${size}`;
const isValidQty = (raw) => /^\d+$/.test(String(raw));
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

const hasSizes = (p) => (p.variants || []).some((v) => (v.sizes || []).length > 0);
const sizeCount = (p) => (p.variants || []).reduce((n, v) => n + (v.sizes || []).length, 0);
const variantStock = (v) => (v.sizes || []).reduce((n, s) => n + (Number(s.stock) || 0), 0);
const totalStock = (p) => (p.variants || []).reduce((n, v) => n + variantStock(v), 0);

// 'out' = 0 units in every size (hidden from the shop)
// 'low' = still sellable, but at least one size is at or below LOW_STOCK
// 'ok'  = healthy
function statusOf(p) {
  if (totalStock(p) === 0) return 'out';
  const anyLow = (p.variants || []).some((v) =>
    (v.sizes || []).some((s) => (Number(s.stock) || 0) <= LOW_STOCK)
  );
  return anyLow ? 'low' : 'ok';
}

// Category comes populated from the API: { _id, name, parent: { name } }
function categoryOf(p) {
  const c = p.category;
  if (c && typeof c === 'object' && c._id) {
    const parent = c.parent && typeof c.parent === 'object' ? c.parent.name : null;
    const name = c.name || 'Untitled category';
    return { id: String(c._id), label: parent ? `${parent} › ${name}` : name };
  }
  return { id: 'none', label: 'Uncategorized' };
}

// Same maths as the server (app/api/admin/inventory/bulk), used for the preview
function nextStock(current, mode, value) {
  const c = Number(current) || 0;
  if (mode === 'set') return value;
  if (mode === 'zero') return 0;
  if (mode === 'add') return c + value;
  if (mode === 'subtract') return Math.max(0, c - value);
  return c;
}

function previewBulk(products, mode, value) {
  let sizes = 0;
  let hidden = 0;
  let restored = 0;
  for (const p of products) {
    let total = 0;
    for (const v of p.variants || []) {
      for (const s of v.sizes || []) {
        sizes += 1;
        total += nextStock(s.stock, mode, value);
      }
    }
    const wasOut = p._status === 'out';
    if (!wasOut && total === 0) hidden += 1;
    if (wasOut && total > 0) restored += 1;
  }
  return { sizes, hidden, restored };
}

// Tries the common image field names; falls back to an initial letter tile.
// If your product model uses a different field, add it to this list.
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

// Builds a compact page list like: 1 ... 4 5 [6] 7 8 ... 12
function getPageNumbers(current, total) {
  const range = [];
  const out = [];
  let last;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) range.push(i);
  }
  for (const i of range) {
    if (last) {
      if (i - last === 2) out.push(last + 1);
      else if (i - last > 2) out.push('...');
    }
    out.push(i);
    last = i;
  }
  return out;
}

const passStatus = (p, f) => {
  if (f === 'all') return true;
  if (f === 'in') return p._status !== 'out';
  if (f === 'low') return p._status === 'low';
  return p._status === 'out';
};

const STATUS = {
  ok: { label: 'In stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  low: { label: 'Low stock', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  out: { label: 'Out of stock', cls: 'bg-red-50 text-red-700 border-red-200' },
};

async function callBulk(payload) {
  const res = await fetch('/api/admin/inventory/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ------------------------------ share helpers ------------------------------ */
// Builds a name+description message and, where the browser supports it, gathers
// the products' images so they can be handed to the native share sheet alongside
// the text. Price is never referenced anywhere here.

function slugify(name, i) {
  const base = (name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base || 'product'}-${i + 1}`;
}

function buildDefaultShareMessage(products) {
  const lines = ['✨ Check these out! ✨', ''];
  products.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name}`);
    if (p.description && String(p.description).trim()) lines.push(String(p.description).trim());
    lines.push('');
  });
  return lines.join('\n').trim();
}

// Fetches each product's thumbnail as a File, for navigator.share({ files }).
// Images that fail (e.g. a host without permissive CORS headers) are silently
// skipped rather than blocking the whole share.
async function collectShareImageFiles(products) {
  const files = [];
  for (const [i, p] of products.entries()) {
    const src = getThumb(p);
    if (!src) continue;
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
      files.push(new File([blob], `${slugify(p.name, i)}.${ext}`, { type: blob.type || 'image/jpeg' }));
    } catch {
      // CORS or network failure — this one image just won't be attachable automatically
    }
  }
  return files;
}

// Downloads each product's thumbnail to the admin's device, for manual attaching
// when automatic image sharing isn't available. Falls back to opening the image
// in a new tab if the fetch itself is blocked (e.g. by CORS).
async function downloadProductImages(products) {
  for (const [i, p] of products.entries()) {
    const src = getThumb(p);
    if (!src) continue;
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(p.name, i)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank'); // let the admin save it manually from the image tab
    }
    // Stagger slightly — back-to-back downloads get silently blocked by some browsers.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* -------------------------------- page -------------------------------- */

export default function AdminInventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [edits, setEdits] = useState({}); // { "productId|variantId|size": "12" }
  const [savingIds, setSavingIds] = useState([]);

  const [filter, setFilter] = useState('all'); // all | in | low | out
  const [cat, setCat] = useState('all'); // 'all' or a category id
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name'); // name | stock
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({}); // { productId: true }

  const [selected, setSelected] = useState(() => new Set());
  const [modal, setModal] = useState(null); // 'stock' | 'delete' | 'share' | null
  const [bulkBusy, setBulkBusy] = useState(false);

  const listRef = useRef(null);

  async function load({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/inventory');
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(true);
      if (silent) toast.error('Could not refresh inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  /* ---- derived data ---- */

  const tracked = useMemo(
    () =>
      products
        .filter(hasSizes)
        .map((p) => ({ ...p, _cat: categoryOf(p), _status: statusOf(p), _total: totalStock(p) })),
    [products]
  );

  // key -> saved stock + ids, so edits can be compared against what's in the database
  const index = useMemo(() => {
    const map = {};
    for (const p of tracked) {
      for (const v of p.variants || []) {
        for (const s of v.sizes || []) {
          map[keyOf(p._id, v._id, s.size)] = {
            productId: p._id,
            variantId: v._id,
            size: s.size,
            stock: Number(s.stock) || 0,
          };
        }
      }
    }
    return map;
  }, [tracked]);

  // Only edits that differ from the saved value count as "unsaved changes"
  const dirty = useMemo(() => {
    const byProduct = {};
    let count = 0;
    let invalid = 0;
    for (const [key, raw] of Object.entries(edits)) {
      const meta = index[key];
      if (!meta || String(raw) === String(meta.stock)) continue;
      count += 1;
      if (!isValidQty(raw)) invalid += 1;
      (byProduct[meta.productId] ||= []).push({ ...meta, key, raw });
    }
    return { byProduct, count, invalid };
  }, [edits, index]);

  // Warn before leaving the page with unsaved edits
  useEffect(() => {
    if (dirty.count === 0) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty.count]);

  const allCats = useMemo(() => {
    const m = new Map();
    tracked.forEach((p) => m.set(p._cat.id, p._cat.label));
    return [...m]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => (a.id === 'none') - (b.id === 'none') || a.label.localeCompare(b.label));
  }, [tracked]);

  // If the selected category disappears (e.g. all its products were deleted), fall back to "all"
  const activeCat = cat === 'all' || allCats.some((c) => c.id === cat) ? cat : 'all';

  const q = query.trim().toLowerCase();

  // search only
  const base = useMemo(() => {
    if (!q) return tracked;
    return tracked.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        p._cat.label.toLowerCase().includes(q) ||
        (p.variants || []).some(
          (v) =>
            (v.color || '').toLowerCase().includes(q) ||
            (v.sizes || []).some((s) => (s.sku || '').toLowerCase().includes(q))
        )
    );
  }, [tracked, q]);

  // Summary cards: respect search + category, ignore the status filter
  const cardCounts = useMemo(() => {
    const c = { all: 0, in: 0, low: 0, out: 0 };
    for (const p of base) {
      if (activeCat !== 'all' && p._cat.id !== activeCat) continue;
      c.all += 1;
      if (p._status === 'out') c.out += 1;
      else c.in += 1;
      if (p._status === 'low') c.low += 1;
    }
    return c;
  }, [base, activeCat]);

  // Category nav: respects search + status filter, ignores the selected category
  const catCounts = useMemo(() => {
    const m = {};
    for (const p of base) {
      if (!passStatus(p, filter)) continue;
      m[p._cat.id] = (m[p._cat.id] || 0) + 1;
    }
    return m;
  }, [base, filter]);
  const navTotal = Object.values(catCounts).reduce((a, b) => a + b, 0);
  const navItems = allCats
    .map((c) => ({ ...c, count: catCounts[c.id] || 0 }))
    .filter((c) => c.count > 0 || c.id === activeCat);

  // The list being browsed: search + status + category, sorted by category first
  const list = useMemo(() => {
    const rows = base.filter(
      (p) => passStatus(p, filter) && (activeCat === 'all' || p._cat.id === activeCat)
    );
    const rank = (p) => (p._status === 'out' ? 1 : 0);
    rows.sort(
      (a, b) =>
        (a._cat.id === 'none') - (b._cat.id === 'none') ||
        a._cat.label.localeCompare(b._cat.label) ||
        (filter === 'all' ? rank(a) - rank(b) : 0) ||
        (sort === 'stock' ? a._total - b._total : 0) ||
        (a.name || '').localeCompare(b.name || '')
    );
    return rows;
  }, [base, filter, activeCat, sort]);

  // per-category ids/out counts within the current list (used by group headers)
  const catStats = useMemo(() => {
    const m = {};
    for (const p of list) {
      const s = (m[p._cat.id] ||= { ids: [], out: 0 });
      s.ids.push(p._id);
      if (p._status === 'out') s.out += 1;
    }
    return m;
  }, [list]);

  /* ---- pagination ---- */

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const groups = [];
  for (const p of pageItems) {
    const last = groups[groups.length - 1];
    if (last && last.cat.id === p._cat.id) last.items.push(p);
    else groups.push({ cat: p._cat, items: [p] });
  }

  useEffect(() => {
    setPage(1);
  }, [filter, q, activeCat, sort]);

  function goToPage(p) {
    setPage(Math.min(Math.max(p, 1), totalPages));
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- selection ---- */

  // Changing the view clears the selection so bulk actions never touch hidden products
  useEffect(() => {
    setSelected(new Set());
  }, [filter, q, activeCat]);

  const selectedProducts = useMemo(() => list.filter((p) => selected.has(p._id)), [list, selected]);
  const selectedIds = selectedProducts.map((p) => p._id);
  const selectedCatCount = new Set(selectedProducts.map((p) => p._cat.id)).size;

  const pageIds = pageItems.map((p) => p._id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageSomeSelected = pageIds.some((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setMany(ids, on) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  /* ---- expand / collapse ---- */

  const allOpen = pageIds.length > 0 && pageIds.every((id) => expanded[id]);
  function toggleAll() {
    setExpanded((prev) => {
      const next = { ...prev };
      pageIds.forEach((id) => {
        next[id] = !allOpen;
      });
      return next;
    });
  }

  /* ---- editing + saving individual sizes ---- */

  const setQty = (key, value) => setEdits((e) => ({ ...e, [key]: value }));

  function discard(productIds) {
    setEdits((e) => {
      const next = { ...e };
      for (const k of Object.keys(next)) {
        if (productIds.includes(index[k]?.productId)) delete next[k];
      }
      return next;
    });
  }

  async function saveProducts(ids) {
    const targets = ids.filter((id) => dirty.byProduct[id]?.length);
    if (targets.length === 0) return;

    if (targets.some((id) => dirty.byProduct[id].some((e) => !isValidQty(e.raw)))) {
      toast.error('Stock must be a whole number, 0 or more');
      return;
    }

    setSavingIds((s) => [...s, ...targets]);

    const results = await Promise.all(
      targets.map(async (id) => {
        const product = products.find((p) => p._id === id);
        const changes = new Map(
          dirty.byProduct[id].map((e) => [`${e.variantId}|${e.size}`, Number(e.raw)])
        );
        const variants = (product.variants || []).map((v) => ({
          ...v,
          sizes: (v.sizes || []).map((s) =>
            changes.has(`${v._id}|${s.size}`) ? { ...s, stock: changes.get(`${v._id}|${s.size}`) } : s
          ),
        }));
        try {
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variants }),
          });
          if (!res.ok) throw new Error('Request failed');
          return { id, ok: true, variants, product };
        } catch (err) {
          return { id, ok: false, product };
        }
      })
    );

    const done = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    if (done.length) {
      const doneById = Object.fromEntries(done.map((r) => [r.id, r.variants]));
      const savedKeys = new Set(done.flatMap((r) => dirty.byProduct[r.id].map((e) => e.key)));

      // Update locally instead of refetching: no flash, products just move
      setProducts((prev) => prev.map((p) => (doneById[p._id] ? { ...p, variants: doneById[p._id] } : p)));
      setEdits((e) => {
        const next = { ...e };
        savedKeys.forEach((k) => delete next[k]);
        return next;
      });

      const changeCount = done.reduce((n, r) => n + dirty.byProduct[r.id].length, 0);
      const notes = done
        .map((r) => {
          const before = statusOf(r.product);
          const after = statusOf({ ...r.product, variants: r.variants });
          if (before !== 'out' && after === 'out') return `${r.product.name} is now hidden from the shop`;
          if (before === 'out' && after !== 'out') return `${r.product.name} is back in the shop`;
          return null;
        })
        .filter(Boolean);

      let message = `Saved ${changeCount} ${plural(changeCount, 'change')}`;
      if (notes.length === 1) message += `. ${notes[0]}`;
      if (notes.length > 1) message += `. ${notes.length} products changed shop visibility`;
      toast.success(message);
    }

    if (failed.length) {
      toast.error(
        `Couldn't save ${failed.map((r) => r.product.name).join(', ')}. Your edits are still here, try again.`
      );
    }

    setSavingIds((s) => s.filter((id) => !targets.includes(id)));
  }

  const anySaving = savingIds.length > 0;

  /* ---- bulk actions ---- */

  async function applyBulkStock(mode, value) {
    setBulkBusy(true);
    try {
      const res = await callBulk({ action: 'stock', ids: selectedIds, mode, value });
      discard(selectedIds); // unsaved edits on these products would be stale now
      setSelected(new Set());
      setModal(null);
      toast.success(`Updated stock on ${res.updated} ${plural(res.updated, 'product')}`);
      await load({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Could not update stock');
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteSelected() {
    setBulkBusy(true);
    const ids = selectedIds;
    try {
      const res = await callBulk({ action: 'delete', ids });
      setProducts((prev) => prev.filter((p) => !ids.includes(p._id)));
      discard(ids);
      setSelected(new Set());
      setModal(null);
      toast.success(`Deleted ${res.deleted} ${plural(res.deleted, 'product')}`);
    } catch (err) {
      toast.error(err.message || 'Could not delete products');
    } finally {
      setBulkBusy(false);
    }
  }

  function renderCard(p) {
    return (
      <ProductCard
        key={p._id}
        product={p}
        open={!!expanded[p._id]}
        onToggle={() => setExpanded((prev) => ({ ...prev, [p._id]: !prev[p._id] }))}
        selected={selected.has(p._id)}
        onSelect={() => toggleOne(p._id)}
        edits={edits}
        dirtyEntries={dirty.byProduct[p._id] || []}
        saving={savingIds.includes(p._id)}
        onQty={setQty}
        onSave={() => saveProducts([p._id])}
        onDiscard={() => discard([p._id])}
      />
    );
  }

  const barsVisible = (selectedIds.length > 0 ? 1 : 0) + (dirty.count > 0 ? 1 : 0);
  const unsavedInSelection = selectedIds.filter((id) => dirty.byProduct[id]?.length).length;

  /* ------------------------------ render ------------------------------ */

  return (
    <div className={barsVisible === 2 ? 'pb-44' : barsVisible === 1 ? 'pb-28' : ''}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-magenta">Inventory</h1>
          <p className="mt-1 text-sm text-brand-ink/60">
            Update stock by size. Products with no stock are hidden from the shop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ silent: true })}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-ink/10 bg-white px-3 py-2 text-sm font-medium text-brand-ink/70 transition-colors hover:border-brand-magenta/40 hover:text-brand-magenta disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error && products.length === 0 ? (
        <div className="card-soft flex flex-col items-center px-6 py-14 text-center">
          <AlertTriangle className="text-brand-magenta" size={28} />
          <p className="mt-3 font-medium">Couldn't load inventory</p>
          <p className="mt-1 text-sm text-brand-ink/60">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-magenta"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards double as status filters */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatFilter
              label="All products"
              count={cardCounts.all}
              hint="With sizes to track"
              dot="bg-brand-ink/40"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <StatFilter
              label="In stock"
              count={cardCounts.in}
              hint="Visible in the shop"
              dot="bg-emerald-500"
              active={filter === 'in'}
              onClick={() => setFilter('in')}
            />
            <StatFilter
              label="Low stock"
              count={cardCounts.low}
              hint={`${LOW_STOCK} or fewer in a size`}
              dot="bg-amber-500"
              active={filter === 'low'}
              onClick={() => setFilter('low')}
            />
            <StatFilter
              label="Out of stock"
              count={cardCounts.out}
              hint="Hidden from the shop"
              dot="bg-red-500"
              active={filter === 'out'}
              onClick={() => setFilter('out')}
            />
          </div>

          <div className="mt-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
            {/* Category navigation (desktop) */}
            <aside className="hidden lg:block">
              <div className="lg:sticky lg:top-4">
                <CategoryNav items={navItems} total={navTotal} active={activeCat} onChange={setCat} />
              </div>
            </aside>

            <div className="min-w-0">
              {/* Category select (mobile) */}
              <div className="mb-3 lg:hidden">
                <label htmlFor="category-select" className="sr-only">
                  Category
                </label>
                <select
                  id="category-select"
                  value={activeCat}
                  onChange={(e) => setCat(e.target.value)}
                  className="w-full rounded-lg border border-brand-ink/10 bg-white px-3 py-2 text-sm focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
                >
                  <option value="all">All categories ({navTotal})</option>
                  {navItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by product, category, color or SKU"
                    aria-label="Search inventory"
                    className="w-full rounded-lg border border-brand-ink/10 bg-white py-2 pl-9 pr-9 text-sm placeholder:text-brand-ink/40 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-ink/40 hover:text-brand-ink/70"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort products"
                    className="rounded-lg border border-brand-ink/10 bg-white px-3 py-2 text-sm focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
                  >
                    <option value="name">Name A–Z</option>
                    <option value="stock">Lowest stock first</option>
                  </select>
                  <button
                    type="button"
                    onClick={toggleAll}
                    disabled={pageIds.length === 0}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-ink/10 bg-white px-3 py-2 text-sm font-medium text-brand-ink/70 hover:border-brand-magenta/40 hover:text-brand-magenta disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                  >
                    <ChevronDown size={15} className={`transition-transform ${allOpen ? 'rotate-180' : ''}`} />
                    {allOpen ? 'Collapse all' : 'Expand all'}
                  </button>
                </div>
              </div>

              {filter === 'out' && list.length > 0 && (
                <p className="mt-4 flex items-center gap-2 text-sm text-brand-ink/60">
                  <EyeOff size={15} />
                  These products are hidden from the shop. Add stock to any size and save to show them again.
                </p>
              )}

              {/* List header: select page + range */}
              {list.length > 0 && (
                <div ref={listRef} className="mt-5 scroll-mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink/70">
                      <Checkbox
                        checked={pageAllSelected}
                        indeterminate={pageSomeSelected}
                        onChange={() => setMany(pageIds, !pageAllSelected)}
                        label="Select all products on this page"
                      />
                      Select this page
                    </label>
                    <p className="text-sm text-brand-ink/50">
                      Showing {start + 1}–{start + pageItems.length} of {list.length}
                    </p>
                  </div>

                  {pageAllSelected && list.length > pageItems.length && selectedIds.length < list.length && (
                    <p className="mt-2 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-ink/70">
                      All {pageItems.length} products on this page are selected.{' '}
                      <button
                        type="button"
                        onClick={() => setMany(list.map((p) => p._id), true)}
                        className="font-semibold text-brand-magenta hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                      >
                        Select all {list.length} in this view
                      </button>
                    </p>
                  )}
                </div>
              )}

              {/* Products, grouped by category */}
              {groups.map((g) => {
                const stat = catStats[g.cat.id];
                const selCount = stat.ids.filter((id) => selected.has(id)).length;
                const allSel = selCount === stat.ids.length;
                return (
                  <section key={g.cat.id} className="mt-6" aria-label={g.cat.label}>
                    <div className="mb-3 flex items-center gap-3">
                      <Checkbox
                        checked={allSel}
                        indeterminate={selCount > 0}
                        onChange={() => setMany(stat.ids, !allSel)}
                        label={`Select all ${stat.ids.length} products in ${g.cat.label}`}
                      />
                      <h2 className="text-base font-semibold">{g.cat.label}</h2>
                      <span className="text-sm text-brand-ink/50">
                        {stat.ids.length} {plural(stat.ids.length, 'product')}
                        {stat.out > 0 ? `, ${stat.out} out of stock` : ''}
                      </span>
                      {selCount > 0 && (
                        <span className="ml-auto text-xs font-medium text-brand-magenta">
                          {selCount} selected
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">{g.items.map(renderCard)}</div>
                  </section>
                );
              })}

              {list.length === 0 && (
                <div className="card-soft mt-8 flex flex-col items-center px-6 py-14 text-center">
                  <Package className="text-brand-ink/30" size={30} />
                  <p className="mt-3 font-medium">
                    {tracked.length === 0 ? 'No products with sizes yet' : 'No products match'}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink/60">
                    {tracked.length === 0
                      ? 'Add sizes to a product and it will show up here.'
                      : 'Try a different search, category or filter.'}
                  </p>
                  {tracked.length > 0 && (query || filter !== 'all' || activeCat !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                        setCat('all');
                      }}
                      className="mt-4 rounded-lg border border-brand-ink/10 px-4 py-2 text-sm font-medium text-brand-magenta hover:bg-brand-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                    >
                      Clear search and filters
                    </button>
                  )}
                </div>
              )}

              {totalPages > 1 && <Pager page={safePage} totalPages={totalPages} onChange={goToPage} />}
            </div>
          </div>
        </>
      )}

      {/* Floating bars: selection actions + unsaved changes */}
      {barsVisible > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex flex-col gap-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-ink px-4 py-3 text-white shadow-xl sm:min-w-[460px]">
              <p className="text-sm">
                <span className="font-semibold">{selectedIds.length} selected</span>
                <span className="text-white/70">
                  {' '}
                  in {selectedCatCount} {plural(selectedCatCount, 'category', 'categories')}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setModal('share')}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Share2 size={14} />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => setModal('stock')}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Pencil size={14} />
                  Edit stock
                </button>
                <button
                  type="button"
                  onClick={() => setModal('delete')}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          )}

          {dirty.count > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-ink/10 bg-white px-4 py-3 shadow-xl sm:min-w-[460px]">
              <p className="text-sm">
                <span className="font-semibold">
                  {dirty.count} unsaved {plural(dirty.count, 'change')}
                </span>
                <span className="text-brand-ink/60">
                  {' '}
                  in {Object.keys(dirty.byProduct).length}{' '}
                  {plural(Object.keys(dirty.byProduct).length, 'product')}
                </span>
                {dirty.invalid > 0 && (
                  <span className="block text-xs font-medium text-red-600">
                    Enter a whole number, 0 or more, in every highlighted size.
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEdits({})}
                  disabled={anySaving}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-ink/70 hover:bg-brand-cream disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => saveProducts(Object.keys(dirty.byProduct))}
                  disabled={anySaving || dirty.invalid > 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-magenta"
                >
                  {anySaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save all changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal === 'stock' && (
        <BulkStockModal
          products={selectedProducts}
          unsavedCount={unsavedInSelection}
          busy={bulkBusy}
          onClose={() => setModal(null)}
          onApply={applyBulkStock}
        />
      )}
      {modal === 'delete' && (
        <BulkDeleteModal
          products={selectedProducts}
          busy={bulkBusy}
          onClose={() => setModal(null)}
          onConfirm={deleteSelected}
        />
      )}
      {modal === 'share' && (
        <ShareModal products={selectedProducts} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

/* ---------------------------- sub-components ---------------------------- */

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-brand-ink/30 accent-brand-magenta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
    />
  );
}

function StatFilter({ label, count, hint, dot, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta ${
        active
          ? 'border-brand-magenta bg-brand-magenta/5'
          : 'border-brand-ink/10 bg-white hover:border-brand-magenta/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm text-brand-ink/70">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="mt-1 block font-display text-3xl font-bold tabular-nums">{count}</span>
      <span className="mt-0.5 block text-xs text-brand-ink/50">{hint}</span>
    </button>
  );
}

function CategoryNav({ items, total, active, onChange }) {
  const row = (id, label, count) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      aria-current={active === id ? 'true' : undefined}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta ${
        active === id
          ? 'bg-brand-magenta/10 font-semibold text-brand-magenta'
          : 'text-brand-ink/70 hover:bg-brand-cream'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs tabular-nums text-brand-ink/50">{count}</span>
    </button>
  );

  return (
    <nav aria-label="Categories" className="card-soft max-h-[70vh] overflow-y-auto p-2">
      <p className="px-3 pb-1 pt-2 text-sm font-semibold">Categories</p>
      {row('all', 'All categories', total)}
      {items.map((c) => row(c.id, c.label, c.count))}
    </nav>
  );
}

function Pager({ page, totalPages, onChange }) {
  const nums = getPageNumbers(page, totalPages);
  const btn =
    'grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta';
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`${btn} text-brand-ink/70 hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <ChevronLeft size={16} />
      </button>
      {nums.map((n, i) =>
        n === '...' ? (
          <span key={`gap-${i}`} className="px-1 text-brand-ink/40">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${btn} ${
              n === page ? 'bg-brand-magenta text-white' : 'text-brand-ink/70 hover:bg-brand-cream'
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={`${btn} text-brand-ink/70 hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Thumb({ product }) {
  const [failed, setFailed] = useState(false);
  const src = getThumb(product);

  if (!src || failed) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-cream font-display text-lg font-bold text-brand-magenta">
        {(product.name || '?').charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-lg bg-brand-cream object-cover"
    />
  );
}

function ProductCard({
  product,
  open,
  onToggle,
  selected,
  onSelect,
  edits,
  dirtyEntries,
  saving,
  onQty,
  onSave,
  onDiscard,
}) {
  const status = statusOf(product);
  const variants = product.variants || [];
  const invalid = dirtyEntries.some((e) => !isValidQty(e.raw));
  const panelId = `panel-${product._id}`;

  return (
    <div className={`card-soft overflow-hidden ${selected ? 'ring-2 ring-brand-magenta/50' : ''}`}>
      <div className="flex items-center">
        <div className="pl-4">
          <Checkbox checked={selected} onChange={onSelect} label={`Select ${product.name}`} />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left transition-colors hover:bg-brand-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-magenta"
        >
          <Thumb product={product} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{product.name}</p>
            <p className="text-xs text-brand-ink/50">
              {variants.length} {plural(variants.length, 'color')}, {sizeCount(product)}{' '}
              {plural(sizeCount(product), 'size')}
            </p>
          </div>
          {dirtyEntries.length > 0 && (
            <span className="hidden text-xs font-medium text-brand-magenta sm:inline">
              {dirtyEntries.length} unsaved
            </span>
          )}
          <div className="hidden text-right sm:block">
            <p className="font-semibold tabular-nums">{totalStock(product)}</p>
            <p className="text-xs text-brand-ink/50">units</p>
          </div>
          <StatusPill status={status} />
          <ChevronDown
            size={18}
            className={`shrink-0 text-brand-ink/40 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && (
        <div id={panelId} className="space-y-5 border-t border-brand-ink/10 px-4 pb-4 pt-4">
          {variants.map((v) => (
            <div key={v._id}>
              <h3 className="mb-2 text-sm font-semibold">
                {v.color || 'Default'}{' '}
                <span className="font-normal text-brand-ink/50">
                  {variantStock(v)} {plural(variantStock(v), 'unit')}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
                {(v.sizes || []).map((s) => {
                  const key = keyOf(product._id, v._id, s.size);
                  return (
                    <SizeCell
                      key={key}
                      size={s.size}
                      sku={s.sku}
                      saved={Number(s.stock) || 0}
                      value={edits[key] !== undefined ? edits[key] : String(Number(s.stock) || 0)}
                      label={`${product.name}, ${v.color || 'default'}, size ${s.size}, stock`}
                      disabled={saving}
                      onChange={(val) => onQty(key, val)}
                      onEnter={onSave}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {dirtyEntries.length > 0 && (
            <div className="flex items-center justify-end gap-2 border-t border-brand-ink/10 pt-3">
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-ink/70 hover:bg-brand-cream disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || invalid}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-magenta"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save {dirtyEntries.length} {plural(dirtyEntries.length, 'change')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SizeCell({ size, sku, saved, value, label, disabled, onChange, onEnter }) {
  const valid = isValidQty(value);
  const n = valid ? Number(value) : null;
  const edited = String(value) !== String(saved);

  const tone = !valid ? 'invalid' : n === 0 ? 'out' : n <= LOW_STOCK ? 'low' : 'ok';
  const toneCls = {
    invalid: 'border-red-400 bg-red-50',
    out: 'border-red-200 bg-red-50/60',
    low: 'border-amber-200 bg-amber-50/60',
    ok: 'border-brand-ink/10 bg-white',
  }[tone];
  const toneLabel = { invalid: 'Enter a number', out: 'Out', low: 'Low', ok: '' }[tone];
  const toneText = { invalid: 'text-red-600', out: 'text-red-600', low: 'text-amber-700', ok: '' }[tone];

  const step = (delta) => onChange(String(Math.max(0, (Number(value) || 0) + delta)));

  return (
    <div
      className={`rounded-xl border p-3 transition-shadow ${toneCls} ${
        edited ? 'ring-2 ring-brand-magenta/40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{size}</span>
        {toneLabel && <span className={`text-xs font-medium ${toneText}`}>{toneLabel}</span>}
      </div>
      <p className="mt-0.5 h-4 truncate text-[11px] text-brand-ink/50" title={sku || undefined}>
        {sku || 'No SKU'}
      </p>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || !valid || n === 0}
          aria-label={`Decrease ${label}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-ink/10 bg-white text-brand-ink/70 hover:border-brand-magenta/40 hover:text-brand-magenta disabled:opacity-30 disabled:hover:border-brand-ink/10 disabled:hover:text-brand-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
        >
          <Minus size={14} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-invalid={!valid}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEnter();
          }}
          onFocus={(e) => e.target.select()}
          className="h-8 w-full min-w-0 rounded-lg border border-brand-ink/10 bg-white text-center text-sm font-semibold tabular-nums focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled}
          aria-label={`Increase ${label}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-ink/10 bg-white text-brand-ink/70 hover:border-brand-magenta/40 hover:text-brand-magenta disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
        >
          <Plus size={14} />
        </button>
      </div>

      {edited && <p className="mt-1.5 text-[11px] text-brand-magenta">Was {saved}</p>}
    </div>
  );
}

/* -------------------------------- modals -------------------------------- */

function Modal({ title, onClose, busy, children, footer }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-brand-magenta">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-brand-ink/40 hover:text-brand-ink/70 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

const BULK_MODES = [
  { id: 'set', label: 'Set every size to', needsValue: true },
  { id: 'add', label: 'Add to every size', needsValue: true },
  { id: 'subtract', label: 'Subtract from every size', needsValue: true },
  { id: 'zero', label: 'Mark as out of stock', needsValue: false },
];

function BulkStockModal({ products, unsavedCount, busy, onClose, onApply }) {
  const [mode, setMode] = useState('set');
  const [value, setValue] = useState('10');

  const current = BULK_MODES.find((m) => m.id === mode);
  const numeric = current.needsValue ? Number(value) : 0;
  const valid = !current.needsValue || (isValidQty(value) && numeric <= MAX_QTY);
  const preview = valid ? previewBulk(products, mode, numeric) : null;

  return (
    <Modal
      title="Edit stock"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand-ink/70 hover:bg-brand-cream disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(mode, numeric)}
            disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Apply to {products.length} {plural(products.length, 'product')}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-brand-ink/60">
        Changes every size of every color on the {products.length} selected {plural(products.length, 'product')}.
      </p>

      <div className="space-y-2" role="radiogroup" aria-label="Stock change">
        {BULK_MODES.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              mode === m.id ? 'border-brand-magenta bg-brand-magenta/5' : 'border-brand-ink/10 hover:border-brand-magenta/40'
            }`}
          >
            <input
              type="radio"
              name="bulk-mode"
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              className="accent-brand-magenta"
            />
            <span className="flex-1">{m.label}</span>
            {m.id === mode && m.needsValue && (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
                aria-label="Quantity"
                className="h-8 w-20 rounded-lg border border-brand-ink/10 bg-white text-center text-sm font-semibold tabular-nums focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
              />
            )}
          </label>
        ))}
      </div>

      {!valid && <p className="mt-3 text-sm font-medium text-red-600">Enter a whole number, 0 or more.</p>}

      {preview && (
        <div className="mt-4 space-y-1 rounded-xl bg-brand-cream px-3 py-3 text-sm text-brand-ink/80">
          <p>
            This will update {preview.sizes} {plural(preview.sizes, 'size')} across {products.length}{' '}
            {plural(products.length, 'product')}.
          </p>
          {preview.hidden > 0 && (
            <p className="font-medium text-red-600">
              {preview.hidden} {plural(preview.hidden, 'product')} will become out of stock and be hidden from the
              shop.
            </p>
          )}
          {preview.restored > 0 && (
            <p className="font-medium text-emerald-700">
              {preview.restored} {plural(preview.restored, 'product')} will be back in the shop.
            </p>
          )}
          {unsavedCount > 0 && (
            <p className="text-brand-ink/60">
              Unsaved edits on {unsavedCount} of these {plural(unsavedCount, 'product')} will be discarded.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function BulkDeleteModal({ products, busy, onClose, onConfirm }) {
  const [text, setText] = useState('');
  const needsTyping = products.length >= 10;
  const canDelete = !needsTyping || text.trim() === 'DELETE';

  const byCat = {};
  products.forEach((p) => {
    byCat[p._cat.label] = (byCat[p._cat.label] || 0) + 1;
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  return (
    <Modal
      title={`Delete ${products.length} ${plural(products.length, 'product')}?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand-ink/70 hover:bg-brand-cream disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !canDelete}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete {products.length} {plural(products.length, 'product')}
          </button>
        </>
      }
    >
      <p className="text-sm text-brand-ink/70">
        These products will be removed permanently and can't be restored. To hide a product without deleting it,
        set its stock to 0 instead.
      </p>

      <div className="mt-4 rounded-xl bg-brand-cream px-3 py-3 text-sm">
        <ul className="space-y-1">
          {catRows.slice(0, 4).map(([label, n]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span className="truncate">{label}</span>
              <span className="tabular-nums text-brand-ink/60">
                {n} {plural(n, 'product')}
              </span>
            </li>
          ))}
          {catRows.length > 4 && (
            <li className="text-brand-ink/60">
              and {catRows.length - 4} more {plural(catRows.length - 4, 'category', 'categories')}
            </li>
          )}
        </ul>
        <p className="mt-3 truncate text-xs text-brand-ink/60">
          {products
            .slice(0, 3)
            .map((p) => p.name)
            .join(', ')}
          {products.length > 3 ? ` and ${products.length - 3} more` : ''}
        </p>
      </div>

      {needsTyping && (
        <div className="mt-4">
          <label htmlFor="delete-confirm" className="mb-1 block text-sm font-medium">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
      )}
    </Modal>
  );
}

// Shares the selected products (image + name + description, NEVER price) as one
// combined message. Prefers the native share sheet (images + text together, with
// WhatsApp selectable as the target); falls back to a text-only WhatsApp link plus
// a manual "Download images" option when the share sheet or image fetch isn't
// available.
function ShareModal({ products, onClose }) {
  const [message, setMessage] = useState(() => buildDefaultShareMessage(products));
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const nativeShareSupported = typeof navigator !== 'undefined' && !!navigator.share;
  const hasImages = products.some((p) => getThumb(p));

  async function handleShareClick() {
    setSharing(true);
    try {
      if (nativeShareSupported) {
        const files = hasImages ? await collectShareImageFiles(products) : [];
        const canShareFiles = files.length > 0 && navigator.canShare && navigator.canShare({ files });
        try {
          await navigator.share(canShareFiles ? { text: message, files } : { text: message });
          onClose();
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return; // admin cancelled the share sheet — not an error
          // otherwise fall through to the WhatsApp link fallback below
        }
      }

      // Fallback: WhatsApp's click-to-chat link only carries text, never images.
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      if (hasImages) {
        toast('WhatsApp links can\'t carry images — use "Download images" below and attach them manually.', {
          duration: 6000,
        });
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleDownloadClick() {
    setDownloading(true);
    try {
      await downloadProductImages(products);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      title={`Share ${products.length} ${plural(products.length, 'product')}`}
      onClose={onClose}
      busy={sharing || downloading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={sharing || downloading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand-ink/70 hover:bg-brand-cream disabled:opacity-50"
          >
            Close
          </button>
          {hasImages && (
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={sharing || downloading}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-ink/10 px-3 py-2 text-sm font-medium text-brand-ink/70 hover:border-brand-magenta/40 hover:text-brand-magenta disabled:opacity-50"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Download images
            </button>
          )}
          <button
            type="button"
            onClick={handleShareClick}
            disabled={sharing || downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-magenta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
            Share via WhatsApp
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-brand-ink/60">
        {nativeShareSupported
          ? 'Opens your share sheet with the images and message below — pick WhatsApp there. Price is never included.'
          : "This browser can't attach images to WhatsApp automatically. WhatsApp opens with the message below — download the images and attach them yourself."}
      </p>

      {hasImages && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {products.map((p) => (
            <div key={p._id} className="flex w-20 shrink-0 flex-col items-center gap-1">
              <Thumb product={p} />
              <p className="w-full truncate text-center text-[11px] text-brand-ink/60">{p.name}</p>
            </div>
          ))}
        </div>
      )}

      <label htmlFor="share-message" className="mb-1 block text-sm font-medium">
        Message
      </label>
      <textarea
        id="share-message"
        rows={8}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
      />
      <p className="mt-1 text-xs text-brand-ink/50">
        Edit freely — this is exactly what gets shared. Price is never included.
      </p>
    </Modal>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading inventory">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-brand-cream" />
        ))}
      </div>
      <div className="mt-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <div className="hidden h-72 animate-pulse rounded-2xl bg-brand-cream lg:block" />
        <div>
          <div className="h-10 animate-pulse rounded-lg bg-brand-cream" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[80px] animate-pulse rounded-2xl bg-brand-cream" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}