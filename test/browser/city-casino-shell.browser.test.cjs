'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the casino walls and carpet are colour: gold pilasters, dado, rails, mirrors and a lattice that settles far off',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('casino',{word:'CASINO',neon:CYAN,ret:[100,100,0],cell:[10,10]},[11,13,-Math.PI/2]);
   const bad=[],keep=room.props,hue=c=>c>>4;room.props=[];let g=0,n=0;
   for(const [x,y,ang,pt]of [[11,13,-1.57,.1],[2,8,0,.05],[5,9,-1.2,-.5],[20,2,2.4,.2]]){px=x;py=y;a=ang;pitch=pt;render(0);
    for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z]/.test(c))g++;}}
   room.props=keep;if(g/n>.002)bad.push(['glyph share',+(100*g/n).toFixed(2)]);
   // the wall's parts: pilaster gold, dado, rails, mirror
   const wall=(u,z)=>{BG[0]=0;casinoWall(0,u,.005,z,2,0,5,10);return hue(BG[0]);};
   if(wall(1.25,2)!==YEL)bad.push('pilaster');if(wall(.5,.5)!==BRICK)bad.push('dado');if(wall(.5,.95)!==YEL)bad.push('rail');if(wall(.5,2)!==GRAY)bad.push('mirror');
   // the carpet: gold lattice and diamonds up close, plain red far off
   const carpet=fp=>{const s=new Set();for(let wx=3;wx<6;wx+=.031)for(let wy=3;wy<5;wy+=.047){casinoFloor(0,1,wx,wy,fp);s.add(hue(BG[0]));}return [...s].sort().join();};
   if(carpet(.01)!==[RED,YEL].sort().join())bad.push(['near carpet',carpet(.01)]);if(carpet(.3)!==String(RED))bad.push(['far carpet',carpet(.3)]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
