'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('cafe',{word:'CAFE',ret:[100,100,0]},[4.6,2.72,-Math.PI/2]);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('café barista clears the counter and walls, with a continuous customer approach and real E service',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const k=room.def.keeper,clerk=room.props.find(o=>o.fig&&Math.hypot(o.x-k[0],o.y-k[1])<1e-6),bad=[];
  for(const q of room.props)if(q!==clerk&&q.box&&q.box.z0<1&&q.box.z1>.2&&inBox(q.box,clerk.x,clerk.y,.18))bad.push([q.box.x,q.box.y]);
  const wallClear=roomAt(clerk.x-.18,clerk.y-.18)==='.'&&roomAt(clerk.x+.18,clerk.y+.18)==='.';
  let lane=true;for(let x=4.1;x<=6.4;x+=.05)lane&&=free(x,2.72);
  a=Math.atan2(k[1]-py,k[0]-px);render(0);return{bad,wallClear,lane,clear:free(px,py),prompt:promptText()};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.wallClear&&r.lane&&r.clear,JSON.stringify(r));assert.match(r.prompt,/E: shop$/);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
}));

test('espresso has full worktop support and the compact case fits every pastry on its actual tray floor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,espresso=room.props.find(o=>o.kitchenCoffee?.kind==='espresso'),counter=room.props.find(o=>o.furniture==='counter'),model=room.props.find(o=>o.foodCase),shapes=[];
  projX=10000;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{counter.draw(counter.x,counter.y);}finally{drawBox=draw;}
  const top=shapes.find(q=>q.ray===coveRayRounded&&Math.abs(q.box.z1-espresso.box.z0)<1e-6);
  const supported=[-1,1].every(sx=>[-1,1].every(sy=>{const b=espresso.box,t=top.ray(b.x+sx*b.hl,b.y+sy*b.hw,2,0,0,-1,top.box);return t>0&&Math.abs(2-t-b.z0)<1e-5;}));
  shapes.length=0;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
  const trays=shapes.filter(q=>q.ray===foodRayTray),food=shapes.filter(q=>(q.ray===foodRayEllipsoid||q.ray===coveRayLathe)&&Math.abs(q.box.z0-model.foodCase.shelf-.008)<1e-6);
  const contacts=food.every(q=>{
   const tray=trays.find(t=>inBox(t.box,q.box.x,q.box.y,0));if(!tray)return false;
   const b=q.box,ex=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw,
    t=tray.ray(b.x,b.y,2,0,0,-1,tray.box);
   return t>0&&Math.abs(2-t-b.z0)<1e-6&&Math.abs(b.x-tray.box.x)+ex<=tray.box.hl-.008+1e-6&&Math.abs(b.y-tray.box.y)+ey<=tray.box.hw-.008+1e-6;
  });
  const bounds=shapes.every(({box:b})=>Math.abs(b.x-model.x)+Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw<=model.box.hl+.001&&
   Math.abs(b.y-model.y)+Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw<=model.box.hw+.001&&b.z0>=0&&b.z1<=model.box.z1+.013);
  return{supported,trays:trays.length,foods:food.length,contacts,bounds};
 });
 assert.ok(r.supported&&r.contacts&&r.bounds,JSON.stringify(r));assert.equal(r.trays,5);assert.ok(r.foods>=10);
}));

test('the compact case remains clear from front and end, and café cups sit on their tables',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=room.props.find(o=>o.foodCase),settings=room.props.filter(o=>o.tableware),supported=settings.every(q=>{
   const table=room.props.find(t=>t!==q&&t.box&&Math.abs(t.box.z1-q.tableware.support)<1e-6&&inBox(t.box,q.x,q.y,0));
   return !!table&&Math.abs(q.x-table.box.x)+.12<table.box.hl&&Math.abs(q.y-table.box.y)+.12<table.box.hw;
  });
  room.props=[model];body.crouch=1;const visible=[];
  for(const end of [false,true]){
   px=model.x+(end?1.45:0);py=model.y+(end?0:1.15);a=end?Math.PI:-Math.PI/2;pitch=-.12;render(0);
   let count=0;for(let i=0;i<BG.length;i++)if(((BG[i]>>4)===ORANGE||(BG[i]>>4)===MAG)&&Number.isFinite(ZB[i])&&ZB[i]<2)count++;
   visible.push(count);
  }
  return{settings:settings.length,supported,visible};
 });
 assert.equal(r.settings,10);assert.ok(r.supported);assert.ok(r.visible.every(n=>n>4),JSON.stringify(r));
}));
