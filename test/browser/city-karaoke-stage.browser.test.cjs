'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('karaoke',{word:'KARAOKE',ret:[100,100,0]},[6.5,7.4,-Math.PI/2]);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const shapesOf=o=>{const draw=drawBox,out=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};

test('the stage is built in pieces that meet without sharing a face; the singer stands on its deck, the wedge on its front',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{
  const shapesOf=${shapesOf};
  const stage=room.props.find(o=>o.karaokeStage),s=stage.karaokeStage,parts=shapesOf(stage).map(o=>o.box),bad=[];
  const span=b=>[b.x-b.hl,b.x+b.hl,b.y-b.hw,b.y+b.hw,b.z0,b.z1];
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
   const A=span(parts[i]),B=span(parts[j]),o=[0,2,4].map(k=>Math.min(A[k+1],B[k+1])-Math.max(A[k],B[k]));
   if(o.every(v=>v>1e-9))bad.push(['overlap',i,j]);
  }
  // together they fill the footprint up to the deck, with the deck on top everywhere
  for(let x=s.x-s.hl+.01;x<s.x+s.hl;x+=.13)for(let y=s.y-s.hw+.003;y<s.y+s.hw;y+=.011){
   const top=Math.max(...parts.filter(b=>Math.abs(x-b.x)<b.hl&&Math.abs(y-b.y)<b.hw).map(b=>b.z1));if(Math.abs(top-s.top)>1e-9)bad.push(['top',x,y,top]);
  }
  const singer=room.props.find(o=>o.fig&&o.pose==='sing'),wedge=room.props.find(o=>o.karaokeMonitor),w=wedge.karaokeMonitor;
  if(Math.abs(singer.z-s.top)>1e-9)bad.push(['singer',singer.z]);
  if(Math.abs(w.z-s.top)>1e-9||Math.abs(wedge.x-s.x)+w.hl>s.hl||wedge.y+w.hw>s.y+s.hw||wedge.y-w.hw<singer.y+.15)bad.push('wedge');
  const old=[stage.box.x,stage.box.y,stage.box.hl,stage.box.hw,stage.box.z1];
  return{bad:bad.slice(0,6),old,painted:room.props.some(o=>o.shade&&o.box&&o.box.hl===2)};
 })()`);
 assert.deepEqual(r.bad,[]);assert.deepEqual(r.old,[6,2.3,2,.6,.3]);assert.equal(r.painted,false);
}));

test('speakers stand on the floor beside the stage; the screen hangs on the back wall, every lyric line fitting inside its picture',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{
  const shapesOf=${shapesOf};
  const bad=[],stage=room.props.find(o=>o.karaokeStage).box,speakers=room.props.filter(o=>o.karaokeSpeaker);
  for(const o of speakers){
   if(o.box.z0!==0)bad.push('floating');
   if(Math.abs(o.x-stage.x)<stage.hl+o.box.hl+.05)bad.push(['on the stage',o.x]);
   const parts=shapesOf(o);for(const q of parts)if(q.box.z0< -1e-9)bad.push('below the floor');
   for(const q of parts){const b=q.box,ex=b.hl*Math.abs(b.c??1)+b.hw*Math.abs(b.s??0),ey=b.hl*Math.abs(b.s??0)+b.hw*Math.abs(b.c??1); // every part, its hardware too, inside the cabinet's box
    if(Math.abs(b.x-o.box.x)+ex>o.box.hl+1e-9||Math.abs(b.y-o.box.y)+ey>o.box.hw+1e-9||b.z1>o.box.z1+1e-9)bad.push(['speaker part outside its box',+(b.x-o.box.x).toFixed(3),+(b.y-o.box.y).toFixed(3),+b.z1.toFixed(3)]);}
  }
  const scr=room.props.find(o=>o.karaokeScreen),S=scr.karaokeScreen,parts=shapesOf(scr);
  const back=Math.min(...parts.map(q=>q.box.y-q.box.hw));
  if(Math.abs(back-S.wallY)>1e-9||roomAt(S.x,S.wallY-.05)!=='#')bad.push(['off the wall',back]);
  if(S.bottom<stage.z1+1)bad.push('too low over the stage');
  const inner=2*(S.half-.04);
  for(const line of LYRICS)if(karaokeLetter(line)*line.length>inner-.1+1e-9)bad.push(['overflows',line]);
  for(const t of [-12.5,-.1,0,7])if(!LYRICS.includes(karaokeLyric(t).line))bad.push(['no lyric line at',t]); // (the music's clock can start before zero)
  // the wall painter no longer draws the screen
  const painted=(()=>{const i=0;karaokeWall(i,6,.01,1.9,3,6,0,8);return CH[i]!==' '&&CH[i]!=='*';})();
  return{bad,speakers:speakers.length,painted};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.speakers,2);assert.equal(r.painted,false);
}));

test('the sung part of the line lights magenta on the screen as the song goes on, and the room stays walkable to its seats',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const S=room.props.find(o=>o.karaokeScreen).karaokeScreen;
  // Read only the real picture plane, so ceiling/sign colours cannot satisfy
  // a missing lyric colour. Sample the start, middle and completed line.
  const def=room.def;room.def={...def,ceil:'strip'};px=S.x;py=4.2;a=-Math.PI/2;pitch=.12;const out=[],samples=[],cameraFree=free(px,py),depth=py-(S.y+S.depth/2+.001);
  for(const t of [10,12.5,13.9]){T=t;render(0);const colours=new Set();let letters=0;for(let i=0;i<CH.length;i++)if(Math.abs(ZB[i]-depth)<.0001&&CH[i]&&CH[i]!==' '&&(COL[i]===C(MAG,15)||COL[i]===C(WHITE,15))){letters++;colours.add(COL[i]===C(MAG,15)?'sung':'unsung');}samples.push(letters);out.push([...colours].sort());}
  room.def=def;let seats=true;for(const q of room.props.filter(o=>o.seat))seats&&=[[0,.6],[0,-.6],[.6,0],[-.6,0]].some(([dx,dy])=>free(q.x+dx,q.y+dy));
  return{out,seats,samples,cameraFree};
 });
 assert.deepEqual(r.out[0],['unsung']);assert.deepEqual(r.out[1],['sung','unsung']);assert.deepEqual(r.out[2],['sung']);assert.ok(r.samples.every(n=>n>=4),JSON.stringify(r));assert.ok(r.cameraFree);assert.ok(r.seats);
}));

test('karaoke fixtures contain their rendered hardware, cache fixed profiles and show valid lyrics before time zero',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const errors=[],save=drawBox;projX=10000;
  const parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=save;}return a;};
  for(const o of room.props.filter(o=>o.karaokeSpeaker||o.karaokeScreen)){
   const b=o.box;for(const q of parts(o)){const a=q.box;
    if(a.x-a.hl<b.x-b.hl-1e-7||a.x+a.hl>b.x+b.hl+1e-7||a.y-a.hw<b.y-b.hw-1e-7||a.y+a.hw>b.y+b.hw+1e-7||a.z0<b.z0-1e-7||a.z1>b.z1+1e-7)errors.push(['hardware outside bounds',o.karaokeSpeaker?'speaker':'screen']);
   }
  }
  const panel=kitchenPanelProfile;let builds=0;kitchenPanelProfile=(...args)=>{builds++;return panel(...args);};
  try{for(const o of room.props.filter(o=>o.karaokeSpeaker||o.karaokeScreen)){parts(o);parts(o);}}finally{kitchenPanelProfile=panel;}
  if(builds)errors.push(['static profiles rebuilt while drawing',builds]);
  for(const t of [-20.01,-5,-.016,0,4.9,5]){try{const q=karaokeLyric(t);if(typeof q.line!=='string'||!q.line.length||!Number.isFinite(q.sung))errors.push(['invalid lyric',t]);}catch{errors.push(['lyric threw',t]);}}
  return errors.slice(0,20);
 });assert.deepEqual(bad,[]);
}));
