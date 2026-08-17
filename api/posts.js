const { list } = require("@vercel/blob");

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  try {
    const { blobs } = await list({ prefix: "kdh/posts/", limit: 100 });
    const posts = await Promise.all(blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url);
        const data = await res.json();
        return data;
      } catch {
        return null;
      }
    }));

    const validPosts = posts.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return new Response(JSON.stringify(validPosts), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Could not fetch posts" }), { status: 500 });
  }
}
