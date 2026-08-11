// ─────────────────────────────────────────────────────────────────
// BROWSER
// ─────────────────────────────────────────────────────────────────
function renderDaemonPanel() {
  const body = document.getElementById('wb-daemon');
  if (!body) return;
  applyDaemonWindowState();
  setWinTitle('daemon', daemonStory.endingReached ? 'daemon.core - Archive' : 'daemon.core - Containment');
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = telemetry.mirrorLockActive;
  const checklist = getContainmentChecklist();
  const status = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const statusColor = daemonStory.endingReached
    ? '#006400'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? '#aa5500'
      : daemonStory.stage >= 5
        ? '#800080'
        : daemonStory.stage >= 4
          ? '#aa0000'
          : '#000080';
  const notes = [];
  if (daemonStory.endingReached) {
    notes.push('Containment complete. Nothing further to do here.');
  } else if (daemonStory.stage >= 7 && !mirrorLockActive) {
    notes.push('The seal lattice was ready, then the mirror lock dropped again.');
    notes.push('Restore MIRROR_LOCK to 1 before you run ?????.exe or delete void.tmp.');
  } else if (daemonStory.stage >= 7) {
    notes.push('The seal lattice is ready. Run ?????.exe to write SYS\\quarantine.sig, then delete void.tmp.');
  } else if (daemonStory.stage >= 5) {
    notes.push('You removed the anchor. The mirror is no longer deflected away from the user.');
    notes.push('Inspect void.tmp and CACHE\\mirror.dat. Read DOCS\\MIRROR_PROTOCOL.txt for the procedure. Restore MIRROR_LOCK when done.');
  } else if (daemonStory.stage >= 4) {
    notes.push('PID 512 stayed dead. Conditions got worse, not better.');
    notes.push('Lower MIRROR_LOCK in the registry, then delete SYS\\anchor.seed to open the channel. Inspect CACHE\\mirror.dat first.');
  } else if (daemonStory.stage >= 2) {
    notes.push('The watch layer answered your kill attempt. RESPAWN_LOCK must be cleared before PID 512 will stay down.');
  } else {
    notes.push('Open the raw read, then check DOCS for the first containment note.');
  }
  const gauge = value => `<div style="height:6px;border:1px solid #8f8f8f;background:#dadada;"><div style="height:100%;width:${Math.max(0, Math.min(100, value))}%;background:#000080;"></div></div>`;
  body.innerHTML = `
    <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:11px;line-height:1.5;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div class="daemon-eye-large">${iconMarkup('icon:daemon')}</div>
        <div style="flex:1;">
          <div><b>File:</b> daemon.core</div>
          <div><b>Status:</b> <span style="color:${statusColor};font-weight:bold">${status}</span></div>
          <div><b>Containment:</b> <span style="color:${telemetry.rating.color};font-weight:bold">${telemetry.rating.code} / ${telemetry.rating.label}</span></div>
          <div><b>Observed:</b> ${daemonStory.openedDaemon ? 'yes' : 'no'}</div>
          <div><b>Last Event:</b> ${escHtml(daemonStory.lastEventText || 'none')}</div>
          <div><b>Mirror Lock:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
          <div><b>Respawn Lock:</b> ${telemetry.respawnLockActive ? '1' : '0'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Void Pressure</b> ${telemetry.pressure}</div>
          ${gauge(telemetry.pressure)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Lattice Stability</b> ${telemetry.lattice}</div>
          ${gauge(telemetry.lattice)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Signal Depth</b> ${telemetry.signalDepth}</div>
          ${gauge(telemetry.signalDepth)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Aperture Bias</b></div>
          <div style="margin-top:4px;color:${telemetry.bias === 'user-facing' ? '#8a0036' : telemetry.bias === 'sealed' ? '#0a7a2a' : '#005f73'};font-weight:bold;text-transform:uppercase;">${telemetry.bias}</div>
        </div>
      </div>
      <div style="border:1px solid #b0b0b0;background:#fff;padding:8px;min-height:78px;">
        ${notes.map(line => `<div>${escHtml(line)}</div>`).join('')}
      </div>
      ${daemonStory.stage >= 4 ? `
        <div style="border:1px solid #b0b0b0;background:#f7f7f7;padding:8px;">
          <div style="font-weight:bold;margin-bottom:4px;">Containment Checklist</div>
          ${checklist.map(item => `<div style="display:flex;align-items:center;gap:6px;color:${item.done ? '#0a662f' : '#555'};"><span style="font-weight:bold;width:12px;">${item.done ? '■' : '□'}</span><span>${escHtml(item.label)}</span></div>`).join('')}
        </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button class="dlg-btn" onclick="openNotepad('daemon.core')">Raw Read</button>
        ${daemonStory.stage >= 4 && !daemonStory.endingReached ? `<button class="dlg-btn" onclick="openVoid()">Open void.tmp</button>` : ''}
      </div>
      <div style="text-align:right;">
        <button class="dlg-btn primary" onclick="closeWin('daemon')">Close</button>
      </div>
    </div>`;
  resizeDaemonWindow();
}

function resizeDaemonWindow() {
  const daemonWin = wins.daemon?.el;
  const body = document.getElementById('wb-daemon');
  if (!daemonWin || !body) return;
  if (wins.daemon.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const stage = daemonStory.stage || 0;
  const targetWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const minHeight = stage >= 7 ? 500 : stage >= 3 ? 470 : 430;
  const maxWidth = Math.max(360, desktop.clientWidth - 24);
  const maxHeight = Math.max(320, desktop.clientHeight - 24);
  // Grow by however much the content actually overflows, and no more.
  //
  // This previously measured body.scrollHeight and added a padding constant,
  // then took Math.max against the window's current height. Because the body
  // grows with the window, every render computed a target taller than the last,
  // so the panel crept ~46px per Raw Read with no upper bound. Keying off the
  // overflow makes it idempotent: once the content fits, overflow is 0 and
  // repeated renders leave the size alone.
  const overflow = Math.max(0, Math.ceil(body.scrollHeight - body.clientHeight));
  const nextWidth = Math.min(maxWidth, Math.max(daemonWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(daemonWin.offsetHeight + overflow, minHeight));
  daemonWin.style.width = nextWidth + 'px';
  daemonWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(daemonWin.style.left) || 0;
  const currentTop = parseFloat(daemonWin.style.top) || 0;
  daemonWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  daemonWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openDaemon() {
  daemonActivate('panel');
  const stage = daemonStory.stage || 0;
  const initialWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const initialHeight = stage >= 7 ? 500 : stage >= 3 ? 470 : 430;
  if (!mkWin({ id:'daemon', title:'daemon.core - Containment', icon:'icon:daemon', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-daemon')) return;
  renderDaemonPanel();
}

function daemonVoidAction(mode) {
  const telemetry = getContainmentTelemetry();
  daemonVoidFeedMode = mode;
  if (mode === 'observe') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'The file is intact. What you are looking at is the aperture surface.'
      : daemonStory.stage >= 4
        ? 'The relay went quiet and this surface brightened at the same time.'
        : 'Nothing stable answers yet, but the file is taking a shape.';
  } else if (mode === 'measure') {
    daemonVoidFeed = [
      `containment: ${telemetry.rating.code} / ${telemetry.rating.label}`,
      `void pressure: ${telemetry.pressure}`,
      `lattice stability: ${telemetry.lattice}`,
      `signal depth: ${telemetry.signalDepth}`,
      `aperture bias: ${telemetry.bias}`,
      'disk locality: negative',
    ].join('\n');
  } else if (mode === 'listen') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'No words. Something on the reflected side is leaning against the room tone.'
      : daemonStory.stage >= 4
        ? 'You hear the shape of a voice through the monitor gap.'
        : 'Static. Then the suggestion of a room tone.';
  } else if (mode === 'trace') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'trace path:\n  user-facing aperture <- mirror offset <- unresolved source\n  return latency remains non-local'
      : daemonStory.stage >= 4
        ? 'trace path:\n  monitor gap -> pressure rise -> reflected surface'
        : 'No stable trace path yet.';
  } else if (mode === 'sample') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'sample:\n  carrier mismatch: confirmed\n  human voice match: negative\n  daemon-authored signature: false'
      : daemonStory.stage >= 4
        ? 'sample:\n  carrier unstable\n  monitor loss amplified the return path'
        : 'Sampling window too narrow.';
  } else if (mode === 'stabilize') {
    daemonVoidFeed = telemetry.mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 'stabilize:\n  seal lattice catches for 0.8s\n  pressure drops in stepped increments'
        : 'stabilize:\n  mirror lock absorbs part of the return\n  pressure hesitates, then climbs again'
      : 'stabilize refused:\n  MIRROR_LOCK=0\n  aperture remains user-facing';
    triggerGlitch({ intensity: daemonStory.stage >= 7 ? 7 : daemonStory.stage >= 5 ? 5 : 4 });
  } else if (mode === 'pulse') {
    daemonVoidFeed = daemonStory.quarantineSigned
      ? 'The quarantine signature holds. The aperture recoils.'
      : daemonStory.stage >= 5
        ? 'A pulse returns before the machine feels ready for it, as if the file were farther away than the disk.'
        : 'The pulse dissipates without a readable return.';
    if (daemonStory.stage >= 5) triggerGlitch();
  }
  daemonRecordVoidAction(mode);
  const out = document.getElementById('void-readout');
  if (out) renderVoidReadout(out, daemonVoidFeed, telemetry);
}

function renderVoid() {
  const body = document.getElementById('wb-void');
  if (!body) return;
  applyDaemonWindowState();
  setWinTitle('void', daemonStory.endingReached ? 'void.tmp - Sealed' : 'void.tmp');
  body.style.cssText = 'background:#000;display:flex;flex-direction:column;overflow:hidden;padding:10px;gap:10px;';
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const pressure = telemetry.pressure;
  const summary = daemonStory.endingReached
    ? 'No active signal remains.'
    : daemonStory.stage >= 5
      ? `This file is the breach surface.\nUse the probes here to profile it.\n${getVoidObjectiveLine()}`
      : daemonStory.stage >= 4
        ? `Pressure rose after the daemon relay went quiet.\nUse Measure, Listen, or Trace to make the change legible.\n${getVoidObjectiveLine()}`
        : 'No stable observation channel yet.';
  const readout = daemonVoidFeed || summary;
  body.innerHTML = `
    <div style="border:1px solid #123512;background:#030703;color:#7fd37f;padding:8px;font-size:11px;line-height:1.5;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div><b>CONTAINMENT:</b> ${telemetry.rating.code}</div>
        <div style="color:${telemetry.rating.color};font-weight:bold;">${telemetry.rating.label}</div>
      </div>
      <div>
        <div><b>BIAS:</b> ${telemetry.bias.toUpperCase()}</div>
        <div><b>QUARANTINE:</b> ${daemonStory.quarantineSigned ? 'present' : 'missing'}</div>
      </div>
      <div>
        <div><b>VOID PRESSURE:</b> ${pressure}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, pressure))}%;background:#6ab56a;"></div></div>
      </div>
      <div>
        <div><b>LATTICE:</b> ${telemetry.lattice}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.lattice))}%;background:#7fd37f;"></div></div>
      </div>
      <div>
        <div><b>SIGNAL DEPTH:</b> ${telemetry.signalDepth}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.signalDepth))}%;background:#9ee29e;"></div></div>
      </div>
      <div>
        <div><b>MIRROR LOCK:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
        <div><b>DELETE AUTH:</b> ${telemetry.deleteAuthorized ? 'yes' : 'no'}</div>
      </div>
      <div>
        <div><b>PROBES:</b> ${actions.length}/${VOID_ACTION_ORDER.length}</div>
        <div><b>PROFILE:</b> ${getVoidProfileLabel().toUpperCase()}</div>
      </div>
    </div>
    <div id="void-readout" style="flex:1;min-height:0;overflow:auto;border:1px solid #123512;background:#020402;color:#6ab56a;padding:10px;font-size:11px;line-height:1.7;white-space:pre-wrap;">${escHtml(readout)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;">
      <button class="dlg-btn" onclick="daemonVoidAction('observe')">Observe</button>
      <button class="dlg-btn" onclick="daemonVoidAction('measure')">Measure</button>
      <button class="dlg-btn" onclick="daemonVoidAction('listen')">Listen</button>
      <button class="dlg-btn" onclick="daemonVoidAction('trace')">Trace</button>
      <button class="dlg-btn" onclick="daemonVoidAction('sample')">Sample</button>
      <button class="dlg-btn" onclick="daemonVoidAction('stabilize')">Stabilize</button>
      <button class="dlg-btn" onclick="daemonVoidAction('pulse')">Pulse</button>
      <button class="dlg-btn primary" onclick="closeWin('void')">Close</button>
    </div>`;
  renderVoidReadout(document.getElementById('void-readout'), readout, telemetry);
  resizeVoidWindow();
}

function resizeVoidWindow() {
  const voidWin = wins.void?.el;
  if (!voidWin || wins.void.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const targetWidth = daemonStory.stage >= 5 ? 560 : 540;
  const targetHeight = daemonStory.stage >= 5 ? 520 : 500;
  const maxWidth = Math.max(380, desktop.clientWidth - 24);
  const maxHeight = Math.max(360, desktop.clientHeight - 24);
  const nextWidth = Math.min(maxWidth, Math.max(voidWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(voidWin.offsetHeight, targetHeight));
  voidWin.style.width = nextWidth + 'px';
  voidWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(voidWin.style.left) || 0;
  const currentTop = parseFloat(voidWin.style.top) || 0;
  voidWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  voidWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openVoid() {
  if (daemonStory.endingReached) {
    osAlert('void.tmp is no longer present.', 'void.tmp', 'icon:void');
    return;
  }
  daemonRecordInvestigation('void');
  const initialWidth = daemonStory.stage >= 5 ? 560 : 540;
  const initialHeight = daemonStory.stage >= 5 ? 520 : 500;
  if (!mkWin({ id:'void', title:'void.tmp', icon:'icon:void', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-void')) return;
  renderVoid();
}

function openUnknown() {
  const wid = 'unk-warn-' + Date.now();
  if (!mkWin({ id:wid, title:getExeDisplayName(), icon:'icon:unknown', w:320, h:190, x:220, y:130, menubar:false, statusbar:false, popup:true })) return;
  const ready = daemonStory.stage >= 7 && !daemonStory.endingReached && Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const signed = daemonStory.quarantineSigned;
  const inertMsg = daemonStory.stage < 4
    ? 'The launcher does not respond.<br><br>There is nothing here for it to do yet.'
    : daemonStory.stage < 6
    ? 'The launcher is inert.<br><br>The investigation is incomplete. Find the channel.'
    : 'The launcher is waiting.<br><br>MIRROR_LOCK must be restored before it will sign anything.';
  document.getElementById('wb-' + wid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:unknown')}</div>
      <div class="dlg-text">
        ${signed
          ? 'SYS\\quarantine.sig is already present.<br><br>The launcher is waiting for the final delete.'
          : ready
          ? 'The quarantine launcher is armed.<br><br>Running <b>?????.exe</b> will write <b>SYS\\quarantine.sig</b>.'
          : inertMsg}
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="closeWin('${wid}');runUnknown()">${signed ? 'Check Status' : ready ? 'Generate Signature' : 'Run Anyway'}</button>
      <button class="dlg-btn" onclick="closeWin('${wid}')">Cancel</button>
    </div>`;
}

