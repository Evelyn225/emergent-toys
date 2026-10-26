'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('shop and restaurant strip ceilings have mounted models, clear of walls and usable floor space',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let count=0;
  for(const kind of ['store','gas','hardware','pharmacy','deli','markethall','motel','toys','sports','tireshop','video','diner','bagelshop']){
   enterRoom(kind,{word:kind==='store'?'24/7':kind.toUpperCase(),ret:[100,100,0]},[5,5,0]);render(0);
   if(room.def.ceil!=='strip')continue;
   const lamps=room.props.filter(o=>o.ceilingBatten);count+=lamps.length;if(!lamps.length)bad.push([kind,'ceiling still painted']);
   const h=room.def.height||3;
   for(const o of lamps){const b=o.box;if(b.z0<h-.075||Math.abs(b.z1-h)>1e-8||!o.walk)bad.push([kind,'fixture blocks floor or leaves ceiling gap']);
    for(const u of [-b.hl,b.hl])for(const v of [-b.hw,b.hw]){const x=b.x+b.c*u-b.s*v,y=b.y+b.s*u+b.c*v;if(!'.S'.includes(room.grid[Math.floor(y)]?.[Math.floor(x)]||'#'))bad.push([kind,'fixture through wall']);}
   }
  }return{bad:bad.slice(0,8),count};
 });assert.deepEqual(r.bad,[]);assert.ok(r.count>=15,JSON.stringify(r));
}));

test('batten cases attach to the ceiling and carry closed diffusers and clips with cached planes and materials',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('store',{word:'24/7',ret:[100,100,0]},[5,5,0]);render(0);projX=10000;
  const bad=[],lamps=room.props.filter(o=>o.ceilingBatten),draw=drawBox;let checked=0;
  if(!lamps.length)return{bad:['no physical battens'],checked};
  const capture=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of lamps){const a=capture(o),b=capture(o),h=o.box.z1,seen=new Set(a.map((p,k)=>Math.abs(p.box.z1-h)<1e-8?k:-1).filter(k=>k>=0)),queue=[...seen];
   const join=(A,B)=>Math.abs(A.x-B.x)<=Math.abs(A.c)*A.hl+Math.abs(A.s)*A.hw+Math.abs(B.c)*B.hl+Math.abs(B.s)*B.hw+1e-8&&Math.abs(A.y-B.y)<=Math.abs(A.s)*A.hl+Math.abs(A.c)*A.hw+Math.abs(B.s)*B.hl+Math.abs(B.c)*B.hw+1e-8&&A.z0<=B.z1+1e-8&&B.z0<=A.z1+1e-8;
   while(queue.length){const k=queue.pop();a.forEach((q,j)=>{if(!seen.has(j)&&join(a[k].box,q.box)){seen.add(j);queue.push(j);}});}
   if(seen.size!==a.length)bad.push('floating light component');
   a.forEach((q,k)=>{const B=q.box,P=o.box,u=(B.x-P.x)*P.c+(B.y-P.y)*P.s,v=-(B.x-P.x)*P.s+(B.y-P.y)*P.c;
    if(Math.abs(u)+B.hl>P.hl+1e-8||Math.abs(v)+B.hw>P.hw+1e-8||B.z0<P.z0-1e-8||B.z1>P.z1+1e-8)bad.push('light outside its bounds');
    if(q.shade!==b[k].shade||B.planes!==b[k].box.planes||B.normals!==b[k].box.normals)bad.push('light surfaces rebuilt');
    const t=q.ray(B.x,B.y,B.z0-.1,0,0,1,B);if(t<0||!Number.isFinite(HIT.nz)||HIT.nz>-.99)bad.push('missing closed underside');
    q.shade(0,t,8);if((BG[0]&15)>=10)checked++;
   });
  }
  const state=room.interiorBattens,old=lamps.slice(),mask=state?.mask;render(0);render(0);
  const again=room.props.filter(o=>o.ceilingBatten);if(again.length!==old.length||again.some((q,k)=>q!==old[k])||room.interiorBattens?.mask!==mask)bad.push('ceiling rebuilt per frame');
  return{bad:bad.slice(0,8),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>0,'only the fitted diffuser emits light');
}));

test('the ceiling plane no longer contains duplicated fluorescent glyphs behind its models',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('store',{word:'24/7',ret:[100,100,0]},[5,5,0]);render(0);const o=room.props.find(o=>o.ceilingBatten);if(!o)return{missing:true};
  const h=room.def.height||3,d=h-eye,row=hor-.5-projY;roomCeil(0,row,0,(o.x-px)/d,(o.y-py)/d);
  return{char:CH[0],background:BG[0]&15};
 });assert.ok(!r.missing,'real fixtures are installed');assert.equal(r.char,' ');assert.ok(r.background<8);
}));

test('home, hotel, civic, rail and existing paper-lantern ceilings retain their own fittings',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[];
  for(const kind of ['home','loft','bellehome','hotelroom','hospital','laundry','station','train','noodle','tea','deli','bagelshop','tobacco']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0],lobby:{word:'HOTEL',ret:[100,100,0]},st:0,t0:T-12,opts:[1,2,3],dest:null,track:0},[5,5,0]);render(0);
   if(room.props.some(o=>o.ceilingBatten))bad.push([kind,'unexpected batten']);
   if(['noodle','tea'].includes(kind)&&!room.props.some(o=>o.paperLantern))bad.push([kind,'paper lantern lost']);
  }return bad;
 });assert.deepEqual(bad,[]);
}));
