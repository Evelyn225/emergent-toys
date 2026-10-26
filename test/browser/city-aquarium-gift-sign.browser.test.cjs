'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';T=12;tod=12;env(0);render(0);enterRoom('aquarium',{word:'AQUARIUM',ret:[100,100,0]},[16.5,12.8,0]);});await run(page);assert.deepEqual(errors,[]);}finally{await page.close();}}
test('the aquarium gift label belongs to the solid wall over its counter, clear of tanks and the entrance',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const draw=wallText,signs=[],all=[];let face;wallText=(...args)=>{all.push({face,text:args[5],u:args[6]});if(args[5]==='GIFT SHOP'){signs.push({face,u:args[6],z:args[7],cw:args[8],height:args[9],text:args[5]});return true;}return false;};
  try{for(const[f,mx,my]of [['right',room.W-1,13],['left',0,5],['left-hall',0,2],['right-hall',room.W-1,2],['front',20,room.H-1]]){face=f;aquaWall(0,0,.01,2.3,3,mx,my,10);}}finally{wallText=draw;}
  const bad=[];if(signs.length!==1)return ['gift label is absent or duplicated'];const s=signs[0],half=s.text.length*s.cw/2;
  if(s.face!=='front'||s.u>=0||Math.abs(-s.u-room.def.keeper[0])>.5)bad.push('gift label is behind the side tank or has the wrong inside-facing coordinates');
  if(s.z-s.height/2<1.9||s.z+s.height/2>room.def.height)bad.push('label intersects people or ceiling');
  for(let u=s.u-half;u<s.u+half;u+=.03)if(roomAt(Math.floor(-u),room.H-1)!=='#'||TANKS[roomAt(Math.floor(-u),room.H-2)])bad.push('label has no clear solid mounting wall');
  for(const[text,f,u]of [['CORAL REEF','right',7.5],['JELLYFISH','left',-4.6],['SEAHORSES','left',-13],['THANK YOU FOR VISITING','front',-6],['OPEN OCEAN','left-hall',-2.6],['OPEN OCEAN','right-hall',2.6]])if(!all.some(s=>s.text===text&&s.face===f&&s.u===u))bad.push([text,'lost gallery label or incorrect inside-facing anchor',f]);
  px=19;py=12.9;if(!free(px,py)||!nearKeeper())bad.push('gift shop service approach is not clear');
  return bad;
 });assert.deepEqual(r,[]);
}));

test('native exit and ocean-hall labels use their visible interior wall faces',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const original=wallText,bad=[];let wanted='',painted=0;
  wallText=(...args)=>{const hit=original(...args);if(hit&&args[5]===wanted&&CH[args[0]]!==' '){painted++;BG[args[0]]=C(MAG,15);}return hit;};
  try{for(const[text,x,y,tx,ty]of [['THANK YOU FOR VISITING',6,11.8,6,15],['OPEN OCEAN',3.1,2.6,1,2.6],['OPEN OCEAN',20.5,2.6,23,2.6]]){
   wanted=text;px=x;py=y;a=Math.atan2(ty-py,tx-px);pitch=0;render(0);pitch=.6/Math.hypot(tx-px,ty-py)*projY/rows;painted=0;render(0);
   const visible=Array.from(BG).filter(c=>c===C(MAG,15)).length;if(!free(px,py)||painted<20||visible<20)bad.push([text,'missing native wall label',x,y,painted,visible]);
  }}finally{wallText=original;}return bad;
 });assert.deepEqual(r,[]);
}));
test('native gift-shop approaches show every letter by day and night, and close lettering resolves into larger glyphs',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const original=wallText,bad=[];let owners=null,big=0;
  wallText=(...args)=>{const hit=original(...args);if(hit&&args[5]==='GIFT SHOP'&&CH[args[0]]!==' '){const p=Math.floor((args[1]-args[6])/args[8]+args[5].length/2);owners[args[0]]=p;BG[args[0]]=C(MAG,15);if(CH[args[0]]==='#')big++;}return hit;};
  try{for(const [name,x,y,time]of [['wide',16.5,12.8,12],['close',20.5,12.5,12],['oblique',18,14,12],['night',18.5,12.6,23]]){
   px=x;py=y;tod=time;env(0);a=Math.atan2(15-py,20.5-px);pitch=0;owners=new Int16Array(cols*rows).fill(-1);big=0;render(0);pitch=(2.3-1.7)/Math.hypot(20.5-px,15-py)*projY/rows;owners=new Int16Array(cols*rows).fill(-1);big=0;render(0);
   if(!free(px,py))bad.push([name,'camera not on clear floor']);const visible=new Set();let pixels=0;for(let i=0;i<owners.length;i++)if(owners[i]>=0&&BG[i]===C(MAG,15)){visible.add(owners[i]);pixels++;}
   for(const p of [0,1,2,3,5,6,7,8])if(!visible.has(p))bad.push([name,'occluded letter','GIFT SHOP'[p],p,pixels]);
   if(name==='close'&&big<30)bad.push('close lettering does not scale');
  }}finally{wallText=original;}return bad;
 });assert.deepEqual(r,[]);
}));
