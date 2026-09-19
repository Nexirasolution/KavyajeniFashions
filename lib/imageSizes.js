// Single source of truth for the `sizes` prop passed to every <Image>.
// Keeping this identical across components means Vercel's Image
// Optimization pipeline sees one canonical breakpoint set instead of
// several near-duplicate strings, which multiplies cached variants.
//
// In this app most images are already resized + compressed to WebP at
// upload time (see app/api/upload/route.js) and served with
// `unoptimized`, so these strings mainly matter for layout /
// responsive `<img>` sizing rather than triggering server-side
// re-encoding — but keep them consistent anyway.

export const CARD_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
export const PDP_SIZES = '(max-width: 640px) 100vw, 50vw';
export const THUMB_SIZES = '80px';