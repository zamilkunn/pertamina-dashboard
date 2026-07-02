import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      open: true,
      configureServer: (server) => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          const isMatch = url.startsWith('/api/match');
          const isLetter = url.startsWith('/api/coverletter');
          const isOptimize = url.startsWith('/api/optimize');
          const isInterview = url.startsWith('/api/interview');

          if (isMatch || isLetter || isOptimize || isInterview) {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });

            req.on('end', async () => {
              try {
                const parsedBody = JSON.parse(body);
                const { cvText, candidateRoles, roleTitle, company, action, qaList } = parsedBody;
                
                if (cvText && cvText.length > 15000) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'CV Text is too long. Max limit is 15,000 characters.' }));
                  return;
                }

                const apiKey = env.GROQ_API_KEY;
                if (!apiKey || apiKey === 'gsk_your_actual_key_here') {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'API Key server belum dikonfigurasi di file .env' }));
                  return;
                }

                let prompt = '';
                let jsonMode = true;

                if (isMatch) {
                  prompt = `
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
                } else if (isLetter) {
                  jsonMode = false;
                  prompt = `
You are an expert career consultant. Write a professional, persuasive cover letter (Surat Lamaran Kerja) in Bahasa Indonesia for a candidate applying for the internship position of "${roleTitle}" at "${company}".
Use the details from their CV below to highlight relevant skills and show enthusiasm for joining the team.

Candidate CV:
"""
${cvText}
"""

Format the response as a formal business letter including a subject line ("Perihal: Lamaran Magang - ..."), proper salutations, body paragraphs showcasing fit, and a professional closing. Keep it polite, eager, and structured. Return ONLY the letter text.
`;
                } else if (isOptimize) {
                  prompt = `
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
                } else if (isInterview) {
                  if (action === 'generate_questions') {
                    prompt = `
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
                  } else if (action === 'evaluate_answers') {
                    prompt = `
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
                  }
                }

                const requestBody = {
                  model: "llama-3.3-70b-versatile",
                  messages: [{ role: "user", content: prompt }],
                  temperature: jsonMode ? 0.3 : 0.7
                };

                if (jsonMode) {
                  requestBody.response_format = { type: "json_object" };
                }

                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                  },
                  body: JSON.stringify(requestBody)
                });

                if (!groqRes.ok) {
                  const errorText = await groqRes.text();
                  res.statusCode = groqRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Groq Server Error: ${errorText}` }));
                  return;
                }

                const responseData = await groqRes.json();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');

                if (isLetter) {
                  res.end(JSON.stringify({ coverLetter: responseData.choices[0].message.content }));
                } else {
                  res.end(responseData.choices[0].message.content);
                }
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    },
    build: {
      outDir: 'dist'
    }
  };
});
