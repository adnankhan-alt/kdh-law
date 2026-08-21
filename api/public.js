const handlers = {
  africa: require('../server/routes/public/africa'),
  contact: require('../server/routes/public/contact'),
  'expertise-index': require('../server/routes/public/expertise-index'),
  firm: require('../server/routes/public/firm'),
  analytics: require('../server/routes/public/analytics'),
  article: require('../server/routes/public/article'),
  enquiries: require('../server/routes/public/enquiries'),
  feed: require('../server/routes/public/feed'),
  'page-content': require('../server/routes/public/page-content'),
  insights: require('../server/routes/public/insights'),
  posts: require('../server/routes/public/posts'),
  person: require('../server/routes/public/person'),
  practice: require('../server/routes/public/practice'),
  sitemap: require('../server/routes/public/sitemap'),
  'team-index': require('../server/routes/public/team-index')
};

module.exports = async function handler(req, res) {
  const route = String(req.query?.route || '').trim();
  const routeHandler = handlers[route];
  if (!routeHandler) return res.status(404).json({ error: 'API endpoint not found.' });
  return routeHandler(req, res);
};
