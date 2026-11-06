'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
for(const id of ['iron','harbor'])test(`${id} city bridge has no second flat road beneath either ramp or span, and retains its approach junction`,async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(id=>{
   tod=14;env(0);render(0);const b=ROAD_BRIDGES.find(b=>b.id===id),old=roadSurface;let roads=0,sea=0,land=0;const bad=[];
   roadSurface=(...q)=>{roads++;return old(...q);};
   function sample(x,y){const row=Math.floor(hor)+10,d=eye*projY/(row-hor+.5);px=x-d;py=y;floorBaseCell(0,row,0,1,0);}
   try{
    for(let y=b.y0+.25;y<b.y1;y+=.5)for(const offset of [-.9,-.25,0,.25,.9]){const x=b.x+offset;sample(x,y);if(seaAt(x,y)){sea++;if(FL[0]!==3)bad.push(['not water',x,y]);}else land++;if(roadGroundHeight(x,y)<roadBridgeHeight(b,y)-1e-8)bad.push('lost deck height');}
    const underRoads=roads;sample(b.x,b.y0-1);return{bad,underRoads,sea,land,junction:roads>underRoads};
   }finally{roadSurface=old;}
  },id);
  assert.deepEqual(r.bad,[]);assert.equal(r.underRoads,0,'no sea-level road or old bridge paint: '+JSON.stringify(r));assert.ok(r.sea>0&&r.land>0&&r.junction,JSON.stringify(r));assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
