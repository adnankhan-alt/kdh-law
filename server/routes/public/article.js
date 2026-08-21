const site = require('../../../content/site.json');
const { branchName, repoName } = require('../../lib/cms');
const { listPublishedPosts, readPublishedPost, publicationDate } = require('../../lib/public-posts');

const ORIGIN = 'https://www.kdhadvocates.com';

function companySameAs() {
  const social = site.social || {};
  return [social.linkedin, social.facebook, social.x || social.twitter]
    .map((value) => String(value || '').trim())
    .filter((value) => /^https:\/\//i.test(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    'User-Agent': 'KDH-Website-Article',
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

function safeArticleHtml(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function readingMinutes(html) {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function absoluteImage(value) {
  if (!value) return `${ORIGIN}/assets/kdh-law-logo.jpg`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${ORIGIN}/${String(value).replace(/^\//, '')}`;
}

function truncate(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function validIso(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

async function readPost(slug) {
  const fileName = `${slugify(slug)}.json`;
  const url = `https://api.github.com/repos/${repoName()}/contents/content/posts/${encodeURIComponent(fileName)}?ref=${encodeURIComponent(branchName())}`;
  const response = await fetch(url, { headers: publicGithubHeaders(), cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const payload = await response.json();
  if (!payload?.content) return null;
  return JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'));
}

function matchAuthor(authorName) {
  const needle = String(authorName || '').toLowerCase().trim();
  if (!needle) return null;
  return (site.team || []).find((person) => String(person.name || '').toLowerCase().trim() === needle) || null;
}

function tokenSet(value) {
  const stop = new Set(['with','from','that','this','your','their','into','about','legal','law','kenya','kenyan','advocates','business','commercial']);
  return new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !stop.has(word)));
}

function practiceScore(post, practice) {
  const declared = String(post?.practiceArea || '').trim().toLowerCase();
  const title = String(practice?.title || '').trim().toLowerCase();
  if (declared && title && declared === title) return 100;
  const haystack = `${post?.title || ''} ${post?.summary || ''} ${stripHtml(post?.content || '')}`.toLowerCase();
  let score = title && haystack.includes(title.replace(/&/g, 'and')) ? 12 : 0;
  const words = tokenSet(`${practice?.title || ''} ${(practice?.services || []).join(' ')}`);
  for (const word of words) if (haystack.includes(word)) score += 1;
  return score;
}

function matchPractice(post) {
  const ranked = (site.practices || []).map((practice) => ({ practice, score: practiceScore(post, practice) })).sort((a,b) => b.score-a.score);
  return ranked[0]?.score >= 2 ? ranked[0].practice : null;
}

function relatedPostsFor(post, posts, primaryPractice) {
  const sourceWords = tokenSet(`${post.title || ''} ${post.summary || ''} ${primaryPractice?.title || ''}`);
  return posts.filter((candidate) => candidate.slug !== post.slug).map((candidate) => {
    let score = 0;
    if (primaryPractice && String(candidate.practiceArea || '').toLowerCase() === String(primaryPractice.title || '').toLowerCase()) score += 8;
    const text = `${candidate.title || ''} ${candidate.summary || ''}`.toLowerCase();
    for (const word of sourceWords) if (text.includes(word)) score += 1;
    return { candidate, score };
  }).sort((a,b) => b.score-a.score || (Date.parse(publicationDate(b.candidate))||0)-(Date.parse(publicationDate(a.candidate))||0)).filter((item) => item.score > 0).slice(0,3).map((item)=>item.candidate);
}

function render404(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(404).send('<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Insight not found | KDH Advocates</title></head><body><main><h1>Insight not found</h1><p><a href="/insights">View KDH Insights</a></p></main></body></html>');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const slug = slugify(req.query?.slug || '');
  if (!slug) return render404(res);

  try {
    const post = await readPublishedPost(slug);
    if (!post) return render404(res);
    const allPosts = await listPublishedPosts({ limit: 200 });

    const canonical = `${ORIGIN}/insights/${encodeURIComponent(post.slug || slug)}`;
    const seoTitle = post.seoTitle || post.title || 'KDH Insight';
    const title = /KDH Advocates/i.test(seoTitle) ? seoTitle : `${seoTitle} | KDH Advocates`;
    const description = truncate(post.seoDescription || post.summary || stripHtml(post.content), 158);
    const image = absoluteImage(post.coverImage || site.seo?.ogImage);
    const published = publicationDate(post);
    const modified = post.updatedAt || published;
    const authorPerson = matchAuthor(post.author);
    const authorSlug = authorPerson ? slugify(authorPerson.id || authorPerson.name) : '';
    const authorUrl = authorPerson ? `${ORIGIN}/team/${authorSlug}` : `${ORIGIN}/#team`;
    const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}`;
    const facebookShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}`;
    const xShare = `https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(post.title || 'KDH Insight')}`;
    const primaryPractice = matchPractice(post);
    const practiceSlug = primaryPractice ? slugify(primaryPractice.slug || primaryPractice.title) : '';
    const practiceUrl = primaryPractice ? `${ORIGIN}/expertise/${practiceSlug}` : '';
    const relatedPosts = relatedPostsFor(post, allPosts, primaryPractice);

    const authorSchema = authorPerson ? {
      '@type': 'Person',
      '@id': `${authorUrl}#person`,
      name: authorPerson.name,
      url: authorUrl,
      ...(authorPerson.role ? { jobTitle: authorPerson.role } : {}),
      ...(authorPerson.image ? { image: absoluteImage(authorPerson.image) } : {}),
      ...(authorPerson.linkedin ? { sameAs: [String(authorPerson.linkedin).replace(/^http:\/\//i, 'https://')] } : {})
    } : { '@type': 'Organization', '@id': `${ORIGIN}/#legal-service`, name: 'KDH Advocates LLP', url: `${ORIGIN}/` };

    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: title,
          description,
          isPartOf: { '@id': `${ORIGIN}/#website` },
          breadcrumb: { '@id': `${canonical}#breadcrumb` },
          mainEntity: { '@id': `${canonical}#article` }
        },
        {
          '@type': 'BlogPosting',
          '@id': `${canonical}#article`,
          headline: post.title,
          description,
          image: [image],
          mainEntityOfPage: { '@id': `${canonical}#webpage` },
          isPartOf: { '@type': 'Blog', '@id': `${ORIGIN}/insights#blog`, name: 'KDH Insights', url: `${ORIGIN}/insights` },
          ...(validIso(published) ? { datePublished: validIso(published) } : {}),
          ...(validIso(modified) ? { dateModified: validIso(modified) } : {}),
          author: authorSchema,
          publisher: { '@id': `${ORIGIN}/#legal-service` },
          ...(primaryPractice ? {
            articleSection: primaryPractice.title,
            about: { '@type': 'Service', '@id': `${practiceUrl}#service`, name: primaryPractice.title, url: practiceUrl }
          } : {}),
          wordCount: stripHtml(post.content || '').split(/\s+/).filter(Boolean).length
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Insights', item: `${ORIGIN}/insights` },
            { '@type': 'ListItem', position: 3, name: post.title, item: canonical }
          ]
        }
      ]
    };

    const authorHtml = authorPerson
      ? `<a href="/team/${encodeURIComponent(authorSlug)}">${escapeHtml(authorPerson.name)}</a>`
      : escapeHtml(post.author || 'KDH Advocates LLP');
    const authorLinkedIn = authorPerson?.linkedin ? String(authorPerson.linkedin).replace(/^http:\/\//i, 'https://') : '';
    const authorImage = authorPerson?.image ? absoluteImage(authorPerson.image) : '';
    const authorInitials = authorPerson ? String(authorPerson.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '';
    const authorCard = authorPerson ? `<aside class="article-author-card" aria-label="Article author">
      <a class="article-author-avatar" href="/team/${encodeURIComponent(authorSlug)}" aria-label="View ${escapeHtml(authorPerson.name)} profile">${authorImage ? `<img src="${escapeHtml(authorImage)}" alt="${escapeHtml(authorPerson.alt || authorPerson.name)}">` : `<span aria-hidden="true">${escapeHtml(authorInitials)}</span>`}</a>
      <div class="article-author-copy"><span class="article-author-label">Written by</span><strong><a href="/team/${encodeURIComponent(authorSlug)}">${escapeHtml(authorPerson.name)}</a></strong>${authorPerson.role ? `<span class="article-author-role">${escapeHtml(authorPerson.role)}</span>` : ''}<div class="article-author-links"><a href="/team/${encodeURIComponent(authorSlug)}">KDH profile</a>${authorLinkedIn ? `<a href="${escapeHtml(authorLinkedIn)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>` : ''}</div></div>
    </aside>` : '';
    const relatedPracticeHtml = primaryPractice ? `<div class="article-topic"><span>Related practice</span><a href="/expertise/${encodeURIComponent(practiceSlug)}">${escapeHtml(primaryPractice.title)} ↗</a></div>` : '';
    const relatedInsightsHtml = relatedPosts.length ? `<section class="article-related" aria-labelledby="related-insights-title"><div class="article-related-head"><p>Continue reading</p><h2 id="related-insights-title">Related KDH Insights</h2></div><div class="article-related-grid">${relatedPosts.map((item) => `<article><span>${escapeHtml(formatDate(publicationDate(item)))}</span><h3><a href="/insights/${encodeURIComponent(slugify(item.slug))}">${escapeHtml(item.title)}</a></h3><a class="related-read" href="/insights/${encodeURIComponent(slugify(item.slug))}">Read insight ↗</a></article>`).join('')}</div></section>` : '';
    const summary = post.summary ? `<p class="article-deck">${escapeHtml(post.summary)}</p>` : '';
    const cover = post.coverImage
      ? `<img src="${escapeHtml(image)}" class="article-cover" alt="${escapeHtml(post.title || 'KDH Advocates insight')}" fetchpriority="high"><div class="article-cover-shade"></div>`
      : '<div class="article-cover-placeholder" aria-hidden="true"></div>';
    const content = safeArticleHtml(post.content || '');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#001759">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="en_KE">
  <meta property="og:site_name" content="KDH Advocates LLP">
  <meta property="og:title" content="${escapeHtml(post.title || seoTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(post.title || 'KDH Advocates insight')}">
  ${validIso(published) ? `<meta property="article:published_time" content="${escapeHtml(validIso(published))}">` : ''}
  ${validIso(modified) ? `<meta property="article:modified_time" content="${escapeHtml(validIso(modified))}">` : ''}
  ${primaryPractice ? `<meta property="article:section" content="${escapeHtml(primaryPractice.title)}">` : ''}
  ${authorPerson ? `<meta property="article:author" content="${escapeHtml(authorUrl)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(post.title || seoTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="twitter:image:alt" content="${escapeHtml(post.title || 'KDH Advocates insight')}">
  <link rel="alternate" type="application/rss+xml" title="KDH Insights RSS" href="/feed.xml">
  ${authorPerson ? `<link rel="author" href="/team/${encodeURIComponent(authorSlug)}">` : ''}
  <link rel="icon" type="image/png" href="/assets/kdh-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=13">
  <script type="application/ld+json">${jsonLd(schema)}</script>
  <style>
    body.article-page{background:#f7f6f2;color:#17213a}.article-page .site-header{position:fixed;background:rgba(255,255,255,.96);color:var(--navy);box-shadow:0 1px 0 rgba(0,23,89,.1);backdrop-filter:blur(18px)}.article-page .site-header .brand-logo img{filter:none}.article-progress{position:fixed;z-index:1200;top:0;left:0;width:0;height:3px;background:var(--gold-bright)}.article-cover-wrap{padding-top:var(--header-height);background:#0a163d}.article-cover-frame{width:100%;height:min(54vw,680px);min-height:390px;position:relative;overflow:hidden}.article-cover{width:100%;height:100%;object-fit:cover}.article-cover-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,12,51,.06),rgba(0,12,51,.35))}.article-cover-placeholder{width:100%;height:100%;background:linear-gradient(135deg,var(--navy-deep),#193276)}.article-shell{width:min(calc(100% - 2 * var(--section-x)),1220px);margin:-7rem auto 0;position:relative;z-index:2;background:#fff;box-shadow:0 35px 90px rgba(0,15,55,.08)}.article-header{padding:clamp(2.6rem,5vw,5rem) clamp(2rem,7vw,7rem) clamp(2.3rem,4vw,4rem);text-align:center}.article-kicker{color:var(--gold);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.14em}.article-header h1{max-width:980px;margin:.9rem auto 1.15rem;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:clamp(2.2rem,3.6vw,4.15rem);font-weight:500;line-height:1.04;letter-spacing:-.035em}.article-deck{max-width:820px;margin:0 auto 1.45rem;color:var(--slate);font-size:clamp(1rem,1.4vw,1.18rem);line-height:1.72}.article-meta{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:.6rem 1.25rem;color:#6b7282;font-size:.73rem}.article-meta a{color:var(--navy);font-weight:800}.article-author-card{width:min(100%,620px);margin:1.6rem auto .35rem;padding:1rem 1.15rem;display:flex;align-items:center;gap:1rem;border:1px solid rgba(0,23,89,.11);background:#fbfaf7;text-align:left}.article-author-avatar{width:72px;height:72px;flex:0 0 72px;border-radius:50%;overflow:hidden;background:var(--navy);display:grid;place-items:center;color:#fff;font-weight:800;text-decoration:none}.article-author-avatar img{width:100%;height:100%;object-fit:cover}.article-author-avatar span{font-size:1rem;letter-spacing:.04em}.article-author-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start}.article-author-label{margin-bottom:.15rem;color:var(--gold);font-size:.62rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.article-author-copy strong{font-family:"Playfair Display",Georgia,serif;font-size:1.18rem;font-weight:600;line-height:1.2}.article-author-copy strong a{color:var(--navy)}.article-author-role{margin-top:.14rem;color:#626b7c;font-size:.73rem}.article-author-links{display:flex;gap:.85rem;margin-top:.45rem}.article-author-links a{color:var(--navy);font-size:.68rem;font-weight:800;text-decoration:underline;text-underline-offset:3px}.article-share-top{display:flex;justify-content:center;margin-top:1.4rem}.linkedin-share,.social-share{display:inline-flex;align-items:center;gap:.55rem;padding:.75rem 1rem;border:1px solid rgba(10,102,194,.25);color:#0a66c2;font-size:.76rem;font-weight:800;background:#f7fbff}.article-share-top{gap:.65rem;flex-wrap:wrap}.social-share{border-color:rgba(0,23,89,.16);color:var(--navy);background:#fff}.article-body-wrap{padding:0 clamp(2rem,7vw,7rem) clamp(3rem,6vw,5rem)}.article-content{width:min(100%,900px);margin:auto;font-size:clamp(1.02rem,1.15vw,1.14rem);line-height:1.82;color:#202634}.article-content h1,.article-content h2,.article-content h3{font-family:"Playfair Display",Georgia,serif;color:var(--navy);font-weight:500;letter-spacing:-.02em}.article-content h1{margin:3rem 0 1rem;font-size:clamp(1.9rem,2.6vw,2.8rem);line-height:1.12}.article-content h2{margin:2.8rem 0 .9rem;font-size:clamp(1.65rem,2.15vw,2.35rem);line-height:1.14}.article-content h3{margin:2.2rem 0 .75rem;font-size:clamp(1.3rem,1.55vw,1.7rem);line-height:1.2}.article-content p{margin:0 0 1.55rem}.article-content ul,.article-content ol{margin:0 0 1.8rem;padding-left:1.4rem}.article-content li{margin:.55rem 0}.article-content img{display:block;width:min(1120px,calc(100vw - 2 * var(--section-x)));max-width:none;margin:2.8rem 50%;transform:translateX(-50%);height:auto}.article-content blockquote{margin:2.7rem 0;padding:1.2rem 0 1.2rem 1.6rem;border-left:3px solid var(--gold-bright);color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:1.35rem;line-height:1.55}.article-end{width:min(100%,900px);margin:4rem auto 0;padding-top:1.5rem;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:1rem}.article-end a{font-size:.78rem;font-weight:800}.article-end-share{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}.article-consult{color:var(--gold)}.article-footer-cta{width:min(calc(100% - 2 * var(--section-x)),1220px);margin:clamp(3rem,6vw,6rem) auto;background:var(--navy-deep);color:#fff}.article-footer-cta-inner{padding:clamp(2.5rem,5vw,4.5rem);display:flex;justify-content:space-between;align-items:center;gap:2rem}.article-footer-cta p{margin:0 0 .5rem;color:var(--gold-bright);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em}.article-footer-cta h2{margin:0;max-width:720px;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(1.9rem,3vw,3.2rem);font-weight:500;line-height:1.08}.article-topic{width:min(100%,900px);margin:1.5rem auto 0;padding:1rem 1.15rem;background:#fbfaf7;border:1px solid rgba(0,23,89,.1);display:flex;justify-content:space-between;gap:1rem;align-items:center}.article-topic span{color:var(--gold);font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.article-topic a{color:var(--navy);font-size:.78rem;font-weight:800}.article-related{width:min(calc(100% - 2 * var(--section-x)),1220px);margin:clamp(3rem,6vw,5rem) auto}.article-related-head p{margin:0;color:var(--gold);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em}.article-related-head h2{margin:.4rem 0 1.4rem;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:clamp(1.8rem,2.8vw,2.7rem);font-weight:500}.article-related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.article-related-grid article{padding:1.4rem;background:#fff;border:1px solid rgba(0,23,89,.1)}.article-related-grid span{color:var(--gold);font-size:.64rem;font-weight:800;text-transform:uppercase}.article-related-grid h3{margin:.55rem 0 1rem;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:1.2rem;line-height:1.2}.related-read{font-size:.7rem;font-weight:800;color:var(--navy)}@media(max-width:900px){.article-related-grid{grid-template-columns:1fr}.article-page .site-header nav{background:#fff;color:var(--navy)}.article-shell{margin-top:-3rem}.article-footer-cta-inner{align-items:flex-start;flex-direction:column}}@media(max-width:640px){.article-cover-frame{height:320px;min-height:320px}.article-header h1{font-size:clamp(2rem,8.6vw,2.8rem)}.article-end{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body class="article-page">
  <div class="article-progress" id="article-progress" aria-hidden="true"></div>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header scrolled" data-header><a class="brand brand-logo" href="/" aria-label="KDH Advocates home"><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"></a><button class="menu" type="button" aria-expanded="false" aria-controls="nav"><span>Menu</span><i aria-hidden="true"></i></button><nav id="nav" aria-label="Primary navigation"><a class="active" href="/insights">Insights</a><a href="/the-firm">The firm</a><a href="/expertise">Expertise</a><a href="/africa">Africa</a><a href="/team">Team</a><a class="nav-cta" href="/contact">Consultation</a></nav></header>
  <main id="main">
    <div class="article-cover-wrap"><div class="article-cover-frame">${cover}</div></div>
    <article class="article-shell">
      <header class="article-header"><div class="article-kicker">KDH Insights</div><h1>${escapeHtml(post.title || 'KDH Insight')}</h1>${summary}<div class="article-meta"><span>${escapeHtml(formatDate(published))}</span>${authorPerson ? '' : `<span>By ${authorHtml}</span>`}<span>${readingMinutes(post.content)} min read</span></div>${authorCard}${relatedPracticeHtml}<div class="article-share-top"><a class="linkedin-share" href="${escapeHtml(linkedInShare)}" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><a class="social-share" href="${escapeHtml(facebookShare)}" target="_blank" rel="noopener noreferrer">Facebook <span aria-hidden="true">↗</span></a><a class="social-share" href="${escapeHtml(xShare)}" target="_blank" rel="noopener noreferrer">X <span aria-hidden="true">↗</span></a></div></header>
      <div class="article-body-wrap"><div class="article-content">${content}</div><div class="article-end"><a href="/insights">← All insights</a><div class="article-end-share"><a class="linkedin-share" href="${escapeHtml(linkedInShare)}" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><a class="social-share" href="${escapeHtml(facebookShare)}" target="_blank" rel="noopener noreferrer">Facebook <span aria-hidden="true">↗</span></a><a class="social-share" href="${escapeHtml(xShare)}" target="_blank" rel="noopener noreferrer">X <span aria-hidden="true">↗</span></a><a class="article-consult" href="/contact">Discuss this with our team <span aria-hidden="true">↗</span></a></div></div></div>
    </article>
    ${relatedInsightsHtml}
    <section class="article-footer-cta" aria-label="Consult KDH Advocates"><div class="article-footer-cta-inner"><div><p>Strategic legal counsel</p><h2>Need advice on a matter that cannot wait?</h2></div><a class="btn btn-gold" href="/contact">Start a conversation <span aria-hidden="true">↗</span></a></div></section>
  </main>
  <footer><div class="footer-bottom"><small>&copy; 2026 KDH Advocates LLP. All rights reserved.</small><p>Trust. Integrity. Results.</p></div></footer>
  <script>
    const menu=document.querySelector('.menu'),nav=document.querySelector('#nav');menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('open',!open)});nav?.querySelectorAll('a').forEach((link)=>link.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false')}));
    function updateProgress(){const article=document.querySelector('.article-shell'),bar=document.getElementById('article-progress');if(!article||!bar)return;const start=article.offsetTop,end=start+article.offsetHeight-window.innerHeight,ratio=end<=start?1:Math.min(1,Math.max(0,(window.scrollY-start)/(end-start)));bar.style.width=(ratio*100)+'%'}window.addEventListener('scroll',updateProgress,{passive:true});window.addEventListener('resize',updateProgress);requestAnimationFrame(updateProgress);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[KDH Public Article] Unable to render article', { slug, message: error?.message || 'Unknown error' });
    return res.status(502).send('<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Article unavailable | KDH Advocates</title></head><body><main><h1>Article temporarily unavailable</h1><p><a href="/insights">Return to Insights</a></p></main></body></html>');
  }
};
