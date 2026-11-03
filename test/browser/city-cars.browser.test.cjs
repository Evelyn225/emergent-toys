'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('cars, taxis, police, ambulances and fire engines are colour: round wheels, lamps that light, glass with the sky in it',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],base=cars[0];
   // a vehicle drawn on its own, 0.5 out in front and turned so a side and its front or back show
   const draw=(m,turn)=>{render(0);for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}
    const hx=Math.cos(a+turn),hy=Math.sin(a+turn);drawVehicle(m,Math.cos(a)*.5,Math.sin(a)*.5,hx,hy);
    let cells=0,chars=0;const bases=new Map();for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){cells++;if(CH[i]!==' ')chars++;bases.set(BG[i]>>4,(bases.get(BG[i]>>4)||0)+1);}
    return {cells,chars,bases};};
   px=base.x;py=base.y;a=0;pitch=-.1;
   const kinds=[{kind:'car',body:RED},{kind:'taxi',body:YEL},{kind:'police',body:BLUE,patrol:1},{kind:'amb',body:WHITE,ev:1},{kind:'fire',body:RED,ev:1},{kind:'car',body:GREEN,dmg:80},{kind:'car',body:BLUE,wrecked:true}];
   for(const td of [14,22]){tod=td;env(0);
    for(const k of kinds)for(const turn of [1.2,-1.9]){const m={...base,...k,id:7,v:0,owned:false,x:px+.5,y:py};const d=draw(m,turn);
     if(d.cells<200)bad.push([k.kind,td,turn,'barely drawn',d.cells]);
     if(d.chars)bad.push([k.kind,k.dmg?'damaged':k.wrecked?'wrecked':'',td,turn,'characters',d.chars]);
     if(!k.wrecked&&!d.bases.has(BLACK))bad.push([k.kind,td,turn,'no tyre']);}}
   // from behind (heading away), stopped: the tail lights glow red; at night, from in front, the headlamps are white at full
   tod=14;env(0);let d=draw({...base,kind:'car',body:GREEN,id:7,v:0},-.5);if(!d.bases.has(RED))bad.push(['no tail lights']);
   tod=22;env(0);d=draw({...base,kind:'car',body:GREEN,id:7,v:0},Math.PI-.5);let full=0;for(let i=0;i<cols*rows;i++)if(BG[i]===C(WHITE,15))full++;if(!full)bad.push(['headlamps not lit at night']);
   // the glass: lighter toward its top (the sky), in more than one tone
   tod=14;env(0);d=draw({...base,kind:'car',body:RED,id:7,v:0},1.4);const glass=new Set();for(let i=0;i<cols*rows;i++)if((BG[i]>>4)===CYAN)glass.add(BG[i]&15);if(glass.size<2)bad.push(['flat glass',glass.size]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
