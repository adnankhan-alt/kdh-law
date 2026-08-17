const { normaliseRole, readGitJson, requireCms, sendError, writeGitJson } = require('../../lib/cms');

const PATH = 'content/admins.json';

function validUsers(users) {
  if (!Array.isArray(users) || users.length > 50) return false;
  const names = users.map((user) => String(user?.login || '').toLowerCase());
  if (new Set(names).size !== names.length) return false;
  return users.every((user) =>
    user &&
    typeof user.login === 'string' &&
    /^[A-Za-z0-9-]{1,39}$/.test(user.login) &&
    ['viewer', 'editor', 'admin'].includes(normaliseRole(user.role)) &&
    typeof user.enabled === 'boolean'
  );
}

module.exports = async function handler(req, res) {
  const current = requireCms(req, res, 'admin');
  if (!current) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const existing = await readGitJson(current, PATH, { allowMissing: true });
    if (req.method === 'GET') {
      return res.status(200).json({ content: existing?.data || { users: [] }, sha: existing?.sha || null });
    }
    if (req.method !== 'PUT') return res.status(405).end();

    const users = req.body?.content?.users;
    if (!validUsers(users) || !users.some((user) => user.enabled && normaliseRole(user.role) === 'admin')) {
      return res.status(400).json({ error: 'Keep at least one enabled GitHub administrator.' });
    }

    const content = {
      users: users.map((user) => ({
        login: user.login,
        role: normaliseRole(user.role),
        enabled: Boolean(user.enabled)
      }))
    };
    const updated = await writeGitJson(current, PATH, content, {
      sha: existing?.sha || null,
      message: 'Update CMS administrators'
    });
    return res.status(200).json({ saved: true, commit: updated.commit?.sha || null, content });
  } catch (error) {
    return sendError(res, error, 'Unable to manage CMS administrators.');
  }
};
