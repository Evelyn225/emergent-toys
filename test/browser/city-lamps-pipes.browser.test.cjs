'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('lamp posts and drainpipes are solid colour near and far, never a line of characters',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   // the far lamp (a billboard), at several cell sizes, day and night: drawn, and no characters
   for(const td of [14,22]){tod=td;env(0);let drawn=0,ch=0;
    for(const du of [.004,.02,.05])for(let u=-.1;u<.25;u+=du/2)for(let z=0;z<LAMP_TOP+.05;z+=du/2){CH[0]=' ';if(lampCell(0,u,z,du,du*1.6,10,1)){drawn++;if(CH[0]!==' ')ch++;}}
    if(!drawn||ch)bad.push([td,'lamp billboard',drawn,ch]);}
   // beside the street lamps: lamp posts, necks and drainpipes don't show as | / \\ - lines (main had 2.3% characters here)
   tod=14;env(0);let n=0,g=0;
   for(let k=0,v=0;k<lamps.length&&v<10;k+=Math.max(1,lamps.length/10|0)){const l=lamps[k];if(!ROAD[idx(Math.floor(l.x),Math.floor(l.y))])continue;v++;const ang=Math.atan2(l.ay,l.ax)+Math.PI/2;
    px=l.x-Math.cos(ang)*1.2+l.ax*.4;py=l.y-Math.sin(ang)*1.2+l.ay*.4;a=ang;pitch=.15;render(0);for(let i=0;i<cols*rows;i++){n++;if('|/\\'.includes(CH[i]))g++;}}
   if(!n||g/n>.006)bad.push(['line characters beside the lamps',n,+(100*g/n).toFixed(2)]);
   // drainpipes from across the street (12 to 22 m off, where a pipe is thinner than a cell): no line characters on them
   let pc=0,pn=0;for(let k=0,v=0;k<facadePipes.length&&v<8;k+=Math.max(1,facadePipes.length/8|0)){const q=facadePipes[k];
    for(const dist of [1.2,2.2]){const ox=q.ax,oy=q.ay;px=q.x+ox*dist;py=q.y+oy*dist;v++;a=Math.atan2(-oy,-ox);pitch=.25;render(0);
     const [vx,vy]=R(q.x,q.y),cx=Math.round(cols/2+(-Math.sin(a)*vx+Math.cos(a)*vy)/(Math.cos(a)*vx+Math.sin(a)*vy)*projX/cw);
     for(let rr=0;rr<rows;rr++)for(let x=cx-2;x<=cx+2;x++)if(x>=0&&x<cols){pn++;if('|/\\'.includes(CH[rr*cols+x]))pc++;}}}
   if(!pn||pc/pn>.02)bad.push(['line characters on the drainpipes',pn,pc]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
