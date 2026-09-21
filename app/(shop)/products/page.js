// Location: app/products/page.js

import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { inStockFilter } from '@/lib/stockFilter';
import '@/models/Category'; // registers the Category schema — required for .populate('category')

const LIMIT = 100;

async function getAllProducts(page) {
  await dbConnect();

  // Hide products whose stock is 0 across all variants/sizes
  const query = { isActive: true, ...inStockFilter() };

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug type')
      .sort({ createdAt: -1 })
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean(),
    Product.countDocuments(query),
  ]);

  return {
    products: JSON.parse(JSON.stringify(products)), // strip Mongoose/ObjectId wrappers for the client
    total,
    pages: Math.ceil(total / LIMIT),
  };
}

export const metadata = {
  title: 'All Products | Kavyajeni Fashions',
};

export default async function ProductsPage({ searchParams }) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const { products, total, pages } = await getAllProducts(page);

  return (
    <section className="max-w-6xl mx-auto px-5 py-16" style={{ background: '#FFF5F8' }}>
      <div className="mb-10 flex items-baseline justify-between flex-wrap gap-3">
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: '#8B1E4F',
            fontSize: 'clamp(28px, 4vw, 40px)',
            letterSpacing: '0.01em',
          }}
        >
          All Products
        </h1>
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            letterSpacing: '0.1em',
            color: '#C2478A',
          }}
        >
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>

      {products.length === 0 ? (
        <p style={{ color: '#C2478A', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
          Nothing here yet — check back soon.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-10">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>

          <Pagination currentPage={page} totalPages={pages} basePath="/products" />
        </>
      )}
    </section>
  );
}