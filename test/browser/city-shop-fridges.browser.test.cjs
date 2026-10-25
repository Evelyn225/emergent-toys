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
