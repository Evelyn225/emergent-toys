'use strict';
// The same failure is one commit away every time a command is added: phase 3
// shipped SPAWN and KILL in the live HELP output and never updated
// COMMANDS.txt or SCRIPTING.txt. This makes that a build failure, not a bug
// report from a confused player.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const interpSrc = fs.readFileSync(path.join(ROOT, 'os/script/interp.js'), 'utf8');
const fsCoreSrc = fs.readFileSync(path.join(ROOT, 'os/fs-core.js'), 'utf8');
const terminalSrc = fs.readFileSync(path.join(ROOT, 'apps/terminal.js'), 'utf8');

// Both sets are empty on purpose, and that was verified rather than assumed:
// the only gaps at the time of writing were SPAWN, KILL, DIR and RM, all
// genuine omissions rather than secrets. The guard inspects `CMDS.<name>`
// assignments, and sleepOS's hidden story commands are not dispatched that
// way, so it cannot demand that a story beat be spoiled. A future hidden
// command added AS a CMDS entry would need an entry here, with a one-line
// reason.
const UNDOCUMENTED_SCRIPT_COMMANDS = new Set([]);
const UNDOCUMENTED_TERMINAL_COMMANDS = new Set([]);

function docBlock(name) {
  const start = fsCoreSrc.indexOf(`['${name}', [`);
  assert.notStrictEqual(start, -1, `${name} not found in os/fs-core.js`);
  const end = fsCoreSrc.indexOf('].join(', start);
  assert.notStrictEqual(end, -1, `${name} block is not terminated`);
  return fsCoreSrc.slice(start, end);
}

// Match only the command column - the text before the first run of two or
// more spaces - with <placeholder> and [optional] removed. Two reasons:
// `mkdir <dir>` must not certify `dir` (the whole-block search that a naive
// version of this guard would use matches `dir` inside the `<dir>`
// placeholder on the mkdir line, since `<` and `>` are non-word characters),
// and grouped alias lines like "ADD, SUB, MUL, DIV, MOD" and "WHO, WHOAMI"
// must still certify each name they list, which a line-anchored pattern
// would miss.
//
// A line with no 2+ space run at all (prose, section headers, narrative
// sentences) is excluded rather than falling through as a whole-line
// "column". Without this, a line like the old
// `grep <pattern> <file> print matching lines` - one space, not two, before
// its description - would survive intact as its own column, and the word
// `print` inside it would falsely certify the `print` command even if its
// real entry were deleted.
//
// Honest bound on what this still does NOT catch: a command is missed by
// this guard only if it has no tabular entry of its own AND its name never
// appears in another entry's command column. This was verified, not assumed,
// by mechanically deleting each real command row from a copy of each block
// and re-running commandColumns/documents against the rest - the residual
// leaks found this way, and the ONLY ones, are:
//   - `print` in SCRIPTING.txt, via the COLORS section's own usage rows
//     ("print [red]    error text" and neighbours) and the VARIABLES
//     section's "print Arg 1: $1  / argc=$argc" - both legitimately show
//     PRINT in use with a 2+ space gap before their own description.
//   - `goto` in SCRIPTING.txt, via the CONTROL FLOW section's
//     "if a == b goto x   branch on a comparison" line, which documents the
//     `if ... goto` branch syntax and genuinely contains the word.
//   - `run` in SCRIPTING.txt, via the intro sentence
//     "Run one with:    RUN myscript.script".
//   - `echo` in COMMANDS.txt, via the SCRIPTING section's
//     "ECHO text > file     write text to file" and "ECHO text >> file"
//     redirect-syntax rows.
// `call`, `exit`, `start` and every other command were checked the same way
// and are NOT residual leaks - deleting their real row does make the guard
// fail, because nothing else in either block mentions them with a 2+ space
// gap. These four leaks are accepted as-is: each source line is a genuine
// sentence a player actually reads, not noise, and reshaping player-facing
// prose just to starve a text-matching test would be the tail wagging the
// dog. A command with no table row and no mention anywhere in its block is
// exactly the failure this guard exists to catch, and does catch - that is
// what commands()/documents() are exercised against in this file's own
// regression: SCRIPTING.txt's `dir` entry, deleted and restored by hand
// while developing this guard, which the guard correctly failed on.
function commandColumns(block) {
  return block.split('\n').map(line => {
    const stripped = line.replace(/^\s*'?\s*/, '');
    if (!/\s{2,}/.test(stripped)) return '';
    const col = stripped.split(/\s{2,}/)[0] || '';
    return col.replace(/<[^>]*>/g, '').replace(/\[[^\]]*\]/g, '');
  }).join('\n').toLowerCase();
}

function documents(columns, command) {
  return new RegExp('\\b' + command.replace(/\./g, '\\.') + '\\b').test(columns);
}

test('every script command appears in SCRIPTING.txt', () => {
  const columns = commandColumns(docBlock('SCRIPTING.txt'));
  const commands = [...new Set([...interpSrc.matchAll(/case '([a-z][a-z0-9_.]*)':/g)].map(m => m[1]))];
  assert.ok(commands.length >= 20, `expected to find the command switch, found ${commands.length}`);
  const missing = commands
    .filter(c => !UNDOCUMENTED_SCRIPT_COMMANDS.has(c))
    .filter(c => !documents(columns, c));
  assert.deepStrictEqual(missing, [], 'undocumented script commands: ' + missing.join(', '));
});

test('every terminal command appears in COMMANDS.txt', () => {
  const columns = commandColumns(docBlock('COMMANDS.txt'));
  const commands = [...new Set([...terminalSrc.matchAll(/CMDS\.([a-z][a-z0-9_]*)\s*=/g)].map(m => m[1]))];
  assert.ok(commands.length >= 25, `expected to find CMDS assignments, found ${commands.length}`);
  const missing = commands
    .filter(c => !UNDOCUMENTED_TERMINAL_COMMANDS.has(c))
    .filter(c => !documents(columns, c));
  assert.deepStrictEqual(missing, [], 'undocumented terminal commands: ' + missing.join(', '));
});
