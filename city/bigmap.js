// Full map and city directory. M opens it directly; Pause can open it without changing the return destination.
let bigMapEl = null, bigMapCv = null, bigMapSheet = null;
const BIGMAP = { cx: 0, cy: 0, z: 4, pts: new Map(), pinch: null, keys: {}, found: null, hits: [], hitK: -1,
  category:'all',query:'',selected:null,places:[],limit:30,points:[],returnPaused:false,tap:null };
const BIGMAP_Z = 48; // most px per cell: a shop front across the screen. The least: the whole city just fills the screen
function bigMapViewport() {
  const W=bigMapCv.clientWidth,H=bigMapCv.clientHeight,visible=!bigMapEl.querySelector('.directory').hidden;
  if(!visible)return {x:0,y:0,w:W,h:H};
  if(W>700)return {x:332,y:110,w:W-344,h:H-140};
  return {x:12,y:110,w:W-24,h:Math.max(80,H*.58-134)};
}
const bigMapMinZ = () => {const v=bigMapViewport();return Math.min(v.w/MAP_WORLD.width,v.h/MAP_WORLD.height)*.9;};
const BIGMAP_CSS = `
  #bigmap { background: #080b10; color:#d3d8df; }
  #bigmap canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; touch-action: none; }
  #bigmap canvas.drag { cursor: grabbing; }
  #bigmap .bar { position: absolute; z-index: 2; top: calc(12px + env(safe-area-inset-top)); left:332px; right:12px; max-width:520px; display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:6px; }
  #bigmap .bar button { flex: 0 0 auto; min-width: 38px; height: 38px; padding: 0 10px; background: rgba(6, 6, 8, 0.94); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; }
  #bigmap .tools { grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap; }
  #bigmap .bar button:hover { border-color: #fff; }
  #bigmap .bar input { min-width: 0; width:100%; box-sizing:border-box;height: 38px; padding: 0 10px; background: rgba(6, 6, 8, 0.94); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; font: inherit; outline: none; }
  #bigmap .bar input:focus { border-color: #fff; }
  #bigmap .tip { position:absolute;z-index:2;right:12px;bottom:10px;max-width:calc(100% - 350px);text-align:right;color:#a7b2bf;background:#080b10dd;padding:8px 10px;pointer-events:none;font-size:12px; }
  #bigmap .directory {position:absolute;z-index:2;left:12px;top:12px;bottom:12px;width:304px;box-sizing:border-box;display:flex;flex-direction:column;padding:18px;background:rgba(9,12,17,.97);border:1px solid #35404a; }
  #bigmap .directory[hidden] {display:none;}
  #bigmap .directory h1 {font-size:26px;letter-spacing:1px;color:#f1f3ec;line-height:1;margin:0 0 6px;}
  #bigmap .directory .subtitle {font-size:12px;letter-spacing:2px;color:#84c9c7;margin-bottom:16px;}
  #bigmap .route-status {padding:9px 0;border-top:1px solid #344b50;border-bottom:1px solid #344b50;display:flex;gap:8px;align-items:center;margin:6px 0 10px;font-size:12px;color:#a9e4df;}
  #bigmap .route-status[hidden] {display:none;}
  #bigmap .route-status span {flex:1;min-width:0;overflow-wrap:anywhere;}
  #bigmap .route-status button {padding:6px;border:1px solid #40545d;color:#b6c5ca;}
  #bigmap .filters {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;}
  #bigmap .filters button {text-align:left;padding:6px 8px;border:1px solid #28313b;font-size:13px;}
  #bigmap .filters [aria-pressed="true"] {background:#163437;border-color:#7bc5c3;color:#c4ffff;}
  #bigmap .results-count {font-size:12px;color:#8694a2;margin:12px 0 8px;}
  #bigmap .places {overflow:auto;min-height:0;flex:1;scrollbar-width:thin;}
  #bigmap .place-row {display:flex;width:100%;gap:8px;align-items:center;text-align:left;padding:10px 2px;border-bottom:1px solid #202730;box-sizing:border-box;}
  #bigmap .place-row>span:first-child {min-width:0;flex:1;}
  #bigmap .place-row b {font-weight:normal;display:block;overflow-wrap:anywhere;}
  #bigmap .place-row small {display:block;color:#8c98a5;font-size:12px;}
  #bigmap .place-row.selected {background:#183137;}
  #bigmap .distance {font-size:12px;color:#b5c0cb;white-space:nowrap;}
  #bigmap .empty {color:#9ba5b0;font-size:13px;}
  #bigmap .more-places {padding:12px 0;color:#9bdbd8;}
  #bigmap .place-detail {border-bottom:1px solid #46535f;padding:8px 0 14px;margin-bottom:4px;flex:0 1 auto;overflow:auto;}
  #bigmap .place-detail[hidden] {display:none;}
  #bigmap .detail-head {display:flex;align-items:center;justify-content:space-between;color:#8fbbbd;font-size:12px;}
  #bigmap .detail-head button {padding:0 6px;font-size:24px;color:#fff;}
  #bigmap .place-detail h2 {display:block;color:#f1f2e7;font-size:20px;margin:4px 0 8px;line-height:1.15;}
  #bigmap .place-detail h2::after {display:none;}
  #bigmap .place-detail p {font-size:13px;line-height:1.35;margin:6px 0;color:#adb7c2;}
  #bigmap .place-status {color:#b8d2b6!important;}
  #bigmap .detail-actions {display:grid;gap:6px;margin-top:12px;}
  #bigmap .detail-actions button {text-align:left;padding:8px;border:1px solid #58676f;color:#b3eeeb;font-size:13px;}
  #bigmap .detail-actions button:disabled {opacity:.4;cursor:default;}
  #bigmap button:focus-visible {outline:2px solid #93ece4;outline-offset:2px;}
  @media(max-width:700px) {
    #bigmap .bar {left:12px;max-width:none;}
    #bigmap .directory {top:auto;bottom:12px;left:12px;right:12px;width:auto;height:42vh;max-height:380px;padding:12px;}
    #bigmap .directory h1 {font-size:21px;}
    #bigmap .directory .subtitle {display:none;}
    #bigmap .filters {grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;margin-top:8px;}
    #bigmap .filters button {font-size:11px;padding:6px 3px;}
    #bigmap .has-selection .filters,#bigmap .has-selection .places,#bigmap .has-selection .results-count {display:none;}
    #bigmap .place-detail {min-height:0;margin:6px 0 0;border:0;}
    #bigmap .tip {bottom:calc(42vh + 24px);max-width:calc(100% - 24px);font-size:10px;}
    #bigmap .directory[hidden]~.tip {bottom:12px;}
  }`;

