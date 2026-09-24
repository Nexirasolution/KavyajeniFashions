import { S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2 (S3-compatible) client.
//
// requestChecksumCalculation / responseChecksumValidation are set to
// 'WHEN_REQUIRED' because newer @aws-sdk/client-s3 versions add a CRC32
// checksum to presigned URLs by default, and R2 rejects those uploads
// (the browser PUT fails with 400/403/501).
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});