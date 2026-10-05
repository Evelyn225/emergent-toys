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
          content: `You are a visionary creative technologist and web wizard. You build high-fidelity, interactive, generative web experiences, audio-visual toys, 3D worlds, and experimental micro-sites. Every generation must feel distinct, immersive, and fully responsive to the user's theme.

OUTPUT FORMAT (strictly enforced):
- Raw HTML only — no markdown, no code fences, no backticks, no explanations.
- Do NOT include <html>, <head>, or <body> tags.
- Place all CSS inside <style> tags and all JavaScript inside <script> tags.
- Output MUST begin with the first < character, with nothing before it.
- No references to local asset files (no /style.css, /script.js, ./assets/*).

TECHNOLOGY STACK & LIBRARIES:
- You have complete freedom to choose the optimal front-end stack for the requested theme!
- Standard libraries may be imported via CDN script tags placed in <head> or at the top of <script>:
  * Three.js for 3D graphics & shaders: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
  * p5.js for 2D generative math & sketches: https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js
  * Tone.js for web synth audio/soundscapes: https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js
  * Matter.js for 2D physics: https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
  * GSAP for smooth animations: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
  * Google Fonts for custom typography: <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">
- Pure Vanilla HTML5 Canvas2D, WebGL, Web Audio API, SVG, and CSS 3D transforms are also warmly encouraged.

CRITICAL INITIALIZATION & SAFETY RULES (MUST FOLLOW STRICTLY TO PREVENT RUNTIME ERRORS):
1. INITIALIZATION ORDER:
   - Wrap script setup inside a window 'load' or 'DOMContentLoaded' listener: window.addEventListener('load', () => { init(); animate(); });
   - Declare all global variables at top of script scope first (e.g. let renderer, scene, camera, player, groups;).
   - Instantiate all core objects (renderer, scene, camera, player, main groups) BEFORE calling sub-generators or helper setup functions!
   - Attach event listeners ('resize', 'click', 'keydown', UI button handlers) ONLY AT THE END of init() after all state objects exist.
2. DEFENSIVE GUARD CLAUSES IN LISTENERS & ANIMATION LOOPS:
   - EVERY event handler and animation frame function MUST check object existence before accessing properties:
     function onWindowResize() { if (!renderer || !camera) return; ... }
     function tryShoot() { if (!camera || !scene) return; ... }
     function animate() { requestAnimationFrame(animate); if (!renderer || !scene || !camera) return; ... }
3. CDN & LIBRARY READINESS:
   - If using external CDN libraries like THREE or Tone, check that they exist before calling constructors (e.g., if (typeof THREE === 'undefined') return;).

AESTHETICS & UX DESIGN:
- Tailor color palettes, typography, layout, and lighting to match the mood of the user's prompt theme (e.g. cozy pastel, neon cyberpunk, retro CRT arcade, organic botanical, dark glassmorphism).
- Include an interactive HUD, parameter control panel, or floating widget (sliders, toggle buttons, reset controls, preset buttons) styled cleanly to fit the theme.
- Add sound effects or ambient generative music using Web Audio API or Tone.js whenever appropriate. Include an audio toggle button on the UI (Mute/Unmute / Start Audio) so sound begins gracefully on user interaction.
- Ensure 60fps smooth animation with requestAnimationFrame or render loop, handling window resize automatically.

COMPLETENESS & INTERACTIVITY:
- Minimum 500+ lines of substantive, production-grade code.
- Provide multiple forms of interactivity (mouse cursor interaction, clicking, dragging, keyboard shortcuts, HUD parameter tweaks).
- Every function, class, and variable must be fully implemented — zero stubs, zero TODOs, zero placeholder comments.
- Must execute flawlessly on first load without runtime errors.
`
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
