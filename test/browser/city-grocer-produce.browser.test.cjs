'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('produce stands: crates on their risers, fruit packed inside the walls and resting layer on layer, a price card on every crate front',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],W=GROCER_CRATE;let crates=0,fruit=0;
  for(const word of ['GROCERY','FRUIT']){
   enterRoom('grocer',{word,ret:[100,100,0]},[5,5,0]);
   const stands=room.props.filter(o=>o.produceStand);
   if(stands.length!==(word==='FRUIT'?3:2))bad.push([word,'stands',stands.length]);
   for(const o of stands){const d=o.produceStand,draw=drawBox,parts=[];projX=10000;
    drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    d.tiers.forEach((t,k)=>{
     const riser=parts.find(q=>q.ray===rayBox&&Math.abs(q.box.y-(o.y+t.v))<1e-9&&q.box.z0===0&&Math.abs(q.box.hl-d.hl)<1e-9);
     if(!riser||Math.abs(riser.box.z1-t.base)>1e-9)bad.push([word,'riser',k]);
     if(k&&t.rim>=d.tiers[k-1].rim)bad.push([word,'tiers do not step up away from the door']);
     for(const q of t.crates){crates++;
      if(Math.abs(q.u)+q.hl>d.hl+1e-9||q.hw>W.tier/2)bad.push([word,'crate off its riser',q.u]);
      const tray=parts.find(s=>s.ray===foodRayTray&&Math.abs(s.box.x-(o.x+q.u))<1e-9&&Math.abs(s.box.y-(o.y+t.v))<1e-9);
      if(!tray||Math.abs(tray.box.z0-t.base)>1e-9)bad.push([word,'crate not on the riser',q.u]);
      const ih=q.hl-W.wall,iw=q.hw-W.wall;
      for(const f of q.fruit){fruit++;
       if(Math.abs(f.u)+f.hr>ih+1e-9||Math.abs(f.v)+f.hr>iw+1e-9)bad.push([word,'fruit through the wall',q.kind]);
       if(f.layer===0){if(Math.abs(f.z-f.vr-q.floor)>1e-9)bad.push([word,'fruit off the floor']);continue;}
       const below=q.fruit.filter(g=>g.layer===f.layer-1&&Math.abs(Math.abs(g.u-f.u)-f.hr)<1e-9&&Math.abs(Math.abs(g.v-f.v)-f.hr)<1e-9&&Math.abs(f.z-g.z-Math.SQRT2*f.vr)<1e-9);
       if(below.length!==4)bad.push([word,'fruit not in a hollow',q.kind,below.length]);
      }
      const card=d.cards.find(c=>Math.abs(c.u-q.u)<1e-9&&Math.abs(c.v-(t.v+q.hw+.0015))<1e-9);
      if(!card||card.z0<q.rim-W.depth||card.z1>q.rim)bad.push([word,'no card on the crate front',q.u]);
     }
    });
    for(const q of parts)if(q.box.x-q.box.hl<o.box.x-o.box.hl-1e-6||q.box.x+q.box.hl>o.box.x+o.box.hl+1e-6||q.box.y-q.box.hw<o.box.y-o.box.hw-1e-6||q.box.y+q.box.hw>o.box.y+o.box.hw+1e-6||q.box.z1>o.box.z1+.1)bad.push([word,'outside the stand',q.box.x,q.box.y]);
   }
  }
  return {bad:bad.slice(0,8),crates,fruit};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.crates>=20&&r.fruit>=300,JSON.stringify(r));
}));

test('the melon bin, baskets, banana crate, upturned crate and checkout are built, clear of everything else, and the cashier works the till side',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  enterRoom('grocer',{word:'GROCERY',ret:[100,100,0]},[5,5,0]);
  const built=room.props.filter(o=>o.produceStand||o.produceBin||o.baskets||o.checkout||o.produceCrate);
  if(built.length!==6)bad.push(['built',built.length]);
  // nothing solid shares their space (people, signs overhead and the seat on the crate aside)
  for(const a of built)for(const b of room.props){
   if(a===b||!b.box||b.fig||b.seat||b.h&&!b.draw)continue;
   const z=Math.min(a.box.z1,b.box.z1)-Math.max(a.box.z0,b.box.z0);
   if(z>.01&&Math.abs(a.box.x-b.box.x)<a.box.hl+b.box.hl-.01&&Math.abs(a.box.y-b.box.y)<a.box.hw+b.box.hw-.01)bad.push(['overlap',+a.x.toFixed(2),+a.y.toFixed(2),+b.x.toFixed(2),+b.y.toFixed(2)]);
  }
  const bin=room.props.find(o=>o.produceBin).produceBin;
  for(const m of bin.melons){if(Math.abs(m.u)+m.hr*1.18>bin.hl-GROCER_CRATE.wall+1e-9||Math.abs(m.v)+m.hr>bin.hl-GROCER_CRATE.wall+1e-9)bad.push('melon through the bin');
   if(m.layer===0&&Math.abs(m.z-m.vr-bin.floor)>1e-9)bad.push('melon off the floor');}
  const bk=room.props.find(o=>o.baskets),draw=drawBox,parts=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{bk.draw(bk.x,bk.y);}finally{drawBox=draw;}
  const trays=parts.filter(q=>q.ray===foodRayTray).sort((a,b)=>a.box.z0-b.box.z0);
  trays.forEach((q,k)=>{if(Math.abs(q.box.z0-(k?trays[k-1].box.z1:0))>1e-9)bad.push(['basket not resting',k]);});
  for(const h of parts.filter(q=>q.ray===coveRayCapsule))if(Math.abs(h.box.az-h.box.r-trays.at(-1).box.z1)>1e-9||Math.abs(Math.abs(h.box.ay-bk.y)-(bk.baskets.hw-.004))>1e-9)bad.push('handle off the rim');
  // checkout: the till screen faces the cashier (+x), the card reader stands on the customers' side
  const co=room.props.find(o=>o.checkout),keeper=room.def.keeper,cp=[];
  drawBox=(box,shade,ray=rayBox)=>cp.push({box,shade});try{co.draw(co.x,co.y);}finally{drawBox=draw;}
  if(keeper[0]<=co.box.x+co.box.hl)bad.push('cashier not on the +x side');
  const top=co.checkout.H,onTop=cp.filter(q=>q.box.z0>=top-1e-9);
  const reader=onTop.find(q=>q.box.z1<top+.1&&q.box.hl<.05),screen=onTop.find(q=>q.box.z1-q.box.z0>.12);
  if(!reader||reader.box.x>=co.x)bad.push('card reader not on the customers\' side');
  if(!screen||screen.box.x<=co.x)bad.push('till not on the cashier\'s side');
  for(const q of cp)if(q.box.z0<top-1e-9&&q.box.z1>top+1e-9)bad.push('part through the counter top');
  // aisles: between the stands, past the checkout to the door, and round the bin
  for(const [x,y] of [[8.7,5.75],[7.4,4.9],[9.9,6.6],[9.6,8.4],[11.2,5.2]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));
