import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { cloudinary } from '@/lib/cloudinary';

// Use this version instead of app/api/upload/route.js if only admins
// should be able to upload (mirrors your original requireAdmin route).
//
// Uploads any file type as-is (no resizing). resource_type 'auto' lets
// Cloudinary detect image / video / raw from the file itself.
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
          resource_type: 'auto',
          // Keep the original filename in the public_id, plus a random
          // suffix so two uploads with the same name never collide.
          use_filename: true,
          unique_filename: true,
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
   Cloudflare R2 version (disabled).
   To switch back: delete the Cloudinary code above, uncomment this,
   and restore the imports below (r2 comes from '@/lib/r2Client').
   ---------------------------------------------------------------
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';
import { r2 } from '@/lib/r2Client';

export const POST = requireAdmin(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `${folder}/${randomUUID()}-${file.name}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
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