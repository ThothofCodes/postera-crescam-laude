// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
//
// Upload middleware — multer memoryStorage + MinIO streaming.
// Files are buffered in memory, then streamed to MinIO on demand.
const multer = require('multer');
// eslint-disable-next-line import/no-unresolved
const { v4: uuidv4 } = require('uuid');
const { uploadBuffer, MINIO_BUCKET } = require('../config/cloudinary');

// Memory storage — no disk I/O, compatible with MinIO streaming.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ALLOWED = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/bmp', 'image/tiff', 'image/heif', 'image/heic',
      'application/pdf', // receipts
    ];
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

/**
 * Upload a single in-memory buffer to MinIO.
 * @param {Buffer} buffer - file.buffer from multer memoryStorage
 * @param {string} folder - subfolder/bucket (default: 'products')
 * @param {string} originalName - original filename for extension
 * @param {string} contentType - MIME type
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadBufferToMinio(buffer, folder = 'products', originalName = 'file', contentType = 'application/octet-stream') {
  const ext = require('path').extname(originalName) || '.bin';
  const key = `${folder}/${uuidv4()}${ext}`;
  const bucket = MINIO_BUCKET;
  const result = await uploadBuffer(bucket, key, buffer, contentType);
  return { url: result.url, key: `${bucket}/${key}` };
}

/**
 * Upload all images from req.files to MinIO.
 * Returns an array of public URLs, one per uploaded file.
 *
 * @param {Express.Multer.File[]} files - req.files
 * @param {string} folder - subfolder under MinIO bucket
 * @returns {Promise<string[]>} array of URLs
 */
async function uploadProductImages(files = [], folder = 'products') {
  if (!files.length) return [];
  const results = await Promise.all(
    files.map((f) => uploadBufferToMinio(f.buffer, folder, f.originalname, f.mimetype)),
  );
  return results.map((r) => r.url);
}

module.exports = { upload, uploadProductImages, uploadBufferToMinio };
