'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR } from '@/lib/utils';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

// Turns (paymentMethod, paymentStatus) into a short, readable label + color.
// A COD order's paymentStatus tracks the online-paid HANDLING FEE only —
// never the whole order — so it gets its own wording rather than reusing
// "Paid"/"Pending" as-is.
function paymentDisplay(order) {
  const { paymentMethod, paymentStatus } = order;

  if (paymentMethod === 'cod') {
    switch (paymentStatus) {
      case 'cod_fee_paid':
        return { label: 'COD · fee paid online', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'cod_fee_pending':
        return { label: 'COD · fee pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'failed':
        return { label: 'COD · fee payment failed', cls: 'bg-red-50 text-red-700 border-red-200' };
      case 'pending':
      default:
        // No online fee for this order — the whole amount is cash on delivery.
        return { label: 'COD', cls: 'bg-brand-ink/5 text-brand-ink/70 border-brand-ink/10' };
    }
  }

  switch (paymentStatus) {
    case 'paid':
      return { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'pending':
      return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'failed':
      return { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' };
    case 'refunded':
      return { label: 'Refunded', cls: 'bg-brand-ink/5 text-brand-ink/70 border-brand-ink/10' };
    default:
      return { label: paymentStatus || '—', cls: 'bg-brand-ink/5 text-brand-ink/70 border-brand-ink/10' };
  }
}

function PaymentBadge({ order }) {
  const { label, cls } = paymentDisplay(order);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await fetch(`/api/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [status]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Orders</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Search by order number, name, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="btn-outline text-sm">Search</button>
      </div>

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : (
        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                <th className="p-3">Order #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Total</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-b border-brand-ink/5">
                  <td className="p-3 font-medium">{o.orderNumber}</td>
                  <td className="p-3">{o.customer?.name}<br /><span className="text-xs text-brand-ink/50">{o.customer?.phone}</span></td>
                  <td className="p-3">{formatINR(o.total)}</td>
                  <td className="p-3"><PaymentBadge order={o} /></td>
                  <td className="p-3 capitalize">{o.status}</td>
                  <td className="p-3 text-xs text-brand-ink/50">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="p-3"><Link href={`/admin/orders/${o._id}`} className="text-brand-magenta font-medium">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="text-center text-brand-ink/40 py-10">No orders found.</p>}
        </div>
      )}
    </div>
  );
}