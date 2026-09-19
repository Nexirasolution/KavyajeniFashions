'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Heart, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/CartContext';
import { useWishlist } from '@/components/WhishlistContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { wishlist } = useWishlist();

  const wishlistCount = wishlist?.length || 0;

  const items = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/orders', label: 'Orders', icon: ClipboardList },
    { href: '/wishlist', label: 'Wishlist', icon: Heart, badge: wishlistCount },
    { href: '/cart', label: 'Cart', icon: ShoppingBag, badge: cartCount },
  ];

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-ink/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between px-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative">
              <span className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? 'text-brand-magenta' : 'text-brand-ink/50'}
                  fill={active && label === 'Wishlist' ? 'currentColor' : 'none'}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-brand-magenta text-white text-[9px] font-bold leading-none rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-[3px]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-brand-magenta font-semibold' : 'text-brand-ink/50'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}