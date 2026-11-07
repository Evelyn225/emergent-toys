'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('police, fire and hospital fronts put their entrance at the real door, draw it from the street, and mark the kept-clear bay on the pavement',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const out={};for(const kind of ['police','fire','amb']){const b=SERVICES.find(s=>s.kind===kind);civicIndex();
  const sh=SHOP[idx(Math.floor(b.door[0]-.01),b.frontY)],fy=b.frontY;px=b.door[0];py=fy-1.2;a=Math.PI/2;pitch=-.05;
  // sample the front face directly: at the door against a stretch of wall well along
  const at=(du,z)=>{CH[0]=' ';BG[0]=0;const hit=civicFront(0,0,.001,z,.5,1,Math.floor(b.door[0]+du),fy,b.door[0]+du,sh,10,10);return hit?BG[0]:null;};
  const door=kind==='fire'?at(.5,.08):at(.1,.08),wall=kind==='fire'?at(1.7,.08):at(1.6,.08),side=civicFront(0,0,.001,.08,.5,0,Math.floor(b.door[0]),fy,b.door[0]+.1,sh,10,10);
  // and through the renderer: what civicFront paints from the street
  let painted=0;const orig=civicFront;civicFront=(...q)=>{const h=orig(...q);if(h)painted++;return h;};try{render(0);}finally{civicFront=orig;}
  const bay=kind==='fire'?civicApron(b.door[0]-.94,fy-.15,10,.5):civicApron(b.x-.33,fy-.15,10,.5),street=civicApron(b.door[0],fy-.6,10,.5);
  out[kind]={door,wall,differs:door!==null&&wall!==null&&door!==wall,side:side===true,painted,bay:!!bay,street};}return out;});
 for(const [kind,q] of Object.entries(r)){assert.ok(q.differs,kind+' entrance not distinct: '+JSON.stringify(q));assert.ok(q.painted>300,kind+' front barely drawn: '+q.painted);assert.ok(q.bay&&q.street===null,kind+' pavement bay: '+JSON.stringify(q));}
}));
