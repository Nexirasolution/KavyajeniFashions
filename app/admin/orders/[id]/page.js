'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatINR } from '@/lib/utils';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [courier, setCourier] = useState({ partner: '', trackingId: '', awbNumber: '' });

  async function load() {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data.order);
    setCourier(data.order?.courier || { partner: '', trackingId: '', awbNumber: '' });
  }
  useEffect(() => { load(); }, [id]);

  async function updateStatus(status) {
    const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast.success('Status updated'); load(); }
  }

  async function saveCourier() {
    const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courier }) });
    if (res.ok) { toast.success('Courier details saved'); load(); }
  }

  if (!order) return <p className="text-brand-ink/50">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Order {order.orderNumber}</h1>
      <p className="text-sm text-brand-ink/50 mb-5">{new Date(order.createdAt).toLocaleString('en-IN')}</p>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Items</h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm py-2 border-b last:border-b-0 border-brand-ink/5">
            <img
              src={item.image || '/placeholder-product.png'}
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover border border-brand-ink/10 flex-shrink-0"
              onError={(e) => { e.currentTarget.src = '/placeholder-product.png'; }}
            />
            <div className="flex-1 flex justify-between">
              <span>{item.name} ({item.color}/{item.size}) x{item.qty}</span>
              <span>{formatINR(item.price * item.qty)}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between font-bold mt-2 border-t pt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Customer & Shipping</h2>
        <p className="text-sm">{order.customer?.name} — {order.customer?.phone}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Order Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${order.status === s ? 'bg-brand-pink text-white border-brand-pink' : 'border-brand-ink/15 text-brand-ink/70'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Courier Details</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <input placeholder="Courier partner" className="border rounded-lg px-3 py-2 text-sm" value={courier.partner} onChange={(e) => setCourier({ ...courier, partner: e.target.value })} />
          <input placeholder="AWB / Tracking number" className="border rounded-lg px-3 py-2 text-sm" value={courier.awbNumber} onChange={(e) => setCourier({ ...courier, awbNumber: e.target.value })} />
          <input placeholder="Tracking link/ID" className="border rounded-lg px-3 py-2 text-sm" value={courier.trackingId} onChange={(e) => setCourier({ ...courier, trackingId: e.target.value })} />
        </div>
        <button onClick={saveCourier} className="btn-outline text-sm">Save Courier Info</button>
      </div>

      <div className="flex gap-3">
        <Link href={`/invoice/${order._id}`} target="_blank" className="btn-outline text-sm">View Invoice</Link>
        <Link href={`/courier-bill/${order._id}`} target="_blank" className="btn-outline text-sm">Print Shipping Label</Link>
      </div>
    </div>
  );
}