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
  }
  const scr=room.props.find(o=>o.karaokeScreen),S=scr.karaokeScreen,parts=shapesOf(scr);
  const back=Math.min(...parts.map(q=>q.box.y-q.box.hw));
  if(Math.abs(back-S.wallY)>1e-9||roomAt(S.x,S.wallY-.05)!=='#')bad.push(['off the wall',back]);
  if(S.bottom<stage.z1+1)bad.push('too low over the stage');
  const inner=2*(S.half-.04);
  for(const line of LYRICS)if(karaokeLetter(line)*line.length>inner-.1+1e-9)bad.push(['overflows',line]);
  // the wall painter no longer draws the screen
  const painted=(()=>{const i=0;karaokeWall(i,6,.01,1.9,3,6,0,8);return CH[i]!==' '&&CH[i]!=='*';})();
  return{bad,speakers:speakers.length,painted};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.speakers,2);assert.equal(r.painted,false);
}));

test('the sung part of the line lights magenta on the screen as the song goes on, and the room stays walkable to its seats',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const S=room.props.find(o=>o.karaokeScreen).karaokeScreen;
  // stand in front of the screen, mid-line, and read the colours across it
  // (with plain ceiling lights: the disco spots also shine full magenta)
  const def=room.def;room.def={...def,ceil:'strip'};px=S.x;py=4.2;a=-Math.PI/2;pitch=.12;const out=[];
  for(const t of [10,13.9]){T=t;render(0);const cols=new Set();for(let i=0;i<CH.length;i++)if(CH[i]&&CH[i]!==' '&&BG[i]!==undefined&&(COL[i]===C(MAG,15)||COL[i]===C(WHITE,15)))cols.add(COL[i]===C(MAG,15)?'sung':'unsung');out.push([...cols].sort());}
  room.def=def;let seats=true;for(const q of room.props.filter(o=>o.seat))seats&&=[[0,.6],[0,-.6],[.6,0],[-.6,0]].some(([dx,dy])=>free(q.x+dx,q.y+dy));
  return{out,seats};
 });
 assert.deepEqual(r.out[0],['unsung']);assert.deepEqual(r.out[1],['sung','unsung']);assert.ok(r.seats);
}));
