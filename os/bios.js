function formatBiosMetric(label, value) {
  return `  ${String(label).padEnd(18, ' ')}: ${value}`;
}
function buildBiosLines() {
  return [
    'sleepOS BIOS v2.33b  (C) MMXXI Eve Networks Corp.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'CPU: SOMA-686 @ 233 MHz                [DETECTED]',
    'Co-processor: present',
    '',
    'Testing RAM...',
    '  Segment A: OK',
    '  Segment B: OK',
    '  Segment C: OK',
    '  262144 KB total',
    '',
    'Scanning devices...',
    '  IDE 0 Master : WD Caviar-40GB  (ATA-6)',
    '  IDE 0 Slave  : CD-ROM 52x  (no disc)',
    '  USB: no devices attached',
    '',
    'Running POST diagnostics...',
    formatBiosMetric('Memory test', 'passed'),
    formatBiosMetric('Keyboard', 'detected'),
    formatBiosMetric('Boot device', 'IDE 0 Master'),
    '',
    'Loading sleepOS v0.903b2...',
  ];
}
let biosLines = buildBiosLines();

// BIOS BOOT// BIOS BOOT
// ─────────────────────────────────────────────────────────────────
const biosTextEl = document.getElementById('bios-text');
let biosIdx = 0, biosChar = 0, biosTimer, bisDone = false;
let forceBootSequence = false;
try {
  forceBootSequence = sessionStorage.getItem(FORCE_BOOT_SESSION_KEY) === '1';
  if (forceBootSequence) sessionStorage.removeItem(FORCE_BOOT_SESSION_KEY);
} catch (e) {}

function biosFinish() {
  if (bisDone) return; bisDone = true;
  clearTimeout(biosTimer);
  // The kernel owns the process table and the filesystem (see os/kernel.js), so
  // it is seeded here, next to the filesystem mount below, before anything can
  // open a window. kernelInit only touches its own module-level state, so it is
  // safe this early even on the skipBoot path where the rest of the bundle may
  // still be mid-evaluation.
  kernelInit();
  const biosEl = document.getElementById('bios');
  // Start the filesystem mount now so its I/O overlaps the 600ms fade rather
  // than leaving a blank screen after it. By the time the fade ends this has
  // almost always resolved, so the await below is free.
  //
  // Nothing before the first `await` inside vfsBootMount may touch a `const`
  // declared later in the bundle: on the skipBoot path below, this function
  // runs while the bundle is still evaluating. vfsBootMount's first statement
  // is `await vfsMount(...)`, so everything after it runs as a microtask once
  // evaluation has finished and every `const` exists. Do not move work above
  // that await.
  const mounted = vfsBootMount();
  biosEl.style.transition = 'opacity 0.6s';
  biosEl.style.opacity = '0';
  setTimeout(() => {
    // Never leave the OS stuck on a boot screen: a mount failure is already
    // reported through onError, so proceed either way.
    mounted.catch(() => {}).then(() => {
      biosEl.style.display = 'none';
      startDesktop();
    });
  }, 600);
}

function biosType() {
  if (bisDone) return;
  if (biosIdx >= biosLines.length) { biosTimer = setTimeout(biosFinish, 700); return; }
  const line = biosLines[biosIdx];
  if (biosChar <= line.length) {
    if (biosChar > 0) {
      // Replace last line
      const lines = biosTextEl.textContent.split('\n');
      lines[lines.length - 1] = line.slice(0, biosChar);
      biosTextEl.textContent = lines.join('\n');
    }
    biosChar++;
    biosTimer = setTimeout(biosType, line === '' ? 0 : 11);
  } else {
    biosTextEl.textContent += '\n';
    biosIdx++; biosChar = 0;
    biosTimer = setTimeout(biosType, line === '' ? 25 : 55);
  }
}

document.addEventListener('keydown',   biosFinish, { once: true });
document.addEventListener('click',     biosFinish, { once: true });
document.addEventListener('touchend',  biosFinish, { once: true });
// Load settings early so skipBoot is available. Through the shared reader, not
// a second raw parse: this ran after registry.js's load and re-merged the blob
// verbatim, which put renamed-away keys straight back into osSettings.
loadSavedSettings();
if (osSettings.skipBoot && !forceBootSequence) {
  // Deferred by a tick so nothing here runs while the bundle is still
  // evaluating. Visually identical, and it means biosFinish cannot touch a
  // `const` from a file that has not been reached yet.
  setTimeout(biosFinish, 0);
} else {
  biosLines = buildBiosLines();
  setTimeout(biosType, 250);
}

// ─────────────────────────────────────────────────────────────────
// WINDOW MANAGEMENT
// ─────────────────────────────────────────────────────────────────
