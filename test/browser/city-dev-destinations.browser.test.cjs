'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('dev teleports on foot land looking at the place from a step back, on clear ground, and every district has a spot of its own',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const close=[],blocked=[],spots=new Map(),dup=[];let walked=0;
  for(const [group,label,go] of devPlaces()){if(group==='Shops (nearest)'&&walked>60&&!/^(BANK|CASINO|IDEA|PAWN) /.test(label))continue;devFree();go();if(mode!=='walk'||room)continue;walked++;
   const c=Math.cos(a),s=Math.sin(a);let d=0;for(;d<.5;d+=.02)if(map[idx(Math.floor(px+c*d),Math.floor(py+s*d))]>0)break;
   if(d<.5)close.push(label+' '+d.toFixed(2));if(!free(px,py))blocked.push(label);
   if(group==='Districts'){const k=Math.round(px)+','+Math.round(py);if(spots.has(k))dup.push(label+' = '+spots.get(k));spots.set(k,label);}}
  const districts=Object.keys(DISTRICT_TITLE).filter(d=>d!=='sea'),missing=districts.filter(d=>!districtSpot(d)),wrong=districts.filter(d=>{const sp=districtSpot(d);return sp&&districtName(Math.floor(sp[0]/8),Math.floor(sp[1]/8))!==d;});
  return {walked,close,blocked,dup,missing,wrong};});
 assert.ok(r.walked>=60,JSON.stringify(r));assert.deepEqual(r.close,[]);assert.deepEqual(r.blocked,[]);assert.deepEqual(r.dup,[]);assert.deepEqual(r.missing,[]);assert.deepEqual(r.wrong,[]);
}));
