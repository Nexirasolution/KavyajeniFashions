import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { cloudinary } from '@/lib/cloudinary';

// POST /api/upload/presign
// body: { filename, contentType, contentLength, folder }
//
// Returns a signed payload so the browser can upload large files
// (e.g. reel videos) straight to Cloudinary, without the file passing
// through your Next.js server.
//
// Client flow:
//   1. POST here -> { uploadUrl, fields, ... }
//   2. Build a FormData with every entry in `fields`, then append `file`
//      LAST, and POST it to `uploadUrl`.
//   3. Cloudinary responds with { secure_url, public_id, ... }.

const ALLOWED_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Must match what the client sends, since allowed_formats is part of the
// signature. Cloudinary rejects any file whose format isn't in this list.
const ALLOWED_FORMATS = 'mp4,webm,mov,jpg,jpeg,png,webp';

// NOTE: Cloudinary cannot pin an exact upload size in the signature the
// way the R2 presigned PUT did. This check only validates what the client
// *declares*. For a hard cap, set a max file size on your Cloudinary
// account / upload preset (Settings -> Upload).
const MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED_FOLDER_PREFIXES = ['uploads', 'reels', 'avatars', 'banners', 'combos'];

function isAllowedFolder(folder) {
  if (typeof folder !== 'string' || !folder || folder.includes('..')) return false;
  return ALLOWED_FOLDER_PREFIXES.some((prefix) => folder === prefix || folder.startsWith(`${prefix}/`));
}

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

    const timestamp = Math.round(Date.now() / 1000);

    // Every param listed here is signed, so the client must send exactly
    // these values (except file, api_key, cloud_name, resource_type).
    const paramsToSign = {
      timestamp,
      folder,
      allowed_formats: ALLOWED_FORMATS,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    return NextResponse.json({
      // "auto" lets Cloudinary detect image vs video from the file.
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      fields: {
        api_key: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        allowed_formats: ALLOWED_FORMATS,
      },
      cloudName,
      expiresIn: 3600, // Cloudinary accepts signatures for ~1 hour
    });
  } catch (err) {
    console.error('Presign failed:', err);
    return NextResponse.json({ error: 'Could not create upload signature' }, { status: 500 });
  }
});

/* ---------------------------------------------------------------
   Cloudflare R2 presigned PUT version (disabled).
   To switch back: delete the Cloudinary code above, uncomment this,
   and restore the imports below.
   ---------------------------------------------------------------
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';
import { r2 } from '@/lib/r2Client';

const ALLOWED_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
  'image/jpeg', 'image/png', 'image/webp',
]);
const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED_FOLDER_PREFIXES = ['uploads', 'reels', 'avatars', 'banners', 'combos'];

function isAllowedFolder(folder) {
  if (typeof folder !== 'string' || !folder || folder.includes('..')) return false;
  return ALLOWED_FOLDER_PREFIXES.some((prefix) => folder === prefix || folder.startsWith(`${prefix}/`));
}

const ONE_YEAR = 60 * 60 * 24 * 365;

export const POST = requireAdmin(async (req) => {
  try {
    const { filename, contentType, contentLength, folder = 'uploads' } = await req.json();

    if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 });
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
      return NextResponse.json({ error: `File too large. Max ${MAX_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    const key = `${folder}/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: `public, max-age=${ONE_YEAR}, immutable`,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl, key, expiresIn: 300 });
  } catch (err) {
    console.error('Presign failed:', err);
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 });
  }
});
*/