// a readout over the view: its letters stay out of the fog (the street behind them doesn't)
let hudReadouts=[];
const dashText = (r, c, s, col) => { if(uiScale()!==1){hudReadouts.push({r,c,s,col,fs:FS,width:cw,rows,cols});return;} putText(r, c, s, col); for (let k = 0; k < s.length; k++) if (s[k] !== ' ' && r >= 0 && r < rows && c + k >= 0 && c + k < cols) FOGS[r * cols + c + k] = 0; };
// rows at the foot of the screen the bonnet and dashboard take from the driver's seat (the prompt and a fire on the bonnet sit above them)
const DASH_ROWS = 8;
function dash() {
  const c = me;
  if (!chaseOn) { // the bonnet and dashboard, only from the driver's seat (and never in the fog), as colour
    const top = rows - DASH_ROWS, cx = (cols - 1) / 2, lit = .6 + day * .8, glow = Math.max(night, overcast * .6);
    const wr = Math.max(10, cols * .14), wy = rows - 1.2, wh = DASH_ROWS - 3.2; // (the wheel: its hub just above the screen's foot) 
    for (let r = top; r < rows; r++) for (let x = 0; x < cols; x++) {
      const i = r * cols + x, dx = (x - cx) / cols;
      let bg = NONE;
      if (r === top) { if (Math.abs(dx) < .34) bg = C(c.body, 3.5 + lit * 4 - Math.abs(dx) * 6 + (Math.abs(dx) < .012 ? 1.2 : 0)); } // the bonnet's crown, the sky along its crease
      else if (r === top + 1) bg = C(c.body, 2.6 + lit * 3.2 - Math.abs(dx) * 5 + (Math.abs(Math.abs(dx) - .34) < .008 ? 1.2 : 0)); // its shoulders, falling away to the wings
      else if (r === top + 2) bg = C(GRAY, 2.2 + lit * .6); // the dashboard's top, catching the light
      else bg = C(GRAY, .9 - (r - top) * .06); // the dashboard, darker toward you
      if (mode === 'drive' && r > top + 1) {
        const ex = (x - cx) / wr, ey = (r - wy) / wh, d = Math.hypot(ex, ey);
        for (const sx of [-.4, .4]) { const dd = Math.hypot(((x - cx) / wr - sx) / .2, (r - (top + 3.6)) / 1.25); if (dd < 1) bg = dd > .7 ? C(GRAY, 3.5 + lit * .5) : C(glow > .3 ? CYAN : GRAY, glow > .3 ? 4 + glow * 3 : 2); } // two dials behind the wheel: a bright bezel, the face lit after dark
        if (Math.abs(d - 1) < .1) bg = C(GRAY, ey < -.8 ? 4.5 + lit : 2.6); // the rim, lit along its top
        else if (d < .24) bg = C(GRAY, d < .1 ? 5 + lit : 3); // the hub and its boss
        else if (d < 1 && Math.abs(ey + .12) < .09) bg = C(GRAY, 2.4); // the spokes out to each side
      }
      if (bg === NONE) continue; // (beside the bonnet: the road)
      set(i, ' ', 0); BG[i] = bg; FOGS[i] = FOGB[i] = 0;
    }
  }
  if (mode === 'drive' && job) { // on a taxi shift
    dashText(rows - 3, 3, `TAXI SHIFT   trips ${job.trips}   earned ${fmt$(job.earned)}${job.ride ? `   meter ${fmt$(taxiFare(job.ride.odo))}` : ''}`, C(TAXI, 15));
    dashText(rows - 2, 3, `${Math.abs(c.v * 36) | 0} km/h   ${jobLine()}`, C(WHITE, 13));
  } else if(mode==='drive'&&emergencyJob&&c===emergencyJob.car){
    const j=emergencyJob,t=emergencyTarget();
    dashText(rows-3,3,`${emergencyKindName(j.kind)} · ${j.calls} calls · ${fmt$(j.earned)} · ${c.siren?'SIREN ON':'H: SIREN'}`,C(j.kind==='amb'?CYAN:ORANGE,15));
    dashText(rows-2,3,`${Math.abs(c.v*36)|0} km/h · ${t?t.what:'Awaiting dispatch…'}`,C(WHITE,13));damageDash();
  } else if (mode === 'drive') {
    dashText(rows - 2, 3, `${Math.abs(c.v * 36) | 0} km/h`, C(CYAN, 15)); // 1 unit/s = 10 m/s
    damageDash();
  } else {
    dashText(rows - 3, 3, `TAXI   fare ${fmt$(taxiFare(c.fare))}   you have ${fmt$(money)}`, C(TAXI, 15));
    dashText(rows - 2, 3, c.dest ? `to: ${c.destName}${c.rush ? '   (stepping on it)' : TOUCH ? '' : `   G: slip the driver ${fmt$(TIP)} to step on it`}` : TOUCH ? 'Where to? Pick a stop.' : 'Where to?   1: nearest park   2: across town   3: anywhere   4: the waterfront   5: subway' + (owned.homes.length ? '   6: home' : ''), C(WHITE, 12));
  }
}

