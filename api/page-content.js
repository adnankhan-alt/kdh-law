const { get, list } = require("@vercel/blob");

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const result = await list({ prefix: "kdh/page-", limit: 100 });
    const latest = result.blobs
      .filter((blob) => blob.pathname.endsWith(".json"))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    if (!latest) return res.status(404).json({ error: "No published visual content yet." });

    const blob = await get(latest.url, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return res.status(404).json({ error: "Published visual content is unavailable." });
    }

    const content = JSON.parse(await streamToString(blob.stream));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(content);
  } catch {
    return res.status(404).json({ error: "Published visual content is unavailable." });
  }
};
