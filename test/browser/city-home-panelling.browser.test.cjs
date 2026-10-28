'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);enterRoom('bellehome',{ret:[100,100,0]},ROOM_DEFS.bellehome.entry);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('Belle panels have real closed recesses, inward cavity normals, fixed phase and fitted sill/rail/base junctions',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],model=room.props.find(p=>p.homePanelling),rail=room.props.find(p=>p.homeChairRail);if(!model||!rail)return{checked:0,bad:['missing fitted panelling/rail']};
  const draw=drawBox,capture=(o,x=0,y=0)=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box:{...box},ref:box,shade,ray});try{o.draw(x,y);}finally{drawBox=draw;}return a;};
  const A=capture(model),B=capture(model),M=capture(model,.2,.3);capture(model);const parts=model.homePanelling.parts,all=[...A,...capture(rail)];let checked=0,recesses=0;
  for(let k=0;k<A.length;k++){
   const q=A[k],b=q.box,c=b.c,s=b.s,[nx,ny]=parts[k].normal;
   if(q.ref!==B[k].ref||q.ref!==M[k].ref||q.shade!==B[k].shade||b.phase!==M[k].box.phase||Math.abs(M[k].box.x-b.x-.2)>1e-8)bad.push('bounds/phase/material rebuilt or camera-relative');
   if(Math.abs(b.phase-b.x*c-b.y*s)>1e-8||b.z0!==model.homePanelling.bottom||b.z1!==model.homePanelling.top)bad.push('wrong native phase or unsupported field');
   const ray=(u,z,du=0,dv=-1,dz=0)=>{const t=.2,front=b.hw,ox=b.x+c*(u-du*t)-s*(front-dv*t),oy=b.y+s*(u-du*t)+c*(front-dv*t);return q.ray(ox,oy,z-dz*t,c*du-s*dv,s*du+c*dv,dz,b);};
   const z=(b.z0+b.z1)/2;
   for(const u of [-b.hl+.045,b.hl-.045])if(b.hl>.1&&Math.abs(ray(u,z)-.2)>1e-8)bad.push('open corner/end stile');
   for(let u=-b.hl+.02;u<b.hl-.01;u+=.07)for(const h of [b.z0+.01,z,b.z1-.01]){checked++;const t=ray(u,h);if(t<.2-1e-8||t>.22+1e-8||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-8)bad.push('hole or invalid panel normal');}
   for(let tile=Math.floor((b.phase-b.hl)/.8);tile<=Math.ceil((b.phase+b.hl)/.8);tile++){
    const u=tile*.8+.4-b.phase,hi=Math.min(b.hl-.09,(tile+1)*.8-b.phase-.035);if(u<=-b.hl+.12||u>=b.hl-.12||u>=hi-.02)continue;
    const t=ray(u,z);if(Math.abs(t-.22)>1e-8||!HIT.panelBack||Math.hypot(HIT.nx-nx,HIT.ny-ny,HIT.nz)>1e-8)bad.push('painted/flat recess or wrong backing normal');
    q.shade(0,t,8);const back=BG[0];ray(-b.hl+.045,z);q.shade(0,.2,8);if(BG[0]===back)bad.push('near frame/field not resolved');
    ray(u,z);q.shade(0,50,8);const far=BG[0];ray(-b.hl+.045,z);q.shade(0,50,8);if(BG[0]!==far)bad.push('unresolved frames flicker at distance');
    const tSide=ray(hi-.005,z,1,-.2,0);if(Math.abs(tSide-.205)>1e-8||Math.hypot(HIT.nx+c,HIT.ny+s,HIT.nz)>1e-8)bad.push('missing side return');
    const tTop=ray(u,b.z1-.04,0,-.2,1);if(Math.abs(tTop-.205)>1e-8||Math.abs(HIT.nz+1)>1e-8)bad.push('missing upper return');recesses++;break;
   }
   for(const[oz,rz,want]of [[b.z0-.2,1,b.z0],[b.z1+.2,-1,b.z1]])if(q.ray(b.x,b.y,oz,0,0,rz,b)<0||Math.abs(HIT.w-want)>1e-8)bad.push('unclosed cap');
  }
  if(recesses<5)bad.push('too few real recessed fields');
  const fixed=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box:{...box},shade,ray});try{o.draw(o.x,o.y,o);}finally{drawBox=draw;}return a;},fixtures=room.props.filter(p=>p!==model&&p!==rail&&typeof p.draw==='function'&&!p.fig).flatMap(fixed);
  for(const q of all)for(const f of fixtures){const a=q.box,b=f.box;if(a.z0<b.z1-1e-6&&a.z1>b.z0+1e-6&&furnishingOverlap(a,b,1e-6))bad.push('panel/rail intersects drawn fixture or window casing');}
  const lip=rail.homeChairRail.parts.find(p=>p.normal[1]===-1&&p.box.z1===.915),color=(face,t)=>{HIT.face=face;HIT.w=lip.box.z1;lip.shade(0,t,12);return BG[0];},medium=Math.sqrt(Math.abs(eye-lip.box.z1)*2*lip.box.hw*projY/1.1);
  if(color(5,.2)===color(3,.2)||color(5,medium)!==color(3,medium)||color(5,20)!==color(3,20))bad.push('chair rail exposed ledge does not resolve nearby/filter at distance');
  const base=room.props.find(p=>p.homeSkirting).homeSkirting.profile.at(-1)[1];if(model.homePanelling.bottom!==base||rail.homeChairRail.profile[0][0]!==model.homePanelling.top)bad.push('gap at base or rail');
  const sill=Math.min(...room.props.filter(p=>p.windowCasing).flatMap(fixed).map(p=>p.box.z0));if(Math.abs(model.homePanelling.top-sill)>1e-8)bad.push('field does not meet sill underside');
  homeWall(0,3,0,.9,1,0,0,8);if(CH[0]!==' ')bad.push('painted chair rail remains');homeWall(0,.38,0,.4,1,0,0,8);if(CH[0]!==' ')bad.push('painted vertical strokes remain');
  for(const kind of ['home','loft','islandhome']){enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);if(room.props.some(p=>p.homePanelling||p.homeChairRail))bad.push('other home family altered');}
  return{bad,checked};});assert.ok(r.checked>100);assert.deepEqual(r.bad,[]);
}));

