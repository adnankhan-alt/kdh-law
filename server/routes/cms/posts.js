const {
  deleteGitFile,
  githubHeaders,
  githubToken,
  readGitJson,
  repoName,
  branchName,
  requireCms,
  sendError,
  writeGitJson
} = require('../../lib/cms');

const POSTS_PATH = 'content/posts';

function validSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || '')) && String(value).length <= 120;
}

function validPost(post) {
  if (!post || !validSlug(post.slug)) return false;
  if (typeof post.title !== 'string' || !post.title.trim() || post.title.length > 180) return false;
  if (typeof post.summary !== 'string' || post.summary.length > 800) return false;
  if (typeof post.content !== 'string' || !post.content.trim() || post.content.length > 250000) return false;
  if (typeof post.coverImage !== 'string' || post.coverImage.length > 2000) return false;
  if (!['draft', 'published', 'scheduled'].includes(post.status)) return false;
  if (post.status === 'scheduled' && Number.isNaN(Date.parse(post.scheduledAt || ''))) return false;
  if (typeof post.seoTitle !== 'string' || post.seoTitle.length > 180) return false;
  if (typeof post.seoDescription !== 'string' || post.seoDescription.length > 500) return false;
  if (typeof post.practiceArea !== 'string' || post.practiceArea.length > 180) return false;
  return true;
}

async function listPosts(current) {
  const token = githubToken(current);
  const endpoint = `https://api.github.com/repos/${repoName()}/contents/${POSTS_PATH}?ref=${encodeURIComponent(branchName())}`;
  const response = await fetch(endpoint, { headers: githubHeaders(token) });
  if (response.status === 404) return [];
  const files = await response.json().catch(() => []);
  if (!response.ok) {
    const error = new Error(files.message || 'Unable to read the article directory.');
    error.statusCode = response.status;
    throw error;
  }

  const jsonFiles = files.filter((file) => file.type === 'file' && file.name.endsWith('.json')).slice(0, 100);
  const posts = await Promise.all(jsonFiles.map(async (file) => {
    try {
      const result = await readGitJson(current, file.path);
      const post = result.data || {};
      return {
        slug: post.slug || file.name.replace(/\.json$/i, ''),
        title: post.title || file.name,
        summary: post.summary || '',
        status: post.status || 'published',
        date: post.date || null,
        scheduledAt: post.scheduledAt || null,
        coverImage: post.coverImage || '',
        author: post.author || '',
        practiceArea: post.practiceArea || '',
        sha: result.sha
      };
    } catch {
      return null;
    }
  }));
  return posts.filter(Boolean).sort((a, b) => {
    const aTime = a.status === 'scheduled' && a.scheduledAt ? a.scheduledAt : (a.date || 0);
    const bTime = b.status === 'scheduled' && b.scheduledAt ? b.scheduledAt : (b.date || 0);
    return new Date(bTime) - new Date(aTime);
  });
}

module.exports = async function handler(req, res) {
  const minimumRole = req.method === 'GET' ? 'viewer' : 'editor';
  const current = requireCms(req, res, minimumRole);
  if (!current) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const slug = String(req.query?.slug || '').trim();
      if (slug) {
        if (!validSlug(slug)) return res.status(400).json({ error: 'Invalid article slug.' });
        const result = await readGitJson(current, `${POSTS_PATH}/${slug}.json`, { allowMissing: true });
        if (!result) return res.status(404).json({ error: 'Article not found.' });
        return res.status(200).json({ post: result.data, sha: result.sha });
      }
      return res.status(200).json(await listPosts(current));
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const post = {
        slug: String(body.slug || '').trim(),
        title: String(body.title || '').trim(),
        summary: String(body.summary || '').trim(),
        content: String(body.content || ''),
        coverImage: String(body.coverImage || '').trim(),
        date: body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: String(body.status || 'draft'),
        scheduledAt: body.scheduledAt && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt).toISOString() : '',
        author: String(body.author || '').trim().slice(0, 140),
        practiceArea: String(body.practiceArea || '').trim().slice(0, 180),
        seoTitle: String(body.seoTitle || '').trim(),
        seoDescription: String(body.seoDescription || '').trim()
      };
      if (!validPost(post)) return res.status(400).json({ error: 'Please complete the required article fields correctly.' });

      const path = `${POSTS_PATH}/${post.slug}.json`;
      let sha = body.sha || null;
      if (!sha) {
        const existing = await readGitJson(current, path, { allowMissing: true });
        sha = existing?.sha || null;
      }
      const updated = await writeGitJson(current, path, post, {
        sha,
        message: `${sha ? 'Update' : 'Create'} article: ${post.slug}`
      });
      return res.status(200).json({
        saved: true,
        commit: updated.commit?.sha || null,
        sha: updated.content?.sha || null,
        post
      });
    }

    if (req.method === 'DELETE') {
      const slug = String(req.body?.slug || '').trim();
      const sha = String(req.body?.sha || '').trim();
      if (!validSlug(slug) || !sha) return res.status(400).json({ error: 'Missing article slug or GitHub revision.' });
      await deleteGitFile(current, `${POSTS_PATH}/${slug}.json`, sha, `Delete article: ${slug}`);
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).end();
  } catch (error) {
    return sendError(res, error, 'Unable to manage articles.');
  }
};
