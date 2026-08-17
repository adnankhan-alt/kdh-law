const {
  branchName,
  repoName
} = require('../../lib/cms');

function publicGithubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KDH-Website-Public',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isPublic(post) {
  const status = String(post?.status || 'published').toLowerCase();
  if (status === 'draft') return false;
  if (status === 'scheduled') {
    const when = Date.parse(post.scheduledAt || '');
    return Number.isFinite(when) && when <= Date.now();
  }
  return status === 'published';
}

function publicationTime(post) {
  if (post.status === 'scheduled' && post.scheduledAt) return post.scheduledAt;
  return post.date || post.scheduledAt || 0;
}

async function readPostFile(file, headers) {
  // Directory listing responses can already contain query parameters in
  // `file.url`. Re-appending `?ref=...` to that URL can produce an invalid
  // request. Build the content URL ourselves so there is exactly one ref.
  const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
  const fileName = String(file?.name || '');
  if (!fileName.endsWith('.json')) return null;

  const url = `${base}/${encodeURIComponent(fileName)}?ref=${encodeURIComponent(branchName())}`;
  const response = await fetch(url, {
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    console.error('[KDH Public Posts] Unable to read article file', {
      file: fileName,
      status: response.status,
      githubRequestId: response.headers.get('x-github-request-id') || 'unknown'
    });
    return null;
  }

  const payload = await response.json();
  if (!payload?.content) return null;

  try {
    return JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'));
  } catch (error) {
    console.error('[KDH Public Posts] Invalid article JSON', {
      file: fileName,
      message: error?.message || 'JSON parse failed'
    });
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Blog updates should be visible immediately after the CMS commits them.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
    const headers = publicGithubHeaders();
    const listingUrl = `${base}?ref=${encodeURIComponent(branchName())}`;

    const listingResponse = await fetch(listingUrl, {
      headers,
      cache: 'no-store'
    });

    if (listingResponse.status === 404) return res.status(200).json([]);

    const listing = await listingResponse.json().catch(() => null);
    if (!listingResponse.ok) {
      console.error('[KDH Public Posts] Unable to list articles', {
        status: listingResponse.status,
        githubRequestId: listingResponse.headers.get('x-github-request-id') || 'unknown',
        message: listing?.message || ''
      });
      return res.status(502).json({ error: 'Could not fetch posts' });
    }

    if (!Array.isArray(listing)) return res.status(200).json([]);

    const files = listing
      .filter((item) => item?.type === 'file' && String(item.name || '').endsWith('.json'))
      .slice(0, 100);

    const posts = await Promise.all(files.map((file) => readPostFile(file, headers)));

    const validPosts = posts
      .filter((post) => post && post.slug && isPublic(post))
      .sort((a, b) => new Date(publicationTime(b)) - new Date(publicationTime(a)));

    return res.status(200).json(validPosts);
  } catch (error) {
    console.error('[KDH Public Posts] Unexpected error', {
      message: error?.message || 'Unknown error'
    });
    return res.status(500).json({ error: 'Could not fetch posts' });
  }
};
