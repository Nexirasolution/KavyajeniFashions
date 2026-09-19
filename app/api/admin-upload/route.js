import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';
import { r2 } from '@/lib/r2Client';

// Use this version instead of app/api/upload/route.js if only admins
// should be able to upload (mirrors your original requireAdmin route).
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
