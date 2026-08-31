'use strict';
// os/programs.js's PROGRAM_LAUNCHERS is meant to be the one registry of what a
// launchable program is and what launching it does. It is not the only table
// that names programs, though, and os/programs.js says so itself: the Run...
// dialog has its own RUN_MAP, and a .script file's START/OPEN (plus a spawned
// worker's ui.openSystem syscall) goes through scriptOpenSystemProgram's map.
// "Folding those two in is known follow-up work, not done here."
//
// Until that folding happens, the registry can grow an entry the other two do
// not have. That already happened: FILES is in the registry and in the script
// map, and was missing from RUN_MAP, so the desktop and a script could launch
// it while Run... answered "Cannot find program".
//
// The two surfaces are NOT symmetric, and the tests below encode the
// difference rather than pretending they are:
//
//   - scriptOpenSystemProgram ends in `return !!openSystemFile(name)`, and
//     openSystemFile (os/desktop-model.js:326) resolves through
//     programsInDir(''), which reads the registry. So a name missing from the
//     script map still launches. That fallback is the safety net, and the
//     second test guards the net itself rather than the map - a map-vs-registry
//     comparison there would fail on daemon.core/void.tmp/?????.exe, which
//     work fine, and would be a false alarm.
//
//   - RUN_MAP has no such net. Its only fallback is a PROJECTS lookup, which
//     matches project pages, not programs. A registry entry missing from
//     RUN_MAP is simply unreachable from Run..., so the first test is a hard
//     subset requirement.
//
// Static regex over source text, for the same reason
// test/worker-syscall-coverage.test.cjs uses one: the things that must agree
// are object keys in three different files, two of them declared inside
// function bodies where no amount of loading the module would expose them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Slice an object literal's body by walking braces from the first `{` after a
// marker, so a nested `{}` in a value cannot end the slice early.
function objectBodyAfter(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return '';
  const open = src.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return '';
}

// The two literals need different extractors, because they are shaped
// differently and a single regex silently under-reads one of them.
//
// PROGRAM_LAUNCHERS maps each name to a nested object ({ lines, open, ... }),
// so its keys must be anchored to the outer literal's two-space indent -
// otherwise `lines:` and `open:` are picked up as program names.
function registryPrograms() {
  const body = objectBodyAfter(read('os/programs.js'), 'const PROGRAM_LAUNCHERS');
  const out = new Set();
  for (const m of body.matchAll(/^ {2}'?([A-Za-z0-9_.?-]+)'?\s*:/gm)) out.add(m[1].toLowerCase());
  return out;
}

// RUN_MAP maps each name straight to a function reference and packs several
// pairs onto one line ("'notepad': openNotepad, 'notepad.exe': openNotepad,"),
// so anchoring to the line start would find only the first key on each line.
// Every key is quoted and no value is an object, so matching quoted keys
// anywhere in the body is both complete and safe here.
function runDialogNames() {
  const body = objectBodyAfter(read('os/run-dialog.js'), 'const RUN_MAP');
  const out = new Set();
  for (const m of body.matchAll(/'([^']+)'\s*:/g)) out.add(m[1].toLowerCase());
  return out;
}

test('every program in the registry can be launched from the Run... dialog', () => {
  const registry = registryPrograms();
  const runMap = runDialogNames();
  // Guards the guard: if either regex stops matching, fail loudly here rather
  // than letting the subset check below pass on two empty sets.
  assert.ok(registry.size >= 10,
    'expected to find PROGRAM_LAUNCHERS entries - extraction may be broken (found ' + registry.size + ')');
  assert.ok(runMap.size >= 10,
    'expected to find RUN_MAP entries - extraction may be broken (found ' + runMap.size + ')');

  const missing = [...registry].filter(name => !runMap.has(name)).sort();
  assert.deepStrictEqual(missing, [],
    'these programs are in os/programs.js PROGRAM_LAUNCHERS but have no os/run-dialog.js RUN_MAP entry, '
    + 'so Run... answers "Cannot find program" for them while the desktop and terminal launch them fine: '
    + missing.join(', '));
});

test('scriptOpenSystemProgram still falls back to openSystemFile, which is what covers its gaps', () => {
  const src = read('os/script/interp.js');
  const fn = src.slice(src.indexOf('async function scriptOpenSystemProgram'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1);
  assert.ok(body.length > 0, 'could not slice scriptOpenSystemProgram - extraction may be broken');
  // Without this line, every registry program the map does not name (today
  // daemon.core, void.tmp and ?????.exe) stops launching from a script's
  // START/OPEN and from a worker's ui.openSystem, silently.
  assert.match(body, /return\s+!!openSystemFile\(\s*name\s*\)/,
    'scriptOpenSystemProgram no longer falls back to openSystemFile - the names its own map omits are '
    + 'now unreachable from a script. Either restore the fallback or add every registry program to the map.');
});