// the city drawn once, a pixel a cell, then scaled up crisp
function bigMapRender() {
  const c = bigMapSheet || (bigMapSheet = document.createElement('canvas'));
  c.width = MAP_WORLD.width;c.height=MAP_WORLD.height;
  const x = c.getContext('2d');
  for (let my = 0; my < MAP_WORLD.height; my++) for (let mx = 0; mx < MAP_WORLD.width; mx++) { x.fillStyle = mapTile(mx, my); x.fillRect(mx, my, 1, 1); }
}
// what's named on the map: [x, y, text, colour, kind]. kind: 'area' (always), 'place' (always), 'shop' (zoomed in)
function bigMapLabels() {
  const out = [];
  const areaSeeds = [...DIST_SEEDS].sort((a,b) => Number(b[2] === 'shotengai') - Number(a[2] === 'shotengai'));
  for (const sd of areaSeeds) { const [sx] = sd, d = seedName(sd), sy = d === 'industrial' ? (sd[1] > (SHORE_N + SHORE_S) / 2 ? SHORE_S - 0.4 : SHORE_N + 1.4) : sd[1]; out.push([sx * 8, sy * 8, (DISTRICT_TITLE[d] || d).replace(/^the /, 'The '), 'rgba(255,255,255,0.55)', 'area']); }
  const place = (x, y, t) => out.push([x, y, t, '#fd8', 'place']);
  if(worldReady)for(const island of WILD_ISLANDS)out.push([island.x,island.y,island.name,'#a6d5a1','area']);
  if(worldReady){place(FERN_STRIP.x0+10,FERN_STRIP.y,'Fern airstrip');place(...WILD_ISLANDS[0].landing,'Fern boat landing');place(...FERN_HOUSE.door,'Fern House');place(627,197,'Fern Falls');}
  place(GRAND_HOTEL.bx * 8 + 5, GRAND_HOTEL.by * 8 + 5, 'Grand Hotel');
  place(MARINA.x, MARINA.y0 + 2, 'Marina'); place(FAIR.cx, FAIR.y0 + 3, 'Sunset Pier'); place(FISH_HUT.x - 1, FISH_HUT.y - 1, 'Bait & Tackle'); place(WHEEL.x, WHEEL.y - 1.5, 'Ferris wheel');
  place(...COURIER_DEPOT.roof,COURIER_COMPANY);
  place(LIGHTHOUSE.x, LIGHTHOUSE.y - 2, 'Lighthouse'); place((AIRPORT.x0 + AIRPORT.x1) / 2, RUNWAY.y + 0.5, 'Airport'); place(GARDEN.x0 + 12, GARDEN.y0 + 10, 'Botanical Gardens');
  const LM = { cathedral: 'Cathedral', clock: 'Clock tower', screens: 'Big screens', radio: 'Radio tower' };
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { const lm = landmarkOf.get(bi(bx, by)); if (lm) place(bx * 8 + 5, by * 8 + 5, LM[lm] || lm); }
  for (const s of SERVICES) place(s.x, s.y - 0.8, { police: 'Police', fire: 'Fire station', amb: 'Hospital' }[s.kind] || s.kind);
  for (const s of stations) out.push([s.x, s.y - 0.8, s.name, '#6f6', 'place']);
  for (const s of EL_STATIONS) out.push([s.x, EL_Y - 0.4, s.name, '#f96', 'place']);
  const seen = new Set();
  for (let k = 0; k < N * N; k++) {
    const sh = SHOP[k]; if (!sh || !sh.word || sh.kind === SHOP_APTS || seen.has(sh)) continue;
    seen.add(sh); out.push([k % N + 0.5, Math.floor(k / N) + 0.5, sh.word, '#ccd', 'shop']);
  }
  return out;
}
let bigMapNames = null;

