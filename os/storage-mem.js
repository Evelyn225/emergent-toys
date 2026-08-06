// In-memory backend. Used by the test suite (no IndexedDB polyfill needed)
// and by phase 3, where processes never touch storage directly anyway.
function createMemStorage(options) {
  options = options || {};
  const quota = Number.isFinite(options.quota) ? options.quota : Infinity;
  let stored = options.tree ? JSON.parse(JSON.stringify(options.tree)) : null;
  const ops = [];

  function measure(snapshot) {
    return JSON.stringify(snapshot).length;
  }

  const backend = {
    async load() {
      return stored ? JSON.parse(JSON.stringify(stored)) : null;
    },
    async commit({ ops: batch, snapshot }) {
      const size = measure(snapshot);
      // Check before storing so a rejected commit leaves the previous state
      // intact. A backend that half-applies is worse than one that refuses.
      if (size > quota) {
        throw VfsError('ENOSPC', 'memory backend quota exceeded: ' + size + ' > ' + quota);
      }
      (batch || []).forEach(op => ops.push(op));
      stored = JSON.parse(JSON.stringify(snapshot));
    },
    async estimate() {
      return { usage: stored ? measure(stored) : 0, quota };
    },
    _ops: ops,
    get _snapshot() { return stored; },
  };
  return backend;
}
