// The interpreter (os/script/interp.js) calls fsNormalizeDir/fsSplitPath as
// plain globals rather than through the fs adapter - normalizing a path
// string touches no storage, so Task 1 left them as ordinary calls (see
// test/interp-fs-adapter.test.cjs, which stubs exactly these two names to
// prove nothing else is a hidden dependency). The main thread gets them from
// os/fs-core.js's synonyms over os/vfs.js's vfsNormalizeDir/vfsSplitPath.
//
// A worker loads neither file - test/worker-build.test.cjs enforces that only
// the interpreter is shared between the two bundles - so without this file
// execScript throws "fsNormalizeDir is not defined" the instant any spawned
// script runs, before its first instruction. This logic must stay
// byte-identical to os/vfs.js's vfsNormalizeDir/vfsSplitPath;
// test/worker-path-utils.test.cjs is the drift guard.
function fsNormalizeDir(name) {
  return String(name || '')
    .trim()
    .replace(/^C:\\sleepOS(?:\\|$)/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '')
    .toUpperCase();
}

function fsSplitPath(path, fallbackDir) {
  const cleaned = String(path || '')
    .trim()
    .replace(/^C:\\sleepOS(?:\\|$)/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '');
  if (!cleaned) return { dirName: fsNormalizeDir(fallbackDir), fileName: '' };
  const parts = cleaned.split('\\').filter(Boolean);
  if (parts.length === 1) return { dirName: fsNormalizeDir(fallbackDir), fileName: parts[0] };
  return {
    dirName: fsNormalizeDir(parts.slice(0, -1).join('\\')),
    fileName: parts[parts.length - 1],
  };
}
