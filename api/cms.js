const handlers = {
  admins: require('../server/routes/cms/admins'),
  analytics: require('../server/routes/cms/analytics'),
  auth: require('../server/routes/cms/auth'),
  callback: require('../server/routes/cms/callback'),
  content: require('../server/routes/cms/content'),
  enquiries: require('../server/routes/cms/enquiries'),
  generate: require('../server/routes/cms/generate'),
  'keyword-auth': require('../server/routes/cms/keyword-auth'),
  logout: require('../server/routes/cms/logout'),
  posts: require('../server/routes/cms/posts'),
  site: require('../server/routes/cms/site'),
  start: require('../server/routes/cms/start'),
  upload: require('../server/routes/cms/upload')
};

module.exports = async function handler(req, res) {
  const route = String(req.query?.route || '').trim();
  const routeHandler = handlers[route];
  if (!routeHandler) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'CMS endpoint not found.' });
  }
  return routeHandler(req, res);
};
