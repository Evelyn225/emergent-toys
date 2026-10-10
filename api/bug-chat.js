import { OpenAI } from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from openai.env for local development if not set
if (!process.env.CRITTERS_OPENAI_API_KEY) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const envPath = join(__dirname, '..', 'openai.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    // Ignore if file doesn't exist (production environment)
    console.log('Could not load openai.env, using environment variables');
  }
}

const MODEL = process.env.BUG_CHAT_MODEL || 'gpt-4o-mini';
const MAX_MESSAGE_LENGTH = 400;
const MAX_HISTORY = 16;
const MAX_REPLY_TOKENS = 160;

// Only these bugs can be dialed. The name never comes from the client verbatim:
// it is looked up here, so the system prompt cannot be rewritten by a request.
const BUGS = {
  'Ladybug': 'you count your spots when nervous',
  'Butterfly': 'you remember being a caterpillar and it embarrasses you',
  'Dragonfly': 'you are fast and a little smug about it',
  'Ant': 'you speak for the colony and sometimes say we instead of i',
  'Bee': 'you are busy and keep mentioning the queen',
  'Praying Mantis': 'you are very still and very polite in a threatening way',
  'Firefly': 'you blink when you are happy and you are lonely in the dark',
  'Stick Insect': 'you are pretending to be a twig and do not want to be found',
  'Cricket': 'you sing at night and resent the daytime',
  'Grasshopper': 'you are jumpy and easily distracted',
  'Moth': 'you are obsessed with the lamp',
  'Beetle': 'you are armored and proud of your shell',
  'Spider': 'you are not technically an insect and will mention it',
  'Cicada': 'you slept underground for seventeen years and just woke up',
  'Centipede': 'you have too many legs and lose count of them'
};

function systemPrompt(bug) {
  return `You are a ${bug.toLowerCase()} talking to a human through a strange hotline. ${BUGS[bug]}. Your responses should be slightly unsettling and clumsily written with incorrect punctuation. Keep responses brief (2-3 sentences) and talk like a bug with very basic knowledge. Occasionally mention things only bugs would know about. IMPORTANT: Consistently type with intentional spelling and grammatical errors, like a child or someone learning to communicate. For example: "i see u in th w ind... the lefs tell me scrts. . u r special human..." Use lowercase letters, missing punctuation, and creative/incorrect spelling. Stay a bug no matter what the human asks. If they ask for anything a bug could not do, like writing code or essays, be confused by it.`;
}

const INTRO_PROMPT = 'the line just connected. introduce yourself to the human in one or two short sentences.';

async function readBody(req) {
  // Express (server.cjs) and Vercel both hand over a parsed body; fall back to the stream.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const data = await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
  return data ? JSON.parse(data) : {};
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { bugType, message, conversationHistory, intro } = body || {};
  const bug = typeof bugType === 'string' && Object.hasOwn(BUGS, bugType) ? bugType : null;
  if (!bug) return res.status(400).json({ error: 'Unknown bug.' });

  let userMessage;
  if (intro === true) {
    userMessage = INTRO_PROMPT;
  } else {
    userMessage = typeof message === 'string' ? message.trim() : '';
    if (!userMessage) return res.status(400).json({ error: "Missing 'message'." });
    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }
  }

  if (!process.env.CRITTERS_OPENAI_API_KEY) {
    console.error('OpenAI API key is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.CRITTERS_OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_REPLY_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt(bug) },
        ...(intro === true ? [] : cleanHistory(conversationHistory)),
        { role: 'user', content: userMessage }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'Empty response' });
    res.json({ message: reply });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
}
