'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BannerCarousel({ banners }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners?.length) return;
    const t = setInterval(() => setInterval((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners]);

  if (!banners?.length) return null;

  return (
    <section className="relative w-full overflow-hidden bg-brand-cream">
      {/*
        1900×800 = 42.1% ratio
        Mobile: use the exact same ratio so the full image fits with no crop
        The image will be narrower on phone but fully visible
      */}
      <div className="relative w-full pb-[42.1%]">

        {banners.map((b, i) => (
          <div
            key={b._id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* object-contain on mobile = full image visible, no crop
                object-cover  on sm+    = fills the landscape viewport edge to edge */}
            <img
              src={b.image}
              alt={b.title || 'Banner'}
              className="absolute inset-0 w-full h-full object-contain sm:object-cover object-center"
            />

            {(b.title || b.subtitle || b.link) && (
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent flex flex-col justify-center px-5 sm:px-12 lg:px-20">
                {b.title && (
                  <h2 className="text-white font-display font-bold drop-shadow-md
                    text-base leading-snug max-w-[80%]
                    sm:text-3xl sm:max-w-sm
                    lg:text-4xl lg:max-w-md">
                    {b.title}
                  </h2>
                )}
                {b.subtitle && (
                  <p className="text-white/90 drop-shadow mt-1 sm:mt-2
                    text-[11px] leading-relaxed max-w-[75%]
                    sm:text-sm sm:max-w-xs
                    lg:text-base lg:max-w-sm">
                    {b.subtitle}
                  </p>
                )}
                {b.link && (
                  <Link
                    href={b.link}
                    className="mt-2 sm:mt-4 w-fit bg-white text-brand-magenta font-bold rounded-full shadow-lg
                      hover:bg-brand-magenta hover:text-white transition-colors
                      text-[10px] px-3 py-1.5 sm:text-sm sm:px-5 sm:py-2.5"
                  >
                    {b.buttonText || 'Shop Now'}
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}

        {banners.length > 1 && (
          <>
            <button
              onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white p-1.5 sm:p-2 rounded-full shadow transition z-10"
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % banners.length)}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white p-1.5 sm:p-2 rounded-full shadow transition z-10"
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>

            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`rounded-full transition-all ${
                    i === index
                      ? 'w-4 sm:w-5 h-1.5 sm:h-2 bg-white'
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/50'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}