'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatINR } from '@/lib/utils';
import { IndianRupee, ShoppingCart, Package, AlertTriangle } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card-soft p-4 flex items-center gap-3">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-brand-ink/50">{label}</p>
        <p className="font-bold text-lg text-brand-ink">{value}</p>
        {sub && <p className="text-xs text-brand-ink/40">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/dashboard').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-brand-ink/50">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={IndianRupee} label="Today's Sales" value={formatINR(data.today.sales)} sub={`${data.today.orders} orders`} color="bg-brand-pink" />
        <StatCard icon={IndianRupee} label="Weekly Sales" value={formatINR(data.week.sales)} sub={`${data.week.orders} orders`} color="bg-brand-magenta" />
        <StatCard icon={IndianRupee} label="Monthly Sales" value={formatINR(data.month.sales)} sub={`${data.month.orders} orders`} color="bg-brand-gold" />
        <StatCard icon={ShoppingCart} label="Pending Orders" value={data.pendingOrders} sub="Need action" color="bg-brand-green" />
      </div>

      <div className="card-soft p-5 mb-6">
        <h2 className="font-semibold mb-4">Sales Trend (Last 14 Days)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => formatINR(v)} />
            <Line type="monotone" dataKey="sales" stroke="#E91E8C" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card-soft p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Package size={18} /> Top Selling Products</h2>
          <ul className="space-y-2">
            {data.topProducts.map((p) => (
              <li key={p._id} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-brand-magenta font-medium">{p.soldCount} sold</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-soft p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-brand-gold" /> Low Stock Alert</h2>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-brand-ink/50">All good — no low stock items.</p>
          ) : (
            <ul className="space-y-2">
              {data.lowStock.map((p) => (
                <li key={p._id} className="text-sm">{p.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
