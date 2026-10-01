// app/page.js
import { unstable_cache } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Combo from '@/models/Combo';
import Category from '@/models/Category';
import { inStockFilter } from '@/lib/stockFilter';
import '@/models/Reel'; // (reels section is disabled, so we no longer query it)
import BannerCarousel from '@/components/BannerCarousel';
import ProductTabs from '@/components/ProductCarousel';
import ReviewSection from '@/components/ReviewSection';

import Link from 'next/link';
import Image from 'next/image';
import { formatINR } from '@/lib/utils';
import { Zap, ArrowRight, Tag } from 'lucide-react';

// ISR: cached HTML is served to everyone; Mongo is hit at most once per
// window, or immediately when an admin route calls revalidateTag().
export const revalidate = 300; // 5 minutes

// Single-combo pages live at /combo/[slug]. The "view all" page was linked as
// both /combos and /combo before — set this to whichever route really exists.
const COMBOS_HREF = '/combo';

// Product cards don't need long descriptions — dropping them shrinks both the
// Mongo response and the HTML/RSC payload sent to every visitor.
const PRODUCT_FIELDS = '-description -__v';

// Products per page in the "All Products" tab. This page-1 batch is cached with the
// homepage; keep it at 100 so it matches /api/products (MAX_LIMIT = 100).
const ALL_PRODUCTS_LIMIT = 100;

const getData = unstable_cache(
  async () => {
    await dbConnect();
    const [
      banners,
      bestSellers,
      topSellers,
      activeSellers,
      allProducts,
      allTotal,
      reviews,
      combos,
      categories,
    ] = await Promise.all([
      Banner.find({ isActive: true }).sort({ sortOrder: 1 }).select('-__v').lean(),
      Product.find({ isActive: true, isBestSeller: true, ...inStockFilter() }).select(PRODUCT_FIELDS).limit(12).lean(),
      Product.find({ isActive: true, isTopSeller: true, ...inStockFilter() }).select(PRODUCT_FIELDS).limit(12).lean(),
      Product.find({ isActive: true, isActiveSeller: true, ...inStockFilter() }).select(PRODUCT_FIELDS).sort({ createdAt: -1 }).limit(12).lean(),
      // Page 1 of the "All Products" tab (later pages load from /api/products)
      Product.find({ isActive: true, ...inStockFilter() }).select(PRODUCT_FIELDS).sort({ createdAt: -1 }).limit(ALL_PRODUCTS_LIMIT).lean(),
      // Total in-stock products, so the tab knows how many pages there are
      Product.countDocuments({ isActive: true, ...inStockFilter() }),
      Review.find({ isApproved: true, isFeatured: true }).populate('product', 'name').limit(10).lean(),
      Combo.find({ isActive: true }).limit(6).lean(),
      // Top-level categories only; subcategories show on the category page.
      Category.find({ isActive: true, parent: null }).sort({ sortOrder: 1, name: 1 }).limit(10).lean(),
    ]);

    return JSON.parse(JSON.stringify({
      banners, bestSellers, topSellers, activeSellers, allProducts, allTotal, reviews, combos, categories,
    }));
  },
  // Cache key bumped (v3) so the old cached data without `allProducts` is not reused
  ['homepage-data-v3'],
  { revalidate: 300, tags: ['homepage', 'banners', 'product-list', 'combos', 'categories', 'reviews'] }
);

export default async function HomePage() {
  const {
    banners,
    bestSellers,
    topSellers,
    activeSellers,
    allProducts,
    allTotal,
    reviews,
    combos,
    categories,
  } = await getData();

  return (
    <div className="overflow-x-hidden">

      {/* Banner — first slide should be priority inside BannerCarousel (LCP) */}
      <BannerCarousel banners={banners} />

      {/* Shop by Category */}
      {categories?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pt-8 pb-2">
          <h2 className="font-display text-xl font-bold text-brand-ink mb-4 text-center">Shop by Category</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 justify-center flex-wrap sm:flex-nowrap">
            {categories.map((c) => (
              <Link key={c._id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 shrink-0 group">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-brand-cream border-2 border-transparent group-hover:border-brand-magenta transition-all shadow-sm">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="80px"
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  )}
                </div>
                <span className="text-[11px] font-medium text-brand-ink/60 group-hover:text-brand-magenta transition-colors text-center max-w-[72px] leading-tight">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Product tabs — All Products / Bestsellers / Top Sellers / New Arrivals */}
      <ProductTabs
        allProducts={allProducts}
        allTotal={allTotal}
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
              <Link href={COMBOS_HREF} className="hidden sm:flex items-center gap-1 text-sm text-brand-magenta font-semibold hover:gap-2 transition-all mt-2">
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
                    className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className={`relative w-full overflow-hidden bg-brand-cream ${isFeatured ? 'aspect-[4/5]' : 'aspect-square'}`}>
                      {c.image && (
                        <Image
                          src={c.image}
                          alt={c.name}
                          fill
                          sizes="(min-width: 640px) 33vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      {pct > 0 && (
                        <div className="absolute top-2 left-2 z-10 bg-brand-magenta text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={9} /> {pct}% OFF
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>

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
              <Link href={COMBOS_HREF} className="text-sm text-brand-magenta font-semibold">View all combos →</Link>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <ReviewSection reviews={reviews} />
    </div>
  );
}