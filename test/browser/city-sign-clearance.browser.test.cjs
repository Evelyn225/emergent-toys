'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=13;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('signs clear of what would cut them: the gas price board under the canopy, the store lettering inside its fascia, an apartment number only on its entrance canopy up close',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const out={};
  // the price board sits wholly under the canopy's underside, so from the forecourt nothing slices it
  const signs=solids.filter(o=>o.kind==='gassign'),canopies=solids.filter(o=>o.kind==='gascanopy');
  out.board=signs.length>0&&signs.every(s=>s.z1<=Math.min(...canopies.map(c=>c.z0)));
  // the store's lettering: a spy on wallText while looking at the front from the forecourt
  const st=GAS_STATIONS[0],wt=wallText,seen=[];wallText=(i,u,uStep,z,d,text,u0,zc,cw,band,...rest)=>{if(text==='FOOD MART')seen.push(zc+band/2);return wt(i,u,uStep,z,d,text,u0,zc,cw,band,...rest);};
  try{px=st.x0+1.5;py=st.y0+1.5;a=Math.PI/2;pitch=.02;render(0);}finally{wallText=wt;}
  out.martTop=seen.length?Math.max(...seen):null;out.coping=GAS.h-.025;
  // an apartment's number: on the canopy's board, and not also painted on the wall behind it (where the canopy chopped it up)
  const canopies2=ARCH_DETAILS.filter(o=>o.kind==='entrance-canopy'&&o.number);let wall=0,checked=0;
  for(const o of canopies2.slice(0,25)){px=o.x+o.nx*.7;py=o.y+o.ny*.7;a=Math.atan2(-o.ny,-o.nx);pitch=.15;const word=o.number;wallText=(i,u,uStep,z,d,text,...rest)=>{if(text===word)wall++;return wt(i,u,uStep,z,d,text,...rest);};try{render(0);}finally{wallText=wt;}checked++;}
  out.wall=wall;out.checked=checked;return out;});
 assert.ok(r.board,'the price board is under the canopy');
 assert.ok(r.martTop!==null&&r.martTop<=r.coping+1e-9,'FOOD MART stays inside its fascia '+JSON.stringify(r));
 assert.ok(r.checked>=10&&r.wall===0,'the number is not also painted on the wall behind the canopy '+JSON.stringify(r));
}));
