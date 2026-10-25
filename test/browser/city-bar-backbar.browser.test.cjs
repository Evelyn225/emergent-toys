'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
// Every part the back bar draws, in world coordinates (the model is drawn at its own position).
const parts=()=>{
 const model=room.props.find(o=>o.backBar),draw=drawBox,shapes=[];projX=10000;
 drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
 return {model,shapes};
};

async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('bar',{word:'BAR',ret:[100,100,0]},[6,4.5,-Math.PI/2]);});
 await p.evaluate(`window.parts=${parts}`);
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('the bar has a built back bar on its back wall in place of painted shelves, clear of the keeper and the aisle',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const {model}=parts(),d=model.backBar,k=room.def.keeper,bad=[];
  const clerk=room.props.find(o=>o.fig&&Math.hypot(o.x-k[0],o.y-k[1])<1e-6);
  if(roomAt(d.x,d.y-.05)!=='#')bad.push('not against the wall');
  for(const u of [-d.half,0,d.half])if(roomAt(d.x+u,d.y+BACK_BAR.depth+.05)!=='.')bad.push(['front',u]);
  for(const q of room.props)if(q!==clerk&&q.box&&q.box.z0<1&&q.box.z1>.2&&inBox(q.box,clerk.x,clerk.y,.18))bad.push(['clerk',q.box.x,q.box.y]);
  // the staff aisle stays open from end to end, between the back bar and the counter
  let aisle=true;for(let x=1.3;x<=10.7;x+=.05)aisle&&=free(x,1.4)||free(x,1.45)||free(x,1.5);
  let stools=true;for(let x=3;x<=9;x+=.05)stools&&=free(x,3.2);
  const wcDoor=free(2.5,4.5)&&free(2.5,5.2),jukebox=room.props.some(o=>o.box&&Math.abs(o.x-10.55)<.01);
  px=6;py=3.1;a=Math.atan2(k[1]-py,k[0]-px);render(0);
  return{bad,painted:!!room.def.shelves,aisle,stools,wcDoor,jukebox,prompt:promptText(),bays:d.bays,bottles:d.stock.length};
 });
 assert.deepEqual(r.bad,[]);assert.equal(r.painted,false);
 assert.ok(r.aisle&&r.stools&&r.wcDoor&&r.jukebox,JSON.stringify(r));assert.ok(r.bays>=6&&r.bottles>=100,JSON.stringify(r));
 assert.match(r.prompt,/E: shop$/);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));
}));

test('every bottle stands on its board inside its bay, below the board above, apart from its neighbours',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const {model,shapes}=parts(),d=model.backBar,c=-d.fy,s=d.fx,bad=[];
  const at=(u,v)=>[d.x+c*u+d.fx*v,d.y+s*u+d.fy*v];
  const flat=shapes.filter(o=>o.ray===homeRayWorktop);
  const ceilings=[...BACK_BAR.boards,BACK_BAR.canopy[0]-BACK_BAR.lamp];
  for(const q of d.stock){
   const [x,y]=at(q.u,q.v),height=backBarCap(q.kind);
   const hits=flat.map(o=>o.ray(x,y,q.z+.5,0,0,-1,o.box)).filter(t=>t>0);
   if(!hits.some(t=>Math.abs(t-.5)<1e-6))bad.push(['unsupported',q.kind,q.u,q.z]);
   // the radius at the base also rests within the board, not over its edge
   for(const [du,dv] of [[q.r,0],[-q.r,0],[0,q.r],[0,-q.r]]){const [ex,ey]=at(q.u+du,q.v+dv);if(!flat.some(o=>Math.abs(o.ray(ex,ey,q.z+.5,0,0,-1,o.box)-.5)<1e-6))bad.push(['edge',q.u,q.z]);}
   const lid=ceilings.find(z=>z>q.z+1e-6);if(lid!=null&&q.z+height>lid-.01)bad.push(['too tall',q.kind,q.z]);
   const u0=-d.half+d.pitch*q.bay+BACK_BAR.stile,u1=u0+d.pitch-2*BACK_BAR.stile;
   if(q.u-q.r<u0+.005||q.u+q.r>u1-.005)bad.push(['stile',q.bay,q.u]);
  }
  for(const a1 of d.stock)for(const b1 of d.stock)if(a1!==b1&&a1.z===b1.z&&Math.hypot(a1.u-b1.u,a1.v-b1.v)<a1.r+b1.r+.004)bad.push(['touch',a1.u,b1.u,a1.z]);
  // each tumbler on its mat; mats and worktop bottles kept apart
  for(const g of d.glasses){const [x,y]=at(g.u,g.v),t=flat.map(o=>o.ray(x,y,BACK_BAR.top+.5,0,0,-1,o.box)).filter(t=>t>0);if(!t.some(t=>Math.abs(t-(.5-.006))<1e-6))bad.push(['glass',g.u]);}
  const rows=new Set(d.stock.map(q=>q.z)),kinds=new Set(d.stock.map(q=>q.kind));
  return{bad,rows:[...rows].sort().map(z=>+z.toFixed(4)),kinds:kinds.size,bottles:d.stock.length};
 });
 assert.deepEqual(r.bad,[]);assert.deepEqual(r.rows,[.9,1.27,1.63]);assert.equal(r.kinds,4);
}));

test('back bar joints: boards span stile to stile, stiles reach worktop to canopy, every part inside its collision box',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const {model,shapes}=parts(),d=model.backBar,B=BACK_BAR,bad=[],eps=1e-9;
  const boards=shapes.filter(o=>o.ray===homeRayWorktop&&B.boards.includes(o.box.z0));
  const stiles=shapes.filter(o=>o.ray===homeRayWorktop&&o.box.z0===B.top&&o.box.z1===B.canopy[0]);
  if(boards.length!==d.bays*B.boards.length)bad.push(['boards',boards.length]);
  if(stiles.length!==d.bays+1)bad.push(['stiles',stiles.length]);
  // along the wall, every board's ends meet a stile face exactly
  const along=o=>(o.box.x-d.x)*-d.fy+(o.box.y-d.y)*d.fx;
  const faces=stiles.flatMap(o=>[along(o)-o.box.hl,along(o)+o.box.hl]);
  for(const o of boards)for(const e of [along(o)-o.box.hl,along(o)+o.box.hl])if(!faces.some(f=>Math.abs(f-e)<1e-6))bad.push(['board end',along(o),e]);
  const outer=Math.max(...faces),inner=Math.min(...faces);
  if(Math.abs(outer-d.half)>1e-6||Math.abs(inner+d.half)>1e-6)bad.push(['ends',inner,outer]);
  // stiles and boards share one front plane; the worktop and canopy cover them
  const front=o=>(o.box.x-d.x)*d.fx+(o.box.y-d.y)*d.fy+o.box.hw;
  for(const o of [...boards,...stiles])if(Math.abs(front(o)-B.shelfDepth)>1e-6)bad.push(['front',front(o)]);
  for(const o of shapes){
   const b=o.box,box=model.box;
   if(b.z0<box.z0-eps||b.z1>box.z1+eps)bad.push(['height',b.z0,b.z1]);
   const v=(b.x-d.x)*d.fx+(b.y-d.y)*d.fy,reach=b.r!=null?b.r:b.hw;
   if(o.ray!==coveRayCapsule&&o.ray!==rayRod&&(v-(b.profile?b.hl:reach)< -eps||v+(b.profile?b.hl:reach)>B.depth+.025))bad.push(['depth',v,reach]);
  }
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
