'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=10;tod=12;env(0);render(0);money=20000;buy('home_belle');const h=owned.homes.find(h=>h.kind==='home_belle');enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},[18,12.5,0]);});
 await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('French doorway has closed wall-depth surrounds, joined open leaves and identical cached geometry at room and city scales',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);},o=room.props.find(o=>o.homeFrenchDoor),draw=drawBox;
  if(!o)return ['no built French doorway'];const p=room.def.frenchDoor,meta=o.homeFrenchDoor;
  const capture=(scale=1,base=0,vx=o.x,vy=o.y)=>{const out=[];drawBox=(b,shade,ray=rayBox)=>out.push({b:{...b},ref:b,shade,ray});try{if(scale===1)o.draw(vx,vy,o);else o.drawScaled(vx,vy,scale,base);}finally{drawBox=draw;}return out;};
  const A=capture(),again=capture(),moved=capture(1,0,o.x+.2,o.y+.3),W=capture(.1,1.6,100,150),W2=capture(.1,1.6,100.1,150.2);capture();
  check(A.length>30&&A.length===meta.parts.length&&A.length===W.length,'missing or duplicated door pieces');
  for(const [j,q]of A.entries()){
   const b=q.b,w=W[j].b;
   check(q.ref===again[j].ref&&q.ref===moved[j].ref&&q.shade===again[j].shade&&q.ray===again[j].ray&&W[j].ref===W2[j].ref&&W[j].shade===W2[j].shade,'door pieces/materials rebuilt per frame');
   check(Math.abs(w.x-(100+(b.x-o.x)/10))<1e-8&&Math.abs(w.y-(150+(b.y-o.y)/10))<1e-8&&Math.abs(w.z0-(1.6+b.z0/10))<1e-8&&Math.abs(w.z1-(1.6+b.z1/10))<1e-8&&Math.abs(w.hl-b.hl/10)<1e-8&&Math.abs(w.hw-b.hw/10)<1e-8,'city door uses different bounds or elevation');
   if(b.ax!==undefined)check(Math.abs(w.ax-(100+(b.ax-o.x)/10))<1e-8&&Math.abs(w.by-(150+(b.by-o.y)/10))<1e-8&&Math.abs(w.az-(1.6+b.az/10))<1e-8&&Math.abs(w.r-b.r/10)<1e-8,'hinge/handle endpoints or radius not scaled');
   else{const t=q.ray(b.x,b.y,b.z1+.1,0,0,-1,b);check(t>0&&Math.abs(HIT.w-b.z1)<1e-8,'open door piece cap');}
  }
  check(meta.variants.size===2,'unbounded room/city preparation cache');
  const solids=room.props.filter(o=>o.homeFrenchDoorSolid);check(solids.length===2,'no two glazed leaf colliders');
  for(const s of solids){const b=s.box,stiles=A.filter((q,j)=>meta.parts[j].role==='leaf-stile'&&Math.abs(q.b.y-b.y)<1e-8);
   check(stiles.length===2&&Math.abs(Math.min(...stiles.map(q=>q.b.x-q.b.hl))-(b.x-b.hl))<1e-8&&Math.abs(Math.max(...stiles.map(q=>q.b.x+q.b.hl))-(b.x+b.hl))<1e-8,'leaf collision differs from its frame');
   for(const z of [1.3,2.3])check(!A.some(q=>q.ray(b.x-.25,b.y-.1,z,0,1,0,q.b)>0&&q.ray(b.x-.25,b.y-.1,z,0,1,0,q.b)<.2),'painted glass blocks the live view');
  }
  const surrounds=room.props.filter(o=>o.homeFrenchDoorSurround),infill=surrounds.find(o=>o.homeFrenchDoorSurround==='infill');
  check(!!infill&&surrounds.length===9,'missing inner/outer frame or wall depth');
  for(const s of surrounds){let rendered;drawBox=(b,shade,ray=rayBox)=>rendered={b:{...b},shade,ray};try{s.draw(s.x,s.y,s);}finally{drawBox=draw;}
   check(rendered&&['x','y','hl','hw','z0','z1'].every(k=>rendered.b[k]===s.box[k]),'surround collision has no matching rendered solid');
   if(rendered){const b=rendered.b,t=rendered.ray(b.x,b.y,b.z0-.1,0,0,1,b);check(t>0&&Math.abs(HIT.w-b.z0)<1e-8&&rendered.shade(0,t,8),'surround has no painted closed underside');}
  }
  if(infill){const b=infill.box;check(b.x-b.hl===p.wall&&b.x+b.hl===p.wall+p.thickness&&b.y-b.hw===p.start&&b.y+b.hw===p.end&&b.z0===p.top&&b.z1===room.def.height,'upper infill does not close the native cut');
   const t=rayBox(b.x,b.y,1.7,0,0,1,b);check(t>0&&Math.abs(HIT.w-p.top)<1e-8&&HIT.face===6,'head has no closed soffit');}
  for(const s of surrounds.filter(o=>o.homeFrenchDoorSurround==='reveal')){const b=s.box;check(b.x-b.hl===p.wall&&b.x+b.hl===p.wall+p.thickness&&b.z0===0&&b.z1===p.top,'reveal misses wall depth or head');}
  check(room.grid[10][19]==='#'&&room.grid[14][19]==='#'&&[11,12,13].every(y=>room.grid[y][19]==='.'),'built opening does not match native cut');
  return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));

