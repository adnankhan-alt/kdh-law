const site = require('../../content/site.json');

const ORIGIN = 'https://www.kdhadvocates.com';

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

function truncate(value, max = 158) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function absoluteUrl(value, fallback = '/assets/kdh-law-logo.jpg') {
  const raw = String(value || fallback || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${ORIGIN}/${raw.replace(/^\//, '')}`;
}

function companySameAs() {
  const social = site.social || {};
  return [social.linkedin, social.facebook, social.x || social.twitter]
    .map((value) => String(value || '').replace(/^http:\/\//i, 'https://').trim())
    .filter((value) => /^https:\/\//i.test(value));
}

function organizationNode() {
  const contact = site.contact || {};
  const sameAs = companySameAs();
  return {
    '@type': ['Organization', 'LegalService'],
    '@id': `${ORIGIN}/#legal-service`,
    name: 'KDH Advocates LLP',
    legalName: 'KDH Advocates LLP',
    alternateName: ['KDH Advocates', 'Ken, Daniel & Henry Advocates'],
    url: `${ORIGIN}/`,
    logo: {
      '@type': 'ImageObject',
      '@id': `${ORIGIN}/#logo`,
      url: `${ORIGIN}/assets/kdh-law-logo.jpg`,
      contentUrl: `${ORIGIN}/assets/kdh-law-logo.jpg`,
      caption: 'KDH Advocates LLP'
    },
    image: absoluteUrl(site.seo?.ogImage || '/assets/lady-justice.webp'),
    description: site.seo?.description || 'KDH Advocates LLP is a commercial law firm in Nairobi, Kenya, advising businesses on transactions, disputes, investment and regulatory matters.',
    slogan: 'Trust. Integrity. Results.',
    email: contact.email || undefined,
    telephone: contact.phone || undefined,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Legal consultations',
      email: contact.email || undefined,
      telephone: contact.phone || undefined,
      availableLanguage: ['English']
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: contact.office || 'IPS Building, 1st Floor, Kimathi Street',
      addressLocality: 'Nairobi',
      addressCountry: 'KE'
    },
    areaServed: [
      { '@type': 'Country', name: 'Kenya' },
      { '@type': 'Continent', name: 'Africa' }
    ],
    knowsAbout: (site.practices || []).map((practice) => practice.title).filter(Boolean),
    ...(sameAs.length ? { sameAs } : {}),
    employee: (site.team || []).map((person) => ({
      '@type': 'Person',
      '@id': `${ORIGIN}/team/${slugify(person.id || person.name)}#person`,
      name: person.name,
      jobTitle: person.role,
      url: `${ORIGIN}/team/${slugify(person.id || person.name)}`,
      ...(person.image ? { image: absoluteUrl(person.image) } : {}),
      ...(person.linkedin ? { sameAs: [String(person.linkedin).replace(/^http:\/\//i, 'https://')] } : {})
    }))
  };
}

function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': `${ORIGIN}/#website`,
    url: `${ORIGIN}/`,
    name: 'KDH Advocates LLP',
    alternateName: 'KDH Advocates',
    publisher: { '@id': `${ORIGIN}/#legal-service` },
    inLanguage: 'en-KE'
  };
}

function breadcrumb(items, id) {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const navItems = [
  ['insights', '/insights', 'Insights'],
  ['firm', '/the-firm', 'The firm'],
  ['expertise', '/expertise', 'Expertise'],
  ['africa', '/africa', 'Africa'],
  ['team', '/team', 'Team'],
  ['contact', '/contact', 'Consultation']
];

function renderNav(active = '') {
  return `<header class="site-header scrolled" data-header>
    <a class="brand brand-logo" href="/" aria-label="KDH Advocates home"><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"></a>
    <button class="menu" type="button" aria-expanded="false" aria-controls="nav"><span>Menu</span><i aria-hidden="true"></i></button>
    <nav id="nav" aria-label="Primary navigation">${navItems.map(([key, href, label]) => { const classes = [active === key ? 'active' : '', key === 'contact' ? 'nav-cta' : ''].filter(Boolean).join(' '); return `<a${classes ? ` class="${classes}"` : ''} href="${href}">${label}</a>`; }).join('')}</nav>
  </header>`;
}

function renderFooter() {
  const contact = site.contact || {};
  const social = companySameAs();
  const socialLinks = social.map((url) => {
    const label = /linkedin/i.test(url) ? 'LinkedIn' : /facebook/i.test(url) ? 'Facebook' : 'X';
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  }).join('');
  return `<footer class="seo-footer">
    <div class="seo-footer-grid">
      <div><img src="/assets/kdh-law-logo-transparent.png" alt="KDH Advocates LLP"><p>Commercial legal counsel for business in Kenya and across Africa.</p></div>
      <div><span>Explore</span><a href="/the-firm">The firm</a><a href="/expertise">Expertise</a><a href="/team">Team</a><a href="/insights">Insights</a></div>
      <div><span>Contact</span><a href="mailto:${escapeHtml(contact.email || 'law@kdhadvocates.com')}">${escapeHtml(contact.email || 'law@kdhadvocates.com')}</a><a href="tel:${escapeHtml((contact.phone || '+254 717 854798').replace(/\s+/g, ''))}">${escapeHtml(contact.phone || '+254 717 854798')}</a><a href="/contact">Request a consultation</a></div>
      <div><span>Connect</span>${socialLinks || '<a href="/team">Meet our lawyers</a>'}<a href="/assets/kdh-advocates-profile.pdf" target="_blank" rel="noopener">Firm profile ↗</a></div>
    </div>
    <div class="seo-footer-bottom"><small>&copy; 2026 KDH Advocates LLP. All rights reserved.</small><p>Trust. Integrity. Results.</p></div>
  </footer>`;
}

function baseHead({ title, description, canonical, image, schema = [], type = 'website' }) {
  const ogImage = absoluteUrl(image || site.seo?.ogImage || '/assets/kdh-law-logo.jpg');
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#001759">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/png" href="/assets/kdh-favicon.png">
  <link rel="alternate" type="application/rss+xml" title="KDH Insights RSS" href="/feed.xml">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:locale" content="en_KE">
  <meta property="og:site_name" content="KDH Advocates LLP">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:alt" content="KDH Advocates LLP">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=15">
  <script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': [websiteNode(), organizationNode(), ...schema] })}</script>`;
}

const LANDING_CSS = `
body.seo-landing{margin:0;background:#f7f6f2;color:#17213a;font-family:Manrope,Arial,sans-serif}.seo-landing .site-header{position:fixed;background:rgba(255,255,255,.97);color:var(--navy);box-shadow:0 1px 0 rgba(0,23,89,.1);backdrop-filter:blur(18px)}.seo-landing .site-header .brand-logo img{filter:none}.seo-landing .site-header nav a.active::after{transform:scaleX(1)}.seo-hero{position:relative;overflow:hidden;padding:calc(var(--header-height) + clamp(4rem,7vw,7rem)) var(--section-x) clamp(4rem,7vw,6.5rem);background:var(--navy-deep);color:#fff}.blue-band-logo{position:absolute;right:clamp(1.2rem,4vw,4rem);top:calc(var(--header-height) + 1.25rem);width:clamp(72px,7vw,104px);height:auto;filter:brightness(0) invert(1);opacity:.96;z-index:1}.seo-wrap{width:min(100%,var(--max));margin:0 auto}.seo-hero-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:clamp(2rem,6vw,6rem);align-items:end}.seo-kicker{margin:0 0 .8rem;color:var(--gold-bright);font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.seo-hero h1{max-width:940px;margin:0;color:#fff;font-family:"Playfair Display",Georgia,serif;font-size:clamp(2.8rem,5.8vw,5.8rem);font-weight:500;line-height:.98;letter-spacing:-.04em}.seo-hero h1 em{color:var(--gold-bright);font-weight:500}.seo-lead{max-width:650px;margin:0;color:rgba(255,255,255,.76);font-size:clamp(1rem,1.25vw,1.15rem);line-height:1.75}.seo-main{width:min(calc(100% - 2 * var(--section-x)),var(--max));margin:0 auto;padding:clamp(4rem,7vw,7rem) 0}.seo-section{margin-bottom:clamp(4rem,7vw,7rem)}.seo-section:last-child{margin-bottom:0}.seo-section-head{display:grid;grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr);gap:clamp(2rem,6vw,6rem);margin-bottom:2rem;align-items:start}.seo-section h2{margin:0;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:clamp(2rem,3.6vw,3.8rem);font-weight:500;line-height:1.05;letter-spacing:-.035em}.seo-section-intro,.seo-copy{color:#596273;font-size:1rem;line-height:1.8}.seo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem}.seo-card{background:#fff;border:1px solid rgba(0,23,89,.1);padding:clamp(1.35rem,2.2vw,2rem)}.seo-card p:first-child{margin-top:0;color:var(--gold);font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.seo-card h2,.seo-card h3{margin:.45rem 0 .7rem;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-weight:500;line-height:1.12}.seo-card h3{font-size:1.35rem}.seo-card p{color:#626b7b;line-height:1.65}.seo-card a{font-size:.75rem;font-weight:800;color:var(--navy)}.seo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem 2rem;padding:0;list-style:none}.seo-list li{padding:1rem 0;border-bottom:1px solid rgba(0,23,89,.12);color:#3a4355;line-height:1.55}.seo-person-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:1rem}.seo-person{background:#fff;border:1px solid rgba(0,23,89,.1);overflow:hidden}.seo-person img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.seo-person div{padding:1.3rem}.seo-person h2,.seo-person h3{font-family:"Playfair Display",Georgia,serif;color:var(--navy);font-size:1.45rem;margin:.25rem 0 .5rem}.seo-person p{color:#6b7280;margin:.35rem 0;line-height:1.55}.seo-actions{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}.seo-actions a{font-size:.72rem;font-weight:800}.seo-question{padding:1.3rem 0;border-top:1px solid rgba(0,23,89,.12)}.seo-question h3{margin:0 0 .5rem;color:var(--navy);font-family:"Playfair Display",Georgia,serif;font-size:1.35rem;font-weight:500}.seo-question p{margin:0;color:#596273;line-height:1.7}.seo-cta{padding:clamp(2rem,4vw,4rem);background:var(--navy-deep);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:2rem}.seo-cta h2{color:#fff;max-width:760px}.seo-cta a{display:inline-flex;padding:.9rem 1.2rem;background:var(--gold-bright);color:#07133f;font-size:.75rem;font-weight:800}.seo-footer{background:#00133f;color:#fff;padding:4rem var(--section-x) 1.5rem}.seo-footer-grid{width:min(100%,var(--max));margin:auto;display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:2rem}.seo-footer img{width:90px;filter:brightness(0) invert(1)}.seo-footer p{color:rgba(255,255,255,.65);line-height:1.7}.seo-footer-grid>div{display:flex;flex-direction:column;gap:.55rem}.seo-footer-grid span{color:var(--gold-bright);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.seo-footer a{color:#fff;font-size:.8rem}.seo-footer-bottom{width:min(100%,var(--max));margin:3rem auto 0;padding-top:1rem;border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;gap:1rem;color:rgba(255,255,255,.55)}.seo-footer-bottom p{margin:0;color:var(--gold-bright)}@media(max-width:900px){.seo-landing .site-header nav{background:#fff;color:var(--navy)}.seo-hero-grid,.seo-section-head{grid-template-columns:1fr}.seo-list{grid-template-columns:1fr}.seo-footer-grid{grid-template-columns:1fr 1fr}.seo-cta{align-items:flex-start;flex-direction:column}}@media(max-width:620px){.seo-main{width:min(calc(100% - 2rem),var(--max))}.seo-footer-grid{grid-template-columns:1fr}.seo-footer-bottom{flex-direction:column}}
`;

const MENU_SCRIPT = `<script>const m=document.querySelector('.menu'),n=document.querySelector('#nav');m?.addEventListener('click',()=>{const o=m.getAttribute('aria-expanded')==='true';m.setAttribute('aria-expanded',String(!o));n?.classList.toggle('open',!o)});n?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');m?.setAttribute('aria-expanded','false')}));</script>`;

module.exports = {
  LANDING_CSS,
  MENU_SCRIPT,
  ORIGIN,
  absoluteUrl,
  baseHead,
  breadcrumb,
  companySameAs,
  escapeHtml,
  jsonLd,
  organizationNode,
  renderFooter,
  renderNav,
  site,
  slugify,
  truncate,
  websiteNode
};
