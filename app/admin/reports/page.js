'use client';

import { useState } from 'react';
import { daysAgo } from '@/lib/utils';

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(toDateInput(daysAgo(30)));
  const [to, setTo] = useState(toDateInput(new Date()));

  function exportCsv(rangeFrom, rangeTo) {
    const params = new URLSearchParams({ from: rangeFrom, to: rangeTo });
    window.open(`/api/admin/reports/export?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Sales Reports</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <button onClick={() => exportCsv(toDateInput(daysAgo(0)), toDateInput(new Date()))} className="card-soft p-5 text-left hover:shadow-soft">
          <p className="font-semibold">Daily Report</p>
          <p className="text-xs text-brand-ink/50 mt-1">Today's sales as CSV</p>
        </button>
        <button onClick={() => exportCsv(toDateInput(daysAgo(7)), toDateInput(new Date()))} className="card-soft p-5 text-left hover:shadow-soft">
          <p className="font-semibold">Weekly Report</p>
          <p className="text-xs text-brand-ink/50 mt-1">Last 7 days as CSV</p>
        </button>
        <button onClick={() => exportCsv(toDateInput(daysAgo(30)), toDateInput(new Date()))} className="card-soft p-5 text-left hover:shadow-soft">
          <p className="font-semibold">Monthly Report</p>
          <p className="text-xs text-brand-ink/50 mt-1">Last 30 days as CSV</p>
        </button>
      </div>

      <div className="card-soft p-5">
        <h2 className="font-semibold mb-3">Custom Date Range Export</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-brand-ink/50">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm block" />
          </div>
          <div>
            <label className="text-xs text-brand-ink/50">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm block" />
          </div>
          <button onClick={() => exportCsv(from, to)} className="btn-primary">Export All Orders (CSV)</button>
        </div>
      </div>
    </div>
  );
}
