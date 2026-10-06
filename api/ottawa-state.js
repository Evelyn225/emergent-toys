// Supabase credentials stay in the server environment, never in the planner.
const bookingFields = new Set(['hotel', 'dinner', 'gallery', 'bunker', 'nature', 'ghost']);
const textFields = new Set(['start', 'notes']);
const activityCounts = [4, 6, 7, 6];

function validField(key, value) {
  if (key.startsWith('plan-')) {
    const match = /^plan-([0-3])-(\d{1,2})$/.exec(key);
    return Boolean(match && Number(match[2]) < activityCounts[Number(match[1])]
      && value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every(field => ['skip', 'done', 'day'].includes(field))
      && ['skip', 'done'].every(field => value[field] === undefined || typeof value[field] === 'boolean')
      && (value.day === undefined || (Number.isInteger(value.day) && value.day >= 0 && value.day <= 3)));
  }
  if (bookingFields.has(key)) return typeof value === 'boolean';
  if (/^cost([0-9]|1[0-2])$/.test(key)) {
    return typeof value === 'string' && value.trim() !== '' && value.length <= 20
      && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000;
  }
  return textFields.has(key) && typeof value === 'string' && value.length <= (key === 'notes' ? 20000 : 500);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.method === 'PATCH') {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          return res.status(403).json({ error: 'Cross-site update refused' });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid origin' });
      }
    }
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return res.status(415).json({ error: 'JSON required' });
    }
    const fields = req.body?.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)
      || Object.keys(fields).length < 1 || Object.keys(fields).length > 80
      || JSON.stringify(fields).length > 35000
      || !Object.entries(fields).every(([key, value]) => validField(key, value))) {
      return res.status(400).json({ error: 'Invalid planner fields' });
    }
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return res.status(503).json({ error: 'Shared sync not configured yet. Add Supabase environment variables and redeploy.' });
  }

  const headers = { apikey: secret, 'Content-Type': 'application/json' };
  // Older service-role JWTs can also be placed in SUPABASE_SECRET_KEY.
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;

  try {
    const base = url.replace(/\/$/, '') + '/rest/v1/ottawa_trip_fields';
    if (req.method === 'PATCH') {
      const updatedAt = new Date().toISOString();
      const rows = Object.entries(req.body.fields).map(([key, value]) => ({ key, value, updated_at: updatedAt }));
      const response = await fetch(base + '?on_conflict=key', {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Database write failed');
      return res.status(200).json({ saved: true });
    }

    const response = await fetch(base + '?select=key,value', { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Database read failed');
    const rows = await response.json();
    const fields = Object.fromEntries(rows.filter(row => validField(row.key, row.value)).map(row => [row.key, row.value]));
    return res.status(200).json({ fields });
  } catch {
    return res.status(502).json({ error: 'Shared sync unavailable. Check database setup; your edits remain saved locally.' });
  }
}
