'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Instagram, ShoppingBag, X, Volume2, VolumeX } from 'lucide-react';

const CARD_WIDTH = 130; // px — small reel card width
const MODAL_WIDTH = 280; // px — player box width

export default function ReelsSection({ reels }) {
  const [activeReel, setActiveReel] = useState(null);
  const [muted, setMuted] = useState(true);

  if (!reels?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-5">
        <p className="text-xs font-bold text-brand-magenta uppercase tracking-widest mb-1">Watch & Shop</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">Shop by Reels</h2>

        <a href="https://instagram.com/Lakshmibala_Clothing_Store"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-magenta font-semibold hover:underline mt-1"
        >
          <Instagram size={15} /> Follow us
        </a>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {reels.map((reel) => (
          <div
            key={reel._id}
            onClick={() => setActiveReel(reel)}
            className="relative rounded-2xl overflow-hidden shrink-0 group shadow-md cursor-pointer bg-brand-cream"
            style={{ width: CARD_WIDTH, aspectRatio: '9 / 16', flexShrink: 0 }}
          >
            {reel.videoUrl ? (
              <video
                src={reel.videoUrl}
                poster={reel.thumbnail || undefined}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="group-hover:scale-105 transition-transform duration-500"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <img
                src={reel.thumbnail || '/placeholder.png'}
                alt={reel.title || 'Reel'}
                className="group-hover:scale-105 transition-transform duration-500"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20 pointer-events-none" />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play size={14} className="fill-brand-magenta text-brand-magenta ml-0.5" />
              </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 p-2">
              {reel.product?.name && (
                <p className="text-white text-[10px] font-medium line-clamp-1 mb-1">{reel.product.name}</p>
              )}
              {reel.product?.slug && (
                <Link
                  href={`/product/${reel.product.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-1 w-full bg-white text-brand-magenta text-[10px] font-bold py-1 rounded-lg hover:bg-brand-magenta hover:text-white transition-colors"
                >
                  <ShoppingBag size={10} /> Shop
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Small fixed-size player box */}
      {activeReel && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveReel(null)}
        >
          <div
            className="relative rounded-2xl overflow-hidden bg-black shadow-2xl"
            style={{ width: MODAL_WIDTH, aspectRatio: '9 / 16' }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={activeReel._id}
              src={activeReel.videoUrl}
              poster={activeReel.thumbnail}
              autoPlay
              loop
              muted={muted}
              playsInline
              controls={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            <button
              onClick={() => setActiveReel(null)}
              className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X size={15} />
            </button>

            <button
              onClick={() => setMuted((m) => !m)}
              className="absolute top-2.5 left-2.5 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
              {activeReel.product?.name && (
                <p className="text-white text-xs font-medium mb-1.5 line-clamp-1">{activeReel.product.name}</p>
              )}
              <div className="flex gap-1.5">
                {activeReel.product?.slug && (
                  <Link
                    href={`/product/${activeReel.product.slug}`}
                    className="flex-1 flex items-center justify-center gap-1 bg-white text-brand-magenta text-[11px] font-bold py-1.5 rounded-lg hover:bg-brand-magenta hover:text-white transition-colors"
                  >
                    <ShoppingBag size={11} /> Shop this
                  </Link>
                )}
                {activeReel.instagramLink && (
                  <a href={activeReel.instagramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 px-2.5 bg-white/10 text-white text-[11px] font-bold py-1.5 rounded-lg border border-white/30 hover:bg-white/20 transition-colors"
                  >
                    <Instagram size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}