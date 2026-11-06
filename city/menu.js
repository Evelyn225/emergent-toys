// ===== the look shared by every menu (pause, shops, carrying, storage): W95 text on near-black, no boxes, a caret
// for the row you're on, sliders drawn as an ASCII density ramp. Injected once, used through the .menu class.
const MENU_CSS = `
  @font-face { font-family: 'W95'; src: url('w95font.woff2') format('woff2'), url('w95font.woff') format('woff'); }
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
  .menu .keys b { font-weight: normal; color: rgba(255, 255, 255, 0.85); }
  .menu .panel { overflow-x: hidden; }
  .menu .slider { min-width: 0; overflow: hidden; }
  @media (max-width: 520px), (pointer: coarse) { /* touch or narrow screens: scroll down, never sideways */
    .menu .panel { padding: 20px 16px; }
    .menu .item { min-height: 44px; align-items: center; }
    .menu .item > span:not(.k):not(.v):not(.lead) { min-width: 0; overflow-wrap: anywhere; }
    .menu .k, .menu .v { flex-shrink: 0; }
    .menu .row { grid-template-columns: 1fr auto; grid-template-areas: 'l v' 'c c'; gap: 2px 12px; margin: 6px 0; }
    .menu .row > :nth-child(1) { grid-area: l; } .menu .row > :nth-child(2) { grid-area: c; } .menu .row > :nth-child(3) { grid-area: v; }
    .menu .slider { font-size: 12px; padding: 4px 0; }
    .menu .opts { flex-wrap: wrap; }
    .menu .keys { grid-template-columns: auto 1fr; }
  }`;
let menuStyled = false;
function menuStyle() { // the stylesheet goes in once, with the first menu (or the touch buttons, for the font)
  if (!menuStyled) { const s = document.createElement('style'); s.textContent = MENU_CSS; document.head.appendChild(s); menuStyled = true; }
}
function menuEl(id, z, html) { // a hidden full-screen menu layer
  menuStyle();
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

// Controls reference: quiet typography, explicit bindings and generous spacing.
{
  const style = document.createElement('style');
  style.textContent = `
    #controls .controls-panel { width:min(960px,calc(100vw - 32px)); padding:32px; background:#111719; border:1px solid #364344; border-radius:12px; box-shadow:0 24px 80px #0009; }
    #controls .controls-header { display:flex; justify-content:space-between; gap:24px; align-items:center; }
    #controls .controls-eyebrow { font-size:10px; letter-spacing:2px; color:#8ebbb0; margin:0 0 12px; }
    #controls h1 { font-size:30px; margin:0; color:#f0f5f2; }
    #controls .controls-intro { color:#a2afad; margin:10px 0 0; font-size:13px; }
    #controls .controls-back { width:auto; gap:16px; font-size:12px; padding:10px 12px; border:1px solid #465654; border-radius:5px; }
    #controls .controls-tabs { display:flex; flex-wrap:wrap; gap:8px; padding:24px 0; border-bottom:1px solid #33403f; }
    #controls .controls-tabs button { font:inherit; font-size:12px; padding:10px 14px; border:1px solid #3e4c49; border-radius:5px; background:transparent; color:#afbfbb; cursor:pointer; }
    #controls .controls-tabs button[aria-pressed=true] { background:#b8d9ca; color:#14231c; border-color:#b8d9ca; }
    #controls button:focus-visible { outline:2px solid #d1f5df; outline-offset:4px; }
    #controls h2 { margin:24px 0 14px; padding:0; text-transform:none; font-size:16px; color:#e3eee9; }
    #controls .keys { display:flex; flex-direction:column; gap:0; padding:0; }
    #controls .control-binding { display:grid; grid-template-columns:minmax(150px, .8fr) 2fr; gap:24px; padding:15px 0; border-bottom:1px solid #273331; align-items:start; font-size:13px; line-height:1.7; }
    #controls .control-binding b { color:#dcebe4; background:#1d2927; border:1px solid #3c4b46; border-bottom-width:3px; border-radius:5px; padding:5px 10px; line-height:1.5; font-size:12px; width:fit-content; }
    #controls .control-binding span { color:#b1bdb8; }
    #controls .controls-footer { margin-top:24px; font-size:11px; color:#81918a; }
    #controls [hidden] { display:none !important; }
    @media(max-width:600px) {
      #controls .controls-panel { padding:20px 16px; }
      #controls .controls-header { align-items:start; flex-direction:column; gap:16px; }
      #controls .control-binding { grid-template-columns:1fr; gap:8px; }
      #controls .controls-tabs { gap:6px; }
      #controls .controls-tabs button { padding:9px; }
    }
  `;
  document.head.appendChild(style);
}
