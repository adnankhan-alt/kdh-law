const { readGitJson, requireCms, sendError, writeGitJson } = require('../../lib/cms');

const CONTENT_PATH = 'content/page.json';

function validStringMap(value, maxEntries, maxLength) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= maxEntries && entries.every(([key, item]) =>
    typeof key === 'string' &&
    key.length > 0 &&
    key.length < 600 &&
    typeof item === 'string' &&
    item.length <= maxLength
  );
}

function validImageMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 150 && entries.every(([key, item]) =>
    typeof key === 'string' &&
    key.length > 0 &&
    key.length < 600 &&
    item &&
    typeof item === 'object' &&
    typeof item.src === 'string' &&
    item.src.length <= 1200 &&
    typeof item.alt === 'string' &&
    item.alt.length <= 500
  );
}

function validContent(value) {
  return Boolean(
    value &&
    value.version === 1 &&
    validStringMap(value.text, 1200, 5000) &&
    validImageMap(value.images) &&
    validStringMap(value.links, 300, 1600)
  );
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, req.method === 'GET' ? 'viewer' : 'editor');
  if (!current) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const existing = await readGitJson(current, CONTENT_PATH);

    if (req.method === 'GET') {
      return res.status(200).json({ content: existing.data, sha: existing.sha });
    }
    if (req.method !== 'PUT') return res.status(405).end();
    if (!validContent(req.body?.content)) {
      return res.status(400).json({ error: 'The submitted homepage content is incomplete or invalid.' });
    }

    const updated = await writeGitJson(current, CONTENT_PATH, req.body.content, {
      sha: existing.sha,
      message: 'Update homepage content from KDH CMS'
    });

    return res.status(200).json({
      saved: true,
      commit: updated.commit?.sha,
      message: 'Homepage saved to GitHub. Vercel will deploy the commit automatically.'
    });
  } catch (error) {
    return sendError(res, error, 'Unable to manage homepage content.');
  }
};
