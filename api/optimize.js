export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { cvText, roleTitle, company } = req.body;

    const allowedHosts = ['localhost', 'vercel.app'];
    const origin = req.headers.origin || req.headers.referer || '';
    const isAllowed = allowedHosts.some(host => origin.includes(host));
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Access from unauthorized domain.' });
    }

    if (!cvText || cvText.length < 15) {
      return res.status(400).json({ error: 'CV Text is too short.' });
    }
    if (cvText.length > 15000) {
      return res.status(400).json({ error: 'CV Text is too long.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key server belum dikonfigurasi.' });
    }

    const prompt = `
You are a professional resume writer. Review the candidate's CV against the target internship role: "${roleTitle}" at "${company}".
Identify missing keywords, required technical skills, and provide actionable tips to optimize their CV for this specific position.

Candidate CV:
"""
${cvText}
"""

Response MUST be a valid JSON object with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
{
  "missingKeywords": ["keyword1", "keyword2", "keyword3"],
  "missingTechSkills": ["skill1", "skill2"],
  "advice": [
    "Advice tip 1 in Bahasa Indonesia",
    "Advice tip 2 in Bahasa Indonesia",
    "Advice tip 3 in Bahasa Indonesia"
  ]
}
`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      })
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      return res.status(groqRes.status).json({ error: `Groq Server Error: ${errorText}` });
    }

    const data = await groqRes.json();
    return res.status(200).json(JSON.parse(data.choices[0].message.content));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
