'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPS = fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.js'));

// Timers never touch the DOM, so the capture probe in os/wm.js cannot see
// them. They are the one hole in otherwise-automatic instrumentation, which
// makes "did we remember?" a discipline problem - and this test is what turns
// it back into a structural one.
test('no app schedules an uninstrumented timer', () => {
  const offenders = [];
  APPS.forEach(function (file) {
    const src = fs.readFileSync(path.join(ROOT, 'apps', file), 'utf8');
    src.split('\n').forEach(function (line, i) {
      // procSetTimeout / procSetInterval are the instrumented forms and must
      // not trip the guard that exists to require them.
      const stripped = line.replace(/procSetTimeout|procSetInterval/g, '');
      if (/\bsetTimeout\s*\(/.test(stripped) || /\bsetInterval\s*\(/.test(stripped)) {
        offenders.push(file + ':' + (i + 1) + ' ' + line.trim());
      }
    });
  });
  assert.deepStrictEqual(offenders, [],
    'these timers bypass CPU accounting:\n' + offenders.join('\n'));
});
