const crypto = require('crypto');
const { COOKIE_NAME, seal, setCookie } = require('../../lib/session');
const { normaliseRole } = require('../../lib/cms');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const configured = process.env.ADMIN_ACCESS_KEY;
  if (!configured || configured.length < 12) {
    return res.status(503).json({ error: 'The URL access gateway has not been configured.' });
  }

  const supplied = req.body?.key;
  if (typeof supplied !== 'string' || supplied.length > 500 || !safeEqual(supplied, configured)) {
    return res.status(401).json({ error: 'Invalid admin access keyword.' });
  }

  const role = normaliseRole(process.env.ADMIN_ACCESS_ROLE || 'admin');
  setCookie(
    res,
    COOKIE_NAME,
    seal({
      login: process.env.ADMIN_ACCESS_LABEL || 'Secure URL access',
      provider: 'keyword',
      role,
      exp: Date.now() + 8 * 60 * 60 * 1000
    })
  );

  return res.status(200).json({ authenticated: true, role });
};