// A real carriage around the rider, drawn into the existing city depth buffer.
// Windows leave that one world render untouched: no second scene or reflection pass.
function elFrame() {
  const train=elRiding();if(!train||!ride)return;
  const car=ride.car??clamp(Math.round(ride.off/EL_CAR_LEN),-1,1),[vx,vy]=R(worldCoord(train.x+car*EL_CAR_LEN),EL_TRACK[ride.tr]);
  const floor=EL_TOP+.02,ceiling=floor+.285,hl=EL_HL-.008,hw=EL_HW-.006;
  const paint=(i,ch,col,bg)=>{FOGS[i]=FOGB[i]=0;BG[i]=bg;set(i,ch,col);return true;};
  const box=(u,v,l,w,z0,z1,shade)=>drawBox(boxAt(vx+u,vy+v,1,0,l,w,floor+z0,floor+z1),shade);
  box(0,0,hl,hw,-.008,0,(i,t,L)=>paint(i,' ',0,C(GRAY,2-roadBands(HIT.u,1/55,.12,t/projY)*.8+(Math.abs(HIT.v)<.03?.5:0)))); // ribbed rubber, the aisle worn paler
  box(0,0,hl,hw,.285,.3,(i,t,L)=>{
    const light=Math.abs(Math.abs(HIT.v)-.055)<.009,rib=roadBands(HIT.u,1/12,.04,t/projY);
    return paint(i,' ',0,light?C(WARM,Math.abs(Math.abs(HIT.v)-.055)<.005?12:9):C(WHITE,4-rib*.8)); // the light strips (a diffuser, brightest down its middle); the ceiling's panels
  });
  for(const side of [-1,1]) {
    box(0,side*hw,hl,.004,0,.285,(i,t,L)=>{
      const u=HIT.u,z=HIT.w-floor,door=[-.45*EL_HL,.45*EL_HL].find(d=>Math.abs(u-d)<.105);
      const window=[-.69,0,.69].some(x=>Math.abs(u-x)<.19);
      if(door!==undefined) {
        if(Math.abs(u-door)<.068&&z>.16&&z<.25)return false;
        const seam=Math.abs(u-door)<.004,edge=Math.abs(u-door)>.096;
        return paint(i,' ',0,edge?C(YEL,7):seam?C(GRAY,2):z<.018?C(GRAY,5.5):C(GRAY,3.5+(z>.25?.4:0))); // the doors: yellow-edged, their seam, the threshold plate
      }
      if(window&&z>.1&&z<.25)return false;
      const frame=window&&(Math.abs(z-.1)<.006||Math.abs(z-.25)<.006);
      const rib=fract((u+1)*28)<.04,trim=z<.012||Math.abs(z-.095)<.004;
      const card=z>.26&&fract(u*25)<.1;
      return paint(i,' ',0,frame?C(GRAY,5):trim?C(GRAY,2.6):z>.25?C(card?BRICK:WARM,card?2.5:4+(z>.275?.5:0)):C(WHITE,3.5-(rib?.6:0)+(z>.2?.3:0))); // window frames; the trim; ad cards along the top; the wall's panels
    });
    for(const x of [-.69,0,.69]) {
      const seat=(i,t,L)=>paint(i,' ',0,C(BLUE,HIT.face===5?6-roadBands(HIT.u+.2,1/30,.08,t/projY)*1.5:4*shadeFace(HIT.face))); // moquette, the seat's divisions sewn in
      box(x,side*(hw-.028),.19,.025,.025,.045,seat);
      box(x,side*(hw-.005),.19,.005,.045,.095,seat);
    }
    for(const x of [-.7,0,.7]) {
      const y=vy+side*.055;
      rod(vx+x,y,ceiling-.015,vx+x,y,ceiling-.055,.0025,GRAY,1.6);
      rod(vx+x-.013,y,ceiling-.055,vx+x+.013,y,ceiling-.055,.0025,WHITE,1.4);
    }
    rod(vx-hl,vy+side*.055,ceiling-.015,vx+hl,vy+side*.055,ceiling-.015,.003,GRAY,1.8);
  }
  for(const side of [-1,1]) {
    box(side*hl,0,.004,hw,0,.285,(i,t,L)=>{
      const v=HIT.v,z=HIT.w-floor,door=Math.abs(v)<.045;
      return paint(i,' ',0,door&&Math.abs(v)<.003?C(GRAY,4):door&&(Math.abs(z-.12)<.005||Math.abs(z-.24)<.005)?C(GRAY,5):C(door&&z>.12&&z<.24?GRAY:WHITE,door?2:4)); // the end door: its glass, frame and seam
    });
    rod(vx+side*.45*EL_HL,vy,floor,vx+side*.45*EL_HL,vy,ceiling-.015,.0035,GRAY,1.8);
  }
  drawElRiders({tr:ride.tr,k:ride.k,...train},true);
}

