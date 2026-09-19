'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/products?limit=200');
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function editKey(productId, variantId, size) { return `${productId}-${variantId}-${size}`; }

  function setStock(productId, variantId, size, value) {
    setEdits((e) => ({ ...e, [editKey(productId, variantId, size)]: value }));
  }

  async function saveRow(product, variant, sizeObj) {
    const key = editKey(product._id, variant._id, sizeObj.size);
    const newStock = edits[key];
    if (newStock === undefined) return;

    const updatedVariants = product.variants.map((v) =>
      v._id === variant._id
        ? { ...v, sizes: v.sizes.map((s) => (s.size === sizeObj.size ? { ...s, stock: Number(newStock) } : s)) }
        : v
    );
    const res = await fetch(`/api/products/${product._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants: updatedVariants })
    });
    if (res.ok) {
      toast.success('Stock updated');
      load();
    } else toast.error('Failed to update stock');
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Inventory</h1>
      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : (
        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                <th className="p-3">Product</th>
                <th className="p-3">Color</th>
                <th className="p-3">Size</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Stock</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.flatMap((p) =>
                p.variants.flatMap((v) =>
                  v.sizes.map((s) => {
                    const key = editKey(p._id, v._id, s.size);
                    const value = edits[key] !== undefined ? edits[key] : s.stock;
                    return (
                      <tr key={key} className="border-b border-brand-ink/5">
                        <td className="p-3">{p.name}</td>
                        <td className="p-3">{v.color}</td>
                        <td className="p-3">{s.size}</td>
                        <td className="p-3 text-xs text-brand-ink/50">{s.sku || '—'}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            className={`w-20 border rounded-lg px-2 py-1 text-sm ${value <= 5 ? 'border-brand-magenta text-brand-magenta' : ''}`}
                            value={value}
                            onChange={(e) => setStock(p._id, v._id, s.size, e.target.value)}
                          />
                        </td>
                        <td className="p-3">
                          <button onClick={() => saveRow(p, v, s)} className="text-brand-magenta"><Save size={16} /></button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
