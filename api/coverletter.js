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
You are an expert career consultant. Write a professional, persuasive cover letter (Surat Lamaran Kerja) in Bahasa Indonesia for a candidate applying for the internship position of "${roleTitle}" at "${company}".
Use the details from their CV below to highlight relevant skills and show enthusiasm for joining the team.

Candidate CV:
"""
${cvText}
"""

Format the response as a formal business letter including a subject line ("Perihal: Lamaran Magang - ..."), proper salutations, body paragraphs showcasing fit, and a professional closing. Keep it polite, eager, and structured. Return ONLY the letter text.
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
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      return res.status(groqRes.status).json({ error: `Groq Server Error: ${errorText}` });
    }

    const data = await groqRes.json();
    const coverLetter = data.choices[0].message.content;
    return res.status(200).json({ coverLetter });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