const nearestCar = r => {
  let best = null, bd = r;
  for (const c of cars) { if (playerCar(c) || c.rider || (c.ev && !c.mine)) continue; const d = Math.hypot(rel(c.x - px), rel(c.y - py)); if (d < bd) { bd = d; best = c; } } // (not the ambulance)
  return best;
};
// someone right in front of you, close enough to talk to
const nearPerson = () => {
  const target=interactionFocus();return target?.kind==='person'?target.who:null;
};
const nearVendor = () => vendors.find(v => !v.dead && !v.hidden && Math.hypot(rel(v.x - px), rel(v.y - py)) < 0.35);
// a vending machine you're facing, within arm's reach (3m of its middle)
const nearMachine = () => mode === 'walk' ? machinesB[bi(Math.floor(px / 8), Math.floor(py / 8))].find(m => {
  const ex = m.x - px, ey = m.y - py, d = Math.hypot(ex, ey), dot = (ex * Math.cos(a) + ey * Math.sin(a)) / d;
  // in view, or right beside you and anywhere in front (it beats the shop door it stands by: step away for that)
  return d < 0.3 && (d < 0.12 || dot > 0.5 || d < 0.2 && dot > 0);
}) : null;
const nearStation = () => stations.find(s => Math.hypot(rel(s.x - px), rel(s.y - py)) < 0.35);
const nearElevator = () => room.def.ex && Math.abs(px - room.def.ex) < (room.def.exReach ?? 1.3) && py < 2.4;
const canBoard = () => room.kind === 'station' && trainStopped(room) && trainDoorAmount(room)>.9 && py > ST_TRACK - 1.8 && Math.abs(px - 23) < 13;
// near a way out: a door, or the foot of the station stairs
const nearExit = () => {
  const s = room.def.stairs;
  if (s && px > s.x0 - 0.5 && px < s.x1 + 0.5 && py < s.y1 + 1.2) return true;
  for (let y = Math.floor(py - 1.4); y <= py + 1.4; y++) for (let x = Math.floor(px - 1.4); x <= px + 1.4; x++)
    if (roomAt(x, y) === 'D' && Math.hypot(x + 0.5 - px, y + 0.5 - py) < 1.6) return true;
  return false;
};
const nearLighthouse = () => mode === 'walk' && Math.hypot(rel(LIGHTHOUSE.x - px), rel(LIGHTHOUSE.y - py)) < LIGHTHOUSE.r + 0.12;
// in your own place: which thing you're by (bed, closet, tv)
const homeSpot = () => {
  const s=room.def.spots;if(!s)return null;let best=null,bd=1.3;
  for(const k in s) {
    if(room.guestHome&&k!=='tv'&&k!=='terrace')continue; // (a friend's place: their bed, closet and kitchen aren't yours to use, net.js)
    let d=Math.hypot(px-s[k][0],py-s[k][1]);
    if(k==='bed' && room.def.bedBounds) {
      const [x,y,hx,hy]=room.def.bedBounds;
      const edge=Math.hypot(Math.max(0,Math.abs(px-x)-hx),Math.max(0,Math.abs(py-y)-hy));
      if(edge>.65)continue;d=edge+.3;
    }
    if(d<bd){bd=d;best=k;}
  }
  return best;
};
const nearKeeper = () => { if(room.keeperDead||room.evacuating)return false;const k = room.def.keeper; return k && Math.hypot(px - k[0], py - k[1]) < 2&&interactionClear(k[0],k[1],1.5); };
function promptText() {
  if (mode === 'ride') return netRidePrompt(); // (in another player's car: net.js)
  if (chute) return chute.open ? '' : 'SPACE: pull the cord';
  if(furnishingPlacement){const p=furnishingCandidate();return p.ok?'E: place · Q: rotate · Esc: cancel':p.reason+' · Q: rotate · Esc: cancel';}
  const emergency=emergencyPrompt();if(emergency)return emergency;
  const focused=focusedInteractionPrompt();if(focused)return focused;
  const islandPrompt=islandBuildingPrompt();if(islandPrompt)return islandPrompt;
  const scenePrompt=streetScenePrompt();if(scenePrompt)return scenePrompt;
  if (mode === 'walk' && elStairGround(px, py) > EL_TREAD) return ''; // (up the el stairs: nothing at street level is in reach)
  const deliveryPrompt=courierPrompt();if(deliveryPrompt)return deliveryPrompt;
  const workshopLine = workshopPrompt(); if (workshopLine) return workshopLine;
  const cp = crimePrompt();
  if (cp) return cp;
  { const sp = sprayPrompt(); if (sp) return sp; } // (at the wheel, at a garage's door)
  if (mode === 'room') {
    if (room.kind === 'stadium' && nearKiosk() && !stadiumTV) return 'E: the kiosk (pies & pints)';
    if (room.kind === 'stadium') return (stadiumTV ? 'V: back to your seat   ' : (body.seat ? '' : 'C: sit down   ') + 'V: TV view   ') + 'E: leave the ground';
    const hotelPrompt=hotelAmenityPrompt();if(hotelPrompt)return hotelPrompt;
    if (room.kind === 'jail' && nearCabbie()) return 'E: talk to your cab driver   (he does not want to talk to you)';
    if (room.kind === 'jail') return T < room.until ? `In the cell: ${Math.ceil(room.until - T)}s to go${room.tried ? '' : '   E: try to break out (one chance)'}` : 'E: the guard lets you out';
    if (room.kind === 'train') return room.dest == null
      ? 'Next stop?   ' + room.opts.map((s, n) => `${n + 1}: ${stations[s].name}`).join('   ')
      : room.rideT > 0 ? `Next stop: ${stations[room.dest].name}` : '';
    if (room.kind === 'lighthouse' && Math.hypot(px - 4, py - 3.6) < 1.8) return 'E: up the stairs to the lamp room';
    if (room.def.spots) { const hs = homeSpot(); if (hs) return { terrace: 'E: sea-view terrace', bed: 'E: sleep', closet: `E: your closet (${closet.length}/${HOME_STORE_SIZE})`, workshop: 'E: apartment workshop', shelf: 'Look at a shelf to place or take items', fridge: 'E: open fridge', stove: 'E: cook', pet: homeRecord(room)?.pets?.length || homeRecord(room)?.pet ? 'E: see your pets' : 'E: bring a pet home', tv: (room.tv ? 'E: TV off' : 'E: TV on') + videoTapePrompt() }[hs]; }
    if (room.kind === 'lamproom') return Math.hypot(px - 1.4, py - 4.6) < 1.4 ? 'E: back down the stairs' : '';
    if (!pee && looNear()) return 'P: use the toilet';
    if (room.kind === 'grandhotel') { const m = grandHotelPrompt(); if (m) return m; }
    if (room.kind === 'museum' && !room.burgled) { const m = museumPrompt(); if (m) return m; }
    const drIn = droppedHere();
    if (drIn) return `E: pick up the ${ITEMS[drIn.id].name}`;
    if (nearElevator()) return room.kind==='courier'?'E: stairs to the courier roof':room.def.upPrompt||'E: elevator to the roof';
    if (canBoard()) return 'E: board the train';
    if (room.kind === 'arcade') {
      const cab = nearCabinet();
      if (cab) return cab.busy ? 'Somebody\'s playing this one' : `E: play ${GAMES[cab.game]().title} (${fmt$(CREDIT)} a credit)`;
      if (nearKeeper()) return `E: prize counter (${tickets} tickets)`;
    }
    if (room.kind === 'laundry') { const lp = laundryPrompt(); if (lp) return lp; }
    if (nearTouchPool()) return 'E: touch the touch pool';
    if (room.kind === 'cathedral') { const cp = cathedralPrompt(); if (cp) return cp; }
    if (nearVip()) return `E: a private dance (${fmt$(LAPDANCE)})`;
    if (nearStage()) return 'E: tip the dancer ($5)';
    if (nearClubCigs()) return 'E: cigarette machine';
    if (atBroker()) return `"Buying or selling?"   E: trade (${marketOpen() ? 'market open' : 'market closed'})`;
    const cs = casinoSpot();
    if (cs) return `E: play ${CASINO_NAMES[cs]} ($5 to $100 a go)`;
    if (aviaryKeeper()) return T - seedT < 12 ? 'The birds are all over you.' : `"Seed for the birds? Hold it out flat."   E: a cup of seed (${fmt$(1)})`;
    { const sp = shotengaiPrompt(); if (sp) return sp; }
    { const gp = gymPrompt(); if (gp) return gp; }
    if (roomPerson()) return 'E: talk';
    if (room.kind === 'storage' && nearKeeper()) return `E: your storage unit (${stored.length} stored)`;
    if (room.kind === 'hospital' && nearKeeper() && needs.health < maxHealth() - 5) return `E: get patched up (${fmt$(NURSE_FEE)})`;
    if (room.def.rent && nearKeeper()) return checkInOpen(tod) ? `E: book a room for the night (${fmt$(ROOM_RATE(room.word))})` : '"Check-in is from 6pm."';
    if (nearKeeper() && stockFor(room.kind, room.word).length) return room.line ? `"${room.line}"   E: shop` : 'E: shop';
    if (nearKeeper() && room.line) return `"${room.line}"`;
    if (nearExit()) return room.kind === 'station' ? 'E: up the stairs to the street' : 'E: leave';
    return '';
  }
  if (mode === 'roof') {
    const dr = droppedHere(), drop = edgeDrop(), edge = drop ? `edge: ${drop}m drop` : '';
    if (dr) return `E: pick up the ${ITEMS[dr.id].name}`;
    if (homeBalconyActive()) return atHomeBalconyDoor() ? 'E: back through the French doors' : 'Your balcony. The city below.';
    if (room && room.kind === 'cathedral') return 'The bell tower, 80m up.   E: back down the stairs';
    if(roofH===EL_TOP&&underEl(py))return 'Elevated tracks: watch for trains. Stairs down at the stations.';
    return [onRoofLot() ? 'E: take the stairs down' : 'E: fire escape down', edge].filter(Boolean).join('   ');
  }
  if (mode === 'fair') return fairRidePrompt();
  if(mode==='ferry'||nearFerryTerminal())return ferryPrompt();
  if (mode === 'boat' || mode === 'sea') { // (with a rod in hand and the boat still, you can fish over the side: fishing.js)
    if (fishing && fishingFrom()) return fishPrompt();
    const base = mode === 'boat' ? gardensPrompt() : marinaPrompt();
    return heldRod() && boatSpeed() < 0.12 ? `${base}   Q: ${third ? 'fish over the side' : 'hold to cast'}` : base;
  }
  if (mode === 'el') { const t = elRiding(); return t.stopped ? `WASD: walk | C: sit / stand | E: get off at ${EL_STATIONS[t.station].name}` : `WASD: walk | C: sit / stand | Next stop: ${EL_STATIONS[t.next].name}`; }
  if (mode === 'elplat') {
    if (elHere()) return 'E: board the train';
    const next = elTrains(T).filter(t => t.tr === plat.tr && EL_STATIONS[t.next] === plat.s && !t.stopped).map(t => t.left);
    return `E: stairs down${next.length ? `   (next train in ${Math.ceil(Math.min(...next))}s)` : ''}`;
  }
  if (mode === 'drive') return TOUCH ? 'stick: gas, brake and steer (to the rim: floor it)   get out when slow' : `W/S gas & brake | A/D steer | V: camera | ${me?.ev ? `H: lights ${me.siren ? 'off' : '& siren'} | ` : ''}E: get out (when slow)`;
  if (mode === 'taxi') return TOUCH ? 'drag: look around' : 'mouse: look around | V: camera | E: get out';
  if (mode === 'air') return airPrompt();
  { const ac = nearAircraft(); if (ac) return aircraftPrompt(ac); }
  const c = nearestCar(0.5);
  const dr = droppedHere();
  if (fishing) return fishPrompt(); // (the line's out: fishing.js)
  if (dr) return `E: pick up the ${ITEMS[dr.id].name}`;
  { const nd = netDropPrompt(); if (nd) return nd; } // (another player's: net.js)
  if (heldItem() && heldItem().id === 'spraypaint') { const it = heldItem(); return sprayAim() ? `Q (hold): spray | R: color (${SPRAY_NAMES[sprayColourOf(it)]}) | Shift: fat cap   (if the police see, it's vandalism)` : `R: color (${SPRAY_NAMES[sprayColourOf(it)]})   get close to a wall to spray`; }
  const vm = nearMachine();
  if (vm) return `E: ${VENDING[vm.kind].title.toLowerCase()}`;
  const iceLine = winterIcePrompt();
  if (iceLine) return iceLine;
  const gp = gardensPrompt() || marinaPrompt();
  if (gp) return gp;
  const ev = evPrompt(); // (an ambulance, fire engine or police car you could take: emergency-theft.js)
  if (ev) return ev;
  const shared = netCarPrompt() || netCraftPrompt(); // (another player's car, boat or aircraft: net.js)
  if (shared) return shared;
  if (c && c.v < 0.6 && c.ev && c.mine) return `E: get back in the ${EV_NAME[c.kind]}`;
  if (c && c.v < 0.6 && !c.ev) return c.body === TAXI ? 'E: get in the taxi   J: drive it (taxi shift)' : c.owned ? `E: get in your ${ITEMS[c.model].name}` : 'E: take this car';
  if (nearWalkedDog()) return 'E: pet the dog';
  if (nearAngler()) return 'E: talk to the angler';
  const who = nearPerson();
  if (who) return task && task.who === who ? (fetchHave() ? 'E: hand it over' : 'E: talk') : 'E: talk';
  if (nearDog()) return 'E: call the dog';
  const el = nearElStairs();
  if (el) return elPass && elPass.st === el.s.stairs[el.tr] ? `Up the stairs to the ${el.s.name} el` : `E: swipe in for the ${el.s.name} el, ${el.tr ? 'south' : 'north'} platform (${fmt$(SUBWAY_FARE)})`;
  const st = nearStation();
  if (st) return `E: go down to ${st.name} station (${fmt$(SUBWAY_FARE)})`;
  if (ball && Math.hypot(rel(ball.x - px), rel(ball.y - py)) < 0.3 || netOwnBallNear()) return 'E: pick up the ball'; // (or yours, while another player has it: net.js)
  const fsp = fairSpot();
  if (fsp) return fairPrompt(fsp);
  const mk = marketSpot();
  if (mk) return marketPrompt(mk);
  if (pottyNear()) return 'E: use the portapotty';
  if (nearHut()) return hutPrompt();
  { const gr = nearGrill(); if (gr) return grillPrompt(gr); } // (cooking-ui.js)
  const ven = nearVendor();
  if (ven) return `E: buy from the ${ven.type.name.toLowerCase()} cart`;
  if (nearLighthouse()) return 'E: go into the lighthouse';
  if (churchDoor()) return cathOpen() ? 'E: go into the cathedral' : 'The cathedral: locked for the night (opens at 7)';
  { const td = terminalDoor(px, py); if (td >= 0) return td ? 'E: in to the gates' : 'E: into the terminal'; }
  if (lookHit && lookHit.d < 0.35 && SHOP[idx(lookHit.mx, lookHit.my)] && SHOP[idx(lookHit.mx, lookHit.my)].kind !== SHOP_SHUT && !seamWall(lookHit)) { // (a shop shut for good is just a shuttered wall)
    const sh = SHOP[idx(lookHit.mx, lookHit.my)];
    if (sh.islandCabin) return '';
    if (sh.stadium) { const f = stadiumNextFixture(); return f.open ? `E: tickets for ${f.short}${f.live ? ' (on now)' : ', ' + f.when}` : `${f.short}, ${f.when}`; }
    if(sh.base==='fire')return 'E: enter fire station · firefighter dispatch inside';
    if (sh.base === 'amb') return 'E: go into the hospital';
    if (sh.base) return `${BASE_KINDS[sh.base].title}: staff only`;
    if (!openAt(sh, tod)) return `${sh.word}: closed, opens at ${sh.hours[0]}:00`;
    if (homeAt(sh)) return 'E: enter your apartment';
    if (sh.kind === SHOP_APTS) return 'E: enter the building (roof access)';
    return `E: enter ${sh.word}${ROOM_DEFS[ROOM_FOR[sh.word]]?.rent ? ' (roof access)' : sh.fee ? ` (${fmt$(sh.fee)})` : ''}`;
  }
  if (cars.some(c => c.body === TAXI && !c.rider && !playerCar(c) && !c.hail && !cabUnmanned(c) && Math.hypot(rel(c.x - px), rel(c.y - py)) < 2.5)) return 'H: hail the taxi';
  return fishPrompt();
}
// north-up minimap, top right: buildings shaded by height, parks, water, stations, cars, people, you, taxi destination
let showMap = false;
// the minimap (M): solid tiles so the street grid reads at a glance, in an ASCII frame with character markers to match
// the rest of the HUD. MAP_R cells each side of you; a tile is two characters wide and one tall, so it's square.
const MAP_R = 12;
const MAP_COL = { park: '#1f5a2a', sea: '#1d3f7a', construction: '#4a3a28', yard: '#3a3428', waterfront: '#4a4636' };
function mapTile(mx, my) {
  if(!MAP_WORLD.wrap&&(mx<0||my<0||mx>=MAP_WORLD.width||my>=MAP_WORLD.height))return '#080b10';
  const k = idx(mx, my), h = map[k], wx = mx + 0.5, wy = my + 0.5;
  if (h) { const v = Math.min(h, 12) * 12; return `rgb(${60 + v},${60 + v},${75 + v})`; } // taller is lighter
  if (Math.abs(rel(wx - FOOTBRIDGE.x)) < 0.6 && onFootbridge(FOOTBRIDGE.x, wy) || onPier(wx, wy)) return '#5a4030'; // (the bridge is thinner than a tile)
  if (onIsland(wx, wy)) return '#2a5a30';
  if (onCauseway(wx, wy)) return '#16161c';
  if (onAirport(wx, wy)) return airportBlocked(wx, wy) || airportBldgAt(wx, wy) ? '#8a8a96' : onRunway(wx, wy) ? '#101014' : Math.abs(wy - TAXIWAY.y) < 0.6 || worldCoord(wy) > APRON.y0 && worldCoord(wy) < APRON.y1 || worldCoord(wy) < AIRPORT.y0 + 1.6 ? '#3a3a42' : airportEdge(wx, wy) < 0.5 ? '#4a4a4a' : '#2a5a30';
  if (ROAD[k]) return underEl(wy,wx) ? '#3a2420' : '#16161c';
  if (seaAt(wx, wy) || gardenLake(wx, wy)) return oceanIceAt(wx,wy) ? '#9bc8d8' : MAP_COL.sea;
  const surface=islandSurface(wx,wy);if(surface)return surface.color;
  if(naturalCoastAt(wx,wy)){const coast=coastalGround(wx,wy);return coast.beach&&coast.depth<2?'#a18e57':'#2a5a30';}
  if (inGardens(wx, wy)) { const [gx, gy] = gardenLocal(wx, wy); return gardenPathDist(gx, gy) < 0.4 ? '#5a5038' : '#24662e'; }
  return MAP_COL[blockKind(Math.floor(worldCoord(mx) / 8), Math.floor(worldCoord(my) / 8))] || '#2a2a30';
}
function minimap() {
  if (!showMap || mode === 'room') return;
  const fs = Math.max(8, Math.round(cv.height / 100*uiScale())); g.font = fs + 'px monospace'; // ~270px across at 900 tall
  const cw_ = g.measureText('M').width, n = MAP_R * 2 + 1, W = n * 2 * cw_, H = n * fs, x0 = Math.round(cv.width - W - 14 - (TOUCH && cv.width > cv.height ? TOUCH_PAD_W - 40 : 0)); // (sideways on a phone: left of the buttons)
  const y0 = TOUCH || cv.width < 700 || uiScale()>1 ? Math.max(56, hudBottom) + fs * 1.2 : 44; // (clear of the buttons and the text on a phone)
  g.fillStyle = 'rgba(0,0,0,0.82)'; g.fillRect(x0 - cw_ * 1.5, y0 - fs * 1.2, W + cw_ * 3, H + fs * 2.4);
  const ox = Math.floor(px), oy = Math.floor(py), tw = 2 * cw_;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = mapTile(ox + i - MAP_R, oy + j - MAP_R); g.fillRect(x0 + i * tw, y0 + j * fs, tw + 0.5, fs + 0.5); }
  const inMap = (wx, wy) => { const i = Math.floor(mapDifference(wx - px,MAP_WORLD.width)) + MAP_R, j = Math.floor(mapDifference(wy - py,MAP_WORLD.height)) + MAP_R; return i >= 0 && j >= 0 && i < n && j < n ? [x0 + i * tw, y0 + j * fs] : null; };
  const mark = (wx, wy, ch, col) => { // a character on a dark chip, so it reads over any tile
    const p = inMap(wx, wy); if (!p) return;
    g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(p[0], p[1], tw, fs);
    g.fillStyle = col; g.fillText(ch, p[0] + (ch.length < 2 ? cw_ / 2 : 0), p[1]);
  };
  if(MAP_NAV.path)for(const point of MAP_NAV.path.slice(MAP_NAV.next)){const p=inMap(point.x,point.y);if(p){g.fillStyle='#78d8d1';g.fillRect(p[0]+tw*.25,p[1]+fs*.35,tw*.5,fs*.3);}}
  for (const pp of people) if (!pp.hidden) { const p = inMap(pp.x, pp.y); if (p) { g.fillStyle = '#b9a'; g.fillRect(p[0] + cw_ * 0.8, p[1] + fs * 0.4, 2, 2); } }
  for (const c of cars) if (c !== me) mark(c.x, c.y, c.pursuit || c.cop ? 'P' : 'o', c.pursuit || c.cop ? (fract(T * 3) < 0.5 ? '#f44' : '#48f') : PAL[C(c.body, 13)]); // (cop: another player's chase, net.js)
  for (const c of footCops) mark(c.x, c.y, 'p', c.chase ? (fract(T * 3) < 0.5 ? '#f44' : '#48f') : '#69f');
  for (const s of stations) mark(s.x, s.y, 'S', '#4f4');
  for (const c of owned.cars) if (c !== me) mark(c.x, c.y, 'C', '#fff');
  for (const h of owned.homes) {
    const hx = h.cell % N + 0.5, hy = Math.floor(h.cell / N) + 0.5, p = inMap(hx, hy);
    if (!p) continue;
    g.fillStyle = '#ff4'; g.fillRect(p[0] - cw_, p[1] - fs * 0.2, tw + 2 * cw_, fs * 1.4);
    mark(hx, hy, 'H', '#ff4');
  }
  for (const s of EL_STATIONS) mark(s.x, EL_Y + 1, 'E', '#f84');
  for (const v of vendors) mark(v.x, v.y, '$', '#fa3');
  mark(WHEEL.x, WHEEL.y, '*', fract(T) < 0.5 ? '#f6f' : '#ff6'); // the Ferris wheel
  const tt = taskTarget(); if (tt) mark(tt.x, tt.y, '?', '#4ff');
  const et=emergencyTarget();if(et)mark(et.x,et.y,'!','#f97');
  const jt = jobTarget(); if (jt && fract(T * 2) < 0.7) mark(jt.x, jt.y, '!', '#ff0');
  mark(...COURIER_DEPOT.door,'C','#6c9');
  const courier=courierRoute();if(courier)mark(courier.recipient.x,courier.recipient.y,'!','#6f9');
  if (me && me.dest) mark(me.dest[0], me.dest[1], 'X', '#f4f');
  if(supplierVisit)mark(supplierVisit.x,supplierVisit.y,'+','#ffd575');
  if(drugBuyer)mark(drugBuyer.x,drugBuyer.y,'$','#f8a0d9');
  if(mapWaypoint)mark(mapWaypoint.x,mapWaypoint.y,'X','#8de5df');
  for (const q of netMapPlayers()) mark(q.x, q.y, q.name[0].toUpperCase(), q.col); // (other players, in multiplayer: the first letter of their name, in their colour)
  const ang = me ? Math.atan2(me.hy, me.hx) : a; // you, and which way you're facing
  mark(px, py, '@' + ['>', 'v', '<', '^'][mod(Math.round(ang / (Math.PI / 2)), 4)], '#ff5');
  g.fillStyle = PAL[C(GRAY, 9)]; // the frame
  const edge = '+' + '-'.repeat(n * 2 + 1) + '+';
  g.fillText(edge, x0 - cw_ * 1.5, y0 - fs * 1.2); g.fillText(edge, x0 - cw_ * 1.5, y0 + H + fs * 0.2);
  for (let j = 0; j < n; j++) { g.fillText('|', x0 - cw_ * 1.5, y0 + j * fs); g.fillText('|', x0 + W + cw_ * 0.5, y0 + j * fs); }
  g.fillStyle = PAL[C(WHITE, 15)]; g.fillText('N', x0 + W / 2 - cw_ / 2, y0 - fs * 1.2);
  g.font = FS + 'px monospace';
}

