// Adds Cloudinary delivery transformations (auto format, auto quality, resize)
// to a stored secure_url. Direct browser uploads store the original file, so
// use this wherever you render product images.
//
// Usage:
//   <img src={optimized(product.variants[0].images[0], 600)} />
//
// Non-Cloudinary URLs (e.g. old R2 images) are returned unchanged.
export function optimized(url, width = 800) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  // Don't double-apply if a transformation is already present
  if (/\/upload\/(?:[a-z]_[^/]+,?)+\//.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}