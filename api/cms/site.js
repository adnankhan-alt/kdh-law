const {
  readGitFile,
  readGitJson,
  requireCms,
  sendError,
  writeGitFile,
  writeGitJson
} = require('../_lib/cms');

const SITE_PATH = 'content/site.json';
const HOME_PATH = 'index.html';

function asString(value, max = 5000) {
  return typeof value === 'string' && value.length <= max;
}

function validSite(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 700000) return false;
  if (value.seo && (!asString(value.seo.title, 180) || !asString(value.seo.description, 500))) return false;
  if (value.practices && !Array.isArray(value.practices)) return false;
  if (value.team && !Array.isArray(value.team)) return false;
  return true;
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceOrInsertMeta(html, name, content) {
  const escaped = escapeAttribute(content);
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${escaped}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceOrInsertProperty(html, property, content) {
  const escaped = escapeAttribute(content);
  const re = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  const tag = `<meta property="${property}" content="${escaped}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function syncSeo(html, seo = {}) {
  const title = seo.title || 'KDH Advocates LLP | Trust. Integrity. Results.';
  const description = seo.description || 'KDH Advocates LLP is a premier commercial law firm in Nairobi providing strategic legal advisory and dispute resolution across Africa.';
  const robots = seo.robots || 'index,follow';
  const canonical = seo.canonical || 'https://www.kdhadvocates.com/';
  const ogImage = seo.ogImage || 'https://www.kdhadvocates.com/assets/kdh-law-logo.jpg';

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttribute(title)}</title>`);
  html = replaceOrInsertMeta(html, 'description', description);
  html = replaceOrInsertMeta(html, 'robots', robots);
  html = replaceOrInsertProperty(html, 'og:title', title);
  html = replaceOrInsertProperty(html, 'og:description', description);
  html = replaceOrInsertProperty(html, 'og:type', 'website');
  html = replaceOrInsertProperty(html, 'og:url', canonical);
  html = replaceOrInsertProperty(html, 'og:image', ogImage);
  html = replaceOrInsertMeta(html, 'twitter:card', 'summary_large_image');
  html = replaceOrInsertMeta(html, 'twitter:title', title);
  html = replaceOrInsertMeta(html, 'twitter:description', description);
  html = replaceOrInsertMeta(html, 'twitter:image', ogImage);

  const canonicalTag = `<link rel="canonical" href="${escapeAttribute(canonical)}">`;
  const canonicalRe = /<link\s+rel=["']canonical["'][^>]*>/i;
  html = canonicalRe.test(html)
    ? html.replace(canonicalRe, canonicalTag)
    : html.replace('</head>', `  ${canonicalTag}\n</head>`);
  return html;
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, req.method === 'GET' ? 'viewer' : 'editor');
  if (!current) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const existing = await readGitJson(current, SITE_PATH);
    if (req.method === 'GET') {
      return res.status(200).json({ content: existing.data, sha: existing.sha });
    }
    if (req.method !== 'PUT') return res.status(405).end();

    const content = req.body?.content;
    if (!validSite(content)) {
      return res.status(400).json({ error: 'The submitted site settings are invalid or too large.' });
    }

    const updated = await writeGitJson(current, SITE_PATH, content, {
      sha: existing.sha,
      message: 'Update site structure from KDH CMS'
    });

    let seoCommit = null;
    try {
      const home = await readGitFile(current, HOME_PATH);
      const synced = syncSeo(home.text, content.seo || {});
      if (synced !== home.text) {
        const seoUpdate = await writeGitFile(current, HOME_PATH, synced, {
          sha: home.sha,
          message: 'Sync homepage SEO from KDH CMS'
        });
        seoCommit = seoUpdate.commit?.sha || null;
      }
    } catch {
      // Site data is still valid and deployable even if the static SEO sync cannot complete.
    }

    return res.status(200).json({
      saved: true,
      commit: updated.commit?.sha || null,
      seoCommit,
      message: 'Site settings saved to GitHub.'
    });
  } catch (error) {
    return sendError(res, error, 'Unable to manage site settings.');
  }
};
