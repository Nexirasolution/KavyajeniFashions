'use client';

import Image from 'next/image';
import { Star, Quote } from 'lucide-react';

export default function ReviewSection({ reviews }) {
  if (!reviews?.length) return null;
  return (
    <section className="bg-gradient-to-br from-brand-magenta/5 to-brand-pink/5 py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-brand-magenta uppercase tracking-widest mb-1">Real Customers</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">What they're saying</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {reviews.map((r) => (
            <div key={r._id} className="min-w-[240px] max-w-[260px] bg-white rounded-2xl p-4 shrink-0 shadow-sm border border-brand-ink/5">
              <Quote size={20} className="text-brand-magenta/30 mb-2" />
              <div className="flex items-center gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-brand-ink/15'} />
                ))}
              </div>
              <p className="text-sm text-brand-ink/75 line-clamp-4 leading-relaxed">{r.comment}</p>
              {r.images?.[0] && (
                <div className="relative w-full h-24 rounded-xl overflow-hidden mt-3">
                  <Image src={r.images[0]} alt="Review photo" fill className="object-cover" />
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-brand-ink/5">
                <p className="text-xs font-bold text-brand-magenta">— {r.customerName}</p>
                {r.product?.name && <p className="text-[11px] text-brand-ink/40 mt-0.5 line-clamp-1">{r.product.name}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}