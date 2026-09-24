'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Star, ShoppingBag, Zap, Heart, Share2, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { PDP_SIZES, THUMB_SIZES } from '@/lib/imageSizes';
import { useCart } from '@/components/CartContext';
import ProductCard from '@/components/ProductCard';
import toast from 'react-hot-toast';

// Size-only selector (color removed — products no longer differentiate by color on the storefront).
// If a product happens to have more than one variant (e.g. from bulk upload groupings),
// this defaults to the first one; sizes shown come from the active variant.
function SizeSelector({ sizes, activeSize, onSizeChange }) {
  if (!sizes?.length) return null;
  return (
    <div>
      <p className="text-sm font-medium text-brand-ink/70 mb-2">Select Size</p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => {
          const outOfStock = s.stock <= 0;
          return (
            <button
              key={s.size}
              disabled={outOfStock}
              onClick={() => onSizeChange(s.size)}
              className={`min-w-11 h-11 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                activeSize === s.size
                  ? 'border-brand-magenta bg-brand-magenta text-white'
                  : outOfStock
                  ? 'border-brand-ink/10 text-brand-ink/25 cursor-not-allowed line-through'
                  : 'border-brand-ink/15 text-brand-ink/80 hover:border-brand-magenta'
              }`}
            >
              {s.size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// This component takes `data` (product/reviews/related) as a prop from
// the server component in page.js instead of fetching it itself in a
// useEffect. All interactive/client-only state (active image, size,
// qty, wishlist toggle) still lives here.
export default function ProductPageClient({ data }) {
  const router = useRouter();
  const { product, reviews, related } = data;

  const [activeVariant] = useState(product.variants?.[0]);
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState('');
  const [qty, setQty] = useState(1);
  const [wished, setWished] = useState(false);
  const { addItem } = useCart();

  const images = activeVariant?.images || [];
  const discount = activeVariant?.compareAtPrice > activeVariant?.price
    ? Math.round(((activeVariant.compareAtPrice - activeVariant.price) / activeVariant.compareAtPrice) * 100)
    : 0;

  function prevImage() { setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1)); }
  function nextImage() { setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1)); }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: product.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  }

  function handleAddToCart() {
    if (!activeSize) { toast.error('Please select a size'); return; }
    addItem({
      productId: product._id,
      variantId: activeVariant._id,
      comboId: null,
      name: product.name,
      image: activeVariant.images?.[0],
      size: activeSize,
      price: activeVariant.price,
      qty,
    });
    toast.success('Added to cart!');
  }

  function handleBuyNow() {
    if (!activeSize) { toast.error('Please select a size'); return; }
    addItem({
      productId: product._id,
      variantId: activeVariant._id,
      comboId: null,
      name: product.name,
      image: activeVariant.images?.[0],
      size: activeSize,
      price: activeVariant.price,
      qty,
    });
    router.push('/checkout');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
      <div className="grid sm:grid-cols-2 gap-6 sm:gap-10">

        {/* ── Images ── */}
        <div>
          {/* Main image */}
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-brand-cream shadow-sm">
            {images[activeImage] && (
              <Image
                src={images[activeImage]}
                alt={product.name}
                fill
                sizes={PDP_SIZES}
                unoptimized
                className="object-cover"
                priority
              />
            )}

            {/* Discount badge */}
            {discount > 0 && (
              <div className="absolute top-3 left-3 bg-brand-magenta text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {discount}% OFF
              </div>
            )}

            {/* Wish + Share */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              <button
                onClick={() => { setWished((w) => !w); toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist'); }}
                className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
              >
                <Heart size={17} className={wished ? 'fill-brand-magenta text-brand-magenta' : 'text-brand-ink/50'} />
              </button>
              <button
                onClick={handleShare}
                className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
              >
                <Share2 size={16} className="text-brand-ink/50" />
              </button>
            </div>

            {/* Prev / Next arrows */}
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow">
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Dot indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className={`rounded-full transition-all ${i === activeImage ? 'w-4 h-1.5 bg-brand-magenta' : 'w-1.5 h-1.5 bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`relative w-16 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === activeImage ? 'border-brand-magenta' : 'border-transparent opacity-60'}`}
                >
                  <Image src={img} alt="" fill sizes={THUMB_SIZES} unoptimized className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-brand-magenta uppercase tracking-widest">{product.category?.name}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-1 leading-tight">{product.name}</h1>

          {/* Rating */}
          {/* <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={i < Math.round(product.rating) ? 'fill-brand-gold text-brand-gold' : 'text-brand-ink/20'} />
              ))}
            </div>
            <span className="text-sm text-brand-ink/50">({product.reviewCount} reviews)</span>
          </div> */}

          {/* Price */}
          <div className="mt-4 bg-brand-cream rounded-xl p-4">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-brand-magenta">{formatINR(activeVariant?.price)}</span>
              {activeVariant?.compareAtPrice > activeVariant?.price && (
                <span className="text-brand-ink/40 line-through text-lg mb-0.5">{formatINR(activeVariant.compareAtPrice)}</span>
              )}
            </div>
            {discount > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <Tag size={12} className="text-green-600" />
                <p className="text-green-600 text-xs font-semibold">You save {formatINR(activeVariant.compareAtPrice - activeVariant.price)}!</p>
              </div>
            )}
          </div>

          {product.fabric && (
            <p className="text-sm text-brand-ink/60 mt-3">Fabric: <span className="font-medium text-brand-ink">{product.fabric}</span></p>
          )}

          {/* Size only — color selection removed */}
          <div className="mt-5">
            <SizeSelector
              sizes={activeVariant?.sizes}
              activeSize={activeSize}
              onSizeChange={setActiveSize}
            />
          </div>

          {/* Qty */}
          <div className="flex items-center gap-3 mt-5">
            <p className="text-sm font-medium text-brand-ink/70">Qty:</p>
            <div className="flex items-center border border-brand-ink/15 rounded-full">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center text-lg font-medium">−</button>
              <span className="w-8 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-9 h-9 flex items-center justify-center text-lg font-medium">+</button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={handleBuyNow}
              className="w-full flex items-center justify-center gap-2 bg-brand-magenta hover:bg-brand-magenta/90 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-magenta/25"
            >
              <Zap size={18} fill="white" /> Buy Now
            </button>
            <button
              onClick={handleAddToCart}
              className="w-full flex items-center justify-center gap-2 border-2 border-brand-magenta text-brand-magenta font-semibold py-3 rounded-xl hover:bg-brand-magenta/5 active:scale-95 transition-all"
            >
              <ShoppingBag size={17} /> Add to Cart
            </button>
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-6 text-sm text-brand-ink/70 leading-relaxed border-t pt-5">
              <h3 className="font-semibold text-brand-ink mb-2">Description</h3>
              <p>{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      {/* {reviews?.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold text-brand-ink mb-5">Customer Reviews</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r._id} className="card-soft p-4 rounded-xl">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className={i < r.rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-ink/20'} />
                  ))}
                </div>
                <p className="text-sm text-brand-ink/80 leading-relaxed">{r.comment}</p>
                <p className="text-xs font-semibold text-brand-magenta mt-3">— {r.customerName}</p>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Related */}
      {related?.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold text-brand-ink mb-5">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}