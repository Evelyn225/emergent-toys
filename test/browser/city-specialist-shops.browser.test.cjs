'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('record bins hold their LPs in the trough between divider cards; sleeves face out on ledges behind their lips',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],B=RECORD_BIN;projX=10000;
  enterRoom('records',{word:'RECORDS',ret:[100,100,0]},[5,5,0]);
  const P=room.props,draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py}}));};
  const bins=P.filter(o=>o.recordBin);if(bins.length!==2)bad.push(['bins',bins.length]);
  for(const o of bins){const d=o.recordBin,ps=parts(o);
   // runs stand on the cabinet top inside the trough walls, cards stand taller in the gaps between runs
   for(const q of ps.filter(q=>Math.abs(q.box.z0-B.rim)<1e-9&&Math.abs(q.box.z1-B.rim-B.sleeve)<1e-9)){
    const ex=Math.abs(q.box.y-o.y)+q.box.hl,ey=Math.abs(q.box.x-o.x)+q.box.hw; // (the bin runs along y)
    if(ex>d.hl-B.wall+1e-9||ey>d.inner+1e-9)bad.push(['run through the trough',+q.box.x.toFixed(3),+q.box.y.toFixed(3)]);
   }
   const runs=d.runs.length,cards=d.cards.length;if(runs<8||cards<3)bad.push(['thin bin',runs,cards]);
   for(const c of d.cards){const near=d.runs.filter(r=>Math.abs(Math.abs(r.u-c.u)-(r.len/2+.003))<1e-9);if(near.length<4)bad.push(['card not between runs',c.u]);}
   if(ps.some(q=>q.box.z1>o.box.z1+1e-9))bad.push('part above the bin box');
  }
  const fo=P.find(o=>o.faceOut),f=fo.faceOut;
  for(const q of f.sleeves){
   const ledge=f.rows[q.row];if(Math.abs(q.z-(ledge+.025))>1e-9)bad.push(['sleeve off its ledge',q.x]);
   if(q.x-B.sleeve/2<fo.box.x-fo.box.hl-1e-9||q.x+B.sleeve/2>fo.box.x+fo.box.hl+1e-9)bad.push(['sleeve past the ledge',q.x]);
   if(f.rows[q.row+1]!==undefined&&q.z+B.sleeve>f.rows[q.row+1]-1e-9)bad.push(['sleeve into the ledge above',q.x]);
  }
  const ps=parts(fo),sl=ps.filter(q=>q.box.hl===B.sleeve/2);
  for(const q of sl)if(q.box.y-q.box.hw<1+1e-9||q.box.y+q.box.hw>1+f.ledge-.012-1e-9)bad.push(['sleeve through the wall or the lip',+q.box.y.toFixed(4)]);
  if(sl.length!==f.sleeves.length||f.sleeves.length<60)bad.push(['sleeves',sl.length,f.sleeves.length]);
  // counter, till, listening cabinet; no painted boxes; aisles round the bins
  if(P.filter(o=>o.shopCounter).length!==2)bad.push('counters');
  const till=P.find(o=>o.till),under=P.find(o=>o.shopCounter&&inBox(o.box,till.x,till.y,0));
  if(!under||Math.abs(till.box.z0-under.box.z1)>1e-9)bad.push('till not on the counter');
  if(String(ROOM_DEFS.records.props).includes('BX('))bad.push('a painted box is left');
  for(const [x,y] of [[4.7,3.7],[1.6,3.7],[7.8,3.7],[4.7,1.6],[4.7,6.2]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('tattoo parlour: till and portfolios on the glass case, binders on the low table, the rug flat on the floor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  enterRoom('tattoo',{word:'TATTOO',ret:[100,100,0]},[5,5,0]);
  const P=room.props,till=P.find(o=>o.till),stacks=P.filter(o=>o.bookStack),table=P.find(o=>o.furniture!=='counter'&&o.box&&inBox(o.box,2.75,8,0)&&o.box.z1===.42);
  const caseTop=P.filter(o=>o.box&&inBox(o.box,till.x,till.y,0)&&o!==till).map(o=>o.box.z1);
  if(!caseTop.some(z=>Math.abs(z-till.box.z0)<1e-9))bad.push('till not on the case');
  if((room.def.keeper[1]-till.y)*till.till.fy<=0)bad.push('till faces away from the artist');
  if(stacks.length!==3)bad.push(['stacks',stacks.length]);
  for(const s of stacks){const d=s.bookStack;
   const under=P.filter(o=>o!==s&&o.box&&inBox(o.box,s.x,s.y,0)).map(o=>o.box.z1);
   if(!under.some(z=>Math.abs(z-d.z)<1e-9))bad.push(['stack floating',s.x,s.y,d.z]);
   d.tops.forEach((z,k)=>{if(k&&z<=d.tops[k-1])bad.push('books not stacked');});}
  if(!table)bad.push('no low table');
  if(!P.some(o=>o.rug))bad.push('no rug');
  if(String(ROOM_DEFS.tattoo.props).includes('BX('))bad.push('a painted box is left');
  for(const [x,y] of [[4.2,8],[8,7.9],[5,6.2]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('hardware and pharmacy: counters and what stands on them, the garden corner, the blood pressure machine and the consultation desk',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py}}));};
  const onTop=(P,o)=>{const under=P.filter(u=>u!==o&&u.box&&inBox(u.box,o.x,o.y,0)).map(u=>u.box.z1);return under.some(z=>Math.abs(z-o.box.z0)<1e-9);};
  enterRoom('hardware',{word:'HARDWARE',ret:[100,100,0]},[5,5,0]);
  let P=room.props;
  for(const o of P.filter(o=>o.keyCutter||o.till))if(!onTop(P,o))bad.push(['hardware: not on the counter',o.x,o.y]);
  const hose=P.find(o=>o.hose),h=hose.hose;
  const coil=parts(hose)[0];if(coil.box.z0!==0||Math.abs(coil.box.z1-h.turns*2*h.r)>1e-9)bad.push('hose not on the floor');
  const lum=P.find(o=>o.lumber);for(const q of parts(lum))if(Math.abs(q.box.x+q.box.hw-17)>.02&&Math.abs(q.box.x+q.box.hl-17)>.02)bad.push(['board off the wall',+q.box.x.toFixed(3)]);
  const bags=P.find(o=>o.bags),bp=parts(bags).sort((a,b)=>a.box.z0-b.box.z0);bp.forEach((q,k)=>{if(Math.abs(q.box.z0-k*bags.bags.h)>1e-9)bad.push('bag not on the one below');});
  if(String(ROOM_DEFS.hardware.props).includes('BX('))bad.push('hardware: a painted box is left');
  for(const [x,y] of [[2.6,8.3],[15.2,4.6],[12,6.2]])if(!free(x,y))bad.push(['hardware aisle blocked',x,y]);
  enterRoom('pharmacy',{word:'PHARMACY',ret:[100,100,0]},[5,5,0]);P=room.props;
  const m=P.find(o=>o.monitor),desk=P.find(o=>o.desk);
  if(!onTop(P,m))bad.push('monitor not on the desk');
  const bpm=P.find(o=>o.bpMachine),seat=P.find(o=>o.seat&&Math.abs(o.x-10.15)<.01);
  if(!bpm||!seat||(seat.x-bpm.x)*bpm.bpMachine.fx<=0)bad.push('the BP machine does not face its seat');
  const ring=parts(bpm).find(q=>q.ray===homeClockRay);if(!ring||Math.abs(ring.box.centerZ-.75)>1e-9)bad.push('no cuff ring at arm height');
  if(String(ROOM_DEFS.pharmacy.props).includes('BX('))bad.push('pharmacy: a painted box is left');
  for(const [x,y] of [[6,3],[1.5,7.95],[9.5,7.4]])if(!free(x,y))bad.push(['pharmacy aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('market stalls hold their goods on the counter top under the awning, stallholders behind; the fruit shop stands face the room',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py,ax:q.box.ax+px,ay:q.box.ay+py}}));};
  enterRoom('markethall',{word:'MARKET',ret:[100,100,0]},[5,5,0]);
  const P=room.props,stalls=P.filter(o=>o.marketStall);
  if(stalls.length!==6)bad.push(['stalls',stalls.length]);
  for(const o of stalls){const d=o.marketStall,c=d.c,s=d.s,ps=parts(o);
   const local=(x,y)=>[(x-o.x)*c+(y-o.y)*s,-(x-o.x)*s+(y-o.y)*c];
   const counter=P.find(q=>q.shopCounter&&Math.abs(q.x-o.x)<1e-9&&Math.abs(q.y-o.y)<1e-9);if(!counter){bad.push([d.kind,'no counter']);continue;}
   for(const q of ps){const [u,v]=local(q.box.x,q.box.y),x=q.box;
    if(x.z1<=2)// goods: on or above the top, inside the counter's footprint (a rounded allowance for turned crates)
     {if(x.z0<d.top-1e-6)bad.push([d.kind,'goods below the top',+x.z0.toFixed(3)]);
      const ext=Math.max(x.hl,x.hw);if(Math.abs(u)>d.hl+1e-6||Math.abs(v)>d.hw+1e-6)bad.push([d.kind,'goods off the counter',+u.toFixed(2),+v.toFixed(2)]);}
   }
   const posts=ps.filter(q=>Math.abs(q.box.z1-2.15)<1e-9&&Math.abs(q.box.z0-d.top)<1e-9);
   if(posts.length!==2||posts.some(q=>local(q.box.x,q.box.y)[1]>0))bad.push([d.kind,'posts not on the stallholder edge']);
   if(!ps.some(q=>Math.abs(q.box.z0-2.15)<1e-9))bad.push([d.kind,'no awning on the posts']);
   if(d.items<4)bad.push([d.kind,'bare stall',d.items]);
  }
  const vendors=P.filter(o=>o.fig&&o.face&&stalls.some(s=>Math.hypot(s.x-o.x,s.y-o.y)<.7));if(vendors.length<5)bad.push(["stallholders",vendors.length]);
  for(const v of vendors){
   const s=stalls.find(s=>Math.hypot(s.x-v.x,s.y-v.y)<.7),d=s.marketStall;if(((v.x-s.x)*-d.s+(v.y-s.y)*d.c)>=0)bad.push([d.kind,'stallholder on the customers\' side']);}
  if(String(ROOM_DEFS.markethall.props).includes('BX('))bad.push('market hall: a painted box is left');
  enterRoom('fruitshop',{word:'FRUIT',ret:[100,100,0]},[5,5,0]);
  const st=room.props.filter(o=>o.produceStand);if(st.length!==2)bad.push(['fruit stands',st.length]);
  for(const o of st){const front=[o.x+(-o.produceStand.s)*.6,o.y+o.produceStand.c*.6];if(roomAt(front[0],front[1])!=='.'||roomAt(o.x-(-o.produceStand.s)*.6,o.y-o.produceStand.c*.6)!=='#')bad.push('fruit stand not facing the room from its wall');}
  const mt=room.props.find(o=>o.melonTable);if(!mt)bad.push('no melon table');
  if(String(ROOM_DEFS.fruitshop.props).includes('BX('))bad.push('fruit shop: a painted box is left');
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('motel, welder, tyre shop, gacha, delicatessen and deli: fittings stand on what carries them, racks on their walls, nothing painted left',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const onTop=(P,o)=>P.some(u=>u!==o&&u.box&&inBox(u.box,o.x,o.y,0)&&Math.abs(u.box.z1-o.box.z0)<1e-9);
  const draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py,ax:q.box.ax+px,ay:q.box.ay+py,bx:q.box.bx+px,by:q.box.by+py}}));};
  for(const [kind,word] of [['motel','MOTEL'],['welding','WELDING'],['tireshop','TIRES'],['gacha','GACHA'],['delicatessen','DELICATESSEN'],['deli','DELI']]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);const P=room.props;
   if(String(ROOM_DEFS[kind].props).includes('BX('))bad.push([kind,'a painted box is left']);
   for(const o of P.filter(o=>o.slicer||o.vice||o.monitor))if(!onTop(P,o))bad.push([kind,'not resting on its counter or bench',o.x,o.y]);
   if(kind==='motel'){const b=P.find(o=>o.brochures),edge=b.box.x+(Math.abs(b.box.s??0)>.5?b.box.hw:b.box.hl);if(Math.abs(edge-9)>.02)bad.push(['brochure rack off the wall',edge]);}
   if(kind==='welding'){const rk=P.find(o=>o.steelRack),ps=parts(rk),bars=ps.filter(q=>q.ray===coveRayCapsule);
    if(bars.length<12)bad.push(['steel bars',bars.length]);
    for(const q of bars)if(!rk.steelRack.arms.some(z=>Math.abs(q.box.az-q.box.r-z)<1e-9))bad.push('a bar not lying on the arms');}
   if(kind==='deli'){const back=P.find(o=>o.shopCounter&&o.box.hl>4);if(!back||back.box.y-back.box.hw<1-1e-9)bad.push('deli back counter in the wall');
    if(back&&Math.abs(back.box.y-back.box.hw-1)>1e-9)bad.push('deli back counter off the wall');}
  }
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('the last shop rooms: the store roller, reading chair, tailor tables and mirror, suitcases resting, the showroom and agency desks',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const onTop=(P,o)=>P.some(u=>u!==o&&u.box&&inBox(u.box,o.x,o.y,0)&&Math.abs(u.box.z1-o.box.z0)<1e-9);
  const rooms=[['store','24/7'],['books','BOOKS'],['tailor','TAILOR'],['antiques','ANTIQUES'],['showroom','CARS'],['realty','REALTY']];
  for(const [kind,word] of rooms){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);const P=room.props;
   if(String(ROOM_DEFS[kind].props).includes('BX('))bad.push([kind,'a painted box is left']);
   if(kind==='store'){const ro=P.find(o=>o.roller);if(!ro||!onTop(P,ro))bad.push('roller not on the counter');}
   if(kind==='books'){const a=P.find(o=>o.armchair),s=P.find(o=>o.seat&&Math.abs(o.x-2.2)<.01);if(!a||!s||Math.abs(s.h-a.armchair.h)>1e-9)bad.push('reading chair seat');}
   if(kind==='tailor'){const m=P.filter(o=>o.sewing);if(m.length!==2||m.some(o=>!onTop(P,o)))bad.push('sewing machines not on their tables');
    const mi=P.find(o=>o.mirror);if(!mi||roomAt(mi.x+mi.mirror.fx*.5,mi.y+mi.mirror.fy*.5)!=='.')bad.push('mirror faces a wall');
    if(!P.some(o=>o.cuttingTable)||!P.some(o=>o.curtain))bad.push('cutting table or curtain missing');}
   if(kind==='antiques'){for(const o of P.filter(o=>o.suitcases)){const cs=o.suitcases.cases;cs.forEach((q,k)=>{if(Math.abs(q[2]-(k?cs[k-1][3]:0))>1e-9)bad.push('a suitcase not resting');});}
    for(const a of P.filter(o=>o.armchair)){const s=P.find(o=>o.seat&&Math.abs(o.x-a.x)<.01&&Math.abs(o.y-a.y)<.01);if(!s||s.h!==a.armchair.h)bad.push('armchair seat');}}
   if(kind==='showroom'||kind==='realty'){if(!P.some(o=>o.desk))bad.push([kind,'no desk']);}
  }
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('record divider letters read forwards from both aisles and sleeve art scales without repeated glyph stamps',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  enterRoom('records',{word:'RECORDS',ret:[100,100,0]},[5,5,0]);
  projX=projY=10000;Object.assign(WH,{dn:1,sl:0,wc:0});
  const bin=room.props.find(o=>o.recordBin),cards=parts(bin).filter(q=>q.box.hl===.002);
  let cells=0;
  for(let k=0;k<cards.length;k++)for(const side of [-1,1])for(let row=0;row<5;row++)for(let col=0;col<4;col++){
   const q=cards[k],b=q.box,u=side*(b.hl+.1),v=side===1?-((col+.5)/4-.5)*.025:((col+.5)/4-.5)*.025,z=RECORD_BIN.rim+RECORD_BIN.sleeve+.03+(.5-(row+.5)/5)*.04;
   const t=q.ray(b.x+b.c*u-b.s*v,b.y+b.s*u+b.c*v,z,-side*b.c,-side*b.s,0,b);
   if(t<0){bad.push('divider missed');continue;}q.shade(0,t,8);cells++;
   if((CH[0]==='█')!==!!glyphOn(bin.recordBin.cards[k].letter,col,row))bad.push(['mirrored divider',bin.recordBin.cards[k].letter,side,row,col]);
  }
  const fo=room.props.find(o=>o.faceOut),sleeves=parts(fo).filter(q=>q.box.hl===RECORD_BIN.sleeve/2);let marks=0;
  for(const q of sleeves)for(let row=0;row<12;row++)for(let col=0;col<12;col++){
   const b=q.box,u=((col+.5)/12-.5)*b.hl*2,z=b.z0+(row+.5)/12*(b.z1-b.z0),t=q.ray(b.x+u,b.y+.1,z,0,-1,0,b);
   q.shade(0,t,8);if(CH[0]!==' '&&CH[0]!=='\u2588')bad.push(['stamped sleeve artwork',CH[0]]);if(CH[0]==='\u2588')marks++;
  }
  return {bad:bad.slice(0,8),cells,sleeves:sleeves.length,marks};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.cells>=120&&r.sleeves>=60&&r.marks>0,JSON.stringify(r));
}));

