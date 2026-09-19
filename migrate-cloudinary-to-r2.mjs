/**
 * One-time migration: copy every Cloudinary-hosted image/video referenced
 * in Product.variants[].images, Reel.videoUrl, and Reel.thumbnail into R2,
 * then rewrite those fields to point at the new R2 URLs.
 *
 * Run from your project root (needs access to MONGODB_URI and R2_* env vars):
 *
 *   npm install mongoose @aws-sdk/client-s3 dotenv   # if not already installed
 *   node migrate-cloudinary-to-r2.mjs --dry-run       # preview, no writes
 *   node migrate-cloudinary-to-r2.mjs                 # actually migrate
 *
 * Requires Node 18+ (uses global fetch).
 *
 * IMPORTANT: back up your database before running this for real.
 * The script is safe to re-run — anything already on R2 is skipped,
 * and any single item that fails to migrate is logged and left untouched
 * so you can retry just those.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const SLEEP_MS = 150; // small delay between downloads to be gentle on Cloudinary

const REQUIRED_ENV = [
  'MONGODB_URI',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Loose schemas (strict: false) so this script doesn't need to import your
// real model files or stay in perfect sync with them.
const Product = mongoose.model(
  'Product',
  new mongoose.Schema({}, { strict: false, collection: 'products' })
);
const Reel = mongoose.model(
  'Reel',
  new mongoose.Schema({}, { strict: false, collection: 'reels' })
);

const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function migrateUrl(url, folder) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());

  const extMatch = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : (contentType.split('/')[1] || 'bin');
  const key = `${folder}/${randomUUID()}.${ext}`;

  if (!DRY_RUN) {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function migrateProducts(stats) {
  const cursor = Product.find({ 'variants.images': { $regex: 'res.cloudinary.com' } }).cursor();
  for await (const product of cursor) {
    let changed = false;
    for (const variant of product.variants || []) {
      const images = variant.images || [];
      for (let i = 0; i < images.length; i++) {
        if (!isCloudinaryUrl(images[i])) continue;
        const original = images[i];
        try {
          const newUrl = await migrateUrl(original, 'products');
          images[i] = newUrl;
          changed = true;
          stats.migrated++;
          console.log(`[product ${product._id}] ${original} -> ${newUrl}`);
        } catch (err) {
          stats.failed++;
          console.error(`[product ${product._id}] FAILED ${original}: ${err.message}`);
        }
        await sleep(SLEEP_MS);
      }
    }
    if (changed && !DRY_RUN) {
      product.markModified('variants');
      await product.save();
    }
  }
}

async function migrateReels(stats) {
  const cursor = Reel.find({
    $or: [
      { videoUrl: { $regex: 'res.cloudinary.com' } },
      { thumbnail: { $regex: 'res.cloudinary.com' } },
    ],
  }).cursor();

  for await (const reel of cursor) {
    let changed = false;

    if (isCloudinaryUrl(reel.videoUrl)) {
      const original = reel.videoUrl;
      try {
        const newUrl = await migrateUrl(original, 'reels/videos');
        reel.videoUrl = newUrl;
        changed = true;
        stats.migrated++;
        console.log(`[reel ${reel._id}] video ${original} -> ${newUrl}`);
      } catch (err) {
        stats.failed++;
        console.error(`[reel ${reel._id}] FAILED video ${original}: ${err.message}`);
      }
      await sleep(SLEEP_MS);
    }

    if (isCloudinaryUrl(reel.thumbnail)) {
      const original = reel.thumbnail;
      try {
        const newUrl = await migrateUrl(original, 'reels/thumbnails');
        reel.thumbnail = newUrl;
        changed = true;
        stats.migrated++;
        console.log(`[reel ${reel._id}] thumbnail ${original} -> ${newUrl}`);
      } catch (err) {
        stats.failed++;
        console.error(`[reel ${reel._id}] FAILED thumbnail ${original}: ${err.message}`);
      }
      await sleep(SLEEP_MS);
    }

    if (changed && !DRY_RUN) {
      await reel.save();
    }
  }
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no uploads or DB writes will happen\n' : 'LIVE RUN — uploading to R2 and writing to DB\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const stats = { migrated: 0, failed: 0 };
  await migrateProducts(stats);
  await migrateReels(stats);

  console.log(`\nDone. Migrated: ${stats.migrated}  Failed: ${stats.failed}`);
  if (stats.failed > 0) {
    console.log('Re-run the script (same command) to retry only the items still pointing at res.cloudinary.com.');
  }

  await mongoose.disconnect();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
