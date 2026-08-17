const { branchName, githubHeaders, repoName } = require('./_lib/cms');

const ORIGIN = 'https://www.kdhadvocates.com';

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function publicPost(post) {
  const status = post.status || 'published';
  if (status === 'published') return true;
  if (status !== 'scheduled') return false;
  const when = Date.parse(post.scheduledAt || '');
  return Number.isFinite(when) && when <= Date.now();
}

async function publishedPosts() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];
  const headers = githubHeaders(token);
  const listUrl = `https://api.github.com/repos/${repoName()}/contents/content/posts?ref=${encodeURIComponent(branchName())}`;
  const listResponse = await fetch(listUrl, { headers });
  if (listResponse.status === 404) return [];
  if (!listResponse.ok) return [];
  const files = await listResponse.json();
  const posts = await Promise.all(files.filter((file) => file.type === 'file' && file.name.endsWith('.json')).slice(0, 200).map(async (file) => {
    try {
      const response = await fetch(`${file.url}?ref=${encodeURIComponent(branchName())}`, { headers });
      if (!response.ok) return null;
      const payload = await response.json();
      const post = JSON.parse(Buffer.from(payload.content || '', 'base64').toString('utf8'));
      return publicPost(post) ? post : null;
    } catch {
      return null;
    }
  }));
  return posts.filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const now = new Date().toISOString();
  const urls = [
    { loc: `${ORIGIN}/` },
    { loc: `${ORIGIN}/insights` },
    { loc: `${ORIGIN}/privacy` },
    { loc: `${ORIGIN}/cookies` }
  ];
  try {
    const posts = await publishedPosts();
    for (const post of posts) {
      if (!post.slug) continue;
      urls.push({
        loc: `${ORIGIN}/article?slug=${encodeURIComponent(post.slug)}`,
        lastmod: post.updatedAt || post.date || post.scheduledAt || now
      });
    }
  } catch {
    // Static sitemap entries still remain useful if GitHub is temporarily unavailable.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((item) => {
    let lastmod = '';
    if (item.lastmod) {
      const parsed = new Date(item.lastmod);
      if (!Number.isNaN(parsed.getTime())) lastmod = `<lastmod>${xmlEscape(parsed.toISOString())}</lastmod>`;
    }
    return `  <url><loc>${xmlEscape(item.loc)}</loc>${lastmod}</url>`;
  }).join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(body);
};
