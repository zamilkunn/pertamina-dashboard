export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, cvText, roleTitle, company, qaList } = req.body;

    const allowedHosts = ['localhost', 'vercel.app'];
    const origin = req.headers.origin || req.headers.referer || '';
    const isAllowed = allowedHosts.some(host => origin.includes(host));
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Access from unauthorized domain.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key server belum dikonfigurasi.' });
    }

    if (action === 'generate_questions') {
      const prompt = `
You are a professional HR recruiter at PT Pertamina (Persero).
Generate exactly 5 realistic, targeted interview questions in Bahasa Indonesia for a candidate applying for the internship position of "${roleTitle}" at "${company}".
The questions should be a mix of technical skills and behavioral/fit assessment, customized based on the candidate's CV.

Candidate CV:
"""
${cvText}
"""

Response MUST be a valid JSON object with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
{
  "questions": [
    "Question 1...",
    "Question 2...",
    "Question 3...",
    "Question 4...",
    "Question 5..."
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
          temperature: 0.5
        })
      });

      if (!groqRes.ok) {
        return res.status(groqRes.status).json({ error: await groqRes.text() });
      }

      const data = await groqRes.json();
      return res.status(200).json(JSON.parse(data.choices[0].message.content));

    } else if (action === 'evaluate_answers') {
      if (!qaList || qaList.length !== 5) {
        return res.status(400).json({ error: 'Evaluation requires exactly 5 questions and answers.' });
      }

      const prompt = `
You are a professional HR recruiter at PT Pertamina (Persero).
Evaluate the candidate's answers to the 5 mock interview questions for the internship position of "${roleTitle}" at "${company}".

Questions and Candidate Answers:
${qaList.map((qa, idx) => `
Q${idx + 1}: ${qa.question}
A${idx + 1}: ${qa.answer}
`).join('\n')}

For each question, provide:
1. A score from 0 to 100 based on the relevance, depth, and professionalism of their answer.
2. A brief constructive feedback in Bahasa Indonesia.
3. A short, professional model answer (jawaban ideal) in Bahasa Indonesia.

Also provide an overall final score (average) and an assessment verdict (e.g. "Excellent Candidate", "Good Potential", "Needs Practice").

Response MUST be a valid JSON object with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
{
  "overallScore": 85,
  "verdict": "Good Potential",
  "evaluations": [
    {
      "score": 80,
      "feedback": "Feedback for Q1 in Bahasa Indonesia...",
      "modelAnswer": "Model answer for Q1 in Bahasa Indonesia..."
    },
    ...
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
        return res.status(groqRes.status).json({ error: await groqRes.text() });
      }

      const data = await groqRes.json();
      return res.status(200).json(JSON.parse(data.choices[0].message.content));
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
