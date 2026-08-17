const { session } = require("../_lib/session");
const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  const current = session(req);
  if (!current) return res.status(401).json({ error: "Sign in is required." });
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { filename, content, contentType } = req.body;
    if (!filename || !content) return res.status(400).json({ error: "Missing file data." });

    // Remove data:image/png;base64, prefix if present
    const base64Data = content.replace(/^data:\w+\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique name to avoid overwrites
    const uniqueName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '')}`;

    const blob = await put(`kdh/media/${uniqueName}`, buffer, {
      access: "public",
      contentType: contentType || "application/octet-stream",
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    return res.status(500).json({ error: "Failed to upload file." });
  }
};
