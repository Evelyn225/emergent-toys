'use strict';
// A cop indoors never flickers to a coarse sprite that reads as somebody else; the help line keeps to what isn't
// obvious; apartment numbers go on the entrance canopy, where they can be seen, and never lose the o in No.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{tod=14;weather='clear';env(0);render(0);paused=false;T=10;mode='walk';room=me=freecam=null;clearWanted();});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('two officers and shoppers close by in a store: each officer keeps their close-up sprite every frame',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('store',{word:'STORE',neon:MAG,ret:[px,py,a]},[5,5,0]);
  const cop=(x,y)=>({x,y,targetX:px,targetY:py,path:[],pathT:0,searchT:0,searchI:0,sees:false});
  const c=cop(px+.9,py+.1),c2=cop(px+1.2,py-.4);roomCops.length=0;roomCops.push(c,c2);searchedRoom=room;roomLead=null;wanted.stars=1;
  for(let j=0;j<3;j++)room.props.push(figProp(px+1.4+j*.3,py+.6-j*.4,figStreetLook(j*99,RED,BLUE),{pose:'stand'}));
  a=Math.atan2(c.y-py,c.x-px);pitch=0;figCache.clear();figFineCache.clear();
  const seen=[];for(let k=0;k<60;k++){T+=.05;c.x+=.012*Math.cos(k*.25);c.y+=.012*Math.sin(k*.25);c._moving=true;c._dist=(c._dist||0)+.15;c2._moving=true;c2._dist=(c2._dist||0)+.17;render(0);seen.push(c.figS);}
  return{sizes:[...new Set(seen)],first:seen[0]};});
 assert.equal(r.sizes.length,1,'never a different sprite size from frame to frame: '+r.sizes);assert.ok(r.first>1,'close up');
}));

test('the help line keeps to the context and the obscure: the full list is in the pause menu',()=>city(async p=>{
 const r=await p.evaluate(()=>{settings.help=true;const grab=()=>{const labels=[],cs=[g,hudTopContext()];for(const c of cs)c.fillText=function(s,...a){labels.push(s);return CanvasRenderingContext2D.prototype.fillText.call(this,s,...a);};try{hud();}finally{for(const c of cs)delete c.fillText;}return labels.join(' | ');};
  return{walk:grab()};});
 assert.match(r.walk,/P pee/);assert.match(r.walk,/H hail taxi/);assert.match(r.walk,/all controls/);
 assert.doesNotMatch(r.walk,/WASD move/);assert.doesNotMatch(r.walk,/space jump/);
}));

test('apartment numbers: on the canopy front where there is one, and No. reads NO. in block letters',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const canopies=ARCH_DETAILS.filter(o=>o.kind==='entrance-canopy'&&o.number);
  const o=canopies[0];if(!o)return{none:true};
  // stand in the street in front of it and look at the canopy
  px=o.x+o.nx*.65;py=o.y+o.ny*.65;a=Math.atan2(-o.ny,-o.nx);pitch=.05;body.z=0;for(const q of people)q.hidden=true;cars.length=0;render(0);
  let txt='';for(let i=0;i<CH.length;i++)txt+=typeof CH[i]==='string'&&CH[i].length===1?CH[i]:' ';
  const digits=o.number.slice(3),shown=txt.includes('NO.'+digits)||txt.includes(digits);
  const glyph=blockGlyph('No.',1.5,.5,.1,.1)===blockGlyph('NO.',1.5,.5,.1,.1);
  return{n:canopies.length,shown,glyph};});
 assert.ok(!r.none&&r.n>5);assert.ok(r.shown,'the number on the canopy, from the pavement');assert.ok(r.glyph,'a small o draws as O');
}));
