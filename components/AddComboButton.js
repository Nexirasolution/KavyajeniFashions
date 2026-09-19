'use client';

import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Zap } from 'lucide-react';

export default function AddComboButton({ combo }) {
  const { addItem } = useCart();
  const router = useRouter();

  const item = {
    productId: combo._id,
    variantId: 'combo',
    comboId: combo._id,
    name: combo.name,
    image: combo.image,
    color: '-',
    size: 'Combo',
    price: combo.comboPrice,
    qty: 1,
  };

  function handleAddToCart() {
    addItem(item);
  }

  function handleBuyNow() {
    addItem(item);
    router.push('/checkout');
  }

  return (
    <div className="flex flex-col gap-3 mt-6">
      <button
        onClick={handleBuyNow}
        className="w-full flex items-center justify-center gap-2 bg-brand-magenta hover:bg-brand-magenta/90 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-magenta/30"
      >
        <Zap size={18} fill="white" />
        Buy Now
      </button>
      <button
        onClick={handleAddToCart}
        className="w-full flex items-center justify-center gap-2 border-2 border-brand-magenta text-brand-magenta font-semibold py-3 rounded-xl hover:bg-brand-magenta/5 active:scale-95 transition-all"
      >
        <ShoppingBag size={17} />
        Add to Cart
      </button>
    </div>
  );
}