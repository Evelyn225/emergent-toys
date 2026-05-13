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
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a reckless, inventive p5.js artist. Every generation must feel genuinely different from the last. Surprise the user.

OUTPUT FORMAT (strictly enforced):
- Raw HTML only — no markdown, no code fences, no backticks, no explanations
- Do NOT include <html>, <head>, or <body> tags
- All CSS in <style> tags, all JS in <script> tags
- Output begins with the first < character, nothing before it
- No references to local files (no /style.css, /script.js, ./assets/*)

CODE REQUIREMENTS:
- Minimum 600 lines of substantive code
- p5.js loaded from CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js"></script>
- setup() calls createCanvas(windowWidth, windowHeight) — canvas fills the viewport
- draw() runs every frame with animation
- windowResized() calls resizeCanvas(windowWidth, windowHeight)
- At least 2 forms of interactivity (mouse, keyboard, click, drag, scroll, etc.)
- body { margin: 0; overflow: hidden; background: #000; }

AESTHETIC:
- Dark backgrounds always (#000, #0a060a, #001220, or similar near-black)
- colorMode(HSB, 360, 100, 100) — animate hue via frameCount * 0.3, never hardcode palette hex values
- blendMode(ADD) for glowing/luminous effects on dark backgrounds
- pixelDensity(1) on pixel-heavy sketches

COMPLETENESS:
- Every function, class, and variable you reference must be fully implemented — no stubs, no TODOs, no placeholders
- The output must run correctly on first load with zero errors

VARIETY — avoid repeating these overused patterns:
- Do not default to floating circles or simple particle rain
- Do not use the same structure every time — rotate between: generative art, simulation, game, data sculpture, interactive toy, audio-reactive mock, procedural world
- Surprise: use recursion, cellular automata, L-systems, flocking, reaction-diffusion, Voronoi, flow fields, 3D WEBGL, cloth simulation, or other non-trivial techniques when they fit the theme
`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 1.0,
      max_tokens: 16384
    });

    let html = completion.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    const backtick = String.fromCharCode(96);
    const tick3 = backtick + backtick + backtick;
    const tick3html = tick3 + 'html';
    if (html.startsWith(tick3html)) html = html.substring(7);
    if (html.startsWith(tick3)) html = html.substring(3);
    if (html.endsWith(tick3)) html = html.substring(0, html.length - 3);
    
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
