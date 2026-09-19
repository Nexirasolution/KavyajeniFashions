'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      toast.error(data.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream px-4">
      <form onSubmit={submit} className="card-soft p-8 w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-brand-magenta text-center mb-1">Kavyajeni Fashion Admin</h1>
        <p className="text-center text-sm text-brand-ink/50 mb-6">Kavyajeni Fashion</p>
        <input
          type="email"
          required
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2.5 text-sm mb-3"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2.5 text-sm mb-4"
        />
        <button disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
