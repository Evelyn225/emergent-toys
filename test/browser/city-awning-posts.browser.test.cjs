'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('no lamp post or traffic signal stands in a shop awning once the city is laid out; the awnings cut back stay on their walls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],awnings=PAVILION_SOLIDS.filter(o=>o.kind==='awning'||o.kind==='eave'&&o.z1<LAMP_TOP);let trimmed=0;
  for(const o of awnings){
   const near=list=>list.filter(q=>Math.abs(rel(q.x-o.x))<o.hl+o.hw+.6&&Math.abs(rel(q.y-o.y))<o.hl+o.hw+.6);
   for(const l of near(lamps))if(streetFixtureBoxes(l,'lamp').some(b=>streetBoxesOverlap(o,b,0)))bad.push(['a lamp in an awning',+l.x.toFixed(2),+l.y.toFixed(2)]);
   for(const s of near(lights)){const pole={x:s.x,y:s.y,c:1,s:0,hl:.012,hw:.012,z0:0,z1:.4},head={x:s.x,y:s.y,c:s.vert?0:1,s:s.vert?1:0,hl:.035,hw:.035,z0:.27,z1:.4};
    if(streetBoxesOverlap(pole,o,0)||streetBoxesOverlap(head,o,0))bad.push(['a signal in an awning',streetName(s.x,s.y),+s.x.toFixed(2),+s.y.toFixed(2)]);}
   if(o.f&&o.kind==='awning'){ // still fixed to its wall: its back edge on the face's line, inside the face
    const back=o.f.side?o.y-o.f.ny*o.hw:o.x-o.f.nx*o.hw,line=o.f.line+(o.f.side?o.f.ny:o.f.nx)*(.12-.19);
    if(Math.abs(rel(back-line))>1e-6)bad.push(['an awning off its wall',o.x,o.y]);
    if(o.hw<.095-1e-9||o.hl<.05)bad.push(['an awning cut to nothing',o.hw,o.hl]);
    if(o.hw<.19-1e-9||o.hl<(o.f.end-o.f.start)/2-.12-1e-9)trimmed++;
   }
  }
  return {bad:bad.slice(0,8),trimmed};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.trimmed>=20,`awnings cut back: ${r.trimmed}`);
}));
