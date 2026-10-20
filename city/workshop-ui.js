// Physical workshop furniture, placement, supplies, and the customer outside your own building.
let workshopEl = null, drugSaleEl = null, workshopPlacement = null, workshopRun = null, drugBuyer = null;
const workshopHome = () => mode === 'room' ? homeRecord(room) : null;
function workshopProps(r) {
  const home = homeRecord(r); if (!home) return [];
  const w = workshopState(home), props = [];
  for (const p of w.parts) {
    const ca = Math.cos(p.a), sa = Math.sin(p.a), box = (ox, oy, hl, hw, z0, z1, shade) =>
      BX(p.x + ox * ca - oy * sa, p.y + ox * sa + oy * ca, hl, hw, z0, z1, shade, ca, sa);
    if (p.id === 'bench') {
      props.push(box(0, 0, .95, .48, .83, .93, solid(BRICK, { panel: .3, top: '=' })));
      for (const x of [-.82, .82]) for (const y of [-.35, .35]) props.push(box(x, y, .035, .035, 0, .83, solid(GRAY)));
      continue;
    }
    if (p.id === 'growrack') {
      props.push(box(0,0,.75,.48,.55,.68,solid(GRAY,{top:'='})));
      for (const x of [-.62,.62]) for (const y of [-.35,.35]) props.push(box(x,y,.035,.035,0,.55,solid(GRAY)));
      for (const x of [-.4,0,.4]) {
        props.push(box(x,0,.12,.16,.68,.85,solid(BRICK,{top:':'})));
        if (p.crop) props.push(box(x,0,.19,.2,.85,1.7,(i,t,L)=>{
          const height=.2+(1-p.crop.left/WEED_GROW_TIME)*.65, z=HIT.w-.85;
          if (z>height) return false;
          const u=HIT.face<=2?HIT.v:HIT.u, width=Math.min(.19,.04+(height-z)*.45);
          const stem=Math.abs(u)<.018, branch=Math.abs(mod(z+Math.abs(u)*.85,.18)-.09)<.032;
          if (!stem && (!branch || Math.abs(u)>width)) return false;
          const bud=p.crop.left===0 && z>height-.08;
          let ch='|';
          if (bud) ch='*';
          else if (!stem) ch=u<0?'\\':'/';
          set(i,ch,C(bud?WARM:GREEN,L+4));
          return true;
        }));
      }
      // The rail is always there; bought lamps visibly attach above the plants.
      props.push(box(0,-.4,.72,.035,1.82,1.9,(i,t,L)=>{
        set(i,'=',C(w.upgrades.lamp&&w.powered?WARM:GRAY,w.upgrades.lamp&&w.powered?15:L));
        return true;
      }));
      for (const x of [-.68,.68]) props.push(box(x,-.4,.025,.025,.68,1.82,solid(GRAY)));
      continue;
    }
    const running = () => workshopRun?.home === home && workshopRun.bench.key === p.bench && game?.kind === 'workshop';
    if (p.id === 'processor') props.push(box(0, 0, .24, .27, .93, 1.6, (i, t, L) => {
      const on = w.powered, active = running();
      BG[i] = C(GRAY, 1 + L * .15);
      const ch = HIT.face === 5 ? '=' : HIT.w > 1.15 && HIT.w < 1.4 ? (active ? '|/-\\'[Math.floor(T * 8) % 4] : 'O') : HIT.w > 1.48 ? '*' : ':';
      return set(i, ch, C(on ? MAG : GRAY, on ? 12 : L)), true;
    }));
    if (p.id === 'packer') props.push(box(0, 0, .23, .27, .93, 1.23, solid(GRAY, { panel: .2, top: '=' })),
      box(0, 0, .06, .22, 1.23, 1.5, solid(MAG, { top: '_' })));
    if (p.id === 'fan') props.push(box(0, 0, .15, .12, .93, 1.06, solid(GRAY)),
      box(0, 0, .15, .12, 1.06, 1.52, (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, running() ? '|/-\\'[Math.floor(T * 10) % 4] : '+', C(CYAN, L + 3)), true; }));
  }
  return props;
}
function refreshWorkshopRoom() {
  if (!workshopHome()) return;
  room.props = [...room.def.props(room), ...workshopProps(room)];
}
function nearWorkshopBench() {
  const home = workshopHome(); if (!home) return null;
  return workshopState(home).parts.filter(p => WORKSHOP_PARTS[p.id].halfX && Math.hypot(p.x - px, p.y - py) < 1.9 &&
    (p.x - px) * Math.cos(a) + (p.y - py) * Math.sin(a) > .15).sort((p,q) => Math.hypot(p.x-px,p.y-py)-Math.hypot(q.x-px,q.y-py))[0] || null;
}
function openWorkshop() {
  const home = workshopHome(); if (!home) return;
  const w = workshopState(home);
  workshopEl ||= panel('workshop');
  const available = Object.entries(WORKSHOP_PARTS).map(([id, d]) => {
    const remaining = w.owned[id] - w.parts.filter(p => p.id === id).length;
    return remaining > 0 ? `<button class="item" data-place="${id}"><span>Place ${d.name}</span><span class="lead"></span><span class="v">${remaining} packed</span></button>` : '';
  }).join('');
  const benches = w.parts.filter(p => p.id === 'bench').map((b, n) => {
    const names = w.parts.filter(p => p.bench === b.key).map(p => WORKSHOP_PARTS[p.id].name).join(', ') || 'empty tabletop';
    return `<p class="sub">Bench ${n+1}: ${names}</p><button class="item" data-run="${b.key}" ${workshopCanRun(home,b) ? 'disabled' : ''}>Run a 32-second batch</button><button class="item" data-pack="${b.key}">Pack up bench ${n+1} and its equipment</button>`;
  }).join('');
  const upgrades=Object.entries(WORKSHOP_UPGRADES).map(([id,u])=>`<button class="item" data-upgrade="${id}" ${w.upgrades[id]||money<u.price?'disabled':''}><span>${cap(u.name)}<br><small>${u.description}</small></span><span class="lead"></span><span class="v">${w.upgrades[id]?'installed':fmt$(u.price)}</span></button>`).join('');
  const racks=w.parts.filter(p=>p.id==='growrack').map((p,n)=>{
    let status='empty', action=`<button class="item" data-plant="${p.key}" ${!w.powered||!w.seeds?'disabled':''}>Plant a seed pod</button>`;
    if (p.crop) {
      status=p.crop.left===0?'ready to harvest':`${Math.ceil(p.crop.left/(w.upgrades.lamp?1.5:1))}s left${w.powered?'':' (power off)'}${p.crop.tended?' · tended':''}`;
      action=p.crop.left===0?`<button class="item" data-harvest="${p.key}">Harvest weed</button>`:`<button class="item" data-tend="${p.key}" ${p.crop.left>50||p.crop.tended?'disabled':''}>Tend for premium quality</button>`;
    }
    return `<p class="sub">Grow rack ${n+1}: ${status}</p>${action}<button class="item" data-pack="${p.key}" ${p.crop?'disabled':''}>Pack up empty rack ${n+1}</button>`;
  }).join('');
  showPanel(workshopEl, `<h1>Apartment workshop</h1><p class="sub">${fmt$(money)} &middot; ${w.supplies} Neon refills &middot; ${w.seeds} seed pods &middot; power ${w.powered ? 'connected' : 'unplugged'}</p>
    <p class="sub">Make Neon on a workbench or grow weed on a rack. Place furniture in the open area by the entrance and connect power. Carried stock guarantees a buyer; closet stock sometimes attracts one too. Q / left click uses a pack yourself.</p>
    <h2>Mara's order book</h2>
    <button class="item" data-call-supplier>Meet Mara outside &middot; supplies and equipment</button>
    <button class="item" data-kit ${w.owned.bench >= 3 || money < WORKSHOP_KIT_PRICE ? 'disabled' : ''}>Starter crate &middot; 3 pieces + 3 batches<span class="lead"></span><span class="v">${fmt$(WORKSHOP_KIT_PRICE)}</span></button>
    <button class="item" data-refill ${money < WORKSHOP_REFILL_PRICE ? 'disabled' : ''}>Five refill cartridges<span class="lead"></span><span class="v">${fmt$(WORKSHOP_REFILL_PRICE)}</span></button>
    <button class="item" data-fan ${money < WORKSHOP_FAN_PRICE || w.owned.fan >= 3 ? 'disabled' : ''}>Cooling fan &middot; wider safe range<span class="lead"></span><span class="v">${fmt$(WORKSHOP_FAN_PRICE)}</span></button>
    <button class="item" data-rack ${money<WEED_RACK_PRICE||w.owned.growrack>=3?'disabled':''}>Grow rack + 3 seed pods<span class="lead"></span><span class="v">${fmt$(WEED_RACK_PRICE)}</span></button>
    <button class="item" data-seeds ${money<WEED_SEEDS_PRICE?'disabled':''}>Five seed pods<span class="lead"></span><span class="v">${fmt$(WEED_SEEDS_PRICE)}</span></button>
    <button class="item" data-power ${!w.parts.some(p=>p.id==='processor'||p.id==='growrack') ? 'disabled' : ''}>${w.powered ? 'Unplug equipment' : 'Connect equipment to power'}</button>
    <h2>upgrades</h2>${upgrades}
    ${available ? '<h2>in the crate</h2>' + available : ''}${benches ? '<h2>your benches</h2>' + benches : ''}
    ${racks?'<h2>your grow racks</h2>'+racks:''}
    <p class="hint">E / Esc close. Neon: hold SPACE for power, UP vent, DOWN seal. Weed: 75 seconds of powered growth (50 with lamps); tend after sprouting for premium quality. Harvest when ready. Power off pauses growth.</p>`);
  workshopEl.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    let result;
    if (b.hasAttribute('data-call-supplier')) return callWorkshopSupplier();
    if (b.hasAttribute('data-kit')) result = orderWorkshopSupply(home,'kit');
    if (b.hasAttribute('data-refill')) result = orderWorkshopSupply(home,'refill');
    if (b.hasAttribute('data-rack')) result=orderWorkshopSupply(home,'rack');
    if (b.hasAttribute('data-seeds')) result=orderWorkshopSupply(home,'seeds');
    if (b.dataset.upgrade) result=orderWorkshopSupply(home,b.dataset.upgrade);
    if (b.dataset.plant) result=plantWeed(home,w.parts.find(p=>p.key===+b.dataset.plant));
    if (b.dataset.tend) result=tendWeed(w.parts.find(p=>p.key===+b.dataset.tend));
    if (b.dataset.harvest) result=harvestWeed(home,w.parts.find(p=>p.key===+b.dataset.harvest));
    if (b.hasAttribute('data-fan')) result=orderWorkshopSupply(home,'fan');
    if (b.hasAttribute('data-power')) w.powered = !w.powered;
    if (b.dataset.place) return beginWorkshopPlacement(b.dataset.place);
    if (b.dataset.run) return startWorkshopBatch(w.parts.find(p=>p.key===+b.dataset.run));
    if (b.dataset.pack) {
      const key = +b.dataset.pack;
      if (w.parts.find(p=>p.key===key)?.crop) return say('Harvest this plant before packing up the rack.',3);
      w.parts = w.parts.filter(p=>p.key!==key && p.bench!==key); refreshWorkshopRoom();
    }
    if (result) say(result[1], 5);
    refreshWorkshopRoom();updateDrugBuyer();saveGame(); openWorkshop();
  };
}
function beginWorkshopPlacement(id) {
  const home = workshopHome(), w = home && workshopState(home);
  if (!w || !WORKSHOP_PARTS[id] || w.owned[id] <= w.parts.filter(p=>p.id===id).length) return;
  hidePanel(workshopEl); workshopPlacement = { id, home, a: 0, held }; held = -1;
  lockMouse();
  say('Walk and look to position it. E places; Q / left click rotates; Esc cancels.', 5);
}
function workshopCandidate() {
  const placement = workshopPlacement;
  if (!placement || workshopHome() !== placement.home) return { ok:false, reason:'Return to your apartment.' };
  const { id, home } = placement, w = workshopState(home);
  if (!WORKSHOP_PARTS[id].halfX) {
    const b = w.parts.filter(p=>p.id==='bench' && !w.parts.some(q=>q.bench===p.key && q.id===id))
      .sort((p,q)=>Math.hypot(p.x-px,p.y-py)-Math.hypot(q.x-px,q.y-py))[0];
    if (!b || Math.hypot(b.x-px,b.y-py)>3) return {ok:false, reason:'Stand near a bench with a free spot for this piece.'};
    return {ok:true, ...workshopAttachment(id,b), a:mod(b.a+placement.a,Math.PI*2)};
  }
  const x = Math.round((px+Math.cos(a)*1.8)*4)/4, y = Math.round((py+Math.sin(a)*1.8)*4)/4, angle=placement.a;
  const d=WORKSHOP_PARTS[id];
  const hx = Math.abs(Math.cos(angle))*d.halfX+Math.abs(Math.sin(angle))*d.halfY, hy=Math.abs(Math.sin(angle))*d.halfX+Math.abs(Math.cos(angle))*d.halfY;
  const p = {id,x,y,a:angle}, bad = reason => ({...p,ok:false,reason});
  if (y-hy < room.H-6 || y+hy > room.H-1.4 || x-hx < 1 || x+hx > room.W-1.4) return bad('Use the open workshop area near the entrance.');
  if (Math.abs(x-room.def.entry[0]) < hx+1) return bad('Keep the center aisle to the door clear.');
  for (let yy=y-hy-.15;yy<=y+hy+.15;yy+=.2) for(let xx=x-hx-.15;xx<=x+hx+.15;xx+=.2) {
    if (roomAt(Math.floor(xx),Math.floor(yy))!=='.' || room.props.some(o=>o.box && !o.walk && o.box.z0<1.3 && inBox(o.box,xx,yy,.1))) return bad('Leave space around the furniture.');
  }
  return {...p,ok:true};
}
function endWorkshopPlacement() {
  if (!workshopPlacement) return;
  held = workshopPlacement.held < inv.length ? workshopPlacement.held : -1; workshopPlacement = null;
}
function placeWorkshopPart() {
  const p = workshopCandidate();
  if (!p.ok) return say(p.reason, 3);
  const w = workshopState(workshopPlacement.home), {ok,...part}=p;
  w.parts.push({...part,key:w.next++});
  endWorkshopPlacement(); refreshWorkshopRoom(); saveGame();
  say(`${cap(WORKSHOP_PARTS[p.id].name)} set down. E at the cupboard for the next piece.`,4);
}
function workshopKey(e) {
  if (e.repeat || !workshopPlacement) return false;
  if (e.code==='Escape'||e.code==='KeyX') {endWorkshopPlacement(); return true;}
  if (e.code==='KeyQ'||e.code==='KeyR') {workshopPlacement.a=mod(workshopPlacement.a+Math.PI/2,Math.PI*2);return true;}
  if (e.code==='KeyE') {placeWorkshopPart();return true;}
  return /^Digit/.test(e.code);
}
function drawWorkshopPreview() {
  if (!workshopPlacement) return;
  const p=workshopCandidate(); if (!Number.isFinite(p.x)) return;
  const d=WORKSHOP_PARTS[p.id], floor=!!d.halfX, b=boxAt(p.x-px,p.y-py,Math.cos(p.a),Math.sin(p.a),d.halfX||.25,d.halfY||.25,floor ? .02 : .94,floor ? .08 : 1.5);
  drawBox(b,(i,t,L)=>{set(i,'+',C(p.ok?GREEN:RED,13));return true;});
}
function startWorkshopBatch(bench) {
  const home=workshopHome(), problem=home && workshopCanRun(home,bench);
  if (!home || problem) return say(problem || 'Use your own workshop.',4);
  hidePanel(workshopEl); workshopRun={home,bench};
  const w=workshopState(home);
  startGame('workshop','workshop','',{fan:w.parts.some(p=>p.id==='fan'&&p.bench===bench.key),controller:w.upgrades.controller});
  game.onDone=quality=>{say(finishWorkshopBatch(home,bench,quality)[1],6);updateDrugBuyer();saveGame();};
}
function buyerDoor(home) {
  const clear=(x,y)=>!map[idx(Math.floor(x),Math.floor(y))]&&!isWater(x,y);
  if (home.door) for(const offset of [.24,-.24,.4,-.4,0]) {
    const [x,y]=home.door;
    for(const [dx,dy] of [[offset,0],[0,offset]]) if(clear(mod(x+dx,N),mod(y+dy,N))) return [mod(x+dx,N),mod(y+dy,N)];
  }
  const cx=home.cell%N,cy=Math.floor(home.cell/N),sh=SHOP[home.cell];
  for(let r=1;r<9;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) {
    const x=mod(cx+dx,N),y=mod(cy+dy,N);
    if(clear(x+.5,y+.5)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oy])=>SHOP[idx(mod(x+ox,N),mod(y+oy,N))]===sh)) return [x+.5,y+.5];
  }
  return null;
}
function updateDrugBuyer() {
  if (T<buyerAwayUntil || !owned.homes.length || !drugBuyerInterested()) {drugBuyer=null;return;}
  const inside=workshopHome(), home=inside || (drugBuyer && owned.homes.find(h=>h.cell===drugBuyer.home)) ||
    owned.homes.reduce((b,h)=>near(h.cell%N,Math.floor(h.cell/N),px,py)<near(b.cell%N,Math.floor(b.cell/N),px,py)?h:b);
  const doorKey = home.door?.join(',') || '';
  if (drugBuyer?.home===home.cell && drugBuyer.doorKey===doorKey) return;
  const point=buyerDoor(home); if(!point)return;
  const visit=drugBuyer?.home===home.cell?drugBuyer.visit:newDrugVisit();
  drugBuyer={home:home.cell,doorKey,x:point[0],y:point[1],visit,look:streetContactLook(drugBuyerProfile(visit.id))};
}
function nearDrugBuyer() {
  updateDrugBuyer();
  if(mode!=='walk'||!drugBuyer)return null;
  const ex=rel(drugBuyer.x-px),ey=rel(drugBuyer.y-py),d=Math.hypot(ex,ey);
  return d<.5&&(d<.12||(ex*Math.cos(a)+ey*Math.sin(a))/d>.4) ? drugBuyer : null;
}
function drawDrugBuyer() {
  updateDrugBuyer();if(drugBuyer)drawStreetContact(drugBuyer,'$',MAG);
}
function openDrugSale() {
  beginDrugNegotiation();
}
function completeDrugSale() {
  offerDrugSale();
}
function workshopPanelKey(e) {
  const el=[workshopEl,drugSaleEl,supplierEl].find(el=>el?.style.display==='flex');if(!el)return false;
  if(el===drugSaleEl && /^(INPUT|SELECT)$/.test(e.target?.tagName) && e.code!=='Escape' && e.code!=='KeyE')return true;
  if(e.code==='Escape'||e.code==='KeyE')hidePanel(el);
  else if(el===drugSaleEl&&e.code==='Digit1')completeDrugSale();
  return true;
}
function workshopPrompt() {
  if(workshopPlacement) {const p=workshopCandidate();return p.ok?'E: place equipment   Q: rotate   X: cancel':p.reason+'   X: cancel';}
  if(nearWorkshopSupplier())return 'E: Mara · supplies and equipment';
  if(nearDrugBuyer()) {
    const b=drugBuyerProfile(drugBuyer.visit.id), product=b.product==='any'?'weed or Neon':ITEMS[b.product].name;
    return `E: ${b.name} · ${product}${b.premium?' (premium)':''} · up to ${drugBuyer.visit.remaining} packs`;
  }
  const b=nearWorkshopBench();
  if(b?.id==='growrack') return b.crop?.left===0?'E: harvest weed':'E: check grow rack';
  if(b)return workshopCanRun(workshopHome(),b)?'E: set up workshop equipment':'E: run a Neon batch';
  return '';
}
function workshopUse() {
  if(workshopPlacement){placeWorkshopPart();return true;}
  if(nearWorkshopSupplier()){openWorkshopSupplier();return true;}
  if(nearDrugBuyer()){openDrugSale();return true;}
  const b=nearWorkshopBench();
  if(b?.id==='growrack') {
    if (b.crop?.left===0) {say(harvestWeed(workshopHome(),b)[1],5);refreshWorkshopRoom();updateDrugBuyer();saveGame();}
    else openWorkshop();
    return true;
  }
  if(b){if(workshopCanRun(workshopHome(),b))openWorkshop();else startWorkshopBatch(b);return true;}
  return false;
}