test('the pharmacy cuff has an open arm recess with inward walls and a closed back, and one readable idle display',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=[];enterRoom('pharmacy',{word:'PHARMACY',ret:[100,100,0]},[5,5,0]);projX=projY=10000;
  const o=room.props.find(o=>o.bpMachine);drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
  const body=parts.find(q=>q.box.z0===0&&q.box.z1===1.3),b=body.box;
  const shoot=(u,v,z,du,dv,dz)=>{const t=body.ray(b.x+b.c*u-b.s*v,b.y+b.s*u+b.c*v,z,b.c*du-b.s*dv,b.s*du+b.c*dv,dz,b);return {t,v:HIT.v,w:HIT.w,u:HIT.u,nu:HIT.nx*b.c+HIT.ny*b.s,nz:HIT.nz};};
  const axis=shoot(0,.5,.75,0,-1,0);if(axis.t<.49||axis.t>.51||Math.abs(axis.v)>.001)bad.push(['cuff blocked or open through back',axis]);
  const wall=shoot(0,.5,.75,.1,-1,.1);if(wall.t<.42||wall.t>.43||wall.nu>-.6||wall.nz>-.6)bad.push(['missing inward cuff wall',wall]);
  const solid=shoot(.15,.5,.75,0,-1,0);if(Math.abs(solid.v-.28)>.001)bad.push(['cabinet beside the recess',solid]);
  const screen=parts.find(q=>q.box.z0===.95&&q.box.z1===1.18),s=screen.box;Object.assign(WH,{dn:1,sl:0,wc:0});let ink=0;
  // The face sampled on a dense grid must contain one scaled READY line,
  // rather than the old rows of repeated 1s and 2s.
  for(let row=0;row<5;row++)for(let col=0;col<20;col++){
   const u=((col+.5)/4-2.5)*.036,z=1.115+(.5-(row+.5)/5)*.045;
   const t=screen.ray(s.x+s.c*u-s.s*.1,s.y+s.s*u+s.c*.1,z,s.s,-s.c,0,s);screen.shade(0,t,8);
   const expected=glyphOn('READY'[Math.floor(col/4)],col%4,row);if(CH[0]==='█')ink++;
   if((CH[0]==='\u2588')!==!!expected)bad.push(['unreadable idle display',row,col,CH[0]]);
  }
  return {bad:bad.slice(0,8),ink};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.ink>20,JSON.stringify(r));
}));

