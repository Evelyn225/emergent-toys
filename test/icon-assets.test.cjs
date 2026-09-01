'use strict';
// Icon values travel as opaque strings ('icon:notepad'), and iconMarkup falls
// back to rendering an unrecognised one as text. That fallback is deliberate -
// it is what keeps the project emoji and old persisted shortcuts working - but
// it means a typo'd key does not throw, it just prints "icon:notpad" into the
// titlebar, and a renamed PNG just leaves a broken image. Both become build
// failures here instead.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const iconsSrc = fs.readFileSync(path.join(ROOT, 'os/icons.js'), 'utf8');

function registry() {
  const start = iconsSrc.indexOf('const OS_ICONS = {');
  assert.notStrictEqual(start, -1, 'const OS_ICONS = { not found in os/icons.js');
  const end = iconsSrc.indexOf('\n};', start);
  assert.notStrictEqual(end, -1, 'OS_ICONS is not terminated');
  const block = iconsSrc.slice(start, end);
  return [...block.matchAll(/^\s{2}'?([a-z][a-z-]*)'?:\s*'([^']+)'/gm)].map(m => ({ key: m[1], file: m[2] }));
}

// Every source that can hold an icon value. Kept explicit rather than globbed
// so a new app file has to be added here consciously.
function sources() {
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'os')).filter(f => f.endsWith('.js')).map(f => 'os/' + f),
    ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.js')).map(f => 'apps/' + f),
    'sleep-os.html',
    'os/os.css',
  ];
  return files.map(rel => ({ rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') }));
}

test('every icon in OS_ICONS exists in os/icons', () => {
  const entries = registry();
  assert.ok(entries.length >= 20, `expected the OS_ICONS table, found ${entries.length} entries`);
  for (const { key, file } of entries) {
    const full = path.join(ROOT, 'os/icons', file);
    assert.ok(fs.existsSync(full), `${key} points at os/icons/${file}, which does not exist`);
    assert.ok(fs.statSync(full).size > 0, `os/icons/${file} is empty`);
  }
});

// The CSS sizes every slot at 16px or 32px and leans on those being a whole
// 1:1 or 2:1 of the source. Art at any other size resamples onto fractions of a
// pixel, which is the one thing the whole set is meant to avoid.
//
// These keys are 16x16 instead, and that is not a relaxation of the rule above
// - it is the same rule. They are list-row art that only ever lands in a 16px
// slot (`.reg-val-name .os-icon` for registry values, and the browser start
// page's own `.lnk img`), where 16x16 draws 1:1 and is strictly sharper than
// downscaling 32x32 art would be.
//
// The constraint that comes with them: NEVER use one of these in a 32px slot -
// a window titlebar, a desktop icon, a dialog. There it would be upscaled 2:1
// and read as chunky beside native 32x32 neighbours. Adding a key here is a
// promise about where it gets used, so add one only alongside the 16px call
// site that needs it.
const SMALL_16PX_ICONS = new Set([
  'regedit-string',
  'regedit-binary',
  'wikipedia',
  'internet-archive',
  'poolsuite',
  'win-icons',
]);

test('every icon is 32x32, or 16x16 if it is declared list-row art', () => {
  for (const { key, file } of registry()) {
    const buf = fs.readFileSync(path.join(ROOT, 'os/icons', file));
    assert.strictEqual(buf.toString('ascii', 12, 16), 'IHDR', `os/icons/${file} is not a PNG`);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const expected = SMALL_16PX_ICONS.has(key) ? '16x16' : '32x32';
    assert.strictEqual(`${w}x${h}`, expected,
      `${key} (os/icons/${file}) is ${w}x${h}, not ${expected}` +
      (expected === '32x32' ? ' - add it to SMALL_16PX_ICONS only if it is 16px list-row art' : ''));
  }
});

// A 16x16 icon in a 32px slot is upscaled 2:1 and looks chunky next to the
// native 32x32 set, so the promise made by SMALL_16PX_ICONS is enforced rather
// than trusted. mkWin's `icon:` argument and DESKTOP_ICONS entries are the two
// 32px slots a small icon could plausibly reach by mistake.
test('no 16x16 icon is used in a 32px slot', () => {
  const bad = [];
  for (const { rel, text } of sources()) {
    if (rel === 'os/icons.js') continue;
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/'icon:([a-z-]+)'/g)) {
        if (!SMALL_16PX_ICONS.has(m[1])) continue;
        if (/\bmkWin\(|icon:\s*'icon:|DESKTOP_ICONS/.test(line)) bad.push(`${rel}:${i + 1} uses icon:${m[1]}`);
      }
    });
  }
  assert.deepStrictEqual(bad, [], 'these put 16x16 list-row art into a 32px slot, where it upscales and looks chunky');
});

