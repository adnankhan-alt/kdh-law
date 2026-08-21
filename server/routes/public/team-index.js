const {
  LANDING_CSS, MENU_SCRIPT, ORIGIN, absoluteUrl, baseHead, breadcrumb, escapeHtml,
  renderFooter, renderNav, site, slugify
} = require('../../lib/seo-pages');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const canonical = `${ORIGIN}/team`;
  const title = 'KDH Advocates Lawyers & Legal Team | Nairobi, Kenya';
  const description = 'Meet the lawyers at KDH Advocates LLP in Nairobi. Explore profiles covering corporate law, disputes, real estate, finance, trade, climate, employment and intellectual property.';
  const people = (site.team || []).map((person) => ({ '@id': `${ORIGIN}/team/${slugify(person.id || person.name)}#person` }));
  const schema = [
    {
      '@type': 'CollectionPage', '@id': `${canonical}#webpage`, url: canonical, name: title,
      description, isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#legal-service` },
      mainEntity: { '@type': 'ItemList', itemListElement: people.map((person, i) => ({ '@type': 'ListItem', position: i + 1, item: person })) },
      breadcrumb: { '@id': `${canonical}#breadcrumb` }
    },
    breadcrumb([{ name: 'Home', url: `${ORIGIN}/` }, { name: 'Team', url: canonical }], `${canonical}#breadcrumb`)
  ];
  const cards = (site.team || []).map((person) => {
    const linkedin = person.linkedin ? `<a href="${escapeHtml(String(person.linkedin).replace(/^http:\/\//i, 'https://'))}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>` : '';
    return `<article class="seo-person"><img src="${escapeHtml(absoluteUrl(person.image))}" alt="${escapeHtml(person.alt || `${person.name}, ${person.role} at KDH Advocates`)}" loading="lazy"><div><p class="seo-kicker">${escapeHtml(person.role || 'Lawyer')}</p><h2>${escapeHtml(person.name)}</h2><p>${escapeHtml(person.specialties || '')}</p><div class="seo-actions"><a href="/team/${encodeURIComponent(slugify(person.id || person.name))}">View profile ↗</a>${linkedin}</div></div></article>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><head>${baseHead({ title, description, canonical, schema })}<style>${LANDING_CSS}</style></head><body class="seo-landing">
  <a class="skip" href="#main">Skip to content</a>${renderNav('team')}
  <main id="main"><section class="seo-hero"><img class="blue-band-logo" src="/assets/kdh-law-logo-transparent.png" alt="" aria-hidden="true"><div class="seo-wrap seo-hero-grid"><div><p class="seo-kicker">KDH legal team</p><h1>Lawyers combining specialist depth with <em>commercial judgment.</em></h1></div><p class="seo-lead">Meet the KDH Advocates team in Nairobi and explore each lawyer’s areas of focus, profile, LinkedIn presence and published legal analysis.</p></div></section>
  <div class="seo-main"><section class="seo-section"><div class="seo-section-head"><h2>Our lawyers.</h2><p class="seo-section-intro">Individual profile pages connect each lawyer to relevant practice areas and KDH Insights, strengthening both client discovery and author credibility.</p></div><div class="seo-person-grid">${cards}</div></section>
  <section class="seo-section seo-cta"><h2>Looking for the right lawyer for a specific matter?</h2><a href="/contact">Contact KDH Advocates ↗</a></section></div></main>${renderFooter()}${MENU_SCRIPT}</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  return res.status(200).send(html);
};
