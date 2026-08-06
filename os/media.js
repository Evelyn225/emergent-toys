function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function inferBlobKindFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (/\.(gif|png|jpe?g|webp|bmp|svg|avif|ico)$/.test(lower)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/.test(lower)) return 'audio';
  if (/\.(script|txt|md|csv|json|xml|html|css|js|log|ini|cfg|sh|bat)$/.test(lower)) return 'text';
  return 'binary';
}

function inferBlobMimeFromName(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  if (/\.(jpg|jpeg)$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.ogv')) return 'video/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (/\.(txt|log|ini|cfg)$/.test(lower)) return 'text/plain';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js')) return 'text/javascript';
  return '';
}

let _uploadCwd = '';
function triggerUpload(dir) {
  _uploadCwd = dir || '';
  document.getElementById('file-upload-input').click();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target?.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsArrayBuffer(file);
  });
}

async function handleFileUpload(fileList) {
  const dirPath = fsNormalizeDir(_uploadCwd || '');
  if (dirPath === 'DESKTOP') ensureFsDir('DESKTOP');
  const dir = fsGetDir(dirPath);
  if (dirPath && !dir) {
    osAlert('Upload target not found:\nC:\\sleepOS\\' + dirPath, 'Upload Failed', 'X');
    return;
  }
  const dirLabel = dirPath ? `C:\\sleepOS\\${dirPath}\\` : 'C:\\sleepOS';
  const results = await Promise.all([...fileList].map(async file => {
    const TEXT_EXTS = /\.(script|txt|md|csv|json|xml|html|css|js|log|ini|cfg|sh|bat)$/i;
    const mime = file.type || inferBlobMimeFromName(file.name);
    const inferredKind = inferBlobKindFromName(file.name);
    const isText = mime.startsWith('text/') || inferredKind === 'text' || (file.type === '' && TEXT_EXTS.test(file.name));
    const kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('video/') ? 'video'
               : mime.startsWith('audio/') ? 'audio'
               : isText ? 'text'
               : inferredKind;
    try {
      if (kind === 'text') {
        const content = await readFileAsText(file);
        const saved = fsWriteTextFile(file.name, content, dirPath);
        return saved ? { ok: true, name: file.name } : { ok: false, name: file.name };
      }
      const url = URL.createObjectURL(file);
      const saved = fsWriteBlobFile(file.name, { url, kind, size: file.size, mime }, dirPath);
      if (!saved) {
        URL.revokeObjectURL(url);
        return { ok: false, name: file.name };
      }
      try {
        const buffer = await readFileAsArrayBuffer(file);
        saveBlobEntry(dirPath, file.name, kind, file.size, mime, buffer);
      } catch (e) {}
      return { ok: true, name: file.name };
    } catch (e) {
      return { ok: false, name: file.name };
    }
  }));
  const added = results.filter(result => result.ok).map(result => result.name);
  const failed = results.filter(result => !result.ok).map(result => result.name);
  if (added.length) {
    document.dispatchEvent(new CustomEvent('fs-changed'));
    showUploadConfirm(added, dirLabel);
  }
  if (failed.length) {
    const msg = failed.length === 1
      ? `"${failed[0]}" could not be uploaded to ${dirLabel}`
      : `${failed.length} files could not be uploaded to ${dirLabel}`;
    osAlert(msg, 'Upload Failed', 'X');
  }
}

