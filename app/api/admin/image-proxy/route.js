// Location: app/api/admin/image-proxy/route.js
//
// Admin-only. Downloads a product image on the server and returns it from your
// own domain, so the browser doesn't hit CORS errors when it needs the image
// as a file (WhatsApp sharing, "Download images").

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import dns from 'node:dns/promises';
import net from 'node:net';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;

const EXT_TO_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const bad = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Refuse internal addresses so this can't be used to reach private services.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return (
      l === '::1' ||
      l === '::' ||
      l.startsWith('fc') ||
      l.startsWith('fd') ||
      l.startsWith('fe80') ||
      l.startsWith('::ffff:127.') ||
      l.startsWith('::ffff:10.') ||
      l.startsWith('::ffff:192.168.') ||
      l.startsWith('::ffff:169.254.')
    );
  }
  return true;
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Address not allowed');
    return;
  }
  const addrs = await dns.lookup(hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error('Address not allowed');
  }
}

async function fetchImage(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http(s) images');
    await assertPublicHost(url.hostname);

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url); // re-checked on the next loop
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
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
    const upstream = await fetchImage(target);
    if (!upstream.ok) return bad('Could not download the image', 502);

    const declared = Number(upstream.headers.get('content-length')) || 0;
    if (declared > MAX_BYTES) return bad('Image is too large', 413);

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) return bad('Image is too large', 413);

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
    console.error('Image proxy error:', err?.message || err);
    return bad('Could not download the image', 502);
  }
});