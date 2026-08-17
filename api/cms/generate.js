const { session } = require("../_lib/session");

module.exports = async function handler(req, res) {
  const current = session(req);
  if (!current) return res.status(401).json({ error: "Sign in is required." });

  if (req.method !== "POST") return res.status(405).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on Vercel." });

  try {
    const aiPrompt = `You are a professional legal content writer for KDH Advocates LLP, a premier commercial law firm in Nairobi, Kenya.
Write a professional, insightful article about the following topic: "${prompt}"

Format the output strictly as a JSON object with the following keys:
- "title": A professional, engaging headline.
- "summary": A 2-3 sentence overview of the article.
- "content": The body of the article formatted in HTML (use <p>, <h2>, <ul>, etc. but NO markdown block quotes or <body> tags. Just the raw inner HTML).

Ensure the tone is authoritative, commercial, and relevant to the African/Kenyan market where applicable. Return ONLY the JSON object.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error("Failed to communicate with AI service.");
    }

    const data = await response.json();
    const resultText = data.candidates[0]?.content?.parts[0]?.text;
    
    if (!resultText) throw new Error("AI returned empty response.");
    
    const parsed = JSON.parse(resultText);
    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