function showUploadConfirm(names, dirLabel) {
  dirLabel = dirLabel || 'C:\\sleepOS';
  const msg = names.length === 1
    ? `"${names[0]}" uploaded to ${dirLabel}`
    : `${names.length} files uploaded to ${dirLabel}`;
  const id = 'upload-confirm-' + Date.now();
  if (!mkWin({ id, title: 'Upload Complete', icon: '📤', w: 300, h: 140, popup: true, menubar: false, statusbar: false })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:14px;font-family: var(--sleep-font);font-size:12px;';
  body.innerHTML = `<div style="margin-bottom:12px;">📁 ${msg}</div>
    <div style="margin-bottom:8px;color:#555;">Use OPEN &lt;filename&gt; in terminal, or type the filename to view.</div>
    <div style="text-align:center;"><button class="dlg-btn" onclick="closeWin('${id}')">OK</button></div>`;
}

function openMediaFile(filename, dirName) {
  const entry = fsGetEntry(filename, dirName);
  const blob = entry && entry.kind === 'blob' ? entry.value : null;
  if (!blob) { return; }
  if (blob.kind === 'image') openImageViewer(entry.fileName, entry.dirName);
  else if (blob.kind === 'video') openVideoPlayer(entry.fileName, entry.dirName);
  else if (blob.kind === 'audio') openAudioPlayer(entry.fileName, entry.dirName);
  else osAlert('Cannot open binary file:\n' + entry.fileName, 'Cannot Open', 'X');
}

function openImageViewer(filename, dirName) {
  const entry = fsGetEntry(filename, dirName);
  const blob = entry && entry.kind === 'blob' ? entry.value : null; if (!blob) return;
  const pathKey = (entry.dirName ? entry.dirName + '\\' : '') + entry.fileName;
  const id = 'img-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: filename + ' \u2014 Image Viewer', icon: '🖼️', w: 520, h: 400 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;';
  const wrap = document.createElement('div'); wrap.className = 'media-body';
  const img  = document.createElement('img'); img.src = blob.url;
  wrap.appendChild(img); body.appendChild(wrap);
  if (ws) ws.textContent = entry.fileName + '  \u2014  ' + fmtSize(blob.size);
  if (mb) {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = 'File';
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, [
      { label: 'Close', action: () => closeWin(id) },
    ]); });
    mb.appendChild(span);
    const viewSpan = document.createElement('span');
    viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
    viewSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(viewSpan, [
      { label: 'Actual Size',  action: () => { img.style.maxWidth='none'; img.style.maxHeight='none'; } },
      { label: 'Fit to Window', action: () => { img.style.maxWidth='100%'; img.style.maxHeight='100%'; } },
    ]); });
    mb.appendChild(viewSpan);
  }
}

