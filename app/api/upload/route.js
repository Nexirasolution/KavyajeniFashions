import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { cloudinary } from '@/lib/cloudinary';

// Admin-only image upload route. The file is sent to this route, then
// streamed to Cloudinary. Cloudinary does the resizing/compression, so
// sharp is no longer needed here.

const MAX_WIDTH = 1600; // never upscale, only shrink larger images

export const POST = requireAdmin(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Applied once at upload time and stored as the original.
          // crop:'limit' = shrink if wider than MAX_WIDTH, never enlarge.
          transformation: [
            { width: MAX_WIDTH, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, res) => (error ? reject(error) : resolve(res))
      );
      stream.end(buffer);
    });

    // Same response shape as the R2 version so the client doesn't change.
    return NextResponse.json({ url: result.secure_url, key: result.public_id });
  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});

/* ---------------------------------------------------------------
   Cloudflare R2 + sharp version (disabled).
   To switch back: delete the Cloudinary code above, uncomment this,
   and restore the imports below.
   ---------------------------------------------------------------
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/apiAuth';
import { r2 } from '@/lib/r2Client';

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;
const ONE_YEAR = 60 * 60 * 24 * 365;

export const POST = requireAdmin(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const optimizedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const key = `${folder}/${randomUUID()}.webp`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
        CacheControl: `public, max-age=${ONE_YEAR}, immutable`,
      })
    );

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error('R2 upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});
*/