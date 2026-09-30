'use client';

// Location: components/ImageLightbox.js
//
// <ZoomableImage>  a thumbnail you can click. Opens the image in a centered modal.
// <ImageLightbox>  the modal itself (use it directly if you manage the open state yourself).
//
// Zoom: + / - buttons, mouse wheel, double-click (or double-tap), pinch on touch screens.
// Pan:  drag the image while zoomed in.
// Close: X button, click on the dark background, or press Esc.
// Keyboard: "+" zoom in, "-" zoom out, "0" reset.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const BUTTON_STEP = 0.5;
const DOUBLE_CLICK_SCALE = 2.5;

const clamp = (v) => Math.min(Math.max(v, MIN_SCALE), MAX_SCALE);

export function ImageLightbox({ src, alt = '', onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const [failed, setFailed] = useState(false);

  // Refs hold the latest values so pointer/keyboard handlers never see stale state
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const drag = useRef(null);
  const downInfo = useRef(null);

  function applyPos(p) {
    posRef.current = p;
    setPos(p);
  }

  function applyScale(next) {
    const v = clamp(next);
    scaleRef.current = v;
    setScale(v);
    if (v === MIN_SCALE) applyPos({ x: 0, y: 0 }); // centered again when fully zoomed out
  }

  const zoomIn = () => applyScale(scaleRef.current + BUTTON_STEP);
  const zoomOut = () => applyScale(scaleRef.current - BUTTON_STEP);
  const reset = () => applyScale(1);

  // Keyboard. Registered in the capture phase and stopped, so pressing Esc closes only
  // the lightbox and not a modal that is open underneath it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        applyScale(scaleRef.current + BUTTON_STEP);
      } else if (e.key === '-' || e.key === '_') {
        applyScale(scaleRef.current - BUTTON_STEP);
      } else if (e.key === '0') {
        applyScale(1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Stop the page behind from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onWheel(e) {
    applyScale(scaleRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: scaleRef.current };
      drag.current = null;
      downInfo.current = null;
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, px: posRef.current.x, py: posRef.current.y };
      // Remember whether the press started on the dark background (not on the image)
      downInfo.current = { onBackdrop: e.target === e.currentTarget, x: e.clientX, y: e.clientY };
    }
    setGesturing(true);
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      applyScale(pinch.current.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
    } else if (drag.current && scaleRef.current > 1) {
      applyPos({
        x: drag.current.px + (e.clientX - drag.current.x),
        y: drag.current.py + (e.clientY - drag.current.y),
      });
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    pinch.current = null;

    const rest = [...pointers.current.values()];
    if (rest.length === 1) {
      drag.current = { x: rest[0].x, y: rest[0].y, px: posRef.current.x, py: posRef.current.y };
    } else {
      drag.current = null;
    }

    // A quick tap on the dark background closes the lightbox
    const info = downInfo.current;
    if (
      rest.length === 0 &&
      info?.onBackdrop &&
      e.type === 'pointerup' &&
      Math.hypot(e.clientX - info.x, e.clientY - info.y) < 6
    ) {
      downInfo.current = null;
      onClose();
      return;
    }

    if (rest.length === 0) {
      downInfo.current = null;
      setGesturing(false);
    }
  }

  function onDoubleClick() {
    if (scaleRef.current > 1) applyScale(1);
    else applyScale(DOUBLE_CLICK_SCALE);
  }

  const percent = Math.round(scale * 100);
  const pill = 'rounded-full bg-black/60 text-white backdrop-blur';
  const ctrl =
    'grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/80" role="dialog" aria-modal="true" aria-label={alt || 'Image preview'}>
      {/* Stage: the image is centered; drag, wheel and pinch happen here */}
      <div
        className="absolute inset-0 grid touch-none select-none place-items-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {failed ? (
          <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white">This image could not be loaded.</p>
        ) : (
          <img
            src={src}
            alt={alt}
            draggable={false}
            onError={() => setFailed(true)}
            onDoubleClick={onDoubleClick}
            className="max-w-[92vw] rounded-lg object-contain shadow-2xl"
            style={{
              maxHeight: '78dvh',
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`,
              transition: gesturing ? 'none' : 'transform 150ms ease-out',
              cursor: scale > 1 ? (gesturing ? 'grabbing' : 'grab') : 'zoom-in',
              willChange: 'transform',
            }}
          />
        )}
      </div>

      {/* Top bar: name + close */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className={`pointer-events-auto max-w-[70%] truncate px-3 py-2 text-sm ${pill} ${alt ? '' : 'invisible'}`}>
          {alt || 'Image'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className={`pointer-events-auto grid h-10 w-10 shrink-0 place-items-center ${pill} hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
        >
          <X size={18} />
        </button>
      </div>

      {/* Bottom controls: zoom out / level / zoom in / reset */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className={`pointer-events-auto flex items-center gap-1 p-1 ${pill}`}>
          <button type="button" onClick={zoomOut} disabled={scale <= MIN_SCALE} aria-label="Zoom out" className={ctrl}>
            <Minus size={18} />
          </button>
          <span className="w-14 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {percent}%
          </span>
          <button type="button" onClick={zoomIn} disabled={scale >= MAX_SCALE} aria-label="Zoom in" className={ctrl}>
            <Plus size={18} />
          </button>
          <button type="button" onClick={reset} disabled={scale === MIN_SCALE} aria-label="Reset zoom" className={ctrl}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// A clickable image. Clicking it opens the lightbox in the center of the screen.
// `className` styles the <img> (size, rounding, object-fit). Clicks never reach
// parent click handlers, so it is safe inside rows and cards.
export function ZoomableImage({ src, alt = '', className = '', onError }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={alt ? `View larger image: ${alt}` : 'View larger image'}
        className="shrink-0 cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
      >
        <img src={src} alt={alt} loading="lazy" onError={onError} className={className} />
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export default ZoomableImage;