function openVideoPlayer(filename, dirName) {
  const entry = fsGetEntry(filename, dirName);
  const blob = entry && entry.kind === 'blob' ? entry.value : null; if (!blob) return;
  const pathKey = (entry.dirName ? entry.dirName + '\\' : '') + entry.fileName;
  const id = 'vid-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: iconLabel(entry.fileName) + ' \u2014 Media Player', icon: '🎬', w: 500, h: 390 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const shell  = document.createElement('div'); shell.className = 'vp-shell';

  // ── Screen ────────────────────────────────────────────────────
  const screen  = document.createElement('div'); screen.className = 'vp-screen';
  const video   = document.createElement('video'); video.src = blob.url;
  const dither  = document.createElement('div'); dither.className = 'vp-dither';
  dither.style.display = osSettings.videoDither ? '' : 'none';
  const overlay = document.createElement('div'); overlay.className = 'vp-screen-overlay';
  overlay.textContent = '▶'; overlay.style.opacity = '1';
  screen.appendChild(video); screen.appendChild(dither); screen.appendChild(overlay);
  screen.addEventListener('click', () => video.paused ? video.play() : video.pause());

  // ── Bottom bar ────────────────────────────────────────────────
  const bar = document.createElement('div'); bar.className = 'vp-bar';

  // Seek row
  const seekRow = document.createElement('div'); seekRow.className = 'vp-seek-row';
  const timeEl  = document.createElement('div'); timeEl.className = 'vp-time'; timeEl.textContent = '0:00';
  const durEl   = document.createElement('div'); durEl.className = 'vp-time vp-dur'; durEl.textContent = '0:00';
  const seek    = document.createElement('input'); seek.type = 'range'; seek.className = 'vp-seek';
  seek.min = 0; seek.max = 1000; seek.value = 0;
  seekRow.appendChild(timeEl); seekRow.appendChild(seek); seekRow.appendChild(durEl);

  // Button row
  const btnRow = document.createElement('div'); btnRow.className = 'vp-btn-row';
  const mkBtn = (txt, title, cls, fn) => {
    const b = document.createElement('div');
    b.className = 'vp-btn' + (cls ? ' ' + cls : '');
    b.textContent = txt; b.title = title;
    b.addEventListener('click', fn); return b;
  };
  const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

  const btnRew  = mkBtn('\u23EE', 'Back 10s',    '', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  const btnPlay = mkBtn('\u25B6', 'Play/Pause', 'vp-btn-play', () => video.paused ? video.play() : video.pause());
  const btnStop = mkBtn('\u25A0', 'Stop',        '', () => { video.pause(); video.currentTime = 0; });
  const btnFwd  = mkBtn('\u23ED', 'Forward 10s', '', () => { video.currentTime = Math.min(video.duration||0, video.currentTime + 10); });

  const muteBtn = mkBtn('\u{1F50A}', 'Mute', '', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '\u{1F507}' : '\u{1F50A}';
    renderVol();
  });

  // Unicode block volume slider (10 blocks)
  const volEl = document.createElement('div'); volEl.className = 'vp-vol-blocks'; volEl.title = 'Volume';
  const VOL_BLOCKS = 10;
  function renderVol() {
    const v = video.muted ? 0 : video.volume;
    const filled = Math.round(v * VOL_BLOCKS);
    const on = Array(filled + 1).join('&#9632;');
    const off = Array(VOL_BLOCKS - filled + 1).join('&#9643;');
    volEl.innerHTML =
      `<span style="color:#000080">${on}</span>` +
      `<span style="color:#6a6a6a">${off}</span>`;
  }
  function setVolFromX(clientX) {
    const r = volEl.getBoundingClientRect();
    video.volume = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    video.muted = false;
    muteBtn.textContent = '\u{1F50A}';
    renderVol();
  }
  let _volDrag = false;
  volEl.addEventListener('mousedown', e => { _volDrag = true; setVolFromX(e.clientX); });
  document.addEventListener('mousemove', e => { if (_volDrag) setVolFromX(e.clientX); });
  document.addEventListener('mouseup', () => { _volDrag = false; });
  renderVol();

  const metaEl = document.createElement('div'); metaEl.className = 'vp-meta';
  metaEl.textContent = iconLabel(entry.fileName) + '  \u00b7  ' + fmtSize(blob.size);

  btnRow.appendChild(btnRew); btnRow.appendChild(btnPlay); btnRow.appendChild(btnStop);
  btnRow.appendChild(btnFwd); btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(muteBtn); btnRow.appendChild(volEl);
  btnRow.appendChild(div('vp-spacer')); btnRow.appendChild(metaEl);

  bar.appendChild(seekRow); bar.appendChild(btnRow);
  shell.appendChild(screen); shell.appendChild(bar);
  body.appendChild(shell);

  // ── Helpers ───────────────────────────────────────────────────
  function fmtT(s) {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0');
  }
  function updateSeekGradient() {
    const pct = seek.max > 0 ? (seek.value / seek.max * 100).toFixed(1) + '%' : '0%';
    seek.style.setProperty('--pct', pct);
  }

  // ── Events ────────────────────────────────────────────────────
  video.addEventListener('loadedmetadata', () => { durEl.textContent = fmtT(video.duration); });
  video.addEventListener('timeupdate', () => {
    timeEl.textContent = fmtT(video.currentTime);
    if (!seek._dragging && video.duration) { seek.value = (video.currentTime / video.duration) * 1000; updateSeekGradient(); }
  });
  video.addEventListener('play',         () => { btnPlay.textContent = '❚❚'; overlay.style.opacity = '0'; });
  video.addEventListener('pause',        () => { btnPlay.textContent = '\u25B6'; overlay.style.opacity = '0.35'; });
  video.addEventListener('ended',        () => { btnPlay.textContent = '\u25B6'; overlay.style.opacity = '1'; });
  video.addEventListener('volumechange', renderVol);

  seek.addEventListener('mousedown', () => { seek._dragging = true; });
  seek.addEventListener('input', () => { if (video.duration) { video.currentTime = (seek.value/1000)*video.duration; updateSeekGradient(); } });
  seek.addEventListener('mouseup', () => { seek._dragging = false; });

  // ── Menu bar ──────────────────────────────────────────────────
  if (ws) ws.textContent = iconLabel(entry.fileName) + '  \u2014  ' + fmtSize(blob.size);
  if (mb) {
    [
      { label: 'File', items: [{ label: 'Close', action: () => { video.pause(); closeWin(id); } }] },
      { label: 'Playback', items: [
        { label: 'Play / Pause', action: () => video.paused ? video.play() : video.pause() },
        { label: 'Stop',         action: () => { video.pause(); video.currentTime = 0; } },
        '-',
        { label: '\u21E6 Back 10s',    action: () => { video.currentTime = Math.max(0, video.currentTime - 10); } },
        { label: '\u21E8 Forward 10s', action: () => { video.currentTime = Math.min(video.duration||0, video.currentTime + 10); } },
      ]},
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item'; span.textContent = label;
      span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
      mb.appendChild(span);
    });
  }
}