function runUnknown() {
  let message = '';
  if (daemonStory.endingReached) {
    message = 'The quarantine launcher has been archived.\nThere is nothing left to sign.';
  } else if (daemonStory.stage < 4) {
    message = '?????.exe does not execute.\n\nThere is nothing for it to do yet.';
  } else if (daemonStory.stage < 6) {
    message = '?????.exe does not execute.\n\nThe investigation is incomplete. Find and inspect the channel before you use this.';
  } else if (daemonStory.stage < 7 || Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
    message = '?????.exe does not execute.\n\nRestore MIRROR_LOCK to 1 first. The launcher will not sign an open lattice.';
  } else if (!daemonStory.quarantineSigned) {
    updateDaemonStory(story => {
      story.quarantineSigned = true;
      story.lastEventText = 'quarantine signature written';
      daemonVoidFeed = 'A signature passes through the aperture and the pressure drops.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
    });
    message = 'quarantine.sig written.\n\nDelete void.tmp to complete containment.';
  } else {
    message = 'SYS\\quarantine.sig is already present.\n\nThe launcher has nothing else to do.';
  }
  const rid = 'unk-result-' + Date.now();
  if (!mkWin({ id:rid, title:'?????.exe', icon:'icon:unknown', w:360, h:220, x:180, y:110, menubar:false, statusbar:false })) return;
  document.getElementById('wb-' + rid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">${iconMarkup('icon:unknown')}</div>
      <div class="dlg-text" style="white-space:pre-line;">${escHtml(message)}</div>
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" onclick="closeWin('${rid}')">OK</button></div>`;
}

