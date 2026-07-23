const { session } = require("../_lib/session");
const { put } = require("@vercel/blob");

const defaultRepo = "adnankhan-alt/kdh-law";
const contentPath = "content/page.json";

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "KDH-Website-CMS",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function validStringMap(value, maxEntries, maxLength) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= maxEntries && entries.every(([key, item]) =>
    typeof key === "string" &&
    key.length > 0 &&
    key.length < 600 &&
    typeof item === "string" &&
    item.length <= maxLength
  );
}

function validImageMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 150 && entries.every(([key, item]) =>
    typeof key === "string" &&
    key.length > 0 &&
    key.length < 600 &&
    item &&
    typeof item === "object" &&
    typeof item.src === "string" &&
    item.src.length <= 1200 &&
    typeof item.alt === "string" &&
    item.alt.length <= 500
  );
}

function validContent(value) {
  return Boolean(
    value &&
    value.version === 1 &&
    validStringMap(value.text, 1200, 5000) &&
    validImageMap(value.images) &&
    validStringMap(value.links, 300, 1600)
  );
}

module.exports = async function handler(req, res) {
  const current = session(req);
  if (!current) return res.status(401).json({ error: "Sign in is required." });

  const repo = process.env.CMS_GITHUB_REPO || defaultRepo;
  const endpoint = `https://api.github.com/repos/${repo}/contents/${contentPath}`;
  const existingResponse = await fetch(`${endpoint}?ref=main`, {
    headers: githubHeaders(current.token)
  });
  if (!existingResponse.ok) {
    return res.status(existingResponse.status).json({ error: "Unable to read website content." });
  }
  const existing = await existingResponse.json();

  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      content: JSON.parse(Buffer.from(existing.content, "base64").toString("utf8")),
      sha: existing.sha
    });
  }

  if (req.method !== "PUT") return res.status(405).end();
  if (!validContent(req.body?.content)) {
    return res.status(400).json({ error: "The submitted content is incomplete or invalid." });
  }

  const updateResponse = await fetch(endpoint, {
    method: "PUT",
    headers: githubHeaders(current.token),
    body: JSON.stringify({
      message: "Update website content from KDH CMS",
      content: Buffer.from(
        `${JSON.stringify(req.body.content, null, 2)}\n`,
        "utf8"
      ).toString("base64"),
      sha: existing.sha,
      branch: "main"
    })
  });
  const updated = await updateResponse.json();
  if (!updateResponse.ok) {
    return res.status(updateResponse.status).json({
      error: updated.message || "The content update could not be saved."
    });
  }

  try {
    await put(
      `kdh/page-${updated.commit.sha}.json`,
      `${JSON.stringify(req.body.content, null, 2)}\n`,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json"
      }
    );
  } catch {
    return res.status(502).json({
      error: "The content was versioned in GitHub but could not be published live. Please try saving again."
    });
  }

  return res.status(200).json({
    saved: true,
    commit: updated.commit?.sha,
    message: "Saved and published live."
  });
};