function openAudioPlayer(filename, dirName) {
  const entry = fsGetEntry(filename, dirName);
  const blob = entry && entry.kind === 'blob' ? entry.value : null; if (!blob) return;
  const pathKey = (entry.dirName ? entry.dirName + '\\' : '') + entry.fileName;
  const id = 'aud-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: filename + ' \u2014 Media Player', icon: '🎵', w: 320, h: 120, menubar: false })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:10px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;';
  body.innerHTML = `<div style="font-family: var(--sleep-font);font-size:11px;margin-bottom:4px;">${entry.fileName}</div>`;
  const audio = document.createElement('audio');
  audio.src = blob.url; audio.controls = true; audio.style.width = '100%';
  body.appendChild(audio);
}

function openAudioPlayer(filename, dirName) {
  const entry = fsGetEntry(filename, dirName);
  const blob = entry && entry.kind === 'blob' ? entry.value : null; if (!blob) return;
  const pathKey = (entry.dirName ? entry.dirName + '\\' : '') + entry.fileName;
  const id = 'aud-' + pathKey.replace(/\W/g,'_');
  if (!mkWin({ id, title: iconLabel(entry.fileName) + ' - Media Player', icon: '🎵', w: 420, h: 240 })) return;

  const body = document.getElementById('wb-' + id);
  const ws = document.getElementById('ws-' + id);
  const mb = document.getElementById('mb-' + id);
  const author = String(blob.author || '').trim();

  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const shell = document.createElement('div'); shell.className = 'vp-shell';
  const screen = document.createElement('div'); screen.className = 'vp-screen ap-screen';
  const screenHead = document.createElement('div'); screenHead.className = 'ap-screen-head';
  const iconEl = document.createElement('div'); iconEl.className = 'ap-screen-icon'; iconEl.textContent = '♫';
  const metaWrap = document.createElement('div'); metaWrap.className = 'ap-screen-meta';
  const labelEl = document.createElement('div'); labelEl.className = 'ap-screen-label'; labelEl.textContent = 'SleepOS Audio Deck';
  const titleEl = document.createElement('div'); titleEl.className = 'ap-screen-title'; titleEl.textContent = iconLabel(entry.fileName);
  const pathEl = document.createElement('div'); pathEl.className = 'ap-screen-path'; pathEl.textContent = (entry.dirName ? entry.dirName + '\\' : '') + entry.fileName;
  metaWrap.appendChild(labelEl);
  metaWrap.appendChild(titleEl);
  if (author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'ap-screen-path';
    authorEl.textContent = 'Author: ' + author;
    metaWrap.appendChild(authorEl);
  }
  metaWrap.appendChild(pathEl);
  const loopIndicator = document.createElement('div'); loopIndicator.className = 'ap-loop-indicator'; loopIndicator.textContent = '↻';
  screenHead.appendChild(iconEl);
  screenHead.appendChild(metaWrap);
  screenHead.appendChild(loopIndicator);
  screen.appendChild(screenHead);

  const bar = document.createElement('div'); bar.className = 'vp-bar';
  const seekRow = document.createElement('div'); seekRow.className = 'vp-seek-row';
  const timeEl = document.createElement('div'); timeEl.className = 'vp-time'; timeEl.textContent = '0:00';
  const durEl = document.createElement('div'); durEl.className = 'vp-time vp-dur'; durEl.textContent = '0:00';
  const seek = document.createElement('input'); seek.type = 'range'; seek.className = 'vp-seek';
  seek.min = 0; seek.max = 1000; seek.value = 0;
  seekRow.appendChild(timeEl);
  seekRow.appendChild(seek);
  seekRow.appendChild(durEl);

  const btnRow = document.createElement('div'); btnRow.className = 'vp-btn-row';
  const mkBtn = (txt, title, cls, fn) => {
    const b = document.createElement('div');
    b.className = 'vp-btn' + (cls ? ' ' + cls : '');
    b.textContent = txt;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

  const audio = document.createElement('audio');
  audio.src = blob.url;
  audio.preload = 'metadata';
  audio.style.display = 'none';

  const btnRew = mkBtn('⏮', 'Back 10s', '', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  const btnPlay = mkBtn('▶', 'Play/Pause', 'vp-btn-play', () => audio.paused ? audio.play() : audio.pause());
  const btnStop = mkBtn('\u25A0', 'Stop', '', () => { audio.pause(); audio.currentTime = 0; });
  const btnFwd = mkBtn('⏭', 'Forward 10s', '', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
  const btnLoop = mkBtn('↻', 'Toggle Loop', '', () => {
    audio.loop = !audio.loop;
    renderLoop();
  });
  const muteBtn = mkBtn('🔊', 'Mute', '', () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    renderVol();
  });
  const volEl = document.createElement('div'); volEl.className = 'vp-vol-blocks'; volEl.title = 'Volume';
  const metaEl = document.createElement('div'); metaEl.className = 'vp-meta';
  metaEl.textContent = iconLabel(entry.fileName) + '  ·  ' + fmtSize(blob.size) + (author ? '  ·  ' + author : '');

  btnRow.appendChild(btnRew);
  btnRow.appendChild(btnPlay);
  btnRow.appendChild(btnStop);
  btnRow.appendChild(btnFwd);
  btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(btnLoop);
  btnRow.appendChild(div('vp-divider'));
  btnRow.appendChild(muteBtn);
  btnRow.appendChild(volEl);
  btnRow.appendChild(div('vp-spacer'));
  btnRow.appendChild(metaEl);

  bar.appendChild(seekRow);
  bar.appendChild(btnRow);
  shell.appendChild(screen);
  shell.appendChild(bar);
  shell.appendChild(audio);
  body.appendChild(shell);

  function fmtT(s) {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }
  function updateSeekGradient() {
    const pct = seek.max > 0 ? (seek.value / seek.max * 100).toFixed(1) + '%' : '0%';
    seek.style.setProperty('--pct', pct);
  }
  function renderVol() {
    const v = audio.muted ? 0 : audio.volume;
    const filled = Math.round(v * 10);
    const on = Array(filled + 1).join('&#9632;');
    const off = Array(10 - filled + 1).join('&#9643;');
    volEl.innerHTML = `<span style="color:#000080">${on}</span><span style="color:#6a6a6a">${off}</span>`;
  }
  function renderLoop() {
    btnLoop.classList.toggle('active', audio.loop);
    loopIndicator.classList.toggle('active', audio.loop);
  }
  function setVolFromX(clientX) {
    const r = volEl.getBoundingClientRect();
    audio.volume = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    audio.muted = false;
    muteBtn.textContent = '🔊';
    renderVol();
  }

  let volDrag = false;
  function syncPlayingState() {
    btnPlay.textContent = audio.paused ? '▶' : '❚❚';
  }

  renderVol();
  renderLoop();
  updateSeekGradient();

  audio.addEventListener('loadedmetadata', () => { durEl.textContent = fmtT(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    timeEl.textContent = fmtT(audio.currentTime);
    if (!seek._dragging && audio.duration) {
      seek.value = (audio.currentTime / audio.duration) * 1000;
      updateSeekGradient();
    }
  });
  audio.addEventListener('play', syncPlayingState);
  audio.addEventListener('pause', syncPlayingState);
  audio.addEventListener('ended', syncPlayingState);
  audio.addEventListener('volumechange', renderVol);

  seek.addEventListener('mousedown', () => { seek._dragging = true; });
  seek.addEventListener('input', () => {
    if (audio.duration) {
      audio.currentTime = (seek.value / 1000) * audio.duration;
      updateSeekGradient();
    }
  });
  seek.addEventListener('mouseup', () => { seek._dragging = false; });

  volEl.addEventListener('mousedown', e => { volDrag = true; setVolFromX(e.clientX); });
  document.addEventListener('mousemove', e => { if (volDrag) setVolFromX(e.clientX); });
  document.addEventListener('mouseup', () => { volDrag = false; });

  if (ws) ws.textContent = iconLabel(entry.fileName) + '  -  ' + fmtSize(blob.size) + (author ? '  -  ' + author : '');
  if (mb) {
    [
      { label: 'File', items: [{ label: 'Close', action: () => { audio.pause(); closeWin(id); } }] },
      { label: 'Playback', items: [
        { label: 'Play / Pause', action: () => audio.paused ? audio.play() : audio.pause() },
        { label: 'Stop', action: () => { audio.pause(); audio.currentTime = 0; } },
        '-',
        { label: '⇦ Back 10s', action: () => { audio.currentTime = Math.max(0, audio.currentTime - 10); } },
        { label: '⇨ Forward 10s', action: () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); } },
        '-',
        { label: () => (audio.loop ? 'Disable Loop' : 'Enable Loop'), action: () => { audio.loop = !audio.loop; renderLoop(); } },
      ]},
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item';
      span.textContent = label;
      span.addEventListener('click', e => {
        e.stopPropagation();
        showDropdown(span, items.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item.label === 'function') return { ...item, label: item.label() };
          return item;
        }));
      });
      mb.appendChild(span);
    });
  }
}

// Drag-and-drop onto the desktop
