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
// appears in another entry's command column. That second condition is not a
// fixed list - it is a property of the current prose, and it moves every
// time either document is edited. Do not extend the list below by
// inspection; re-derive it: delete a command's canonical row from a copy of
// its block, re-run commandColumns/documents against what is left, and see
// whether it still reports as documented. A claim that a list like this is
// exhaustive is exactly the kind of stale certainty that let SPAWN and KILL
// go undocumented in the first place - a method survives edits; a list does
// not.
//
// Leaks found this way as of this writing (not a guarantee it is complete
// going forward):
//   - `print` in SCRIPTING.txt, via the COLORS section's own usage rows
//     ("print [red]    error text" and neighbours) and the VARIABLES
//     section's "print Arg 1: $1  / argc=$argc".
//   - `goto` in SCRIPTING.txt, via the CONTROL FLOW section's
//     "if a == b goto x   branch on a comparison" line.
//   - `run` in SCRIPTING.txt, via the intro sentence
//     "Run one with:    RUN myscript.script".
//   - `echo` in COMMANDS.txt, via the SCRIPTING section's
//     "ECHO text > file     write text to file" and "ECHO text >> file"
//     redirect-syntax rows.
//   - `ls` in COMMANDS.txt, via the SEARCH & PIPES section's
//     "LS *.ext               wildcard glob listing" row, distinct from its
//     canonical "DIR, LS              list current directory" entry.
// `call`, `exit`, `start` were checked the same way and are NOT leaks -
// deleting their canonical row does fail the test.
//
// Inert today, worth knowing about: `GREP <pattern> <file>` also appears in
// COMMANDS.txt only via "CAT f | GREP pattern   pipe output to command", the
// same shape of leak - but `grep` is not a `CMDS.` handler, so the terminal
// test never asks about it. If `CMDS.grep` is ever added, that pipe-example
// row would silently certify it exactly like the leaks above.
//
// All of the above are accepted as-is: each source line is a genuine
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

// CMDS is declared as `const CMDS = { type: ..., cd: ..., ... }` - an object
// literal - and then extended with `CMDS.help = ...`, `CMDS.dir = ...` etc.
// A regex over `CMDS\.x =` alone only sees the second half: it found 30
// commands and missed the 16 declared as literal keys (type, cd, mkdir,
// touch, del, rm, copy, move, mv, taskkill, cat, open, notepad, grep, wc,
// exit), two of which - move and mv - were genuinely undocumented and the
// guard still passed. That is the enumerator lying about coverage, which is
// worse than the matcher being wrong: a wrong matcher fails loudly on a
// known command, a blind enumerator never asks about the command at all.
//
// The fix ought to be reading Object.keys(CMDS) out of a live terminal
// instance - enumeration by execution cannot drift with declaration style.
// CMDS lives inside openTerminal()'s closure, though, and openTerminal()
// builds a real DOM subtree (mkWin, document.createElement panels with
// style/appendChild/scrollTop, a contextmenu listener that calls
// window.getSelection() and navigator.clipboard) before CMDS is even
// assigned. No test in this suite stands up that much of a DOM double, and
// building one solely so this guard can read a property list is a large,
// fragile surface for a test whose only job is enumeration - any future
// unrelated addition to openTerminal's DOM setup would need to be mocked
// here too, or the guard breaks for reasons that have nothing to do with
// documentation. So this takes the reviewer's named fallback instead: union
// the `CMDS.x =` assignments with the literal's own keys, read directly out
// of the `const CMDS = {` block by indentation (its keys are 4-space
// indented; nothing else at that exact indentation inside the block matches
// `identifier:`, verified by running this against the current file and
// checking the result equals openTerminal's real dispatch table by hand).
function terminalCommands() {
  const blockStart = terminalSrc.indexOf('const CMDS = {');
  assert.notStrictEqual(blockStart, -1, 'const CMDS = { not found in apps/terminal.js');
  const blockEnd = terminalSrc.indexOf('\n  };', blockStart);
  assert.notStrictEqual(blockEnd, -1, 'CMDS object literal is not terminated');
  const cmdsBlock = terminalSrc.slice(blockStart, blockEnd);
  const literalKeys = [...cmdsBlock.matchAll(/^\s{4}([a-z][a-z0-9_]*)\s*:/gm)].map(m => m[1]);
  const assignedKeys = [...terminalSrc.matchAll(/CMDS\.([a-z][a-z0-9_]*)\s*=/g)].map(m => m[1]);
  return [...new Set([...literalKeys, ...assignedKeys])];
}

test('every terminal command appears in COMMANDS.txt', () => {
  const columns = commandColumns(docBlock('COMMANDS.txt'));
  const commands = terminalCommands();
  // 46 as of this writing (16 literal keys + 30 CMDS.x = assignments). Set at
  // 45 rather than the exact count so one legitimate removal does not fail
  // this line - the point is to catch the enumerator silently losing an
  // entire declaration style again (that regression drops the count to 30),
  // not to pin the roster.
  assert.ok(commands.length >= 45, `expected to find CMDS commands (literal keys + assignments), found ${commands.length}`);
  const missing = commands
    .filter(c => !UNDOCUMENTED_TERMINAL_COMMANDS.has(c))
    .filter(c => !documents(columns, c));
  assert.deepStrictEqual(missing, [], 'undocumented terminal commands: ' + missing.join(', '));
});