// a line of HUD text broken to fit maxW px: at the wide gaps between its parts first, then between words
function wrapText(s, maxW) {
  const out = [];
  for (const part of s.split(/(?<=\S)(?=\s{3})/)) { // each part keeps its leading gap
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && g.measureText(prev + part).width <= maxW) { out[out.length - 1] = prev + part; continue; }
    let line = '';
    for (const w of part.trim().split(/\s+/)) {
      if (line && g.measureText(line + ' ' + w).width > maxW) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
    }
    if (line) out.push(line);
  }
  return out;
}
// [text, colour] for each meter: "food [######--]"
function needMeters() {
  const bar = (label, v, of = 100) => {
    v = v / of * 100; // (health is out of your max, which the gym raises)
    const n = Math.round(v / 12.5), col = v <= 0 ? (fract(T * 2) < 0.5 ? '#f44' : '#822') : v < 20 ? '#f84' : v < 50 ? '#dd5' : '#7c7';
    return [`${label} [${'#'.repeat(n)}${'-'.repeat(8 - n)}]`, col];
  };
  const out = [bar('food', needs.food), bar('drink', needs.drink)];
  if (needs.health < maxHealth()) out.push(bar('health', needs.health, maxHealth()));
  return out;
}
let hudBottom = 0; // where the text block top left ends (px), for the map and the stars to sit under on a narrow screen
function hud() {
  if(!telescopeActive()&&!stadiumTVOn()){if(emergencyHoseReady())drawHoseHeld();else drawHeldBig();} // (on the TV at the football: just the match)
  drawGunHud(); // (the crosshair, the flash, being hit: gun-ui.js)
  drawCourierBag();
  const worldFS=FS,font=g.font;g.save();FS=Math.round(worldFS*uiScale());g.font=FS+'px monospace';
  try{drawHudInformation(worldFS);}finally{FS=worldFS;g.restore();g.font=font;}
  for(const q of hudReadouts){
    const size=Math.round(q.fs*uiScale());g.font=size+'px monospace';const width=g.measureText(q.s).width;
    const x=q.c>q.cols/2?cv.width-width-3*q.width*uiScale():q.c*q.width*uiScale(),y=q.r>q.rows/2?cv.height-(q.rows-q.r)*size:q.r*size;
    g.fillStyle=PAL[q.col];g.fillText(q.s,Math.max(4,x),y);
  }
  g.font=font;
}
function drawHudInformation(worldFS){
  const hh = Math.floor(tod), mm = Math.floor(fract(tod) * 60);
  const isle = onAirport(px, py) ? 'ASCII City International Airport' : onCauseway(px, py) ? 'the Airport Bridge' : onIsland(px, py) ? 'Lighthouse Island' : onFootbridge(px, py) ? 'the Lighthouse Walk' : onFair(px, py) ? 'the Sunset Pier' : inGardens(px, py) || mode === 'boat' ? 'the Botanical Gardens' : inMarina(px, py) ? 'the Marina' : mode === 'sea' ? 'out on the bay' : '';
  const where = mode==='ferry'?'Aboard the Island Belle':mode === 'room' ? (room.kind === 'stadium' ? stadiumScoreLine() : '') : wildIslandAt(px,py)?.name || isle || [streetName(px, py), DISTRICT_TITLE[districtName(Math.floor(px / 8), Math.floor(py / 8))]].filter(Boolean).join(', ');
  const keyboardHelp = TOUCH ? settings.help ? mode === 'air' ? 'left thumb: the stick (up to climb) | Power +/-: throttle' : mode === 'sea' ? 'left thumb: throttle / helm | full forward: cruise | back: brake | drag: look' : skatingNow() ? 'left thumb: push, brake, carve (in the air: spin) | Ollie: tap, or swipe off it for a trick | hold Air out at takeoff: deck exit | drag: look' : 'left thumb: move | drag: look' : ''
    : settings.help && skatingNow() && SK.grind ? 'GRINDING: right stick / right-drag mouse left/right: balance (A/D also works) | SPACE pop off (hold an arrow: flip trick off it)'
    : settings.help && skatingNow() && SK.manual ? 'MANUAL: right stick forward/back: balance | mouse: hold right-click, move gently forward/back | A/D steer'
    : settings.help && skatingNow() ? 'SPACE hold, let go: ollie | arrows: flip tricks | right-drag: flick a trick | hold C at takeoff: air out | S hold: pivot | V: camera'
    : settings.help && mode === 'boat' ? 'E: tie up (at the jetty) | V: camera'
    : settings.help && mode === 'sea' ? 'Shift: cruise | S: astern | E: tie up (beside land) | V: camera'
    : settings.help && mode==='ferry'?`C sit | Space (seated): on to the next island | E café | I bag | 1-8 items | Q use | M map`
    : settings.help && mode==='el'?`C sit | E: get off at a station | I bag | 1-8 items | Q use | M map`
    : settings.help && chute ? (chute.open ? 'A/D or mouse: steer | W: faster down | S: flare' : 'SPACE or E: pull the cord | A/D: turn | W: track forward')
    : settings.help && mode === 'air' ? (PLANE_TYPES[pilot.type].heli ? 'R/F up & down | V: camera | E: get out (landed)' : 'MOUSE: fly | W/S throttle | V: camera | E: get out (stopped)')
    : settings.help && heldGun() ? 'hold right click: aim | R reload | Esc: pause, all controls'
    : settings.help && (mode === 'drive' || mode === 'taxi') ? 'Esc: pause, all controls' // (the car's own controls are in the prompt under it)
    : settings.help ? `I bag | P pee | H hail taxi | M map | Esc: pause, all controls` : 'Esc: pause'; // (the obvious ones, and what E or Q does where you are, are in the prompts: the rest in the pause menu's Controls)
  const help=CONTROLLER.active ? (settings.help?CONTROLLER.hint:'') : keyboardHelp;
  // on a phone the buttons take the top right: the text stays left of them, or, if that leaves it too little room (a
  // phone held upright), goes underneath them
  const bar = TOUCH ? touchBarBox() : null, beside = bar ? bar.left - 12 : cv.width - 12, baseTop = bar && beside < cv.width * 0.55 ? bar.bottom + 4 : 0;
  const top=baseTop,maxW=top?cv.width-12:beside;
  const lines = [...wrapText(`${weekday()} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${season()}, ${weather}${hurrying() ? '  >> x40' : ''}   ${fmt$(money)}${where ? '   ' + where : ''}`, maxW),
                 ...(help ? wrapText(help, maxW) : [])];
  const task_ = [...(fishingCompetitionStatus()?wrapText(fishingCompetitionStatus(),maxW):[]),...(task ? wrapText('TASK: ' + taskText(), maxW) : []),...(courierJob?wrapText(courierText(),maxW):[])];
  const meters = needMeters(),alert=needsAlert(),alertLines=alert?wrapText(alert.text,maxW):[];
  const alertHeight=alertLines.length?(FS+4)*alertLines.length+8:0;
  hudBottom = top + (lines.length + task_.length + 1) * FS + 14 + alertHeight;
  if (!stadiumTVOn()) hudBottom += drawNavigationCompass(hudBottom); // (the TV picture's just the match)
  wantedHud();
  minimap();
  g.font=FS+'px monospace';const hotbarTop = hotbar();
  g.font = FS + 'px monospace';
  const w = Math.max(...lines.map(l => g.measureText(l).width));
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, top, w + 8, FS * lines.length + 6);
  g.fillStyle = '#bbb'; lines.forEach((l, k) => g.fillText(l, 4, top + 3 + k * FS));
  { // hunger, thirst and (once it's down) health, under the help line: short bars, red and blinking when empty
    const y = top + FS * lines.length + 6;
    let x0 = 4;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, meters.reduce((t, m) => t + g.measureText(m[0]).width + g.measureText('  ').width, 4) + 4, FS + 4);
    for (const [txt, col] of meters) { g.fillStyle = col; g.fillText(txt, x0, y + 2); x0 += g.measureText(txt + '  ').width; }
  }
  if(alertLines.length){
    const y=top+FS*(lines.length+1)+10,width=Math.min(maxW+8,Math.max(...alertLines.map(s=>g.measureText(s).width))+12);
    g.fillStyle=alert.urgent?'#4b1111':'#3d2a08';g.fillRect(0,y,width,alertHeight-2);
    g.fillStyle=alert.urgent?'#ff7055':'#ffc45c';g.fillRect(0,y,3,alertHeight-2);
    g.font='bold '+FS+'px monospace';g.fillStyle=alert.urgent?'#ffd4c2':'#ffd56a';
    alertLines.forEach((s,k)=>g.fillText(s,6,y+4+k*(FS+4)));g.font=FS+'px monospace';
  }
  if (task_.length) { // the favour you're doing, under the help line
    const y = top + FS * (lines.length + 1) + 10 + alertHeight, tw = Math.max(...task_.map(l => g.measureText(l).width));
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, tw + 8, FS * task_.length + 4);
    g.fillStyle = '#4ff'; task_.forEach((l, k) => g.fillText(l, 4, y + 2 + k * FS));
  }
  // the prompt near the bottom (on a phone, in the space left of the buttons), any message under the text block
  const left = TOUCH ? Math.max(12, cv.width - TOUCH_PAD_W - 12) : cv.width - 24;
  const prompt = wrapText(keyless(promptText()), left), pb = Math.min((mode === 'drive' || mode === 'taxi' ? (chaseOn ? rows - 5 : rows - DASH_ROWS - 1) : mode === 'air' ? rows - 5 : rows - 2) * worldFS, hotbarTop - 8);
  const msg = msgT > 0 && msgText ? wrapText(msgText, cv.width - 24) : [];
  if(skatingNow()&&(SK.transition||SK.airRoute))msg.push((SK.airRoute?SK.airRoute.out:skateAirOutHeld())?'AIR OUT: DECK':'AIR: RETURN INSIDE');
  const msgY = Math.max(FS * 4, hudBottom + FS * 1.5, wantedBottom + 8);
  for (const [ls, y0, col, cx] of [[prompt, pb - prompt.length * (FS + 4), '#ff8', TOUCH ? left / 2 + 6 : cv.width / 2],
                                   [msg, msgY, '#fff', cv.width / 2]]) {
    ls.forEach((s, k) => {
      const w = g.measureText(s).width, yy = y0 + k * (FS + 4);
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(cx - w / 2 - 6, yy - 3, w + 12, FS + 6);
      g.fillStyle = col; g.fillText(s, cx - w / 2, yy);
    });
  }
  // the combo clock, under the trick: how long is left to land the next one (skate.js)
  const left_ = skatingNow() ? comboLeft() : null;
  if (left_ !== null) { // as text, like the rest of the HUD: [##########------]
    const n = 20, row = (str, yy, col) => { const w = g.measureText(str).width, x = cv.width / 2 - w / 2; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 6, yy - 3, w + 12, FS + 6); g.fillStyle = col; g.fillText(str, x, yy); };
    const y = msgY + Math.max(1, msg.length) * (FS + 4) + 2, full = Math.round(left_ * n);
    row('[' + '#'.repeat(full) + '-'.repeat(n - full) + ']', y, left_ > .5 ? '#ff4' : left_ > .25 ? '#fa3' : '#f44');
    if (SK.grind || SK.manual) { // the balance: a mark that wanders off the middle; A and D bring it back
      const b = clamp((SK.grind || SK.manual).bal, -1, 1), m = Math.round((b + 1) / 2 * (n - 1)), bar = [...'-'.repeat(n)];
      bar[(n - 1) >> 1] = '|'; bar[m] = 'o';
      row('[' + bar.join('') + ']', y + FS + 6, Math.abs(b) > .7 ? '#f44' : '#fff');
    }
  }
}
