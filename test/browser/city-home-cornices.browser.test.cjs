'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('home cornices meet ceilings and corners, bridge real infills, stay above glazing and reuse closed prepared pieces',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[];let checked=0;for(const kind of ['home','loft','bellehome']){
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);render(0);const model=room.props.find(p=>p.homeCornice);if(!model){bad.push(kind+' has no fitted cornice');continue;}
  const {parts,profile}=model.homeCornice,h=room.def.height,top=profile.at(-1);if(parts.length<12||Math.abs(top[1]-h)>1e-8)bad.push('cornice does not finish at ceiling');
  const contains=(x,y,z)=>parts.some(p=>z>p.box.z0&&z<p.box.z1&&inBox(p.box,x,y,0));
  for(const [z0,z1,d]of profile){const z=(z0+z1)/2;
   for(const [x,y]of [[3,room.H-1-.005],[1.005,room.H-1-.005],[room.def.wc.x0-1-.005,room.def.wc.y1+1+.005]])if(!contains(x,y,z))bad.push(kind+' open straight/corner joint');
   for(const cut of room.def.homePassages||[])for(const y of [cut.cross-.005,cut.cross+1.005])if(!contains((cut.start+cut.end)/2,y,z))bad.push('cornice stops above passage');
   for(const door of room.bathroomDoors||[]){const q=door.bathroomDoor;for(const edge of [q.cross-.005,q.cross+1.005]){const x=q.vertical?edge:(q.start+q.end)/2,y=q.vertical?(q.start+q.end)/2:edge;if(!inWc(x,y)&&!contains(x,y,z))bad.push('cornice stops above bathroom infill');}}
   const french=room.def.frenchDoor;if(french){const y=(french.start+french.end)/2;if(!contains(french.wall-.005,y,z)||contains(french.wall+french.thickness+.005,y,z))bad.push('French-door head not finished or cornice outside');}
   const point=room.H-1-d+.001;if(!contains(3,point,z))bad.push('projecting profile missing');
  }
  const draw=drawBox,capture=(x=0,y=0)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},ref:box,shade,ray});try{model.draw(x,y);}finally{drawBox=draw;}return out;},A=capture(),B=capture(),M=capture(.2,.3);capture();
  for(let i=0;i<parts.length;i++){
   const part=parts[i],b=part.box,q=A[i],[nx,ny]=part.normal;checked++;
   if(b.z0<h-.17||b.z1>h||b.hw*2>.08||Math.abs(b.x*nx+b.y*ny-b.hw-part.wall*(nx||ny)+.002)>1e-8)bad.push('unsupported or oversized cornice');
   if(q.ref!==B[i].ref||q.ref!==M[i].ref||q.shade!==B[i].shade||Math.abs(M[i].box.x-b.x-.2)>1e-8||Math.abs(M[i].box.y-b.y-.3)>1e-8)bad.push('bounds/material rebuilt or displaced');
   const t=q.ray(b.x+nx*(b.hw+.2),b.y+ny*(b.hw+.2),(b.z0+b.z1)/2,-nx,-ny,0,b);if(Math.abs(t-.2)>1e-8)bad.push('open front');q.shade(0,t,8);if(Math.hypot(HIT.nx-nx,HIT.ny-ny,HIT.nz)>1e-8)bad.push('wrong normal');
   const underside=q.ray(b.x,b.y,b.z0-.2,0,0,1,b);if(underside<0||Math.abs(HIT.w-b.z0)>1e-8)bad.push('missing underside');
   for(let j=i+1;j<parts.length;j++){const c=parts[j].box;if(b.z0<c.z1-1e-7&&b.z1>c.z0+1e-7&&furnishingOverlap(b,c,1e-7))bad.push('overlapping cornice faces');}
   if(room.def.windows.some(w=>b.z0<(w.top??(room.def.tier?2.95:2.5))))bad.push('cornice reaches window glazing');
  }
  const lip=parts.find(p=>p.normal[0]===0&&p.normal[1]===-1&&p.box.z1===h),color=(face,t)=>{HIT.face=face;HIT.u=HIT.v=0;HIT.w=lip.box.z0;lip.shade(0,t,12);return BG[0];};
  const medium=Math.sqrt(Math.abs(eye-lip.box.z0)*2*lip.box.hw*projY/.75);
  if(color(6,.2)===color(3,.2)||color(6,20)!==color(3,20)||color(6,medium)!==color(3,medium))bad.push('recess shadow fails to resolve nearby or filter at distance');
  homeWall(0,5,0,h-.01,1,0,0,8);if(CH[0]!==' ')bad.push('old painted ceiling band remains');
 }
 enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);if(room.props.some(p=>p.homeCornice))bad.push('Fern altered');return{bad,checked};});assert.ok(r.checked>40);assert.deepEqual(r.bad,[]);
}));

test('owned cornices retain identity after real lamp and furnishings controls and leave passage routes usable',()=>fixture(async p=>{
 for(const[id,kind]of [['home_studio','home'],['home_loft','loft'],['home_belle','bellehome']]){
  await p.evaluate(({id,kind})=>{mode='walk';room=null;money=500000;const q=buyProperty(id,...citySourcePoint(41,73));if(!q[0])throw Error(q[1]);const h=owned.homes.at(-1),f=homeFurnishings(h);f.parts.push({id:'f_lamp',key:f.next++,x:3,y:ROOM_DEFS[kind].grid.length-2,a:0,on:true});enterRoom(kind,{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[100,100,0]},ROOM_DEFS[kind].entry);window.cornice=room.props.find(p=>p.homeCornice);
   for(const cut of room.def.homePassages||[]){px=(cut.start+cut.end)/2;py=cut.cross-.7;for(let i=0;i<24;i++)move(0,.1);if(Math.abs(py-cut.cross-1.7)>1e-8)throw Error('blocked passage');for(let i=0;i<24;i++)move(0,-.1);}
   const[x,y]=room.def.lamps[0];px=x;py=y+1.5;a=-Math.PI/2;pitch=0;render(0);pitch=(room.def.height-.65-eye)/1.5*projY/rows;render(0);},{id,kind});
  assert.match(await p.evaluate(()=>promptText()),/lamp off/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeRecord().lights.fixed0),false);
  await p.keyboard.press('f');await p.locator('[data-pack="1"]').click();await p.keyboard.press('e');assert.equal(await p.evaluate(()=>{refreshWorkshopRoom();return room.props.filter(p=>p===window.cornice).length===1&&homeFurnishings(homeRecord()).parts.length===0&&inv.some(p=>p.id==='f_lamp');}),true);
 }
}));


test('native ceiling views actually render the fitted cornices in every home family',()=>fixture(async p=>{
 for(const kind of ['home','loft','bellehome']){const r=await p.evaluate(kind=>{enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);const model=room.props.find(p=>p.homeCornice);if(!model)return{clear:false,changed:0};px=2.1;py=room.H-1.85;const x=1.04,y=room.H-1.04;a=Math.atan2(y-py,x-px);pitch=0;render(0);pitch=(room.def.height-.04-eye)/Math.hypot(x-px,y-py)*projY/rows;render(0);const arrays=[BG.slice(),CH.slice(),COL.slice()],draw=model.draw;let changed=0;model.draw=()=>{};try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==arrays[0][i]||CH[i]!==arrays[1][i]||COL[i]!==arrays[2][i])changed++;}finally{model.draw=draw;}return{clear:free(px,py),changed};},kind);assert.ok(r.clear&&r.changed>20,kind+' '+JSON.stringify(r));}
}));
