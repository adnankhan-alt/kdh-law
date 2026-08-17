const { session } = require("../_lib/session");
const { put, list, del } = require("@vercel/blob");

const defaultRepo = "adnankhan-alt/kdh-law";

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "KDH-Website-CMS",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

module.exports = async function handler(req, res) {
  const current = session(req);
  if (!current) return res.status(401).json({ error: "Sign in is required." });

  const repo = process.env.CMS_GITHUB_REPO || defaultRepo;

  if (req.method === "GET") {
    try {
      const endpoint = `https://api.github.com/repos/${repo}/contents/content/posts?ref=main`;
      const ghRes = await fetch(endpoint, { headers: githubHeaders(current.token) });
      if (ghRes.status === 404) return res.status(200).json([]);
      if (!ghRes.ok) throw new Error("Could not fetch posts");
      
      const files = await ghRes.json();
      const posts = files.filter(f => f.name.endsWith(".json")).map(f => ({
        name: f.name,
        path: f.path,
        sha: f.sha
      }));
      return res.status(200).json(posts);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PUT") {
    // Create or update post
    const { slug, title, summary, content, date, sha } = req.body;
    if (!slug || !title || !content) return res.status(400).json({ error: "Missing required fields" });

    const postData = { slug, title, summary, content, date: date || new Date().toISOString() };
    const contentStr = JSON.stringify(postData, null, 2) + "\n";
    const endpoint = `https://api.github.com/repos/${repo}/contents/content/posts/${slug}.json`;

    const body = {
      message: `Update post: ${slug}`,
      content: Buffer.from(contentStr, "utf8").toString("base64"),
      branch: "main"
    };
    if (sha) body.sha = sha;

    const ghRes = await fetch(endpoint, {
      method: "PUT",
      headers: githubHeaders(current.token),
      body: JSON.stringify(body)
    });

    const updated = await ghRes.json();
    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: updated.message || "Failed to save post" });
    }

    try {
      await put(`kdh/posts/${slug}.json`, contentStr, {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json"
      });
    } catch (e) {
      // Vercel blob failure
    }

    return res.status(200).json({ saved: true, commit: updated.commit?.sha, sha: updated.content?.sha });
  }

  if (req.method === "DELETE") {
    const { slug, sha } = req.body;
    if (!slug || !sha) return res.status(400).json({ error: "Missing slug or sha" });

    const endpoint = `https://api.github.com/repos/${repo}/contents/content/posts/${slug}.json`;
    const ghRes = await fetch(endpoint, {
      method: "DELETE",
      headers: githubHeaders(current.token),
      body: JSON.stringify({
        message: `Delete post: ${slug}`,
        sha,
        branch: "main"
      })
    });

    if (!ghRes.ok) {
      const err = await ghRes.json();
      return res.status(ghRes.status).json({ error: err.message || "Failed to delete post" });
    }

    try {
      await del(`kdh/posts/${slug}.json`);
    } catch (e) {
      // Ignore blob deletion failure
    }

    return res.status(200).json({ deleted: true });
  }

  return res.status(405).end();
};
