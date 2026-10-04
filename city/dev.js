// ===== dev tools: F2 (or Dev tools in the pause menu). Teleport anywhere, spawn things, set your money, the day, the
// time and the weather, without remembering any names: a search box over tabs of buttons. Everything takes effect
// at once and the menu stays open, so you can do several things before closing it (Esc, F2 or the close button).
let devEl = null, devTab = 'places', devFilter = '';
const DEV_CSS = `
  #dev .panel { width: min(680px, calc(100vw - 24px)); padding: 20px 22px; }
  #dev .tabs { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 6px 0 10px; }
  #dev .tab { color: rgba(255,255,255,0.4); } #dev .tab.on { color: #fff; } #dev .tab.on::before { content: '['; } #dev .tab.on::after { content: ']'; }
  #dev input.search { width: 100%; box-sizing: border-box; font: inherit; color: #fff; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);
    padding: 6px 10px; margin: 0 0 10px; outline: none; }
  #dev input.search:focus { border-color: rgba(255,255,255,0.5); }
  #dev .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2px 12px; }
  #dev .grid .item { padding-left: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #dev .note { color: rgba(255,255,255,0.35); margin: 2px 0 6px; }
  #dev .grp { grid-column: 1 / -1; color: rgba(255,255,255,0.3); margin-top: 8px; }
  #dev .bar { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 8px; padding-left: 14px; }
  #dev .bar .item { width: auto; padding-left: 0; }
  #dev .bar input { width: 9em; font: inherit; color: #fff; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); padding: 2px 6px; }`;
const devOpen = () => !!devEl && devEl.style.display === 'flex';

// put you on your feet, out of whatever you're in (a car, a room, a ride, a boat, the el), ready to be moved
function devFree() {
  if (game) game = null;
  if (me) leaveCar();
  if (mode === 'room') { room = null; }
  if (mode === 'fair' && fairRide) { fairRide = null; fairEye = 0.17; }
  if (mode === 'sea' && sea) { sea.v = 0; if (sea.hired) { sea.hired = false; const s = SLOTS[sea.slot]; Object.assign(sea, { x: s.x, y: s.y, hx: s.hx, hy: s.hy }); } sea = null; }
  if (mode === 'el') ride = null;
  plat = null; body.seat = null; mode = 'walk'; pitch = 0; look = 0;
}
const devAt = (x, y, ang) => { devFree(); px = mod(x, N); py = mod(y, N); a = ang; };
// a street spot in a district: the middle of the street beside one of its plain blocks
function districtSpot(d) {
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++)
    if (districtName(bx, by) === d && !blockKind(bx, by) && hseg(bx, by)) return [bx * 8 + 4, by * 8 + 1.6, -Math.PI / 2];
  return null;
}
// every place you can jump to: [group, label, go]
function devPlaces() {
  const out = [];
  const land = [['Casino', () => gotoShop('CASINO')], ['Stock Exchange', () => gotoShop('EXCHANGE')], ['The Velvet Rope', () => gotoShop('VELVET')],
    ['Marina', () => devAt(MARINA.x, MARINA.y0 + 0.6, Math.PI / 2)], ['Sunset Pier', () => devAt(FAIR.cx, FAIR.y0 - 0.5, Math.PI / 2)],
    ['Ferris wheel', () => devAt(WHEEL_BOARD.x, WHEEL_BOARD.y - 0.3, Math.PI / 2)], ['Carousel', () => devAt(CAROUSEL.x - CAROUSEL.r - 0.3, CAROUSEL.y, 0)],
    ['Lighthouse Island', () => devAt(LIGHTHOUSE.x, LIGHTHOUSE.y - 1, Math.PI / 2)], ['The Lighthouse Walk', () => devAt(FOOTBRIDGE.x, FOOTBRIDGE.y0 + 0.5, Math.PI / 2)],
    ['Botanical Gardens', () => { const [gx, gy] = GARDEN_GATES[0]; devAt(GARDEN.x0 + gx, GARDEN.y0 + gy - 0.4, Math.PI / 2); }],
    ['Aquarium', () => devAt(AQUARIUM.doorU, AQUARIUM.by * 8 + 8.4, -Math.PI / 2)], ['Out on the bay (in a boat)', () => { devFree(); const b = fleet.find(o => o.deal === 'mine') || fleet[0]; boardBoat(b); }]];
  for (const [l, go] of land) out.push(['Landmarks', l, go]);
  const LM = { cathedral: 'Cathedral', clock: 'Clock tower', screens: 'The big screens', radio: 'Radio tower' };
  const nearestLm = {}; // (there are several of each: the nearest one)
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    const lm = landmarkOf.get(bi(bx, by)); if (!lm) continue;
    const d = Math.hypot(rel(bx * 8 + 5 - px), rel(by * 8 + 5 - py));
    if (!nearestLm[lm] || d < nearestLm[lm][0]) nearestLm[lm] = [d, bx, by];
  }
  for (const lm in nearestLm) { const [, bx, by] = nearestLm[lm]; out.push(['Landmarks', LM[lm] || lm, () => devAt(bx * 8 + 5, (by + 1) * 8 + 0.6, -Math.PI / 2)]); }
  for (const [kind, label] of [['police', 'Police station'], ['fire', 'Fire station'], ['amb', 'Hospital']]) { // (one of each: the nearest)
    const s = SERVICES.filter(b => b.kind === kind).sort((p, q) => Math.hypot(rel(p.x - px), rel(p.y - py)) - Math.hypot(rel(q.x - px), rel(q.y - py)))[0];
    if (s) out.push(['Landmarks', label, () => devAt(s.x, s.y + 0.15, -Math.PI / 2)]);
  }
  for (const d in DISTRICT_TITLE) { const sp = districtSpot(d); if (sp) out.push(['Districts', DISTRICT_TITLE[d].replace(/^the /, 'The '), () => devAt(...sp)]); }
  stations.forEach(s => out.push(['Subway stations', s.name, () => devAt(s.x - 0.25, s.y, 0)]));
  EL_STATIONS.forEach(s => out.push(['El stations', s.name, () => devAt(s.x, EL_Y + 0.12, Math.PI / 2)]));
  owned.homes.forEach((h, k) => out.push(['Your homes', `${ITEMS[h.kind].name} ${k + 1}`, () => { const [x, y] = homeKerb(h.cell % N, Math.floor(h.cell / N)); devAt(x, y, 0); }]));
  const words = new Map(); // every kind of shop, by its sign: you land outside the nearest one
  for (let k = 0; k < N * N; k++) { const sh = SHOP[k]; if (sh && sh.word && sh.kind !== SHOP_APTS) words.set(sh.word, (words.get(sh.word) || new Set()).add(sh)); }
  for (const [w, set] of [...words].sort((p, q) => p[0] < q[0] ? -1 : 1)) out.push(['Shops (nearest)', `${w} (${set.size})`, () => { devFree(); gotoShop(w); }]);
  return out;
}
function devItems() {
  const out = [], KIND = { food: 'Food', drink: 'Drinks', smoke: 'Smokes', gear: 'Gear', toy: 'Toys' };
  for (const id in ITEMS) { const it = ITEMS[id]; if (KIND[it.kind]) out.push([KIND[it.kind], it.name, () => devGive(id)]); }
  const order = Object.values(KIND);
  return out.sort((p, q) => order.indexOf(p[0]) - order.indexOf(q[0]) || (p[1].toLowerCase() < q[1].toLowerCase() ? -1 : 1));
}
function devGive(id) {
  if (inv.length >= INV_SIZE) return say(`Your hands are full (${INV_SIZE}). Drop something first, or use Other: empty your pockets.`, 3);
  inv.push({ id, uses: ITEMS[id].uses || 0 }); held = inv.length - 1; say(`Spawned ${aOrSome(ITEMS[id].name)}.`, 2);
}
const devCash = n => { money = Math.max(0, Math.round((money + n) * 100) / 100); say(`Money: ${fmt$(money)}`, 2); };

