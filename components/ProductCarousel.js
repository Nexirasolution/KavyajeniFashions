'use client';

// Location: components/ProductTabs.js (or ProductCarousel.js, whichever path app/page.js imports)
//
// "All Products" shows 100 products per page. Page 1 comes from the homepage
// (props); other pages are loaded on demand from /api/products?page=N&limit=100
// and remembered, so going back to a page is instant.

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import ProductCard from './ProductCard';

const PAGE_SIZE = 100; // matches DEFAULT_LIMIT / MAX_LIMIT in app/api/products/route.js

const TABS = [
  { key: 'all',  label: '🛍️ All Products' },
  { key: 'best', label: '⭐ Bestsellers' },
  { key: 'top',  label: '🔥 Top Sellers' },
  { key: 'new',  label: '✨ New Arrivals' }, // backed by `activeSellers`
];

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

export default function ProductTabs({
  allProducts = [],
  allTotal, // total number of active products (from app/page.js)
  bestSellers = [],
  topSellers = [],
  activeSellers = [],
}) {
  const [active, setActive] = useState('all');
  const [page, setPage] = useState(1);
  const [allPages, setAllPages] = useState({ 1: allProducts }); // { pageNumber: products[] }
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const topRef = useRef(null);

  const isAll = active === 'all';
  const smallLists = { best: bestSellers, top: topSellers, new: activeSellers };

  // How many products does the current tab have in total?
  const total = isAll ? (allTotal ?? allProducts.length) : (smallLists[active] || []).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  const pageItems = isAll
    ? allPages[safePage] || []
    : (smallLists[active] || []).slice(start, start + PAGE_SIZE);

  function changeTab(key) {
    setActive(key);
    setPage(1);
    setFailed(false);
  }

  async function goToPage(p) {
    const next = Math.min(Math.max(p, 1), totalPages);
    setFailed(false);

    if (isAll && !allPages[next]) {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?page=${next}&limit=${PAGE_SIZE}&sort=newest`);
        if (!res.ok) throw new Error('Request failed');
        const data = await res.json();
        setAllPages((prev) => ({ ...prev, [next]: data.products || [] }));
      } catch {
        setFailed(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setPage(next);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const btn =
    'grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta';

  return (
    <section ref={topRef} className="max-w-7xl mx-auto px-4 py-10 scroll-mt-4">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              className={`shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all border ${
                active === t.key
                  ? 'bg-brand-magenta text-white border-brand-magenta shadow-md shadow-brand-magenta/25'
                  : 'bg-white text-brand-ink/60 border-brand-ink/10 hover:border-brand-magenta/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {pageItems.length > 0 ? (
        <>
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 ${loading ? 'opacity-50' : ''}`}>
            {pageItems.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>

          {totalPages > 1 && (
            <>
              <nav
                className="mt-10 flex flex-wrap items-center justify-center gap-1"
                aria-label="Product pages"
              >
                <button
                  type="button"
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1 || loading}
                  aria-label="Previous page"
                  className={`${btn} text-brand-ink/70 hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers(safePage, totalPages).map((n, i) =>
                  n === '...' ? (
                    <span key={`gap-${i}`} className="px-1 text-brand-ink/40">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => goToPage(n)}
                      disabled={loading}
                      aria-current={n === safePage ? 'page' : undefined}
                      className={`${btn} ${
                        n === safePage
                          ? 'bg-brand-magenta text-white'
                          : 'text-brand-ink/70 hover:bg-brand-cream'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage === totalPages || loading}
                  aria-label="Next page"
                  className={`${btn} text-brand-ink/70 hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  <ChevronRight size={16} />
                </button>

                {loading && <Loader2 size={16} className="ml-2 animate-spin text-brand-magenta" />}
              </nav>

              <p className="mt-3 text-center text-xs text-brand-ink/50">
                Showing {start + 1}–{start + pageItems.length} of {total}
              </p>
            </>
          )}

          {failed && (
            <p className="mt-3 text-center text-sm text-red-600">
              Couldn't load that page. Check your connection and try again.
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-sm text-brand-ink/50 py-10">No products to show yet.</p>
      )}
    </section>
  );
}