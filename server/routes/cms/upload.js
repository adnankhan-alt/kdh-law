const { put } = require('@vercel/blob');
const { requireCms } = require('../../lib/cms');

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

function safeBlobError(error) {
  const name = String(error?.name || 'BlobError').slice(0, 80);
  const message = String(error?.message || 'Unknown Vercel Blob error')
    .replace(/vercel_blob_rw_[A-Za-z0-9_\-.]+/g, '[redacted-token]')
    .replace(/github_pat_[A-Za-z0-9_\-.]+/g, '[redacted-token]')
    .slice(0, 350);
  return { name, message };
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, 'editor');
  if (!current) return;
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (!token) {
      return res.status(503).json({
        error: 'Public media storage is not configured. BLOB_READ_WRITE_TOKEN is missing in Vercel.'
      });
    }

    const { filename, content, contentType } = req.body || {};
    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing file data.' });
    }

    const normalizedType = String(contentType || '').toLowerCase().trim();
    if (!ALLOWED_TYPES.has(normalizedType)) {
      return res.status(400).json({
        error: 'Unsupported image type. Use JPG, PNG, WebP, GIF, or AVIF.'
      });
    }

    const base64Data = String(content).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'The selected image could not be read.' });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Images must be 3 MB or smaller.' });
    }

    const safeName = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .slice(-180);

    const uniqueName = `${Date.now()}-${safeName || 'image'}`;
    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const blob = await put(`kdh/media/${uniqueName}`, body, {
      access: 'public',
      contentType: normalizedType,
      addRandomSuffix: true,
      token
    });

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType || normalizedType
    });
  } catch (error) {
    const detail = safeBlobError(error);
    console.error('[KDH CMS] Public Blob upload failed', {
      name: detail.name,
      message: detail.message,
      hasPublicBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
    });

    const lower = `${detail.name} ${detail.message}`.toLowerCase();
    if (lower.includes('access') || lower.includes('private') || lower.includes('public')) {
      return res.status(503).json({
        error: 'The media Blob store access type does not match the CMS. BLOB_READ_WRITE_TOKEN must belong to a PUBLIC Vercel Blob store.'
      });
    }
    if (lower.includes('token') || lower.includes('unauthorized') || lower.includes('forbidden')) {
      return res.status(503).json({
        error: 'Vercel Blob rejected the media token. Reconnect the PUBLIC Blob store or refresh BLOB_READ_WRITE_TOKEN in Vercel.'
      });
    }

    return res.status(500).json({
      error: `Vercel Blob upload failed (${detail.name}). Check the Vercel Function log for the exact storage error.`
    });
  }
};
