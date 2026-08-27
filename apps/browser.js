// Set while a browser window is open, to that window's own `navigate`
// closure - openBrowser cannot reach back into an already-open window's
// local state otherwise (mkWin returns null for an id already in use, so a
// second openBrowser(url) call while the window is open would fall straight
// through without this). Cleared when the window closes, alongside the other
// per-window cleanup below.
let _browserNavigate = null;

// Windows-illegal path characters, plus the VFS's own separators (\ and /) -
// a raw title or hostname can contain any of these, and vfsSplitPath would
// otherwise read a stray backslash as a directory boundary and write the
// shortcut somewhere other than the Desktop it was asked for.
function sanitizeShortcutFileStem(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function hostnameFromUrl(url) {
  try { return new URL(url).hostname || String(url || ''); } catch (e) { return String(url || ''); }
}

// escHtml (apps/notepad.js) only escapes &, < and > - enough for text nodes,
// not for a value going inside a double-quoted HTML attribute. Shortcut
// titles and URLs land in data-nav-url/data-nav-title below, so quotes have
// to be escaped too or a title containing one breaks out of the attribute.
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

// Reads the URL out of a [InternetShortcut] .url file. Deliberately lenient
// about the section header - a player can hand-edit these in NOTEPAD, and a
// missing header is still a file worth opening if the URL= line is intact.
// Returns '' for anything that isn't a valid http(s) URL, which callers treat
// as "cannot open this shortcut" rather than silently falling back to home:.
function parseUrlShortcutTarget(content) {
  const match = String(content || '').match(/^[ \t]*URL[ \t]*=[ \t]*(.+?)[ \t]*$/im);
  const url = match ? match[1].trim() : '';
  return /^https?:\/\//i.test(url) ? url : '';
}

// FILE_HANDLERS['BROWSER.exe'] (os/registry.js) routes here for a .url file,
// from any of the three surfaces openWithAssociation reaches - the desktop,
// Explorer, and the terminal's OPEN. A malformed or hand-edited shortcut (no
// URL= line, an empty one, or something that isn't http(s)) fails with an
// osAlert instead of quietly opening a blank browser, which would look like
// the shortcut worked when it didn't.
async function openBrowserFromUrlFile(name, dir) {
  let content;
  try {
    content = await vfsReadFile(name, dir);
  } catch (err) {
    osAlert('Cannot read shortcut:\n' + name, 'Open Shortcut', 'icon:error');
    return;
  }
  const url = parseUrlShortcutTarget(content);
  if (!url) {
    osAlert('This shortcut has no valid URL and cannot be opened.\n\n' + name, 'Invalid Shortcut', 'icon:error');
    return;
  }
  openBrowser(url);
}

// initialUrl is set when a .url shortcut opens the browser (see
// openBrowserFromUrlFile above); every other caller (the desktop icon, Start
// menu, RUN_MAP) still calls this with no arguments and gets the home page,
// unchanged.
function openBrowser(initialUrl) {
  if (!mkWin({ id:'browser', title:'sleepWEB - Web Browser', icon:'icon:browser', w:640, h:460, x:80, y:50 })) {
    // Window already open - route the request to the existing instance
    // instead of doing nothing, so double-clicking a second shortcut while
    // the browser is already up still navigates it.
    if (initialUrl && _browserNavigate) _browserNavigate(initialUrl);
    return;
  }

  const mb   = document.getElementById('mb-browser');
  const body = document.getElementById('wb-browser');
  const ws   = document.getElementById('ws-browser');
  body.style.cssText = 'display:flex;flex-direction:column;padding:0;overflow:hidden;';

  let hist = [], histIdx = -1;

  // ── home page ──────────────────────────────────────────────────
  function buildHome() {
    const projectLinks = PROJECTS.map(p => {
      const safeUrl = JSON.stringify(p.file).replace(/</g, '\\u003c');
      const safeTitle = escHtml(p.name);
      return `<a class="lnk" href="#" data-nav-url="${escAttr(p.file)}" data-nav-title="${safeTitle}" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>${p.emoji} ${safeTitle}</a>`;
    }).join('');
    const favoriteLinks = browserFavorites
      .filter(fav => !DEFAULT_BROWSER_FAVORITE_URLS.has(fav.url.toLowerCase()))
      .map(fav => {
        const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
        const safeTitle = escHtml(fav.title || fav.url);
        return `<a class="lnk" href="#" data-nav-url="${escAttr(fav.url)}" data-nav-title="${safeTitle}" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>&#9734; ${safeTitle}</a>`;
      }).join('');
    const webLinks = DEFAULT_BROWSER_FAVORITES.map(fav => {
      const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
      const safeTitle = escHtml(fav.title);
      // iconMarkup emits <img class="os-icon">, but this document is an iframe
      // srcdoc with its own stylesheet - os/os.css never reaches it - so .lnk img
      // below is what sizes these, not the .os-icon rule. The relative src
      // resolves because a srcdoc document inherits its parent's base URL.
      return `<a class="lnk" href="#" data-nav-url="${escAttr(fav.url)}" data-nav-title="${safeTitle}" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>${iconMarkup(fav.homeIcon)}${safeTitle}</a>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff') format('woff');font-style:normal;font-weight:400;font-display:swap;}
@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff') format('woff');font-style:normal;font-weight:700;font-display:swap;}
:root{--sleep-font:'W95font',sans-serif;}
      body{margin:0;background:#c0c0c0;font-family: var(--sleep-font);font-size:12px;}
      h1{background:#000080;color:#fff;margin:0;padding:6px 12px;font-size:13px;}
      .sec{padding:6px 12px;}.sec h2{font-size:11px;margin:6px 0 4px;border-bottom:1px solid #808080;}
      .grid{display:flex;flex-wrap:wrap;gap:3px;}
      /* line-height matches the 16px icon so a chip carrying one is exactly as
         tall as a chip carrying only an emoji. Without it the Web row sits 1px
         taller than the Projects row above it. */
      .lnk{background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;
           padding:1px 7px;font-size:11px;line-height:16px;text-decoration:none;color:#000;
           display:inline-flex;align-items:center;gap:4px;}
      .lnk:hover{background:#000080;color:#fff;}
      /* The web-link art is native 16x16, so this is a 1:1 draw and pixelated
         keeps it exact. The star on project links is a text glyph, not an img,
         and is unaffected by this rule. */
      .lnk img{width:16px;height:16px;image-rendering:pixelated;flex-shrink:0;}
    </style></head><body>
    <h1>&#127760; sleepWEB &#8212; Start Page</h1>
    <div class="sec"><h2>sleepOS Projects</h2><div class="grid">${projectLinks}</div></div>
    <div class="sec"><h2>The Web</h2><div class="grid">${webLinks}${favoriteLinks}</div></div>
    <script>
    // A contextmenu event fired inside this document never reaches the
    // parent's own listeners - iframe content is a separate browsing context
    // and DOM events do not cross that boundary, same-origin or not. This is
    // the ONLY page the browser can ever build a link-aware menu for by
    // inspection, because it is the only content this iframe ever shows that
    // is same-origin with sleepOS itself (a srcdoc with allow-same-origin
    // inherits the parent's origin; every navigated-to site is a real
    // cross-origin document sleepOS cannot script into at all). So this
    // bridges the event out by hand instead of relying on bubbling.
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var link = e.target.closest ? e.target.closest('a[data-nav-url]') : null;
      window.parent.postMessage({
        type: 'browser-ctxmenu',
        x: e.clientX, y: e.clientY,
        isLink: !!link,
        linkUrl: link ? link.getAttribute('data-nav-url') : '',
        linkTitle: link ? link.getAttribute('data-nav-title') : ''
      }, '*');
    });
    </script>
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
  const _urlPoll = procSetInterval('browser', syncUrl, 600);

  iframe.addEventListener('load', () => {
    syncUrl();
    if (ws) ws.textContent = 'Done';
  });

  // Clear poll when browser window closes
  document.getElementById('win-browser')?.addEventListener('remove', () => clearInterval(_urlPoll), { once: true });
  // Use MutationObserver to detect window removal
  new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) { clearInterval(_urlPoll); _browserNavigate = null; obs.disconnect(); }
  }).observe(document.getElementById('desktop'), { childList: true });
  iframe.addEventListener('error', () => showError(lastAttemptedUrl));

  // ── handle nav / context-menu messages from srcdoc home page ────
  function onBrowserMsg(e) {
    if (!e.data || e.source !== iframe.contentWindow) return;
    if (e.data.type === 'browser-nav') { navigate(e.data.url); return; }
    if (e.data.type === 'browser-ctxmenu') {
      // The bridge only ever runs inside buildHome's own script, so this
      // message can only originate from the home page - isHome is always
      // true for the non-link branch here.
      const items = e.data.isLink
        ? buildLinkCtxItems(String(e.data.linkUrl || ''), String(e.data.linkTitle || ''))
        : buildPageCtxItems(true);
      const ir = iframe.getBoundingClientRect();
      showCtxMenu(ir.left + (Number(e.data.x) || 0), ir.top + (Number(e.data.y) || 0), items);
    }
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
  // urlArg/titleArg are optional so this still works as a bare click handler
  // (br-fav's listener passes the MouseEvent as the first argument, which is
  // not a string and falls through to currentUrl() below) - the context menu
  // uses the explicit form to favorite a LINK's target rather than the page
  // currently open.
  function addToFavorites(urlArg, titleArg) {
    const url = typeof urlArg === 'string' && urlArg ? urlArg : currentUrl();
    if (!url || url === 'home:') return;
    if (browserFavorites.some(fav => fav.url.toLowerCase() === url.toLowerCase())) {
      if (ws) ws.textContent = 'Site is already in Favorites.';
      return;
    }
    const defaultTitle = typeof titleArg === 'string' && titleArg
      ? titleArg
      : (url === currentUrl() ? document.getElementById('br-url').value : url);
    osPrompt('Save to Favorites as:', defaultTitle, 'Add to Favorites', title => {
      if (!title) return;
      browserFavorites.push({ title, url });
      saveFavorites();
      refreshHome();
      if (ws) ws.textContent = 'Added to Favorites.';
    }, 'icon:star');
  }

  document.getElementById('br-fav').addEventListener('click', addToFavorites);

  // ── copy / shortcut helpers used by the context menu ────────────
  // navigator.clipboard.writeText can reject - insecure context, permission
  // denied - and every other Copy action in this codebase (Explorer's Copy
  // Name/Path, the terminal's Copy) lets that failure vanish silently. This
  // one does not: a right-click Copy that looks like it worked but put
  // nothing on the clipboard is exactly the kind of lie sleepOS's own design
  // rules elsewhere (SYSMON's dashes for anything it cannot measure) forbid.
  function browserClipboardWrite(text, successMsg) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      osAlert('Clipboard access is not available.', 'Copy', 'icon:error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      if (ws) ws.textContent = successMsg || 'Copied to clipboard.';
    }, () => {
      osAlert('Could not copy to the clipboard.\nThe browser blocked clipboard access.', 'Copy', 'icon:error');
    });
  }

  // Writes DESKTOP\<title or hostname>.url. Collisions are uniquified with
  // fs-core's own _copy/_copy2 suffix (_uniqueNameIn) rather than prompted -
  // the same rule Explorer's own copy/paste already uses for a name clash, so
  // this does not invent a second convention for the same situation.
  async function saveUrlShortcut(url, titleHint) {
    if (!url || url === 'home:') return;
    const stem = sanitizeShortcutFileStem(titleHint) || sanitizeShortcutFileStem(hostnameFromUrl(url)) || 'Shortcut';
    const fileName = _uniqueNameIn('DESKTOP', stem + '.url');
    const content = '[InternetShortcut]\nURL=' + url + '\n';
    try {
      await vfsWriteFile(fileName, content, 'DESKTOP');
    } catch (err) {
      osAlert(err.code === 'ENOSPC' ? 'Not enough space to create this shortcut.' : err.message, 'Save as Shortcut', 'icon:error');
      return;
    }
    if (ws) ws.textContent = 'Shortcut saved to Desktop: ' + fileName;
  }

  // Shared by the View menu (line ~400 below) and the context menu, so there
  // is exactly one place that knows how to read an iframe's source - see the
  // task's honesty requirement: this throws for every cross-origin page (the
  // overwhelming majority of what gets loaded here) and that failure is
  // reported, never swallowed into a source view of nothing.
  function viewSource() {
    try {
      const src = iframe.contentDocument.documentElement.outerHTML;
      const w = window.open(''); w.document.write('<pre style="white-space:pre-wrap;font-size:12px;">' + src.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>');
    } catch(e) { osAlert('Cannot view source of cross-origin pages.', 'View Source', 'icon:error'); }
  }

  function clearAllFavorites() {
    if (!browserFavorites.length) return;
    osConfirm('Clear all favorites?', 'Confirm', ok => {
      if (!ok) return;
      browserFavorites.length = 0; saveFavorites(); refreshHome(); if (ws) ws.textContent = 'Favorites cleared.';
    }, 'icon:recycle-full');
  }

  // Menu for a right-click that landed on a link (home page only - see the
  // contextmenu bridge in buildHome above).
  function buildLinkCtxItems(url, title) {
    return [
      { label: 'Open Link in New Tab', action: () => window.open(url, '_blank') },
      { label: 'Copy Link Address', action: () => browserClipboardWrite(url, 'Link address copied.') },
      '-',
      { label: 'Save Link as Shortcut', action: () => saveUrlShortcut(url, title) },
      { label: 'Add to Favorites', icon: 'icon:star', action: () => addToFavorites(url, title) },
    ];
  }

  // Menu for a right-click that landed on the page itself, not a link.
  // isHome picks the home:-specific variant (no View Source/Save as Shortcut -
  // there is no external URL to save, and "source" is this generated page,
  // not a document worth showing the player).
  function buildPageCtxItems(isHome) {
    const items = [
      { label: 'Copy Page URL', action: () => browserClipboardWrite(document.getElementById('br-url').value, 'Page URL copied.') },
    ];
    if (isHome) {
      items.push('-');
      items.push({ label: 'Add to Favorites', icon: 'icon:star', action: () => addToFavorites() });
      items.push({ label: 'Clear All Favorites', icon: 'icon:recycle-full', action: clearAllFavorites });
      return items;
    }
    items.push({ label: 'View Source', action: viewSource });
    items.push('-');
    items.push({ label: 'Save as Shortcut', action: () => saveUrlShortcut(currentUrl(), hostnameFromUrl(currentUrl())) });
    items.push({ label: 'Add to Favorites', icon: 'icon:star', action: () => addToFavorites() });
    return items;
  }

  // ── browser body right-click ───────────────────────────────────
  // Back/Forward/Refresh/Home are one click away on the toolbar and are
  // deliberately left out here - see buildLinkCtxItems/buildPageCtxItems
  // above for the menu this actually shows.
  //
  // In practice this fires only for a right-click that lands on window
  // chrome the live page does not cover - the "site blocked embedding" error
  // overlay today, or any future gap - never on the rendered content itself.
  // A contextmenu event from inside the iframe (home page or a real site)
  // never bubbles out to this listener; the home page's own right-clicks
  // reach the browser only via the postMessage bridge in onBrowserMsg above,
  // and a cross-origin site's right-clicks cannot reach sleepOS at all -
  // that page's own native context menu shows instead, which nothing here
  // can override.
  body.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, buildPageCtxItems(currentUrl() === 'home:'));
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
    procSetTimeout('browser', () => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
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
      { label: 'View Source', action: viewSource },
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
      { label: 'Clear All Favorites', icon: 'icon:recycle-full', action: clearAllFavorites },
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

  _browserNavigate = navigate;
  navigate(initialUrl || 'home:');
}

// ─────────────────────────────────────────────────────────────────
// GLITCH EFFECT
// ─────────────────────────────────────────────────────────────────
