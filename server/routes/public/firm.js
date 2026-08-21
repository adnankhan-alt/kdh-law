const {
  LANDING_CSS, MENU_SCRIPT, ORIGIN, baseHead, breadcrumb, escapeHtml,
  renderFooter, renderNav, site
} = require('../../lib/seo-pages');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const canonical = `${ORIGIN}/the-firm`;
  const title = 'About KDH Advocates LLP | Commercial Law Firm Nairobi';
  const description = 'Learn about KDH Advocates LLP, a Nairobi commercial law firm advising businesses on transactions, disputes, investment, finance, real estate, technology and cross-border matters.';
  const schema = [
    {
      '@type': 'AboutPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${ORIGIN}/#website` },
      about: { '@id': `${ORIGIN}/#legal-service` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` }
    },
    breadcrumb([
      { name: 'Home', url: `${ORIGIN}/` },
      { name: 'The firm', url: canonical }
    ], `${canonical}#breadcrumb`)
  ];
  const firm = site.firm || {};
  const html = `<!doctype html><html lang="en"><head>${baseHead({ title, description, canonical, schema })}<style>${LANDING_CSS}</style></head><body class="seo-landing">
  <a class="skip" href="#main">Skip to content</a>${renderNav('firm')}
  <main id="main"><section class="seo-hero"><div class="seo-wrap seo-hero-grid"><div><p class="seo-kicker">KDH Advocates LLP · Nairobi, Kenya</p><h1>Commercial counsel built around <em>clarity, trust and results.</em></h1></div><p class="seo-lead">KDH Advocates LLP, formerly Ken, Daniel &amp; Henry Advocates, combines commercial legal advice, dispute strategy and cross-border capability for businesses operating in Kenya and across Africa.</p></div></section>
  <div class="seo-main">
    <section class="seo-section"><div class="seo-section-head"><h2>${escapeHtml(firm.heading || 'Legal excellence shaped by')} <em>${escapeHtml(firm.accent || 'commercial insight.')}</em></h2><div class="seo-section-intro"><p>${escapeHtml(firm.paragraphOne || '')}</p><p>${escapeHtml(firm.paragraphTwo || '')}</p></div></div></section>
    <section class="seo-section"><div class="seo-section-head"><h2>Why businesses work with KDH.</h2><p class="seo-section-intro">The firm combines specialist legal capability with a commercial understanding of the decisions clients need to make. Advice is designed to be practical, responsive and proportionate to the risk involved.</p></div><div class="seo-grid">
      <article class="seo-card"><p>01</p><h3>Commercial perspective</h3><p>Legal analysis is connected to the transaction, investment, dispute or operational objective behind the instruction.</p></article>
      <article class="seo-card"><p>02</p><h3>Cross-practice depth</h3><p>Corporate, dispute, finance, real estate, trade, technology, tax, employment and project issues can be coordinated through one firm.</p></article>
      <article class="seo-card"><p>03</p><h3>Africa-facing capability</h3><p>KDH works with reputable partner law firms across multiple African jurisdictions to coordinate cross-border legal support.</p></article>
    </div></section>
    <section class="seo-section"><div class="seo-section-head"><h2>Explore KDH.</h2><p class="seo-section-intro">Use the pages below to understand the firm’s practice areas, lawyers and legal analysis in more detail.</p></div><div class="seo-grid">
      <article class="seo-card"><p>Expertise</p><h3>Legal services for business</h3><p>Explore KDH’s corporate, dispute, finance, property, technology, trade and regulatory practices.</p><a href="/expertise">View expertise ↗</a></article>
      <article class="seo-card"><p>Team</p><h3>Meet the lawyers</h3><p>Read individual lawyer profiles, areas of focus and authored KDH Insights.</p><a href="/team">Meet the team ↗</a></article>
      <article class="seo-card"><p>Insights</p><h3>Legal analysis</h3><p>Read practical perspectives on legal issues affecting business in Kenya and Africa.</p><a href="/insights">Read KDH Insights ↗</a></article>
    </div></section>
    <section class="seo-section seo-cta"><h2>Discuss a legal or commercial matter with KDH Advocates.</h2><a href="/contact">Request a consultation ↗</a></section>
  </div></main>${renderFooter()}${MENU_SCRIPT}</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(html);
};
