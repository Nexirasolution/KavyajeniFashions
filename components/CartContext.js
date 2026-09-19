'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext(null);
const STORAGE_KEY = 'lb_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  // Read-only stock check — does NOT modify the cart. Used at checkout so we
  // can block submission and show the customer exactly what's wrong, letting
  // them decide whether to remove/adjust the item themselves.
  const checkStockOnly = useCallback(async () => {
    if (items.length === 0) return { allOk: true, results: [] };

    try {
      const res = await fetch('/api/products/check-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            size: i.size,
            qty: i.qty
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not verify stock');
        return { allOk: false, results: [] };
      }
      return data;
    } catch {
      toast.error('Could not verify stock. Please check your connection.');
      return { allOk: false, results: [] };
    }
  }, [items]);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId && i.size === item.size && i.comboId === item.comboId
      );
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].qty += item.qty;
        return copy;
      }
      return [...prev, item];
    });
    toast.success('Added to cart');
  }, []);

  const updateQty = useCallback((key, qty) => {
    setItems((prev) =>
      prev.map((i) => (cartKey(i) === key ? { ...i, qty: Math.max(1, qty) } : i))
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => cartKey(i) !== key));
    toast('Removed from cart', { icon: '🗑️' });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Checks current cart against live stock. Auto-clamps quantities down to
  // available stock and drops items that are completely unavailable.
  // Returns { allOk, results } so callers can show specific messaging.
  const validateStock = useCallback(async () => {
    if (items.length === 0) return { allOk: true, results: [] };

    let data;
    try {
      const res = await fetch('/api/products/check-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            size: i.size,
            qty: i.qty
          }))
        })
      });
      data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not verify stock');
        return { allOk: false, results: [] };
      }
    } catch {
      toast.error('Could not verify stock. Please check your connection.');
      return { allOk: false, results: [] };
    }

    if (!data.allOk) {
      setItems((prev) =>
        prev
          .map((item) => {
            const r = data.results.find(
              (x) =>
                x.productId === item.productId &&
                x.variantId === item.variantId &&
                x.size === item.size
            );
            if (!r) return item;
            if (r.available <= 0) return null; // drop unavailable items
            if (r.available < item.qty) return { ...item, qty: r.available }; // clamp
            return item;
          })
          .filter(Boolean)
      );
    }

    return data;
  }, [items]);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQty, removeItem, clearCart, subtotal, count, validateStock,checkStockOnly }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function cartKey(i) {
  return [i.productId, i.variantId, i.size, i.comboId].filter(Boolean).join('-');
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}