// app/product/[slug]/page.js
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Review from '@/models/Review';
import '@/models/Category'; // make sure the model is registered for populate()
import ProductPageClient from './ProductPageClient';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const revalidate = 3600;

// Query Mongo directly (no HTTP self-call to /api/products/[slug]).
// That removes a whole network hop + a second serverless invocation, and it
// also works during build (a relative fetch('') fails on the server).
// Admin edits still invalidate via revalidateTag(`product-${slug}`).
function getProductData(slug) {
  return unstable_cache(
    async () => {
      await dbConnect();

      const product = await Product.findOne({ slug, isActive: true })
        .populate('category', 'name slug sizes')
        .lean();
      if (!product) return null;

      const [reviews, related] = await Promise.all([
        Review.find({ product: product._id, isApproved: true })
          .sort({ createdAt: -1 })
          .limit(20)
          .select('rating comment customerName')
          .lean(),
        Product.find({
          category: product.category?._id,
          _id: { $ne: product._id },
          isActive: true,
        })
          .limit(8)
          // only the first variant is needed for a card -> much smaller payload
          .select({ name: 1, slug: 1, basePrice: 1, rating: 1, variants: { $slice: 1 } })
          .lean(),
      ]);

      return JSON.parse(JSON.stringify({ product, reviews, related }));
    },
    ['product-page', slug],
    { revalidate: 3600, tags: [`product-${slug}`, 'product-list'] }
  )();
}

export async function generateMetadata(props) {
  const params = await props.params;
  const data = await getProductData(params.slug);
  if (!data) return {};
  const { product } = data;
  const img = product.variants?.[0]?.images?.[0];
  return {
    title: product.name,
    description: product.description?.slice(0, 155),
    openGraph: { title: product.name, images: img ? [img] : [] },
  };
}

// Pre-render the newest products at build time -> first visit is instant.
export async function generateStaticParams() {
  try {
    await dbConnect();
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('slug')
      .lean();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export default async function ProductPage(props) {
  const params = await props.params;
  const data = await getProductData(params.slug);
  if (!data?.product) notFound();
  return <ProductPageClient data={data} />;
}