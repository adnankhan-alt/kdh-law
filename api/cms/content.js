const { session } = require("../_lib/session");

const defaultRepo = "adnankhan-alt/kdh-law";
const contentPath = "content/site.json";

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "KDH-Website-CMS",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function validContent(value) {
  const required = [
    "hero.eyebrow",
    "hero.heading",
    "hero.accent",
    "hero.introduction",
    "firm.heading",
    "firm.accent",
    "firm.paragraphOne",
    "firm.paragraphTwo",
    "contact.heading",
    "contact.accent",
    "contact.introduction",
    "contact.email",
    "contact.phone",
    "contact.office"
  ];
  return required.every((path) => {
    const result = path.split(".").reduce((current, key) => current?.[key], value);
    return typeof result === "string" && result.trim().length > 0 && result.length < 3000;
  });
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

  return res.status(200).json({
    saved: true,
    commit: updated.commit?.sha,
    message: "Saved. Vercel is publishing the new content."
  });
};
