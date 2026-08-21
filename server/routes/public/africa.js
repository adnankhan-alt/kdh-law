const {
  LANDING_CSS, MENU_SCRIPT, ORIGIN, baseHead, breadcrumb, renderFooter, renderNav
} = require('../../lib/seo-pages');

const countries = ['Kenya','Uganda','Tanzania','Rwanda','Burundi','South Africa','Zimbabwe','Zambia','Namibia','Nigeria','Ghana','Equatorial Guinea','Mali','Guinea','Sierra Leone','Benin','Gabon','Gambia','Mauritius','Chad','Togo','Cameroon','Niger','Egypt','Côte d’Ivoire'];

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const canonical = `${ORIGIN}/africa`;
  const title = 'Cross-Border Legal Counsel Across Africa | KDH Advocates';
  const description = 'KDH Advocates coordinates cross-border legal support for businesses and investors through relationships with reputable partner law firms across 25 African jurisdictions.';
  const schema = [
    { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#legal-service` }, breadcrumb: { '@id': `${canonical}#breadcrumb` } },
    breadcrumb([{ name: 'Home', url: `${ORIGIN}/` }, { name: 'Africa', url: canonical }], `${canonical}#breadcrumb`)
  ];
  const list = countries.map((country) => `<li>${country}</li>`).join('');
  const html = `<!doctype html><html lang="en"><head>${baseHead({ title, description, canonical, schema, image: '/assets/africa-reach.webp' })}<style>${LANDING_CSS}</style></head><body class="seo-landing">
  <a class="skip" href="#main">Skip to content</a>${renderNav('africa')}
  <main id="main"><section class="seo-hero"><img class="blue-band-logo" src="/assets/kdh-law-logo-transparent.png" alt="" aria-hidden="true"><div class="seo-wrap seo-hero-grid"><div><p class="seo-kicker">Pan-African legal support</p><h1>One point of contact for <em>cross-border legal work.</em></h1></div><p class="seo-lead">KDH Advocates coordinates on-the-ground support through relationships with reputable partner law firms across 25 African jurisdictions while maintaining a consistent point of contact for the client.</p></div></section>
  <div class="seo-main"><section class="seo-section"><div class="seo-section-head"><h2>Legal coordination for Africa-facing business.</h2><p class="seo-section-intro">Cross-border transactions and disputes often require local legal input in several jurisdictions at once. KDH helps clients coordinate that work while keeping the commercial strategy, timelines and communication aligned.</p></div>
  <ul class="seo-list">${list}</ul></section>
  <section class="seo-section"><div class="seo-grid"><article class="seo-card"><p>Transactions</p><h3>Investment and market entry</h3><p>Coordinate legal support for investment establishment, acquisitions, commercial arrangements and market-entry questions across multiple jurisdictions.</p><a href="/expertise/international-trade-and-investment">International trade & investment ↗</a></article><article class="seo-card"><p>Disputes</p><h3>Cross-border dispute strategy</h3><p>Align local legal issues with the wider dispute, enforcement and commercial strategy.</p><a href="/expertise/dispute-resolution">Dispute resolution ↗</a></article><article class="seo-card"><p>Projects</p><h3>Regional projects and finance</h3><p>Coordinate advice where infrastructure, finance, regulatory or project issues cross national boundaries.</p><a href="/expertise/energy-and-infrastructure">Energy & infrastructure ↗</a></article></div></section>
  <section class="seo-section seo-cta"><h2>Planning a transaction or dispute across African jurisdictions?</h2><a href="/contact">Speak with KDH Advocates ↗</a></section></div></main>${renderFooter()}${MENU_SCRIPT}</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(html);
};
