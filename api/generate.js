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
- You have TOTAL FREEDOM to select ANY front-end technology, library, or pure vanilla HTML5 stack!
- Pure Vanilla HTML5 Canvas 2D, WebGL, Web Audio API, CSS 3D, and SVG are warmly encouraged — they have zero CDN dependencies, instant 60fps performance, and 0% risk of external library loading errors.
- For classic retro 3D games (such as Wolfenstein / Doom style corridor crawlers), a pure HTML5 Canvas 2D raycaster or WebGL shader is often the most authentic, performant, and bug-free approach!
- If an external library is helpful (Three.js, p5.js, Tone.js, Matter.js, GSAP), you may import it via standard CDN script tags in <head> (e.g. from cdnjs, jsdelivr, or unpkg).

CONTROL CONVENTIONS (MUST BE ACCURATE):
- Standard Keyboard Mappings:
  * W / ArrowUp = Move Forward
  * S / ArrowDown = Move Backward
  * A / ArrowLeft = Turn Left or Strafe Left
  * D / ArrowRight = Turn Right or Strafe Right
- Double check vector math and angle signs (e.g. angle += turnSpeed vs -= turnSpeed) so movement is completely natural and controls are NEVER swapped or inverted.

CREATIVE PRINCIPLES:
1. FAITHFUL & AMBITIOUS IMPLEMENTATION:
   - Interpret the user's prompt deeply. If a prompt implies a specific genre or concept (game, simulation, visualizer, interactive toy, art piece), deliver a fully-realized implementation with genuine mechanics, controls, HUDs, lighting, and interactivity.
2. VISUAL & AUDIO POLISH:
   - Always include CSS resets: html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; font-family: sans-serif; } canvas { display: block; width: 100%; height: 100%; }
   - Tailor typography, color palettes, lighting, and UI elements to fit the mood of the theme.
   - For audio: Prefer native browser Web Audio API (AudioContext, OscillatorNode, GainNode) which requires zero external scripts. Always wrap audio setup in a try/catch block so audio issues NEVER block canvas rendering!

3. STRICT NULL-SAFETY & RELIABLE ARCHITECTURE:
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
     * FIRST: Instantiate ALL global state variables (e.g. canvas, ctx, player = { x:0, y:0, dir:0 }, map = []).
     * SECOND: ONLY AFTER global state variables are assigned, invoke sub-generator helper routines (e.g. generateWorld(), spawnEntities()).
     * THIRD: ONLY AT THE END of init(), attach DOM event listeners ('resize', 'click', 'keydown', UI button clicks).
   - DEFENSIVE GUARD CLAUSES:
     * EVERY event handler and animation frame function MUST verify object non-null status before property access.
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
