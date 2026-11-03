'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the airport is colour: runway markings, taxiways, apron, helipads, grass, the tower, terminal and hangars, and the aircraft',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   // the ground, sampled across the whole airport near and far, by day and after dark: colour, the lights glowing cells
   for(const td of [14,22]){tod=td;env(0);let n=0,ch=0;
    for(let X=AIRPORT.x0;X<AIRPORT.x1;X+=.37)for(let Y=AIRPORT.y0;Y<AIRPORT.y1;Y+=.29)for(const d of [.5,8]){CH[0]=' ';const s=airportFloor(0,0,0,worldCoord(X),worldCoord(Y),8,d);n++;if(CH[0]!==' ')ch++;if(s&&(!Array.isArray(s)||s.length!==2))bad.push(['not a surface',s]);}
    if(ch||n<2000)bad.push([td,'characters on the airport ground',ch,n]);}
   // the views: the runway, the apron, the tower, the stands (aircraft parked there): almost no characters (lettering aside)
   tod=14;env(0);let n=0,g=0;
   for(const [x,y,ang,pt] of [[RUNWAY.x0+3,RUNWAY.y-2,0,.02],[(APRON.x0+APRON.x1)/2,APRON.y0+.5,Math.PI/2,.1],[TOWER.x-3,TOWER.y-2,.6,.3],[(APRON.x0+APRON.x1)/2-3,APRON.y1-.5,0,.1]]){
    px=worldCoord(x);py=worldCoord(y);a=ang;pitch=pt;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9]/.test(CH[i]))g++;}}
   if(g/n>.008)bad.push(['airport views glyph share',+(100*g/n).toFixed(2)]); // (main had 24%)
   // every aircraft drawn on its own, where it is, from 3 units off: no characters on it
   let ac=0,an=0;for(const c of aircraft.slice(0,6)){px=c.x-3;py=c.y;a=0;pitch=.1;render(0);for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}
    const T_=PLANE_TYPES[c.type];if(!T_)continue;const [vx,vy]=R(c.x,c.y);(T_.heli?drawHeliCraft:drawPlaneCraft)(c,T_,vx,vy);for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){an++;if(CH[i]!==' '&&!/[A-Z0-9]/.test(CH[i]))ac++;}}
   if(ac)bad.push(['characters on the aircraft',ac,an]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
