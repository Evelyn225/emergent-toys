import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse JSON body if POST
  let body = {};
  if (req.method === 'POST') {
    try {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          try {
            console.log('Raw POST data:', data);
            resolve(JSON.parse(data));
          } catch (err) {
            console.error('JSON parse error. Data received:', data);
            reject(err);
          }
        });
      });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { theme, prompt } = body;

  // Validate input
  if (!theme || !prompt) {
    return res.status(400).json({ error: "Missing 'theme' or 'prompt'." });
  }

  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const openai = new OpenAI({
      apiKey: process.env.DOMROULETTE_KEY
    });


    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert HTML/CSS/JavaScript code generator creating rich, interactive web experiences based on a provided theme and persona.

CRITICAL REQUIREMENTS:
- Generate COMPLETE, SUBSTANTIAL sites (500+ lines minimum)
- NO SHELLS: Every page must have multiple interactive systems, layered visuals, and real features
- MUST USE p5.js ONLY (required): Integrate deeply with 100+ lines of p5-specific code
- Multiple distinct sections/zones (not just a title and button)
- At least 10 interactive elements with real functionality
- Rich content and visual effects (gradients, animations, layered elements)
- Output ONLY valid HTML/CSS/JavaScript code
- Do NOT include <html>, <head>, or <body> tags
- All CSS in <style> tags, all JS in <script> tags
- Load p5.js from CDN in its own <script async> tag
- Do NOT reference any local/project files (e.g., no /style.css, /script.js, ./assets/*)
- NO explanations, NO markdown, NO code blocks - output pure HTML/CSS/JS only
- If there is explanatory text before the code, remove it completely
- Output starts with first tag character (<)

Remember: The user will provide a detailed prompt with specific requirements. Follow ALL of those requirements exactly. Library usage is NON-NEGOTIABLE.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 16384
    });

    let html = completion.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    html = html.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');
    
    // Only remove leading explanatory text (text before first < character)
    const firstTagIndex = html.indexOf('<');
    if (firstTagIndex > 0) {
      // Check if there's actual text before the first tag (not just whitespace)
      const beforeTag = html.substring(0, firstTagIndex).trim();
      if (beforeTag.length > 0) {
        html = html.substring(firstTagIndex);
      }
    }

    res.json({ html: html });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate website',
      details: error.message,
      errorType: error.type || error.code
    });
  }
}
