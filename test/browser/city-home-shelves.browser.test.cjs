'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;money=30000;T=10;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();env(0);fade=0;render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('every home shelf board supports fitting items without book, neighbour, edge or headroom intersections',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const home=homeRecord(),cell=[home.cell%N,Math.floor(home.cell/N)],draw=drawBox,out=[];
  for(const kind of ['home','loft','bellehome','islandhome']){
   home.decor=[];enterRoom(kind,{cell,ret:[100,100,0]},ROOM_DEFS[kind].entry);const surfaces=homeShelfSurfaces(),bad=[];
   for(const s of surfaces){
    const size=homeShelfSize({id:'apple',uses:1}),p=homeShelfFind(s,size,[],0);
    if(!p){bad.push(['no apple space',s.key,s.level]);continue;}
    const shapes=[];drawBox=(box,shade,ray=rayBox)=>{if(!box.bookRole)shapes.push({box,ray});};try{s.owner.draw(s.x,s.y);}finally{drawBox=draw;}
    const heights=shapes.map(q=>{const t=q.ray(p.x,p.y,p.z+.05,0,0,-1,q.box);return t>0?p.z+.05-t:-Infinity;});
    if(Math.abs(Math.max(...heights)-p.z)>1e-6)bad.push(['actual support',s.key,s.level,p.z,Math.max(...heights)]);
    if(homeShelfFits(s,s.hl,0,size,[]))bad.push('edge overhang');
    if(homeShelfFits(s,0,0,{radius:2,height:.05},[]))bad.push('too wide');
    if(homeShelfFits(s,p.u,p.v,{radius:.01,height:10},[]))bad.push('too tall');
    if(homeShelfFits(s,p.u,p.v,size,[p]))bad.push('neighbour overlap');
    for(const b of s.books)if(homeShelfFits(s,b.u,b.v,{radius:.02,height:.03},[]))bad.push('book overlap');
   }
   // Four old keepsakes remain intact and move onto real, valid board tops.
   home.decor=Array.from({length:4},()=>({id:'yoyo',uses:0}));const legacy=homeShelfLayout();
   if(legacy.length!==4||legacy.some(p=>!homeShelfFits(p.surface,p.u,p.v,p.size,legacy.filter(q=>q!==p))))bad.push('legacy fit');
   if(!isHomeDecor({id:'f_lamp'})||!isHomeDecor({id:'sharkplush'})||isHomeDecor({id:'constructor'}))bad.push('legacy/unknown items');
   const invalid=restoreShelfItem({id:'yoyo',uses:0,shelfPlacement:{key:'old',level:1,u:NaN,v:0}});if(invalid.shelfPlacement||invalid.id!=='yoyo')bad.push('invalid placement retained or item lost');
   out.push({kind,bad,surfaces:surfaces.length,shelves:room.props.filter(q=>q.shelfSurfaces).length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.surfaces,q.shelves*4);assert.ok(q.shelves>0);}
}));

test('E and drop place on an extra Belle shelf, save the board, and let you take items back; storage callbacks remain separate',()=>fixture(async p=>{
 await p.evaluate(()=>{money=30000;buy('home_belle');const h=owned.homes.find(h=>h.kind==='home_belle');enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},[10.9,2.5,-Math.PI/2]);env(0);render(0);carryItem({id:'apple',uses:1});held=inv.findIndex(it=>it.id==='apple');pitch=((1.2-interactionEye())/(2.5-1.536))*projY/rows;render(0);});
 assert.equal(await p.evaluate(()=>interactionFocus()?.kind),'home-shelf');await p.keyboard.press('KeyE');
 const saved=await p.evaluate(()=>{const p=homeShelfLayout()[0];return {placement:homeRecord().decor[0].shelfPlacement,z:p.z,x:p.x,y:p.y,owner:[p.surface.x,p.surface.y],level:p.surface.level};});
 assert.deepEqual(saved.owner,[10.9,1.4]);assert.equal(saved.level,1);assert.ok(Math.abs(saved.z-.923)<1e-7);
 await p.reload();await p.evaluate(()=>{paused=false;mode='walk';room=null;const h=owned.homes.find(h=>h.kind==='home_belle');enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},[10.9,2.5,-Math.PI/2]);env(0);render(0);});
 assert.deepEqual(await p.evaluate(()=>homeRecord().decor[0].shelfPlacement),saved.placement);
 const drawn=await p.evaluate(()=>{const p=homeShelfLayout()[0],draw=drawDropped,calls=[];drawDropped=(d,x,y,u)=>{if(d.displaySize)calls.push({z:d.displayZ,w:d.displaySize.w,h:d.displaySize.h});return draw(d,x,y,u);};try{render(0);}finally{drawDropped=draw;}px=p.x;py=2.5;a=-Math.PI/2;pitch=((p.z+p.size.height/2-interactionEye())/(py-p.y))*projY/rows;render(0);return calls;});
 assert.equal(drawn.length,1);assert.equal(drawn[0].z,saved.z);assert.ok(drawn[0].w<.1);
 assert.equal(await p.evaluate(()=>interactionFocus()?.kind),'home-display');await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>homeRecord().decor.length),0);assert.ok(await p.evaluate(()=>inv.some(it=>it.id==='apple'&&!it.shelfPlacement)));
 await p.evaluate(()=>{px=10.9;py=2.5;a=-Math.PI/2;pitch=((1.2-interactionEye())/(2.5-1.536))*projY/rows;held=inv.findIndex(it=>it.id==='apple');render(0);});await p.keyboard.press('KeyX');assert.equal(await p.evaluate(()=>homeRecord().decor[0].shelfPlacement.level),1);assert.equal(await p.evaluate(()=>dropped.length),0);
 // An oversized held object stays in your hands after a failed placement.
 await p.evaluate(()=>{carryItem({id:'rod',uses:0});held=inv.length-1;px=10.5;render(0);});await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>heldItem()?.id),'rod');assert.match(await p.evaluate(()=>msgText),/does not fit/);
 // Empty-handed access opens the shelf panel at the aimed board, not the
 // designated display spot on the opposite side of the room.
 await p.evaluate(()=>{held=-1;px=10.5;render(0);});await p.keyboard.press('KeyE');await p.locator('[data-take="0"]').click();assert.ok(await p.evaluate(()=>inv.some(it=>it.id==='apple'&&!it.shelfPlacement)));
 const apple=await p.evaluate(()=>inv.findIndex(it=>it.id==='apple'));await p.locator(`[data-store="${apple}"]`).click();assert.equal(await p.evaluate(()=>homeRecord().decor[0].shelfPlacement.level),1);
 await p.locator('[data-take="0"]').click();await p.keyboard.press('Escape');
 await p.evaluate(()=>openStorage(stored,'your unit','Storage unit','Ordinary storage',null,STORE_SIZE));
 assert.ok(await p.evaluate(()=>storeCtx[6]===null));const k=await p.evaluate(()=>inv.findIndex(it=>it.id==='apple'));await p.locator(`[data-store="${k}"]`).click();assert.equal(await p.evaluate(()=>homeRecord().decor.length),0);assert.ok(await p.evaluate(()=>stored.some(it=>it.id==='apple')));
}));