test('garden hose turns keep their prepared surfaces and touch the floor and each other',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],draw=drawBox;enterRoom('hardware',{word:'HARDWARE',ret:[100,100,0]},[5,5,0]);const o=room.props.find(o=>o.hose);
  const capture=()=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;},a=capture(),b=capture();
  if(a.length!==1||!a[0].box.hoseShape)return ['missing prepared coil surface'];
  const q=a[0],h=o.hose;
  if(q.box.hoseShape!==b[0].box.hoseShape||q.shade!==b[0].shade)bad.push('hose surface rebuilt');
  for(let k=0;k<h.turns;k++){
   const z=h.r*(1+2*k),outer=q.ray(q.box.x+.8,q.box.y,z,-1,0,0,q.box),nx=HIT.nx,u=HIT.u;
   const inner=q.ray(q.box.x,q.box.y,z,1,0,0,q.box);
   if(outer<0||inner<0||nx<.99||HIT.nx>-.99||Math.abs(u-h.R-h.r)>.001||Math.abs(HIT.u-h.R+h.r)>.001)bad.push(['hose tube surface',k,nx,HIT.nx,u,HIT.u]);
  }
  // The top and bottom are rounded closed tube, while the central hole stays open.
  const top=q.ray(q.box.x+h.R,q.box.y,1,0,0,-1,q.box),zt=HIT.w,nz=HIT.nz;
  const bottom=q.ray(q.box.x+h.R,q.box.y,-.1,0,0,1,q.box),zb=HIT.w;
  if(top<0||bottom<0||Math.abs(zt-h.turns*2*h.r)>.001||Math.abs(zb)>.001||nz<.99||HIT.nz>-.99)bad.push('hose not rounded or grounded');
  if(q.ray(q.box.x,q.box.y,1,0,0,-1,q.box)>=0)bad.push('hose centre filled');
  for(let k=1;k<h.turns;k++)if(q.ray(q.box.x+.8,q.box.y,k*2*h.r,-1,0,0,q.box)<0)bad.push('gap between hose turns');
  return bad;
 });assert.deepEqual(r,[]);
}));
