'use client';

import { useEffect, useState } from 'react';
import { Tag, Truck } from 'lucide-react';

// ⚠️ Set this to the URL of your settings GET route (the one that returns { settings }).
const SETTINGS_URL = '/api/settings';

// freeShippingAbove lives on the default rule. 0 means "never free".
function getFreeShippingThreshold(settings) {
  const value = Number(settings?.defaultRule?.freeShippingAbove);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function CouponMarquee() {
  const [coupons, setCoupons] = useState([]);
  const [freeShippingMin, setFreeShippingMin] = useState(null);

  useEffect(() => {
    fetch('/api/coupons?active=true')
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons || []))
      .catch(() => {});

    fetch(SETTINGS_URL)
      .then((r) => r.json())
      .then((d) => setFreeShippingMin(getFreeShippingThreshold(d.settings)))
      .catch(() => {});
  }, []);

  // Only show the free shipping message when settings define a threshold.
  const freeShippingItem = freeShippingMin
    ? [{ type: 'freeshipping', minOrderValue: freeShippingMin }]
    : [];

  const allItems = [...coupons, ...freeShippingItem];

  if (!allItems.length) return null;

  // Duplicate for seamless loop
  const items = [...allItems, ...allItems];

  return (
    <div className="bg-brand-magenta text-white py-2 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((c, i) =>
          c.type === 'freeshipping' ? (
            <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs font-semibold">
              <Truck size={11} className="shrink-0" />
              FREE SHIPPING on orders above ₹{c.minOrderValue}
            </span>
          ) : (
            <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs font-semibold">
              <Tag size={11} className="shrink-0" />
              Use <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold tracking-wider">{c.code}</span>
              — {c.type === 'percent' ? `${c.value}% OFF` : `₹${c.value} OFF`}
              {c.minOrderValue > 0 && <span className="text-white/70"> on orders above ₹{c.minOrderValue}</span>}
            </span>
          )
        )}
      </div>
    </div>
  );
}