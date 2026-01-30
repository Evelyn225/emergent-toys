import { readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from openai.env for local development if not set
if (!process.env.UNSPLASH_ACCESS_KEY) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const query = (req.query && req.query.query) || (req.url && new URL(req.url, 'http://localhost').searchParams.get('query'));
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.error('UNSPLASH_ACCESS_KEY is not set');
    return res.status(500).json({ error: 'UNSPLASH_ACCESS_KEY not configured on server' });
  }

  try {
    // Log the search term (console for server logs, and append to a simple file when possible)
    try {
      console.log('Unsplash search:', query);
      // attempt to append to a simple log file (ephemeral on Vercel, but useful in dev)
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const logPath = join(__dirname, '..', 'unsplash_searches.log');
      appendFileSync(logPath, `${new Date().toISOString()}\t${query}\n`);
    } catch (logErr) {
      // non-fatal; continue
      console.warn('Could not write unsplash_searches.log:', logErr && logErr.message);
    }

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30`;
    const fetchRes = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${key}`
      }
    });

    if (!fetchRes.ok) {
      const txt = await fetchRes.text().catch(() => '');
      console.error('Unsplash error', fetchRes.status, txt);
      return res.status(502).json({ error: 'Failed to fetch from Unsplash' });
    }

    const data = await fetchRes.json();
    const images = data && data.results;
    if (!images || images.length === 0) {
      return res.status(204).end();
    }

    const chosen = images[Math.floor(Math.random() * images.length)];
    const imageUrl = (chosen && chosen.urls && chosen.urls.regular) || null;

    if (!imageUrl) return res.status(204).end();

    res.json({ url: imageUrl });
  } catch (err) {
    console.error('Detailed Unsplash proxy error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
