const { session } = require('./session');

const DEFAULT_REPO = 'adnankhan-alt/kdh-law';
const DEFAULT_BRANCH = 'main';
const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

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

function cleanToken(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function githubToken(current, { write = false } = {}) {
  const serverToken = cleanToken(process.env.GITHUB_TOKEN);
  const sessionToken = cleanToken(current?.token);

  // All CMS writes prefer the server-side PAT. This keeps keyword and GitHub
  // sessions consistent and avoids an OAuth session token unexpectedly taking
  // precedence over the dedicated repository write credential.
  const token = write
    ? (serverToken || sessionToken)
    : (sessionToken || serverToken);

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseGithubResponse(response) {
  const raw = await response.text().catch(() => '');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700) };
  }
}

function githubErrorMessage(status, payload, action) {
  const upstream = String(payload?.message || '').trim();

  if (status === 401) {
    return 'GitHub rejected the CMS token. Replace GITHUB_TOKEN in Vercel with a valid token and redeploy.';
  }
  if (status === 403) {
    return 'GitHub denied write access. Ensure GITHUB_TOKEN has Contents: Read and write permission for adnankhan-alt/kdh-law.';
  }
  if (status === 404) {
    return `GitHub could not find the KDH repository, branch, or requested file while trying to ${action}.`;
  }
  if (status === 409) {
    return 'GitHub reported a content conflict. Reload the CMS and try saving again.';
  }
  if (status === 422) {
    return upstream || 'GitHub rejected the update as invalid. Reload the CMS and try again.';
  }
  if (status === 429) {
    return 'GitHub temporarily rate-limited the CMS. Wait a short time and try again.';
  }
  if (RETRYABLE_STATUS.has(status)) {
    return 'GitHub is temporarily unavailable for repository writes. Your form is still open; wait a moment and click Save again.';
  }
  return upstream || `GitHub could not ${action}.`;
}

async function githubRequest(url, options, { action = 'complete the request', attempts = 3 } = {}) {
  let lastResponse = null;
  let lastPayload = {};

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, options);
    const payload = await parseGithubResponse(response);
    lastResponse = response;
    lastPayload = payload;

    if (response.ok) return { response, payload };

    const requestId = response.headers.get('x-github-request-id') || 'unknown';
    console.error('[KDH CMS] GitHub API request failed', {
      action,
      attempt,
      status: response.status,
      githubRequestId: requestId,
      message: String(payload?.message || '').slice(0, 500)
    });

    if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) break;

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 3000)
      : (attempt === 1 ? 450 : 1100);
    await delay(waitMs);
  }

  const error = new Error(githubErrorMessage(lastResponse?.status || 500, lastPayload, action));
  error.statusCode = lastResponse?.status || 500;
  throw error;
}

async function readGitFile(current, path, { allowMissing = false } = {}) {
  const token = githubToken(current);
  const url = `${githubFileEndpoint(path)}?ref=${encodeURIComponent(branchName())}`;
  const response = await fetch(url, { headers: githubHeaders(token) });

  if (allowMissing && response.status === 404) return null;
  const payload = await parseGithubResponse(response);
  if (!response.ok) {
    const error = new Error(githubErrorMessage(response.status, payload, `read ${path}`));
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
  const token = githubToken(current, { write: true });
  const body = {
    message: message || `Update ${path} from KDH CMS`,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch: branchName()
  };
  if (sha) body.sha = sha;

  const { payload } = await githubRequest(
    githubFileEndpoint(path),
    {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify(body)
    },
    { action: `save ${path}`, attempts: 3 }
  );
  return payload;
}

async function writeGitJson(current, path, data, options = {}) {
  return writeGitFile(current, path, `${JSON.stringify(data, null, 2)}\n`, options);
}

async function deleteGitFile(current, path, sha, message) {
  const token = githubToken(current, { write: true });
  const { payload } = await githubRequest(
    githubFileEndpoint(path),
    {
      method: 'DELETE',
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: message || `Delete ${path} from KDH CMS`,
        sha,
        branch: branchName()
      })
    },
    { action: `delete ${path}`, attempts: 3 }
  );
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
