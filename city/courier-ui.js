ROOM_FOR.COURIER='courier';
const COURIER_DISPATCH_LINES=['ROOFTOP COURIERS','PARCEL DISPATCH','GREEN ROOF $80','SITE RUSH $100','NIGHT RUN $120'];
function courierWall(i,u,uStep,z,d,mx,my,L) {
  if(my===0&&Math.abs(u-10.3)<2.4&&z>1.85&&z<2.85) {
    BG[i]=C(GREEN,2);
    for(const [row,text] of COURIER_DISPATCH_LINES.entries())
      if(wallText(i,u,uStep,z,d,text,10.3,(row<2?2.72:2.66)-row*.18,.15,.16,C(STONE,L),C(GREEN,2)))return true; // (the name, a gap, the routes)
    return set(i,' ',0),true;
  }
  BG[i]=C(BRICK,1+L*.12);
  return set(i,fract(u*4+(Math.floor(z*8)&1)*.5)<.12?'|':'_',C(BRICK,L*.7)),true;
}
function courierFacade(i,u,uStep,z,h,d,side,mx,my,fog,wc) {
  const L=fog*amb*(side?11:15),center=side?179.5:102.5,along=rel(wc-center);
  const readableCenter=(Math.sign(u*wc)||1)*center;
  BG[i]=C(BRICK,2+L*.2);
  if(z>h-.06||Math.abs(z-.48)<.022)return set(i,'=',C(STONE,L));
  if(z>.33&&z<.43) {
    BG[i]=C(GREEN,2);
    return wallText(i,u,uStep,z,d,'ROOFTOP COURIERS',readableCenter,.38,.09,.065,C(STONE,Math.max(L,night*12)),C(GREEN,2))||set(i,' ',0);
  }
  if(z<.33&&Math.abs(along)<.21) {
    BG[i]=C(GREEN,1+L*.16);return set(i,Math.abs(along)<.01?'|':fract(z*15)<.1?'=':':',C(STONE,L)),true;
  }
  const bay=along+.5-Math.floor(along+.5);
  if(z>.7&&z<1.2&&bay>.18&&bay<.82) {
    if(z<.73||z>1.17||bay<.21||bay>.79)return set(i,z<.73||z>1.17?'=':'|',C(STONE,L));
    BG[i]=C(CYAN,2+day);return set(i,Math.abs(bay-.5)<.012?'|':Math.abs(z-.95)<.012?'-':':',C(CYAN,L));
  }
  const mortar=fract(z*24)<.12||fract(wc*8+(Math.floor(z*24)&1)*.5)<.055;
  return set(i,mortar?'_':hash(Math.floor(wc*20),Math.floor(z*30),8)>.96?'.':' ',C(mortar?STONE:BRICK,L*.65));
}
ROOM_DEFS.courier={grid:boxRoom(14,10,{'3,0':'E','4,0':'E'}),light:.9,floor:'wood',ceil:'strip',wall:courierWall,
  ex:4,keeper:[10.3,3.1],spawn:[7,8.3],props:()=>{
    const props=[standing(10.3,3.1,GREEN),BX(10.3,4,2.1,.35,0,1,solid(BRICK))];
    for(const x of [1.7,2.5,3.3])for(const z of [0,.55])props.push(BX(x,6.2,.32,.35,z,z+.5,solid(BRICK,{top:'='})));
    props.push(BX(10,4,.3,.2,1,1.4,solid(STONE,{top:'='})),BX(11.2,4,.25,.18,1,1.3,solid(BRICK)));
    return props;
  }};
