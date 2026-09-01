function triggerGlitch(options) {
  const desktop = document.getElementById('desktop');
  const windowsLayer = document.getElementById('windows-layer');
  const taskbar = document.getElementById('taskbar');
  const glitch = document.getElementById('glitch');
  const intensity = Number(options?.intensity) || 0;
  const subtle = !!options?.subtle;
  // Tracks the visual scaling below, so a subtle background flicker does not
  // arrive at the same volume as a full-intensity tear.
  playSound('glitch', {
    volume: subtle ? 0.4 : intensity >= 7 ? 1 : intensity >= 5 ? 0.78 : 0.58,
  });
  pulseDaemonWindows(intensity, { subtle });
  const targets = [desktop, windowsLayer, taskbar].filter(Boolean);
  const glitchClass = subtle ? 'glitching-soft' : 'glitching';
  targets.forEach(el => el.classList.add(glitchClass));
  setTimeout(() => targets.forEach(el => {
    el.classList.remove('glitching');
    el.classList.remove('glitching-soft');
  }), subtle ? 420 : intensity >= 7 ? 900 : intensity >= 5 ? 760 : 650);

  if (glitch) {
    glitch.style.display = 'block';
    glitch.style.background = intensity >= 7
      ? 'linear-gradient(90deg, rgba(255,0,120,0.14), transparent 22%, rgba(80,255,255,0.18) 58%, transparent 78%), repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)'
      : intensity >= 5
        ? 'linear-gradient(90deg, rgba(255,0,80,0.09), transparent 28%, rgba(90,255,240,0.12) 64%, transparent 82%), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 8px)'
        : 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent 50%, rgba(120,255,255,0.06)), repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 10px)';
    glitch.style.opacity = subtle
      ? intensity >= 7 ? '0.54' : intensity >= 5 ? '0.38' : '0.24'
      : intensity >= 7 ? '0.9' : intensity >= 5 ? '0.65' : '0.42';
    glitch.style.transform = subtle
      ? intensity >= 7 ? 'translateX(-2px)' : intensity >= 5 ? 'translateX(1px)' : 'translateX(0)'
      : intensity >= 7 ? 'translateX(-6px)' : intensity >= 5 ? 'translateX(4px)' : 'translateX(0)';
    setTimeout(() => {
      glitch.style.display = 'none';
      glitch.style.opacity = '';
      glitch.style.transform = '';
      glitch.style.background = '';
    }, subtle ? 110 : intensity >= 7 ? 180 : 130);
  }

  // Brief scanline intensify
  const crt = document.getElementById('crt');
  crt.style.opacity = subtle
    ? intensity >= 7 ? '1.55' : intensity >= 5 ? '1.35' : '1.22'
    : intensity >= 7 ? '2.45' : intensity >= 5 ? '2.2' : '2';
  setTimeout(() => { crt.style.opacity = '1'; }, subtle ? 150 : intensity >= 7 ? 260 : 180);
}

