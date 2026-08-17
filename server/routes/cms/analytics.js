const { requireCms } = require('../../lib/cms');
const { listPrivate } = require('../../lib/private-data');

function decodePath(pathname) {
  const filename = pathname.split('/').pop()?.replace(/\.json$/i, '') || '';
  const parts = filename.split('-');
  if (parts.length < 3) return '/';
  const encoded = parts.slice(2).join('-');
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8') || '/';
  } catch {
    return '/';
  }
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, 'viewer');
  if (!current) return;
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');

  try {
    let cursor;
    let blobs = [];
    for (let page = 0; page < 5; page += 1) {
      const result = await listPrivate({ prefix: 'kdh/analytics/', limit: 1000, cursor });
      blobs = blobs.concat(result.blobs || []);
      cursor = result.cursor;
      if (!cursor) break;
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = blobs.filter((blob) => {
      const match = blob.pathname.match(/kdh\/analytics\/(\d{4}-\d{2}-\d{2})\//);
      if (!match) return false;
      return Date.parse(`${match[1]}T00:00:00Z`) >= cutoff;
    });

    const byDay = {};
    const byPage = {};
    recent.forEach((blob) => {
      const day = blob.pathname.match(/kdh\/analytics\/(\d{4}-\d{2}-\d{2})\//)?.[1];
      const path = decodePath(blob.pathname);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
      byPage[path] = (byPage[path] || 0) + 1;
    });

    const topPages = Object.entries(byPage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([path, views]) => ({ path, views }));

    return res.status(200).json({
      total30d: recent.length,
      byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views })),
      topPages
    });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({ error: error?.message || 'Analytics are unavailable.' });
  }
};
