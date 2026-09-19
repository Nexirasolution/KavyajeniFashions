'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ListTree, ShoppingCart, Boxes, Image as ImageIcon,
  Clapperboard, Star, Ticket, Layers, FileBarChart, Settings as SettingsIcon, Menu, X, LogOut
} from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: ListTree },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  // { href: '/admin/combos', label: 'Combo Offers', icon: Layers },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  // { href: '/admin/reels', label: 'Shop by Reels', icon: Clapperboard },
  // { href: '/admin/reviews', label: 'Reviews', icon: Star },
  // { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  // { href: '/admin/reports', label: 'Sales Reports', icon: FileBarChart },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon }
];

export default function AdminShell({ admin, children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <div className="min-h-screen flex bg-brand-cream">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed lg:static z-50 inset-y-0 left-0 w-64 bg-white border-r border-brand-pink/10 transform transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pink/10">
          <span className="font-display text-lg font-bold text-brand-magenta">LB Admin</span>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-brand-pink text-white' : 'text-brand-ink/70 hover:bg-brand-cream'
                }`}
              >
                <Icon size={18} /> {label}
              </Link>
            );
          })}
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-ink/60 hover:bg-brand-cream w-full mt-4">
            <LogOut size={18} /> Logout
          </button>
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-brand-pink/10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span className="font-display font-bold text-brand-magenta">LB Admin</span>
        </header>
        <main className="p-4 sm:p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
