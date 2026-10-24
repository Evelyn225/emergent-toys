'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the stereo console, sleeves, platter and vinyl have real supports and stay inside their rotated placement bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const on of [false,true]){
   const part={id:'f_recordplayer',key:1,x:0,y:0,a,on,track:0},model=HOME_RECORD_PLAYER(part),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const role=n=>shapes.filter(q=>q.box.recordRole===n),c=Math.cos(a),s=Math.sin(a),at=(u,v)=>[c*u-s*v,s*u+c*v],bad=[];
   const surface=(q,x,y,down)=>{const t=q.ray(x,y,down?2:0,0,0,down?-1:1,q.box);return t>0?(down?2-t:t):NaN;};
   const floor=role('floor')[0],top=role('top')[0],plinth=role('turntable-plinth')[0],platter=role('platter')[0],vinyl=role('vinyl')[0];
   const contact=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7;
   for(const foot of role('foot'))if(!contact(surface(foot,foot.box.x,foot.box.y,true),surface(floor,foot.box.x,foot.box.y,false)))bad.push('foot');
   for(const sleeve of role('sleeve'))if(!contact(surface(floor,sleeve.box.x,sleeve.box.y,true),surface(sleeve,sleeve.box.x,sleeve.box.y,false)))bad.push('sleeve');
   for(const [upper,lower,u,v]of [[plinth,top,-.12,0],[platter,plinth,-.2,0],[vinyl,platter,-.1,0]]){const[x,y]=at(u,v);if(!contact(surface(upper,x,y,false),surface(lower,x,y,true)))bad.push('deck');}
   const [hx,hy]=at(-.2,0),hole=vinyl.ray(hx,hy,2,0,0,-1,vinyl.box);
   if(hole!==-1)bad.push('filled spindle hole');
   const b=model.box;
   for(const {box:q}of shapes){const u=q.x*c+q.y*s,v=-q.x*s+q.y*c,cc=q.c*c+q.s*s,ss=-q.c*s+q.s*c;
    if(Math.abs(u)+Math.abs(cc)*q.hl+Math.abs(ss)*q.hw>b.hl+1e-7||Math.abs(v)+Math.abs(ss)*q.hl+Math.abs(cc)*q.hw>b.hw+1e-7||q.z0<b.z0-1e-7||q.z1>b.z1+1e-7)bad.push(['bounds',q.recordRole]);
   }
   out.push({a,on,bad,feet:role('foot').length,sleeves:role('sleeve').length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.feet,4);assert.equal(q.sleeves,9);}
}));

test('playing seats the actual needle on the vinyl; stopping lifts it clear and parks the arm on its rest',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const on of [true,false]){
   const part={id:'f_recordplayer',key:1,x:0,y:0,a:0,on,track:0},model=HOME_RECORD_PLAYER(part),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const role=n=>shapes.find(q=>q.box.recordRole===n),needle=role('needle'),vinyl=role('vinyl'),arm=role('tonearm'),rest=role('arm-rest'),b=needle.box;
   const t=needle.ray(b.bx,b.by,.9,0,0,1,b),bottom=.9+t;
   const v=vinyl.ray(b.bx,b.by,2,0,0,-1,vinyl.box),record=v>0?2-v:null;
   const support=arm.ray(rest.box.x,rest.box.y,.9,0,0,1,arm.box);
   out.push({on,bottom,record,rest:support>0?.9+support-rest.box.z1:null});
  }return out;
 });assert.ok(Math.abs(r[0].bottom-r[0].record)<1e-7,JSON.stringify(r));assert.equal(r[1].record,null);assert.ok(r[1].bottom>r[0].bottom+.04);assert.ok(Math.abs(r[1].rest)<.00005,JSON.stringify(r));
}));

test('the fitted record player responds to real E, track selection and saving without losing its model or audio state',()=>fixture(async p=>{
 await p.evaluate(()=>{money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();const h=homeRecord();h.furnishings={next:2,parts:[{id:'f_recordplayer',key:1,x:18,y:19,a:0,on:false,track:0}]};refreshFurnishedRoom();px=18;py=20.2;a=-Math.PI/2;pitch=-.45;fade=0;render(0);});
 assert.match(await p.evaluate(()=>promptText()),/play record/);await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].on&&homeRecordAudio()?.song==='bossa'&&room.props.some(q=>q.recordPlayer)));
 await p.keyboard.press('KeyF');await p.locator('[data-track="1"]').click();await p.keyboard.press('Escape');
 await p.evaluate(()=>{if(paused)closePause();saveGame();});
 assert.equal(await p.evaluate(()=>homeRecordAudio().song),'coffee');
 await p.reload();await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();px=18;py=20.2;a=-Math.PI/2;pitch=-.45;env(0);render(0);});
 assert.ok(await p.evaluate(()=>homeRecordAudio()?.song==='coffee'&&room.props.some(q=>q.recordPlayer)));await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>homeRecordAudio()),null);
}));