const courierRecipientNear=()=>mode==='roof'&&COURIER_ROUTES.find(r=>near(px,py,r.recipient.x,r.recipient.y)<.3&&Math.abs(roofH-r.recipient.z)<.1);
// Nico plays on after his guitar comes back, for the rest of that night.
let courierEncore=false;
function stepCourierEncore() { if(courierEncore&&tod>=4&&tod<20)courierEncore=false; }
// How loud his playing is where you stand: carried across the roofs, gone indoors.
const courierSerenade=()=>courierEncore&&mode!=='room'?clamp(1-near(px,py,COURIER_NICO.x,COURIER_NICO.y)/3,0,1)**1.5:0;
function courierPrompt() {
  if(mode==='ladder')return 'W/S: climb up/down | E or Space: let go';
  if(courierAtRecipient()){const r=courierRoute();return `E: deliver the ${r.parcel} to ${r.recipient.name}`;}
  const grab=courierLadderNear();
  if(grab){const {ladder,end}=grab;return `E: grab the ladder (${end==='bottom'?ladder.bottom[2]?'climb up':'up to the roof':ladder.bottom[2]?'climb down':'down to the street'})`;}
  if(mode==='room'&&room.kind==='courier'&&nearKeeper()) {
    if(courierJob)return 'E: ask the dispatcher about your delivery';
    const open=COURIER_ROUTES.filter(courierUnlocked);
    return open.length>1?'E: read the dispatch board':`E: take a rooftop delivery ($${open[0].pay} + up to $${open[0].bonus} speed bonus)`;
  }
  return '';
}
function courierUse() {
  if(mode==='ladder'){leaveCourierLadder();return true;}
  if(courierAtRecipient()) {
    const result=finishCourier();saveGame();
    if(result.route.id==='night')courierEncore=true;
    say(`${result.route.thanks} Delivery: ${fmt$(result.pay)}${result.bonus?` (${fmt$(result.bonus)} speed bonus)`:result.street?' (no speed bonus: you came by the street)':''}.`,6);
    return true;
  }
  const nearby=courierLadderNear();
  if(nearby){grabCourierLadder(nearby);return true;}
  if(mode==='room'&&room.kind==='courier'&&nearKeeper()) {
    if(courierJob)say(`"${courierRoute().directions} If you fall, use the apartment elevators to get back up. The parcel's safe in your courier bag, but the speed bonus is only for couriers who stay on the roofs."`,8);
    else {
      const open=COURIER_ROUTES.filter(courierUnlocked);
      if(open.length>1)openCourierBoard();else takeCourier(open[0]);
    }
    return true;
  }
  const chat=courierRecipientNear();
  if(chat){say(chat.id==='night'&&courierEncore?"Nico nods along to his own playing and doesn't stop.":chat.chat,4);return true;}
  return false;
}
function takeCourier(route) {
  if(!startCourier(route.id))return;
  saveGame();
  say(`"${route.offer}" The parcel goes in your courier bag, leaving your hands free.`,8);
}
// The dispatch board appears once a second route is open: every route, its pay and your best time.
let courierBoardEl=null;
function openCourierBoard() {
  courierBoardEl=courierBoardEl||panel('courier-board');
  const rows_=COURIER_ROUTES.map((r,k)=>{
    const unlocked=courierUnlocked(r),open=unlocked&&courierInHours(r),best=courierRecords.best[r.id],after=COURIER_ROUTES.find(o=>o.id===r.unlock);
    const value=!unlocked?`after ${after.title}`:!open?`after ${r.hours[0]-12}pm`:`$${r.pay} + $${r.bonus}${best!=null?` &middot; best ${best.toFixed(1)}s`:''}`;
    return `<button class="item" data-route="${r.id}" ${open?'':'disabled'}><span class="k">${k+1}</span><span>${r.title}: ${r.parcel} for ${r.recipient.name}</span><span class="lead"></span><span class="v">${value}</span></button>`;
  }).join('');
  showPanel(courierBoardEl,`<h1>Dispatch board</h1><p class="sub">${COURIER_COMPANY} &middot; ${courierRecords.trips} delivered</p>${rows_}<p class="hint">1-${COURIER_ROUTES.length} take a parcel &middot; E / Esc close</p>`);
  // Picking with the mouse closes the board: take the mouse back, as the number keys do.
  courierBoardEl.onclick=e=>{const b=e.target.closest('[data-route]');if(b){chooseCourier(b.dataset.route);relock(e);}};
}
function chooseCourier(id) {
  const route=COURIER_ROUTES.find(r=>r.id===id);
  if(!route||!courierUnlocked(route)||!courierInHours(route))return;
  hidePanel(courierBoardEl);takeCourier(route);
}
function courierBoardKey(e) {
  if(!courierBoardEl||courierBoardEl.style.display!=='flex')return false;
  const n=/^Digit([1-9])$/.exec(e.code);
  if(e.code==='Escape'||e.code==='KeyE')hidePanel(courierBoardEl);
  else if(n&&COURIER_ROUTES[n[1]-1])chooseCourier(COURIER_ROUTES[n[1]-1].id);
  return true;
}
function grabCourierLadder({ladder,end}) {
  const p=ladder[end];climbing={ladder,z:p[2]};
  mode='ladder';room=null;roofLot=null;body.z=body.vz=body.peak=0;body.seat=null;body.mx=body.my=0;
  px=ladder.x-Math.cos(ladder.yaw)*.08;py=ladder.y-Math.sin(ladder.yaw)*.08;a=ladder.yaw;pitch=0;
  say('W/S to climb. E or Space to let go.',3);
}
// Either end may be on a roof: the site's ladder runs from its scaffold up to the deck.
function finishCourierClimb(end) {
  const {ladder}=climbing,p=ladder[end];climbing=null;
  [px,py]=p;body.z=body.vz=body.peak=0;body.mx=body.my=0;body.groundMode=null;
  room=null;roofH=p[2];roofLot=new Set();mode=p[2]?'roof':'walk';
  if(end==='top'&&!ladder.bottom[2])notePoliceRoofEntry(px,py,[ladder.bottom[0],ladder.bottom[1],ladder.yaw]);
}
function stepCourierLadder(dt) {
  if(!climbing)return;
  const direction=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0);
  const {ladder}=climbing;
  climbing.z=clamp(climbing.z+direction*dt*.27,ladder.bottom[2],ladder.top[2]);
  if(direction>0&&climbing.z>=ladder.top[2])finishCourierClimb('top');
  else if(direction<0&&climbing.z<=ladder.bottom[2])finishCourierClimb('bottom');
}
function leaveCourierLadder() {
  if(!climbing)return;
  const {ladder,z}=climbing;
  if(z>=ladder.top[2]-.08)return finishCourierClimb('top');
  if(z<=ladder.bottom[2]+.08)return finishCourierClimb('bottom');
  climbing=null;room=null;mode='walk';roofH=0;roofLot=null;
  body.z=z*10;body.vz=0;body.peak=body.z;body.groundMode=null;
  body.mx=-Math.cos(ladder.yaw)*.18;body.my=-Math.sin(ladder.yaw)*.18;
}
function courierText() {
  const r=courierRoute();if(!r)return '';
  return `COURIER: ${r.parcel} → ${r.recipient.name}'s ${r.label.toLowerCase()} | base $${r.pay} | speed bonus ${courierJob.street?'lost':fmt$(courierJobBonus())}`;
}
// The bag shows what's in it: seed packets, a drawings tube, or a guitar's head sticking out of the flap.
const COURIER_BAG_NECK={site:[1,3],night:[1,3]};
const COURIER_BAG_ART={
  night:[' o=o', ' o|o', '  |-----.', '/=|=====\\', '|  >[]  |', '|FRAGILE|', '|_______|', ' \\_____/'],
  garden:['\\', ' \\', ' .\\----.', '/==[ ]==\\', '|  >[]  |', '| SEEDS |', '|_______|', ' \\_____/'],
  site:['  _', ' |=|', ' |=|----.', '/=|=|===\\', '|  >[]  |', '| PLANS |', '|_______|', ' \\_____/']};
