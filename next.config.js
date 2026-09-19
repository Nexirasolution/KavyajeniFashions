/** @type {import('next').NextConfig} */

// Derive the R2 hostname from the public URL env var so we don't
// hardcode it and it stays correct across environments.
let r2Hostname = null;
try {
  r2Hostname = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
} catch {
  r2Hostname = null;
}

const nextConfig = {
  images: {
    remotePatterns: r2Hostname
      ? [{ protocol: 'https', hostname: r2Hostname }]
      : [],

    // Product images are resized + re-encoded to WebP once, at upload
    // time (see app/api/upload/route.js), and served with long-lived
    // immutable cache headers straight from R2. There is nothing left
    // for Vercel's on-request Image Optimization to usefully do to
    // them, so we skip it entirely — this is what actually stops the
    // "Image Optimization" usage from growing with traffic.
    unoptimized: true,

    // Kept in case `unoptimized` is ever turned off for a subset of
    // images (e.g. arbitrary external URLs) — makes the optimizer
    // cache each variant for a year instead of the 60s default.
    minimumCacheTTL: 31536000,
  },
};

module.exports = nextConfig;