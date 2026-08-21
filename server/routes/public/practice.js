const site = require('../../../content/site.json');

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

function truncate(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function practiceSlug(practice) {
  return slugify(practice.slug || practice.title);
}

function personSlug(person) {
  return slugify(person.id || person.name);
}

function absoluteImage(value) {
  if (!value) return `${ORIGIN}/assets/kdh-law-logo.jpg`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${ORIGIN}/${String(value).replace(/^\//, '')}`;
}

function relatedTeam(practice) {
  const haystack = `${practice.title || ''} ${practice.intro || ''} ${(practice.services || []).join(' ')}`.toLowerCase();
  const stop = new Set(['legal', 'relations', 'commercial', 'practice', 'lawyers', 'advocates']);
  return (site.team || []).map((person) => {
    const words = String(person.specialties || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !stop.has(word));
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    return { person, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.person);
}

function render404(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(404).send('<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Practice area not found | KDH Advocates</title></head><body><main><h1>Practice area not found</h1><p><a href="/#expertise">View KDH practice areas</a></p></main></body></html>');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const slug = slugify(req.query?.slug || '');
  const practice = (site.practices || []).find((item) => practiceSlug(item) === slug);
  if (!practice) return render404(res);

  const canonical = `${ORIGIN}/expertise/${practiceSlug(practice)}`;
  const title = practice.seoTitle || `${practice.title} Lawyers in Kenya | KDH Advocates`;
  const description = truncate(practice.seoDescription || `KDH Advocates provides ${practice.title} legal counsel in Nairobi, Kenya. ${practice.intro || ''}`, 158);
  const team = relatedTeam(practice);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
        mainEntity: { '@id': `${canonical}#service` }
      },
      {
        '@type': 'Service',
        '@id': `${canonical}#service`,
        name: `${practice.title} legal services`,
        serviceType: practice.title,
        description: practice.intro || description,
        areaServed: [
          { '@type': 'Country', name: 'Kenya' },
          { '@type': 'Continent', name: 'Africa' }
        ],
        provider: {
          '@type': 'LegalService',
          name: 'KDH Advocates LLP',
          url: `${ORIGIN}/`,
          ...(companySameAs().length ? { sameAs: companySameAs() } : {}),
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'IPS Building, 1st Floor, Kimathi Street',
            addressLocality: 'Nairobi',
            addressCountry: 'KE'
          }
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Expertise', item: `${ORIGIN}/#expertise` },
          { '@type': 'ListItem', position: 3, name: practice.title, item: canonical }
        ]
      }
    ]
  };

  const serviceItems = (practice.services || []).map((service) => `<li>${escapeHtml(service)}</li>`).join('');
  const teamCards = team.length ? team.map((person) => {
    const linkedin = person.linkedin ? `<a class="seo-person-linkedin" href="${escapeHtml(person.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn <b aria-hidden="true">↗</b></a>` : '';
    return `<article class="seo-person-card"><img src="${escapeHtml(absoluteImage(person.image))}" alt="${escapeHtml(person.alt || `${person.name}, ${person.role} at KDH Advocates`)}" loading="lazy"><div><p>${escapeHtml(person.role || '')}</p><h3>${escapeHtml(person.name || '')}</h3><span>${escapeHtml(person.specialties || '')}</span><div class="seo-person-actions"><a href="/team/${encodeURIComponent(personSlug(person))}">View profile <b aria-hidden="true">↗</b></a>${linkedin}</div></div></article>`;
  }).join('') : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#001759">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="KDH Advocates LLP">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(absoluteImage(site.seo?.ogImage))}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="icon" type="image/png" href="/assets/kdh-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=11">
  <script type="application/ld+json">${jsonLd(schema)}</script>
  <style>
    body.seo-detail-page{background:#f7f6f2;color:#17213a}.seo-detail-page .site-header{position:fixed;background:rgba(255,255,255,.97);color:var(--navy);box-shadow:0 1px 0 rgba(0,23,89,.1);backdrop-filter:blur(18px)}.seo-detail-page .site-header .brand-logo img{filter:none}.seo-detail-hero{padding:calc(var(--header-height) + clamp(4rem,8vw,7rem)) var(--section-x) clamp(4rem,7vw,7rem);background:var(--navy-deep);color:white}.seo-detail-inner{width:min(100%,var(--max));margin:auto}.seo-breadcrumb{display:flex;flex-wrap:wrap;gap:.45rem;color:rgba(255,255,255,.58);font-size:.72rem}.seo-breadcrumb a{color:inherit}.seo-detail-hero .eyebrow{margin-top:2.5rem;color:var(--gold-bright)}.seo-detail-hero h1{max-width:1050px;margin:.7rem 0 1.2rem;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(3rem,6.5vw,6.5rem);font-weight:500;line-height:.96;letter-spacing:-.045em}.seo-detail-hero .lead{max-width:830px;margin:0;color:rgba(255,255,255,.76);font-size:clamp(1.05rem,1.4vw,1.25rem);line-height:1.75}.seo-detail-main{width:min(calc(100% - 2 * var(--section-x)),var(--max));margin:auto;padding:clamp(4rem,7vw,7rem) 0}.seo-detail-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:clamp(3rem,7vw,7rem);align-items:start}.seo-detail-main h2{color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:clamp(2.2rem,4vw,4rem);font-weight:500;line-height:1.05}.seo-service-list{list-style:none;padding:0;margin:2rem 0 0;border-top:1px solid var(--line)}.seo-service-list li{padding:1.15rem 0 1.15rem 1.35rem;border-bottom:1px solid var(--line);position:relative;line-height:1.55}.seo-service-list li:before{content:"";position:absolute;left:0;top:1.72rem;width:6px;height:6px;background:var(--gold-bright);border-radius:50%}.seo-side{position:sticky;top:calc(var(--header-height) + 2rem);background:#fff;padding:2rem;border:1px solid rgba(0,23,89,.1)}.seo-side p{color:var(--slate);line-height:1.7}.seo-team-section{margin-top:clamp(5rem,8vw,8rem);padding-top:3rem;border-top:1px solid var(--line)}.seo-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.25rem;margin-top:2rem}.seo-person-card{background:#fff;border:1px solid rgba(0,23,89,.1)}.seo-person-card img{width:100%;aspect-ratio:4/3;object-fit:cover}.seo-person-card div{padding:1.35rem}.seo-person-card p{margin:0 0 .35rem;color:var(--gold);font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.seo-person-card h3{margin:0 0 .5rem;color:var(--navy);font-size:1.2rem}.seo-person-card span{display:block;color:var(--slate);font-size:.86rem;line-height:1.5}.seo-person-actions{display:flex!important;flex-wrap:wrap;gap:.7rem;padding:0!important}.seo-person-actions a{display:inline-flex;margin-top:1rem;color:var(--navy);font-size:.76rem;font-weight:800}.seo-person-linkedin{color:#0a66c2!important}.seo-cta{margin-top:clamp(5rem,8vw,8rem);padding:clamp(2.5rem,5vw,4rem);background:var(--navy-deep);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:2rem}.seo-cta h2{margin:0;color:#fff;font-size:clamp(2rem,3.6vw,3.7rem)}@media(max-width:900px){.seo-detail-page .site-header nav{background:#fff;color:var(--navy)}.seo-detail-grid{grid-template-columns:1fr}.seo-side{position:static}.seo-team-grid{grid-template-columns:1fr 1fr}.seo-cta{align-items:flex-start;flex-direction:column}}@media(max-width:620px){.seo-team-grid{grid-template-columns:1fr}}
  </style>
</head>
<body class="seo-detail-page">
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header scrolled" data-header><a class="brand brand-logo" href="/" aria-label="KDH Advocates home"><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"></a><button class="menu" type="button" aria-expanded="false" aria-controls="nav"><span>Menu</span><i aria-hidden="true"></i></button><nav id="nav" aria-label="Primary navigation"><a href="/#firm">The firm</a><a href="/#expertise">Expertise</a><a href="/#reach">Africa</a><a href="/#team">Team</a><a href="/insights">Insights</a><a class="nav-cta" href="/#contact">Consultation</a></nav></header>
  <main id="main">
    <section class="seo-detail-hero"><div class="seo-detail-inner"><nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/#expertise">Expertise</a><span>/</span><span>${escapeHtml(practice.title)}</span></nav><p class="eyebrow">KDH Expertise · Nairobi, Kenya</p><h1>${escapeHtml(practice.title)}</h1><p class="lead">${escapeHtml(practice.intro || '')}</p></div></section>
    <section class="seo-detail-main"><div class="seo-detail-grid"><div><p class="eyebrow">How we assist</p><h2>Strategic ${escapeHtml(practice.title.toLowerCase())} counsel.</h2><ul class="seo-service-list">${serviceItems}</ul></div><aside class="seo-side"><p class="eyebrow">KDH Advocates LLP</p><h3>Commercially focused legal advice.</h3><p>We combine legal depth with commercial judgement to help clients manage risk, execute transactions and resolve disputes in Kenya and across Africa.</p><a class="btn btn-gold" href="/#contact">Discuss your matter <span aria-hidden="true">↗</span></a></aside></div>${teamCards ? `<section class="seo-team-section"><p class="eyebrow">Relevant experience</p><h2>Meet lawyers working across this area.</h2><div class="seo-team-grid">${teamCards}</div></section>` : ''}<section class="seo-cta"><h2>Need advice on ${escapeHtml(practice.title.toLowerCase())}?</h2><a class="btn btn-gold" href="/#contact">Start a conversation <span aria-hidden="true">↗</span></a></section></section>
  </main>
  <footer><div class="footer-bottom"><small>&copy; 2026 KDH Advocates LLP. All rights reserved.</small><p>Trust. Integrity. Results.</p></div></footer>
  <script src="/script.js?v=11" defer></script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
};
