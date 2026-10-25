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
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('bar',{word:'BAR',neon:CYAN,ret:[100,100,0]},[6,4.5,-Math.PI/2]);});
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
   const b=o.box,box=model.box,cu=box.c,su=box.s;
   let along,across;
   if(o.ray===coveRayCapsule){
    along=Math.max(Math.abs((b.ax-box.x)*cu+(b.ay-box.y)*su),Math.abs((b.bx-box.x)*cu+(b.by-box.y)*su))+b.r;
    across=Math.max(Math.abs(-(b.ax-box.x)*su+(b.ay-box.y)*cu),Math.abs(-(b.bx-box.x)*su+(b.by-box.y)*cu))+b.r;
   }else{
    const du=(b.x-box.x)*cu+(b.y-box.y)*su,dv=-(b.x-box.x)*su+(b.y-box.y)*cu;
    const cc=b.c*cu+b.s*su,ss=-b.c*su+b.s*cu;
    along=Math.abs(du)+Math.abs(cc)*b.hl+Math.abs(ss)*b.hw;
    across=Math.abs(dv)+Math.abs(ss)*b.hl+Math.abs(cc)*b.hw;
   }
   if(b.z0<box.z0-eps||b.z1>box.z1+eps||along>box.hl+eps||across>box.hw+eps)bad.push(['bounds',b.z0,b.z1,along,across]);
  }
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));

test('mirrored cabinet bounds include handles at cardinal and oblique orientations',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const [fx,fy]of [[0,1],[1,0],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
   const model=BAR_MIRRORED_BACK_BAR(0,0,3.7,fx,fy),shapes=[],bad=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const a=model.box,c=a.c,s=a.s;
   for(const q of shapes){const b=q.box;let u,v;
    if(q.ray===coveRayCapsule){u=Math.max(Math.abs((b.ax-a.x)*c+(b.ay-a.y)*s),Math.abs((b.bx-a.x)*c+(b.by-a.y)*s))+b.r;v=Math.max(Math.abs(-(b.ax-a.x)*s+(b.ay-a.y)*c),Math.abs(-(b.bx-a.x)*s+(b.by-a.y)*c))+b.r;}
    else if(b.profile){u=Math.abs((b.x-a.x)*c+(b.y-a.y)*s)+b.hl;v=Math.abs(-(b.x-a.x)*s+(b.y-a.y)*c)+b.hl;}
    else{const cc=b.c*c+b.s*s,ss=-b.c*s+b.s*c;u=Math.abs((b.x-a.x)*c+(b.y-a.y)*s)+Math.abs(cc)*b.hl+Math.abs(ss)*b.hw;v=Math.abs(-(b.x-a.x)*s+(b.y-a.y)*c)+Math.abs(ss)*b.hl+Math.abs(cc)*b.hw;}
    if(u>a.hl+1e-8||v>a.hw+1e-8||b.z0<a.z0-1e-8||b.z1>a.z1+1e-8)bad.push([u,v,b.z0,b.z1]);
   }out.push({fx,fy,bad});
  }return out;
 });for(const r of result)assert.deepEqual(r.bad,[],JSON.stringify(r));
}));

test('cached vessel rejection matches full lathe rays and upturned tumblers have a real open mouth below a closed base',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const {shapes}=parts(),unique=new Map(),bad=[];
  for(const q of shapes)if(q.ray===backBarRayBottle)unique.set(q.box.profile,q);
  let probes=0;
  for(const q of unique.values()){
   const b=q.box;
   for(const [rx,ry,rz]of [[0,-1,0],[-1,0,.15],[0,0,-1]])for(let i=-5;i<=5;i++)for(let k=-1;k<=9;k++){
    let x=b.x+i/5*b.hl,y=b.y+.5,z=b.z0+(b.z1-b.z0)*k/8;
    if(rx){x=b.x+.5;y=b.y+i/5*b.hl;}else if(rz){y=b.y+k/8*b.hl;z=b.z1+.5;}
    const fast=backBarRayBottle(x,y,z,rx,ry,rz,b),full=coveRayLathe(x,y,z,rx,ry,rz,b);
    if((fast<0)!==(full<0)||(fast>0&&Math.abs(fast-full)>1e-7))bad.push([i,k,rx,ry,rz,fast,full]);probes++;
   }
  }
  const glass=[...unique.values()].find(q=>Math.abs(q.box.z0-(BACK_BAR.top+.006))<1e-7&&Math.abs(q.box.z1-q.box.z0-.085)<1e-7),b=glass.box;
  const below=b.z0-.5+coveRayLathe(b.x,b.y,b.z0-.5,0,0,1,b),above=b.z1+.5-coveRayLathe(b.x,b.y,b.z1+.5,0,0,-1,b);
  if(!(below>b.z0+.07&&Math.abs(above-b.z1)<1e-7&&Math.abs(above-below-.006)<1e-7))bad.push(['glass cavity',below,above,b.z0,b.z1]);
  const ring=b.z0-.5+coveRayLathe(b.x+.038,b.y,b.z0-.5,0,0,1,b);if(Math.abs(ring-b.z0)>1e-7)bad.push(['glass rim support',ring,b.z0]);
  return{bad:bad.slice(0,20),probes,profiles:unique.size};
 });assert.deepEqual(r.bad,[]);assert.ok(r.probes>4000);assert.ok(r.profiles>=10);
}));
