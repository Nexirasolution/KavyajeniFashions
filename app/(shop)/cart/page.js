'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useCart, cartKey } from '@/components/CartContext';
import { formatINR } from '@/lib/utils';
import { Trash2, ShoppingBag, Loader2 } from 'lucide-react';

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal, validateStock } = useCart();
  const [checkingStock, setCheckingStock] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCheckingStock(true);
      const data = await validateStock();
      if (cancelled) return;
      if (!data.allOk) {
        data.results
          .filter((r) => !r.ok)
          .forEach((r) => {
            toast.error(
              r.available <= 0
                ? `Removed from cart: ${r.reason}`
                : `Quantity adjusted: ${r.reason}`
            );
          });
      }
      setCheckingStock(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && !checkingStock) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={48} className="mx-auto text-brand-pink/40 mb-4" />
        <p className="text-brand-ink/60 mb-4">Your cart is empty.</p>
        <Link href="/" className="btn-primary">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-6 flex items-center gap-2">
        Your Cart
        {checkingStock && <Loader2 size={18} className="animate-spin text-brand-ink/40" />}
      </h1>

      <div className="space-y-4">
        {items.map((item) => {
          const key = cartKey(item);
          return (
            <div key={key} className="flex gap-4 card-soft p-4">
              <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-brand-cream shrink-0">
                <Image src={item.image || '/placeholder.png'} alt={item.name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-brand-ink">{item.name}</p>
                <p className="text-xs text-brand-ink/60">Color: {item.color} | Size: {item.size}</p>
                <p className="font-semibold text-brand-magenta mt-1">{formatINR(item.price)}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-brand-ink/15 rounded-full">
                    <button onClick={() => updateQty(key, item.qty - 1)} className="px-2.5 py-1">-</button>
                    <span className="px-2 text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(key, item.qty + 1)} className="px-2.5 py-1">+</button>
                  </div>
                  <button onClick={() => removeItem(key)} className="text-brand-ink/40 hover:text-brand-magenta">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-brand-ink">{formatINR(item.price * item.qty)}</p>
            </div>
          );
        })}
      </div>

      <div className="card-soft p-5 mt-6 flex items-center justify-between">
        <span className="text-brand-ink/70">Subtotal</span>
        <span className="font-bold text-xl text-brand-magenta">{formatINR(subtotal)}</span>
      </div>

      <Link href="/checkout" className="btn-primary w-full text-center block mt-4">
        Proceed to Checkout
      </Link>
    </div>
  );
}