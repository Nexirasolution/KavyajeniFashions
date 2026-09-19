'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Search results for "{q}"</h1>
      <p className="text-brand-ink/50 text-sm mb-6">{products.length} products found</p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-xl2 bg-brand-cream animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-brand-ink/50 py-10 text-center">No products matched your search.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 text-center text-brand-ink/50">Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}
