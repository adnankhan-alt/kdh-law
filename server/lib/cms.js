const { session } = require('./session');

const DEFAULT_REPO = 'adnankhan-alt/kdh-law';
const DEFAULT_BRANCH = 'main';
const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };

function normaliseRole(value) {
  const role = String(value || '').toLowerCase();
  return ROLE_RANK[role] ? role : 'viewer';
}

function roleAtLeast(role, minimum = 'viewer') {
  return (ROLE_RANK[normaliseRole(role)] || 0) >= (ROLE_RANK[normaliseRole(minimum)] || 0);
}

function currentSession(req) {
  const current = session(req);
  if (!current) return null;
  return {
    ...current,
    role: normaliseRole(current.role || 'admin'),
    provider: current.provider || 'github'
  };
}

function requireCms(req, res, minimumRole = 'viewer') {
  const current = currentSession(req);
  if (!current) {
    res.status(401).json({ error: 'Sign in is required.' });
    return null;
  }
  if (!roleAtLeast(current.role, minimumRole)) {
    res.status(403).json({ error: 'Your CMS role does not allow this action.' });
    return null;
  }
  return current;
}

function repoName() {
  return process.env.CMS_GITHUB_REPO || DEFAULT_REPO;
}

function branchName() {
  return process.env.CMS_GITHUB_BRANCH || DEFAULT_BRANCH;
}

function githubToken(current) {
  const token = current?.token || process.env.GITHUB_TOKEN;
  if (!token) {
    const error = new Error('No GitHub write token is configured for this CMS session.');
    error.statusCode = 503;
    throw error;
  }
  return token;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'KDH-Website-CMS',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function githubFileEndpoint(path) {
  return `https://api.github.com/repos/${repoName()}/contents/${path}`;
}

async function readGitFile(current, path, { allowMissing = false } = {}) {
  const token = githubToken(current);
  const response = await fetch(`${githubFileEndpoint(path)}?ref=${encodeURIComponent(branchName())}`, {
    headers: githubHeaders(token)
  });
  if (allowMissing && response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Unable to read ${path} from GitHub.`);
    error.statusCode = response.status;
    throw error;
  }
  return {
    sha: payload.sha,
    text: Buffer.from(payload.content || '', 'base64').toString('utf8'),
    payload
  };
}

async function readGitJson(current, path, options) {
  const file = await readGitFile(current, path, options);
  if (!file) return null;
  try {
    return { ...file, data: JSON.parse(file.text) };
  } catch {
    const error = new Error(`${path} does not contain valid JSON.`);
    error.statusCode = 500;
    throw error;
  }
}

async function writeGitFile(current, path, text, { sha, message } = {}) {
  const token = githubToken(current);
  const body = {
    message: message || `Update ${path} from KDH CMS`,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch: branchName()
  };
  if (sha) body.sha = sha;

  const response = await fetch(githubFileEndpoint(path), {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Unable to save ${path} to GitHub.`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function writeGitJson(current, path, data, options = {}) {
  return writeGitFile(current, path, `${JSON.stringify(data, null, 2)}\n`, options);
}

async function deleteGitFile(current, path, sha, message) {
  const token = githubToken(current);
  const response = await fetch(githubFileEndpoint(path), {
    method: 'DELETE',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: message || `Delete ${path} from KDH CMS`,
      sha,
      branch: branchName()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Unable to delete ${path} from GitHub.`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function sendError(res, error, fallback = 'The request could not be completed.') {
  const status = Number(error?.statusCode) || 500;
  return res.status(status).json({ error: error?.message || fallback });
}

module.exports = {
  branchName,
  currentSession,
  deleteGitFile,
  githubFileEndpoint,
  githubHeaders,
  githubToken,
  normaliseRole,
  readGitFile,
  readGitJson,
  repoName,
  requireCms,
  roleAtLeast,
  sendError,
  writeGitFile,
  writeGitJson
};
