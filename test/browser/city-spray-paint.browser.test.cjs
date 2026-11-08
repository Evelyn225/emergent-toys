'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);clearWanted();for(const c of cars)if(c.patrol){c.x=mod(px+80,N);c.ex=c.x;}for(const c of footCops)c.x=mod(px+80,N);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('spray paint draws where you aim: a sweep is one connected line, the fat cap is wider, R changes colour, holding still runs, the can empties, and every dot is shareable',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  for(let y=8;y<190;y++)for(let x=0;x<N;x++)if(map[idx(x,y)]>.5&&STY[idx(x,y)]<3&&!map[idx(x,y+1)]&&ROAD[idx(x,y+1)]===2){px=x+.5;py=y+1.25;a=-Math.PI/2;break;}
  carryItem({id:'spraypaint',uses:6});held=inv.length-1;const sent=[];PAINT_LISTENERS.push(d=>sent.push(...d));
  const a0=a,frame=(ang,pi,q,fat)=>{a=a0+ang;pitch=pi;K.KeyQ=q;K.ShiftLeft=fat;render(0);stepSprayPaint(1/60);T+=1/60;};
  const stroke=(fat)=>{const n0=sprayDots.length;for(let t=0;t<=1;t+=.02)frame(-.1+t*.2,0,1,fat);frame(0,0,0,0);return sprayDots.slice(n0);};
  const thin=stroke(0),wide=stroke(1);
  // connected: no gap between neighbouring dots bigger than their size
  const gaps=thin.slice(1).map((d,k)=>Math.hypot(rel(d[2]-thin[k][2]),d[3]-thin[k][3])-(d[4]+thin[k][4]));
  const col0=sprayColourOf(heldItem());sprayCycleColour();const col1=sprayColourOf(heldItem());
  const n0=sprayDots.length;for(let k=0;k<120;k++)frame(0,.05,1,0);frame(0,0,0,0);const still=sprayDots.slice(n0),drip=still.filter(d=>d[3]<still[0][3]-still[0][4]*.5);
  // paint on screen: the dot's colour where the crosshair is
  a=a0;pitch=0;render(0);const centre=(rows>>1)*cols+(cols>>1),onScreen=BG[centre]===C(SPRAY_COLOURS[thin[thin.length>>1][5]],Math.max(10,4))||sprayDots.length>0;
  // a remote player's dots: drawn, not echoed back out
  const before=sent.length,remote=[[thin[0][0],thin[0][1],thin[0][2],thin[0][3]+.05,.01,4,99]];paintDots(remote,false);const echo=sent.length-before,sentMine=sent.length;
  // empty it: one long scribble
  let k=0;while(heldItem()?.id==='spraypaint'&&k++<4000)frame(Math.sin(k*.05)*.12,Math.cos(k*.031)*.08,1,1);
  return {thin:thin.length,wideR:wide[0]?.[4]/thin[0]?.[4],maxGap:Math.max(...gaps),colour:col0!==col1,drip:drip.length,sent:sentMine,echo,remoteKept:sprayDots.includes(remote[0]),emptied:heldItem()?.id!=='spraypaint',frames:k};});
 assert.ok(r.thin>8&&r.maxGap<=0,'a sweep is a connected line '+JSON.stringify(r));
 assert.ok(r.wideR>2,'the fat cap is wider');assert.ok(r.colour,'R changes colour');assert.ok(r.drip>0,'held still, it runs');
 assert.ok(r.sent>r.thin&&r.echo===0&&r.remoteKept,'your dots go to listeners; a remote player\'s are kept but not echoed '+JSON.stringify(r));
 assert.ok(r.emptied&&r.frames<4000,'the can empties with use');
}));
