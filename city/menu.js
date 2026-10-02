// ===== the look shared by every menu (pause, shops, carrying, storage): W95 text on near-black, no boxes, a caret
// for the row you're on, sliders drawn as an ASCII density ramp. Injected once, used through the .menu class.
const MENU_FONT = 'https://raw.githubusercontent.com/Evelyn225/emergent-toys/main/';
const MENU_CSS = `
  @font-face { font-family: 'W95'; src: url('w95font.woff2') format('woff2'), url('w95font.woff') format('woff'),
    url('${MENU_FONT}w95font.woff2') format('woff2'); }
  .menu { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.72);
          font: 16px/1.4 'W95', monospace; color: rgba(255, 255, 255, 0.6); }
  .menu .panel { width: min(400px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box;
                 padding: 26px 30px; background: rgba(6, 6, 8, 0.94); scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent; }
  .menu h1 { margin: 0 0 2px; font: inherit; font-size: 32px; line-height: 1.1; color: #fff; letter-spacing: 1px; }
  .menu .sub { margin: 0 0 14px; color: rgba(255, 255, 255, 0.38); }
  .menu h2 { display: flex; align-items: center; gap: 10px; margin: 20px 0 6px; font: inherit; color: rgba(255, 255, 255, 0.32); }
  .menu h2::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.1); }
  .menu .hint { margin: 18px 0 0; color: rgba(255, 255, 255, 0.3); }
  .menu button, .menu a { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-decoration: none; }
  .menu .item { position: relative; display: flex; align-items: baseline; gap: 10px; width: 100%; box-sizing: border-box; padding: 2px 0 2px 18px; text-align: left; }
  .menu .item::before { content: '>'; position: absolute; left: 2px; opacity: 0; color: #fff; }
  .menu .item:hover, .menu .item:focus-visible { color: #fff; outline: none; }
  .menu .item:hover::before, .menu .item:focus-visible::before { opacity: 1; }
  .menu .item[disabled] { opacity: 0.3; cursor: default; }
  .menu .item[disabled]::before { opacity: 0; }
  .menu .k { min-width: 1.4em; text-align: right; color: rgba(255, 255, 255, 0.3); }
  .menu .lead { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; color: rgba(255, 255, 255, 0.14); }
  .menu .lead::before { content: '${'. '.repeat(60)}'; }
  .menu .v { color: rgba(255, 255, 255, 0.85); }
  .menu .row { display: grid; grid-template-columns: 8.5em 1fr 3.4em; align-items: baseline; gap: 12px; margin: 3px 0; padding-left: 18px; }
  .menu .row:hover > span:first-child, .menu .row:focus-within > span:first-child { color: #fff; }
  .menu .row > span:last-child { text-align: right; color: rgba(255, 255, 255, 0.85); }
  .menu .slider { position: relative; font: 15px/1 monospace; letter-spacing: 0; white-space: pre; }
  .menu .slider input { position: absolute; inset: -4px 0; width: 100%; height: calc(100% + 8px); margin: 0; opacity: 0; cursor: pointer; }
  .menu .slider:focus-within .bar, .menu .slider:hover .bar { filter: brightness(1.5); }
  .menu .opts { display: flex; gap: 14px; }
  .menu .opt { color: rgba(255, 255, 255, 0.35); }
  .menu .opt::before { content: '['; visibility: hidden; } .menu .opt::after { content: ']'; visibility: hidden; }
  .menu .opt.on { color: #fff; } .menu .opt.on::before, .menu .opt.on::after { visibility: visible; }
  .menu .opt:hover, .menu .opt:focus-visible, .menu .tog:hover, .menu .tog:focus-visible { color: #fff; outline: none; }
  .menu .tog { justify-self: start; font: 14px/1 monospace; color: rgba(255, 255, 255, 0.6); }
  .menu .keys { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 1px 12px; padding-left: 18px; color: rgba(255, 255, 255, 0.38); }
  .menu .keys b { font-weight: normal; color: rgba(255, 255, 255, 0.85); }`;
let menuStyled = false;
function menuEl(id, z, html) { // a hidden full-screen menu layer; the stylesheet goes in with the first one
  if (!menuStyled) { const s = document.createElement('style'); s.textContent = MENU_CSS; document.head.appendChild(s); menuStyled = true; }
  const el = document.createElement('div');
  el.id = id; el.className = 'menu'; el.style.zIndex = z; el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
// a slider's bar: solid blocks up to the value, brightening from dim grey to white along the bar, then a faint
// shaded track for the rest
const BAR_N = 26;
function asciiBar(f) {
  const n = Math.round(clamp(f, 0, 1) * BAR_N);
  let s = '';
  for (let i = 0; i < BAR_N; i++) s += i < n ? `<span style="color:rgba(255,255,255,${(0.3 + 0.7 * i / (BAR_N - 1)).toFixed(2)})">█</span>`
                                              : '<span style="color:rgba(255,255,255,0.14)">░</span>';
  return s;
}
