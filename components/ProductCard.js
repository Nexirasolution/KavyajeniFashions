'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, ShoppingBag, Zap } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { CARD_SIZES } from '@/lib/imageSizes';
import { useCart } from './CartContext';
import { useWishlist } from './WhishlistContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ProductCard({ product }) {
  const variant = product.variants?.[0];
  const image = variant?.images?.[0] || '/placeholder.png';
  const price = product.basePrice || variant?.price || 0;
  const compareAt = variant?.compareAtPrice || 0;
  const discountPct = compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const [adding, setAdding] = useState(false);
  const { addItem } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const wished = isWishlisted(product._id);
  const router = useRouter();

  const totalStock = variant?.sizes?.reduce((s, sz) => s + (sz.stock || 0), 0);
  const lowStock = typeof totalStock === 'number' && totalStock > 0 && totalStock <= 5;

  function buildItem() {
    return {
      productId: product._id,
      variantId: variant?._id,
      comboId: null,
      name: product.name,
      image,
      color: variant?.color || '-',
      size: variant?.sizes?.[0]?.size || 'Free Size',
      price,
      qty: 1,
    };
  }

  function handleAddToCart(e) {
    e.preventDefault();
    setAdding(true);
    addItem(buildItem());
    toast.success('Added to cart!');
    setTimeout(() => setAdding(false), 800);
  }

  function handleBuyNow(e) {
    e.preventDefault();
    addItem(buildItem());
    router.push('/checkout');
  }

  function handleWish(e) {
    e.preventDefault();
    toggleWishlist(product._id);
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist');
  }

  return (
    <div className="group block rounded-xl sm:rounded-2xl overflow-hidden bg-white border border-brand-ink/8 hover:shadow-md hover:border-brand-ink/15 transition-all">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image container */}
        <div className="relative aspect-[3/4] overflow-hidden bg-brand-cream">
          <Image
            src={image}
            alt={product.name}
            fill
            sizes={CARD_SIZES}
            // Product images are pre-resized + WebP-encoded at upload
            // time and served from R2 with immutable cache headers, so
            // there's nothing for Vercel's optimizer to add here — this
            // keeps card-grid renders (the highest-traffic image usage
            // on the site) off the Image Optimization bill.
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-1">
            {discountPct > 0 && (
              <span className="bg-brand-magenta text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                {discountPct}% OFF
              </span>
            )}
            {product.isBestSeller && (
              <span className="bg-amber-400 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                ⭐ <span className="hidden sm:inline">BESTSELLER</span><span className="sm:hidden">BEST</span>
              </span>
            )}
            {/* {lowStock && (
              <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                Only {totalStock} left
              </span>
            )} */}
          </div>

          {/* Wishlist — always visible, critical for mobile (no hover state) */}
          <button
            onClick={handleWish}
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-7 h-7 sm:w-8 sm:h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"
            aria-label="Toggle wishlist"
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-[15px] sm:h-[15px] ${
                wished ? 'fill-brand-magenta text-brand-magenta' : 'text-brand-ink/50'
              }`}
            />
          </button>
        </div>

        {/* Info */}
        <div className="pt-2 px-2 sm:pt-2.5 sm:px-2.5">
          <p className="text-xs sm:text-sm font-medium text-brand-ink line-clamp-1">{product.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-2.5 h-2.5 sm:w-[11px] sm:h-[11px] fill-amber-400 text-amber-400" />
            <span className="text-[10px] sm:text-[11px] text-brand-ink/50">{product.rating || 'New'}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
            <span className="font-extrabold text-brand-magenta text-sm sm:text-base">{formatINR(price)}</span>
            {compareAt > price && (
              <>
                <span className="text-[11px] sm:text-[12px] text-brand-ink/35 line-through">
                  {formatINR(compareAt)}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-green-600">
                  {discountPct}% off
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* CTAs — always visible, no hover dependency */}
      <div className="px-2 pb-2 pt-1.5 sm:px-2.5 sm:pb-2.5 sm:pt-2 flex gap-1 sm:gap-1.5">
        <button
          onClick={handleAddToCart}
          className="flex-1 flex items-center justify-center gap-1 border border-brand-magenta text-brand-magenta text-[10px] sm:text-[11px] font-bold py-1.5 sm:py-2 rounded-lg sm:rounded-xl active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span className="truncate">{adding ? 'Added!' : <><span className="sm:hidden">Cart</span><span className="hidden sm:inline">Add to Cart</span></>}</span>
        </button>
        <button
          onClick={handleBuyNow}
          className="flex-1 flex items-center justify-center gap-1 bg-brand-magenta text-white text-[10px] sm:text-[11px] font-bold py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm active:scale-95 transition-transform"
        >
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" fill="white" />
          <span className="truncate">Buy Now</span>
        </button>
      </div>
    </div>
  );
}