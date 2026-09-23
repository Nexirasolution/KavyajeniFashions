import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/r2Client';

// Extracts the R2 object key from a stored image URL like
// `${R2_PUBLIC_URL}/${key}` -> key
function urlToKey(url) {
  if (!url) return null;
  const prefix = `${process.env.R2_PUBLIC_URL}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

// Collects every image URL across all variants of one or more products
// and deletes them from R2 in batched requests (max 1000 keys/request).
export async function deleteProductImagesFromR2(products) {
  const list = Array.isArray(products) ? products : [products];

  const keys = list
    .flatMap((p) => p.variants?.flatMap((v) => v.images || []) || [])
    .map(urlToKey)
    .filter(Boolean);

  if (!keys.length) return { deleted: 0 };

  const chunks = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }

  let deleted = 0;
  for (const chunk of chunks) {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
    deleted += chunk.length;
  }

  return { deleted };
}