test('native walking and E return cross the open French doorway while the actual glazed leaves block at both scales',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],leaves=room.props.filter(o=>o.homeFrenchDoorSolid);if(leaves.length!==2)return ['no leaf collision'];
  for(const o of leaves){const b=o.box;if(free(20.3,b.y))bad.push('native player walks through open leaf');}
  for(const y of [11.3,12.5,13.7])for(const x of [18.7,19.3,20.3])if(!free(x,y))bad.push(['blocked clear native route',x,y]);
  px=18.3;py=12.5;for(let k=0;k<16&&mode==='room';k++)move(.1,0);if(mode!=='roof'||!homeBalconyActive())bad.push('walking does not enter real balcony');
  const b=room.balconyWorld;if(!b)return bad;
  if(Math.abs(b.doorY-(b.y+(12.5-10)/10))>1e-8)bad.push('city doorway displaced from native opening');
  for(const o of leaves){const q=o.box,x=b.x0+(20.3-19)/10,y=b.y+(q.y-10)/10;
   if(roofFree(x,y))bad.push('city player walks through open leaf');
   body.z=3;if(!roofFree(x,y))bad.push('leaf remains solid above its actual top');body.z=0;
  }
  px=b.x0+.14;py=b.doorY;for(let k=0;k<12&&mode==='roof';k++)move(-.01,0);
  if(mode!=='room'||Math.abs(px-18.7)>1e-8||!free(px,py))bad.push('walking return is blocked');
  px=19.7;py=12.5;stepHomeBalcony();px=room.balconyWorld.x0+.1;py=room.balconyWorld.doorY;
  if(!atHomeBalconyDoor())bad.push('E return is outside the visible opening');return bad;
 });assert.deepEqual(r,[]);
 await page.keyboard.press('e');assert.deepEqual(await page.evaluate(()=>[mode,px,py]),['room',18.7,12.5]);
}));

