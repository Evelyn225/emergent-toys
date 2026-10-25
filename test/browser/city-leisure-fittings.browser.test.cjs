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

// Review regression: bounds alone cannot prove that the top or a handle is attached.
test('casino table tops meet their bases and slot levers have a continuous attachment to the cabinet',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  px=py=0;dx=1;dy=0;projX=10000;
  const save=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=save;}return a;},errors=[];
  for(const o of [BLACKJACK_TABLE(0,0),ROULETTE_TABLE(0,0)]){
   const ps=parts(o),base=ps.find(q=>q.box.z0===0),rail=ps.find(q=>Math.abs(q.box.z1-o.gaming.h)<1e-9);
   const top=1-base.ray(0,0,1,0,0,-1,base.box),underside=rail.ray(0,0,0,0,0,1,rail.box);
   if(Math.abs(top-underside)>.0002)errors.push(['table top separated from base',top,underside]);
  }
  for(const [fx,fy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const ps=parts(SLOT_MACHINE(0,0,fx,fy,0)),c=fy,s=-fx;
   for(const u of [.3,.309,.318,.327,.34]){
    const x=c*u+s*.1,y=s*u-c*.1;
    if(!ps.some(q=>{const t=q.ray(x,y,.95,-s,c,0,q.box);return t>0&&t<.12;}))errors.push(['detached slot lever',fx,fy,u]);
   }
  }
  return errors;
 });assert.deepEqual(bad,[]);
}));
