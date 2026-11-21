// Location: app/api/admin/image-proxy/route.js
//
// Admin-only. Downloads a product image on the server and returns it from your
// own domain, so the browser doesn't hit CORS errors when it needs the image
// as a file (WhatsApp sharing, "Download images").
//
// The share modal now loads ALL selected images (6 at a time), so this route
// is built to handle many quick requests: the download is size-capped while it
// streams, and a flaky image host gets one automatic retry.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import dns from 'node:dns/promises';
import net from 'node:net';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 2; // one retry for timeouts / network errors / 5xx

const EXT_TO_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const bad = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Errors that must never be retried (security or size problems).
class BlockedError extends Error {}

function isPrivateIpv4(ip) {
  const [a, b, c] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast + reserved
  );
}

// Refuse internal addresses so this can't be used to reach private services.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);

  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();

    // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1): check the embedded IPv4
    if (l.startsWith('::ffff:')) {
      const rest = l.slice(7);
      if (rest.includes('.')) return isPrivateIpv4(rest);
      const parts = rest.split(':');
      if (parts.length === 2) {
        const hi = parseInt(parts[0], 16);
        const lo = parseInt(parts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
        }
      }
      return true;
    }

    return (
      l === '::1' ||
      l === '::' ||
      l.startsWith('fc') || // unique local fc00::/7
      l.startsWith('fd') ||
      /^fe[89ab]/.test(l) || // link-local fe80::/10
      l.startsWith('ff') // multicast
    );
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, ''); // strip brackets from IPv6 literals
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedError('Address not allowed');
    return;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new BlockedError('Address not allowed');
  }
}

async function fetchImage(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BlockedError('Only http(s) images');
    }
    await assertPublicHost(url.hostname);

    const res = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url); // re-checked on the next loop
      continue;
    }
    return res;
  }
  throw new BlockedError('Too many redirects');
}

// Reads the body while counting bytes, and stops as soon as the limit is passed.
// (arrayBuffer() would load the whole file first, even when no Content-Length
// header was sent.)
async function readCapped(res) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new BlockedError('Image is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
}

// Downloads one image, retrying once on timeouts, network errors and 5xx.
async function downloadWithRetry(target) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const upstream = await fetchImage(target);

      if (upstream.status >= 500 && attempt < MAX_ATTEMPTS) {
        lastErr = new Error(`Upstream ${upstream.status}`);
        continue;
      }
      if (!upstream.ok) return { upstream, buf: null };

      const declared = Number(upstream.headers.get('content-length')) || 0;
      if (declared > MAX_BYTES) throw new BlockedError('Image is too large');

      const buf = await readCapped(upstream);
      return { upstream, buf };
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('Download failed');
}

// GET /api/admin/image-proxy?url=https://...
export const GET = requireAdmin(async (req) => {
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return bad('Missing url');

  let target;
  try {
    target = new URL(raw);
  } catch {
    return bad('Invalid url');
  }

  try {
    const { upstream, buf } = await downloadWithRetry(target);
    if (!buf) return bad('Could not download the image', 502);

    // Only ever return images
    let type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) {
      const ext = target.pathname.split('.').pop().toLowerCase();
      type = EXT_TO_TYPE[ext] || '';
    }
    if (!type) return bad('That URL is not an image', 415);

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(buf.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof BlockedError) {
      const tooLarge = err.message === 'Image is too large';
      return bad(err.message, tooLarge ? 413 : 400);
    }
    console.error('Image proxy error:', err?.message || err);
    return bad('Could not download the image', 502);
  }
});