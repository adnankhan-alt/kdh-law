const { COOKIE_NAME, cookies, seal, setCookie, unseal } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const oauth = unseal(cookies(req).kdh_cms_oauth || "");
  if (!oauth || oauth.state !== req.query.state || !req.query.code) {
    return res.status(401).send("This sign-in request is invalid or has expired.");
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: "https://www.kdhadvocates.com/api/cms/callback"
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return res.status(401).send("GitHub sign-in failed.");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "KDH-Website-CMS"
    }
  });
  const user = await userResponse.json();
  const allowed = (process.env.CMS_ALLOWED_GITHUB_USER || "adnankhan-alt").toLowerCase();
  if (String(user.login || "").toLowerCase() !== allowed) {
    return res.status(403).send("This GitHub account is not authorised to edit KDH content.");
  }

  setCookie(
    res,
    COOKIE_NAME,
    seal({
      token: tokenData.access_token,
      login: user.login,
      exp: Date.now() + 8 * 60 * 60 * 1000
    })
  );
  res.redirect(302, "/admin/");
};
