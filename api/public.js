const handlers = {
  analytics: require('../server/routes/public/analytics'),
  article: require('../server/routes/public/article'),
  enquiries: require('../server/routes/public/enquiries'),
  'page-content': require('../server/routes/public/page-content'),
  posts: require('../server/routes/public/posts'),
  person: require('../server/routes/public/person'),
  practice: require('../server/routes/public/practice'),
  sitemap: require('../server/routes/public/sitemap')
};

module.exports = async function handler(req, res) {
  const route = String(req.query?.route || '').trim();
  const routeHandler = handlers[route];
  if (!routeHandler) return res.status(404).json({ error: 'API endpoint not found.' });
  return routeHandler(req, res);
};
