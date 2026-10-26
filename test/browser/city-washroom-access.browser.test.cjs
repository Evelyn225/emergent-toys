'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';T=12;tod=12;body.z=body.vz=0;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);}finally{await page.close();}}
test('taco, coffee and cafe washroom doors have a full usable approach without furniture in the path',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];for(const kind of ['taqueria','roastery','cafe']){
   enterRoom(kind,{ret:[100,100,0]},[11.5,5.1,-Math.PI/2]);const p=room.bathroomDoors[0];
   if(p.bathroomDoor.open!==0)bad.push([kind,'door no longer starts closed']);
   for(let x=p.x-.2;x<=p.x+.201;x+=.1)for(let y=p.y+.4;y<=p.y+1.651;y+=.1)if(!free(x,y))bad.push([kind,'blocked door apron',+x.toFixed(2),+y.toFixed(2)]);
   for(let x=10.3;x<11.51;x+=.1)if(!free(x,4.55))bad.push([kind,'blocked sideways approach',x]);
  }return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));
test('real E and native walking reach each toilet and return; the privacy leaf closes after walking away',()=>fixture(async page=>{
 for(const kind of ['taqueria','roastery','cafe']){
  const before=await page.evaluate(kind=>{
   enterRoom(kind,{ret:[100,100,0]},[11.5,5.1,-Math.PI/2]);body.z=body.vz=0;
   for(let k=0;k<5;k++)move(0,-.1);move(0,-.05);a=-Math.PI/2;pitch=0;render(0);return{free:free(px,py),position:[px,py],prompt:promptText()};
  },kind);assert.ok(before.free,kind+JSON.stringify(before));assert.match(before.prompt,/open bathroom door/,kind);
  await page.keyboard.press('e');const inside=await page.evaluate(()=>{stepBathroomDoors(2);for(let k=0;k<22;k++)move(0,-.1);return{open:room.bathroomDoors[0].bathroomDoor.open,free:free(px,py),wc:inWc(px,py),loo:looNear(),position:[px,py]};});
  assert.ok(inside.open===1&&inside.free&&inside.wc&&inside.loo,kind+JSON.stringify(inside));
  const returned=await page.evaluate(()=>{for(let k=0;k<22;k++)move(0,.1);const returned=py>4.4&&free(px,py);for(let k=0;k<20;k++)move(-.1,0);stepBathroomDoors(2);const d=room.bathroomDoors[0].bathroomDoor;return{returned,free:free(px,py),closed:d.open===0&&d.target===0};});assert.deepEqual(returned,{returned:true,free:true,closed:true},kind);
 }
}));
test('repositioned fixtures stay separate, inside the walls and accessible from the cooler front',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('taqueria',{ret:[100,100,0]},[10,6,0]);const salsa=room.props.find(p=>p.kitchenSalsa),cooler=room.props.find(p=>p.drinksCooler),bad=[];
  if(!salsa||!cooler)return ['missing salsa bar or drinks cooler'];
  const a=salsa.box,b=cooler.box,overlap=[[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]].every(([x,y])=>Math.abs((a.x-b.x)*x+(a.y-b.y)*y)<Math.abs(a.c*x+a.s*y)*a.hl+Math.abs(-a.s*x+a.c*y)*a.hw+Math.abs(b.c*x+b.s*y)*b.hl+Math.abs(-b.s*x+b.c*y)*b.hw-1e-6);
  if(overlap)bad.push('salsa bar overlaps cooler');
  for(const p of [salsa,cooler])for(const u of [-1,1])for(const v of [-1,1]){const q=p.box,x=q.x+u*q.hl*q.c-v*q.hw*q.s,y=q.y+u*q.hl*q.s+v*q.hw*q.c;if(x<1||x>room.W-1||y<1||y>room.H-1)bad.push('moved fixture intersects a wall');}
  const c=cooler.drinksCooler;if(!free(cooler.x+c.fx*.9,cooler.y+c.fy*.9))bad.push('cooler faces blocked floor');
  enterRoom('roastery',{ret:[100,100,0]},[6,6,0]);const plants=room.props.filter(p=>p.far&&p.box?.z1===1.5);
  if(plants.length!==1)bad.push('missing roastery floor plant');
  for(const p of plants){const q=p.box;if(q.z0!==0||q.x-q.hl<1||q.x+q.hl>room.W-1||q.y-q.hw<1||q.y+q.hw>room.H-1)bad.push('relocated plant floats or crosses a wall');}
  return bad;
 });assert.deepEqual(r,[]);
}));
