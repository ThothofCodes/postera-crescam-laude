// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// MinIO Object Storage — replaces Cloudinary with self-hosted S3-compatible storage.
const Minio = require('minio');
const path = require('path');

// ── MinIO Configuration ────────────────────────────────────────────────────
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'pcl-uploads';
const MINIO_USE_SSL = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5001';

// Public base URL — where MinIO files are served from.
// In production, this points to your MinIO server or a reverse-proxy that
// fronts it (e.g. https://files.pclsolutions.co.ke).
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL
  || `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}`;

const BUCKETS = ['products', 'inventory', 'receipts', 'avatars', 'calendar', 'temp'];

// ── Client singleton ───────────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;
  _client = new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });
  return _client;
}

/**
 * Ensure all required buckets exist (idempotent).
 * Called once at server startup — safe to call multiple times.
 */
async function ensureBuckets() {
  const client = getClient();
  for (const bucket of BUCKETS) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket);
        // Allow public read via bucket policy
        const policy = {
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          }],
        };
        await client.setBucketPolicy(bucket, JSON.stringify(policy));
        console.log(`[MinIO] Bucket created: ${bucket}`);
      }
    } catch (err) {
      console.warn(`[MinIO] Bucket check failed for ${bucket}:`, err.message);
    }
  }
}

/**
 * Build a public URL for an object in a bucket.
 * @param {string} bucket - bucket name
 * @param {string} objectName - object key
 * @returns {string} public URL
 */
function fileUrl(bucket, objectName) {
  return `${MINIO_PUBLIC_URL}/${bucket}/${objectName}`;
}

/**
 * Parse a full MinIO URL back into bucket + objectName.
 * Handles both URL formats:
 *   - http://host:port/bucket/object
 *   - /bucket/object (relative)
 * @param {string} fileUrlStr
 * @returns {{ bucket: string, objectName: string } | null}
 */
function parseFileUrl(fileUrlStr) {
  if (!fileUrlStr) return null;
  // Relative URL: /bucket/object
  const relMatch = fileUrlStr.match(/^\/([^/]+)\/(.+)$/);
  if (relMatch) return { bucket: relMatch[1], objectName: relMatch[2] };
  // Full URL: http://host:port/bucket/object
  const fullMatch = fileUrlStr.match(/\/([^/]+)\/(.+)$/);
  if (fullMatch) return { bucket: fullMatch[1], objectName: fullMatch[2] };
  return null;
}

/**
 * Upload a Buffer to MinIO.
 * @param {string} bucket - bucket name (e.g. 'products')
 * @param {string} objectName - object key (e.g. 'product-uuid.jpg')
 * @param {Buffer} buffer - file content
 * @param {string} contentType - MIME type
 * @returns {Promise<{ url: string, bucket: string, objectName: string }>}
 */
async function uploadBuffer(bucket, objectName, buffer, contentType = 'application/octet-stream') {
  const client = getClient();
  await client.putObject(bucket, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return {
    url: fileUrl(bucket, objectName),
    bucket,
    objectName,
  };
}

/**
 * Delete an object from MinIO.
 * @param {string} bucket
 * @param {string} objectName
 */
async function deleteObject(bucket, objectName) {
  try {
    const client = getClient();
    await client.removeObject(bucket, objectName);
  } catch (_) { /* best effort */ }
}

/**
 * Delete all objects with a given prefix.
 * @param {string} bucket
 * @param {string} prefix
 */
async function deletePrefix(bucket, prefix) {
  try {
    const client = getClient();
    const objectsList = [];
    const objectsStream = client.listObjects(bucket, prefix, true);
    for await (const obj of objectsStream) {
      objectsList.push(obj.name);
    }
    if (objectsList.length > 0) {
      await client.removeObjects(bucket, objectsList);
    }
  } catch (_) { /* best effort */ }
}

module.exports = {
  getClient,
  ensureBuckets,
  fileUrl,
  parseFileUrl,
  uploadBuffer,
  deleteObject,
  deletePrefix,
  MINIO_BUCKET,
  MINIO_PUBLIC_URL,
  CLIENT_URL,
  BUCKETS,
};
