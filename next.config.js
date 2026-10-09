/** @type {import('next').NextConfig} */

// Derive the R2 hostname from the public URL env var so we don't
// hardcode it and it stays correct across environments.
let r2Hostname = null;
try {
  r2Hostname = process.env.R2_PUBLIC_URL
    ? new URL(process.env.R2_PUBLIC_URL).hostname
    : null;
} catch {
  r2Hostname = null;
}

if (!r2Hostname) {
  console.warn(
    '[next.config] R2_PUBLIC_URL is missing or invalid. Remote product images may not load.'
  );
}

const nextConfig = {
  images: {
    remotePatterns: r2Hostname
      ? [{ protocol: 'https', hostname: r2Hostname }]
      : [],

    // Allow local images that use query strings (stricter in Next 16).
    localPatterns: [{ pathname: '/**' }],

    // Images are resized and re-encoded to WebP at upload time
    // (see app/api/upload/route.js) and served with long-lived cache
    // headers straight from R2, so Next's on-request optimizer has
    // nothing useful to do. Skipping it also avoids needing an
    // Images binding on Cloudflare.
    unoptimized: true,

    // Only used if `unoptimized` is ever turned off.
    minimumCacheTTL: 31536000,
  },
};

module.exports = nextConfig;