test('native room and city render the open leaves and supported head with clear panes and no duplicate painted closed doors',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],draw=drawBox;let count=0;
  const surroundHead=head=>room.props.filter(o=>o.homeFrenchDoorSurround).some(o=>{const list=[];drawBox=box=>list.push(box);try{o.draw(o.x,o.y);}finally{drawBox=draw;}return list.some(q=>q.z0===head.z0&&q.z1===head.z1&&q.x<head.x&&Math.abs(q.y-head.y)<1e-9&&q.hw>=head.hw);});
  for(const stage of ['room','city']){
   if(stage==='city'){px=22.8;py=12.5;stepHomeBalcony();}
   const b=room.balconyWorld,h=homeRecord(),o=stage==='room'?room.props.find(o=>o.homeFrenchDoor):(render(0),homeBalconyModels.get(h)?.find(o=>o.homeFrenchDoor));
   if(!o){bad.push(stage+' has no door model');continue;}
   for(const role of ['leaf-stile','casing-head']){
    const method=stage==='room'?'draw':'drawScaled',original=o[method];let active=false,paints=0;
    o[method]=(...args)=>{active=true;try{return original(...args);}finally{active=false;}};
    try{
     if(stage==='room'){px=22;py=12.5;freecam={z:1.7};a=Math.PI;}
     else{px=b.x0+.3;py=b.doorY-.23;freecam={z:b.z+.17};a=Math.atan2(b.doorY-py,b.x0-px);}
     pitch=0;render(0);const target=role==='casing-head'?2.95:1.6,dist=stage==='room'?3:Math.hypot(b.x0-px,b.doorY-py),aim=((stage==='room'?target:b.z+target/10)-freecam.z)/dist*projY/rows;
     const v=o.homeFrenchDoor.variants.get(stage==='room'?'1:0':'0.1:'+b.z),targets=new Set((v||[]).filter(p=>p.role===role).map(p=>p.view));
     // A thin part can fall between character rows, so look a row or two either side of it.
     let seen=false;for(const rowsOff of [0,-1,1,-2,2,-3,3]){
      pitch=aim+rowsOff/rows;drawBox=draw;render(0);const before=Array.from(BG);paints=0;
      drawBox=(box,shade,ray)=>draw(box,active&&targets.has(box)?(i,t,L)=>{const hit=shade(i,t,L);if(hit){paints++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
      render(0);
      // From inside, the door's own head is meant to sit behind the room-side surround head: it has to draw, and that head has to cover it.
      const covered=stage==='room'&&role==='casing-head'&&paints>=5&&surroundHead(v.find(p=>p.role===role).view);
      if(covered||paints>=5&&Array.from(BG).some((c,i)=>c===C(MAG,15)&&before[i]!==c)){seen=true;break;}
     }
     if(!seen)bad.push([stage,role,'not visible',paints]);count++;
    }finally{drawBox=draw;o[method]=original;freecam=null;}
   }
   if(stage==='city'){
    const sh=SHOP[h.cell];for(const du of [-.08,0,.08])for(const z of [.15,.23]){homeBalconyDoorFacade(0,b.z+z,false,b.x0-1,Math.floor(b.y),b.doorY+du,10,sh);if(CH[0]!==' '||BG[0]>>4===CYAN)bad.push('legacy painted closed French doors remain');}
    if(homeBalconyModels.get(h).some(o=>o.homeFrenchDoorSurround||o.homeFrenchDoorSolid))bad.push('native infill/colliders drawn as duplicate city furniture');
   }
  }return {bad,count};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,4);
}));

test('French-door finishing leaves unrelated rooms and home washroom defaults unchanged',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{const bad=[];for(const kind of ['home','loft','islandhome','islandshelter','cafe','hotelroom']){
  enterRoom(kind,{ret:[50,73,0],lobby:{word:'HOTEL',ret:[50,73,0]}},ROOM_DEFS[kind].entry||[4,4,0]);
  if(room.props.some(p=>p.homeFrenchDoor||p.homeFrenchDoorSolid||p.homeFrenchDoorSurround))bad.push(kind+' has Belle doors');
  if(['home','loft'].includes(kind)&&!room.bathroomDoors.every(p=>!p.bathroomDoor.pub&&p.bathroomDoor.open===1))bad.push('home washroom default changed');
 }return bad;});assert.deepEqual(r,[]);
}));
