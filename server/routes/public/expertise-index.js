const {
  LANDING_CSS, MENU_SCRIPT, ORIGIN, baseHead, breadcrumb, escapeHtml,
  renderFooter, renderNav, site, slugify
} = require('../../lib/seo-pages');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const canonical = `${ORIGIN}/expertise`;
  const title = 'Legal Services & Practice Areas in Kenya | KDH Advocates';
  const description = 'Explore KDH Advocates practice areas: corporate and commercial law, dispute resolution, employment, real estate, finance, trade, technology, tax, immigration, energy and ESG.';
  const services = (site.practices || []).map((practice) => ({
    '@type': 'Service',
    name: practice.title,
    description: practice.intro,
    url: `${ORIGIN}/expertise/${slugify(practice.slug || practice.title)}`,
    provider: { '@id': `${ORIGIN}/#legal-service` },
    areaServed: { '@type': 'Country', name: 'Kenya' }
  }));
  const schema = [
    {
      '@type': 'CollectionPage', '@id': `${canonical}#webpage`, url: canonical,
      name: title, description, isPartOf: { '@id': `${ORIGIN}/#website` },
      mainEntity: { '@type': 'ItemList', itemListElement: services.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) },
      breadcrumb: { '@id': `${canonical}#breadcrumb` }
    },
    breadcrumb([{ name: 'Home', url: `${ORIGIN}/` }, { name: 'Expertise', url: canonical }], `${canonical}#breadcrumb`)
  ];
  const cards = (site.practices || []).map((practice, index) => `<article class="seo-card"><p>${String(index + 1).padStart(2, '0')}</p><h3>${escapeHtml(practice.title)}</h3><p>${escapeHtml(practice.intro || '')}</p><a href="/expertise/${encodeURIComponent(slugify(practice.slug || practice.title))}">Explore ${escapeHtml(practice.title)} ↗</a></article>`).join('');
  const html = `<!doctype html><html lang="en"><head>${baseHead({ title, description, canonical, schema })}<style>${LANDING_CSS}</style></head><body class="seo-landing">
  <a class="skip" href="#main">Skip to content</a>${renderNav('expertise')}
  <main id="main"><section class="seo-hero"><img class="blue-band-logo" src="/assets/kdh-law-logo-transparent.png" alt="" aria-hidden="true"><div class="seo-wrap seo-hero-grid"><div><p class="seo-kicker">Legal services in Kenya</p><h1>Commercial legal expertise for <em>complex business decisions.</em></h1></div><p class="seo-lead">KDH Advocates provides multidisciplinary legal advice across transactions, disputes, finance, property, employment, technology, trade, tax, investment and major projects.</p></div></section>
  <div class="seo-main"><section class="seo-section"><div class="seo-section-head"><h2>Practice areas.</h2><p class="seo-section-intro">Each practice page explains the issues KDH handles, the lawyers most closely aligned to that work and related legal analysis.</p></div><div class="seo-grid">${cards}</div></section>
  <section class="seo-section"><div class="seo-section-head"><h2>Integrated advice, not isolated answers.</h2><p class="seo-section-intro">A single business matter can involve corporate governance, financing, employment, data, property, regulation and dispute risk at the same time. KDH’s practice structure is designed to connect those issues rather than treat them as separate instructions.</p></div></section>
  <section class="seo-section seo-cta"><h2>Not sure which practice area your matter falls under?</h2><a href="/contact">Speak with KDH Advocates ↗</a></section></div></main>${renderFooter()}${MENU_SCRIPT}</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(html);
};
