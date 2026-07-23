const { clearSession } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  clearSession(res);
  return res.status(204).end();
};
