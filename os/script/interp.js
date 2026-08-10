// ── Script executor ──────────────────────────────────────────────
const SCRIPT_COLORS = { red:'#ff4444', green:'#44dd44', yellow:'#dddd00', cyan:'#44dddd', blue:'#6699ff', white:'#ffffff' };
const SCRIPT_MAX_STEPS = 10000;
const SCRIPT_MAX_DEPTH = 16;
const SCRIPT_LABEL_RE = /^:([A-Za-z_][\w.-]*)$/;

function makeScriptError(message, lineNo, sourceName) {
  const err = new Error(message);
  err.lineNo = lineNo || 0;
  err.sourceName = sourceName || '';
  return err;
}

function makeAbortError(message) {
  const err = new Error(message || 'Command interrupted.');
  err.name = 'AbortError';
  err.isCommandAbort = true;
  return err;
}

function isAbortError(err) {
  return !!(err && (err.isCommandAbort || err.name === 'AbortError'));
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError();
  }
}

function scriptResolveText(text, vars) {
  return String(text ?? '').replace(/\$(\w+)/g, (_, key) => vars[key] ?? '');
}

function scriptBuildArgFrame(targetName, args) {
  const values = Object.create(null);
  const items = Array.isArray(args) ? args.map(arg => String(arg ?? '')) : [];
  values['0'] = String(targetName || '');
  values.argc = String(items.length);
  items.forEach((value, index) => { values[String(index + 1)] = value; });
  return { targetName: String(targetName || ''), values };
}

function scriptLookupVar(state, key) {
  const name = String(key || '');
  if (name === 'status' || name === 'errorlevel') return String(state.status ?? 0);
  const frame = state.frames?.[state.frames.length - 1];
  if (frame && Object.prototype.hasOwnProperty.call(frame.values, name)) return frame.values[name];
  return state.vars[name] ?? '';
}

function scriptHasVar(state, key) {
  const name = String(key || '');
  if (name === 'status' || name === 'errorlevel') return true;
  const frame = state.frames?.[state.frames.length - 1];
  if (frame && Object.prototype.hasOwnProperty.call(frame.values, name)) return true;
  return Object.prototype.hasOwnProperty.call(state.vars, name);
}

function scriptResolveStateText(text, state) {
  return String(text ?? '').replace(/\$(\w+)/g, (_, key) => scriptLookupVar(state, key));
}

function scriptUnescape(text) {
  return String(text ?? '')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function scriptStripOuterQuotes(text) {
  const trimmed = String(text ?? '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return scriptUnescape(trimmed.slice(1, -1));
  }
  return trimmed;
}

function scriptNormalizeLabel(name) {
  return String(name || '').trim().toLowerCase();
}

function scriptParseNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function scriptParseStatusCode(value, lineNo, fallback) {
  const text = String(value ?? '').trim();
  if (!text) return Math.trunc(scriptParseNumber(fallback ?? 0) ?? 0);
  const num = scriptParseNumber(text);
  if (num === null) throw makeScriptError('Status code must be numeric.', lineNo);
  return Math.trunc(num);
}

function scriptTokenize(text, lineNo) {
  const source = String(text ?? '');
  const tokens = [];
  let token = '';
  let quote = null;
  let started = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      started = true;
      if (ch === '\\' && i + 1 < source.length) {
        token += source[i + 1];
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      token += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) {
        tokens.push(token);
        token = '';
        started = false;
      }
      continue;
    }
    started = true;
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    token += ch;
  }
  if (quote) throw makeScriptError('Unterminated quoted string.', lineNo);
  if (started) tokens.push(token);
  return tokens;
}

function scriptIsReservedVarName(name) {
  return /^(?:status|errorlevel|argc|\d+)$/i.test(String(name || ''));
}

async function scriptPathExists(path, state) {
  const target = String(path || '').trim();
  if (!target) return false;
  if (target === '.' || target === '..' || target === '\\' || /^C:\\sleepOS\\?$/i.test(target)) return true;
  if (await state.fs.isSystemPath(target)) return true;
  if (await state.fs.exists(target, state.dirName)) return true;
  return await state.fs.dirExists(target);
}

