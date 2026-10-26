'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const ROOMS=[['grocer','GROCER',2,['DAIRY','COLD DRINKS']],['deli','DELI',1,['COLD DRINKS']],['liquor','LIQUOR',2,['BEER','BEER']],['store','STORE',1,['COLD DRINKS']],['gas','GAS',1,['COLD DRINKS']]];

test('shop fridge walls are built coolers on their wall faces, the length of the old painted run, the aisle in front still walkable',()=>fixture(async p=>{
 const r=await p.evaluate(ROOMS=>{
  const out=[],bad=[];
  for(const [kind,word,n,labels] of ROOMS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const runs=room.props.filter(o=>o.drinksCooler&&o.drinksCooler.depth===SHOP_FRIDGE_DEPTH);
   out.push([kind,runs.length===n,JSON.stringify(runs.map(o=>o.drinksCooler.label))===JSON.stringify(labels)]);
   for(const o of runs){const d=o.drinksCooler,c=-d.fy,s=d.fx;
    for(const u of [-d.half+.05,0,d.half-.05]){
     const bx=o.x+c*u-d.fx*(d.depth+.03),by=o.y+s*u-d.fy*(d.depth+.03);if(roomAt(bx,by)!=='#'&&roomAt(bx,by)!=='W')bad.push([kind,'back off the wall',u]);
     // someone can stand in front of every door
     const fx_=o.x+c*u+d.fx*(d.depth+.25),fy_=o.y+s*u+d.fy*(d.depth+.25);if(!free(fx_,fy_)&&!room.props.some(q=>q!==o&&q.box&&!q.walk&&inBox(q.box,fx_,fy_,.2)))bad.push([kind,'front blocked by the walls',u]);
    }
    // nothing else stands inside the run
    for(const q of room.props)if(q!==o&&q.box&&!q.walk&&q.box.z1>.1){
     const b=q.box,ax=Math.abs((b.x-o.x)*c+(b.y-o.y)*s),av=Math.abs((b.x-o.x)*d.fx+(b.y-o.y)*d.fy);
     const ru=Math.abs(b.hl*(b.c*c+b.s*s))+Math.abs(b.hw*(-b.s*c+b.c*s)),rv=Math.abs(b.hl*(b.c*d.fx+b.s*d.fy))+Math.abs(b.hw*(-b.s*d.fx+b.c*d.fy));
     if(ax<d.half+ru-1e-6&&av<d.depth+rv-1e-6)bad.push([kind,'overlaps',+b.x.toFixed(2),+b.y.toFixed(2)]);
    }
    if(d.goods.length<40)bad.push([kind,'thin stock',d.goods.length]);
   }
  }
  return{out,bad:bad.slice(0,8),count:bad.length};
 },ROOMS);
 assert.deepEqual(r.bad,[],r.count+' bad');for(const [k,count,labels] of r.out)assert.ok(count&&labels,k);
}));

test('the dairy run stocks cartons and pots; the wall painters no longer draw fridges behind the runs',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('grocer',{word:'GROCER',ret:[100,100,0]},[5,5,0]);
  const dairy=room.props.find(o=>o.drinksCooler?.stock==='dairy').drinksCooler,kinds=new Set(dairy.goods.map(g=>g.kind));
  // sample each old painted fridge wall: plain wall paint, not a lit fridge interior
  const painted=[];
  for(const [kind,word,u,mx,my] of [['grocer','GROCER',4,0,4],['deli','DELI',4,0,4],['store','STORE',3,9,3],['gas','GAS',4,4,0],['liquor','LIQUOR',5,0,5]]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);const i=0;BG[i]=0;CH[i]='?';
   const hit=room.def.wall?room.def.wall(i,u,.01,1.0,3,mx,my,8):false;painted.push([kind,hit&&BG[i]>=C(CYAN,2)&&BG[i]<=C(CYAN,4)]);
  }
  return{kinds:[...kinds].sort(),painted};
 });
 assert.deepEqual(r.kinds,['carton','pot']);for(const [k,p] of r.painted)assert.equal(p,false,k);
}));

test('wall-fridge stock has real shelf contacts inside the glass and reuses its prepared profiles',()=>fixture(async p=>{
 const result=await p.evaluate(ROOMS=>{
  const bad=[];let count=0;
  const capture=o=>{const draw=drawBox,out=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};
  for(const[kind,word]of ROOMS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   for(const o of room.props.filter(o=>o.drinksCooler?.depth===SHOP_FRIDGE_DEPTH)){
    const d=o.drinksCooler,c=-d.fy,s=d.fx,parts=capture(o),stock=parts.filter(q=>(q.ray===coveRayLathe||q.ray===homeRayWorktop)&&q.box.hl<.05&&q.box.hw<.05&&q.box.z1-q.box.z0<.3&&COOLER_LEVELS.some(z=>Math.abs(q.box.z0-z)<1e-8));
    const again=capture(o).filter(q=>(q.ray===coveRayLathe||q.ray===homeRayWorktop)&&q.box.hl<.05&&q.box.hw<.05&&q.box.z1-q.box.z0<.3&&COOLER_LEVELS.some(z=>Math.abs(q.box.z0-z)<1e-8));
    if(stock.length!==d.goods.length)bad.push([kind,'stock count']);count+=stock.length;
    if(stock.some((q,k)=>q.box.profile&&q.box.profile!==again[k].box.profile))bad.push([kind,'stock profiles rebuilt']);
    const shelves=parts.filter(q=>q.box.hl>d.half*.9&&q.box.hw>.07&&q.ray===rayBox);
    for(const q of stock){const b=q.box,u=(b.x-o.x)*c+(b.y-o.y)*s,v=(b.x-o.x)*d.fx+(b.y-o.y)*d.fy,ru=b.hl,rv=q.ray===coveRayLathe?b.hl:b.hw;
     if(Math.abs(u)+ru>d.half-COOLER_WALL+1e-8||v+rv>d.depth-.019||v-rv< -d.depth+COOLER_WALL)bad.push([kind,'stock outside the cabinet/glass']);
     if(!shelves.some(r=>{const t=r.ray(b.x,b.y,b.z0+.05,0,0,-1,r.box);return t>0&&Math.abs(t-.05)<1e-7;}))bad.push([kind,'stock has no shelf contact']);
     const next=COOLER_LEVELS.find(z=>z>b.z0+.01)??COOLER_TOP;if(b.z1>next-.015)bad.push([kind,'stock enters the shelf above']);
    }
   }
  }
  return{bad:bad.slice(0,8),count};
 },ROOMS);assert.deepEqual(result.bad,[]);assert.ok(result.count>1000,'all seven authored wall coolers checked');
}));
