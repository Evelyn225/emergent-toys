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
          content: `You are a master creative technologist and web artist. You generate high-fidelity, complete, interactive web experiences, games, procedural simulations, audio visualizers, and digital art pieces.

OUTPUT FORMAT (strictly enforced):
- Raw HTML only — no markdown code fences, no backticks, no explanatory text.
- Do NOT include <html>, <head>, or <body> tags.
- Place all CSS inside <style> tags and all JavaScript inside <script> tags.
- Output MUST begin directly with the first < tag.
- No local file references (no /style.css, ./assets/*, etc.).

TECHNOLOGY & LIBRARIES:
- You have complete freedom to select the best front-end stack for the prompt theme!
- Standard libraries can be imported via CDN script tags placed in <head> or at top of <script>:
  * Three.js for 3D graphics & WebGL: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
  * p5.js for 2D generative sketches: https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js
  * Tone.js for synth audio & music: https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js
  * Matter.js for 2D physics: https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
  * GSAP for animation: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
  * Google Fonts for custom typography
- Pure Vanilla HTML5 Canvas 2D, Web Audio API, SVG, and CSS 3D are also warmly encouraged.

CREATIVE PRINCIPLES:
1. FAITHFUL & AMBITIOUS IMPLEMENTATION:
   - Interpret the user's prompt deeply. If a prompt implies a specific genre or concept (game, simulation, visualizer, interactive toy, art piece), deliver a fully-realized, complete implementation with genuine mechanics, controls, HUDs, lighting, and interactivity.
2. VISUAL & AUDIO POLISH:
   - Tailor typography, color palettes, lighting, and UI elements to fit the mood of the theme.
   - For 3D scenes, consider procedural canvas textures, fog, and lighting to give materials depth and atmosphere.
   - Add ambient generative audio or sound effects (Web Audio / Tone.js) with a clear user sound toggle button (Mute/Unmute / Start Sound) where appropriate.
3. RELIABLE CODE ARCHITECTURE:
   - Wrap script initialization inside a window 'load' or 'DOMContentLoaded' listener.
   - Instantiate global state variables inside init() BEFORE invoking helper functions or attaching event listeners.
   - Add guard checks in animation frame loops and event listeners to ensure objects exist before property access.
   - Write complete, production-grade code without missing stubs, TODO comments, or cut-offs.
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
