const { requireCms } = require('../_lib/cms');
const { deletePrivate, getPrivate, listPrivate, putPrivate } = require('../_lib/private-data');

async function loadEnquiries() {
  const { blobs } = await listPrivate({ prefix: 'kdh/enquiries/', limit: 100 });
  const rows = await Promise.all(blobs.map(async (blob) => {
    try {
      const text = await getPrivate(blob.url);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }));
  return rows.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, req.method === 'GET' ? 'viewer' : 'editor');
  if (!current) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await loadEnquiries());
    }

    const id = String(req.body?.id || '').replace(/[^a-zA-Z0-9-]/g, '');
    if (!id) return res.status(400).json({ error: 'Missing enquiry ID.' });
    const pathname = `kdh/enquiries/${id}.json`;

    if (req.method === 'PATCH') {
      const existingText = await getPrivate(pathname);
      if (!existingText) return res.status(404).json({ error: 'Enquiry not found.' });
      const existing = JSON.parse(existingText);
      const status = String(req.body?.status || existing.status);
      if (!['new', 'in-progress', 'resolved', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid enquiry status.' });
      }
      const updated = {
        ...existing,
        status,
        notes: String(req.body?.notes ?? existing.notes ?? '').slice(0, 6000),
        updatedAt: new Date().toISOString()
      };
      await putPrivate(pathname, `${JSON.stringify(updated, null, 2)}\n`, {
        contentType: 'application/json',
        allowOverwrite: true
      });
      return res.status(200).json({ saved: true, enquiry: updated });
    }

    if (req.method === 'DELETE') {
      await deletePrivate(pathname);
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).end();
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({ error: error?.message || 'Unable to manage enquiries.' });
  }
};