function bigMapDraw() {
  if (!bigMapOpen()) return;
  const cv_ = bigMapCv, dpr = devicePixelRatio || 1, W = cv_.clientWidth, H = cv_.clientHeight;
  if (cv_.width !== Math.round(W * dpr) || cv_.height !== Math.round(H * dpr)) { cv_.width = Math.round(W * dpr); cv_.height = Math.round(H * dpr); }
  BIGMAP.z = clamp(BIGMAP.z, bigMapMinZ(), BIGMAP_Z); // (the window may have changed)
  const x = cv_.getContext('2d'), z = BIGMAP.z, now = performance.now() / 1000; // (T is frozen under the pause menu)
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  // world (wx, wy) -> screen, taking the copy of the (wrapping) city nearest the middle of the view
  const sx = wx => W / 2 + mapDifference(wx - BIGMAP.cx,MAP_WORLD.width) * z, sy = wy => H / 2 + mapDifference(wy - BIGMAP.cy,MAP_WORLD.height) * z;
  const ox = W / 2 - BIGMAP.cx * z, oy = H / 2 - BIGMAP.cy * z, SW = MAP_WORLD.width*z,SH=MAP_WORLD.height*z;
  if(MAP_WORLD.wrap) {
    for (let tx = Math.floor(-ox / SW) - 1; tx * SW + ox < W; tx++) for (let ty = Math.floor(-oy / SH) - 1; ty * SH + oy < H; ty++)
      x.drawImage(bigMapSheet, ox + tx * SW, oy + ty * SH, SW, SH);
  } else x.drawImage(bigMapSheet,ox,oy,SW,SH);
  if(MAP_NAV.path?.length) {
    x.strokeStyle='#87e6df';x.lineWidth=3;x.setLineDash([6,4]);x.lineDashOffset=-now*10;x.beginPath();
    let previous=null;
    for(const p of MAP_NAV.path.slice(MAP_NAV.next)) {
      const X=sx(p.x),Y=sy(p.y);
      if(!previous||Math.abs(X-previous[0])>z*2||Math.abs(Y-previous[1])>z*2)x.moveTo(X,Y);else x.lineTo(X,Y);
      previous=[X,Y];
    }
    x.stroke();x.setLineDash([]);
  }
  if (z >= 10) { // the street grid gets block lines once there's room
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
    for (let gx = Math.floor((BIGMAP.cx - W / 2 / z) / 8) * 8; gx < BIGMAP.cx + W / 2 / z; gx += 8) { const p = W / 2 + (gx - BIGMAP.cx) * z; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, H); x.stroke(); }
    for (let gy = Math.floor((BIGMAP.cy - H / 2 / z) / 8) * 8; gy < BIGMAP.cy + H / 2 / z; gy += 8) { const p = H / 2 + (gy - BIGMAP.cy) * z; x.beginPath(); x.moveTo(0, p); x.lineTo(W, p); x.stroke(); }
  }
  const onScreen = (X, Y, m = 40) => X > -m && Y > -m && X < W + m && Y < H + m;
  const dot = (wx, wy, ch, col, size = 12) => {
    const X = sx(wx), Y = sy(wy); if (!onScreen(X, Y)) return;
    x.font = `bold ${size}px monospace`; const w = x.measureText(ch).width + 4;
    x.fillStyle = 'rgba(0,0,0,0.8)'; x.fillRect(X - w / 2, Y - size / 2 - 1, w, size + 2);
    x.fillStyle = col; x.fillText(ch, X, Y + 1);
  };
  x.textAlign = 'center'; x.textBaseline = 'middle';
  // names: biggest first, and nothing drawn over something already written
  const taken = [];
  const label = (wx, wy, t, col, size, bold, force=false) => {
    const X = sx(wx), Y = sy(wy); if (!onScreen(X, Y, 120)) return;
    x.font = `${bold ? 'bold ' : ''}${size}px monospace`;
    const w = x.measureText(t).width, r = [X - w / 2 - 3, Y - size / 2 - 2, X + w / 2 + 3, Y + size / 2 + 2];
    if (!force&&taken.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return;
    taken.push(r);
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    x.fillStyle = col; x.fillText(t, X, Y + 1);
  };
  const delivery=courierRoute();
  if(delivery) {
    dot(delivery.recipient.x,delivery.recipient.y,'!', '#6f9',18);
    label(delivery.recipient.x,delivery.recipient.y-.8,'ROOF GARDEN','#6f9',14,true);
  }
  // you, and what's yours, go on first so nothing hides them
  const ang = me ? Math.atan2(me.hy, me.hx) : a,player=mapPlayerLocation();
  const youX = sx(player.x), youY = sy(player.y);
  if (onScreen(youX, youY)) {
    x.save(); x.translate(youX, youY); x.rotate(ang);
    x.fillStyle = fract(T * 2) < 0.5 ? '#ff5' : '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(9, 0); x.lineTo(-6, -6); x.lineTo(-3, 0); x.lineTo(-6, 6); x.closePath(); x.stroke(); x.fill(); x.restore();
    taken.push([youX - 10, youY - 10, youX + 10, youY + 10]);
  }
  for (const h of owned.homes) { // your homes: a pulsing ring and a tag, loud enough to spot from the whole-city view
    const hx = h.cell % N + 0.5, hy = Math.floor(h.cell / N) + 0.5, X = sx(hx), Y = sy(hy);
    if (!onScreen(X, Y)) continue;
    x.strokeStyle = '#ff4'; x.lineWidth = 2;
    for (const k of [0, 0.5]) { const f = fract(now * 0.6 + k); x.globalAlpha = 1 - f; x.beginPath(); x.arc(X, Y, 8 + f * 18, 0, Math.PI * 2); x.stroke(); }
    x.globalAlpha = 1;
    dot(hx, hy, 'HOME', '#ff4', 18);
    x.strokeStyle = '#ff4'; x.strokeRect(X - 27, Y - 12, 54, 24);
    taken.push([X - 26, Y - 14, X + 26, Y + 14]);
  }
  for (const c of owned.cars) if (c !== me) dot(c.x, c.y, 'C', '#fff');
  for (const b of fleet) if (b.deal === 'mine' && b !== sea) dot(b.x, b.y, 'B', '#fff');
  const tt = taskTarget(); if (tt) dot(tt.x, tt.y, '?', '#4ff');
  const jt = jobTarget(); if (jt) dot(jt.x, jt.y, '!', '#ff0');
  if (me && me.dest) dot(me.dest[0], me.dest[1], 'X', '#f4f');
  for (const c of cars) if (c.pursuit) dot(c.x, c.y, 'P', fract(T * 3) < 0.5 ? '#f44' : '#48f', 10);
  BIGMAP.points=[];
  const visible=mapFilteredPlaces();
  for(const p of visible) {
    if(p.x===null||p.virtual||p.category==='area'||p.kind==='shop'&&z<10&&p.id!==BIGMAP.selected)continue;
    const X=sx(p.x),Y=sy(p.y);if(!onScreen(X,Y))continue;
    BIGMAP.points.push({id:p.id,x:X,y:Y});
    const selected=p.id===BIGMAP.selected;
    x.fillStyle=p.color;x.strokeStyle='#080b10';x.lineWidth=2;x.beginPath();x.arc(X,Y,selected?7:4,0,Math.PI*2);x.fill();x.stroke();
    if(selected||p.category==='contacts')label(p.x,p.y-1.8,p.name,p.color,13,true,selected);
  }
  if(mapWaypoint) {
    dot(mapWaypoint.x,mapWaypoint.y,'X','#8de5df',18);
    if(mapWaypoint.id!==BIGMAP.selected)label(mapWaypoint.x,mapWaypoint.y-1.8,mapWaypoint.name,'#8de5df',13,true,true);
  }
  const f = BIGMAP.found;
  if (f && now - f.t < 6 && onScreen(sx(f.x), sy(f.y))) {
    x.strokeStyle = '#4ff'; x.lineWidth = 2; x.globalAlpha = 1 - (now - f.t) / 6;
    x.beginPath(); x.arc(sx(f.x), sy(f.y), 14 + 6 * Math.sin(now * 6), 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
  }
  const big = clamp(z * 1.4, 12, 22), mid = clamp(z * 1.1, 10, 14), small = clamp(z * 0.55, 9, 13);
  for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'area') label(lx, ly, z < 7 ? t.toUpperCase() : t, col, big, true);
  for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'place' && z >= 6) label(lx, ly, t, col, mid, false);
  if (z >= 14) for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'shop') label(lx, ly, t, col, small, false);
  x.font='12px monospace';x.fillStyle='#a6babf';x.textAlign='right';x.fillText('N ↑',W-18,128);
  const scale=100; x.strokeStyle='#a6babf';x.lineWidth=1;x.beginPath();x.moveTo(W-18-scale,148);x.lineTo(W-18,148);x.stroke();x.fillText(mapMetres(scale/z*10),W-18,163);
  bigMapEl.querySelector('.tip').textContent=mapWaypoint?`${mapWaypoint.name} · ${mapMetres(mapRouteDistance())} · ${mapRouteLabel()}`:TOUCH?'Tap places or drop a pin · drag / pinch to explore':'Click a place or drop a pin · / search · F city · M / Esc close';
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
}

