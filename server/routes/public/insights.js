const site = require('../../../content/site.json');
const { ORIGIN, absoluteUrl, listPublishedPosts, publicationDate, slugify, stripHtml } = require('../../lib/public-posts');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function truncate(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function validIso(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function personFor(author) {
  const needle = String(author || '').trim().toLowerCase();
  return (site.team || []).find((person) => String(person.name || '').trim().toLowerCase() === needle) || null;
}

function card(post) {
  const url = `/insights/${encodeURIComponent(slugify(post.slug))}`;
  const absolute = `${ORIGIN}${url}`;
  const image = post.coverImage ? absoluteUrl(post.coverImage) : '';
  const author = personFor(post.author);
  const authorHtml = author
    ? `<a class="card-author" href="/team/${encodeURIComponent(slugify(author.id || author.name))}">${escapeHtml(author.name)}</a>`
    : escapeHtml(post.author || 'KDH Advocates LLP');
  const summary = truncate(post.summary || stripHtml(post.content), 240);
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(post.title || 'KDH Advocates insight')}" loading="lazy" width="800" height="500">`
    : `<div class="card-fallback">KDH Advocates LLP</div>`;
  return `<article class="insight-card">
    <a class="card-media" href="${url}" aria-label="Read ${escapeHtml(post.title)}">${imageHtml}</a>
    <div class="card-body">
      <div class="card-meta"><time datetime="${escapeHtml(validIso(publicationDate(post)))}">${escapeHtml(formatDate(publicationDate(post)))}</time><span>${authorHtml}</span></div>
      <h2><a href="${url}">${escapeHtml(post.title)}</a></h2>
      <p>${escapeHtml(summary)}</p>
      <div class="card-actions"><a href="${url}">Read insight ↗</a><a class="linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absolute)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div>
    </div>
  </article>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const posts = await listPublishedPosts({ limit: 200 });
    const canonical = `${ORIGIN}/insights`;
    const title = 'Legal Insights & Commercial Analysis | KDH Advocates Kenya';
    const description = 'Legal insights from KDH Advocates LLP on Kenyan commercial law, disputes, corporate governance, investment, technology, real estate and business risk.';
    const image = absoluteUrl(site.seo?.ogImage || 'assets/kdh-law-logo.jpg');
    const blogPosts = posts.slice(0, 50).map((post) => {
      const author = personFor(post.author);
      return {
        '@type': 'BlogPosting',
        '@id': `${ORIGIN}/insights/${slugify(post.slug)}#article`,
        headline: post.title,
        url: `${ORIGIN}/insights/${slugify(post.slug)}`,
        ...(validIso(publicationDate(post)) ? { datePublished: validIso(publicationDate(post)) } : {}),
        author: author
          ? { '@type': 'Person', '@id': `${ORIGIN}/team/${slugify(author.id || author.name)}#person`, name: author.name }
          : { '@type': 'Organization', '@id': `${ORIGIN}/#legal-service`, name: 'KDH Advocates LLP' }
      };
    });
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description,
          isPartOf: { '@id': `${ORIGIN}/#website` }, breadcrumb: { '@id': `${canonical}#breadcrumb` },
          mainEntity: { '@id': `${canonical}#blog` }
        },
        {
          '@type': 'Blog', '@id': `${canonical}#blog`, name: 'KDH Insights', url: canonical, description,
          publisher: { '@id': `${ORIGIN}/#legal-service` }, blogPost: blogPosts
        },
        {
          '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Insights', item: canonical }
          ]
        }
      ]
    };

    const cards = posts.length ? posts.map(card).join('') : '<div class="empty">No insights published yet.</div>';
    const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}"><link rel="alternate" type="application/rss+xml" title="KDH Insights RSS" href="/feed.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="KDH Advocates LLP"><meta property="og:locale" content="en_KE"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="KDH Advocates LLP">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="icon" href="/assets/kdh-favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css?v=15">