let endingRebootActive = false;
const ENDING_REBOOT_ANIM_MS = 2350;
const ENDING_REBOOT_TEXT_HOLD_MS = 2400;
function playContainmentEndingReboot() {
  if (endingRebootActive) return;
  endingRebootActive = true;
  closeStart();
  closeDropdown();
  closeCad();
  if (altTabActive) closeAltTab();

  stopSoundLoop('ambience', { fade: 0.7 });
  playSound('shutdown');

  const overlay = document.getElementById('ending-reboot');
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
  document.body.classList.add('final-rebooting');

  setTimeout(() => {
    const desktop = document.getElementById('desktop');
    const taskbar = document.getElementById('taskbar');
    const daemonFx = document.getElementById('daemon-fx');
    const bios = document.getElementById('bios');

    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (desktop) desktop.style.display = 'none';
    if (taskbar) taskbar.style.display = 'none';
    if (daemonFx) daemonFx.style.display = 'none';
    document.body.classList.remove('final-rebooting');

    if (bios) {
      bios.style.display = 'flex';
      bios.style.opacity = '1';
      bios.style.transition = 'none';
      bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#858585;white-space:pre;line-height:1.55;">
Containment complete.
Draining chroma channels...               [SEALED]
Archiving daemon.core...                 [OK]
Rebooting sleepOS shell...
      </div>`;
    }

    try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
    setTimeout(() => { window.location.replace('sleep-os.html'); }, ENDING_REBOOT_TEXT_HOLD_MS);
  }, ENDING_REBOOT_ANIM_MS);
}

// ─────────────────────────────────────────────────────────────────
// SHUTDOWN
// ─────────────────────────────────────────────────────────────────
function doShutdown() {
  const id = 'shutdown';
  if (!mkWin({ id, title:'Shut Down sleepOS', icon:'icon:standby', w:300, h:165,
               x:Math.floor(window.innerWidth/2)-150, y:Math.floor(window.innerHeight/2)-80,
               menubar:false, statusbar:false, popup:true })) return;
  document.getElementById('wb-shutdown').innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:standby')}</div>
      <div class="dlg-text">
        What do you want the computer to do?<br><br>
        <select id="shutdown-sel" style="width:180px;font-size:11px;margin-top:2px;">
          <option value="off">Shut down</option>
          <option value="restart">Restart</option>
          <option value="sleep">Sleep</option>
          <option value="back">Return to Eve Net</option>
        </select>
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="confirmShutdown()">OK</button>
      <button class="dlg-btn" onclick="closeWin('shutdown')">Cancel</button>
    </div>`;
}

// How long the shutdown screen is held before the machine actually goes.
//
// The floor is the old fixed value, and it is what runs whenever the jingle
// cannot play - muted, never unlocked, tab hidden. Below it the log is gone
// before it can be read.
const SHUTDOWN_MIN_HOLD_MS = 3200;
// A beat of quiet after the last note, so the screen does not vanish on it.
const SHUTDOWN_TAIL_MS = 350;
// Nothing may wedge a power-off. If the sound never reports back, this fires.
const SHUTDOWN_MAX_HOLD_MS = 12000;

function confirmShutdown() {
  const sel = document.getElementById('shutdown-sel');
  const val = sel ? sel.value : 'back';
  closeWin('shutdown');
  if (val === 'sleep') {
    // Sleep is not a power-off: enterIdleSleep ducks the ambience instead, and
    // a shutdown jingle here would contradict the machine still running.
    enterIdleSleep(MANUAL_SLEEP_WAKE_DELAY_MS);
    return;
  }

  stopSoundLoop('ambience', { fade: 0.9 });
  const startedAt = Date.now();
  const jingle = playSound('shutdown');

  const bios = document.getElementById('bios');
  bios.style.display = 'flex'; bios.style.opacity = '0'; bios.style.transition = 'opacity 0.6s';
  bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#888;white-space:pre;line-height:1.5;">
sleepOS - ${val === 'restart' ? 'Restarting' : 'Shutting Down'}...

Stopping soul_daemon.exe...              [OK]
Stopping dream_fragment.exe...           [OK]
Stopping unknown (PID 0333)...           [TIMEOUT]
Stopping unknown (PID 0334)...           [TIMEOUT]
Stopping unknown (PID 0335)...           [TIMEOUT]
Flushing corpus cache...                 [OK]
Unloading kernel modules...              [OK]
Saving system state...                   [OK]
  </div>`;
  document.getElementById('desktop').style.display = 'none';
  document.getElementById('taskbar').style.display = 'none';
  setTimeout(() => { bios.style.opacity = '1'; }, 30);

  let powered = false;
  const powerOff = () => {
    if (powered) return;
    powered = true;
    if (val === 'back') { window.location.href = '/'; return; }
    if (val === 'restart') { window.location.href = 'sleep-os.html'; return; }
    closeSleepOSTab();
  };

  // Restart and Return navigate somewhere the user is waiting on, and the
  // navigation tears the AudioContext down anyway, so holding six seconds for a
  // jingle that dies at the page boundary would just be six seconds of nothing.
  // Shutting down is the one exit with nothing after it, so it gets the whole
  // sound.
  if (val !== 'off') {
    setTimeout(powerOff, SHUTDOWN_MIN_HOLD_MS);
    return;
  }
  jingle.then(ms => {
    // Measured from before the sound was requested: the first play of the
    // jingle waits on a fetch and a decode, and that time is part of the hold
    // the user is already watching, not extra on top of it.
    const hold = Math.max(SHUTDOWN_MIN_HOLD_MS, ms + SHUTDOWN_TAIL_MS);
    setTimeout(powerOff, Math.max(0, hold - (Date.now() - startedAt)));
  });
  setTimeout(powerOff, SHUTDOWN_MAX_HOLD_MS);
}

// ─────────────────────────────────────────────────────────────────
// FACTORY RESET
// ─────────────────────────────────────────────────────────────────
// Everything sleepOS remembers is persistent and, until this existed, there was
// no way out of it from inside the OS: a player who deleted something they
// wanted, filled the simulated disk, or finished the daemon ending and wanted
// to watch the boot again had to go and clear browser site data by hand.

// The legacy pre-migration media database (os/fs-migrate.js) alongside the live
// filesystem one. Migration deliberately leaves both behind for a release, so a
// reset that only dropped the live database would leave a returning visitor's
// images to be re-imported on the next boot.
const RESET_IDB_NAMES = ['sleepOS-fs', 'sleepOS-media'];

// Prefix scan rather than a list of the fourteen key constants. Storage keys
// get added to this OS regularly and all of them are already namespaced; a list
// here would be a fifteenth place to remember, and the one that fails silently.
function sleepOsStorageKeys(store) {
  const keys = [];
  // Indices, then delete - removeItem during the scan reindexes the rest and
  // skips every other key.
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith('sleepOS')) keys.push(k);
  }
  return keys;
}

// Resolves with whether the database is really gone, rather than rejecting.
// fsIdbDeleteDatabase is deliberately strict for migration's abort path, where
// a blocked delete has to surface immediately; here both outcomes are reported
// to the user instead, so this needs the answer, not an exception.
function resetDeleteDatabaseOnce(name) {
  return new Promise(resolve => {
    let req;
    try { req = indexedDB.deleteDatabase(name); } catch (e) { resolve(false); return; }
    req.onsuccess = () => resolve(true);
    req.onerror   = () => resolve(false);
    // IndexedDB never settles a blocked delete on its own - it waits for every
    // other connection, indefinitely - so this is an answer, not a failure to
    // wait long enough.
    req.onblocked = () => resolve(false);
  });
}

// One retry, because the two reasons a delete blocks are not equally permanent.
// Another TAB holding the database is permanent and worth telling the player
// about; a transaction of our OWN that was still finishing is over in
// milliseconds, and reporting "open in another tab" for it is both wrong and
// unactionable. The flush below makes that second case rare - this covers what
// the flush cannot wait for.
async function resetDeleteDatabase(name) {
  if (await resetDeleteDatabaseOnce(name)) return true;
  await new Promise(r => setTimeout(r, 250));
  return resetDeleteDatabaseOnce(name);
}

function confirmFactoryReset() {
  osConfirm(
    'This erases everything sleepOS has saved in this browser:\n\n' +
    '  your files and folders\n' +
    '  desktop layout and wallpaper\n' +
    '  settings and registry\n' +
    '  story progress\n\n' +
    'sleepOS restarts as a fresh install. This cannot be undone.',
    'Reset sleepOS',
    ok => { if (ok) void performFactoryReset(); },
    'icon:warning');
}

async function performFactoryReset() {
  // Before anything is deleted: from here on, any save-on-the-way-out would
  // write the old session back over the wipe.
  fsBeginFactoryReset();
  closeStart();
  closeDropdown();

  stopSoundLoop('ambience', { fade: 0.5 });
  const bios = document.getElementById('bios');
  if (bios) {
    bios.style.display = 'flex';
    bios.style.opacity = '1';
    bios.style.transition = 'none';
    bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#888;white-space:pre;line-height:1.5;">
sleepOS - Resetting...

Unmounting filesystem...                 [OK]
Erasing user data...
  </div>`;
  }
  document.getElementById('desktop').style.display = 'none';
  document.getElementById('taskbar').style.display = 'none';

  // Let a commit that is already in flight finish before the database is taken
  // away. Writes sit behind a 400ms debounce, and an in-flight one holds an
  // IndexedDB transaction - deleteDatabase does not fail against a transaction,
  // it fires onblocked and waits. Without this, clicking Reset within 400ms of
  // touching a file aborted the whole reset with "sleepOS is open in another
  // tab", which is both wrong and impossible to act on.
  //
  // Flushing data that is about to be deleted looks odd and is the point: the
  // commit is what has to END, and the fastest way there is to let it.
  try { await vfsFlush(); } catch (e) {}

  // The backend's own connection blocks its own delete, so it goes next. This
  // is the second caller of _close() and it has the same shape as migration's:
  // the backend is never used again on this page. Optional on the method as
  // well as the backend - only the IndexedDB backend has a connection to give
  // up, and the localStorage and in-memory ones are reset by the key sweep
  // below instead.
  try { await vfsGetBackend()?._close?.(); } catch (e) {}

  const deleted = await Promise.all(RESET_IDB_NAMES.map(resetDeleteDatabase));
  if (deleted.some(ok => !ok)) {
    // A blocked delete means another tab has sleepOS open on this origin.
    // Reloading now would boot back into the filesystem the user just asked to
    // destroy and report success, so the reset stops here instead and says so.
    // Nothing has been erased yet - localStorage is untouched on this path.
    document.getElementById('desktop').style.display = 'block';
    document.getElementById('taskbar').style.display = 'flex';
    if (bios) bios.style.display = 'none';
    osFactoryResetInProgress = false;
    osAlert('sleepOS could not erase its data because it is open in another tab.\n\n' +
            'Close every other sleepOS tab and try again.',
            'Reset Failed', 'icon:error');
    return;
  }

  [localStorage, sessionStorage].forEach(store => {
    try { sleepOsStorageKeys(store).forEach(k => store.removeItem(k)); } catch (e) {}
  });

  // Set after the wipe that would otherwise remove it. A reset earns the full
  // boot sequence: it is the one thing the player has just asked to see again,
  // and skipBoot is gone with the rest of the settings anyway.
  try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
  window.location.replace('sleep-os.html');
}

// window.close() only works on a tab that script opened. Every current browser
// silently refuses it anywhere else - no exception to catch, no way to ask in
// advance - so on a tab the user opened themselves this does nothing at all,
// which is what "shut down" has been doing all along.
//
// The only detection available is noticing we are still running a moment later,
// and the honest thing to show then is the screen every machine of this vintage
// ended on.
function closeSleepOSTab() {
  window.close();
  setTimeout(showSafeToTurnOff, 500);
}

let safeToTurnOffShown = false;
function showSafeToTurnOff() {
  const bios = document.getElementById('bios');
  if (!bios || safeToTurnOffShown) return;
  // Re-entry would stack a second pair of wake listeners while the first pair
  // is already past its guard window, so the next input would reboot instantly
  // instead of being swallowed.
  safeToTurnOffShown = true;
  bios.style.transition = 'none';
  bios.style.opacity = '1';
  bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);text-align:center;padding:2rem;">
<span style="display:block;font-size:22px;color:#ffa733;line-height:1.6;">It's now safe to turn off<br>your computer.</span>
<span style="display:block;margin-top:2.5rem;font-size:11px;color:#4a4a4a;">press any key to restart</span>
</div>`;
  // A real machine needed the power switch. A browser tab that cannot be closed
  // and cannot be left is just broken, so the power switch is any key.
  const restart = () => {
    try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
    window.location.replace('sleep-os.html');
  };
  setTimeout(() => {
    document.addEventListener('keydown', restart, { once: true });
    document.addEventListener('pointerdown', restart, { once: true });
  }, 600);
}

// ─────────────────────────────────────────────────────────────────
// REGISTRY EDITOR
// ─────────────────────────────────────────────────────────────────
