'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;body.z=body.vz=body.crouch=0;money=500;enterRoom('station',{st:0,word:stations[0].name,t0:0,ret:[px,py,a]},[23,ST_TRACK-1,Math.PI/2]);room.t0=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('subway doors remain fitted while moving and slide into pockets through opening and closing',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof drawSubwayTrainCar!=='function')return {bad:['no fitted train doors']};
  const bad=[],states=[],capture=phase=>{T=phase;const parts=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});drawSubwayTrainCar(0,0,0,{t0:0});}finally{drawBox=old;}return parts;};
  for(const phase of [0,5.9,6,6.1,6.425,6.85,12,17.15,17.575,17.9,18,23.9]){
   const parts=capture(phase),panels=parts.filter(p=>p.box.subwayRole==='door-panel'),jambs=parts.filter(p=>p.box.subwayRole==='door-jamb');
   if(panels.length!==12||jambs.length!==12)bad.push(['doors spawned/despawned',phase,panels.length,jambs.length]);
   for(const panel of panels){const b=panel.box,glass=parts.find(p=>p.box.subwayRole==='door-glass'&&p.box.subwayDoor===b.subwayDoor&&p.box.subwaySide===b.subwaySide&&p.box.subwayLeaf===b.subwayLeaf)?.box;
    if(!glass||glass.x!==b.x||glass.y!==b.y||glass.hw>=b.hw||glass.z0<=b.z0||glass.z1>=b.z1)bad.push('glazing not fitted inside leaf');
    if(b.subwaySide===1&&Math.abs(b.x-b.subwayDoor-b.subwayLeaf*SUBWAY_CAR.leafHalf)>1e-8)bad.push('non-platform doors opened');
    if(Math.abs(b.y)+b.hw>=SUBWAY_CAR.hw)bad.push('panels pasted outside body');
   }
   const right=panels.find(p=>p.box.subwayDoor===0&&p.box.subwaySide===-1&&p.box.subwayLeaf===1).box;
   states.push({phase,x:right.x,amount:trainDoorAmount({t0:0}),count:parts.length});
  }
  if(!states.every(q=>q.count===states[0].count))bad.push('changing component count');
  if(!(states[3].x>states[2].x&&states[3].x<states[4].x&&states[4].x<states[5].x))bad.push('no continuous opening');
  if(!(states[7].x>states[8].x&&states[8].x>states[9].x&&states[9].x>states[10].x))bad.push('no continuous closing');
  if(states[0].x!==states[10].x||states[1].amount!==0||states[10].amount!==0)bad.push('doors not shut in motion');
  // Exercise the actual station renderer, rather than only the model builder.
  for(const phase of [4,12,19]){T=phase;let leaves=0,bodies=0;const old=drawBox;try{drawBox=(box,...args)=>{if(box.subwayRole==='door-panel')leaves++;if(box.subwayRole==='body')bodies++;};roomSprites();}finally{drawBox=old;}if(leaves!==36||bodies!==3)bad.push(['station integration',phase,leaves,bodies]);}
  return {bad,states};
 });assert.deepEqual(r.bad,[],JSON.stringify(r));
}));
test('open train doorways have real depth, recessed glass, colour surfaces and boarding tied to the opening',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof drawSubwayTrainCar!=='function')return {bad:['no fitted train doors']};
  const bad=[],capture=phase=>{T=phase;const parts=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});drawSubwayTrainCar(0,0,0,{t0:0});}finally{drawBox=old;}return parts;};
  const hit=(parts,x,z)=>{let depth=Infinity,role=null;for(const q of parts){const t=q.ray(x,-3,z,0,1,0,q.box);if(t<.01||t>=depth)continue;CH[0]='?';if(q.shade(0,t,10)){if(CH[0]!==' ')bad.push('character on train surface');depth=t;role=q.box.subwayRole;}}return {depth,role};};
  const closed=capture(5),mid=capture(6.425),open=capture(12),closing=capture(17.575);
  const metal=hit(closed,.1,.7),glass=hit(closed,.25,1.6),gap=hit(open,.1,.7);
  if(metal.role!=='door-panel'||glass.role!=='door-glass'||glass.depth-metal.depth<.01)bad.push(['flush sticker instead of inset door',metal,glass]);
  if(!(gap.depth>metal.depth+1.5&&gap.role.startsWith('interior-')))bad.push(['door opening is a decal',metal,gap]);
  if(!(hit(mid,.1,.7).depth>3&&hit(mid,.4,.7).role==='door-panel'))bad.push('half-open leaves do not frame the gap');
  if(Math.abs(hit(closing,.1,.7).depth-hit(mid,.1,.7).depth)>1e-7)bad.push('opening and closing disagree');
  const board=[];for(const phase of [5.9,6,6.85,12,17.9,18]){T=phase;board.push(canBoard());}
  return {bad,board};
 });assert.deepEqual(r.bad,[]);assert.deepEqual(r.board,[false,false,true,true,false,false]);
 await p.evaluate(()=>{T=12;});await p.keyboard.press('e');assert.equal(await p.evaluate(()=>room.kind),'train');
}));
