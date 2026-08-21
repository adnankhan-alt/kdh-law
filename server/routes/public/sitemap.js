const site = require('../../../content/site.json');
const { ORIGIN, absoluteUrl, listPublishedPosts, publicationDate, slugify } = require('../../lib/public-posts');

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function validLastmod(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function renderUrl(item) {
  const lastmod = validLastmod(item.lastmod);
  const image = item.image ? absoluteUrl(item.image) : '';
  return `  <url><loc>${xmlEscape(item.loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}${image ? `<image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>` : ''}</url>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const urls = [
    { loc: `${ORIGIN}/`, image: site.seo?.ogImage || 'assets/lady-justice.webp' },
    { loc: `${ORIGIN}/the-firm` },
    { loc: `${ORIGIN}/expertise` },
    { loc: `${ORIGIN}/team` },
    { loc: `${ORIGIN}/africa`, image: 'assets/africa-reach.webp' },
    { loc: `${ORIGIN}/insights` },
    { loc: `${ORIGIN}/contact` },
    { loc: `${ORIGIN}/privacy` },
    { loc: `${ORIGIN}/cookies` }
  ];

  for (const practice of site.practices || []) {
    const slug = slugify(practice.slug || practice.title);
    if (slug) urls.push({ loc: `${ORIGIN}/expertise/${slug}` });
  }

  for (const person of site.team || []) {
    const slug = slugify(person.id || person.name);
    if (slug) urls.push({ loc: `${ORIGIN}/team/${slug}`, image: person.image || '' });
  }

  try {
    const posts = await listPublishedPosts({ limit: 500 });
    for (const post of posts) {
      const slug = slugify(post.slug);
      if (!slug) continue;
      urls.push({
        loc: `${ORIGIN}/insights/${slug}`,
        lastmod: post.updatedAt || publicationDate(post),
        image: post.coverImage || ''
      });
    }
  } catch (error) {
    console.error('[KDH Sitemap] article discovery failed', error?.message || error);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map(renderUrl).join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(body);
};