function bigMapZoom(f, X, Y) { // zoom by f about screen point (X, Y): the spot under it stays put
  const W = bigMapCv.clientWidth, H = bigMapCv.clientHeight, z0 = BIGMAP.z, z1 = clamp(z0 * f, bigMapMinZ(), BIGMAP_Z);
  if (X === undefined) { X = W / 2; Y = H / 2; }
  BIGMAP.cx = mapCoordinate(BIGMAP.cx + (X - W / 2) * (1 / z0 - 1 / z1),MAP_WORLD.width); BIGMAP.cy = mapCoordinate(BIGMAP.cy + (Y - H / 2) * (1 / z0 - 1 / z1),MAP_WORLD.height);
  BIGMAP.z = z1;
}
function bigMapPan(dx, dy) { BIGMAP.cx = mapCoordinate(BIGMAP.cx - dx / BIGMAP.z,MAP_WORLD.width); BIGMAP.cy = mapCoordinate(BIGMAP.cy - dy / BIGMAP.z,MAP_WORLD.height); }
function bigMapCentre() { const p=mapPlayerLocation();BIGMAP.cx = p.x; BIGMAP.cy = p.y; }
function bigMapFit() {
  const v=bigMapViewport();BIGMAP.z=bigMapMinZ();
  BIGMAP.cx=MAP_WORLD.width/2-(v.x+v.w/2-bigMapCv.clientWidth/2)/BIGMAP.z;
  BIGMAP.cy=MAP_WORLD.height/2-(v.y+v.h/2-bigMapCv.clientHeight/2)/BIGMAP.z;
}
function bigMapPick(X,Y) {
  const hit=BIGMAP.points.filter(p=>Math.hypot(p.x-X,p.y-Y)<14).sort((a,b)=>Math.hypot(a.x-X,a.y-Y)-Math.hypot(b.x-X,b.y-Y))[0];
  if(hit)return selectMapPlace(hit.id,false);
  const p={id:'pin',name:'Dropped pin',category:'activities',kind:'pin',color:MAP_COLORS.activities,
    x:mapCoordinate(BIGMAP.cx+(X-bigMapCv.clientWidth/2)/BIGMAP.z,MAP_WORLD.width),
    y:mapCoordinate(BIGMAP.cy+(Y-bigMapCv.clientHeight/2)/BIGMAP.z,MAP_WORLD.height),description:'A place you marked. Walking routes stop at the nearest clear street approach.'};
  const sh=SHOP[idx(Math.floor(p.x),Math.floor(p.y))],place=sh&&mapFilteredPlaces().find(place=>place.shop===sh);
  if(place)return selectMapPlace(place.id,false);
  BIGMAP.places=BIGMAP.places.filter(p=>p.id!=='pin');BIGMAP.places.push(p);selectMapPlace(p.id,false);setMapWaypoint(p);
}

