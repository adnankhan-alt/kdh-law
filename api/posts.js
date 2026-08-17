const { list } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { blobs } = await list({ prefix: "kdh/posts/", limit: 100 });
    const posts = await Promise.all(blobs.map(async (blob) => {
      try {
        const fetchRes = await fetch(blob.url);
        const data = await fetchRes.json();
        return data;
      } catch {
        return null;
      }
    }));

    const validPosts = posts.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json(validPosts);
  } catch (error) {
    return res.status(500).json({ error: "Could not fetch posts" });
  }
};
