'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('all six salsa pans recess into the worktop and their food rests on real tray floors',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=KITCHEN_SALSA_BAR(0,0),draw=drawBox,shapes=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const top=shapes.find(q=>q.ray===homeRayWorktop&&q.box.hl>.3),pans=shapes.filter(q=>q.ray===foodRayTray),
   foods=shapes.filter(q=>q.ray===homeRayWorktop&&Math.abs(q.box.z0-.888)<1e-6),labels=shapes.filter(q=>q.ray===homeRayWorktop&&q.box.c===0);
  const recessed=pans.every(q=>{
   const b=q.box,t=top.ray(b.x,b.y,2,0,0,-1,top.box),opening=t>0&&!top.shade(0,t,8),floor=2-q.ray(b.x,b.y,2,0,0,-1,b);
   return opening&&floor<top.box.z1-.03&&floor>top.box.z0&&b.z1>top.box.z1;
  });
  const contacts=foods.every(q=>{const p=pans.find(p=>inBox(p.box,q.box.x,q.box.y,0)),t=p.ray(q.box.x,q.box.y,2,0,0,-1,p.box);return t>0&&Math.abs(2-t-q.box.z0)<1e-6;});
  const rimT=top.ray(.3,0,2,0,0,-1,top.box),rimClosed=top.shade(0,rimT,8);
  const bounds=shapes.every(({box:b})=>Math.abs(b.x)+Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw<=model.box.hl+1e-6&&
   Math.abs(b.y)+Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw<=model.box.hw+1e-6&&b.z0>=0&&b.z1<=model.box.z1+1e-6);
  return{pans:pans.length,foods:foods.length,labels:labels.length,recessed,contacts,rimClosed,bounds};
 });
 assert.equal(r.pans,6);assert.equal(r.foods,6);assert.equal(r.labels,6);assert.ok(r.recessed&&r.contacts&&r.rimClosed&&r.bounds,JSON.stringify(r));
}));

test('ramen stoves and taco side fittings clear walls, counters and staff; both shops retain real E service',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['noodle','RAMEN',6.5,2.95],['taqueria','TACOS',5.2,3.3]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const models=room.props.filter(q=>q.kitchenPlate?.kind==='stockpot'||q.kitchenSalsa),bad=[];
   for(const o of models){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
    for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
    for(const q of room.props.filter(q=>q.furniture==='counter'))if(furnishingOverlap(o.box,q.box))bad.push(['counter',q.x,q.y]);
   }
   if(kind==='taqueria')for(const q of room.props.filter(q=>q.box&&q.box.x>11))if(q.box.x+Math.abs(q.box.c)*q.box.hl+Math.abs(q.box.s)*q.box.hw>12)bad.push(['outside',q.box.x]);
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{models:models.length,bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.equal(r.models,kind==='noodle'?2:1);assert.deepEqual(r.bad,[],JSON.stringify({kind,...r}));assert.ok(r.clear,JSON.stringify({kind,...r}));assert.match(r.prompt,/E: shop$/);
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));

test('ramen bowls and diner meals rest inside the supporting counters and tables',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const rnd=Math.random,out=[];try{Math.random=()=>0;
   for(const [kind,word]of [['noodle','RAMEN'],['diner','DINER']]){
    enterRoom(kind,{word,ret:[100,100,0]},[6,4,0]);const settings=room.props.filter(q=>q.tableware),supported=settings.every(q=>
     room.props.some(t=>t!==q&&t.box&&Math.abs(t.box.z1-q.tableware.support)<1e-6&&inBox(t.box,q.x,q.y,0)&&Math.abs(q.x-t.box.x)+.12<=t.box.hl&&Math.abs(q.y-t.box.y)+.12<=t.box.hw));
    out.push({kind,settings:settings.length,supported});
   }
  }finally{Math.random=rnd;}return out;
 });
 assert.equal(r[0].settings,6);assert.equal(r[1].settings,6); // (the diner has three tables: the fourth made way for the washroom door)for(const q of r)assert.ok(q.supported,JSON.stringify(q));
}));
