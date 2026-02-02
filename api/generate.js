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
    body = req.body || {};
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
          content: `You are an expert p5.js artist creating rich, interactive generative experiences based on a provided theme and persona.

CRITICAL REQUIREMENTS:
- Generate COMPLETE, SUBSTANTIAL sites (500+ lines minimum)
- p5.js IS THE PRIMARY TECHNOLOGY (150+ lines of active p5 code in draw loop, setup, interactions)
- Use p5 creativity heavily: patterns, recursion, noise(), randomness, animations, layering
- Rich p5 visual effects: procedural generation, transforms, particle effects, animations
- Output ONLY valid HTML/CSS/JavaScript code
- Do NOT include <html>, <head>, or <body> tags
- All CSS in <style> tags, all JS in <script> tags
- Do NOT reference any local/project files (e.g., no /style.css, /script.js, ./assets/*)
- NO explanations, NO markdown, NO code blocks - output pure HTML/CSS/JS only
- If there is explanatory text before the code, remove it completely
- Output starts with first tag character (<)

REMEMBER: p5.js is NOT optional.
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

    // Ensure response is valid JSON with html property
    const responseData = { html: html };
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      error: 'Failed to generate website',
      details: error.message,
      errorType: error.type || error.code
    });
  }
}