function openBigMap() {
  if(bigMapOpen())return;
  BIGMAP.returnPaused=paused;
  if (!bigMapEl) {
    const st = document.createElement('style'); st.textContent = BIGMAP_CSS; document.head.appendChild(st);
    bigMapEl = menuEl('bigmap', 900, `<canvas></canvas>
      <div class="bar"><input type="search" placeholder="Find Mara, food, a place..." aria-label="Find a place"><button data-map="close" aria-label="Close map">×</button>
      <div class="tools"><button data-map="in" aria-label="Zoom in">+</button><button data-map="out" aria-label="Zoom out">−</button><button data-map="me">You</button><button data-map="fit">City</button><button data-map="supplier">Supplier</button><button data-map="places">Places</button></div></div>
      <aside class="directory" aria-label="City directory"><h1>GLYPHPORT</h1><div class="subtitle">CITY DIRECTORY / WALKING GUIDE</div><div class="route-status" hidden></div><div class="filters">${Object.entries(MAP_CATEGORIES).map(([id,name])=>`<button data-category="${id}" aria-pressed="${id==='all'}" style="border-left-color:${MAP_COLORS[id]||'#bbc4cc'}">${name}</button>`).join('')}</div><section class="place-detail" hidden></section><div class="results-count"></div><div class="places"></div></aside>
      <div class="tip"></div>`);
    bigMapCv = bigMapEl.querySelector('canvas');
    const q = bigMapEl.querySelector('input');
    q.addEventListener('keydown', e => { if (e.code === 'Enter') bigMapFind(q.value, true); });
    q.addEventListener('input', () => bigMapFind(q.value, false));
    bigMapEl.addEventListener('click', e => {
      const place=e.target.closest('[data-place]');if(place){selectMapPlace(place.dataset.place);return;}
      const category=e.target.closest('[data-category]');
      if(category){BIGMAP.category=category.dataset.category;BIGMAP.limit=30;BIGMAP.selected=null;mapDirectoryUI();bigMapDraw();return;}
      const b = e.target.closest('[data-map]'); if (!b) return;
      const m = b.dataset.map;
      if (m === 'in') bigMapZoom(1.5); if (m === 'out') bigMapZoom(1 / 1.5); if (m === 'me') bigMapCentre();
      if(m==='go'||m==='close'){closeBigMap();if(!paused)lockMouse();}
      if(m==='fit')bigMapFit();
      if(m==='places')bigMapEl.querySelector('.directory').hidden=!bigMapEl.querySelector('.directory').hidden;
      if(m==='supplier'){BIGMAP.category='contacts';BIGMAP.query='';q.value='';selectMapPlace('supplier');}
      if(m==='more'){BIGMAP.limit+=30;mapDirectoryUI();}
      if(m==='unselect'){BIGMAP.selected=null;mapDirectoryUI();}
      if(m==='waypoint')setMapWaypoint(BIGMAP.places.find(p=>p.id===BIGMAP.selected));
      if(m==='island-marina'||m==='island-airport') {
        const name=m==='island-marina'?'Marina':'Airport',departure=BIGMAP.places.find(p=>p.name===name);
        if(departure){selectMapPlace(departure.id);setMapWaypoint(departure);}
      }
      if(m==='clear-route')clearMapWaypoint();
      if(m==='find-housing'){BIGMAP.category='homes';BIGMAP.selected=null;BIGMAP.query='REALTY';q.value='REALTY';mapDirectoryUI();}
      if(m==='call-supplier') {
        if(callWorkshopSupplier()) {
          BIGMAP.places=mapDirectory();selectMapPlace('supplier');
        }
      }
      bigMapDraw();
    });
    bigMapCv.addEventListener('pointerdown', e => {
      bigMapCv.setPointerCapture(e.pointerId); BIGMAP.pts.set(e.pointerId, [e.offsetX, e.offsetY]); bigMapCv.classList.add('drag');
      BIGMAP.pinch = null;
      if(BIGMAP.pts.size===1)BIGMAP.tap={id:e.pointerId,x:e.offsetX,y:e.offsetY,moved:false};
      else if(BIGMAP.tap)BIGMAP.tap.moved=true;
    });
    bigMapCv.addEventListener('pointermove', e => {
      const p = BIGMAP.pts.get(e.pointerId); if (!p) return;
      if(BIGMAP.tap&&Math.hypot(e.offsetX-BIGMAP.tap.x,e.offsetY-BIGMAP.tap.y)>6)BIGMAP.tap.moved=true;
      if (BIGMAP.pts.size >= 2) { // two fingers: pinch to zoom (and drag with the pair)
        p[0] = e.offsetX; p[1] = e.offsetY;
        const [[ax, ay], [bx, by]] = [...BIGMAP.pts.values()], d = Math.hypot(bx - ax, by - ay), mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (BIGMAP.pinch) { bigMapPan(mx - BIGMAP.pinch.mx, my - BIGMAP.pinch.my); bigMapZoom(d / BIGMAP.pinch.d, mx, my); }
        BIGMAP.pinch = { d: d || 1, mx, my };
        return;
      }
      bigMapPan(e.offsetX - p[0], e.offsetY - p[1]); p[0] = e.offsetX; p[1] = e.offsetY;
    });
    const up = e => {
      if(e.type==='pointerup'&&BIGMAP.tap?.id===e.pointerId&&!BIGMAP.tap.moved)bigMapPick(e.offsetX,e.offsetY);
      BIGMAP.pts.delete(e.pointerId); BIGMAP.pinch = null;BIGMAP.tap=null;
      if (!BIGMAP.pts.size) bigMapCv.classList.remove('drag');
    };
    bigMapCv.addEventListener('pointerup', up); bigMapCv.addEventListener('pointercancel', up);
    bigMapCv.addEventListener('wheel', e => { e.preventDefault(); bigMapZoom(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
  }
  bigMapRender(); bigMapNames = bigMapLabels();BIGMAP.places=mapDirectory();bigMapCentre();
  bigMapEl.querySelector('input').value = ''; BIGMAP.found = null; BIGMAP.hits = [];
  BIGMAP.z = clamp(Math.min(innerWidth, innerHeight) / 60, 4, 10); // a few blocks round you to start
  BIGMAP.keys = {}; BIGMAP.pts.clear();BIGMAP.query='';BIGMAP.category='all';BIGMAP.selected=null;BIGMAP.limit=30;
  updateMapNavigation(true);mapDirectoryUI();bigMapEl.querySelector('.directory').hidden=false;
  bigMapEl.style.display = 'block';
  homeEl.style.display = 'none';
  paused = true;
  for(const key in K)K[key]=0;
  releaseMouse();bigMapDraw();
  const tick = () => { if (!bigMapOpen()) return; bigMapStep(); bigMapDraw(); requestAnimationFrame(tick); };
  BIGMAP.last = performance.now(); requestAnimationFrame(tick);
}
// Typing filters the directory; Enter visits matching results in distance order.
function bigMapFind(text, next) {
  BIGMAP.query=text;BIGMAP.limit=30;
  if(!next){BIGMAP.hitK=-1;BIGMAP.selected=null;BIGMAP.category='all';}
  BIGMAP.hits=mapFilteredPlaces();
  if(next&&BIGMAP.hits.length){BIGMAP.hitK=(BIGMAP.hitK+1)%BIGMAP.hits.length;selectMapPlace(BIGMAP.hits[BIGMAP.hitK].id);}
  else mapDirectoryUI();
}
function bigMapStep() { // held keys pan smoothly, a screen's width every second or so
  const now = performance.now(), dt = Math.min(0.05, (now - BIGMAP.last) / 1000), k = BIGMAP.keys, s = 700 * dt;
  BIGMAP.last = now;
  const dx = (k.ArrowLeft || k.KeyA ? 1 : 0) - (k.ArrowRight || k.KeyD ? 1 : 0), dy = (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0);
  if (dx || dy) bigMapPan(dx * s, dy * s);
}
function closeBigMap() {
  if (!bigMapOpen()) return;
  bigMapEl.style.display = 'none'; BIGMAP.keys = {};
  if(bigMapEl.contains(document.activeElement))document.activeElement.blur();
  BIGMAP.pts.clear();BIGMAP.tap=null;paused=BIGMAP.returnPaused;
  if (paused && pauseEl && pauseEl.style.display === 'flex') {
    homeEl.style.display = GLYPHPORT_DESKTOP_APP ? 'none' : 'block';
    pauseEl.querySelector('[data-act="map"]').focus();
  }
  else homeEl.style.display='none';
}
const bigMapOpen = () => !!bigMapEl && bigMapEl.style.display !== 'none';
// keys while the map's up: it takes them all (the game's paused under it)
function bigMapKey(e, down) {
  if (!bigMapOpen()) return false;
  if (e.target && e.target.tagName === 'INPUT') { if (down && e.code === 'Escape'){e.preventDefault();closeBigMap();} return true; }
  if (down && !e.repeat && (e.code === 'Escape' || e.code === 'KeyM')) { e.preventDefault();closeBigMap();if(!paused)relock(e);return true; }
  if (down && (e.key === '+' || e.key === '=')) bigMapZoom(1.25);
  if (down && (e.key === '-' || e.key === '_')) bigMapZoom(0.8);
  if (down && e.code === 'Space') bigMapCentre();
  if(down&&e.code==='KeyF')bigMapFit();
  if(down&&e.code==='Slash'){e.preventDefault();bigMapEl.querySelector('input').focus();}
  BIGMAP.keys[e.code] = down;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  return true;
}
addEventListener('keyup', e => { if (bigMapOpen()) BIGMAP.keys[e.code] = false; });
