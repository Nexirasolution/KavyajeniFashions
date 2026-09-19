import { notFound } from 'next/navigation';
import ProductPageClient from './ProductPageClient';

// Regenerate at most once an hour per product; admin edits invalidate
// this early via revalidateTag('product-<slug>') in the API route.
// This is the fix for Cache Writes/DB-load: the old version fetched
// client-side in useEffect, which never touches Next's Data Cache and
// hits Mongo on every single page view.
export const revalidate = 3600;

async function getProduct(slug) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const res = await fetch(`${base}/api/products/${slug}`, {
    next: { revalidate: 3600, tags: [`product-${slug}`] },
  });

  if (!res.ok) return null;
  return res.json();
}

// Optional but recommended: pre-render known product slugs at build
// time so first visits are served from the cache immediately rather
// than triggering an on-demand render + Mongo hit.
// export async function generateStaticParams() {
//   const products = await Product.find({ isActive: true }).select('slug').lean();
//   return products.map((p) => ({ slug: p.slug }));
// }

export default async function ProductPage({ params }) {
  const data = await getProduct(params.slug);

  if (!data?.product) {
    notFound();
  }

  return <ProductPageClient data={data} />;
}