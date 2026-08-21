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

function absoluteImage(value) {
  if (!value) return `${ORIGIN}/assets/kdh-law-logo.jpg`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${ORIGIN}/${String(value).replace(/^\//, '')}`;
}

function personSlug(person) {
  return slugify(person.id || person.name);
}

function practiceSlug(practice) {
  return slugify(practice.slug || practice.title);
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function relatedPractices(person) {
  const focus = String(person.specialties || '').toLowerCase();
  const stop = new Set(['legal', 'relations', 'commercial', 'practice', 'lawyers', 'advocates']);
  const words = focus.split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !stop.has(word));
  return (site.practices || []).map((practice) => {
    const haystack = `${practice.title || ''} ${practice.intro || ''} ${(practice.services || []).join(' ')}`.toLowerCase();
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    return { practice, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map((item) => item.practice);
}

function render404(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(404).send('<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Team member not found | KDH Advocates</title></head><body><main><h1>Team member not found</h1><p><a href="/#team">Meet the KDH team</a></p></main></body></html>');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const slug = slugify(req.query?.slug || '');
  const person = (site.team || []).find((item) => personSlug(item) === slug);
  if (!person) return render404(res);

  const canonical = `${ORIGIN}/team/${personSlug(person)}`;
  const title = person.seoTitle || `${person.name} | ${person.role} | KDH Advocates Kenya`;
  const description = truncate(person.seoDescription || `Meet ${person.name}, ${person.role} at KDH Advocates LLP in Nairobi. Focus: ${person.specialties || 'commercial legal services'}.`, 158);
  const image = absoluteImage(person.image);
  const practices = relatedPractices(person);
  const sameAs = person.linkedin ? [person.linkedin] : undefined;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${canonical}#profile`,
        url: canonical,
        name: title,
        description,
        mainEntity: { '@id': `${canonical}#person` },
        breadcrumb: { '@id': `${canonical}#breadcrumb` }
      },
      {
        '@type': 'Person',
        '@id': `${canonical}#person`,
        name: person.name,
        jobTitle: person.role,
        description: (person.bio || [description])[0],
        image,
        url: canonical,
        ...(sameAs ? { sameAs } : {}),
        knowsAbout: String(person.specialties || '').split(/,|&/).map((item) => item.trim()).filter(Boolean),
        worksFor: {
          '@type': 'LegalService',
          name: 'KDH Advocates LLP',
          url: `${ORIGIN}/`,
          ...(companySameAs().length ? { sameAs: companySameAs() } : {})
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Team', item: `${ORIGIN}/#team` },
          { '@type': 'ListItem', position: 3, name: person.name, item: canonical }
        ]
      }
    ]
  };

  const qualifications = (person.qualifications || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const bio = (person.bio || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const practiceLinks = practices.length
    ? practices.map((practice) => `<a href="/expertise/${encodeURIComponent(practiceSlug(practice))}">${escapeHtml(practice.title)} <span aria-hidden="true">↗</span></a>`).join('')
    : '<a href="/#expertise">View all practice areas <span aria-hidden="true">↗</span></a>';
  const linkedInButton = person.linkedin
    ? `<a class="profile-linkedin" href="${escapeHtml(person.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn profile <span aria-hidden="true">↗</span></a>`
    : '';

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
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="KDH Advocates LLP">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="icon" type="image/png" href="/assets/kdh-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=11">
  <script type="application/ld+json">${jsonLd(schema)}</script>
  <style>
    body.seo-profile-page{background:#f7f6f2;color:#17213a}.seo-profile-page .site-header{position:fixed;background:rgba(255,255,255,.97);color:var(--navy);box-shadow:0 1px 0 rgba(0,23,89,.1);backdrop-filter:blur(18px)}.seo-profile-page .site-header .brand-logo img{filter:none}.profile-hero{padding:calc(var(--header-height) + clamp(3rem,6vw,5rem)) var(--section-x) clamp(3.5rem,6vw,6rem);background:var(--navy-deep);color:#fff}.profile-hero-inner{width:min(100%,var(--max));margin:auto;display:grid;grid-template-columns:minmax(250px,.68fr) minmax(0,1.32fr);gap:clamp(2.5rem,7vw,7rem);align-items:end}.profile-portrait img{width:100%;max-height:620px;aspect-ratio:4/5;object-fit:cover;display:block}.profile-copy .seo-breadcrumb{display:flex;flex-wrap:wrap;gap:.45rem;color:rgba(255,255,255,.58);font-size:.72rem;margin-bottom:clamp(2rem,5vw,5rem)}.profile-copy .seo-breadcrumb a{color:inherit}.profile-copy .eyebrow{color:var(--gold-bright)}.profile-copy h1{max-width:900px;margin:.55rem 0 .55rem;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(3.2rem,6.5vw,6.8rem);font-weight:500;line-height:.95;letter-spacing:-.05em}.profile-role{margin:0 0 1.2rem;color:var(--gold-bright);font-size:clamp(1rem,1.4vw,1.2rem);font-weight:700}.profile-focus{max-width:700px;color:rgba(255,255,255,.73);line-height:1.7}.profile-linkedin{display:inline-flex;align-items:center;gap:.45rem;margin-top:1.25rem;padding:.72rem 1rem;border:1px solid rgba(255,255,255,.34);color:#fff;font-size:.78rem;font-weight:800}.profile-main{width:min(calc(100% - 2 * var(--section-x)),var(--max));margin:auto;padding:clamp(4rem,7vw,7rem) 0}.profile-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:clamp(3rem,7vw,7rem);align-items:start}.profile-bio{font-size:clamp(1.03rem,1.15vw,1.16rem);line-height:1.86}.profile-bio p{margin:0 0 1.6rem}.profile-bio h2{color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:clamp(2rem,3.6vw,3.7rem);font-weight:500;line-height:1.05}.profile-aside{position:sticky;top:calc(var(--header-height) + 2rem)}.profile-panel{background:#fff;border:1px solid rgba(0,23,89,.1);padding:2rem;margin-bottom:1.2rem}.profile-panel h3{margin-top:0;color:var(--navy)}.profile-panel ul{padding-left:1.1rem;color:var(--slate);line-height:1.65}.profile-practice-links{display:grid;gap:.65rem}.profile-practice-links a{display:flex;justify-content:space-between;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--line);color:var(--navy);font-size:.84rem;font-weight:800}.profile-cta{margin-top:clamp(4rem,7vw,7rem);padding:clamp(2.5rem,5vw,4rem);background:var(--navy-deep);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:2rem}.profile-cta h2{margin:0;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(2rem,3.7vw,3.8rem);font-weight:500}@media(max-width:900px){.seo-profile-page .site-header nav{background:#fff;color:var(--navy)}.profile-hero-inner,.profile-grid{grid-template-columns:1fr}.profile-portrait{max-width:520px}.profile-aside{position:static}.profile-cta{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body class="seo-profile-page">
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header scrolled" data-header>
    <a class="brand brand-logo" href="/" aria-label="KDH Advocates home"><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"></a>
    <button class="menu" type="button" aria-expanded="false" aria-controls="nav"><span>Menu</span><i aria-hidden="true"></i></button>
    <nav id="nav" aria-label="Primary navigation"><a href="/#firm">The firm</a><a href="/#expertise">Expertise</a><a href="/#reach">Africa</a><a href="/#team">Team</a><a href="/insights">Insights</a><a class="nav-cta" href="/#contact">Consultation</a></nav>
  </header>
  <main id="main">
    <section class="profile-hero"><div class="profile-hero-inner"><div class="profile-portrait"><img src="${escapeHtml(image)}" alt="${escapeHtml(person.alt || `${person.name}, ${person.role} at KDH Advocates`)}"></div><div class="profile-copy"><nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/#team">Team</a><span>/</span><span>${escapeHtml(person.name)}</span></nav><p class="eyebrow">KDH Advocates LLP · Nairobi</p><h1>${escapeHtml(person.name)}</h1><p class="profile-role">${escapeHtml(person.role || '')}</p><p class="profile-focus">${escapeHtml(person.specialties || '')}</p>${linkedInButton}</div></div></section>
    <section class="profile-main"><div class="profile-grid"><article class="profile-bio"><p class="eyebrow">Profile</p><h2>Experience shaped by commercial context.</h2>${bio}</article><aside class="profile-aside"><section class="profile-panel"><h3>Qualifications</h3><ul>${qualifications}</ul></section><section class="profile-panel"><h3>Related practice areas</h3><div class="profile-practice-links">${practiceLinks}</div></section></aside></div><section class="profile-cta"><h2>Speak with ${escapeHtml(person.name)} and the KDH team.</h2><a class="btn btn-gold" href="/#contact">Start a conversation <span aria-hidden="true">↗</span></a></section></section>
  </main>
  <footer><div class="footer-bottom"><small>&copy; 2026 KDH Advocates LLP. All rights reserved.</small><p>Trust. Integrity. Results.</p></div></footer>
  <script src="/script.js?v=11" defer></script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
};
