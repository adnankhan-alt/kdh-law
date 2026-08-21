const site = require('../../../content/site.json');
const { branchName, repoName } = require('../../lib/cms');

const ORIGIN = 'https://www.kdhadvocates.com';

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(value) {
  return String(value || '').toLowerCase().trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function publicGithubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KDH-Website-Sitemap',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isPublic(post) {
  const status = String(post?.status || 'published').toLowerCase();
  if (status === 'published') return true;
  if (status !== 'scheduled') return false;
  const when = Date.parse(post.scheduledAt || '');
  return Number.isFinite(when) && when <= Date.now();
}

async function publishedPosts() {
  const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
  const headers = publicGithubHeaders();
  const listResponse = await fetch(`${base}?ref=${encodeURIComponent(branchName())}`, { headers, cache: 'no-store' });
  if (listResponse.status === 404) return [];
  if (!listResponse.ok) return [];
  const files = await listResponse.json();
  if (!Array.isArray(files)) return [];
  const posts = await Promise.all(files.filter((file) => file?.type === 'file' && String(file.name || '').endsWith('.json')).slice(0, 200).map(async (file) => {
    try {
      const url = `${base}/${encodeURIComponent(file.name)}?ref=${encodeURIComponent(branchName())}`;
      const response = await fetch(url, { headers, cache: 'no-store' });
      if (!response.ok) return null;
      const payload = await response.json();
      const post = JSON.parse(Buffer.from(payload.content || '', 'base64').toString('utf8'));
      return isPublic(post) ? post : null;
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

  for (const practice of site.practices || []) {
    const slug = slugify(practice.slug || practice.title);
    if (slug) urls.push({ loc: `${ORIGIN}/expertise/${slug}` });
  }
  for (const person of site.team || []) {
    const slug = slugify(person.id || person.name);
    if (slug) urls.push({ loc: `${ORIGIN}/team/${slug}` });
  }

  try {
    const posts = await publishedPosts();
    for (const post of posts) {
      const slug = slugify(post.slug);
      if (!slug) continue;
      urls.push({
        loc: `${ORIGIN}/insights/${slug}`,
        lastmod: post.updatedAt || post.date || post.scheduledAt || now
      });
    }
  } catch {
    // Static, practice and team URLs remain useful if GitHub is temporarily unavailable.
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
