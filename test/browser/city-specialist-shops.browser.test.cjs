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
  for(const q of parts(hose)){const top=Math.max(...q.box.profile.map(p=>p[0])),bot=Math.min(...q.box.profile.map(p=>p[0]));
   const k=Math.round((bot-q.box.z0)/(2*h.r));if(Math.abs(bot-q.box.z0-k*2*h.r)>1e-9)bad.push('hose turn not resting');}
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
