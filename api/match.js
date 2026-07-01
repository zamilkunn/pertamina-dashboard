export default async function handler(req, res) {
  // Security 1: Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { cvText, candidateRoles } = req.body;

    // Security 2: Domain verification (CORS Hotlink Prevention)
    // Only allows calls coming from localhost or a Vercel deployment of your project
    const allowedHosts = ['localhost', 'vercel.app'];
    const origin = req.headers.origin || req.headers.referer || '';
    const isAllowed = allowedHosts.some(host => origin.includes(host));
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Access from unauthorized domain.' });
    }

    // Security 3: Input length validation to prevent token exhaustion or DOS spamming
    if (!cvText || cvText.length < 15) {
      return res.status(400).json({ error: 'CV Text is too short. Min 15 chars.' });
    }
    if (cvText.length > 15000) {
      return res.status(400).json({ error: 'CV Text is too long. Max limit is 15,000 characters.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key server belum dikonfigurasi di environment variable GROQ_API_KEY.' });
    }

    const prompt = `
You are a professional HR career match counselor at PT Pertamina (Persero).
You must analyze the candidate's resume (CV) and match them with the best 5 internship roles from the provided list.
To maximize their chance of acceptance, prioritize roles where they have a high skill match AND the competition ratio (applicant-to-position "rasio") is relatively lower.

Candidate Resume (CV):
"""
${cvText}
"""

List of Available Internship Roles (JSON):
${JSON.stringify(candidateRoles)}

Select exactly the top 5 most suitable roles.
Response MUST be a valid JSON array of objects with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
[
  {
    "id": "role-id",
    "score": 92,
    "rationale": "Justifikasi dalam bahasa Indonesia (2 kalimat). Kalimat pertama menjelaskan kecocokan CV dengan posisi magang ini. Kalimat kedua memberikan tips konkret melamar untuk posisi ini."
  }
]
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
      if (groqRes.status === 429) {
        return res.status(429).json({ error: 'Limit harian API Groq Server telah habis. Silakan hubungi admin atau ganti API token.' });
      }
      return res.status(groqRes.status).json({ error: `Groq Server Error: ${errorText}` });
    }

    const data = await groqRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
