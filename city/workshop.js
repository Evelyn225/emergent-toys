// Apartment workshops. The machines and Neon are fictional; this is a short timing/balance game.
const WORKSHOP_KIT_PRICE = 120, WORKSHOP_REFILL_PRICE = 30, WORKSHOP_FAN_PRICE = 65;
const HOME_ROOM_SIZE = { home_studio: [14,15], home_loft: [20,22], home_belle: [26,26], home_island: [24,24] };
const WORKSHOP_PARTS = {
  bench: { name: 'folding workbench', halfX: .95, halfY: .48 },
  processor: { name: 'batch processor' }, packer: { name: 'packet press' }, fan: { name: 'cooling fan' },
  growrack: { name: 'grow rack', halfX: .75, halfY: .48 }
};
const WORKSHOP_UPGRADES = {
  controller: { name: 'thermal controller', price: 95, description: 'Wider Neon balance range on every bench' },
  press: { name: 'precision press', price: 85, description: 'Two extra packets per Neon batch' },
  lamp: { name: 'grow lamps', price: 55, description: 'Faster growth and two extra weed packs per harvest' }
};
const WEED_RACK_PRICE = 90, WEED_SEEDS_PRICE = 18, WEED_GROW_TIME = 75;
const DRUG_QUALITY = { perfect: 'premium', fine: 'standard', burnt: 'weak' };
const DRUG_PACKET_PRICE = { perfect: 18, fine: 14, burnt: 8 };
ITEMS.neon = { name: 'Neon', price: 0, kind: 'drug', uses: 4 };
ITEMS.weed = { name: 'weed', price: 0, kind: 'drug', uses: 4 };
CRIMES.dealing = { stars: 1, name: 'drug dealing' };
NEWS.dealing = w => `Drug dealing reported in ${w}. Police are looking into a brief exchange and a very ordinary bag.`;
const drugCount = () => inv.reduce((n, it) => n + (ITEMS[it.id]?.kind === 'drug' ? it.uses : 0), 0);
const drugValue = () => inv.reduce((n, it) => n + (ITEMS[it.id]?.kind === 'drug' ? it.uses * drugPacketPrice(it) : 0), 0);
const drugPacketPrice = it => it.id === 'weed' ? ({perfect:12,fine:9,burnt:6}[it.q] || 9) : (DRUG_PACKET_PRICE[it.q] || 14);
const drugStockLabel = () => {
  const ids = [...new Set(inv.filter(it=>ITEMS[it.id]?.kind==='drug' && it.uses>0).map(it=>it.id))];
  return ids.length === 1 ? ITEMS[ids[0]].name : 'mixed';
};
const drugDemand = { next: 0, until: 0 };
function drugBuyerInterested(now = T, random = Math.random) {
  if (drugCount()) return true;
  if (!closet.some(it => ITEMS[it.id]?.kind === 'drug' && it.uses > 0)) {
    drugDemand.until = 0; drugDemand.next = now + 20; return false;
  }
  if (now < drugDemand.until) return true;
  if (now < drugDemand.next) return false;
  drugDemand.next = now + 20;
  if (random() < .35) {drugDemand.until = now + 90; return true;}
  return false;
}
function workshopState(home) {
  const w = home.workshop ||= { owned: { bench: 0, processor: 0, packer: 0, fan: 0 }, parts: [], supplies: 0, powered: false, next: 1 };
  w.owned.growrack ??= 0; w.seeds ??= 0; w.upgrades ||= {};
  return w;
}
function workshopAttachment(id, bench) {
  const offset = {processor:-.43, packer:.43, fan:0}[id], back = id==='fan' ? -.3 : 0;
  return {id, bench:bench.key, x:bench.x+offset*Math.cos(bench.a)-back*Math.sin(bench.a), y:bench.y+offset*Math.sin(bench.a)+back*Math.cos(bench.a), a:bench.a};
}
function restoreWorkshop(raw, kind = 'home_studio') {
  const [width,height] = HOME_ROOM_SIZE[kind] || HOME_ROOM_SIZE.home_studio;
  const w = { owned: {}, parts: [], supplies: clamp(Math.floor(+raw?.supplies || 0), 0, 300), powered: raw?.powered === true, next: 1,
    seeds: clamp(Math.floor(+raw?.seeds || 0),0,300), upgrades: {} };
  for (const id of Object.keys(WORKSHOP_UPGRADES)) if (raw?.upgrades?.[id] === true) w.upgrades[id] = true;
  for (const id of Object.keys(WORKSHOP_PARTS)) w.owned[id] = clamp(Math.floor(+raw?.owned?.[id] || 0), 0, 3);
  for (const p of Array.isArray(raw?.parts) ? raw.parts : []) {
    if (!WORKSHOP_PARTS[p?.id] || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 1 || p.y < 1 || p.x > 25 || p.y > 25 ||
        !Number.isInteger(p.key) || p.key < 1 || w.parts.some(q => q.key === p.key) || w.parts.filter(q => q.id === p.id).length >= w.owned[p.id]) continue;
    const part = { id: p.id, key: p.key, x: p.x, y: p.y, a: mod(Math.round((+p.a || 0) / (Math.PI / 2)), 4) * Math.PI / 2, ...(Number.isInteger(p.bench) ? { bench: p.bench } : {}) };
    if (p.id === 'growrack' && Number.isFinite(p.crop?.left)) part.crop = {left:clamp(p.crop.left,0,WEED_GROW_TIME), tended:p.crop.tended===true};
    w.parts.push(part);
    w.next = Math.max(w.next, p.key + 1);
  }
  w.parts = w.parts.filter(p => {
    const d=WORKSHOP_PARTS[p.id]; if (!d.halfX) return true;
    const hx=Math.abs(Math.cos(p.a))*d.halfX+Math.abs(Math.sin(p.a))*d.halfY, hy=Math.abs(Math.sin(p.a))*d.halfX+Math.abs(Math.cos(p.a))*d.halfY;
    return p.x-hx>=1-1e-6 && p.x+hx<=width-1+1e-6 && p.y-hy>=height-6 && p.y+hy<=height-1+1e-6 && Math.abs(p.x-(kind==='home_belle'?9:width/2))>=hx+1;
  });
  w.parts = w.parts.filter((p,index,all) => WORKSHOP_PARTS[p.id].halfX || all.some(b => b.id === 'bench' && b.key === p.bench) &&
    !all.slice(0,index).some(q=>q.id===p.id && q.bench===p.bench));
  w.parts = w.parts.map(p => WORKSHOP_PARTS[p.id].halfX ? p : {...workshopAttachment(p.id,w.parts.find(b=>b.key===p.bench)),a:p.a,key:p.key});
  return w;
}
function buyWorkshopKit(home) {
  const w = workshopState(home);
  if (w.owned.bench >= 3) return [false, 'Three benches is plenty for one apartment.'];
  if (!pay(WORKSHOP_KIT_PRICE)) return [false, `The starter kit costs ${fmt$(WORKSHOP_KIT_PRICE)}.`];
  for (const id of ['bench', 'processor', 'packer']) w.owned[id]++;
  w.supplies += 3;
  return [true, 'A crate arrives: a folding bench, processor, packet press and supplies for three batches. Unpack and place each piece.'];
}
function buyWorkshopSupplies(home) {
  const w = workshopState(home);
  if (w.supplies > 294) return [false, 'The supply cupboard is full.'];
  if (!pay(WORKSHOP_REFILL_PRICE)) return [false, `Five batches of supplies cost ${fmt$(WORKSHOP_REFILL_PRICE)}.`];
  w.supplies += 5; return [true, 'Five sealed refill cartridges delivered to the workshop cupboard.'];
}
function buyWorkshopUpgrade(home, id) {
  const w=workshopState(home), upgrade=WORKSHOP_UPGRADES[id];
  if (!upgrade || w.upgrades[id]) return [false,'That upgrade is already installed.'];
  if (!pay(upgrade.price)) return [false,`You need ${fmt$(upgrade.price)} for that upgrade.`];
  w.upgrades[id]=true;
  return [true,`${cap(upgrade.name)} installed. ${upgrade.description}.`];
}
function buyWeedEquipment(home, rack = true) {
  const w=workshopState(home), price=rack?WEED_RACK_PRICE:WEED_SEEDS_PRICE;
  if (rack && w.owned.growrack>=3) return [false,'There is room for three grow racks at most.'];
  if (w.seeds>294) return [false,'The seed cupboard is full.'];
  if (!pay(price)) return [false,`You need ${fmt$(price)}.`];
  if (rack) w.owned.growrack++;
  w.seeds+=rack?3:5;
  return [true,rack?'A grow rack and three seed pods arrive. Place the rack, connect power and start growing.':'Five seed pods delivered.'];
}
function plantWeed(home,rack) {
  const w=workshopState(home);
  if (!w.parts.includes(rack) || rack.id!=='growrack' || rack.crop) return [false,'Use an empty grow rack.'];
  if (!w.powered) return [false,'Connect workshop power first.'];
  if (!w.seeds) return [false,'Buy seed pods at the cupboard.'];
  w.seeds--; rack.crop={left:WEED_GROW_TIME,tended:false};
  return [true,'Seed pod planted. Check back to tend the plant once it has sprouted.'];
}
function tendWeed(rack) {
  if (!rack?.crop || rack.crop.left>50 || rack.crop.left<=0 || rack.crop.tended) return [false,'The plant does not need tending right now.'];
  rack.crop.tended=true;
  return [true,'You tend the plant. This harvest will be premium.'];
}
function harvestWeed(home,rack) {
  const w=workshopState(home);
  if (!w.parts.includes(rack) || !rack.crop || rack.crop.left>0) return [false,'The plant is still growing.'];
  if (inv.length>=INV_SIZE) return [false,'Make room in your bag; the harvest can wait.'];
  const quality=rack.crop.tended?'perfect':'fine', count=4+(w.upgrades.lamp?2:0);
  carryItem({id:'weed',uses:count,q:quality});delete rack.crop;
  return [true,`${count} ${DRUG_QUALITY[quality]} weed packs harvested. Keep some, store them, or meet the buyer outside.`];
}
function stepWorkshop(dt) {
  for (const home of owned.homes) {
    const w=home.workshop; if (!w?.powered) continue;
    for (const p of w.parts) if (p.id==='growrack' && p.crop) p.crop.left=Math.max(0,p.crop.left-dt*(w.upgrades?.lamp?1.5:1));
  }
}
const workshopBenchReady = (w, bench) => ['processor', 'packer'].every(id => w.parts.some(p => p.id === id && p.bench === bench.key));
function workshopCanRun(home, bench) {
  const w = workshopState(home);
  if (!bench || !w.parts.includes(bench) || !workshopBenchReady(w, bench)) return 'Put the processor and packet press on this bench first.';
  if (!w.powered) return 'Plug the equipment in at the workshop cupboard.';
  if (!w.supplies) return 'The workshop needs refill cartridges.';
  if (inv.length >= INV_SIZE) return 'Make room in your bag for the finished batch.';
  return '';
}
function finishWorkshopBatch(home, bench, quality) {
  const problem = workshopCanRun(home, bench);
  if (problem) return [false, problem];
  if (!DRUG_QUALITY[quality]) return [false, 'The batch is not finished.'];
  workshopState(home).supplies--;
  const count = { perfect: 6, fine: 4, burnt: 2 }[quality] + (workshopState(home).upgrades.press ? 2 : 0);
  carryItem({ id: 'neon', uses: count, q: quality });
  return [true, `${count} ${DRUG_QUALITY[quality]} Neon packets sealed. A buyer will wait outside while you carry them.`];
}
function sellDrugBatch() {
  const count = drugCount(), value = drugValue();
  if (!count) return [false, 'Nothing to sell. Your stored stock stays at home.'];
  for (let k = inv.length - 1; k >= 0; k--) if (ITEMS[inv[k].id]?.kind === 'drug') takeSlot(k);
  earn(value);
  return [true, `${count} packets change hands. ${fmt$(value)} in your pocket.`, value];
}
// Thirty-two seconds: hold power to balance the rotor, vent twice, and seal two sections when prompted.
GAMES.workshop = (rnd, word, opts = {}) => {
  const g = { id: 'workshop', title: 'NEON BATCH', W: 32, H: 16, score: 0, over: false };
  let t = 0, heat = .45, steady = 0, completed = 0;
  const band = [.4 - (opts.fan ? .1 : 0) - (opts.controller ? .08 : 0), .7 + (opts.fan ? .08 : 0) + (opts.controller ? .07 : 0)];
  const moves = [{ at: 7, key: 'up', name: 'VENT' }, { at: 15, key: 'down', name: 'SEAL' }, { at: 23, key: 'up', name: 'VENT' }, { at: 28, key: 'down', name: 'SEAL' }];
  const current = () => moves.find(m => !m.done && !m.missed && t >= m.at);
  g.step = (dt, keys) => {
    if (g.over) return [];
    t = Math.min(32, t + dt); heat = clamp(heat + (keys.act ? .3 : -.18) * dt, 0, 1);
    if (heat >= band[0] && heat <= band[1]) steady += dt;
    const m = current(), ev = []; // (what just happened, for the sound: workshop-ui.js)
    if (m) {
      if (t - m.at > 1.6) { m.missed = true; ev.push('miss'); }
      else if (keys[m.key + 'P']) { m.done = true; completed++; ev.push(m.key === 'up' ? 'vent' : 'seal'); if (m.key === 'up') heat = Math.max(0, heat - .08); }
    }
    if (t >= 32) {
      g.over = true; g.score = Math.round(75 * steady / 32 + 25 * completed / moves.length);
      g.result = g.score >= 80 ? 'perfect' : g.score >= 45 ? 'fine' : 'burnt';
      ev.push('clear');
    }
    return ev;
  };
  g.state = () => ({ t, heat, band, moves, current: current() });
  g.reward = () => 0;
  g.status = () => `HOLD SPACE power   UP vent   DOWN seal   ${Math.ceil(32 - t)}s left`;
  g.draw = (put, text) => {
    for (let x = 2; x < 30; x++) {
      const level = (x - 2) / 27, color = level >= band[0] && level <= band[1] ? GREEN : RED;
      put(x, 3, level <= heat ? '#' : '.', C(color, level <= heat ? 14 : 6));
      put(x, 13, level < t / 32 ? '=' : '.', C(MAG, 12));
    }
    text(16, 1, 'KEEP THE ROTOR IN THE GREEN', C(WHITE, 13), 'center');
    put(Math.round(2+heat*27), 2, 'v', C(WHITE,15));
    const spin = Math.floor(t * (3 + heat * 8)) % 4;
    for (let y = 6; y < 11; y++) for (let x = 6; x < 18; x++) put(x, y, y === 6 || y === 10 ? '=' : x === 6 || x === 17 ? '|' : x === 11 && y === 8 ? '|/-\\'[spin] : '.', C(GRAY, 11), C(GRAY, 1));
    text(23, 8, '[NEON]', C(MAG, 15), 'center');
    put(11,8,'O',C(MAG,15));
    for(const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1]]) put(11+ox,8+oy,'|/-\\'[(spin+(ox?0:2))%4],C(CYAN,14));
    text(12,11.5,`POWER ${Math.round(heat*100)}%`,C(WHITE,12),'center');
    const sealed=moves.filter(m=>m.key==='down'&&m.done).length;
    for(let n=0;n<sealed;n++) text(23,10+n,'[SEALED]',C(GREEN,14),'center');
    const m = current();
    if (m && !m.missed) text(16, 5, `${m.name}! [${m.key === 'up' ? 'UP' : 'DOWN'}]`, C(YEL, 15), 'center');
  };
  return g;
};
