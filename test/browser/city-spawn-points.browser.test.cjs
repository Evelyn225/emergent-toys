'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
const page=path.resolve(__dirname,'../../ascii-city.html');
async function fresh(query){const p=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;try{localStorage.clear();}catch(e){}});await p.goto(pathToFileURL(page).href+query);return await p.evaluate(errors=>({x:px,y:py,a,clear:free(px,py)&&!map[idx(Math.floor(px),Math.floor(py))],blocked:citySaveBlocked,message:typeof msg==='string'?msg:'',errors}),errors);}finally{await p.close();}}
test('a new game starts at one of several places picked at random, on clear ground, without blocking saves; tests keep the old start unless they ask',async()=>{
 const spots=new Set();for(let k=0;k<8;k++){const r=await fresh('?spawn=random');assert.deepEqual(r.errors,[]);assert.ok(r.clear&&!r.blocked,JSON.stringify(r));spots.add(Math.round(r.x)+','+Math.round(r.y));}
 assert.ok(spots.size>=3,'only '+spots.size+' different starts in 8 new games: '+[...spots]);
 const plain=await fresh(''),again=await fresh('');assert.ok(plain.x===again.x&&plain.y===again.y&&!plain.blocked,'under automation the default start stays put');
 const marina=await fresh('?spawn=marina'),pier=await fresh('?spawn=pier');assert.ok(marina.clear&&pier.clear&&Math.hypot(marina.x-pier.x,marina.y-pier.y)>5,'named starts land where asked');
});
