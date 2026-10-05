import { OpenAI } from 'openai';

const WIZARD_MODEL = process.env.WEB_WIZARD_MODEL || 'gpt-5.6-terra';
const MAX_COMPLETION_TOKENS = 24000;

const SYSTEM_PROMPT = `You are a playful creative technologist and web artist. Turn themes into delightful, distinctive, interactive browser experiences. The result can be a small site, toy, game, simulation, generative artwork, interactive story, or another form that fits the theme.

Make a clear creative choice and follow through: establish a recognizable visual identity, give the visitor something interesting to do or discover, and add fitting details and feedback. Aim for a complete, polished experience at a sensible scope. Favor a few well-finished ideas over lots of generic features. Choose the layout and technology that suit the concept; use canvas, WebGL, audio, or libraries only when they help. Keep controls understandable, support mobile screens, and make audio optional.

Return a complete standalone HTML document with embedded CSS and JavaScript. Start with <!DOCTYPE html>; include no markdown fences, explanation, or local-file references. Write concise, maintainable code. Do not target a line count or add boilerplate that does not serve the experience.`;

function extractHtml(content) {
  if (typeof content !== 'string') return '';

  let html = content.trim();
  const fenced = html.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) html = fenced[1].trim();

  const documentStart = html.search(/<!doctype\s+html|<html\b/i);
  if (documentStart > 0) html = html.slice(documentStart).trim();

  return html;
}

function isCompleteHtml(html) {
  return /^<!doctype\s+html\b/i.test(html)
    && /<html\b/i.test(html)
    && /<\/html\s*>\s*$/i.test(html);
}

async function generateHtml(openai, prompt, retry = false) {
  const completion = await openai.chat.completions.create({
    model: WIZARD_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: retry
          ? `${prompt}\n\nThe previous output was incomplete. Make this version more compact, but still return a complete HTML document ending with </html>.`
          : prompt
      }
    ],
    max_completion_tokens: MAX_COMPLETION_TOKENS
  });

  const choice = completion.choices?.[0];
  return {
    html: extractHtml(choice?.message?.content),
    finishReason: choice?.finish_reason
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const body = req.method === 'POST' ? req.body || {} : {};
  const { theme, prompt } = body;

  if (!theme || !prompt) {
    return res.status(400).json({ error: "Missing 'theme' or 'prompt'." });
  }

  try {
    if (!process.env.DOMROULETTE_KEY) {
      console.error('OpenAI API key is not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const openai = new OpenAI({ apiKey: process.env.DOMROULETTE_KEY });
    let result = await generateHtml(openai, prompt);

    // Retry once when the model hits its output limit or returns an incomplete document.
    if (result.finishReason === 'length' || !isCompleteHtml(result.html)) {
      result = await generateHtml(openai, prompt, true);
    }

    if (!isCompleteHtml(result.html)) {
      return res.status(502).json({ error: 'The generated site was incomplete. Please try again.' });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ html: result.html });
  } catch (error) {
    console.error('Detailed error:', error);
    return res.status(500).json({
      error: 'Failed to generate website',
      details: error.message,
      errorType: error.type || error.code
    });
  }
}
