// Island ferries use ship-local walking coordinates and the ordinary outdoor
// renderer. Windows are openings onto the same world, not another scene pass.
const FERRY={hl:2.25,hw:.62,deck:.14,roof:.47,dwell:32,speed:2.1,fare:4,count:2,cycle:0};
const FERRY_DECK={aft:-2.18,bow:1.96,side:.59,clearance:.04};
const FERRY_CABIN={aft:-.98,front:1.62,side:.474,wall:.018,door:.12,height:.32};
const FERRY_BENCH={hl:.085,hw:.028,bottom:.038,top:.046,back:.096};
const FERRY_STOPS=[],FERRY_LEGS=[];
let ferryRide=null,ferryClockOffset=0;
const FERRY_SEATS=[];
for(const u of [-.7,-.1,.5,1.1])for(const side of [-1,1])
  FERRY_SEATS.push({u,v:side*.415,face:-side*Math.PI/2,inside:true});
for(const u of [-1.85,-1.3])for(const side of [-1,1])
  FERRY_SEATS.push({u,v:side*.415,face:-side*Math.PI/2,inside:false});
const FERRY_SOLIDS=[
  ...FERRY_SEATS.map(s=>({u:s.u,v:s.v,hl:FERRY_BENCH.hl,hw:FERRY_BENCH.hw+.006,seat:true})),
  {u:.68,v:0,hl:.57,hw:.09,cafe:true},
  {u:1.88,v:0,hl:.26,hw:.44,bridge:true}
];
function ferryWalkClear(u,v) {
  if(u<FERRY_DECK.aft+FERRY_DECK.clearance||u>FERRY_DECK.bow-FERRY_DECK.clearance||Math.abs(v)>FERRY_DECK.side-FERRY_DECK.clearance)return false;
  // Cabin bulkheads have a wide door at the aft end; side passages stay open.
  const cabin=FERRY_CABIN;
  if(Math.abs(u-(cabin.aft+cabin.wall/2))<cabin.wall/2+.025&&Math.abs(v)<cabin.side+.025&&Math.abs(v)>cabin.door-.025)return false;
  if(u>cabin.aft&&u<cabin.front&&Math.abs(Math.abs(v)-(cabin.side-cabin.wall/2))<cabin.wall/2+.025)return false;
  return !FERRY_SOLIDS.some(s=>Math.abs(u-s.u)<s.hl+.025&&Math.abs(v-s.v)<s.hw+.025);
}
function ferryPoint(ship,u,v) {
  return [ship.x+ship.c*u-ship.s*v,ship.y+ship.s*u+ship.c*v];
}
function ferryLocal(ship,x,y) {
  const ex=x-ship.x,ey=y-ship.y;
  return [ex*ship.c+ey*ship.s,-ex*ship.s+ey*ship.c];
}
function ferrySignPosition(stop) {
  // Along the edge of the pier, leaving its boarding point and centre open.
  return stop.id==='city'?[stop.land[0]+1.1,stop.land[1]]:[stop.land[0]+.85,stop.land[1]+.4];
}
function ferryGangway(ship) {
  if(!ship.stopped)return null;
  const stop=FERRY_STOPS[ship.stop],a=ferryPoint(ship,-.98,-FERRY.hw),b=[...stop.land];
  // End at the exposed pier edge rather than layering a raised slab over it.
  const pier=PIERS.find(p=>b[0]>=p[0]&&b[0]<=p[2]&&b[1]>=p[1]&&b[1]<=p[3]);
  if(pier) {
    const ux=a[0]-b[0],uy=a[1]-b[1];
    const f=Math.min(1,ux>0?(pier[2]-b[0])/ux:ux<0?(pier[0]-b[0])/ux:Infinity,uy>0?(pier[3]-b[1])/uy:uy<0?(pier[1]-b[1])/uy:Infinity);
    b[0]+=ux*f;b[1]+=uy*f;
  }
  const ex=b[0]-a[0],ey=b[1]-a[1],length=Math.hypot(ex,ey);
  const h0=FERRY.deck,h1=outdoorGroundHeight(...stop.land),thickness=.012;
  return {x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,c:ex/length,s:ey/length,hl:length/2,hw:.1,h0,h1,axis:'x',thickness,a,b};
}
// The boarding bridge is a walkable continuation of the deck only while docked.
function ferryRampAt(ship,u,v) {
  const ramp=ferryGangway(ship);if(!ramp)return null;
  const [x,y]=ferryPoint(ship,u,v),ex=x-ramp.a[0],ey=y-ramp.a[1],length=ramp.hl*2;
  const along=ex*ramp.c+ey*ramp.s,across=-ex*ramp.s+ey*ramp.c;
  if(along<-.08||along>length+.04||Math.abs(across)>ramp.hw-.025)return null;
  return {ramp,x,y,f:clamp(along/length,0,1),end:along>=length};
}
function ferryGround() {
  if(!ferryRide)return FERRY.deck;
  const at=ferryRampAt(ferryShip(ferryRide.id),ferryRide.u,ferryRide.v);
  return at?at.ramp.h0+(at.ramp.h1-at.ramp.h0)*at.f:FERRY.deck;
}
function ferryStepAshore(stop,x=stop.land[0],y=stop.land[1]) {
  px=x;py=y;mode='walk';ferryRide=null;body.seat=null;body.z=body.vz=0;noteStreet();
  say(`${stop.name}. The ferry returns; E at this terminal to board again.`,4);
}
// A navigation disc contains the whole hull, so turns are safe too. Pier
// rectangles are tested analytically: a thin jetty cannot fall between samples.
function ferrySeaClear(x,y,pad=2.65) {
  if(x<pad||y<pad||x>MAP_WORLD.width-pad||y>MAP_WORLD.height-pad)return false;
  if(PIERS.some(p=>Math.hypot(Math.max(p[0]-x,0,x-p[2]),Math.max(p[1]-y,0,y-p[3]))<pad))return false;
  const nearRect=(x0,y0,x1,y1)=>Math.hypot(Math.max(x0-x,0,x-x1),Math.max(y0-y,0,y-y1))<pad;
  if(nearRect(FOOTBRIDGE.x-FOOTBRIDGE.hw,FOOTBRIDGE.y0,FOOTBRIDGE.x+FOOTBRIDGE.hw,FOOTBRIDGE.y1)||
    nearRect(CAUSEWAY.x-CAUSEWAY.hw,CAUSEWAY.y0,CAUSEWAY.x+CAUSEWAY.hw,CAUSEWAY.y1)||roadBridgePierAt(x,y,pad))return false;
  for(let k=0;k<13;k++) {
    const angle=k*Math.PI/6,r=k===12?0:pad,qx=x+Math.cos(angle)*r,qy=y+Math.sin(angle)*r;
    if(!seaAt(qx,qy)||roadBridgePierAt(qx,qy)||roadBridgeClearance(qx,qy)<.65)return false;
  }
  return true;
}
function ferryWaterPath(from,to,cache) {
  const step=2,w=Math.ceil(MAP_WORLD.width/step),h=Math.ceil(MAP_WORLD.height/step);
  const cell=p=>Math.floor(p[1]/step)*w+Math.floor(p[0]/step),start=cell(from),goal=cell(to);
  const score=new Map([[start,0]]),prev=new Map(),closed=new Set(),heap=[];
  const point=k=>[(k%w+.5)*step,(Math.floor(k/w)+.5)*step];
  const heuristic=k=>Math.hypot(k%w-goal%w,Math.floor(k/w)-Math.floor(goal/w));
  const push=(k,f)=>{let n=heap.length;heap.push({k,f});while(n){const p=(n-1)>>1;if(heap[p].f<=f)break;heap[n]=heap[p];n=p;}heap[n]={k,f};};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let n=0;while(n*2+1<heap.length){let c=n*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[n]=heap[c];n=c;}heap[n]=last;}return first.k;};
  const clear=k=>{if(!cache.has(k))cache.set(k,ferrySeaClear(...point(k),3.1));return cache.get(k);};
  push(start,heuristic(start));
  while(heap.length&&closed.size<80000) {
    const k=pop();if(closed.has(k))continue;
    if(k===goal) {
      const path=[to];let q=k;
      while(q!==start){path.push(point(q));q=prev.get(q);}
      path.push(point(start),from);path.reverse();
      // String-pull across clear water. Every half-cell is checked, rather than
      // trusting just the waypoints around an island headland.
      const out=[path[0]];
      const segmentClear=(a,b)=>{const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.5);for(let j=0;j<=n;j++)if(!ferrySeaClear(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n))return false;return true;};
      for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!segmentClear(path[i],path[j]))j--;out.push(path[j]);i=j;}
      return out;
    }
    closed.add(k);const x=k%w,y=Math.floor(k/w);
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
      if(!ox&&!oy||x+ox<0||y+oy<0||x+ox>=w||y+oy>=h)continue;
      const next=k+oy*w+ox;if(closed.has(next)||!clear(next))continue;
      if(ox&&oy&&(!clear(k+ox)||!clear(k+oy*w)))continue;
      const g=score.get(k)+Math.hypot(ox,oy);
      if(g>=(score.get(next)??Infinity))continue;
      score.set(next,g);prev.set(next,k);push(next,g+heuristic(next));
    }
  }
  throw Error('No safe ferry route between island terminals');
}
function buildFerryNetwork() {
  FERRY_STOPS.length=FERRY_LEGS.length=0;FERRY.cycle=0;
  if(!worldReady)return;
  const city={id:'city',name:'City Marina',x:MARINA.x+.98,y:MARINA.end+.98,yaw:0,land:[MARINA.x,MARINA.end-.13],out:[0,1]};
  FERRY_STOPS.push(city);
  for(const id of ['cabin','rock','wood','sand','fern']) {
    const island=WILD_ISLANDS.find(i=>i.id===id),p=island.dock;
    FERRY_STOPS.push({id,name:island.name,x:p[0]-.98,y:(p[1]+p[3])/2+.98,yaw:Math.PI/2,land:[p[0]+.18,(p[1]+p[3])/2],out:[-1,0]});
  }
  for(const stop of FERRY_STOPS) {
    stop.approach=[stop.x+stop.out[0]*5,stop.y+stop.out[1]*5];
    for(let n=0;n<8&&!ferrySeaClear(...stop.approach,3.1);n++) {
      stop.approach[0]+=stop.out[0]*2;stop.approach[1]+=stop.out[1]*2;
    }
  }
  const cache=new Map();
  for(let k=0;k<FERRY_STOPS.length;k++) {
    const from=FERRY_STOPS[k],to=FERRY_STOPS[(k+1)%FERRY_STOPS.length];
    const path=[[from.x,from.y],...ferryWaterPath(from.approach,to.approach,cache),[to.x,to.y]];
    const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));
    const length=lengths.reduce((a,b)=>a+b,0),motions=[];let yaw=from.yaw;
    for(let n=0;n<lengths.length;n++) {
      const p=path[n],q=path[n+1],target=n===0?from.yaw:n===lengths.length-1?to.yaw:Math.atan2(q[1]-p[1],q[0]-p[0]);
      const turn=mod(target-yaw+Math.PI,Math.PI*2)-Math.PI;
      if(Math.abs(turn)>.001)motions.push({p,q:p,yaw,target:yaw+turn,seconds:Math.abs(turn)/.22*1.5});
      yaw=target;
      if(lengths[n]>.00001)motions.push({p,q,yaw,target:yaw,seconds:lengths[n]/(n===0||n===lengths.length-1 ? .42 : FERRY.speed)});
    }
    const seconds=motions.reduce((sum,m)=>sum+m.seconds,0);
    from.time=FERRY.cycle;FERRY_LEGS.push({from:k,to:(k+1)%FERRY_STOPS.length,path,lengths,length,motions,seconds,start:FERRY.cycle});
    FERRY.cycle+=FERRY.dwell+seconds;
  }
}
function ferryShip(id,time=T) {
  if(!FERRY.cycle)return null;
  const phase=mod(time+ferryClockOffset+id*FERRY.cycle/FERRY.count,FERRY.cycle);
  const leg=FERRY_LEGS.find(l=>phase<l.start+FERRY.dwell+l.seconds)||FERRY_LEGS.at(-1),stop=FERRY_STOPS[leg.from];
  const elapsed=phase-leg.start,stopped=elapsed<FERRY.dwell;
  let x=stop.x,y=stop.y,yaw=stop.yaw;
  if(!stopped) {
    let time=elapsed-FERRY.dwell,n=0;
    while(n<leg.motions.length-1&&time>leg.motions[n].seconds)time-=leg.motions[n++].seconds;
    const motion=leg.motions[n],f=clamp(time/motion.seconds,0,1);
    x=motion.p[0]+(motion.q[0]-motion.p[0])*f;y=motion.p[1]+(motion.q[1]-motion.p[1])*f;
    yaw=motion.yaw+(motion.target-motion.yaw)*f*f*(3-2*f);
  }
  return {id,x,y,yaw,c:Math.cos(yaw),s:Math.sin(yaw),stopped,stop:leg.from,next:leg.to,left:stopped?FERRY.dwell-elapsed:leg.seconds-(elapsed-FERRY.dwell)};
}
function nearFerryTerminal() {
  return mode==='walk'?FERRY_STOPS.find(s=>Math.hypot(px-s.land[0],py-s.land[1])<.7):null;
}
function nextFerry(stop,time=T) {
  let best=null;
  for(let id=0;id<FERRY.count;id++) {
    const ship=ferryShip(id,time),phase=mod(time+ferryClockOffset+id*FERRY.cycle/FERRY.count,FERRY.cycle);
    const wait=ship.stopped&&ship.stop===FERRY_STOPS.indexOf(stop)?0:mod(stop.time-phase,FERRY.cycle)+.05;
    if(!best||wait<best.wait)best={id,wait,ship};
  }
  return best;
}
function ferrySync() {
  if(mode!=='ferry'||!ferryRide)return;
  const ship=ferryShip(ferryRide.id);if(!ship)return;
  if(Number.isFinite(ferryRide.yaw))a+=mod(ship.yaw-ferryRide.yaw+Math.PI,Math.PI*2)-Math.PI;
  ferryRide.yaw=ship.yaw;[px,py]=ferryPoint(ship,ferryRide.u,ferryRide.v);
}
function ferrySeatToggle() {
  if(!ferryRide)return;
  if(ferryRide.seat!=null) {
    const seat=FERRY_SEATS[ferryRide.seat];ferryRide.seat=null;ferryRide.v=seat.v>0 ? .22 : -.22;ferrySync();return;
  }
  let best=-1,distance=.32;
  for(let k=0;k<FERRY_SEATS.length;k++) {
    if(ferrySeatOccupied(ferryRide.id,k))continue;
    if(FERRY_SEATS[k].inside&&Math.abs(ferryRide.v)>.44)continue;
    const s=FERRY_SEATS[k],d=Math.hypot(s.u-ferryRide.u,s.v-ferryRide.v);
    if(d<distance){distance=d;best=k;}
  }
  if(best<0)return say('Move beside an empty window seat or deck bench.',2);
  const s=FERRY_SEATS[best];ferryRide.seat=best;ferryRide.u=s.u;ferryRide.v=s.v;a=ferryShip(ferryRide.id).yaw+s.face;ferrySync();
}
function ferrySeatOccupied(id,k) {
  return hash(id,k,9128)>.7&&!(mode==='ferry'&&ferryRide?.id===id&&ferryRide.seat===k);
}
function stepFerryRide(dt) {
  if(!ferryRide)return;
  const current=ferryShip(ferryRide.id);
  // A departing bridge cannot carry somebody into open water.
  if(!current.stopped&&ferryRide.v<-FERRY_DECK.side+FERRY_DECK.clearance&&ferryRide.dockStop!=null){ferryStepAshore(FERRY_STOPS[ferryRide.dockStop]);return;}
  if(current.stopped)ferryRide.dockStop=current.stop;
  ferrySync();
  const ship=ferryShip(ferryRide.id),state=ship.stopped?'dock:'+ship.stop:'sail:'+ship.next;
  if(ferryRide.state&&ferryRide.state!==state)say(ship.stopped?`${FERRY_STOPS[ship.stop].name}. The boarding gate is open for ${FERRY.dwell} seconds.`:`Casting off. Next island: ${FERRY_STOPS[ship.next].name}.`,5);
  ferryRide.state=state;
  a+=((K.ArrowRight?1:0)-(K.ArrowLeft?1:0))*2*dt;
  const f=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0),s=(K.KeyD?1:0)-(K.KeyA?1:0);
  if(!f&&!s)return;
  if(ferryRide.seat!=null)ferrySeatToggle();
  const angle=a-ferryRide.yaw,speed=(K.ShiftLeft||K.ShiftRight ? .52:.32)*dt/Math.max(1,Math.hypot(f,s));
  const du=(Math.cos(angle)*f-Math.sin(angle)*s)*speed,dv=(Math.sin(angle)*f+Math.cos(angle)*s)*speed;
  // Sweep even large test/time steps; collision cannot skip a seat or bulkhead.
  const n=Math.max(1,Math.ceil(Math.hypot(du,dv)/.025));
  for(let j=0;j<n;j++) {
    for(const axis of [0,1]) {
      const u=ferryRide.u+(axis===0?du/n:0),v=ferryRide.v+(axis===1?dv/n:0);
      const at=ferryRampAt(ship,u,v);
      if(!ferryWalkClear(u,v)&&!at)continue;
      ferryRide.u=u;ferryRide.v=v;
      if(at?.end){ferryStepAshore(FERRY_STOPS[ship.stop],at.x+at.ramp.c*.02,at.y+at.ramp.s*.02);return;}
    }
  }
  ferrySync();
}
function ferryCafeNear() {
  return mode==='ferry'&&ferryRide&&Math.abs(ferryRide.u-.68)<.8&&Math.abs(ferryRide.v)<.28;
}
function ferryHullAt(x,y,time=T) {
  if(!FERRY.cycle)return false;
  for(let id=0;id<FERRY.count;id++) {
    const ship=ferryShip(id,time);
    if(Math.hypot(x-ship.x,y-ship.y)>FERRY.hl+FERRY.hw)continue;
    const [u,v]=ferryLocal(ship,x,y);if(Math.abs(u)<FERRY.hl&&Math.abs(v)<FERRY.hw)return true;
  }
  return false;
}
function ferryPrompt() {
  if(mode==='ferry'&&ferryRide) {
    const ship=ferryShip(ferryRide.id),status=ship.stopped?`${FERRY_STOPS[ship.stop].name} · departs in ${Math.ceil(ship.left)}s`:`Next: ${FERRY_STOPS[ship.next].name} · ${Math.ceil(ship.left)}s`;
    const gate=Math.hypot(ferryRide.u+.98,ferryRide.v+.53)<.36;
    return `${status} | C: sit / stand${ferryRide.seat!=null?' | Space: wait to next island':''}${ferryCafeNear()?' | E: café · food & drinks':ship.stopped&&gate?' | Walk ashore':''}`;
  }
  const stop=nearFerryTerminal();if(!stop)return '';
  const next=nextFerry(stop);
  return `ISLAND FERRY · all five outer islands | E: ${next.wait<.1?'board':'wait & board'} · ${fmt$(FERRY.fare)}${next.wait>.1?` · arrives in ${Math.ceil(next.wait)}s`:''}`;
}
function advanceFerryTimetable(seconds) {
  // Skip a long connection or a seated voyage, with at most one game hour
  // spent waiting. Taking the ferry should not consume a day or starve you.
  const wait=Math.min(20,seconds);ferryClockOffset+=seconds-wait;
  if(wait>0){T+=wait;env(wait);stepNeeds(wait,false);}
  if(seconds>.1)for(let n=wakes.length-1;n>=0;n--)if(typeof wakes[n].b==='string'&&wakes[n].b.startsWith('island-ferry:'))wakes.splice(n,1);
}
function ferryWaitNextPort() {
  if(!ferryRide||ferryRide.seat==null)return say('Sit on a window seat or deck bench to wait until the next island.',3);
  const ship=ferryShip(ferryRide.id),seconds=ship.left+(ship.stopped?FERRY_LEGS[ship.stop].seconds:0)+.1;
  advanceFerryTimetable(seconds);ferrySync();
  say(`${FERRY_STOPS[ferryShip(ferryRide.id).stop].name}. Stand up and use the aft gate to step ashore, or stay for the next island.`,5);
}
function useFerry() {
  if(mode==='ferry'&&ferryRide) {
    if(ferryCafeNear()){openShop('ISLAND FERRY CAFÉ',['coffee','tea','water','soda','sandwich','onigiri','chips']);return true;}
    const ship=ferryShip(ferryRide.id);
    if(!ship.stopped){say('Stay aboard until the next island. The café is in the forward lounge.',3);return true;}
    if(Math.hypot(ferryRide.u+.98,ferryRide.v+.53)>.36){say('The boarding gate is aft on the port side. Follow the yellow deck markings.',3);return true;}
    ferryStepAshore(FERRY_STOPS[ship.stop]);return true;
  }
  const stop=nearFerryTerminal();if(!stop)return false;
  if(!pay(FERRY.fare)){say(`The island ferry costs ${fmt$(FERRY.fare)}.`,3);return true;}
  const next=nextFerry(stop);noteStreet();
  advanceFerryTimetable(next.wait);
  ferryRide={id:next.id,u:-.98,v:-.51,seat:null,yaw:stop.yaw};mode='ferry';body.seat=null;body.z=body.vz=0;pitch=0;a=stop.yaw-Math.PI/2;ferrySync();
  say(`Welcome aboard the Island Belle. Walk through the aft doors for window seating and the café; the open deck is behind you. ${fmt$(FERRY.fare)} paid.`,6);return true;
}
function savedFerryJourney() {
  return mode==='ferry'&&ferryRide?{kind:'ferry',id:ferryRide.id,u:ferryRide.u,v:ferryRide.v,seat:ferryRide.seat,clock:mod(T+ferryClockOffset,FERRY.cycle),view:a-ferryRide.yaw,pitch}:null;
}
function ferryFromFreecam(cam) {
  if(!FERRY.cycle||cam.z<FERRY.deck+.08||cam.z>FERRY.deck+.34)return false;
  for(let id=0;id<FERRY.count;id++) {
    const ship=ferryShip(id),[u,v]=ferryLocal(ship,cam.x,cam.y);
    let seat=null;
    if(!ferryWalkClear(u,v)) {
      seat=FERRY_SEATS.findIndex((s,k)=>!ferrySeatOccupied(id,k)&&Math.hypot(u-s.u,v-s.v)<.08);
      if(seat<0)continue;
    }
    ferryRide={id,u:seat!=null?FERRY_SEATS[seat].u:u,v:seat!=null?FERRY_SEATS[seat].v:v,seat,yaw:ship.yaw};
    mode='ferry';ferrySync();return true;
  }
  return false;
}
function loadFerryJourney(journey) {
  if(!FERRY.cycle||journey?.kind!=='ferry'||!Number.isInteger(journey.id)||journey.id<0||journey.id>=FERRY.count||![journey.u,journey.v,journey.clock,journey.view].every(Number.isFinite))return false;
  const seat=Number.isInteger(journey.seat)&&FERRY_SEATS[journey.seat];
  const clock=mod(journey.clock,FERRY.cycle)-T,previous=ferryClockOffset;ferryClockOffset=clock;
  if(!seat&&!ferryWalkClear(journey.u,journey.v)&&!ferryRampAt(ferryShip(journey.id),journey.u,journey.v)){ferryClockOffset=previous;return false;}
  ferryRide={id:journey.id,u:seat?seat.u:journey.u,v:seat?seat.v:journey.v,seat:seat?journey.seat:null,yaw:ferryShip(journey.id).yaw};
  ferryRide.dockStop=ferryShip(journey.id).stop;
  mode='ferry';body.seat=null;body.z=body.vz=0;a=ferryRide.yaw+journey.view;pitch=clamp(Number.isFinite(journey.pitch)?journey.pitch:0,-1.2,1.6);ferrySync();return true;
}
