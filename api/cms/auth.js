const { currentSession } = require('../_lib/cms');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const current = currentSession(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(current ? 200 : 401).json({
    authenticated: Boolean(current),
    login: current?.login || null,
    role: current?.role || null,
    provider: current?.provider || null
  });
};
