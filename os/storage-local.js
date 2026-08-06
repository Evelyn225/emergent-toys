// localStorage backend. This is phase 2's production backend and it reads and
// writes exactly the payload saveFS/loadFS used before, so an existing
// visitor's filesystem loads unchanged.
//
// The one deliberate behavior change: a quota failure throws ENOSPC. The old
// code caught the exception and discarded it, so a full disk silently ate the
// user's work. Phase 4 replaces this backend with IndexedDB.
const LOCAL_FS_KEY = 'sleepOS-fs';
// localStorage is spec'd at 5 MB per origin and exposes no quota API.
const LOCAL_QUOTA_BYTES = 5 * 1024 * 1024;

// Browsers disagree on how they signal a full quota. Chrome and Safari throw
// QuotaExceededError (legacy code 22), Firefox historically used
// NS_ERROR_DOM_QUOTA_REACHED (code 1014). Anything else - most often a
// SecurityError from storage being disabled - is a different problem and must
// not be reported as "out of space".
function _isQuotaError(e) {
  if (!e) return false;
  return e.name === 'QuotaExceededError'
      || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || e.code === 22
      || e.code === 1014;
}

function createLocalStorageBackend(options) {
  options = options || {};
  const key = options.key || LOCAL_FS_KEY;

  return {
    async load() {
      let raw = null;
      try { raw = localStorage.getItem(key); } catch (e) { return null; }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },

    async commit({ ops, snapshot }) {
      const payload = JSON.stringify(snapshot);
      try {
        localStorage.setItem(key, payload);
      } catch (e) {
        if (_isQuotaError(e)) {
          throw VfsError('ENOSPC', 'localStorage is full: could not write ' + payload.length + ' bytes');
        }
        throw VfsError('EACCES', 'localStorage is unavailable: ' + ((e && e.message) || e));
      }
    },

    async estimate() {
      // localStorage quota is per-origin, and sleepOS writes far more than the
      // filesystem key: drive state, recycle bin, icon positions, settings, the
      // registry, and base64 blob content from os/blob-store.js. Counting only
      // our own key would report kilobytes while the origin holds megabytes,
      // and the VFS's pre-write guard is only as honest as this number.
      let usage = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k == null) continue;
          const v = localStorage.getItem(k);
          usage += k.length + (v ? v.length : 0);
        }
      } catch (e) {
        usage = 0;
      }
      return { usage, quota: LOCAL_QUOTA_BYTES };
    },
  };
}
