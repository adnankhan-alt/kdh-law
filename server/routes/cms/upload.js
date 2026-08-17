const { put } = require('@vercel/blob');
const { requireCms } = require('../../lib/cms');

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'
]);

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, 'editor');
  if (!current) return;
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { filename, content, contentType } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'Missing file data.' });
    if (!ALLOWED_TYPES.has(contentType)) return res.status(400).json({ error: 'Only supported image files can be uploaded.' });

    const base64Data = String(content).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Images must be 3 MB or smaller.' });
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-180);
    const uniqueName = `${Date.now()}-${safeName || 'image'}`;
    const blob = await put(`kdh/media/${uniqueName}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true
    });

    return res.status(200).json({ url: blob.url });
  } catch {
    return res.status(500).json({ error: 'Failed to upload the image.' });
  }
};