function drawCourierBag() {
  if(!courierJob||!onFootMode()&&mode!=='ladder')return;
  const size=clamp(Math.round(cv.height/65),8,15),sway=climbing?Math.sin(T*5)*2:Math.sin(T*7)*Math.min(3,Math.hypot(body.mx||0,body.my||0)*4);
  const neck=COURIER_BAG_NECK[courierJob.id];
  g.font=size+'px monospace';
  artText(COURIER_BAG_ART[courierJob.id],-2+sway,cv.height-size*7.3,size,(ch,row,k)=>
    neck&&row<4&&k>=neck[0]&&k<=neck[1]?C(STONE,13):C(ch==='['||ch===']'?STONE:GREEN,13));
  g.font=FS+'px monospace';
}
function courierBox(kind,x,y,hl,hw,z0,z1,col=GRAY,block=true) {
  const o={kind,x,y,hl,hw,z0,z1,c:1,s:0,col,block};COURIER_SCENERY.push(o);return o;
}
for(const o of [...COURIER_SURFACES.filter(o=>o.kind==='bridge'),...COURIER_STAIRS]) {
  if(o.railing===false)continue;
  const vertical=o.axis==='y',length=vertical?o.hw:o.hl;
  for(const side of [-1,1]) {
    const x=o.x+(vertical?side*(o.hl+.006):0),y=o.y+(vertical?0:side*(o.hw+.006));
    const rail=courierBox('rail',x,y,vertical?.003:o.hl,vertical?o.hw:.003,0,0,GRAY);
    rail.h0=o.h0+.105;rail.h1=o.h1+.105;rail.axis=o.axis;rail.thickness=.006;
    rail.z0=Math.min(rail.h0,rail.h1)-rail.thickness;rail.z1=Math.max(rail.h0,rail.h1);rail.planes=courierSurfacePlanes(rail);
    const count=Math.ceil(length*2/.65);
    for(let k=0;k<=count;k++) {
      const position=-length+length*2*k/count;
      const sx=x+(vertical?0:position),sy=y+(vertical?position:0),z=courierSurfaceTop(o,sx,sy);
      courierBox('post',sx,sy,.004,.004,z,z+.105,GRAY);
    }
    if(o.kind==='stairs') {
      const beam=courierBox('stringer',x,y,vertical?.007:o.hl,vertical?o.hw:.007,Math.min(o.h0,o.h1),Math.max(o.h0,o.h1),GRAY,false);
      beam.h0=o.h0;beam.h1=o.h1;beam.axis=o.axis;beam.thickness=.025;
      beam.planes=[...courierSurfacePlanes(beam),[0,0,-1,-beam.z0,6]];
    }
  }
  if(o.kind==='bridge') {
    // Short bearing pads sit behind the cornice; nothing extends into the facade or the lane below.
    for(const end of [-1,1]) {
      const x=o.x+(vertical?0:end*(o.hl-.07)),y=o.y+(vertical?end*(o.hw-.07):0);
      const base=courierMapHeight(x,y);
      if(base)for(const side of [-1,1])
        courierBox('bearing',x+(vertical?side*.075:0),y+(vertical?0:side*.075),.022,.022,base,o.z0,GRAY,false);
    }
    for(const side of [-1,1]) {
      // Under-deck beams stop short of both walls, leaving their decorative cornices intact.
      courierBox('beam',o.x+(vertical?side*.085:0),o.y+(vertical?0:side*.085),
        vertical?.008:o.hl-.32,vertical?o.hw-.32:.008,o.z0-.025,o.z0,GRAY,false);
    }
  }
}
// Machinery, washing and a potting terrace give the roofs distinct purposes.
const tankZ=courierMapHeight(182.7,107.8);
const courierTank=courierBox('tank',182.7,107.8,.2,.2,tankZ+.06,tankZ+.36,BRICK);
courierTank.planes=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4),0,.19,k+1]);
courierTank.planes.push([0,0,1,courierTank.z1,5],[0,0,-1,-courierTank.z0,6]);
const tankCap=courierBox('tank-cap',182.7,107.8,.22,.22,tankZ+.36,tankZ+.45,GRAY);
tankCap.planes=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4),.22/.09,(tankZ+.45)*.22/.09,k+7]);
tankCap.planes.push([0,0,-1,-tankCap.z0,6]);
for(const x of [182.56,182.84])for(const y of [107.66,107.94])courierBox('tank-leg',x,y,.015,.015,tankZ,tankZ+.08,GRAY);
for(const x of [181,182])courierBox('laundry-pole',x,106.8,.012,.012,1.5,1.73,GRAY);
for(const x of [181.22,181.5,181.78])courierBox('laundry',x,106.8,.08,.008,1.57,1.72,[WHITE,BLUE,RED][Math.round((x-181.22)/.28)],false);
courierBox('clothesline',181.5,106.8,.5,.003,1.725,1.73,GRAY,false);
for(const [x,y] of [[198.4,101.4],[199.5,101.5],[199.65,102.7],[198.5,103.35]]) {
  const z=courierMapHeight(x,y);courierBox('planter',x,y,.15,.12,z,z+.055,BRICK);
  courierBox('plant',x,y,.12,.1,z+.055,z+.19,GREEN,false);
}
courierBox('potting-table',198.65,102.7,.24,.12,COURIER_GARDEN.z+.08,COURIER_GARDEN.z+.088,BRICK);
for(const dx of [-.2,.2])for(const dy of [-.08,.08])courierBox('table-leg',198.65+dx,102.7+dy,.009,.009,COURIER_GARDEN.z,COURIER_GARDEN.z+.08,BRICK);
courierBox('soil-sack',198.3,102.7,.075,.065,COURIER_GARDEN.z,COURIER_GARDEN.z+.09,STONE);
for(const x of [198.3,198.5])courierBox('trellis-post',x,101.4,.007,.007,1.4,1.67,BRICK);
for(const z of [1.5,1.58,1.66])courierBox('trellis',198.4,101.4,.11,.004,z,z+.005,BRICK,false);
const oldPrintSign=courierBox('print-sign',177.98,101.5,.35,.008,.65,.82,GREEN,false);
oldPrintSign.c=0;oldPrintSign.s=1;

