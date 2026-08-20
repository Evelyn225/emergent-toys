'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { extractFunctionSource } = require('./helpers/load-os.cjs');

const ROOT = path.join(__dirname, '..');
const daemonSrc = fs.readFileSync(path.join(ROOT, 'os/daemon.js'), 'utf8');

// os/daemon.js cannot be loaded in the harness without dragging in the whole
// story and the DOM it renders into, so this is a source-level guard. It is
// narrow on purpose: it checks the one thing that would otherwise regress
// silently, which is the daemon reading the disk's number instead of its own.
test('the daemon reads its own corruption value, not disk fragmentation', () => {
  const offenders = [];
  daemonSrc.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/getDriveFragmentationLevel\s*\(/.test(line)) offenders.push((i + 1) + ': ' + line.trim());
  });
  assert.deepStrictEqual(offenders, [],
    'the daemon must not read disk fragmentation - a real filesystem scores near 0 on a fresh\n' +
    'install, which would drive getDriveFragmentationVisualLevel to 0 and stop the glitch\n' +
    'visuals appearing at all. Use getDaemonCorruption() instead.');
});

// The plan specified BOTH a `corruption: 0` field on daemonStory and a
// getDaemonCorruption() derived entirely from getDaemonVisualStage(). Those
// two are not compatible, and the implementation - correctly - built the
// derived one, leaving the field written into every player's saved story and
// read by nothing. The original version of this test asserted the field
// existed "so the value is saved and restored with the story", which the code
// it was passing against did not do. It was certifying an intent, not a
// mechanism.
//
// So the assertion is inverted: corruption must NOT be persisted. Everything
// it depends on is already in `stage`, and a stored copy is a second source of
// truth that a stage change can silently contradict.
test('corruption is derived from the story, not persisted alongside it', () => {
  assert.ok(/function getDaemonCorruption\s*\(/.test(daemonSrc),
    'getDaemonCorruption is the accessor the two visual consumers read');
  const offenders = [];
  daemonSrc.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    // A story field, or an assignment to one. The accessor's own name and its
    // local variables are not matched: this is specifically `corruption:` as
    // an object key and `.corruption =` as a write.
    if (/(^|[^A-Za-z0-9_])corruption\s*:/.test(line) || /\.corruption\s*=/.test(line)) {
      offenders.push((i + 1) + ': ' + line.trim());
    }
  });
  assert.deepStrictEqual(offenders, [],
    'corruption must stay derived from getDaemonVisualStage(). A persisted field is a second\n' +
    'source of truth for something `stage` already determines, and nothing reads it - it was\n' +
    'saved into every story and never consulted.');
});

test('corruption rises with daemon stage so the visuals still escalate', () => {
  const body = extractFunctionSource(daemonSrc, 'getDaemonCorruption');
  // The old thresholds were 0.22 / 0.42 / 0.62 against a value idling near
  // 0.68. Whatever the new mapping is, it has to be driven by the story's
  // stage rather than by anything on disk. Pinned to the actual accessor
  // (getDaemonVisualStage) rather than a loose /stage/i text match: a bare
  // word match would pass on a comment that merely mentions "stage" without
  // the function ever reading it, which is exactly the kind of guard that
  // looks green while checking nothing.
  assert.ok(/getDaemonVisualStage\s*\(\s*\)/.test(body),
    'corruption must be derived from getDaemonVisualStage(), not just mention the word "stage"');
});

test('corruption actually escalates across the stages that used to cross the old thresholds', () => {
  // The shape check above confirms the function READS the stage. This checks
  // it produces a value with the right shape once it does: monotonically
  // non-decreasing as the story advances, and landing on the same side of the
  // old 0.22 / 0.42 / 0.62 thresholds the fake fragmentation number did at
  // each stage - which is the actual behavior the visuals depend on, not just
  // "some number derived from stage". Evaluated directly rather than assumed
  // from reading the source, since a source-level check can't know the
  // arithmetic is right.
  const start = daemonSrc.indexOf('function getDaemonVisualStage');
  assert.notStrictEqual(start, -1, 'getDaemonVisualStage not found');
  const stageFn = extractFunctionSource(daemonSrc, 'getDaemonVisualStage');
  const corruptionFn = extractFunctionSource(daemonSrc, 'getDaemonCorruption');
  const vm = require('vm');
  const ctx = { daemonStory: null };
  vm.createContext(ctx);
  new vm.Script(stageFn + '\n' + corruptionFn, { filename: 'daemon-corruption-slice' }).runInContext(ctx);

  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(stage => {
    ctx.daemonStory = { endingReached: false, stage };
    return ctx.getDaemonCorruption();
  });
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] >= levels[i - 1], 'corruption must not drop as the story advances: ' + JSON.stringify(levels));
  }
  // Stage 4 is where the visuals first turn on (old threshold 0.22); stage 5
  // crosses 0.42; stage 7 crosses 0.62. Below stage 4 corruption must stay
  // under the first threshold or the glitches would start too early.
  assert.ok(levels[3] < 0.22, 'stage 3 must stay below the first visual threshold, got ' + levels[3]);
  assert.ok(levels[4] >= 0.22, 'stage 4 must cross the first visual threshold, got ' + levels[4]);
  assert.ok(levels[5] >= 0.42, 'stage 5 must cross the second visual threshold, got ' + levels[5]);
  assert.ok(levels[7] >= 0.62, 'stage 7 must cross the third visual threshold, got ' + levels[7]);

  ctx.daemonStory = { endingReached: true, stage: 8 };
  assert.strictEqual(ctx.getDaemonCorruption(), 0, 'the ending resolves the story, so the glitches must stop');
});
