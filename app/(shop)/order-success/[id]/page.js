'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/utils';

export default function OrderSuccessPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => setOrder(d.order));
  }, [id]);

  if (!order) return <div className="max-w-xl mx-auto px-4 py-20 text-center text-brand-ink/50">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <CheckCircle2 size={56} className="mx-auto text-brand-green mb-4" />
      <h1 className="font-display text-2xl font-bold text-brand-magenta">Order Placed Successfully!</h1>
      <p className="text-brand-ink/60 mt-2">Order Number: <strong>{order.orderNumber}</strong></p>
      <p className="text-brand-ink/60">Total: <strong>{formatINR(order.total)}</strong></p>
      <p className="text-sm text-brand-ink/50 mt-1">We'll send updates to {order.customer?.phone}</p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href={`/invoice/${order._id}`} className="btn-outline">View Invoice</Link>
        <Link href="/" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
