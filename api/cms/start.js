const crypto = require("crypto");
const { seal, setCookie } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(503).send("The CMS GitHub connection has not been configured.");
  }

  const state = crypto.randomBytes(24).toString("hex");
  setCookie(
    res,
    "kdh_cms_oauth",
    seal({ state, exp: Date.now() + 10 * 60 * 1000 }),
    10 * 60
  );
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: "https://www.kdhadvocates.com/api/cms/callback",
    scope: "repo",
    state
  });
  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
};
