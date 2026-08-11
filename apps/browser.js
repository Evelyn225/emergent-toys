function openBrowser() {
  if (!mkWin({ id:'browser', title:'sleepWEB - Web Browser', icon:'icon:browser', w:640, h:460, x:80, y:50 })) return;

  const mb   = document.getElementById('mb-browser');
  const body = document.getElementById('wb-browser');
  const ws   = document.getElementById('ws-browser');
  body.style.cssText = 'display:flex;flex-direction:column;padding:0;overflow:hidden;';

  let hist = [], histIdx = -1;

  // ── home page ──────────────────────────────────────────────────
  function buildHome() {
    const projectLinks = PROJECTS.map(p =>
      `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${JSON.stringify(p.file).replace(/</g, '\\u003c')}},"*");return false;'>${p.emoji} ${escHtml(p.name)}</a>`
    ).join('');
    const favoriteLinks = browserFavorites
      .filter(fav => !DEFAULT_BROWSER_FAVORITE_URLS.has(fav.url.toLowerCase()))
      .map(fav => {
        const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
        const safeTitle = escHtml(fav.title || fav.url);
        return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>&#9734; ${safeTitle}</a>`;
      }).join('');
    const webLinks = DEFAULT_BROWSER_FAVORITES.map(fav => {
      const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
      const safeTitle = escHtml(fav.title);
      return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>${fav.homeIcon} ${safeTitle}</a>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff') format('woff');font-style:normal;font-weight:400;font-display:swap;}
@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff') format('woff');font-style:normal;font-weight:700;font-display:swap;}
:root{--sleep-font:'W95font',sans-serif;}
      body{margin:0;background:#c0c0c0;font-family: var(--sleep-font);font-size:12px;}
      h1{background:#000080;color:#fff;margin:0;padding:6px 12px;font-size:13px;}
      .sec{padding:6px 12px;}.sec h2{font-size:11px;margin:6px 0 4px;border-bottom:1px solid #808080;}
      .grid{display:flex;flex-wrap:wrap;gap:3px;}
      .lnk{background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;
           padding:1px 7px;font-size:11px;text-decoration:none;color:#000;display:inline-block;}
      .lnk:hover{background:#000080;color:#fff;}
    </style></head><body>
    <h1>&#127760; sleepWEB &#8212; Start Page</h1>
    <div class="sec"><h2>sleepOS Projects</h2><div class="grid">${projectLinks}</div></div>
    <div class="sec"><h2>The Web</h2><div class="grid">${webLinks}${favoriteLinks}</div></div>
</body></html>`;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';
  toolbar.innerHTML = `
    <button class="br-btn" id="br-back" title="Back" disabled>◀</button>
    <button class="br-btn" id="br-fwd"  title="Forward" disabled>▶</button>
    <button class="br-btn" id="br-stop" title="Stop">✕</button>
    <button class="br-btn" id="br-ref"  title="Refresh">↻</button>
    <button class="br-btn" id="br-home" title="Home">${iconMarkup('icon:home')}</button>
    <div class="br-vsep"></div>
    <span class="br-addr-label">Address:</span>
    <input class="br-addr" id="br-url" type="text" value="home:">
    <button class="br-btn" id="br-go">Go</button>
    <button class="br-btn" id="br-fav" title="Add to Favorites">${iconMarkup('icon:star')}</button>`;
  body.appendChild(toolbar);

  // ── iframe + error overlay ─────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#fff;';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation';
  wrap.appendChild(iframe);

  const errDiv = document.createElement('div');
  errDiv.id = 'br-err';
  errDiv.style.cssText = 'display:none;position:absolute;inset:0;background:#c0c0c0;padding:30px;';
  const errBox = document.createElement('div');
  errBox.style.cssText = 'background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:16px;max-width:380px;margin:auto;font-size:11px;';
  errDiv.appendChild(errBox);
  wrap.appendChild(errDiv);

  function showError(url) {
    errBox.innerHTML = `
      <div class="br-err-icon">${iconMarkup('icon:error')}</div>
      <b>This page cannot be displayed</b><br><br>
      <span style="word-break:break-all;color:#444;">${url}</span><br><br>
      This site sent <code style="background:#eee;padding:1px 3px;">X-Frame-Options</code> or
      <code style="background:#eee;padding:1px 3px;">Content-Security-Policy</code> headers that
      block embedding.<br><br>
      To fix this on <b>your own sites</b>, add this header:<br>
      <code style="background:#eee;padding:2px 4px;display:block;margin:4px 0;">X-Frame-Options: ALLOWALL</code>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;">
        <button class="dlg-btn primary" id="br-err-tab">Open in New Tab</button>
        <button class="dlg-btn" id="br-err-ok">OK</button>
      </div>`;
    errDiv.style.display = 'block';
    document.getElementById('br-err-tab').onclick = () => window.open(url, '_blank');
    document.getElementById('br-err-ok').onclick  = () => { errDiv.style.display = 'none'; };
    if (ws) ws.textContent = 'Error: site blocked embedding';
  }
  body.appendChild(wrap);

  // ── navigate ───────────────────────────────────────────────────
  function updateNav() {
    document.getElementById('br-back').disabled = histIdx <= 0;
    document.getElementById('br-fwd').disabled  = histIdx >= hist.length - 1;
  }

  let lastAttemptedUrl = '';

  function navigate(url, push = true) {
    errDiv.style.display = 'none';
    if (!url || url === 'home:') {
      url = 'home:';
      document.getElementById('br-url').value = 'home:';
      iframe.removeAttribute('src');
      iframe.srcdoc = buildHome();
      if (ws) ws.textContent = 'sleepWEB Start Page';
    } else {
      if (!/^https?:\/\/|^data:|^about:/.test(url)) url = 'https://' + url;
      lastAttemptedUrl = url;
      document.getElementById('br-url').value = url;
      iframe.removeAttribute('srcdoc');
      iframe.src = url;
      if (ws) ws.textContent = 'Connecting to ' + (url.split('/')[2] || url);
    }
    if (push) { hist = hist.slice(0, histIdx + 1); hist.push(url); histIdx = hist.length - 1; }
    updateNav();
  }

  function syncUrl() {
    try {
      const loc = iframe.contentWindow.location.href;
      if (loc && loc !== 'about:blank' && loc !== 'about:srcdoc') {
        const bar = document.getElementById('br-url');
        if (bar && bar.value !== loc) {
          bar.value = loc;
          if (hist[histIdx] !== loc) {
            hist = hist.slice(0, histIdx + 1); hist.push(loc); histIdx = hist.length - 1;
            updateNav();
          }
        }
      }
    } catch(e) { /* cross-origin - cannot read URL */ }
  }

  // Poll to catch SPA pushState/hash navigation and link clicks
  const _urlPoll = setInterval(syncUrl, 600);

  iframe.addEventListener('load', () => {
    syncUrl();
    if (ws) ws.textContent = 'Done';
  });

  // Clear poll when browser window closes
  document.getElementById('win-browser')?.addEventListener('remove', () => clearInterval(_urlPoll), { once: true });
  // Use MutationObserver to detect window removal
  new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) { clearInterval(_urlPoll); obs.disconnect(); }
  }).observe(document.getElementById('desktop'), { childList: true });
  iframe.addEventListener('error', () => showError(lastAttemptedUrl));

  // ── handle nav messages from srcdoc home page ──────────────────
  function onBrowserMsg(e) {
    if (e.data && e.data.type === 'browser-nav') navigate(e.data.url);
  }
  window.addEventListener('message', onBrowserMsg);
  // clean up when window closes
  const winEl = document.getElementById('win-browser');
  if (winEl) new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) {
      window.removeEventListener('message', onBrowserMsg); obs.disconnect();
    }
  }).observe(document.getElementById('desktop'), { childList: true });

  // ── button wiring ──────────────────────────────────────────────
  document.getElementById('br-back').addEventListener('click', () => {
    if (histIdx > 0) { histIdx--; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-fwd').addEventListener('click', () => {
    if (histIdx < hist.length - 1) { histIdx++; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-stop').addEventListener('click', () => {
    iframe.src = 'about:blank'; if (ws) ws.textContent = 'Stopped.';
  });
  document.getElementById('br-ref').addEventListener('click', () => {
    const u = hist[histIdx]; if (u === 'home:') { iframe.srcdoc = buildHome(); } else { iframe.src = iframe.src; }
    if (ws) ws.textContent = 'Refreshing...';
  });
  document.getElementById('br-home').addEventListener('click', () => navigate('home:'));
  document.getElementById('br-go').addEventListener('click', () => navigate(document.getElementById('br-url').value.trim()));
  document.getElementById('br-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(document.getElementById('br-url').value.trim());
  });

  // ── favorites helpers ──────────────────────────────────────────
  function currentUrl() { return hist[histIdx] || 'home:'; }
  function refreshHome() {
    if (currentUrl() === 'home:') iframe.srcdoc = buildHome();
  }
  function addToFavorites() {
    const url = currentUrl();
    if (url === 'home:') return;
    if (browserFavorites.some(fav => fav.url.toLowerCase() === url.toLowerCase())) {
      if (ws) ws.textContent = 'Site is already in Favorites.';
      return;
    }
    osPrompt('Save to Favorites as:', document.getElementById('br-url').value, 'Add to Favorites', title => {
      if (!title) return;
      browserFavorites.push({ title, url });
      saveFavorites();
      refreshHome();
      if (ws) ws.textContent = 'Added to Favorites.';
    }, 'icon:star');
  }

  document.getElementById('br-fav').addEventListener('click', addToFavorites);

  // ── browser body right-click ───────────────────────────────────
  body.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: '◀ Back',    disabled: histIdx <= 0,               action: () => document.getElementById('br-back').click() },
      { label: '▶ Forward', disabled: histIdx >= hist.length - 1, action: () => document.getElementById('br-fwd').click() },
      { label: '↻ Refresh', action: () => document.getElementById('br-ref').click() },
      '-',
      { label: 'Add to Favorites', icon: 'icon:star', disabled: currentUrl() === 'home:', action: addToFavorites },
      '-',
      { label: 'Home', icon: 'icon:home', action: () => navigate('home:') },
      { label: 'Open in New Tab', disabled: currentUrl() === 'home:', action: () => window.open(currentUrl(), '_blank') },
    ]);
  });

  // ── menu bar ───────────────────────────────────────────────────
  function brDropdown(anchor, items) {
    const old = document.getElementById('active-dropdown'); if (old) old.remove();
    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
    dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
    items.forEach(item => {
      if (item === '-') {
        const s = document.createElement('div'); s.className = 'menu-dd-sep'; dd.appendChild(s);
      } else {
        const el = document.createElement('div'); el.className = 'menu-dd-item'; el.textContent = item.label;
        el.addEventListener('mousedown', e => { e.stopPropagation(); dd.remove(); item.action(); });
        dd.appendChild(el);
      }
    });
    document.body.appendChild(dd);
    setTimeout(() => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
  }

  mb.innerHTML = '';
  [
    { label: 'File', items: [
      { label: 'Open Location...', action: () => osPrompt('Enter URL:', 'https://', 'Open Location', u => { if (u) navigate(u); }, 'icon:browser') },
      '-',
      { label: 'Close', action: () => closeWin('browser') },
    ]},
    { label: 'View', items: [
      { label: 'Home',    action: () => navigate('home:') },
      { label: 'Refresh', action: () => document.getElementById('br-ref').click() },
      { label: 'Stop',    action: () => document.getElementById('br-stop').click() },
      '-',
      { label: 'View Source', action: () => {
        try {
          const src = iframe.contentDocument.documentElement.outerHTML;
          const w = window.open(''); w.document.write('<pre style="white-space:pre-wrap;font-size:12px;">' + src.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>');
        } catch(e) { osAlert('Cannot view source of cross-origin pages.', 'View Source', 'icon:error'); }
      }},
    ]},
    { label: 'Help', items: [
      { label: 'About sleepWEB', action: () => osAlert('sleepWEB - Web Browser\nsleepOS v1.0\n\nNote: many modern sites block\nbeing loaded inside frames.', 'About sleepWEB', 'icon:browser') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); brDropdown(span, items); });
    mb.appendChild(span);
  });

  // Favorites menu (dynamic - built on open)
  const favSpan = document.createElement('span');
  favSpan.className = 'menu-item'; favSpan.textContent = 'Favorites';
  favSpan.addEventListener('click', e => {
    e.stopPropagation();
    const items = [
      { label: 'Add to Favorites', icon: 'icon:star', action: addToFavorites },
      { label: 'Clear All Favorites', icon: 'icon:recycle-full', action: () => {
        if (!browserFavorites.length) return;
        osConfirm('Clear all favorites?', 'Confirm', ok => {
          if (!ok) return;
          browserFavorites.length = 0; saveFavorites(); refreshHome(); if (ws) ws.textContent = 'Favorites cleared.';
        }, 'icon:recycle-full');
      }},
    ];
    if (browserFavorites.length) {
      items.push('-');
      browserFavorites.forEach((fav, i) => items.push({
        label: fav.title,
        action: () => navigate(fav.url),
      }));
    }
    brDropdown(favSpan, items);
  });
  mb.appendChild(favSpan);

  navigate('home:');
}

// ─────────────────────────────────────────────────────────────────
// GLITCH EFFECT
// ─────────────────────────────────────────────────────────────────