// ---- Topping Out. Rods are tubes and cables: always one character thick, whatever the distance. Lattices are
// trusses: one box whose struts are tested on both the near and far faces, so you see through the steelwork.
const COURIER_RODS=[],COURIER_LATTICE=[],COURIER_BULBS=[];
function courierRod(kind,a,b,col=GRAY,r=.004) {
  const o={kind,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,a,b,col,r};COURIER_RODS.push(o);return o;
}
function courierLattice(kind,x,y,alongY,hl,hw,z0,z1,panel,col=YEL) {
  const o={kind,x,y,c:alongY?0:1,s:alongY?1:0,hl,hw,z0,z1,panel,col};COURIER_LATTICE.push(o);return o;
}
// A level guardrail along one edge: top rail, knee rail and posts, like the service bridges.
function courierRailRun(x0,y0,x1,y1,z,col=GRAY) {
  const vertical=x0===x1,length=vertical?y1-y0:x1-x0,x=(x0+x1)/2,y=(y0+y1)/2;
  courierBox('rail',x,y,vertical?.003:length/2,vertical?length/2:.003,z+.099,z+.105,col);
  courierBox('knee',x,y,vertical?.002:length/2,vertical?length/2:.002,z+.05,z+.054,col,false);
  const count=Math.max(1,Math.ceil(length/.32));
  for(let k=0;k<=count;k++)courierBox('post',vertical?x:x0+length*k/count,vertical?y0+length*k/count:y,.004,.004,z,z+.105,col);
}
{
  const site=COURIER_SITE.h,hang=courierHang,staging=courierMapHeight(183,111),office=courierOfficeRoof;
  // The staging roof: the crew rents a neighbour's roof for materials.
  courierBox('pallet',183.35,110.95,.13,.1,staging,staging+.015,BRICK);
  courierBox('bags',183.35,110.95,.12,.09,staging+.015,staging+.075,STONE);
  courierBox('rebar',183.2,111.6,.32,.025,staging,staging+.025,BRICK);
  // Work platforms: open at both ends, railed along their sides.
  for(const p of COURIER_PLATFORMS)for(const side of [-1,1])
    courierRailRun(p.x+side*(p.hl+.006),p.y-p.hw,p.x+side*(p.hl+.006),p.y+p.hw,hang);
  // The scaffold's street rail stops where the hoist bay opens off it; the bay is railed all round but its end.
  courierRailRun(181.75,113.734,184.55,113.734,hang);
  courierRailRun(185.006,113.74,185.006,113.98,hang);
  courierRailRun(184.55,113.514,185.45,113.514,hang);
  courierRailRun(184.544,113.52,184.544,113.74,hang);
  courierRailRun(185,113.746,185.45,113.746,hang);
  // Brackets bolt the scaffold to the frame. None reach the neighbour's bays and cornice west of x=182.
  for(const x of [182.1,182.75,183.3,184.1,184.8]) {
    courierRod('bracket',[x,113.745,hang-.012],[x,113.995,hang-.012]);
    courierRod('bracket',[x,113.75,hang-.012],[x,113.995,hang-.24]);
  }
  courierRod('bracket',[185.42,113.53,hang-.012],[184.96,113.995,hang-.3]);
  courierRod('bracket',[184.6,113.53,hang-.012],[184.6,113.995,hang-.26]);
  // Edge protection round the deck, open only at the ladder head and the walkway.
  for(const [x0,y0,x1,y1] of [[182.02,114.02,183.43,114.02],[183.67,114.02,184.98,114.02],[184.98,114.02,184.98,116.384],
    [184.98,116.516,184.98,116.98],[182.02,116.98,184.98,116.98],[182.02,114.02,182.02,116.98]])
    courierRailRun(x0,y0,x1,y1,site,YEL);
  // The walkway's rails meet the deck's at its gap; the landing closes round the plank and the stair head.
  courierRailRun(184.98,116.384,186.18,116.384,site);
  courierRailRun(184.98,116.516,186.18,116.516,site);
  courierRailRun(186.18,116.576,186.486,116.576,site);
  courierRailRun(186.486,116.27,186.486,116.576,site);
  courierRailRun(186.174,116.27,186.174,116.384,site);
  courierRailRun(186.174,116.516,186.174,116.576,site);
  courierLattice('truss',185.59,116.45,false,.59,.06,site-.08,site-.012,.1,GRAY);
  for(const x of [186.2,186.46])for(const y of [116.29,116.55])courierRod('leg',[x,y,site-.012],[x,y,office]);
  courierRod('brace',[186.2,116.29,site-.012],[186.2,116.55,office]);courierRod('brace',[186.46,116.55,site-.012],[186.46,116.29,office]);
  // Materials on the deck, clear of the walk from the ladder to the walkway.
  courierBox('formwork',183.15,116.55,.22,.16,site,site+.06,BRICK);
  courierBox('rebar',182.75,114.5,.025,.3,site,site+.025,BRICK);
  courierBox('skip',183.9,116.6,.08,.08,site,site+.1,GRAY);
  // The tower crane: a climbing mast on the deck, its jib parked over the street with the platforms on the hook.
  const mx=182.55,my=115.95,top=3.14,jib=3.2;
  courierBox('footing',mx,my,.12,.12,site,site+.03,STONE);
  courierLattice('mast',mx,my,false,.07,.07,site+.03,top,.14);
  courierBox('turntable',mx,my,.095,.095,top,jib,YEL);
  courierLattice('truss',mx,113.94,true,1.94,.05,jib,jib+.1,.12);
  courierLattice('truss',mx,116.635,true,.615,.055,jib,jib+.08,.12);
  courierBox('counterweight',mx,117.02,.07,.17,jib-.14,jib,GRAY,false);
  courierBox('cab',mx+.13,115.8,.06,.06,jib-.13,jib-.005,YEL,false);
  const apex=[mx,my,jib+.42];
  for(const x of [mx-.07,mx+.07])for(const y of [my-.07,my+.07])courierRod('head',[x,y,jib+.1],apex,YEL);
  for(const x of [mx-.04,mx+.04])courierRod('pendant',apex,[x,113.3,jib+.1],GRAY,.002);
  courierRod('pendant',apex,[mx,117.2,jib+.08],GRAY,.002);
  COURIER_SITE.beacons=[[mx,my,apex[2]],[mx,112.03,jib+.1]];
  // Trolley, hoist ropes, hook block, slings, lifting frame, and the hangers down to each platform's corners.
  const hookY=112.92,frame=site+.03;
  courierBox('trolley',mx,hookY,.055,.05,jib-.03,jib,YEL,false);
  for(const x of [mx-.015,mx+.015])courierRod('rope',[x,hookY,site+.37],[x,hookY,jib-.03],GRAY,.002);
  courierBox('hook',mx,hookY,.025,.025,site+.3,site+.37,YEL,false);
  for(const x of [182.33,182.77])for(const y of [112.32,113.52])courierRod('sling',[mx,hookY,site+.3],[x,y,frame+.03],GRAY,.002);
  for(const x of [182.33,182.77])courierRod('frame',[x,112.32,frame],[x,113.52,frame],YEL,.008);
  for(const p of COURIER_PLATFORMS)for(const y of [p.y-p.hw,p.y+p.hw]) {
    courierRod('frame',[182.33,y,frame],[182.77,y,frame],YEL,.008);
    for(const x of [182.33,182.77])courierRod('hanger',[x,y,hang],[x,y,frame],GRAY,.002);
  }
  // The site office: a cabin craned onto the roof next door, and the foreman waiting at its step.
  courierBox('cabin',187.2,114.33,.55,.175,office,office+.27,WHITE);
}
// ---- Last Set. The gantry's truss carries the catwalk; the arched LATE NITE sign hangs beneath it over the street.
{
  const A=COURIER_ARCH,deck=courierArchDeck,back=courierBackDeck,S=COURIER_ARCADE_SIGN;
  courierLattice('truss',A.x,(A.y0+A.y1)/2,true,(A.y1-A.y0)/2,.07,A.z0,A.z1-.002,.12,GRAY);
  // Bearings behind each cornice: tall on No.385's lower roof, pads on No.851's.
  for(const x of [A.x-.05,A.x+.05]) {
    courierBox('bearing',x,A.y0+.06,.015,.04,courierBacks,A.z0,GRAY,false);
    courierBox('bearing',x,A.y1-.06,.015,.04,courierMapHeight(A.x,A.y1),A.z0,GRAY,false);
  }
  courierBox('arch-sign',A.x,(A.y0+A.y1)/2,.012,.8,1,A.z0,MAG,false);
  // The walkway on over No.851's roof stands on legs; it and its stairs are railed both sides.
  for(const y of [114.7,115.3,115.88])for(const x of [178.41,178.59])courierRod('leg',[x,y,deck-.012],[x,y,courierMapHeight(x,y)]);
  for(const x of [178.384,178.616])courierRailRun(x,A.y0,x,115.9,deck);
  for(const x of [178.384,178.616])courierRailRun(x,116.9,x,117.2,back);
  // The ARCADE sign stands on the frame that carries its catwalk, the letters facing up the side street.
  courierBox('arcade-sign',(S.x0+S.x1)/2,S.y+.045,(S.x1-S.x0)/2,.025,S.z0,S.z1,MAG);
  courierLattice('truss',179.07,122.485,false,.88,.115,courierArcadeRoof,back-.012,.12,GRAY);
  courierRailRun(178.41,122.394,178.6,122.394,back);
  courierRailRun(178.184,122.4,178.184,122.62,back);courierRailRun(179.956,122.4,179.956,122.62,back);
  courierRailRun(178.19,122.626,179.62,122.626,back);courierRailRun(179.84,122.626,179.95,122.626,back);
  // Nico's corner of the bar roof: the crate he sits on to play, under a sagging string of bulbs between two poles.
  courierBox('crate',180.98,123.42,.05,.05,COURIER_NICO.z,COURIER_NICO.z+.045,BRICK);
  const bar=COURIER_NICO.z,poles=[[180.2,122.25],[181.8,122.25],[181.8,123.85]];
  for(const [x,y] of poles)courierBox('pole',x,y,.006,.006,bar,bar+.24,GRAY);
  for(let k=0;k+1<poles.length;k++) {
    const [ax,ay]=poles[k],[bx,by]=poles[k+1],n=Math.round(Math.hypot(bx-ax,by-ay)/.1);
    for(let j=0;j<n;j++) {
      const f=j/n,g=(j+1)/n,sag=q=>bar+.235-.06*Math.sin(Math.PI*q);
      courierRod('wire',[ax+(bx-ax)*f,ay+(by-ay)*f,sag(f)],[ax+(bx-ax)*g,ay+(by-ay)*g,sag(g)],GRAY,.0015);
      if(j)COURIER_BULBS.push({x:ax+(bx-ax)*f,y:ay+(by-ay)*f,z:sag(f)-.012});
    }
  }
}
const COURIER_SIGNS=[
  ['garden',179.5,102.35,'v'],['garden',179.5,106.35,'>'],['garden',182.5,107.4,'v'],['garden',183.5,108.1,'v'],
  ['garden',183.55,109.5,'>'],['garden',186.5,109.35,'^'],['garden',186.5,107.35,'>'],
  ['garden',188.2,106.85,'>'],['garden',190.7,107.4,'>'],['garden',191.4,107.4,'^'],['garden',191.4,103.4,'^'],
  ['garden',191.4,101.25,'>'],['garden',194.35,101.55,'v'],['garden',194.32,102.4,'>'],['garden',197.65,102.4,'>'],
  ['garden',182.8,106.52,'>',true],['garden',184.52,106.52,'>',true],['garden',191.6,102.35,'>',true],['garden',192.73,102.35,'>',true],
  ['site',179.5,102.35,'v'],['site',179.5,106.35,'v'],['site',179.5,108.35,'v'],['site',180.6,110.5,'>'],
  ['site',182.45,111.1,'v'],['site',182.55,112.6,'v'],['site',182.55,113.3,'v'],['site',183.1,113.86,'>'],
  ['site',184.1,115.1,'v'],['site',184.6,116.45,'>'],['site',186.33,116.42,'^'],
  ['site',183.95,113.86,'>',true],['site',185.15,113.63,'>',true],
  ['night',179.5,102.35,'v'],['night',179.5,106.35,'v'],['night',178.5,108.5,'v'],['night',178.5,110.45,'v'],
  ['night',178.5,113,'v'],['night',178.5,115.5,'v'],['night',178.4,118.3,'v'],['night',178.3,121,'v'],
  ['night',178.9,122.51,'>'],['night',180.2,123.35,'>'],['night',179.35,118.7,'>',true],['night',180.55,119.72,'v',true]]
  .map(([route,x,y,arrow,shortcut=false])=>
    ({route,x,y,arrow,shortcut,z:Math.max(courierMapHeight(x,y),courierRoofHeight(x,y))+.002}));