test('every icon: token used in the OS resolves to a registry key', () => {
  const known = new Set(registry().map(e => e.key));
  const unknown = [];
  for (const { rel, text } of sources()) {
    if (rel === 'os/icons.js') continue;
    for (const m of text.matchAll(/'icon:([a-z-]+)'/g)) {
      if (!known.has(m[1])) unknown.push(`${rel}: icon:${m[1]}`);
    }
  }
  assert.deepStrictEqual(unknown, [], 'these tokens have no OS_ICONS entry, so they would render as literal text');
});

// A file in os/icons/ that nothing points at is either art waiting to be wired
// up or a leftover; either way it should be noticed rather than shipped.
//
// Not every reference goes through the registry: moon.png is a mask in
// os/os.css, not a 32px icon, and it is written 'icons/moon.png' because the
// stylesheet already sits in os/. Both spellings count as a reference.
test('every PNG in os/icons is referenced', () => {
  const used = new Set(registry().map(e => e.file));
  const direct = sources().flatMap(({ text }) => [...text.matchAll(/(?:os\/)?icons\/([\w.-]+\.png)/g)].map(m => m[1]));
  direct.forEach(f => used.add(f));
  const orphans = fs.readdirSync(path.join(ROOT, 'os/icons')).filter(f => f.endsWith('.png') && !used.has(f));
  assert.deepStrictEqual(orphans, [], 'these icons exist but nothing references them');
});

// The registry is only half the contract - a token still has to be run through
// iconMarkup to become an <img>. Assigning one to textContent prints the token.
test('icon values are never written straight to textContent', () => {
  const bad = [];
  for (const { rel, text } of sources()) {
    text.split('\n').forEach((line, i) => {
      if (/textContent\s*=\s*[^;]*'icon:/.test(line)) bad.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(bad, [], 'these lines would print a raw icon: token instead of drawing the icon');
});

// The scan that found the emoji missed a dozen call sites passing the literal
// 'X' as their icon, because 'X' is not an emoji - it just rendered as a
// letter in the dialog. Checking the argument position instead of the glyph is
// what catches that, so it is checked here rather than by eye.
test('every dialog icon argument is a token, not a literal glyph', () => {
  const bad = [];
  for (const { rel, text } of sources()) {
    if (!rel.endsWith('.js')) continue;
    const re = /\bos(Alert|Confirm|Prompt)\(/g;
    let m;
    while ((m = re.exec(text))) {
      // Walk to the matching close paren so a nested call in the message body
      // cannot end the argument list early.
      let i = m.index + m[0].length, depth = 1, q = null, esc = false;
      for (; i < text.length && depth > 0; i++) {
        const c = text[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (q) { if (c === q) q = null; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; continue; }
        if ('(['.includes(c) || c === '{') depth++;
        else if (')]'.includes(c) || c === '}') depth--;
      }
      const inner = text.slice(m.index + m[0].length, i - 1);
      let d2 = 0, q2 = null, e2 = false, lastComma = -1;
      for (let j = 0; j < inner.length; j++) {
        const c = inner[j];
        if (e2) { e2 = false; continue; }
        if (c === '\\') { e2 = true; continue; }
        if (q2) { if (c === q2) q2 = null; continue; }
        if (c === "'" || c === '"' || c === '`') { q2 = c; continue; }
        if ('([{'.includes(c)) d2++;
        else if (')]}'.includes(c)) d2--;
        else if (c === ',' && d2 === 0) lastComma = j;
      }
      if (lastComma === -1) continue;
      const last = inner.slice(lastComma + 1).trim();
      // Only literal strings are checked; a variable or a || expression is the
      // caller's business and is covered by the token test above.
      if (!/^'[^']*'$/.test(last) || last.startsWith("'icon:")) continue;
      bad.push(`${rel}:${text.slice(0, m.index).split('\n').length}  os${m[1]}(..., ${last})`);
    }
  }
  assert.deepStrictEqual(bad, [], 'these dialogs would draw a literal glyph instead of an icon');
});