async function scriptEvaluateCondition(text, state, lineNo) {
  const tokens = scriptTokenize(text, lineNo);
  let negate = false;
  if (tokens[0] && tokens[0].toLowerCase() === 'not') {
    negate = true;
    tokens.shift();
  }
  if (tokens[0] && tokens[0].toLowerCase() === 'exists') {
    if (tokens.length !== 4 || tokens[2].toLowerCase() !== 'goto') {
      throw makeScriptError('Usage: if [not] exists <path> goto <label>', lineNo);
    }
    const rawPassed = await scriptPathExists(tokens[1], state);
    return { passed: negate ? !rawPassed : rawPassed, label: tokens[3] };
  }
  if (tokens[0] && tokens[0].toLowerCase() === 'defined') {
    if (tokens.length !== 4 || tokens[2].toLowerCase() !== 'goto') {
      throw makeScriptError('Usage: if [not] defined <var> goto <label>', lineNo);
    }
    const rawPassed = scriptHasVar(state, tokens[1]);
    return { passed: negate ? !rawPassed : rawPassed, label: tokens[3] };
  }
  if (tokens.length !== 5 || tokens[3].toLowerCase() !== 'goto') {
    throw makeScriptError('Usage: if <left> <op> <right> goto <label>', lineNo);
  }
  const rawPassed = scriptCompare(tokens[0], tokens[1], tokens[2], lineNo);
  return { passed: negate ? !rawPassed : rawPassed, label: tokens[4] };
}

function scriptMutateNumericVar(vars, key, op, amountRaw, lineNo) {
  const current = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '0';
  const currentNum = scriptParseNumber(current);
  if (currentNum === null) throw makeScriptError('Variable is not numeric: ' + key, lineNo);
  const needsAmount = op === 'mul' || op === 'div' || op === 'mod';
  if (needsAmount && (amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '')) {
    throw makeScriptError('Usage: ' + op + ' <var> <amount>', lineNo);
  }
  const amount = amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '' ? 1 : scriptParseNumber(amountRaw);
  if (amount === null) throw makeScriptError('Arithmetic operand must be numeric.', lineNo);
  if ((op === 'div' || op === 'mod') && amount === 0) throw makeScriptError('Division by zero.', lineNo);
  let nextValue = currentNum;
  if (op === 'inc' || op === 'add') nextValue = currentNum + amount;
  else if (op === 'dec' || op === 'sub') nextValue = currentNum - amount;
  else if (op === 'mul') nextValue = currentNum * amount;
  else if (op === 'div') nextValue = currentNum / amount;
  else if (op === 'mod') nextValue = currentNum % amount;
  else throw makeScriptError('Unsupported arithmetic operation: ' + op, lineNo);
  vars[key] = String(nextValue);
  return vars[key];
}

function scriptEmitError(printFn, sourceName, lineNo, message) {
  const prefix = sourceName ? sourceName + ': ' : 'Script error: ';
  const where = lineNo ? 'line ' + lineNo + ': ' : '';
  printFn(prefix + where + message, '#ff4444');
}

function scriptFail(err, printFn, sourceName, bubbleErrors) {
  const scriptErr = err instanceof Error ? err : makeScriptError(String(err), 0, sourceName);
  if (!scriptErr.sourceName) scriptErr.sourceName = sourceName || '';
  if (bubbleErrors) throw scriptErr;
  scriptEmitError(printFn, scriptErr.sourceName || sourceName, scriptErr.lineNo || 0, scriptErr.message || String(scriptErr));
  return Math.trunc(scriptErr.statusCode ?? 1);
}

function parseScript(source) {
  const instructions = [];
  const labels = Object.create(null);
  String(source ?? '').replace(/\r/g, '').split('\n').forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    if (line.startsWith(':')) {
      const match = line.match(SCRIPT_LABEL_RE);
      if (!match) throw makeScriptError('Invalid label syntax.', lineNo);
      const label = scriptNormalizeLabel(match[1]);
      if (Object.prototype.hasOwnProperty.call(labels, label)) {
        throw makeScriptError('Duplicate label: ' + match[1], lineNo);
      }
      labels[label] = instructions.length;
      return;
    }
    const spaceIdx = line.search(/\s/);
    instructions.push({
      lineNo,
      raw: line,
      cmd: (spaceIdx === -1 ? line : line.slice(0, spaceIdx)).toLowerCase(),
      arg: spaceIdx === -1 ? '' : line.slice(spaceIdx + 1).trim(),
    });
  });
  return { instructions, labels };
}

