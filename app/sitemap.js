import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';

export default async function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lakshmibala.in';
  let products = [];
  let categories = [];
  try {
    await dbConnect();
    products = await Product.find({ isActive: true }).select('slug updatedAt').lean();
    categories = await Category.find({ isActive: true }).select('slug updatedAt').lean();
  } catch {}

  const staticRoutes = ['', '/cart', '/checkout'].map((p) => ({
    url: `${siteUrl}${p}`,
    lastModified: new Date()
  }));

  const productRoutes = products.map((p) => ({
    url: `${siteUrl}/product/${p.slug}`,
    lastModified: p.updatedAt || new Date()
  }));

  const categoryRoutes = categories.map((c) => ({
    url: `${siteUrl}/category/${c.slug}`,
    lastModified: c.updatedAt || new Date()
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
