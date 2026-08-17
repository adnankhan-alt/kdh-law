const { del, get, list, put } = require('@vercel/blob');

function privateToken() {
  return process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || '';
}

function requirePrivateToken() {
  const token = privateToken();
  if (!token) {
    const error = new Error('Private CMS storage is not configured.');
    error.statusCode = 503;
    throw error;
  }
  return token;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function putPrivate(pathname, body, options = {}) {
  const token = requirePrivateToken();
  return put(pathname, body, {
    ...options,
    access: 'private',
    token,
    addRandomSuffix: options.addRandomSuffix ?? false
  });
}

async function getPrivate(urlOrPathname) {
  const token = requirePrivateToken();
  const result = await get(urlOrPathname, { access: 'private', token });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return streamToString(result.stream);
}

async function listPrivate(options = {}) {
  const token = requirePrivateToken();
  return list({ ...options, token });
}

async function deletePrivate(urlOrPathname) {
  const token = requirePrivateToken();
  return del(urlOrPathname, { token });
}

module.exports = {
  deletePrivate,
  getPrivate,
  listPrivate,
  privateToken,
  putPrivate,
  requirePrivateToken,
  streamToString
};
