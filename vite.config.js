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
          if (req.url && req.url.startsWith('/api/match')) {
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
                const { cvText, candidateRoles } = JSON.parse(body);
                
                // Security Check 1: Size validation to prevent token exhaustion attack
                if (!cvText || cvText.length < 15) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'CV Text is too short. Min 15 chars.' }));
                  return;
                }
                if (cvText.length > 15000) {
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
                    res.statusCode = 429;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Limit harian API Groq Server telah habis. Silakan hubungi admin atau ganti API token.' }));
                  } else {
                    res.statusCode = groqRes.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: `Groq Server Error: ${errorText}` }));
                  }
                  return;
                }

                const data = await groqRes.json();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
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
