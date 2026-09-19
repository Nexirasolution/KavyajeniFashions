import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { cloudinary } from '@/lib/cloudinary';

// Admin-only image upload route (server-side). The file is sent to this route,
// then streamed to Cloudinary.
//
// NOTE: On Vercel, request bodies are limited to ~4.5MB. For large photos use
// the direct upload flow via /api/upload/presign instead (the bulk upload page
// already does).

const MAX_WIDTH = 1600; // never upscale, only shrink larger images
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FOLDER_PREFIXES = ['uploads', 'reels', 'avatars', 'banners', 'combos'];

function isAllowedFolder(folder) {
  if (typeof folder !== 'string' || !folder || folder.includes('..')) return false;
  return ALLOWED_FOLDER_PREFIXES.some((prefix) => folder === prefix || folder.startsWith(`${prefix}/`));
}

export const POST = requireAdmin(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
    }
    if (!isAllowedFolder(folder)) {
      return NextResponse.json({ error: `Unsupported folder: ${folder}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // crop:'limit' = shrink if wider than MAX_WIDTH, never enlarge.
          // f_auto is intentionally NOT used here; apply f_auto,q_auto at
          // delivery time instead (see lib/cloudinaryUrl.js).
          transformation: [{ width: MAX_WIDTH, crop: 'limit', quality: 'auto' }],
        },
        (error, res) => (error ? reject(error) : resolve(res))
      );
      stream.end(buffer);
    });

    // Same response shape as the R2 version so the client doesn't change.
    return NextResponse.json({ url: result.secure_url, key: result.public_id });
  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
});