const courierSceneryB=bucketed(COURIER_SCENERY),courierSignsB=bucketed(COURIER_SIGNS),courierSurfacesB=bucketed(COURIER_SURFACES);
const courierRodsB=bucketed(COURIER_RODS),courierLatticeB=bucketed(COURIER_LATTICE),courierBulbsB=bucketed(COURIER_BULBS);
function courierRoofBlocked(x,y,z,pad=.025) {
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const o of courierSceneryB[bi(Math.floor(x/8)+i,Math.floor(y/8)+j)])
    if(o.block&&z<o.z1-.015&&z+.16>o.z0&&courierContains(o,x,y,pad))return true;
  return false;
}
// The glyph a short world direction makes on screen at camera-relative (x, y, z): lines drawn along themselves.
function courierGlyph(x,y,z,ux,uy,uz) {
  const d0=dx*x+dy*y,d1=dx*(x+ux*.01)+dy*(y+uy*.01);
  if(d0<.02||d1<.02)return Math.abs(uz)>Math.hypot(ux,uy)?'|':'-';
  const sx=((-dy*(x+ux*.01)+dx*(y+uy*.01))/d1-(-dy*x+dx*y)/d0)*projX*cw;
  const sy=((z-eye)/d0-(z+uz*.01-eye)/d1)*projY*FS;
  const ax=Math.abs(sx),ay=Math.abs(sy);
  if(ay>ax*2.4)return '|';
  if(ax>ay*2.4)return '-';
  return (sx>0)===(sy<0)?'/':'\\';
}
// Ray against a rod (a capsule along a-b): the nearest approach must fall within the rod or within half a screen cell.
function rayRod(ox,oy,oz,rx,ry,rz,b) {
  const ex=b.bx-b.ax,ey=b.by-b.ay,ez=b.bz-b.az,wx=ox-b.ax,wy=oy-b.ay,wz=oz-b.az;
  const A=rx*rx+ry*ry+rz*rz,B=rx*ex+ry*ey+rz*ez,Cc=ex*ex+ey*ey+ez*ez,D=rx*wx+ry*wy+rz*wz,E=ex*wx+ey*wy+ez*wz;
  const den=A*Cc-B*B;
  let s=den>1e-12?clamp((A*E-B*D)/den,0,1):0;
  let t=(B*s-D)/A;
  if(den>1e-12){s=clamp((t*B+E)/Cc,0,1);t=(B*s-D)/A;}
  if(t<.01)return -1;
  const qx=wx+rx*t-ex*s,qy=wy+ry*t-ey*s,qz=wz+rz*t-ez*s;
  const flat=Math.hypot(ex,ey)/Math.sqrt(Cc),reach=Math.max(b.r,t*(.5/projX+flat*(.5/projY-.5/projX)));
  if(qx*qx+qy*qy+qz*qz>reach*reach)return -1;
  HIT.face=0;HIT.u=b.ax+ex*s;HIT.v=b.ay+ey*s;HIT.w=b.az+ez*s;
  return t;
}
// A truss's struts in its face coordinates: s across the face, w up it (mast), or along/up (jib).
function latticeStrut(b,face,u,v,w,su,sw) {
  const P=b.panel;
  if(b.kind==='mast') {
    if(face>4)return null;
    const s=face<3?v:u,half=face<3?b.hw:b.hl,q=(w-b.z0)/P,n=Math.floor(q),p=q-n;
    if(Math.abs(s)>half-su)return 'chord';
    if(p*P<sw||(1-p)*P<sw)return 'rung';
    const target=-half+2*half*(n&1?1-p:p);
    return Math.abs(s-target)<su*1.6?(n&1?'down':'up'):null;
  }
  const q=(u+b.hl)/P,n=Math.floor(q),p=q-n;
  if(face<3)return Math.abs(v)>b.hw-su||w<b.z0+sw||w>b.z1-sw?'chord':null;
  if(face>4) {
    if(Math.abs(v)>b.hw-su)return 'chord';
    if(face===5)return null;
    if(p*P<su||(1-p)*P<su)return 'rung';
    return Math.abs(v-(-b.hw+2*b.hw*(n&1?1-p:p)))<su*1.6?(n&1?'down':'up'):null;
  }
  if(w<b.z0+sw||w>b.z1-sw)return 'chord';
  if(p*P<su||(1-p)*P<su)return 'rung';
  return Math.abs(w-(b.z0+(b.z1-b.z0)*(n&1?1-p:p)))<sw*1.6?(n&1?'down':'up'):null;
}
// Ray against a truss: the near face's steel, or failing that the far face's, seen through the gaps.
function rayLattice(ox,oy,oz,rx,ry,rz,b) {
  const qx=ox-b.x,qy=oy-b.y,lu=qx*b.c+qy*b.s,lv=-qx*b.s+qy*b.c,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
  let t0=-Infinity,t1=Infinity,f0=0,f1=0;
  const slab=(o,d,lo,hi,fLo,fHi)=>{
    if(Math.abs(d)<1e-12)return o>=lo&&o<=hi;
    let a=(lo-o)/d,c=(hi-o)/d,fa=fLo,fc=fHi;
    if(a>c){const tt=a;a=c;c=tt;fa=fHi;fc=fLo;}
    if(a>t0){t0=a;f0=fa;}
    if(c<t1){t1=c;f1=fc;}
    return t0<=t1;
  };
  if(!slab(lu,du,-b.hl,b.hl,2,1)||!slab(lv,dv,-b.hw,b.hw,4,3)||!slab(oz,rz,b.z0,b.z1,6,5))return -1;
  for(let k=0;k<2;k++) {
    const t=k?t1:t0,face=k?f1:f0;
    if(t<.01)continue;
    const u=lu+du*t,v=lv+dv*t,w=oz+rz*t,part=latticeStrut(b,face,u,v,w,Math.max(.006,t*.5/projX),Math.max(.006,t*.5/projY));
    if(part){HIT.face=face;HIT.u=u;HIT.v=v;HIT.w=w;HIT.part=part;return t;}
  }
  return -1;
}
// The direction a truss member runs, in world terms, for its glyph.
function latticeDirection(b,part,face) {
  const ux=b.c,uy=b.s,vx=-b.s,vy=b.c;
  if(b.kind==='mast') {
    if(part==='chord')return [0,0,1];
    const [sx,sy]=face<3?[vx,vy]:[ux,uy],k=part==='up'?1:part==='down'?-1:0;
    return k?[sx*k*2*b.hw,sy*k*2*b.hw,b.panel]:[sx,sy,0];
  }
  if(part==='rung')return face>4?[vx,vy,0]:[0,0,1];
  if(part==='chord')return [ux,uy,0];
  const k=part==='up'?1:-1;
  return face>4?[ux*b.panel+vx*k*2*b.hw,uy*b.panel+vy*k*2*b.hw,0]:[ux*b.panel,uy*b.panel,k*(b.z1-b.z0)];
}
// Light where neon spills on the night route: never darker than the scene, brighter near the signs.
function courierLit(L,x,y) { const spill=courierNeonSpill(x,y);return spill?Math.max(L,spill[0]*13):L; }
const COURIER_SURFACE_COLOUR={platform:GRAY,catwalk:GRAY,scaffold:ORANGE,bay:ORANGE,plank:ORANGE};
function drawCourier() {
  if(mode==='room')return;
  forNear(courierSurfacesB,o=>{
    const [x,y]=R(o.x,o.y),boards=COURIER_SURFACE_COLOUR[o.kind]??null;
    drawBox({...o,x,y},(i,t,L)=>{
      L=courierLit(L,o.x+HIT.u,o.y+HIT.v);
      const top=HIT.face===5,along=o.axis==='y'?HIT.v:HIT.u,across=o.axis==='y'?HIT.u:HIT.v;
      const half=o.axis==='y'?o.hl:o.hw;
      const edge=top&&Math.abs(across)>half-.012;
      const grain=hash(Math.floor((o.x+HIT.u)*45),Math.floor((o.y+HIT.v)*45),9);
      if(o.kind==='condenser') {
        // Two fans under round grilles on top; cooling fins down the sides.
        BG[i]=C(GRAY,1.5+L*.25);
        if(!top)return set(i,fract((o.axis==='y'?HIT.v:HIT.u)*45)<.3?'|':' ',C(GRAY,L*.7)),true;
        const r=Math.min(Math.hypot(HIT.u+o.hl/2,HIT.v),Math.hypot(HIT.u-o.hl/2,HIT.v));
        return set(i,r<.03?'o':r<.13?(fract(r*40)<.4?'@':' '):'=',C(GRAY,L*.85)),true;
      }
      if(boards!==null) {
        // Steel grating on the platforms; scaffold boards laid along the run elsewhere.
        const grate=o.kind==='platform'||o.kind==='catwalk',seam=top&&(grate?fract((along+(o.axis==='y'?o.y:o.x))*30)<.25||fract(across*30)<.25:fract(across*8/half)<.12);
        BG[i]=C(boards,1.2+L*(top?.28:.16));
        set(i,edge?'|':seam?(grate?'#':'='):grain>.9?'.':' ',C(top?boards:GRAY,L*(seam?.75:.85)));
        if(top)paintSettledSnow(i,o.x+HIT.u,o.y+HIT.v,L*.7,1,0,HIT.w);
        return true;
      }
      const seam=top&&fract((along+(o.axis==='y'?o.y:o.x))*12)<.09;
      const col=top&&!edge&&o.kind!=='hut'?BRICK:GRAY;
      BG[i]=C(col,1.5+L*(top?.32:.18));
      let ch=' ';
      if(edge)ch='|';
      else if(seam)ch='=';
      else if(grain>.88)ch='.';
      else if(grain<.08&&top)ch='-';
      set(i,ch,C(seam?STONE:col,L*(seam?.65:.85)));
      if(HIT.face===5)paintSettledSnow(i,o.x+HIT.u,o.y+HIT.v,L*.7,1,0,HIT.w);
      return true;
    },rayBeveledBay);
  });
  forNear(courierSceneryB,o=>{
    const [x,y]=R(o.x,o.y);drawBox({...o,x,y},(i,t,L)=>{
      L=courierLit(L,o.x+HIT.u,o.y+HIT.v);
      if(o.kind==='plant') {
        const leaf=hash(Math.floor((o.x+HIT.u)*65),Math.floor(HIT.w*65),Math.floor((o.y+HIT.v)*65));
        if(leaf<.4)return false;
        const col=leaf>.96?RED:GREEN;
        BG[i]=C(col,2+L*.25);return set(i,leaf>.96?'o':leaf>.7?'%':'&',C(col,L)),true;
      }
      if(o.kind==='print-sign') {
        BG[i]=C(GREEN,2);
        for(const [row,text] of ['PRINT','& POST'].entries()) {
          const q=HIT.u/.09+text.length/2,k=Math.floor(q);
          if(k>=0&&k<text.length&&oneCell((fract(q)-.5)*.09,t/projX)&&oneCell(HIT.w-(.785-row*.08),t/projY))return set(i,text[k],C(STONE,L)),true;
        }
        return set(i,' ',0),true;
      }
      if(o.kind==='cabin')return courierCabin(i,t,L,o);
      if(o.kind==='arch-sign')return courierArchSign(i,t,L,o,x,y);
      if(o.kind==='arcade-sign')return courierArcadeSign(i,t,L,o);
      if(o.kind==='cab'&&(HIT.face===1||HIT.face===4)&&HIT.w>o.z0+.04) {
        BG[i]=C(CYAN,2+day);return set(i,':',C(CYAN,Math.max(L,night*12))),true;
      }
      BG[i]=C(o.col,1.5+L*.35);
      const ch=o.kind==='tank'?(fract(HIT.w*20)<.15?'=':'|'):o.kind==='laundry'?'~':o.kind==='counterweight'||o.kind==='bags'?'#':HIT.face===5?'_':'|';
      return set(i,ch,C(o.col,L)),true;
    },o.planes?rayBeveledBay:rayBox);
  });
  forNear(courierLatticeB,o=>{
    const [x,y]=R(o.x,o.y),b={...o,x,y};
    drawBox(b,(i,t,L)=>{
      const [ux,uy,uz]=latticeDirection(o,HIT.part,HIT.face);
      set(i,courierGlyph(x+HIT.u*o.c-HIT.v*o.s,y+HIT.u*o.s+HIT.v*o.c,HIT.w,ux,uy,uz),C(o.col,courierLit(L,o.x,o.y)));
      return true;
    },rayLattice);
  });
  forNear(courierRodsB,o=>{
    const [x,y]=R(o.x,o.y),ax=x+o.a[0]-o.x,ay=y+o.a[1]-o.y,bx=x+o.b[0]-o.x,by=y+o.b[1]-o.y;
    const rod={x,y,c:1,s:0,hl:Math.abs(bx-ax)/2+.01,hw:Math.abs(by-ay)/2+.01,
      z0:Math.min(o.a[2],o.b[2])-.01,z1:Math.max(o.a[2],o.b[2])+.01,ax,ay,az:o.a[2],bx,by,bz:o.b[2],r:o.r};
    drawBox(rod,(i,t,L)=>set(i,courierGlyph(HIT.u,HIT.v,HIT.w,bx-ax,by-ay,o.b[2]-o.a[2]),C(o.col,courierLit(L,o.x,o.y)*.9)),rayRod);
  });
  // The bar roof's string of bulbs, warm at night and dead by day.
  forNear(courierBulbsB,o=>{
    // A point, one character wherever you see it from, like the rods.
    const [x,y]=R(o.x,o.y),bulb={x,y,c:1,s:0,hl:.01,hw:.01,z0:o.z-.01,z1:o.z+.01,ax:x,ay:y,az:o.z,bx:x,by:y,bz:o.z-.002,r:.004};
    drawBox(bulb,i=>(set(i,night>.25?'o':'.',C(night>.25?YEL:GRAY,night>.25?15:6)),true),rayRod);
  });
  // Aircraft warning lights on the crane head and jib tip.
  if((night>.3||overcast>.5)&&fract(T*.7)<.5)for(const [bx,by,bz] of COURIER_SITE.beacons) {
    const [x,y]=R(bx,by);drawBox({x,y,c:1,s:0,hl:.012,hw:.012,z0:bz,z1:bz+.024},i=>(set(i,'*',C(RED,15)),true));
  }
  for(const ladder of COURIER_LADDERS) {
    const [x,y]=R(ladder.x,ladder.y);if(Math.hypot(x,y)>vis)continue;
    const c=-Math.sin(ladder.yaw),s=Math.cos(ladder.yaw),z0=ladder.bottom[2],z1=ladder.top[2]+.12;
    for(const side of [-1,1])drawBox({x:x+c*.055*side,y:y+s*.055*side,c,s,hl:.007,hw:.012,z0,z1},solid(GREEN));
    drawBox({x,y,c,s,hl:.055,hw:.008,z0,z1},(i,t,L)=>{
      if(fract((HIT.w-z0)*32)>.16)return false;
      BG[i]=C(GRAY,3+L*.3);return set(i,'=',C(STONE,L)),true;
    });
  }
  // Paint on the deck, with fixed orientation rather than camera-facing floating labels. Only the parcel's route shows.
  forNear(courierSignsB,o=>{
    if(o.route!==courierJob?.id)return;
    const [x,y]=R(o.x,o.y),{arrow}=o;
    drawBox({x,y,c:1,s:0,hl:.13,hw:.09,z0:o.z,z1:o.z+.002},(i,t,L)=>{
      if(HIT.face!==5)return false;
      const u=HIT.u/.13,v=HIT.v/.09;
      const across=arrow==='>'?v:u,forward=arrow==='^'?-v:arrow==='>'?u:v;
      if(!(Math.abs(across)<.09&&forward<.45 || forward>.15&&Math.abs(across)<(.95-forward)*.65))return false;
      return set(i,'#',C(o.shortcut?CYAN:YEL,Math.max(L*1.2,night*7))),true; // (reflective paint: it catches any light)
    });
  });
  drawArt(...R(COURIER_GARDEN.x,COURIER_GARDEN.y),COURIER_GARDEN.z,.055,.175,ART.keeper,(ch,row,L)=>C(row<3?SKIN:GREEN,L));
  drawArt(...R(COURIER_FOREMAN.x,COURIER_FOREMAN.y),COURIER_FOREMAN.z,.055,.175,ART.keeper,(ch,row,L)=>C(row<1?YEL:row<3?SKIN:row<6?ORANGE:BLUE,L));
  // Nico paces until his guitar turns up, then sits on his crate and plays.
  const nico=courierEncore?[180.98,123.42,COURIER_NICO.z+.045]:[COURIER_NICO.x+Math.sin(T*.9)*.08,COURIER_NICO.y,COURIER_NICO.z];
  drawArt(...R(nico[0],nico[1]),nico[2],.055,courierEncore?.13:.175,ART.keeper,(ch,row,L)=>C(row<3?SKIN:row<6?MAG:BLACK,Math.max(L,night*7)));
}
// Big neon letters in the city's 3x5 font, centred on a sign face: s across the face (left to right as you read it),
// w up it. Returns the letter's index where a lit stroke is, else -1.
function courierNeonLetter(text,s,w,pixel,top) {
  const col=Math.floor(s/pixel+(text.length*4-1)/2),row=Math.floor((top-w)/pixel),k=Math.floor(col/4);
  return col>=0&&k<text.length&&glyphOn(text[k],col-k*4,row)?k:-1;
}
// LATE NITE: an arched panel under the gantry, lettered on both faces, its arch and top edged in tube.
function courierArchSign(i,t,L,o,x,y) {
  const v=HIT.v,base=o.z0+.14*(1-(v/o.hw)**2),lit=night>.25,glow=Math.max(L,night*15);
  if(HIT.w<base-.002)return false;
  if(HIT.face!==1&&HIT.face!==2) return BG[i]=C(GRAY,1+L*.15),set(i,'|',C(GRAY,L*.7)),true;
  BG[i]=C(lit?BLACK:BRICK,1+L*.15);
  // The tube follows the arch: at least a screen cell thick, drawn along its own slope.
  if(HIT.w<base+Math.max(.018,t/projY)) {
    const slope=-.28*v/o.hw**2;
    return set(i,courierGlyph(x+HIT.u,y+v,HIT.w,0,1,slope),C(lit?CYAN:GRAY,lit?glow:L*.6)),true;
  }
  if(HIT.w>o.z1-.018)return set(i,'=',C(lit?CYAN:GRAY,lit?glow:L*.6)),true;
  const k=courierNeonLetter('LATE NITE',HIT.face===1?-v:v,HIT.w,.041,o.z1-.045);
  if(k<0)return set(i,' ',0),true;
  // One tube on the blink, as there always is.
  const dead=k===6&&fract(T*.37)<.12;
  return set(i,'#',C(lit&&!dead?MAG:GRAY,lit&&!dead?glow:L*.6)),true;
}
// ARCADE: the storefront's chasing rainbow on the roof, bulbs round the edge; the back is plain steel.
function courierArcadeSign(i,t,L,o) {
  const lit=night>.25,glow=Math.max(L,night*15),chase=Math.floor(T*6);
  if(HIT.face!==4) {
    BG[i]=C(GRAY,1+L*.2);
    return set(i,HIT.face===3&&fract(HIT.u*6)<.08?'|':HIT.face===5?'_':' ',C(GRAY,L*.7)),true;
  }
  BG[i]=C(lit?BLACK:BLUE,1+L*.15);
  const edge=Math.abs(HIT.u)>o.hl-.03||HIT.w<o.z0+.03||HIT.w>o.z1-.03;
  if(edge) {
    const bulb=Math.floor((HIT.u+HIT.w)*30);
    return set(i,bulb&1?'*':'.',C(lit&&(bulb+chase)&1?YEL:GRAY,lit?glow:L*.6)),true;
  }
  const k=courierNeonLetter('ARCADE',-HIT.u,HIT.w,.052,o.z1-.06);
  if(k<0)return set(i,' ',0),true;
  return set(i,'#',lit?C(NEON[(k+chase)&3],glow):C(GRAY,L*.6)),true;
}
// The site office: white panels with a door and a window facing the stairs, and the contractor's name.
function courierCabin(i,t,L,o) {
  const south=HIT.face===3,u=HIT.u,w=HIT.w-o.z0;
  BG[i]=C(WHITE,1+L*.3);
  if(HIT.face===5)return set(i,fract(u*20)<.15?'=':' ',C(GRAY,L*.7)),true;
  if(south&&Math.abs(u+.35)<.06&&w<.2)return BG[i]=C(BLUE,1+L*.3),set(i,Math.abs(u+.35)>.05||w>.19?'|':Math.abs(u+.31)<.008&&Math.abs(w-.1)<.008?'o':' ',C(GRAY,L)),true;
  if(south&&Math.abs(u-.05)<.15&&w>.1&&w<.2)return BG[i]=C(CYAN,2+day),set(i,Math.abs(u-.05)>.14||w<.105||w>.195?'=':':',C(CYAN,Math.max(L,night*10))),true;
  if(south&&u>.25&&u<.5&&Math.abs(w-.17)<.03) {
    const text='SITE',q=(u-.375)/.06+text.length/2,k=Math.floor(q);
    if(k>=0&&k<text.length&&oneCell((fract(q)-.5)*.06,t/projX))return set(i,text[k],C(BLUE,Math.max(L,6))),true;
  }
  return set(i,fract(u*12)<.08||w<.012||w>.255?'|':' ',C(GRAY,L*.6)),true;
}