test('Belle native views render recessed fields and real furniture refresh/door routes retain the fitted wall models',()=>fixture(async p=>{
 await p.evaluate(()=>{mode='walk';room=null;money=500000;const q=buyProperty('home_belle',...citySourcePoint(41,73));if(!q[0])throw Error(q[1]);const h=owned.homes.at(-1),f=homeFurnishings(h);f.parts.push({id:'f_lamp',key:f.next++,x:3,y:24,a:0,on:true});enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[100,100,0]},ROOM_DEFS.bellehome.entry);window.panels=room.props.filter(p=>p.homePanelling||p.homeChairRail);px=2.1;py=room.H-1.85;const x=1.04,y=room.H-1.04;a=Math.atan2(y-py,x-px);pitch=0;render(0);pitch=(.5-eye)/Math.hypot(x-px,y-py)*projY/rows;render(0);});
 const pixels=await p.evaluate(()=>{const old=[BG.slice(),CH.slice(),COL.slice()],changes=[];for(const model of window.panels){const draw=model.draw;model.draw=()=>{};let changed=0;try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i])changed++;}finally{model.draw=draw;}changes.push({body:!!model.homePanelling,changed});}return{clear:free(px,py),changes};});assert.ok(pixels.clear&&pixels.changes.every(p=>p.changed>(p.body?100:20)),JSON.stringify(pixels));
 await p.keyboard.press('f');await p.locator('[data-pack="1"]').click();await p.keyboard.press('e');assert.equal(await p.evaluate(()=>{refreshWorkshopRoom();return window.panels.every(q=>room.props.filter(p=>p===q).length===1)&&homeFurnishings(homeRecord()).parts.length===0;}),true);
 assert.equal(await p.evaluate(()=>{for(const c of room.def.homePassages){px=(c.start+c.end)/2;py=c.cross-.7;for(let i=0;i<24;i++)move(0,.1);if(Math.abs(py-c.cross-1.7)>1e-8)return false;for(let i=0;i<24;i++)move(0,-.1);}return true;}),true);
}));
