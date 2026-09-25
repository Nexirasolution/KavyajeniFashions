'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UploadCloud } from 'lucide-react';
import { formatINR } from '@/lib/utils';

const PAGE_SIZE = 100;

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
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

    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

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
        setPage((p) => p - 1);
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
          setPage((p) => p - 1);
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

  const pageIds = products.map((p) => p._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Products</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkRemove}
              disabled={bulkDeleting}
              className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50"
            >
              <Trash2 size={16} />
              {bulkDeleting ? 'Deleting…' : `Delete (${selected.size})`}
            </button>
          )}
          <Link href="/admin/products/bulk" className="btn-outline flex items-center gap-1 text-sm">
            <UploadCloud size={16} /> Bulk Upload
          </Link>
          <Link href="/admin/products/new" className="btn-primary flex items-center gap-1 text-sm"><Plus size={16} /> Add Product</Link>
        </div>
      </div>

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : (
        <div className="card-soft overflow-x-auto">
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
                <tr key={p._id} className="border-b border-brand-ink/5">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p._id)}
                      onChange={() => toggleOne(p._id)}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-brand-ink/60">{p.category?.name}</td>
                  <td className="p-3">{formatINR(p.basePrice)}</td>
                  <td className="p-3">{p.variants?.length}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.isActive ? 'bg-brand-green/15 text-brand-deepgreen' : 'bg-brand-ink/10 text-brand-ink/50'}`}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="p-3 flex gap-2 justify-end">
                    <Link href={`/admin/products/${p._id}/edit`} className="p-1.5 text-brand-magenta"><Pencil size={16} /></Link>
                    <button onClick={() => remove(p._id)} className="p-1.5 text-brand-magenta"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="text-center text-brand-ink/40 py-10">No products yet. Add your first product!</p>}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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