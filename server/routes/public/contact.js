const {
  LANDING_CSS, MENU_SCRIPT, ORIGIN, baseHead, breadcrumb, escapeHtml,
  renderFooter, renderNav, site
} = require('../../lib/seo-pages');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const canonical = `${ORIGIN}/contact`;
  const title = 'Contact KDH Advocates | Commercial Lawyers Nairobi';
  const description = 'Contact KDH Advocates LLP in Nairobi for commercial legal advice, dispute resolution, transactions, investment, real estate, finance, technology and regulatory matters.';
  const contact = site.contact || {};
  const schema = [
    { '@type': 'ContactPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#legal-service` }, breadcrumb: { '@id': `${canonical}#breadcrumb` } },
    breadcrumb([{ name: 'Home', url: `${ORIGIN}/` }, { name: 'Consultation', url: canonical }], `${canonical}#breadcrumb`)
  ];
  const html = `<!doctype html><html lang="en"><head>${baseHead({ title, description, canonical, schema })}<style>${LANDING_CSS}</style></head><body class="seo-landing">
  <a class="skip" href="#main">Skip to content</a>${renderNav('contact')}
  <main id="main"><section class="seo-hero"><img class="blue-band-logo" src="/assets/kdh-law-logo-transparent.png" alt="" aria-hidden="true"><div class="seo-wrap seo-hero-grid"><div><p class="seo-kicker">Consultation</p><h1>Your next move deserves <em>legal clarity.</em></h1></div><p class="seo-lead">Contact KDH Advocates to discuss a commercial, transactional, regulatory or dispute matter. The firm prioritises understanding the client’s objectives before recommending a legal strategy.</p></div></section>
  <div class="seo-main"><section class="seo-section"><div class="seo-section-head"><h2>Contact KDH Advocates.</h2><div class="seo-section-intro"><p><strong>Email:</strong> <a href="mailto:${escapeHtml(contact.email || 'law@kdhadvocates.com')}">${escapeHtml(contact.email || 'law@kdhadvocates.com')}</a></p><p><strong>Telephone:</strong> <a href="tel:${escapeHtml((contact.phone || '+254 717 854798').replace(/\s+/g, ''))}">${escapeHtml(contact.phone || '+254 717 854798')}</a></p><p><strong>Office:</strong> ${escapeHtml(contact.office || 'IPS Building, 1st Floor, Kimathi Street, Nairobi')}</p></div></div></section>
  <section class="seo-section"><div class="seo-grid"><article class="seo-card"><p>Before the meeting</p><h3>Bring the key documents.</h3><p>Contracts, notices, correspondence, corporate documents and transaction records can help the legal team understand the issue efficiently.</p></article><article class="seo-card"><p>Your objective</p><h3>Explain the outcome you need.</h3><p>Commercial context matters. Tell the team what the business needs to protect, achieve or avoid—not only what has happened legally.</p></article><article class="seo-card"><p>Urgent matters</p><h3>Flag deadlines immediately.</h3><p>If there is a filing deadline, threatened action, expiring notice period or urgent asset risk, make that clear at the first contact.</p></article></div></section>
  <section class="seo-section seo-cta"><h2>Prefer the homepage consultation form?</h2><a href="/#contact">Open consultation form ↗</a></section></div></main>${renderFooter()}${MENU_SCRIPT}</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(html);
};
