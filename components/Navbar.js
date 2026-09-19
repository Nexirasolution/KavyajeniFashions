'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Menu, X, Heart, ClipboardList } from 'lucide-react';
import { useCart } from './CartContext';
import { useWishlist } from './WhishlistContext';
import CouponMarquee from './CouponMarquee';

export default function Navbar() {
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { count } = useCart();
  const { wishlist } = useWishlist();
  const wishlistCount = wishlist?.length || 0;

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  function onSearch(e) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <>
      {/* Coupon marquee — shows above the navbar, site-wide */}
      <CouponMarquee />

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-brand-pink/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <button className="md:hidden p-2 -ml-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                <Image src="/logo.png" alt="Kavyajeni Fashions" fill className="object-contain" />
              </div>
              <span className="font-display text-lg sm:text-xl font-bold text-brand-magenta hidden sm:block">
                Kavyajeni Fashions
              </span>
            </Link>

            <form onSubmit={onSearch} className="flex-1 max-w-lg hidden sm:flex items-center bg-brand-cream rounded-full px-4 py-2 border border-brand-pink/15">
              <Search size={18} className="text-brand-magenta/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nighties..."
                className="bg-transparent outline-none px-3 w-full text-sm"
              />
            </form>

            <div className="flex items-center gap-1 sm:gap-3">
              {/* Orders — desktop only, mobile uses BottomNav */}
              <Link href="/orders" className="hidden md:flex p-2" aria-label="My Orders">
                <ClipboardList size={22} className="text-brand-magenta" />
              </Link>

              {/* Wishlist — desktop only, mobile uses BottomNav */}
              <Link href="/wishlist" className="hidden md:flex relative p-2" aria-label="Wishlist">
                <Heart size={22} className="text-brand-magenta" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-pink text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart — visible on all screen sizes */}
              <Link href="/cart" className="relative p-2" aria-label="Cart">
                <ShoppingBag size={24} className="text-brand-magenta" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-pink text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <form onSubmit={onSearch} className="flex sm:hidden items-center bg-brand-cream rounded-full px-4 py-2 border border-brand-pink/15 mb-3">
            <Search size={18} className="text-brand-magenta/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nighties..."
              className="bg-transparent outline-none px-3 w-full text-sm"
            />
          </form>

          {/* <nav className="hidden md:flex items-center gap-6 pb-3 overflow-x-auto no-scrollbar">
            {categories.map((c) => (
              <Link key={c._id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-1.5 group shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand-pink/20 group-hover:border-brand-pink transition relative bg-brand-cream">
                  {c.image ? (
                    <Image src={c.image} alt={c.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-pink font-display font-bold">
                      {c.name?.[0]}
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-brand-ink/80 group-hover:text-brand-magenta">{c.name}</span>
              </Link>
            ))}
          </nav> */}

          {menuOpen && (
            <nav className="md:hidden flex flex-wrap gap-3 pb-4">
              {categories.map((c) => (
                <Link
                  key={c._id}
                  href={`/category/${c.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-2 rounded-full bg-brand-cream text-sm font-medium text-brand-ink border border-brand-pink/15"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}