'use strict';
// ASCII City: taps and light switches you can use in any room, the market hall's stalls each selling their own
// things, a cooked dish landing in your hand, and the skateboard up on the roofs.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
// stand off (x, y) on the (dx, dy) side and look straight at height z
const aimAt=`(x,y,z,dx,dy,d)=>{px=x+dx*d;py=y+dy*d;a=Math.atan2(-dy,-dx);const e=interactionEye();pitch=0;pitch=(z-e)/d*projY/rows;}`;

test('a basin tap runs and stops, and the switch by the door dims the room',()=>fixture(async p=>{
 const r=await p.evaluate(aim=>{
  const bad=[],aimAt=eval(aim);
  enterRoom('thai',{word:'THAI',ret:[100,100,0]},[5,5,0]);render(0);
  const taps=roomTaps();if(!taps.length)return ['no taps in a room with a washroom'];
  room.bathroomDoors?.forEach(d=>{d.bathroomDoor.open=d.bathroomDoor.target=1;});
  const t=taps[0],sink=t.prop.bathroomSink;aimAt(t.x,t.y,t.z-.05,sink.fx,sink.fy,.7);
  const f=interactionFocus();if(f?.kind!=='room-fixture'||f.who.tap!==t)return ['tap not in focus',f?.kind];
  if(promptText()!=='E: turn the tap on')bad.push(['prompt',promptText()]);
  useFocusedInteraction();if(!t.on||!room.props.includes(t.stream))bad.push('tap did not run');
  useFocusedInteraction();if(t.on)bad.push('tap did not stop');
  const sw=roomSwitch();if(!sw)return [...bad,'no switch'];
  if(roomAt(sw.x,sw.y)!=='.'||roomAt(sw.x-sw.nx*.1,sw.y-sw.ny*.1)!=='#')bad.push(['switch not on the wall',sw.x,sw.y]);
  aimAt(sw.x,sw.y,1.2,sw.nx,sw.ny,1);
  if(interactionFocus()?.who?.kind!=='switch')bad.push(['switch not in focus',interactionFocus()?.kind]);
  const lit=room.def.light;useFocusedInteraction();
  if(!(room.def.light<lit*.5)||roomLightsOn())bad.push(['lights did not go down',room.def.light,lit]);
  useFocusedInteraction();if(Math.abs(room.def.light-lit)>1e-9||!roomLightsOn())bad.push('lights did not come back');
  render(0);return bad;
 },aimAt);
 assert.deepEqual(r,[]);
}));

test('a fitted kitchen tap runs over its own bowl',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];enterRoom('hotelroom',{word:'HOTEL',suite:true,ret:[100,100,0]},[3,3,0]);render(0);
  const t=roomTaps().find(t=>t.prop.kitchen);if(!t)return ['no kitchen tap'];
  const k=t.prop.kitchen,c=Math.cos(k.angle),s=Math.sin(k.angle),[sx,sy]=[t.prop.x+c*k.sink,t.prop.y+s*k.sink];
  if(Math.hypot(t.x-sx,t.y-sy)>k.radius)bad.push(['spout not over the bowl',+Math.hypot(t.x-sx,t.y-sy).toFixed(3)]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('the market hall: every stallholder sells their own things, nine at most',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];enterRoom('markethall',{word:'MARKET',ret:[100,100,0]},[8,6,0]);
  const sellers=room.props.filter(o=>o.stall),lists=[stockFor('markethall','MARKET'),...sellers.map(o=>o.stall[1])];
  if(sellers.length!==6)bad.push(['stallholders',sellers.length]);
  const seen=new Map();
  for(const l of lists){if(!l.length||l.length>9)bad.push(['stock size',l.length]);for(const id of l){if(!ITEMS[id])bad.push(['no such item',id]);seen.set(id,(seen.get(id)||0)+1);}}
  for(const [id,n] of seen)if(n>1)bad.push(['sold twice',id]);
  const fish=sellers.find(o=>o.stall[0]==='FISHMONGER');px=fish.x;py=fish.y+1.2;a=-Math.PI/2;pitch=0;
  if(promptText()!=='E: fishmonger')bad.push(['prompt',promptText()]);
  useFocusedInteraction();if(shopCtx?.title!=='FISHMONGER')bad.push(['shop',shopCtx?.title]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('a finished dish goes straight into your hand',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  clearInventory();carryItem({id:'eggs',uses:0},false);carryItem({id:'bread',uses:0},false);carryItem({id:'water',uses:3});
  serveDish(RECIPE.friedeggs,'fine');return heldItem()?.id;
 });
 assert.equal(r,'friedeggs');
}));

test('the board comes out on a roof, and rolls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  let at=null;for(let y=8;y<240&&!at;y++)for(let x=8;x<240&&!at;x++){const h=map[idx(x,y)];
   if(h>.2&&[[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]].every(([dx,dy])=>roofHeightAt(x+.5+dx,y+.5+dy)===h))at=[x+.5,y+.5,h];}
  if(!at)return 'no roof';
  clearInventory();carryItem({id:'skateboard',uses:0});mode='roof';room=null;[px,py,roofH]=at;roofLot=new Set();a=0;body.z=body.vz=0;
  const [line]=useHeld({indoors:false,x:px,y:py,a,rain:0,person:null,headlines:[],water:false});
  if(!fx.skating||!skatingNow())return ['no skating',line];
  stepGoods(0);if(!fx.skating)return 'board put away up there';
  const x0=px;SK.lastT=T;SK.v=.4;SK.dir=0;T+=.05;stepSkate(.05);render(0);
  return [mode,px>x0];
 });
 assert.deepEqual(r,['roof',true]);
}));
