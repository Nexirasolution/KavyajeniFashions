'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const { id } = useParams();
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    fetch(`/api/products/${id}`).then((r) => r.json()).then((d) => setInitial(d.product));
  }, [id]);

  if (!initial) return <p className="text-brand-ink/50">Loading product...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Edit Product</h1>
      <ProductForm initial={initial} productId={id} />
    </div>
  );
}
