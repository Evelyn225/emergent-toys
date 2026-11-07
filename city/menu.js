// Shared pixel-font menus: readable ink, ruled sections and a clear active row.
// Sliders retain their ASCII density ramp. Injected once through the .menu class.
const MENU_CSS = `
  @font-face { font-family: 'W95'; src: url('w95font.woff2') format('woff2'), url('w95font.woff') format('woff'); }
  .menu { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.72);
          font: 16px/1.4 'W95', monospace; color: #d9dfda; }
  .menu .panel { width: min(400px, calc(100vw - 32px)); max-height: calc(100vh - 32px); max-height:calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box;
                 padding: 26px 30px; background: #13191b; border:1px solid #465452; border-top:3px solid #a9d9ca; box-shadow:0 16px 56px #0008; scrollbar-width: thin; scrollbar-color:#63716d #13191b; }
  .menu h1 { margin: 0 0 2px; font: inherit; font-size: 32px; line-height: 1.1; color: #fff; letter-spacing: 1px; }
  .menu .sub { margin: 0 0 14px; color: #a1ada8; }
  .menu h2 { display: flex; align-items: center; gap: 10px; margin: 20px 0 6px; font: inherit; color: #a9d9ca; letter-spacing:1px; }
  .menu h2::after { content: ''; flex: 1; height: 1px; background: #35423f; }
  .menu .hint { margin: 18px 0 0; color: #a1ada8; }
  .menu button, .menu a { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-decoration: none; }
  .menu .item { position: relative; display: flex; align-items: baseline; gap: 10px; width: 100%; box-sizing: border-box; padding: 7px 6px 7px 22px; min-height:36px; text-align: left; }
  .menu .item::before { content: '>'; position: absolute; left: 2px; opacity: 0; color: #fff; }
  .menu .item:hover, .menu .item:focus-visible { color:#f5f3e8; background:#253732; outline:none; }
  .menu .item:focus-visible { box-shadow:inset 2px 0 #b9e7d5; }
  .menu .item:hover::before, .menu .item:focus-visible::before { opacity: 1; }
  .menu .item[disabled] { opacity:1; color:#8c9993; cursor:default; background:transparent; }
  .menu .item[disabled] .v { color:#8c9993; }
  .menu .item[disabled] img { opacity:.45; }
  .menu .item[disabled]::before { opacity: 0; }
  .menu .k { min-width: 1.4em; text-align: right; color: #a1ada8; }
  .menu .lead { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; color: rgba(255, 255, 255, 0.14); }
  .menu .lead::before { content: '${'. '.repeat(60)}'; }
  .menu .v { color:#edf0df; }
  .menu .row { display: grid; grid-template-columns: 8.5em 1fr 3.4em; align-items: baseline; gap: 12px; margin:7px 0; min-height:28px; padding-left: 18px; }
  .menu .row:hover > span:first-child, .menu .row:focus-within > span:first-child { color: #fff; }
  .menu .row > span:last-child { text-align: right; color:#edf0df; }
  .menu .slider { position: relative; font: 15px/1 monospace; letter-spacing: 0; white-space: pre; }
  .menu .slider input { position: absolute; inset: -4px 0; width: 100%; height: calc(100% + 8px); margin: 0; opacity: 0; cursor: pointer; }
  .menu .slider:focus-within .bar, .menu .slider:hover .bar { filter: brightness(1.5); }
  .menu .opts { display: flex; gap: 14px; }
  .menu .opt { color:#a1ada8; }
  .menu .opt::before { content: '['; visibility: hidden; } .menu .opt::after { content: ']'; visibility: hidden; }
  .menu .opt.on { color:#c3ecdb; background:#253732; } .menu .opt.on::before, .menu .opt.on::after { visibility: visible; }
  .menu .opt:hover, .menu .opt:focus-visible, .menu .tog:hover, .menu .tog:focus-visible { color:#f5f3e8; outline:1px solid #a9d9ca; outline-offset:2px; }
  .menu .tog { justify-self: start; font: 14px/1 monospace; color: #d9dfda; }
  .menu .keys { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 1px 12px; padding-left: 18px; color: #a1ada8; }
  .menu .keys b { font-weight: normal; color:#edf0df; }
  .menu .panel-heading{position:sticky;top:-26px;z-index:2;display:flex;align-items:center;gap:12px;justify-content:space-between;margin:-26px -30px 14px;padding:20px 18px 12px 30px;background:#13191b;border-bottom:1px solid #35423f;}
  .menu .panel-heading h1{flex:1;min-width:0;margin:0;overflow-wrap:anywhere;}
  .menu .panel-close{flex:0 0 44px;width:44px;height:44px;font-size:24px;color:#d9dfda;border:1px solid #64756e;background:#1d2925;}
  .menu .panel-close:hover,.menu .panel-close:focus-visible{background:#30483e;outline:2px solid #b9e7d5;outline-offset:2px;}
  #cooking .recipe-label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;}
  #cooking .recipe-name{font-size:16px;}
  #cooking .recipe-needs{font-size:14px;line-height:1.5;white-space:normal;overflow-wrap:anywhere;}
  #cooking .available{color:#bdddc3;}#cooking .missing{color:#adb7b0;}
  #courier-board .item,#busted .item{display:grid;grid-template-columns:1.4em minmax(0,1fr);align-items:start;gap:4px 10px;}
  #courier-board .item .k,#busted .item .k{grid-row:1/span 2;}
  #courier-board .item .lead,#busted .item .lead{display:none;}
  #courier-board .item .v,#busted .item .v{grid-column:2;font-size:14px;white-space:normal;overflow-wrap:anywhere;color:#cad7cd;}
  .menu .panel { overflow-x: hidden; }
  .menu .slider { min-width: 0; overflow: hidden; }
  @media (max-width: 520px), (pointer: coarse) { /* touch or narrow screens: scroll down, never sideways */
    .menu .panel { padding: 20px 16px; }
    .menu .panel-heading{top:-20px;margin:-20px -16px 14px;padding:16px 12px 12px 16px;}
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
    #controls .controls-panel { width:min(960px,calc(100vw - 32px)); padding:32px; background:#13191b; border:1px solid #465452;border-top:3px solid #a9d9ca; border-radius:0; box-shadow:0 24px 80px #0009; }
    #controls .controls-header { position:sticky;top:0;z-index:2;background:#13191b;padding-bottom:12px;display:flex; justify-content:space-between; gap:24px; align-items:center; }
    #controls .controls-eyebrow { font-size:10px; letter-spacing:2px; color:#8ebbb0; margin:0 0 12px; }
    #controls h1 { font-size:30px; margin:0; color:#f0f5f2; }
    #controls .controls-intro { color:#a2afad; margin:10px 0 0; font-size:15px; }
    #controls .controls-back { width:auto; gap:16px; font-size:14px;min-height:44px; padding:10px 12px; border:1px solid #465654; border-radius:0; }
    #controls .controls-tabs { display:flex; flex-wrap:wrap; gap:8px; padding:24px 0; border-bottom:1px solid #33403f; }
    #controls .controls-tabs button { font:inherit; font-size:14px;min-height:44px; padding:10px 14px; border:1px solid #3e4c49; border-radius:0; background:transparent; color:#afbfbb; cursor:pointer; }
    #controls .controls-tabs button[aria-pressed=true] { background:#b8d9ca; color:#14231c; border-color:#b8d9ca; }
    #controls button:focus-visible { outline:2px solid #d1f5df; outline-offset:4px; }
    #controls h2 { margin:24px 0 14px; padding:0; text-transform:none; font-size:16px; color:#e3eee9; }
    #controls .keys { display:flex; flex-direction:column; gap:0; padding:0; }
    #controls .control-binding { display:grid; grid-template-columns:minmax(150px, .8fr) 2fr; gap:24px; padding:15px 0; border-bottom:1px solid #273331; align-items:start; font-size:15px; line-height:1.6; }
    #controls .control-binding b { color:#dcebe4; background:#1d2927; border:1px solid #3c4b46; border-bottom-width:3px; border-radius:0; padding:5px 10px; line-height:1.5; font-size:14px; width:fit-content; }
    #controls .control-binding span { color:#b1bdb8; }
    #controls .controls-footer { margin-top:24px; font-size:13px; color:#81918a; }
    #controls .controls-back-short{display:none;}
    #controls [hidden] { display:none !important; }
    @media(max-width:600px) {
      #controls .controls-panel { padding:20px 16px; }
      #controls .controls-header{align-items:center;gap:12px;}#controls .controls-header>div{min-width:0;}#controls h1{font-size:26px;}#controls .controls-intro,#controls .controls-eyebrow,#controls .controls-back-long,#controls .controls-back .k{display:none;}#controls .controls-back-short{display:inline;}
      #controls .control-binding { grid-template-columns:1fr; gap:8px; }
      #controls .controls-tabs{gap:6px;flex-wrap:nowrap;overflow-x:auto;padding:16px 0;}#controls .controls-tabs button{flex:0 0 auto;white-space:nowrap;}
      #controls .controls-tabs button { padding:9px; }
    }
  `;
  document.head.appendChild(style);
}
