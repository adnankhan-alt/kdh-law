const { session } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const current = session(req);
  res.setHeader("Cache-Control", "no-store");
  return res.status(current ? 200 : 401).json({
    authenticated: Boolean(current),
    login: current?.login || null
  });
};