<script type="application/ld+json">${jsonLd(schema)}</script>
<style>
body{background:#f7f6f2;color:#17213a}.site-header{position:fixed;background:rgba(255,255,255,.97);color:var(--navy);box-shadow:0 1px 0 rgba(0,23,89,.1);backdrop-filter:blur(18px)}.site-header .brand-logo img{filter:none}.hero-i{padding:calc(var(--header-height) + clamp(3rem,6vw,6rem)) var(--section-x) clamp(3.2rem,5vw,5rem);background:var(--navy-deep);color:#fff}.hero-inner{width:min(100%,var(--max));margin:auto;display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(2rem,6vw,6rem);align-items:end}.hero-i .eyebrow{color:var(--gold-bright)}.hero-i h1{margin:.6rem 0 0;max-width:820px;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(2.7rem,5.2vw,5.1rem);font-weight:500;line-height:.98;letter-spacing:-.04em}.hero-i p:last-child{max-width:560px;color:rgba(255,255,255,.72);line-height:1.75}.main-i{width:min(calc(100% - 2 * var(--section-x)),1500px);margin:auto;padding:clamp(3rem,5vw,5rem) 0 clamp(5rem,8vw,8rem)}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding-bottom:1.2rem;margin-bottom:1.5rem;border-bottom:1px solid var(--line)}.count{font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.toggle{display:flex;background:#fff;border:1px solid rgba(0,23,89,.14);border-radius:999px;padding:3px}.toggle button{border:0;background:transparent;border-radius:999px;padding:.58rem .85rem;font:inherit;font-size:.72rem;font-weight:800;color:var(--slate);cursor:pointer}.toggle button[aria-pressed="true"]{background:var(--navy);color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:clamp(1.1rem,1.8vw,1.7rem)}.grid[data-count="1"]{grid-template-columns:minmax(0,760px);justify-content:center}.grid[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr));max-width:1120px;margin:auto}.insight-card{min-width:0;background:#fff;border:1px solid rgba(12,23,48,.1);display:flex;flex-direction:column;overflow:hidden}.card-media{display:block;aspect-ratio:16/10;overflow:hidden;background:var(--navy-deep)}.card-media img{width:100%;height:100%;object-fit:cover;display:block}.card-fallback{height:100%;display:grid;place-items:center;color:#fff;font-family:"Playfair Display",serif}.card-body{padding:clamp(1.2rem,1.7vw,1.7rem);display:flex;flex:1;flex-direction:column}.card-meta{display:flex;gap:.5rem .8rem;flex-wrap:wrap;margin-bottom:.7rem;color:var(--gold);font-size:.64rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.card-author{color:inherit}.insight-card h2{margin:0 0 .75rem;font-family:"Playfair Display",serif;font-size:clamp(1.25rem,1.45vw,1.65rem);line-height:1.12;letter-spacing:-.025em}.insight-card h2 a{color:var(--navy)}.insight-card p{margin:0 0 1.2rem;color:var(--slate);font-size:.9rem;line-height:1.65}.card-actions{margin-top:auto;padding-top:1rem;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap}.card-actions a{font-size:.7rem;font-weight:800}.card-actions .linkedin{color:#0a66c2}.grid.list{display:flex;flex-direction:column;max-width:1280px;margin:auto}.list .insight-card{display:grid;grid-template-columns:minmax(250px,34%) minmax(0,1fr);min-height:230px}.list .card-media{height:100%;aspect-ratio:auto}.list .insight-card h2{font-size:clamp(1.4rem,2vw,1.95rem)}.empty{grid-column:1/-1;padding:4rem 2rem;background:#fff;text-align:center}@media(max-width:900px){.site-header nav{background:#fff;color:var(--navy)}.hero-inner{grid-template-columns:1fr}.list .insight-card{grid-template-columns:220px minmax(0,1fr)}}@media(max-width:680px){.main-i{width:min(calc(100% - 2rem),1500px)}.toolbar{align-items:flex-start;flex-direction:column}.grid,.grid[data-count="2"]{grid-template-columns:1fr}.list .insight-card{display:block}.list .card-media{aspect-ratio:16/9}.toggle{align-self:flex-end}}
</style></head><body>
<a class="skip" href="#main">Skip to content</a><header class="site-header scrolled" data-header><a class="brand brand-logo" href="/" aria-label="KDH Advocates home"><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"></a><button class="menu" type="button" aria-expanded="false" aria-controls="nav"><span>Menu</span><i aria-hidden="true"></i></button><nav id="nav" aria-label="Primary navigation"><a class="active" href="/insights">Insights</a><a href="/the-firm">The firm</a><a href="/expertise">Expertise</a><a href="/africa">Africa</a><a href="/team">Team</a><a class="nav-cta" href="/contact">Consultation</a></nav></header>
<main id="main"><section class="hero-i"><div class="hero-inner"><div><p class="eyebrow">KDH Insights</p><h1>Legal analysis for decisions that matter.</h1></div><p>Practical perspectives on Kenyan commercial law, disputes, investment, technology, real estate and the legal issues shaping business across Africa.</p></div></section><section class="main-i"><div class="toolbar"><div class="count">${posts.length} ${posts.length === 1 ? 'publication' : 'publications'}</div><div class="toggle" role="group" aria-label="Choose Insights layout"><button id="grid-view" aria-pressed="true" type="button">Grid</button><button id="list-view" aria-pressed="false" type="button">List</button></div></div><div class="grid" id="grid" data-count="${posts.length}">${cards}</div></section></main>
<footer><div class="footer-bottom"><small>&copy; 2026 KDH Advocates LLP. All rights reserved.</small><p>Trust. Integrity. Results.</p></div></footer>
<script>const m=document.querySelector('.menu'),n=document.querySelector('#nav'),g=document.querySelector('#grid'),a=document.querySelector('#grid-view'),b=document.querySelector('#list-view');m?.addEventListener('click',()=>{const o=m.getAttribute('aria-expanded')==='true';m.setAttribute('aria-expanded',String(!o));n?.classList.toggle('open',!o)});n?.querySelectorAll('a').forEach(x=>x.addEventListener('click',()=>{n.classList.remove('open');m?.setAttribute('aria-expanded','false')}));function v(x,p=true){const l=x==='list';g?.classList.toggle('list',l);a?.setAttribute('aria-pressed',String(!l));b?.setAttribute('aria-pressed',String(l));if(p)try{localStorage.setItem('kdh-insights-view',l?'list':'grid')}catch{}}a?.addEventListener('click',()=>v('grid'));b?.addEventListener('click',()=>v('list'));let s='grid';try{s=localStorage.getItem('kdh-insights-view')||'grid'}catch{}v(s,false);</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[KDH Insights] render failed', error?.message || error);
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    return res.status(503).send('<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Insights temporarily unavailable | KDH Advocates</title></head><body><main><h1>Insights temporarily unavailable</h1><p><a href="/">Return home</a></p></main></body></html>');
  }
};
