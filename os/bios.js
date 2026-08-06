function getBootRegistryNumber(keyPath, valueName, fallback, min = 0, max = 999) {
  const parsed = Number(registryData['HKEY_SLEEPBOX_MACHINE']?.[keyPath]?.[valueName]?.value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
function getBootRegistryText(keyPath, valueName, fallback) {
  const raw = registryData['HKEY_SLEEPBOX_MACHINE']?.[keyPath]?.[valueName]?.value;
  const text = String(raw == null ? '' : raw).trim();
  return text || fallback;
}
function getBiosSoulIntegrityStatus(value) {
  if (value >= 92) return 'STABLE';
  if (value >= 70) return 'DEGRADED';
  if (value >= 45) return 'UNSTABLE';
  return 'CRITICAL';
}
function formatBiosMetric(label, value, suffix = '') {
  return `  ${String(label).padEnd(18, ' ')}: ${value}${suffix ? '  ' + suffix : ''}`;
}
function getBiosStorySnapshot() {
  const fallback = {
    stage: 0,
    phaseLabel: 'Dormant',
    coProcessorLine: 'Co-processor: present (unresponsive)',
    segmentLine: '  Segment C: WARN - residual data found',
    usbLine: '  USB: 1 device attached (unrecognized)',
    relayState: 'Nominal',
    containmentState: 'Baseline',
    profileState: 'none',
    bootLine: 'Loading sleepOS v0.903b2...',
  };
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('sleepOS-daemon-story') || 'null');
  } catch (e) {}
  const story = saved && typeof saved === 'object' ? saved : {};
  const bool = key => !!story[key];
  const voidActions = Array.isArray(story.voidActions)
    ? story.voidActions
        .map(action => String(action || '').toLowerCase().trim())
        .filter(Boolean)
    : [];
  const analyticalCount = voidActions.filter(action => action !== 'observe').length;
  let stage = Math.max(0, Math.min(8, Math.trunc(Number(story.stage) || 0)));

  if (bool('openedDaemon')) stage = Math.max(stage, 1);
  if (bool('falseContainmentSeen')) stage = Math.max(stage, 2);
  if (bool('respawnDisabledKill')) stage = Math.max(stage, 3);
  if (bool('daemonStopped') || bool('wrongVictory')) stage = Math.max(stage, 4);
  if (bool('anchorDeleted')) stage = Math.max(stage, 5);
  if (bool('anchorDeleted') && bool('voidObserved') && (analyticalCount > 0 || bool('mirrorInspected') || bool('protocolInspected'))) {
    stage = Math.max(stage, 6);
  }
  if (bool('mirrorLockRestored') || bool('quarantineSigned')) stage = Math.max(stage, 7);
  if (bool('endingReached')) stage = Math.max(stage, 8);

  if (stage >= 8) {
    return {
      stage,
      phaseLabel: 'Contained',
      coProcessorLine: 'Co-processor: present (archived)',
      segmentLine: '  Segment C: OK - archive checksum sealed',
      usbLine: '  USB: 0 external devices required',
      relayState: 'Archived',
      containmentState: 'Sealed',
      profileState: 'sealed',
      bootLine: 'Loading archival shell...',
    };
  }
  if (stage >= 7) {
    return {
      stage,
      phaseLabel: 'Seal Ready',
      coProcessorLine: 'Co-processor: present (quarantine primed)',
      segmentLine: '  Segment C: OK - quarantine lattice primed',
      usbLine: '  USB: 1 device attached (quarantine signer)',
      relayState: 'Bypassed',
      containmentState: 'Armed',
      profileState: bool('quarantineSigned') ? 'bound' : 'ready',
      bootLine: 'Loading seal-ready shell...',
    };
  }
  if (stage >= 6) {
    return {
      stage,
      phaseLabel: 'Profiled',
      coProcessorLine: 'Co-processor: present (replying in-band)',
      segmentLine: '  Segment C: WARN - seal lattice charging',
      usbLine: '  USB: 1 device attached (void instrument)',
      relayState: 'Bypassed',
      containmentState: 'Profiling',
      profileState: analyticalCount >= 3 ? 'deep' : 'active',
      bootLine: 'Loading analysis shell...',
    };
  }
  if (stage >= 5) {
    return {
      stage,
      phaseLabel: 'Contact',
      coProcessorLine: 'Co-processor: present (replying in-band)',
      segmentLine: '  Segment C: FAIL - anchor bleedthrough',
      usbLine: '  USB: 1 device attached (mirror echo)',
      relayState: 'Compromised',
      containmentState: 'Open',
      profileState: 'contact',
      bootLine: 'Loading degraded shell...',
    };
  }
  if (stage >= 4) {
    return {
      stage,
      phaseLabel: 'Containment Lost',
      coProcessorLine: 'Co-processor: present (unstable handshake)',
      segmentLine: '  Segment C: FAIL - daemon relay bleedthrough',
      usbLine: '  USB: 1 device attached (relay ghost)',
      relayState: 'Degraded',
      containmentState: 'Fractured',
      profileState: 'surface',
      bootLine: 'Loading recovery shell...',
    };
  }
  if (stage >= 1) {
    return {
      stage,
      phaseLabel: 'Observed',
      coProcessorLine: 'Co-processor: present (listening)',
      segmentLine: '  Segment C: WARN - foreign pattern repeating',
      usbLine: '  USB: 1 device attached (observer channel)',
      relayState: 'Listening',
      containmentState: 'Passive',
      profileState: voidActions.length ? 'surface' : 'noise',
      bootLine: 'Loading sleepOS v0.903b2...',
    };
  }
  return fallback;
}
function buildBiosLines() {
  const soulIntegrity = Math.trunc(getBootRegistryNumber('SOUL\\Metrics', 'SOUL_INTEGRITY', 87, 0, 100));
  const daemonCount = Math.trunc(getBootRegistryNumber('SOUL\\Metrics', 'DAEMON_COUNT', 7, 0, 99));
  const temporalDrift = getBootRegistryText('SOUL\\Metrics', 'TEMPORAL_DRIFT', '+/-2.3yr');
  const observerCount = getBootRegistryText('VOID', 'OBSERVER_COUNT', '[classified]');
  const voidPressureBase = Math.trunc(getBootRegistryNumber('VOID', 'VOID_PRESSURE_BASE', 12, 0, 99));
  const unknownDaemons = Math.max(0, daemonCount - 4);
  const memoryCoherence = Math.max(0, Math.min(99.9, soulIntegrity + 0.3 - Math.max(0, voidPressureBase - 12) * 0.18));
  const story = getBiosStorySnapshot();

  return [
    'sleepOS BIOS v2.33b  (C) MMXXI Eve Networks Corp.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'CPU: SOMA-686 @ 666 MHz                [DETECTED]',
    story.coProcessorLine,
    '',
    'Testing RAM...',
    '  Segment A: OK',
    '  Segment B: OK',
    story.segmentLine,
    '  262144 KB total',
    '',
    'Scanning devices...',
    '  IDE 0 Master : WD Corpus-40GB  (ATA-6)',
    '  IDE 0 Slave  : CD-ROM VOID-52x  (no disc)',
    story.usbLine,
    '',
    'Running POST diagnostics...',
    formatBiosMetric('Memory coherence', memoryCoherence.toFixed(1) + '%'),
    formatBiosMetric('Clock drift', temporalDrift, '[WARNING]'),
    formatBiosMetric('Daemon count', `${daemonCount} (${unknownDaemons} unrecognized)`),
    formatBiosMetric('Observer count', observerCount),
    formatBiosMetric('Story phase', story.phaseLabel),
    formatBiosMetric('Relay state', story.relayState),
    formatBiosMetric('Containment', story.containmentState),
    formatBiosMetric('Void profile', story.profileState),
    formatBiosMetric('Void pressure', `${voidPressureBase} baseline`),
    formatBiosMetric('Soul integrity', `${soulIntegrity}%`, '[' + getBiosSoulIntegrityStatus(soulIntegrity) + ']'),
    '',
    story.bootLine,
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
  const biosEl = document.getElementById('bios');
  biosEl.style.transition = 'opacity 0.6s';
  biosEl.style.opacity = '0';
  setTimeout(() => { biosEl.style.display = 'none'; startDesktop(); }, 600);
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
// Load settings early so skipBoot is available
try { Object.assign(osSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e) {}
if (osSettings.skipBoot && !forceBootSequence) {
  biosFinish();
} else {
  biosLines = buildBiosLines();
  setTimeout(biosType, 250);
}

// ─────────────────────────────────────────────────────────────────
// WINDOW MANAGEMENT
// ─────────────────────────────────────────────────────────────────
