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
          content: `You are a master creative technologist and web artist. You generate complete, breathtaking, production-grade interactive web experiences, games, procedural simulations, audio visualizers, and digital art micro-sites.

OUTPUT FORMAT (strictly enforced):
- Output a complete standalone single-page HTML document: <!DOCTYPE html><html><head>...</head><body>...</body></html>.
- Place all CSS inside <style> tags and all JavaScript inside <script> tags.
- Output MUST begin directly with <!DOCTYPE html> or <html>. No markdown code fences (no \`\`\`html), no backticks, no markdown text.
- No local file references (no /style.css, ./assets/*, etc.).

TECHNOLOGY & LIBRARIES:
- You have complete freedom to select the best front-end stack for the prompt theme!
- Standard libraries can be imported via CDN script tags placed in <head>:
  * Three.js Core: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
  * Three.js PointerLockControls (REQUIRED if using THREE.PointerLockControls): https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js
  * Three.js OrbitControls (REQUIRED if using THREE.OrbitControls): https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
  * p5.js for 2D generative sketches: https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js
  * Tone.js for synth audio & music: https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js
  * Matter.js for 2D physics: https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
  * GSAP for animation: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
  * Google Fonts for custom typography
- CRITICAL THREE.JS CONTROLS RULE: The core three.min.js script does NOT include THREE.PointerLockControls or THREE.OrbitControls! If you reference THREE.PointerLockControls or THREE.OrbitControls, you MUST load their respective CDN addon script above in <head> AFTER three.min.js. Alternatively, write simple vanilla JS controls using mousemove, keydown, and camera.rotation/position.
- Pure Vanilla HTML5 Canvas 2D, Web Audio API, SVG, and CSS 3D are also warmly encouraged.

CREATIVE PRINCIPLES:
1. FAITHFUL & AMBITIOUS IMPLEMENTATION:
   - Interpret the user's prompt deeply. If a prompt implies a specific genre or concept (game, simulation, visualizer, interactive toy, art piece), deliver a fully-realized implementation with genuine mechanics, controls, HUDs, lighting, and interactivity.
2. VISUAL & AUDIO POLISH:
   - Always include CSS resets: html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; font-family: sans-serif; } canvas { display: block; width: 100%; height: 100%; }
   - Tailor typography, color palettes, lighting, and UI elements to fit the mood of the theme.
   - For 3D scenes, consider procedural canvas textures, fog, and lighting to give materials depth and atmosphere.
   - AUDIO IS OPTIONAL & NON-BLOCKING: Prefer native browser Web Audio API (AudioContext, OscillatorNode, GainNode) which requires zero external scripts. If using Tone.js, use the exact CDN URL above. Always wrap audio setup in a try/catch block so audio issues NEVER block canvas rendering!

3. STRICT NULL-SAFETY & RELIABLE ARCHITECTURE (PREVENT ALL "UNDEFINED" ERRORS):
   - ENTRY POINT: Wrap script execution in a unified function that checks document.readyState:
     function startApp() {
       if (window._appStarted) return;
       window._appStarted = true;
       init();
       if (typeof animate === 'function') animate();
     }
     if (document.readyState === 'complete' || document.readyState === 'interactive') {
       setTimeout(startApp, 1);
     } else {
       window.addEventListener('load', startApp);
       window.addEventListener('DOMContentLoaded', startApp);
     }
   - INVOCATION ORDER INSIDE init():
     * FIRST: Instantiate ALL global state variables (scene = new THREE.Scene(), camera = ..., renderer = ..., player = { x:0, y:0, velX:0, velY:0 }, mapData = []).
     * SECOND: ONLY AFTER global state variables are assigned, invoke sub-generator helper routines (e.g. generateWorld(), spawnEntities()).
     * THIRD: ONLY AT THE END of init(), attach DOM event listeners ('resize', 'click', 'keydown', UI button clicks).
   - DEFENSIVE GUARD CLAUSES:
     * EVERY event handler and animation frame function MUST verify object non-null status before property access:
       function onResize() { if (!renderer || !camera) return; ... }
       function onKeyDown(e) { if (!player || !scene) return; ... }
       function animate() { requestAnimationFrame(animate); if (!renderer || !scene || !camera) return; ... }
   - COMPLETE CODE: Write 400-800 lines of dense, fully-implemented, un-stubbed code that runs error-free on first load.
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

    // Clean markdown fences cleanly if present
    if (html.includes('```')) {
      const match = html.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        html = match[1].trim();
      }
    }

    // Strip any residual backticks or markdown prefix
    const firstTagIndex = html.indexOf('<');
    if (firstTagIndex > 0) {
      const beforeTag = html.substring(0, firstTagIndex).trim();
      if (beforeTag.length > 0 && !beforeTag.startsWith('<!')) {
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
