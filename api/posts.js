const {
  branchName,
  githubHeaders,
  repoName
} = require('./_lib/cms');

function publicGithubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KDH-Website-Public',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function isPublic(post) {
  const status = post.status || 'published';
  if (status === 'draft') return false;
  if (status === 'scheduled') {
    const when = Date.parse(post.scheduledAt || '');
    return Number.isFinite(when) && when <= Date.now();
  }
  return status === 'published';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
    const listingResponse = await fetch(`${base}?ref=${encodeURIComponent(branchName())}`, {
      headers: publicGithubHeaders()
    });
    if (listingResponse.status === 404) return res.status(200).json([]);
    const listing = await listingResponse.json();
    if (!listingResponse.ok) throw new Error('Unable to list posts');

    const files = listing.filter((item) => item.type === 'file' && item.name.endsWith('.json')).slice(0, 100);
    const posts = await Promise.all(files.map(async (file) => {
      try {
        const response = await fetch(`${file.url}?ref=${encodeURIComponent(branchName())}`, {
          headers: publicGithubHeaders()
        });
        if (!response.ok) return null;
        const payload = await response.json();
        return JSON.parse(Buffer.from(payload.content || '', 'base64').toString('utf8'));
      } catch {
        return null;
      }
    }));

    const validPosts = posts
      .filter((post) => post && isPublic(post))
      .sort((a, b) => {
        const aTime = a.status === 'scheduled' && a.scheduledAt ? a.scheduledAt : (a.date || a.scheduledAt || 0);
        const bTime = b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : (b.date || b.scheduledAt || 0);
        return new Date(bTime) - new Date(aTime);
      });

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(validPosts);
  } catch {
    return res.status(500).json({ error: 'Could not fetch posts' });
  }
};
