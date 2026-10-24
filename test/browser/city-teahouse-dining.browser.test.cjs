'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('mahjong tables: every tile run lies on the felt inside the rim without touching another run, in both rooms',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox;projX=10000;
  const model=MAHJONG_TABLE(0,0),d=model.mahjong,shapes=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const tray=shapes.find(o=>o.ray===foodRayTray),bad=[];
  const ext=q=>[Math.abs(q.c)*q.hl+Math.abs(q.s)*q.hw,Math.abs(q.s)*q.hl+Math.abs(q.c)*q.hw];
  for(const [k,q]of d.runs.entries()){
   const t=tray.ray(q.x,q.y,d.felt+.5,0,0,-1,tray.box);if(!(t>0&&Math.abs(t-.5)<1e-6))bad.push(['felt',k]);
   const [ex,ey]=ext(q);if(Math.abs(q.x)+ex>.442||Math.abs(q.y)+ey>.442)bad.push(['rim',k]);
   for(const o of d.runs.slice(k+1)){const [ox,oy]=ext(o);if(Math.abs(q.x-o.x)<ex+ox&&Math.abs(q.y-o.y)<ey+oy)bad.push(['overlap',q.kind,o.kind]);}
  }
  for(const o of shapes)if(o.box.z0<model.box.z0-1e-9||o.box.z1>model.box.z1+1e-9)bad.push(['bounds',o.box.z0,o.box.z1]);
  const kinds={};for(const q of d.runs)kinds[q.kind]=(kinds[q.kind]||0)+1;
  const rooms=[];for(const [kind,word]of [['mahjong','MAHJONG'],['tea','TEA']]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,4,0]);
   rooms.push({kind,tables:room.props.filter(o=>o.mahjong&&o.mj).length,old:room.props.filter(o=>o.mj&&!o.mahjong).length});
  }
  return{bad,kinds,rooms,top:model.box.z1};
 });
 assert.deepEqual(r.bad,[]);assert.deepEqual(r.kinds,{wall:4,hand:4,discard:4});
 assert.deepEqual(r.rooms,[{kind:'mahjong',tables:5,old:0},{kind:'tea',tables:4,old:0}]);
}));

test('the tea counter carries its flasks and cups on its worktop, and the sushi bench its nigiri on the board',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox;projX=10000;
  const tea=TEA_COUNTER(0,0),parts=[];
  drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{tea.draw(0,0);}finally{drawBox=draw;}
  const flasks=parts.filter(o=>o.ray===coveRayLathe&&Math.abs(o.box.z0-tea.teaCounter.height)<1e-9&&o.box.hl>.06),top=parts.filter(o=>o.ray===homeRayWorktop);
  const standing=flasks.map(f=>top.some(o=>{const t=o.ray(f.box.x,f.box.y,2,0,0,-1,o.box);return t>0&&Math.abs(2-t-tea.teaCounter.height)<1e-6;}));
  const bench=KITCHEN_PREP(0,0,2.6,.35,.85,'sushi'),b=[];
  drawBox=(box,shade,ray=rayBox)=>b.push({box,ray});try{bench.draw(0,0);}finally{drawBox=draw;}
  const board=b.find(o=>o.ray===homeRayWorktop&&o.box.z0===.85),rice=b.filter(o=>o.ray===coveRayRounded&&Math.abs(o.box.z0-board.box.z1)<1e-9);
  const onBoard=rice.every(o=>{const t=board.ray(o.box.x,o.box.y,2,0,0,-1,board.box);return t>0&&Math.abs(2-t-board.box.z1)<1e-6;});
  const within=parts.every(o=>o.box.z1<=tea.box.z1+1e-9);
  return{flasks:flasks.length,standing,rice:rice.length,onBoard,within};
 });
 assert.equal(r.flasks,3);assert.deepEqual(r.standing,[true,true,true]);assert.ok(r.rice>=12&&r.onBoard&&r.within,JSON.stringify(r));
}));
