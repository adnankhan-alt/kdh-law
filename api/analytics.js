const crypto = require('crypto');
const { privateToken, putPrivate } = require('./_lib/private-data');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!privateToken()) return res.status(204).end();

  try {
    const rawPath = String(req.body?.path || '/').slice(0, 500);
    if (!rawPath.startsWith('/')) return res.status(400).end();
    const date = new Date().toISOString().slice(0, 10);
    const encodedPath = Buffer.from(rawPath, 'utf8').toString('base64url');
    const id = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${encodedPath}`;
    await putPrivate(`kdh/analytics/${date}/${id}.json`, '{}', { contentType: 'application/json' });
    return res.status(204).end();
  } catch {
    return res.status(204).end();
  }
};
