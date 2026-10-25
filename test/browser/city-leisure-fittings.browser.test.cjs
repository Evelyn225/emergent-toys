'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('cinema rows, arcade cabinets and the casino floor are built, every part inside its model, facing where they are played or sat in',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray,shade});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py}}));};
  const inside=(o,label,slack=.001)=>{const b=o.box,bc=Math.abs(b.c??1),bs=Math.abs(b.s??0),bx=b.hl*bc+b.hw*bs,by=b.hl*bs+b.hw*bc;
   for(const q of parts(o)){const x=q.box,c=Math.abs(x.c??1),s=Math.abs(x.s??0),ex=x.hl*c+x.hw*s,ey=x.hl*s+x.hw*c;
    if(x.x-ex<b.x-bx-slack||x.x+ex>b.x+bx+slack||x.y-ey<b.y-by-slack||x.y+ey>b.y+by+slack||x.z1>b.z1+slack)bad.push([label,'outside its box',+x.x.toFixed(2),+x.y.toFixed(2),+x.z1.toFixed(2)]);}};
  enterRoom('cinema',{word:'CINEMA',ret:[100,100,0]},[5,5,0]);
  const rows=room.props.filter(o=>o.cinemaRow);if(rows.length!==8||rows.some(o=>!o.seatRow||o.cinemaRow.n<6))bad.push(['cinema rows',rows.length]);
  for(const o of rows){inside(o,'row');const ps=parts(o),cushions=ps.filter(q=>Math.abs(q.box.z1-.45)<1e-9);if(cushions.length!==o.cinemaRow.n)bad.push('cushions');
   if(ps.some(q=>q.box.z1>.5&&q.box.y<o.y-1e-9&&q.box.hw>.05))bad.push('a seat back on the screen side');}
  enterRoom('arcade',{word:'ARCADE',ret:[100,100,0]},[5,5,0]);
  const cabs=room.props.filter(o=>o.arcade);if(cabs.length!==10)bad.push(['cabinets',cabs.length]);
  for(const o of cabs){inside(o,'cabinet');if(!o.game)bad.push('cabinet lost its game');
   const f=o.arcade;if(!free(o.x+f.fx*.75,o.y+f.fy*.75))bad.push(['nowhere to stand at a cabinet',o.x,o.y]);
   const scr=parts(o).find(q=>q.box.z0===1&&q.box.z1===1.55);if(!scr)bad.push('no screen');}
  enterRoom('casino',{word:'CASINO',ret:[100,100,0]},[5,5,0]);const P=room.props;
  for(const o of P.filter(o=>o.gaming)){inside(o,o.casino);const h=o.gaming.h;
   for(const q of parts(o))if(q.box.z0>h-1e-9&&q.box.z0<h+.002&&q.ray===rayBox&&q.box.hl<.05&&Math.abs(q.box.z0-h-.001)>1e-9)bad.push([o.casino,'a card not on the felt']);}
  const tables=P.filter(o=>o.casino==='blackjack'||o.casino==='roulette');if(tables.length!==3||tables.some(o=>!o.gaming))bad.push('tables');
  const slots=P.filter(o=>o.casino==='slots');if(!slots.length||slots.some(o=>!o.slot))bad.push('slots');
  for(const o of slots){inside(o,'slot',.01);const stool=P.find(q=>q.walk&&Math.abs(q.y-o.y)<1e-9&&Math.abs(q.x-(o.x+o.slot.fx*.7))<1e-9);if(!stool)bad.push(['slot faces away from its stool',o.x,o.y]);}
  const cage=P.find(o=>o.cage),counter=P.find(o=>o.furniture==='counter');if(!cage||!counter)bad.push('cage or counter');
  else for(const q of parts(cage).filter(q=>Math.abs(q.box.ax-q.box.bx)<1e-9))if(Math.abs(Math.min(q.box.az,q.box.bz)-counter.box.z1)>1e-9)bad.push('a bar not standing on the counter');
  for(const k of ['cinema','arcade','casino'])if(String(ROOM_DEFS[k].props).includes('BX(')||String(ROOM_DEFS[k].props).includes('SP('))bad.push([k,'painted props left']);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('the club: poles stand on the stage up to the ceiling, candles on the tables, chairs carry their seats, the VIP booth opens to its host',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const rnd=Math.random;Math.random=()=>.3;try{enterRoom('stripclub',{word:'VELVET',ret:[100,100,0]},[5,5,0]);}finally{Math.random=rnd;}
  const P=room.props,stage=P.find(o=>o.stage),H=room.def.height||3;
  const poles=P.filter(o=>o.pole);if(poles.length!==3)bad.push(['poles',poles.length]);
  for(const o of poles){if(!inBox(stage.box,o.x,o.y,0)||Math.abs(o.pole.z0-stage.stage.h)>1e-9)bad.push('pole not on the stage');if(o.pole.z1>H+1e-9)bad.push('pole through the ceiling');}
  const candles=P.filter(o=>o.candle);if(candles.length!==5)bad.push(['candles',candles.length]);
  for(const c of candles){const t=P.find(o=>o!==c&&o.box&&inBox(o.box,c.x,c.y,0)&&Math.abs(o.box.z1-c.candle.z)<1e-9);if(!t)bad.push('candle not on a table');}
  const chairs=P.filter(o=>o.clubChair);if(chairs.length!==10)bad.push(['chairs',chairs.length]);
  for(const c of chairs){const s=P.find(o=>o.seat&&Math.abs(o.x-c.x)<1e-9&&Math.abs(o.y-c.y)<1e-9);if(!s||s.h!==c.clubChair.h)bad.push('chair seat');}
  const vip=P.find(o=>o.vip),host=P.find(o=>o.service==='vip');
  if(!vip||!host||(host.x-vip.x)*vip.vip.fx+(host.y-vip.y)*vip.vip.fy<=0)bad.push('VIP booth faces away from its host');
  for(const [x,y] of [[vip.box.x-vip.box.hl,vip.box.y-vip.box.hw],[vip.box.x+vip.box.hl,vip.box.y+vip.box.hw]])if(roomAt(x-Math.sign(x-vip.x)*.01,y-Math.sign(y-vip.y)*.01)==='#')bad.push('VIP booth in the wall');
  const s=String(ROOM_DEFS.stripclub.props);if(s.includes('BX(')||s.includes('SP('))bad.push('painted props left in the club');
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('the touch pool holds its creatures on the sand under clear water inside the basin; the plush sharks lie on their shelves',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  enterRoom('aquarium',{word:'AQUARIUM',ret:[100,100,0]},[5,5,0]);
  const P=room.props,pool=P.find(o=>o.touchPool),d=pool.touchPool;
  const draw=drawBox,parts=[];drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray,shade});try{pool.draw(pool.x-px,pool.y-py);}finally{drawBox=draw;}
  const life=parts.filter(q=>q.box.z0===d.floor);if(life.length<d.life)bad.push(['creatures',life.length]);
  for(const q of life){const x=q.box.x+px,y=q.box.y+py;if(Math.abs(x-pool.x)>pool.box.hl-.08||Math.abs(y-pool.y)>pool.box.hw-.08)bad.push('a creature in the basin wall');if(q.box.z1>d.water)bad.push('a creature out of the water');}
  const surface=parts.find(q=>q.box.z1===d.water);let clear=0;for(let k=0;k<40;k++){HIT.u=k*.05-1;HIT.v=k*.013-.3;if(!surface.shade(0,1,8))clear++;}
  if(clear<20)bad.push(['water not clear',clear]);
  const plush=P.find(o=>o.plushStand);if(!plush)bad.push('no plush stand');
  const s=String(ROOM_DEFS.aquarium.props);if(s.includes('BX('))bad.push('painted boxes left in the aquarium');
  return bad;
 });
 assert.deepEqual(r,[]);
}));
