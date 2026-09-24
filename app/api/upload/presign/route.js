import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';
import { r2 } from '@/lib/r2Client';

// POST /api/upload/presign
// body: { filename, contentType, contentLength, folder }
//
// Returns a signed PUT URL so the browser can upload large files
// (e.g. reel videos) straight to R2, without the file passing
// through your Next.js server.
//
// Client flow:
//   1. POST here -> { uploadUrl, publicUrl, key, headers, expiresIn }
//   2. PUT the raw file body to `uploadUrl` with EXACTLY the `headers`
//      returned here (every signed header must be sent by the browser).
//   3. The file is now live at `publicUrl`.

const ALLOWED_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED_FOLDER_PREFIXES = ['uploads', 'reels', 'avatars', 'banners', 'combos'];

function isAllowedFolder(folder) {
  if (typeof folder !== 'string' || !folder || folder.includes('..')) return false;
  return ALLOWED_FOLDER_PREFIXES.some((prefix) => folder === prefix || folder.startsWith(`${prefix}/`));
}

const ONE_YEAR = 60 * 60 * 24 * 365;
const CACHE_CONTROL = `public, max-age=${ONE_YEAR}, immutable`;

export const POST = requireAdmin(async (req) => {
  try {
    const { filename, contentType, contentLength, folder = 'uploads' } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported contentType: ${contentType}` }, { status: 400 });
    }
    if (!isAllowedFolder(folder)) {
      return NextResponse.json({ error: `Unsupported folder: ${folder}` }, { status: 400 });
    }
    if (!contentLength || typeof contentLength !== 'number' || contentLength <= 0) {
      return NextResponse.json({ error: 'contentLength (bytes) is required' }, { status: 400 });
    }
    if (contentLength > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_BYTES / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    for (const name of ['R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
      if (!process.env[name]) {
        console.error(`Presign failed: missing env var ${name}`);
        return NextResponse.json({ error: 'Storage is not configured on the server' }, { status: 500 });
      }
    }

    // Strip anything that isn't a safe filename character, and cap
    // length so absurdly long names can't blow up the object key.
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    const key = `${folder}/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: CACHE_CONTROL,
    });

    // Short expiry since this is a one-shot PUT the client should use immediately.
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      // Signed headers: the browser must send these exactly, otherwise R2
      // answers 403 SignatureDoesNotMatch. (Content-Length is set by the
      // browser automatically from the file body.)
      headers: {
        'Content-Type': contentType,
        'Cache-Control': CACHE_CONTROL,
      },
      expiresIn: 300,
    });
  } catch (err) {
    console.error('Presign failed:', err);
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 });
  }
});