'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/components/WhishlistContext';
import ProductCard from '@/components/ProductCard';

export default function WishlistPage() {
  const { wishlist } = useWishlist();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchProducts() {
      if (!wishlist?.length) {
        if (active) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/products/by-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: wishlist })
        });
        const data = await res.json();
        if (active) setProducts(data.products || []);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProducts();
    return () => {
      active = false;
    };
  }, [wishlist]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-[60vh]">
      <h1 className="font-display text-2xl font-bold text-brand-ink mb-1">My Wishlist</h1>
      <p className="text-brand-ink/50 text-sm mb-6">
        {products.length > 0
          ? `${products.length} item${products.length > 1 ? 's' : ''} saved`
          : 'Items you save will show up here'}
      </p>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-brand-cream animate-pulse" />
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="text-center py-16 text-brand-ink/40">
          <Heart size={36} className="mx-auto mb-2" />
          <p className="text-sm mb-4">Your wishlist is empty</p>
          <Link
            href="/"
            className="inline-block bg-brand-magenta text-white font-semibold text-sm px-5 py-2.5 rounded-full"
          >
            Start Shopping
          </Link>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}