const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let handler;
const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalSecret = process.env.SUPABASE_SECRET_KEY;

before(async () => {
  handler = (await import('../api/ottawa-state.js')).default;
  process.env.SUPABASE_URL = 'https://planner-test.invalid/';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_fixture';
});
after(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

async function request(method, fields, headers = {}) {
  const result = { headers: {}, status: 200 };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler({ method, body: { fields }, headers: { host: 'trip.test', 'content-type': 'application/json', ...headers } }, res);
  return result;
}

test('GET filters unknown database fields and never returns the secret', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://planner-test.invalid/rest/v1/ottawa_trip_fields?select=key,value');
    assert.equal(options.headers.apikey, 'sb_secret_test_fixture');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => [
      { key: 'notes', value: 'Bring raincoats' },
      { key: 'hotel', value: true },
      { key: 'plan-1-4', value: { skip: true, day: 2, done: false } },
      { key: 'SUPABASE_SECRET_KEY', value: 'must not leave the backend' },
      { key: 'plan-3-99', value: { done: true } }
    ] };
  };
  const response = await request('GET');
  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(response.body.fields, {
    notes: 'Bring raincoats', hotel: true, 'plan-1-4': { skip: true, day: 2, done: false }
  });
  assert.ok(!JSON.stringify(response.body).includes('sb_secret'));
});

test('PATCH upserts only edited fields, including activity resets', async () => {
  const fields = { notes: 'Table at 7', cost3: '200', hotel: false, 'plan-2-2': { skip: true }, 'plan-1-4': {} };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://planner-test.invalid/rest/v1/ottawa_trip_fields?on_conflict=key');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
    const rows = JSON.parse(options.body);
    assert.deepEqual(Object.fromEntries(rows.map(row => [row.key, row.value])), fields);
    assert.ok(rows.every(row => Number.isFinite(Date.parse(row.updated_at))));
    return { ok: true };
  };
  assert.deepEqual((await request('PATCH', fields, { origin: 'https://trip.test' })).body, { saved: true });
});

test('bad fields and oversized requests cannot reach Supabase', async () => {
  global.fetch = async () => { assert.fail('invalid data reached database'); };
  const invalid = [null, [], {}, { notes: 'x'.repeat(20001) }, { hotel: 'true' },
    { cost3: '' }, { cost3: '-2' }, { cost3: 'Infinity' }, { cost13: '4' },
    { key: 'anything' }, { 'plan-1-4': { day: 4 } }, { 'plan-1-4': { done: 'yes' } },
    { 'plan-1-99': {} }, { 'plan-0-4': {} }, { 'plan-1-4': { injected: true } }];
  for (const fields of invalid) assert.equal((await request('PATCH', fields)).status, 400);
});

test('cross-site and malformed origins are refused', async () => {
  for (const origin of ['https://another.test', 'null', 'not a url']) {
    assert.equal((await request('PATCH', { notes: 'no' }, { origin })).status, 403);
  }
});

test('only GET and JSON PATCH are supported', async () => {
  const response = await request('DELETE');
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, 'GET, PATCH');
  assert.equal((await request('PATCH', { notes: 'no' }, { 'content-type': 'text/plain' })).status, 415);
});

test('missing configuration returns 503 without trying the database', async () => {
  delete process.env.SUPABASE_SECRET_KEY;
  global.fetch = async () => { assert.fail('missing secret reached database'); };
  assert.equal((await request('GET')).status, 503);
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_fixture';
});

test('database errors and exceptions do not leak upstream details', async () => {
  for (const mode of ['status', 'throw']) {
    global.fetch = async () => {
      if (mode === 'throw') throw new Error('secret upstream details');
      return { ok: false };
    };
    const response = await request('GET');
    assert.equal(response.status, 502);
    assert.ok(!JSON.stringify(response.body).includes('secret upstream details'));
  }
});
