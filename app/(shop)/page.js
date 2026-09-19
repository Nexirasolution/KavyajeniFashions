import { unstable_cache } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Reel from '@/models/Reel';
import Combo from '@/models/Combo';
import Category from '@/models/Category';
import BannerCarousel from '@/components/BannerCarousel';
import ProductTabs from '@/components/ProductCarousel';
import ReviewSection from '@/components/ReviewSection';
import ReelsSection from '@/components/ReelsSection';

import Link from 'next/link';
import Image from 'next/image';
import { formatINR } from '@/lib/utils';
import { Zap, ArrowRight, Tag } from 'lucide-react';

// This page's content is the same for every visitor and only changes
// when an admin edits a banner/product/combo/category — so `force-dynamic`
// (a fresh Mongo hit on every single request) was the single biggest
// source of DB load and uncached compute on the whole site. Switching to
// ISR means Vercel serves the cached HTML to everyone and only re-runs
// getData() at most once per `revalidate` window, or immediately when an
// admin mutation calls revalidateTag() below.
export const revalidate = 300; // 5 minutes

// unstable_cache wraps the raw Mongoose calls (which aren't `fetch`, so
// they don't go through Next's Data Cache automatically) and gives us
// tags we can invalidate on demand from admin routes, e.g.:
//   revalidateTag('banners') after a banner is saved/toggled
//   revalidateTag('product-list') after a product is created/edited (already
//     wired up in app/api/products/[id]/route.js from the PDP fix)
//   revalidateTag('combos'), revalidateTag('categories') similarly
const getData = unstable_cache(
  async () => {
    await dbConnect();
    const [banners, bestSellers, topSellers, activeSellers, reviews, reels, combos, categories] = await Promise.all([
      Banner.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      Product.find({ isActive: true, isBestSeller: true }).limit(12).lean(),
      Product.find({ isActive: true, isTopSeller: true }).limit(12).lean(),
      Product.find({ isActive: true, isActiveSeller: true }).sort({ createdAt: -1 }).limit(12).lean(),
      Review.find({ isApproved: true, isFeatured: true }).populate('product', 'name').limit(10).lean(),
      Reel.find({ isActive: true }).sort({ sortOrder: 1 }).populate('product', 'name slug').limit(10).lean(),
      Combo.find({ isActive: true }).limit(6).lean(),
      // Only top-level categories on the homepage — subcategories show up after
      // clicking into their parent, on the category page itself.
      Category.find({ isActive: true, parent: null }).sort({ sortOrder: 1, name: 1 }).limit(10).lean(),
    ]);

    // Serialize here (once, inside the cached fn) instead of scattering
    // JSON.parse(JSON.stringify(...)) calls through the JSX below.
    return JSON.parse(JSON.stringify({
      banners, bestSellers, topSellers, activeSellers, reviews, reels, combos, categories,
    }));
  },
  ['homepage-data'],
  { revalidate: 300, tags: ['homepage', 'banners', 'product-list', 'combos', 'categories', 'reels', 'reviews'] }
);

export default async function HomePage() {
  const { banners, bestSellers, topSellers, activeSellers, reviews, reels, combos, categories } = await getData();

  return (
    <div className="overflow-x-hidden">

      {/* Coupon marquee */}
      

      {/* Banner */}
      <BannerCarousel banners={banners} />

      {/* Shop by Category — top-level categories only; a category with subcategories
          takes the shopper to a subcategory grid, one without goes straight to products */}
{categories?.length > 0 && (
  <section className="max-w-7xl mx-auto px-4 pt-8 pb-2">
    <h2 className="font-display text-xl font-bold text-brand-ink mb-4 text-center">Shop by Category</h2>
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 justify-center flex-wrap sm:flex-nowrap">
      {categories.map((c) => (
        <Link key={c._id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 shrink-0 group">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-brand-cream border-2 border-transparent group-hover:border-brand-magenta transition-all shadow-sm">
            {c.image
              ? <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              : <div className="w-full h-full bg-brand-cream" />
            }
          </div>
          <span className="text-[11px] font-medium text-brand-ink/60 group-hover:text-brand-magenta transition-colors text-center max-w-[72px] leading-tight">{c.name}</span>
        </Link>
      ))}
    </div>
  </section>
)}

      {/* Product tabs — Bestsellers / Top Sellers / New Arrivals */}
      <ProductTabs
        bestSellers={bestSellers}
        topSellers={topSellers}
        activeSellers={activeSellers}
      />

      {/* Combo Offers */}
{combos?.length > 0 && (
  <section className="py-10 bg-gradient-to-br from-brand-magenta/5 via-white to-brand-pink/5">
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap size={14} className="text-brand-magenta fill-brand-magenta" />
          <span className="text-xs font-bold text-brand-magenta uppercase tracking-widest">Save More</span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">Combo Offers</h2>
        <p className="text-brand-ink/50 text-sm mt-0.5">Buy together, save together</p>
        <Link href="/combos" className="hidden sm:flex items-center gap-1 text-sm text-brand-magenta font-semibold hover:gap-2 transition-all mt-2">
          View all <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
        {combos.map((c, idx) => {
          const savings = c.originalPrice > c.comboPrice ? c.originalPrice - c.comboPrice : 0;
          const pct = c.originalPrice > 0 ? Math.round((savings / c.originalPrice) * 100) : 0;
          const isFeatured = idx === 0;

          return (
            <Link
              key={c._id}
              href={`/combo/${c.slug}`}
              className={`group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${isFeatured ? 'sm:col-span-1 row-span-1' : ''}`}
            >
              {/* Image */}
              <div className={`relative w-full overflow-hidden bg-brand-cream ${isFeatured ? 'aspect-[4/5]' : 'aspect-square'}`}>
                {c.image && (
                  <img
                    src={c.image}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                {pct > 0 && (
                  <div className="absolute top-2 left-2 bg-brand-magenta text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag size={9} /> {pct}% OFF
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>

              {/* Info */}
              <div className="p-3 bg-white">
                <p className="text-sm font-semibold text-brand-ink line-clamp-1">{c.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-brand-magenta font-bold text-sm">{formatINR(c.comboPrice)}</span>
                  {savings > 0 && (
                    <span className="text-[11px] text-brand-ink/40 line-through">{formatINR(c.originalPrice)}</span>
                  )}
                </div>
                {savings > 0 && (
                  <p className="text-[11px] text-green-600 font-semibold mt-0.5">Save {formatINR(savings)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 text-center sm:hidden">
        <Link href="/combo" className="text-sm text-brand-magenta font-semibold">View all combos →</Link>
      </div>
    </div>
  </section>
)}

      {/* Reviews */}
      <ReviewSection reviews={reviews} />

      {/* Reels */}
      <ReelsSection reels={reels} />

    </div>
  );
}