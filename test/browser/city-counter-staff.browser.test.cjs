'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');

test('legacy counter staff clear their cabinets and back walls while remaining reachable by real E',async()=>{
 const browser=await chromium.launch();try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
  for(const [kind,word]of [['store','24/7'],['bar','BAR'],['diner','DINER'],['tea','TEA HOUSE'],['petshop','PET SHOP'],['florist','FLORIST']]){
   const r=await p.evaluate(({kind,word})=>{
    enterRoom(kind,{word,ret:[100,100,0]},[5,5,-Math.PI/2]);const k=room.def.keeper,
     clerk=room.props.find(o=>o.fig&&Math.hypot(o.x-k[0],o.y-k[1])<1e-6),bad=[];
    for(const q of room.props)if(q.box&&q.box.z0<1&&q.box.z1>.2&&inBox(q.box,clerk.x,clerk.y,.18))bad.push(['cabinet',q.box.x,q.box.y]);
    for(const sx of [-1,1])for(const sy of [-1,1])if(roomAt(clerk.x+sx*.18,clerk.y+sy*.18)!=='.')bad.push(['wall',sx,sy]);
    // Choose clear floor on the customer side without standing in an occupied
    // stool. Check the same aimed interaction used by the visible prompt.
    let approach=null;
    for(let y=2.35;y<=3.05&&!approach;y+=.1)for(let x=k[0]-.8;x<=k[0]+.8&&!approach;x+=.1){
     if(!free(x,y)||room.props.some(q=>q.fig&&Math.hypot(q.x-x,q.y-y)<.35))continue;
     px=x;py=y;a=Math.atan2(k[1]-py,k[0]-px);render(0);if(/E: shop$/.test(promptText()))approach=[px,py];
    }
    return{bad,approach,prompt:promptText()};
   },{kind,word});
   assert.deepEqual(r.bad,[],kind);assert.ok(r.approach,JSON.stringify({kind,...r}));
   await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'),kind);await p.keyboard.press('KeyE');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
