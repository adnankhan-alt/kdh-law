const { readGitJson } = require('../../lib/cms');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const result = await readGitJson(null, 'content/page.json');
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(result.data);
  } catch {
    return res.status(404).json({ error: 'Published visual content is unavailable.' });
  }
};
