const site = require('../../../content/site.json');
const { ORIGIN, absoluteUrl, listPublishedPosts, publicationDate, slugify, stripHtml } = require('../../lib/public-posts');

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function rfc822(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const posts = await listPublishedPosts({ limit: 50 });
    const title = 'KDH Insights';
    const description = 'Commercial legal analysis and strategic perspectives from KDH Advocates LLP, Nairobi, Kenya.';
    const items = posts.map((post) => {
      const link = `${ORIGIN}/insights/${slugify(post.slug)}`;
      const summary = post.summary || stripHtml(post.content).slice(0, 500);
      const image = post.coverImage ? absoluteUrl(post.coverImage) : '';
      return `<item>
<title>${xmlEscape(post.title)}</title>
<link>${xmlEscape(link)}</link>
<guid isPermaLink="true">${xmlEscape(link)}</guid>
<description>${xmlEscape(summary)}</description>
<pubDate>${xmlEscape(rfc822(publicationDate(post)))}</pubDate>
${post.author ? `<dc:creator>${xmlEscape(post.author)}</dc:creator>` : ''}
${image ? `<media:content url="${xmlEscape(image)}" medium="image" />` : ''}
</item>`;
    }).join('\n');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${xmlEscape(title)}</title>
<link>${ORIGIN}/insights</link>
<description>${xmlEscape(description)}</description>
<language>en-ke</language>
<atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />
<image><url>${xmlEscape(absoluteUrl(site.seo?.ogImage || 'assets/kdh-law-logo.jpg'))}</url><title>${xmlEscape(title)}</title><link>${ORIGIN}/insights</link></image>
${items}
</channel>
</rss>`;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
    return res.status(200).send(body);
  } catch (error) {
    console.error('[KDH Feed] unable to render', error?.message || error);
    return res.status(503).end();
  }
};