function devBody() {
  const q = devFilter.toLowerCase(), btn = (k, label, extra = '') => `<button class="item" data-dev="${k}" ${extra}>${label}</button>`;
  if (devTab === 'places' || devTab === 'items') {
    const list = devTab === 'places' ? devPlaces() : devItems();
    devEl.acts = [];
    let html = '', grp = null;
    for (const [g, label, go] of list) {
      if (q && !label.toLowerCase().includes(q) && !g.toLowerCase().includes(q)) continue;
      if (g !== grp) { html += `<div class="grp">${g}</div>`; grp = g; }
      html += btn(devEl.acts.length, label, `title="${label}"`); devEl.acts.push(go);
    }
    return `${devTab === 'items' ? `<p class="note">carrying ${inv.length}/${INV_SIZE}: click to add one to your hands</p>` : '<p class="note">click to go there (you\'re put on your feet first)</p>'}<div class="grid">${html || '<p class="note">nothing matches</p>'}</div>`;
  }
  devEl.acts = [];
  const act = (label, fn) => { devEl.acts.push(fn); return btn(devEl.acts.length - 1, label); };
  if (devTab === 'money') return `<p class="note">you have ${fmt$(money)} and ${tickets} tickets</p>
    <div class="bar">${[100, 1000, 10000, 100000].map(n => act(`+${fmt$(n)}`, () => devCash(n))).join('')}${act('Broke ($0)', () => devCash(-money))}</div>
    <div class="bar">set money to <input type="number" min="0" step="1" data-set="money" value="${Math.round(money)}"></div>
    <div class="bar">${[100, 1000].map(n => act(`+${n} tickets`, () => { tickets += n; say(`${tickets} tickets.`, 2); })).join('')}</div>`;
  if (devTab === 'time') {
    const hh = Math.floor(tod), mm = Math.floor(fract(tod) * 60);
    return `<p class="note">${weekday()} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}, ${weather}</p>
      <div class="grp">time of day</div><div class="bar">${[['Dawn', 6], ['Morning', 9], ['Noon', 12], ['Afternoon', 15], ['Dusk', 19], ['Night', 22], ['Midnight', 0], ['3am', 3]].map(([l, h]) => act(l, () => { tod = h; })).join('')}</div>
      <div class="bar">hour <input type="number" min="0" max="23.99" step="0.25" data-set="tod" value="${tod.toFixed(2)}"></div>
      <div class="grp">day of the week</div><div class="bar">${WEEKDAYS.map((d, k) => act(d, () => { dayNum += mod(k - mod(dayNum, 7), 7); })).join('')}${act('Next day', () => { dayNum++; })}</div>
      <div class="grp">weather</div><div class="bar">${['clear', 'rain', 'storm', 'fog'].map(w => act(w, () => { weather = w; wTimer = 600; })).join('')}</div>`;
  }
  return `<div class="grp">police</div><div class="bar">${act('Clear wanted level', () => { clearWanted(); reports.length = 0; say('Wanted level cleared.', 2); })}${act('+1 wanted star', () => addWanted('steal', px, py, true))}</div>
    <div class="grp">you</div><p class="note">food ${needs.food | 0}, drink ${needs.drink | 0}, health ${needs.health | 0}</p><div class="bar">${act('Fill food, drink and health', () => { refillNeeds(); say('Fed, watered and fighting fit.', 2); })}${act('Hungry and thirsty (empty)', () => { needs.food = needs.drink = 0; })}${act('Health to 10', () => { needs.health = 10; })}${act('Bladder full', () => { needs.bladder = 100; })}</div>
    <div class="bar">${act('Sober up / clear effects', () => { for (const k of ['caffeine', 'booze', 'smoke', 'vape', 'cloud', 'fresh', 'spark']) fx[k] = 0; say('Clear-headed.', 2); })}${act('Empty your pockets', () => { inv.length = 0; held = -1; say('Pockets emptied.', 2); })}</div>
    <div class="grp">spawn a car of yours (beside you)</div><div class="bar">${Object.keys(CAR_MODELS).map(m => act(ITEMS[m].name, () => { devFree(); const l = laneNear(px, py); spawnOwnedCar(m, l.x, l.y, l.hx, l.hy); say(`Your ${ITEMS[m].name} is parked beside you.`, 2); })).join('')}</div>`;
}
function renderDev(keepFocus) {
  const tabs = [['places', 'Places'], ['items', 'Items'], ['money', 'Money'], ['time', 'Time & weather'], ['other', 'Other']];
  devEl.querySelector('.panel').innerHTML = `<h1>Dev tools</h1><p class="sub">F2 or Esc to close &middot; type to search</p>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${devTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}<span style="flex:1"></span><button class="tab" data-close>close</button></div>
    ${devTab === 'places' || devTab === 'items' ? `<input class="search" type="search" placeholder="search ${devTab}..." value="${devFilter.replace(/"/g, '&quot;')}" autocomplete="off">` : ''}
    <div class="body">${devBody()}</div>`;
  const s = devEl.querySelector('input.search');
  if (s && keepFocus !== false) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}
function openDev() {
  if (!devEl) {
    devEl = menuEl('dev', 1000, '<div class="panel" role="dialog" aria-label="Dev tools"></div>');
    const st = document.createElement('style'); st.textContent = DEV_CSS; document.head.appendChild(st);
    devEl.addEventListener('click', e => {
      if (e.target === devEl) return closeDev(); // (the dark outside)
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close !== undefined) return closeDev();
      if (b.dataset.tab) { devTab = b.dataset.tab; devFilter = ''; return renderDev(); }
      const fn = devEl.acts[+b.dataset.dev]; if (!fn) return;
      fn();
      if (devTab === 'places') closeDev(); else renderDev(false); // (a jump closes it, so you can see where you are)
    });
    devEl.addEventListener('input', e => {
      if (e.target.classList.contains('search')) { devFilter = e.target.value; devEl.querySelector('.body').innerHTML = devBody(); return; }
      const k = e.target.dataset.set, v = +e.target.value;
      if (k === 'money' && v >= 0) money = Math.round(v * 100) / 100;
      if (k === 'tod' && v >= 0 && v < 24) tod = v;
    });
    devEl.addEventListener('keydown', e => {
      if (e.code === 'Escape' || e.code === 'F2') { e.preventDefault(); return closeDev(); }
      if (e.code === 'Enter' && e.target.classList.contains('search')) { // Enter: the first match
        const b = devEl.querySelector('[data-dev]'); if (b) b.click();
      }
      e.stopPropagation(); // (typing here never reaches the game)
    });
  }
  if (pauseEl && pauseEl.style.display === 'flex') closePause(false);
  paused = true; for (const k in K) K[k] = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  devEl.style.display = 'flex'; renderDev();
}
function closeDev() { if (!devOpen()) return; devEl.style.display = 'none'; paused = false; lockMouse(); }
const devKey = e => { if (e.code !== 'F2' || e.repeat) return false; e.preventDefault(); devOpen() ? closeDev() : openDev(); return true; };