async function scriptSleep(ms, signal) {
  throwIfAborted(signal);
  await new Promise((resolve, reject) => {
    const tid = setTimeout(done, ms);
    function cleanup() {
      clearTimeout(tid);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    function done() {
      cleanup();
      resolve();
    }
    function onAbort() {
      cleanup();
      reject(signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError());
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function scriptJumpIndex(labels, labelName, lineNo) {
  const key = scriptNormalizeLabel(labelName);
  if (!Object.prototype.hasOwnProperty.call(labels, key)) {
    throw makeScriptError('Unknown label: ' + labelName, lineNo);
  }
  return labels[key];
}

function scriptCompare(left, op, right, lineNo) {
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;
  const leftNum = scriptParseNumber(left);
  const rightNum = scriptParseNumber(right);
  if (leftNum === null || rightNum === null) {
    throw makeScriptError('Numeric comparison requires numeric operands.', lineNo);
  }
  if (op === '>') return leftNum > rightNum;
  if (op === '>=') return leftNum >= rightNum;
  if (op === '<') return leftNum < rightNum;
  if (op === '<=') return leftNum <= rightNum;
  throw makeScriptError('Unsupported comparison operator: ' + op, lineNo);
}

async function execScriptInstruction(inst, labels, state) {
  throwIfAborted(state.signal);
  const resolvedArg = scriptResolveStateText(inst.arg, state).trim();
  switch (inst.cmd) {
    case 'print':
    case 'echo': {
      const colorMatch = resolvedArg.match(/^\[(\w+)\]\s*/);
      if (colorMatch && SCRIPT_COLORS[colorMatch[1]]) {
        state.printFn(resolvedArg.slice(colorMatch[0].length), SCRIPT_COLORS[colorMatch[1]]);
      } else {
        state.printFn(resolvedArg);
      }
      state.status = 0;
      return null;
    }
    case 'set': {
      const match = resolvedArg.match(/^(\w+)(?:\s+(.*))?$/);
      if (!match) throw makeScriptError('Usage: set <var> <value>', inst.lineNo);
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      state.vars[match[1]] = match[2] ?? '';
      state.status = 0;
      return null;
    }
    case 'inc':
    case 'dec':
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod': {
      const match = resolvedArg.match(/^(\w+)(?:\s+(.+))?$/);
      if (!match) {
        const usage = inst.cmd === 'mul' || inst.cmd === 'div' || inst.cmd === 'mod'
          ? 'Usage: ' + inst.cmd + ' <var> <amount>'
          : 'Usage: ' + inst.cmd + ' <var> [amount]';
        throw makeScriptError(usage, inst.lineNo);
      }
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      scriptMutateNumericVar(state.vars, match[1], inst.cmd, match[2], inst.lineNo);
      state.status = 0;
      return null;
    }
    case 'wait': {
      const ms = scriptParseNumber(resolvedArg);
      if (ms === null) throw makeScriptError('Usage: wait <ms>', inst.lineNo);
      await scriptSleep(Math.min(Math.max(Math.floor(ms), 0), 30000), state.signal);
      state.status = 0;
      return null;
    }
    case 'input': {
      throwIfAborted(state.signal);
      if (!state.readLine) throw makeScriptError('INPUT requires an interactive terminal.', inst.lineNo);
      const match = resolvedArg.match(/^(\w+)(?:\s+(.+))?$/);
      if (!match) throw makeScriptError('Usage: input <var> [prompt]', inst.lineNo);
      if (scriptIsReservedVarName(match[1])) throw makeScriptError('Cannot assign reserved variable: ' + match[1], inst.lineNo);
      const key = match[1];
      const prompt = match[2] ? scriptStripOuterQuotes(match[2]) : key + ':';
      state.vars[key] = await state.readLine(prompt);
      state.status = 0;
      return null;
    }
    case 'goto':
      if (!resolvedArg) throw makeScriptError('Usage: goto <label>', inst.lineNo);
      state.status = 0;
      return { type: 'jump', pc: scriptJumpIndex(labels, resolvedArg, inst.lineNo) };
    case 'call': {
      const tokens = scriptTokenize(resolvedArg, inst.lineNo);
      if (!tokens.length) throw makeScriptError('Usage: call <label> [args...]', inst.lineNo);
      state.status = 0;
      return {
        type: 'call',
        pc: scriptJumpIndex(labels, tokens[0], inst.lineNo),
        frame: scriptBuildArgFrame(tokens[0], tokens.slice(1)),
      };
    }
    case 'return':
      return { type: 'return', code: scriptParseStatusCode(resolvedArg, inst.lineNo, state.status) };
    case 'exit':
      return { type: 'exit', code: scriptParseStatusCode(resolvedArg, inst.lineNo, state.status) };
    case 'if': {
      const result = await scriptEvaluateCondition(resolvedArg, state, inst.lineNo);
      state.status = result.passed ? 0 : 1;
      if (result.passed) return { type: 'jump', pc: scriptJumpIndex(labels, result.label, inst.lineNo) };
      return null;
    }
    case 'clear':
      (state.clearFn || (() => state.fs.clearScreen()))();
      state.status = 0;
      return null;
    case 'touch': {
      if (!resolvedArg) throw makeScriptError('Usage: touch <file>', inst.lineNo);
      // DELIBERATE BEHAVIOR CHANGE. fsGetEntry returned null for directories,
      // so `touch DOCS` used to write an empty file that permanently shadowed
      // the directory. vfsStatSync reports the directory, so touch now no-ops
      // on it, which is what touch is supposed to do.
      const existing = await state.fs.stat(resolvedArg, state.dirName);
      if (!existing) {
        // The legacy accessors returned falsy on failure and the interpreter
        // used that to attach the script line number. The VFS throws instead,
        // so every converted site re-wraps or the error reaches the user with
        // no line number and no source name.
        try {
          await state.fs.writeFile(resolvedArg, '', state.dirName);
        } catch (err) {
          throw makeScriptError('Cannot create file: ' + resolvedArg + ' (' + err.message + ')', inst.lineNo);
        }
        await state.fs.notifyChanged();
      }
      state.status = 0;
      return null;
    }
    case 'mkdir': {
      if (!resolvedArg) throw makeScriptError('Usage: mkdir <dir>', inst.lineNo);
      let created;
      try {
        created = await state.fs.mkdir(resolvedArg, state.dirName);
      } catch (err) {
        throw makeScriptError('Cannot create directory: ' + resolvedArg + ' (' + err.message + ')', inst.lineNo);
      }
      if (created.created) {
        await state.fs.notifyChanged();
      }
      state.status = 0;
      return null;
    }
    case 'del':
    case 'rm': {
      if (!resolvedArg) throw makeScriptError('Usage: del <file>', inst.lineNo);
      const deletion = await state.fs.unlink(resolvedArg, state.dirName);
      if (!deletion.ok) throw makeScriptError(deletion.message || ('Cannot delete: ' + resolvedArg), inst.lineNo);
      state.status = 0;
      return null;
    }
    case 'open': {
      if (!resolvedArg) throw makeScriptError('Usage: open <file>', inst.lineNo);
      if (await state.fs.isSystemPath(resolvedArg)) {
        if (!await state.fs.openSystem(fsSplitPath(resolvedArg, state.dirName).fileName, state.dirName)) {
          throw makeScriptError('File not found: ' + resolvedArg, inst.lineNo);
        }
        state.status = 0;
        return null;
      }
      // `!st || st.type === 'dir'` reproduces fsGetEntry's null-for-directories
      // exactly. Without the second half `open DOCS` would fall through to the
      // else branch and load a directory into Notepad.
      const st = await state.fs.stat(resolvedArg, state.dirName);
      if (!st || st.type === 'dir') throw makeScriptError('File not found: ' + resolvedArg, inst.lineNo);
      await state.fs.openUi(st.name, st.dirName);
      state.status = 0;
      return null;
    }
    case 'notepad':
      await state.fs.openSystem('notepad', state.dirName, resolvedArg);
      state.status = 0;
      return null;
    case 'start': {
      const key = resolvedArg.toLowerCase();
      if (!await state.fs.openSystem(key, state.dirName)) {
        throw makeScriptError('Program not found: ' + resolvedArg, inst.lineNo);
      }
      state.status = 0;
      return null;
    }
    case 'run': {
      const tokens = scriptTokenize(resolvedArg, inst.lineNo);
      if (!tokens.length) throw makeScriptError('Usage: run <script> [args...]', inst.lineNo);
      const st = await state.fs.stat(tokens[0], state.dirName);
      if (!st || st.kind !== 'text') throw makeScriptError('Script not found: ' + tokens[0], inst.lineNo);
      // Content is async now; the stat above carries no `value`.
      const source = await state.fs.readFile(st.name, st.dirName);
      if (source === null) throw makeScriptError('Script not found: ' + tokens[0], inst.lineNo);
      state.status = await execScript(source, state.printFn, {
        fs: state.fs,
        vars: state.vars,
        depth: state.depth + 1,
        dirName: st.dirName,
        sourceName: st.name,
        clearFn: state.clearFn,
        readLine: state.readLine,
        signal: state.signal,
        args: tokens.slice(1),
      });
      return null;
    }
    case 'grep': {
      const match = resolvedArg.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)\s+(.+)$/);
      if (!match) throw makeScriptError('Usage: grep <pattern> <file>', inst.lineNo);
      const patternToken = match[1];
      const pattern = scriptUnescape(patternToken.replace(/^['"]|['"]$/g, ''));
      const fileName = match[2].replace(/^['"]|['"]$/g, '');
      const st = await state.fs.stat(fileName, state.dirName);
      if (!st || st.kind !== 'text') throw makeScriptError('File not found: ' + fileName, inst.lineNo);
      let re;
      try { re = new RegExp(pattern, 'i'); }
      catch (e) { throw makeScriptError('Invalid regex: ' + pattern, inst.lineNo); }
      const contents = await state.fs.readFile(st.name, st.dirName);
      if (contents === null) throw makeScriptError('File not found: ' + fileName, inst.lineNo);
      const lines = contents.split('\n');
      let matches = 0;
      lines.forEach((line, index) => {
        if (re.test(line)) {
          state.printFn((index + 1) + ':' + line);
          matches++;
        }
      });
      if (matches === 0) state.printFn('(no matches)');
      else state.printFn(matches + ' match' + (matches === 1 ? '' : 'es') + ' found');
      state.status = matches === 0 ? 1 : 0;
      return null;
    }
    default:
      throw makeScriptError('Unknown command: ' + inst.cmd, inst.lineNo);
  }
}

async function execScript(source, printFn, options) {
  options = options || {};
  const sourceName = options.sourceName || 'script';
  const depth = options.depth || 0;
  if (depth >= SCRIPT_MAX_DEPTH) {
    return scriptFail(makeScriptError('Maximum script recursion depth exceeded.', 0, sourceName), printFn, sourceName, options.bubbleErrors);
  }
  let parsed;
  try {
    parsed = parseScript(source);
  } catch (err) {
    return scriptFail(err, printFn, sourceName, options.bubbleErrors);
  }
  const state = {
    fs: options.fs,
    vars: options.vars || Object.create(null),
    depth,
    dirName: fsNormalizeDir(options.dirName),
    printFn,
    clearFn: options.clearFn || null,
    readLine: options.readLine || null,
    signal: options.signal || null,
    status: Math.trunc(options.initialStatus ?? 0),
    frames: [scriptBuildArgFrame(options.targetName || sourceName, options.args || [])],
    callStack: [],
  };
  let pc = 0;
  let steps = 0;
  while (pc < parsed.instructions.length) {
    const inst = parsed.instructions[pc];
    steps++;
    try {
      throwIfAborted(state.signal);
    } catch (err) {
      if (isAbortError(err)) throw err;
      return scriptFail(err, printFn, sourceName, options.bubbleErrors);
    }
    if (steps > SCRIPT_MAX_STEPS) {
      return scriptFail(makeScriptError('Instruction limit exceeded (possible infinite loop).', inst.lineNo, sourceName), printFn, sourceName, options.bubbleErrors);
    }
    try {
      const action = await execScriptInstruction(inst, parsed.labels, state);
      if (action && action.type === 'jump') {
        pc = action.pc;
        continue;
      }
      if (action && action.type === 'call') {
        state.callStack.push({ returnPc: pc + 1 });
        state.frames.push(action.frame);
        pc = action.pc;
        continue;
      }
      if (action && action.type === 'return') {
        if (!state.callStack.length || state.frames.length <= 1) {
          throw makeScriptError('RETURN without CALL.', inst.lineNo);
        }
        const frame = state.callStack.pop();
        state.frames.pop();
        state.status = action.code;
        pc = frame.returnPc;
        continue;
      }
      if (action && action.type === 'exit') {
        state.status = action.code;
        return state.status;
      }
      if (typeof action === 'number') {
        pc = action;
        continue;
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      return scriptFail(err, printFn, sourceName, options.bubbleErrors);
    }
    pc++;
  }
  return Math.trunc(state.status ?? 0);
}

// Shared by makeVfsScriptFs's `openUi` and the kernel's `ui.open` syscall
// handler (os/kernel.js's _kernelUiOpen). Both callers run on the main
// thread - a worker only ever reaches this indirectly, through the ui.open
// syscall the kernel answers here - so referencing openMediaFile/openNotepad
// directly is safe. Matches the shape the main-thread adapter always
// returned (undefined), so the kernel and the terminal do not diverge.
async function scriptOpenUiTarget(path, cwd) {
  const st = vfsStatSync(path, cwd);
  if (!st) return;
  if (st.kind === 'blob') openMediaFile(st.name, st.dirName);
  else openNotepad(st.name, st.dirName);
}

// Shared by makeVfsScriptFs's `openSystem` and the kernel's `ui.openSystem`
// syscall handler (os/kernel.js's _kernelUiOpenSystem) - one map, one seam,
// so a spawned script's `START` reaches the same 19 programs the terminal
// does. Absorbs the `start` command's program map and the `notepad`
// command's blank-document case. Those map entries used to be bare
// identifier references (`sysmon: openSysmon`), evaluated the moment the
// object literal was built - in a Worker, just reaching the `start` case
// threw a ReferenceError before any lookup happened, regardless of which
// program was requested. Living here means the map is only ever built on
// the main thread, where the globals it references are legitimately in
// scope (a worker reaches it only via the ui.openSystem syscall, answered
// here). `openSystemFile` stays as the fallback for names the map does not
// recognize (WELCOME.README, void.tmp, daemon.core, etc.).
async function scriptOpenSystemProgram(name, cwd, arg) {
  const lower = String(name || '').toLowerCase();
  const map = {
    notepad: () => openNotepad(arg || undefined, cwd),
    'notepad.exe': () => openNotepad(arg || undefined, cwd),
    terminal: () => openTerminal(cwd),
    'terminal.exe': () => openTerminal(cwd),
    sysmon: openSysmon,
    'sysmon.exe': openSysmon,
    browser: openBrowser,
    'browser.exe': openBrowser,
    defrag: openDefrag,
    'defrag.exe': openDefrag,
    explorer: openExplorer,
    'explorer.exe': openExplorer,
    welcome: openWelcome,
    'welcome.readme': openWelcome,
    files: openFiles,
    calc: openCalculator,
    'calc.exe': openCalculator,
    regedit: openRegedit,
    'regedit.exe': openRegedit,
  };
  if (map[lower]) { map[lower](); return true; }
  return !!openSystemFile(name);
}

// The main thread's adapter. The worker builds its own in os/worker/syscalls.js
// against the same shape, so the interpreter cannot tell them apart.
function makeVfsScriptFs() {
  return {
    async stat(path, cwd) { return vfsStatSync(path, cwd); },
    async exists(path, cwd) { return vfsExistsSync(path, cwd); },
    async dirExists(path) { return vfsDirExistsSync(path); },
    async list(path) { return vfsListSync(path); },
    async readFile(path, cwd) { return await vfsReadFile(path, cwd); },
    async writeFile(path, text, cwd) { return await vfsWriteFile(path, text, cwd); },
    async mkdir(path, cwd) { return await vfsMkdir(path, cwd); },
    // deleteVirtualPath, not vfsUnlink: it enforces the Recycle Bin and the
    // story's undeletable files. Deleting straight from the VFS would bypass both.
    async unlink(path, cwd) { return await deleteVirtualPath(path, cwd); },
    async openUi(path, cwd) { return scriptOpenUiTarget(path, cwd); },
    async openSystem(name, cwd, arg) { return scriptOpenSystemProgram(name, cwd, arg); },
    async isSystemPath(path) { return isVisibleSystemPath(path, { includeExplorer: true }); },
    async notifyChanged() { document.dispatchEvent(new CustomEvent('fs-changed')); },
    async clearScreen() { const out = document.getElementById('to'); if (out) out.innerHTML = ''; },
  };
}

