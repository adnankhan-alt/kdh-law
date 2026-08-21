const { branchName, repoName } = require('./cms');

const ORIGIN = 'https://www.kdhadvocates.com';

function slugify(value) {
  return String(value || '').toLowerCase().trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${ORIGIN}/${raw.replace(/^\//, '')}`;
}

function publicGithubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KDH-Public-Content',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch(url, options = {}) {
  let lastResponse = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastResponse = await fetch(url, {
      ...options,
      headers: { ...publicGithubHeaders(), ...(options.headers || {}) },
      cache: 'no-store'
    });
    if (![500, 502, 503, 504].includes(lastResponse.status)) return lastResponse;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 140 * (attempt + 1)));
  }
  return lastResponse;
}

function isPublic(post, now = Date.now()) {
  const status = String(post?.status || 'published').toLowerCase();
  if (status === 'published') return true;
  if (status !== 'scheduled') return false;
  const when = Date.parse(post?.scheduledAt || '');
  return Number.isFinite(when) && when <= now;
}

function publicationDate(post) {
  return post?.status === 'scheduled' && post?.scheduledAt
    ? post.scheduledAt
    : (post?.date || post?.scheduledAt || post?.updatedAt || '');
}

function sortPublishedPosts(posts) {
  return [...posts].sort((a, b) => {
    const aTime = Date.parse(publicationDate(a)) || 0;
    const bTime = Date.parse(publicationDate(b)) || 0;
    return bTime - aTime;
  });
}

async function readPostFile(fileName) {
  const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
  const url = `${base}/${encodeURIComponent(fileName)}?ref=${encodeURIComponent(branchName())}`;
  const response = await githubFetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const payload = await response.json();
  if (!payload?.content) return null;
  const post = JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'));
  return { ...post, slug: slugify(post.slug || fileName.replace(/\.json$/i, '')) };
}

async function listPublishedPosts({ limit = 200 } = {}) {
  const base = `https://api.github.com/repos/${repoName()}/contents/content/posts`;
  const response = await githubFetch(`${base}?ref=${encodeURIComponent(branchName())}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const files = await response.json();
  if (!Array.isArray(files)) return [];

  const candidates = files
    .filter((file) => file?.type === 'file' && String(file.name || '').endsWith('.json'))
    .slice(0, Math.max(1, Math.min(Number(limit) || 200, 500)));

  const posts = await Promise.all(candidates.map(async (file) => {
    try {
      const post = await readPostFile(file.name);
      return post && isPublic(post) ? post : null;
    } catch {
      return null;
    }
  }));

  return sortPublishedPosts(posts.filter(Boolean));
}

async function readPublishedPost(slug) {
  const normalized = slugify(slug);
  if (!normalized) return null;
  const post = await readPostFile(`${normalized}.json`);
  return post && isPublic(post) ? post : null;
}

module.exports = {
  ORIGIN,
  absoluteUrl,
  isPublic,
  listPublishedPosts,
  publicationDate,
  readPublishedPost,
  slugify,
  stripHtml
};
