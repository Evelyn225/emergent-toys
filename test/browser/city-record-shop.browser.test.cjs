'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('record bins hold their LPs in the trough between divider cards; sleeves face out on ledges behind their lips',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],B=RECORD_BIN;projX=10000;
  enterRoom('records',{word:'RECORDS',ret:[100,100,0]},[5,5,0]);
  const P=room.props,draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{o.draw(o.x-px,o.y-py);}finally{drawBox=draw;}return out.map(q=>({...q,box:{...q.box,x:q.box.x+px,y:q.box.y+py}}));};
  const bins=P.filter(o=>o.recordBin);if(bins.length!==2)bad.push(['bins',bins.length]);
  for(const o of bins){const d=o.recordBin,ps=parts(o);
   // runs stand on the cabinet top inside the trough walls, cards stand taller in the gaps between runs
   for(const q of ps.filter(q=>Math.abs(q.box.z0-B.rim)<1e-9&&Math.abs(q.box.z1-B.rim-B.sleeve)<1e-9)){
    const ex=Math.abs(q.box.y-o.y)+q.box.hl,ey=Math.abs(q.box.x-o.x)+q.box.hw; // (the bin runs along y)
    if(ex>d.hl-B.wall+1e-9||ey>d.inner+1e-9)bad.push(['run through the trough',+q.box.x.toFixed(3),+q.box.y.toFixed(3)]);
   }
   const runs=d.runs.length,cards=d.cards.length;if(runs<8||cards<3)bad.push(['thin bin',runs,cards]);
   for(const c of d.cards){const near=d.runs.filter(r=>Math.abs(Math.abs(r.u-c.u)-(r.len/2+.003))<1e-9);if(near.length<4)bad.push(['card not between runs',c.u]);}
   if(ps.some(q=>q.box.z1>o.box.z1+1e-9))bad.push('part above the bin box');
  }
  const fo=P.find(o=>o.faceOut),f=fo.faceOut;
  for(const q of f.sleeves){
   const ledge=f.rows[q.row];if(Math.abs(q.z-(ledge+.025))>1e-9)bad.push(['sleeve off its ledge',q.x]);
   if(q.x-B.sleeve/2<fo.box.x-fo.box.hl-1e-9||q.x+B.sleeve/2>fo.box.x+fo.box.hl+1e-9)bad.push(['sleeve past the ledge',q.x]);
   if(f.rows[q.row+1]!==undefined&&q.z+B.sleeve>f.rows[q.row+1]-1e-9)bad.push(['sleeve into the ledge above',q.x]);
  }
  const ps=parts(fo),sl=ps.filter(q=>q.box.hl===B.sleeve/2);
  for(const q of sl)if(q.box.y-q.box.hw<1+1e-9||q.box.y+q.box.hw>1+f.ledge-.012-1e-9)bad.push(['sleeve through the wall or the lip',+q.box.y.toFixed(4)]);
  if(sl.length!==f.sleeves.length||f.sleeves.length<60)bad.push(['sleeves',sl.length,f.sleeves.length]);
  // counter, till, listening cabinet; no painted boxes; aisles round the bins
  if(P.filter(o=>o.shopCounter).length!==2)bad.push('counters');
  const till=P.find(o=>o.till),under=P.find(o=>o.shopCounter&&inBox(o.box,till.x,till.y,0));
  if(!under||Math.abs(till.box.z0-under.box.z1)>1e-9)bad.push('till not on the counter');
  if(String(ROOM_DEFS.records.props).includes('BX('))bad.push('a painted box is left');
  for(const [x,y] of [[4.7,3.7],[1.6,3.7],[7.8,3.7],[4.7,1.6],[4.7,6.2]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));
