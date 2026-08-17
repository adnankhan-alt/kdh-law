const { COOKIE_NAME, cookies, seal, setCookie, unseal } = require('../_lib/session');
const { normaliseRole, readGitJson } = require('../_lib/cms');

async function githubRole(login) {
  try {
    const config = await readGitJson(null, 'content/admins.json', { allowMissing: true });
    const user = config?.data?.users?.find((entry) =>
      entry.enabled !== false && String(entry.login || '').toLowerCase() === String(login || '').toLowerCase()
    );
    if (user) return normaliseRole(user.role);
  } catch {
    // Fall through to environment-based compatibility rules.
  }

  let roles = {};
  try {
    roles = JSON.parse(process.env.CMS_GITHUB_ROLES || '{}');
  } catch {
    roles = {};
  }
  const key = Object.keys(roles).find((name) => name.toLowerCase() === String(login || '').toLowerCase());
  if (key) return normaliseRole(roles[key]);

  const allowed = (process.env.CMS_ALLOWED_GITHUB_USER || 'adnankhan-alt').toLowerCase();
  if (String(login || '').toLowerCase() === allowed) return 'admin';
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const oauth = unseal(cookies(req).kdh_cms_oauth || '');
  if (!oauth || oauth.state !== req.query.state || !req.query.code) {
    return res.status(401).send('This sign-in request is invalid or has expired.');
  }

  const origin = process.env.CMS_PUBLIC_ORIGIN || 'https://www.kdhadvocates.com';
  const redirectUri = `${origin.replace(/\/$/, '')}/api/cms/callback`;
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: redirectUri
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return res.status(401).send('GitHub sign-in failed.');

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'KDH-Website-CMS'
    }
  });
  const user = await userResponse.json();
  const role = await githubRole(user.login);
  if (!role) {
    return res.status(403).send('This GitHub account is not authorised to edit KDH content.');
  }

  setCookie(
    res,
    COOKIE_NAME,
    seal({
      token: tokenData.access_token,
      login: user.login,
      provider: 'github',
      role,
      exp: Date.now() + 8 * 60 * 60 * 1000
    })
  );
  res.redirect(302, '/admin/');
};
