'use strict';
// sleepOS sources are classic scripts that declare globals. Loading one into
// a vm context makes its `function` declarations context properties, which is
// how the tests reach them. `const` and `let` do NOT become properties, so
// anything a test needs must be declared with `function`.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function makeLocalStorageStub(quotaBytes) {
  const map = new Map();
  const limit = Number.isFinite(quotaBytes) ? quotaBytes : Infinity;
  function used() {
    let n = 0;
    map.forEach((v, k) => { n += k.length + v.length; });
    return n;
  }
  const base = {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) {
      k = String(k); v = String(v);
      const projected = used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + v.length;
      if (projected > limit) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, v);
    },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    _map: map,
    _used: used,
  };
  // Real Storage objects expose every stored key as an enumerable own
  // property, which is what lets `Object.keys(localStorage)` see them -
  // os/blob-store.js's boot restore enumerates its blob keys exactly that
  // way. A plain object like `base` does not: Object.keys() on it would
  // return this stub's OWN method names (getItem, setItem, ...) rather than
  // anything ever stored, silently turning every stored key invisible to
  // that enumeration. The Proxy makes stored keys show up in ownKeys() /
  // getOwnPropertyDescriptor() the way a real Storage object's do, while
  // every method call still passes straight through to `base` - guarded by
  // `!(prop in target)` so a key that collides with an actual method name
  // (e.g. a test storing "length") can never shadow the real method.
  return new Proxy(base, {
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...map.keys()])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && map.has(prop) && !(prop in target)) {
        return { value: map.get(prop), enumerable: true, configurable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop, receiver) {
      if (typeof prop === 'string' && map.has(prop) && !(prop in target)) {
        return map.get(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

// The EventTarget half of a stub, bolted onto an existing object. Both the
// document stub and the context object itself need it: os/fs-persist.js
// registers its visibilitychange handler on `document` and its beforeunload
// handler on `window`, and makeOsContext sets ctx.window = ctx, so the
// context is the window as far as the sources are concerned.
function addListenerSupport(target) {
  const listeners = new Map();
  target.addEventListener = function (type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  };
  target.removeEventListener = function (type, fn) {
    const arr = listeners.get(type) || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
  target.dispatchEvent = function (evt) {
    (listeners.get(evt.type) || []).forEach(fn => fn(evt));
    return true;
  };
  target._listeners = listeners;
  return target;
}

function makeDocumentStub() {
  return addListenerSupport({
    getElementById() { return null; },
  });
}

// A deliberately small IndexedDB stand-in. It implements only what
// os/storage-idb.js actually calls: open with an upgrade that creates object
// stores, a transaction that yields stores, and get/put/delete/getAll/clear on
// them. Requests resolve on a later microtask so callers cannot accidentally
// depend on synchronous completion, which the real API never gives.
//
// Hand-rolled rather than pulling in fake-indexeddb because this repo has no
// devDependencies and that is deliberate. The trade is real: this stub matches
// the assumptions of the code under test, so it can only catch mistakes in the
// adapter's logic, not mistakes in our reading of the IndexedDB spec. The
// browser pass is what covers the latter.
//
// Task 4.5: the original version of this stub aliased values in and out of
// its Maps and applied every put/delete the instant it ran, which meant it
// could not distinguish "persisted" from "merely mutated in memory" - exactly
// the distinction transaction atomicity turns on. A test written against that
// stub would pass whether or not os/storage-idb.js's commit was actually
// atomic. It now: (1) deep-clones on every put and get, so a caller mutating
// an object after handing it to put() cannot retroactively change what was
// "persisted", and Uint8Array survives as Uint8Array rather than becoming a
// plain object; (2) buffers a transaction's writes and applies them to the
// backing store only when the transaction completes, discarding them on
// abort; (3) throws NotFoundError for an object store that was never
// created, rather than silently inventing one, the way real IndexedDB does.
// Each transaction also snapshots the committed state of every store it
// touches at the moment it opens, so two reads issued against the SAME open
// transaction can never observe a write that lands between them - the
// property os/storage-idb.js's fixed scan() depends on.
function _idbClone(value) {
  if (value === undefined || value === null) return value;
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value)) return value.map(_idbClone);
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(k => { out[k] = _idbClone(value[k]); });
    return out;
  }
  return value;
}

function makeIndexedDbStub(options) {
  options = options || {};
  const databases = new Map();
  let writeCount = 0;
  let failAt = Number.isFinite(options.failWriteAt) ? options.failWriteAt : null;
  // Test hook: makes the very next abort() call on ANY transaction throw
  // this instead of its normal behavior (InvalidStateError on an
  // already-settled transaction, or a plain successful abort otherwise).
  // One-shot, and consumed regardless of which transaction calls abort()
  // first, since a test cannot reach into commit()'s private `tx` to arm
  // this on the specific instance it is about to create.
  let forcedAbortError = null;
  function later(fn) { Promise.resolve().then(fn); }

  // Test hook: makes the Nth put/delete request across the whole stub
  // instance throw, the way a real write can fail mid-transaction (disk
  // pressure, a closed connection, etc). Needed to prove a partial commit
  // rolls back rather than half-applying - nothing else in this stub can ever
  // fail a request, since Map operations don't throw.
  function _maybeInjectFailure() {
    writeCount++;
    if (failAt !== null && writeCount === failAt) {
      const err = new Error('SimulatedFailure: injected failure on write #' + writeCount);
      err.name = 'SimulatedFailure';
      throw err;
    }
  }

  function makeDb(name) {
    const stores = new Map(); // storeName -> Map(key -> clonedValue): the committed data
    // Real IndexedDB tracks every open() call as its own connection and only
    // actually goes away once close() runs on each of them. This stub
    // returns the SAME db object for every open() of a given name (see
    // open() below) rather than modelling distinct connection objects, but a
    // shared live-connection COUNT is enough to model what deleteDatabase()
    // actually needs to know: is anything still connected right now.
    let liveConnections = 0;
    const db = {
      name,
      objectStoreNames: { contains: (n) => stores.has(n) },
      createObjectStore(n) { stores.set(n, new Map()); },
      close() { if (liveConnections > 0) liveConnections--; },
      _registerConnection() { liveConnections++; },
      _liveConnections() { return liveConnections; },
      transaction(names) {
        const storeNames = Array.isArray(names) ? names : [names];
        storeNames.forEach(n => {
          if (!stores.has(n)) {
            const err = new Error('No objectStore named "' + n + '" in this database');
            err.name = 'NotFoundError';
            throw err;
          }
        });
        return makeTransaction(stores, storeNames);
      },
      _stores: stores,
    };
    return db;
  }

  function makeTransaction(stores, storeNames) {
    // Snapshot each touched store's committed state at open time, and every
    // read against this transaction is served from base+buffer rather than
    // the live `stores` map. That is what makes "reuse the same transaction
    // for two reads" an actual guarantee rather than a smaller race window:
    // nothing any OTHER transaction commits in the meantime is visible here.
    const bases = new Map();
    const buffers = new Map();
    storeNames.forEach(n => {
      bases.set(n, new Map(stores.get(n)));
      buffers.set(n, new Map());
    });

    let pending = 0;
    let settled = false;

    const tx = {
      oncomplete: null, onerror: null, onabort: null,
      // Real IndexedDB throws InvalidStateError for abort() on a transaction
      // that has already finished (committed OR aborted) - which includes
      // the common case of a caller calling abort() defensively after a
      // request error already auto-aborted the transaction on its own (see
      // request()'s catch below). Silently no-opping here, as an earlier
      // version of this stub did, hid exactly that: a caller relying on its
      // own abort() call to run cleanup code finds out only in a real
      // browser that the call throws before that code ever executes.
      abort() {
        if (forcedAbortError) {
          const err = forcedAbortError;
          forcedAbortError = null;
          throw err;
        }
        if (settled) {
          const err = new Error(
            "Failed to execute 'abort' on 'IDBTransaction': The transaction has finished.");
          err.name = 'InvalidStateError';
          throw err;
        }
        settle(false);
      },
    };

    function settle(commit) {
      if (settled) return;
      settled = true;
      if (commit) {
        buffers.forEach((buf, name) => {
          const live = stores.get(name);
          buf.forEach((entry, key) => {
            if (entry.deleted) live.delete(key);
            else live.set(key, entry.value);
          });
        });
        if (tx.oncomplete) tx.oncomplete();
      } else if (tx.onabort) {
        tx.onabort();
      }
    }

    // A transaction "completes" once nothing is pending and the event loop
    // returns to a macrotask boundary with nothing new queued - the same
    // rule that lets real IndexedDB transactions span a whole chain of
    // awaited requests as long as nothing but microtasks runs between them
    // (the pattern the `idb` package relies on, and the reason this stub's
    // own request() resolves via a microtask rather than a timer).
    //
    // A single extra microtask is NOT long enough to detect "idle" here: the
    // adapter's real call chain nests several layers of its own awaits
    // between one request finishing and the next one being issued
    // (_fsIdbRequest's Promise wrapper, the tx-store method's own async
    // function, fsWriteEntry's await, sometimes another async helper on top
    // of that), and each layer costs its own microtask tick. Checking after
    // only one tick settled the transaction - applying an empty buffer -
    // right after the very first read in a multi-request batch, silently
    // discarding every write that followed. setImmediate only fires once the
    // ENTIRE microtask queue has drained, however many hops that took, which
    // is what actually matches "no more IDB work is coming".
    function maybeSettle() {
      if (settled || pending > 0) return;
      setImmediate(() => {
        if (!settled && pending === 0) settle(true);
      });
    }

    function request(run) {
      const req = { onsuccess: null, onerror: null, result: undefined };
      pending++;
      later(() => {
        try {
          req.result = run();
          pending--;
          if (req.onsuccess) req.onsuccess({ target: req });
          maybeSettle();
        } catch (e) {
          pending--;
          req.error = e;
          if (req.onerror) req.onerror({ target: req });
          // An unhandled request error aborts its transaction in real
          // IndexedDB. The adapter's own explicit abort() on catch is then a
          // harmless no-op (settle() already guards on `settled`).
          settle(false);
        }
      });
      return req;
    }

    function view(name) {
      const merged = new Map(bases.get(name));
      buffers.get(name).forEach((entry, key) => {
        if (entry.deleted) merged.delete(key);
        else merged.set(key, entry.value);
      });
      return merged;
    }

    function boundStore(name) {
      const buf = buffers.get(name);
      return {
        get: (k) => request(() => _idbClone(view(name).get(String(k)))),
        put: (v, k) => request(() => {
          _maybeInjectFailure();
          buf.set(String(k), { deleted: false, value: _idbClone(v) });
          return undefined;
        }),
        delete: (k) => request(() => {
          _maybeInjectFailure();
          buf.set(String(k), { deleted: true });
          return undefined;
        }),
        clear: () => request(() => {
          view(name).forEach((_, k) => buf.set(k, { deleted: true }));
          return undefined;
        }),
        getAll: () => request(() => [...view(name).values()].map(_idbClone)),
        getAllKeys: () => request(() => [...view(name).keys()]),
      };
    }

    return Object.assign(tx, {
      objectStore(n) {
        if (!buffers.has(n)) {
          const err = new Error('objectStore "' + n + '" is not in this transaction\'s scope');
          err.name = 'NotFoundError';
          throw err;
        }
        return boundStore(n);
      },
    });
  }

  return {
    _databases: databases,
    // Test hook: arms the stub to fail the Nth put/delete request counting
    // from THIS call, not from stub creation - so a test can let setup writes
    // land normally and then fail a specific write inside the commit under
    // test.
    _failNthWriteFromNow(n) { failAt = writeCount + n; },
    // Test hook: makes the next abort() call, on whichever transaction calls
    // it first, throw this specific error instead of its normal behavior -
    // used to prove a cleanup-path failure that is NOT the expected
    // InvalidStateError is preserved rather than silently discarded.
    _forceNextAbortToThrow(err) { forcedAbortError = err; },
    open(name) {
      const req = {
        onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
        result: undefined, error: undefined, transaction: null,
      };
      later(() => {
        const fresh = !databases.has(name);
        if (fresh) databases.set(name, makeDb(name));
        const opened = databases.get(name);
        opened._registerConnection();
        req.result = opened;
        if (fresh && req.onupgradeneeded) {
          // Real IndexedDB exposes the versionchange transaction on the
          // request, and aborting it rolls the entire upgrade back: for a
          // database that did not exist, the database is NOT created and the
          // open request FAILS rather than succeeding.
          //
          // That matters because it is the standard way to ask "does this
          // database exist" without creating it - open it, abort on upgrade -
          // which is what os/fs-migrate.js does to probe for the legacy media
          // database. A stub that ignored abort() here would report every
          // absent database as present-and-empty, and would leave a database
          // behind that a real browser never creates.
          let aborted = false;
          req.transaction = { abort() { aborted = true; } };
          req.onupgradeneeded({ target: req });
          req.transaction = null;
          if (aborted) {
            opened.close();
            databases.delete(name);
            req.result = undefined;
            const err = new Error("Failed to execute 'open': The upgrade transaction was aborted.");
            err.name = 'AbortError';
            req.error = err;
            if (req.onerror) req.onerror({ target: req });
            return;
          }
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
    deleteDatabase(name) {
      const req = { onsuccess: null, onerror: null, onblocked: null, result: undefined };
      later(() => {
        const existing = databases.get(name);
        if (existing && existing._liveConnections() > 0) {
          // Real IndexedDB does not fail a blocked delete - it fires
          // onblocked and then waits, indefinitely, for every connection to
          // close, never calling onsuccess or onerror on its own. Modelling
          // that "forever" faithfully is the whole point: it is what makes a
          // caller that only wires onsuccess/onerror hang instead of fail.
          if (req.onblocked) req.onblocked({ target: req });
          return;
        }
        databases.delete(name);
        req.result = undefined;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };
}

function makeOsContext(overrides) {
  overrides = overrides || {};
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Error,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    // Same reason as the three above: the vm sandbox has none of these, and
    // os/fs-migrate.js's legacy blob import needs both - atob to decode the
    // base64 localStorage copies, Blob to read the media database's rows.
    // Node provides both globally, so this aliases rather than fakes them.
    atob,
    Blob,
    // performance.now() is the clock every CPU measurement in phase 5b reads.
    // Aliasing node's real one rather than faking it keeps the arithmetic under
    // test real; tests that need determinism inject their own `now` instead.
    performance,
    localStorage: makeLocalStorageStub(overrides.quotaBytes),
    document: makeDocumentStub(),
    navigator: { storage: { estimate: async () => ({ usage: 0, quota: 5 * 1024 * 1024 }) } },
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = (init || {}).detail; }
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  addListenerSupport(ctx);
  vm.createContext(ctx);
  ctx.__evalSource = function (src, filename) {
    new vm.Script(src, { filename: filename || 'inline' }).runInContext(ctx);
  };
  Object.keys(overrides).forEach(k => {
    if (k !== 'quotaBytes') ctx[k] = overrides[k];
  });
  return ctx;
}

function loadOsSources(ctx, relPaths) {
  relPaths.forEach(rel => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    ctx.__evalSource(src, rel);
  });
  return ctx;
}

// Objects and arrays created inside a vm context carry that realm's
// prototypes, and assert.deepStrictEqual compares prototypes. Round-tripping
// through JSON rebuilds the value with host prototypes so a structural
// comparison against a plain literal works. Use it on anything a vm-loaded
// source returned.
function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// Pulls one function's full source text out of a file read as a plain
// string, for a test that needs to eval a single function in a vm context
// without loading (and running the side effects of) the whole file it lives
// in. test/fs-boot-backend.test.cjs uses this to reach fsChooseBackend
// without dragging in os/fs-persist.js's loadFS() call at parse time;
// test/daemon-corruption.test.cjs uses it as a plain source-level guard
// because os/daemon.js cannot be loaded in this harness at all.
//
// Finds the function by name (with or without a leading `async`) and then
// walks brace depth from its opening `{` to find the matching closing one,
// rather than guessing "the next line that starts with `}`". A textual guess
// silently truncates the slice the moment a future edit ever dedents an
// inner block (an `if`, a `catch`) to column 0 - and the truncated piece can
// still happen to parse, so a caller would evaluate a fragment while
// believing it evaluated the whole function. A depth counter that never
// returns to zero fails loudly instead.
//
// This is a plain brace counter: it does not track string, comment, or
// regex-literal contents, so a `{` or `}` inside any of those would mis-scan
// it. That is a standing precondition for every caller, not a fact about one
// past function - check by hand that the function you are extracting has
// none of the three before relying on this, and re-check if you ever add
// code that does.
function extractFunctionSource(src, fnName) {
  const marker = new RegExp('(?:async\\s+)?function\\s+' + fnName + '\\s*\\(');
  const match = marker.exec(src);
  assert.notStrictEqual(match, null, fnName + ' not found');
  const start = match.index;
  const braceStart = src.indexOf('{', start);
  assert.notStrictEqual(braceStart, -1, 'no opening brace found for ' + fnName);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.notStrictEqual(end, -1, 'never found the closing brace for ' + fnName);
  assert.strictEqual(depth, 0, 'unbalanced braces while extracting ' + fnName + ' - slice would be truncated');
  return src.slice(start, end);
}

module.exports = {
  makeOsContext, loadOsSources, makeLocalStorageStub, makeIndexedDbStub, ROOT, plain, extractFunctionSource,
};
