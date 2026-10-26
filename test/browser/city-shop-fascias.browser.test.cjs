'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('every named shop face has a fascia board round its lettering, standing off the wall and clear of the other trim',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],renamed=[],fascias=ARCH_DETAILS.filter(o=>o.kind==='fascia'),awnings=ARCH_DETAILS.filter(o=>o.kind==='awning');let expected=0;
  for(let dir=0;dir<4;dir++)ARCH_FACES[dir].forEach((f,k)=>{const sh=SHOP[k];if(!f||f.counted||!sh||sh.kind===SHOP_APTS||f.low||!architectureSignedFace(f,sh))return;f.counted=true;
   const g=architectureSignSpec(sh.architecture,f,sh);if(g.cwid<.03||g.zc+g.band/2+g.edge>f.height-.07)return;expected++;if(!f.fascia)bad.push(['a named face with no board',sh.word]);});
  for(const o of fascias){const sh=SHOP[o.ownerCell];
   if(!sh)bad.push(['a board on no shop',o.word]);
   if(sh.word!==o.word){renamed.push(o);continue;} // (a shop renamed after it was built: the second test)
   if(o.hl<o.word.length*o.cwid/2+o.edge||o.z0>o.zc-o.band/2-o.edge+1e-9||o.z1<o.zc+o.band/2+o.edge-1e-9)bad.push(['lettering spilling off its board',o.word]);
   const back=o.nx?o.x-o.nx*o.hw:o.y-o.ny*o.hw,wall=Math.round(back);if(Math.abs(back-wall)>1e-6)bad.push(['a board off the wall',o.word,+(back-wall).toFixed(4)]);
   if(o.outSign!==(o.ny*o.c-o.nx*o.s))bad.push('a board facing the wrong way');
   const [ex,ey]=o.outSign>0?[o.c,o.s]:[-o.c,-o.s]; // (faceDir on its front face)
   if(across(ex,ey,-o.nx,-o.ny)<.99)bad.push(['lettering reading backwards from the street',o.word]);
   if(ARCH_BLOCKERS.includes(o))bad.push('a board you walk into');}
  for(const o of [...fascias,...awnings])for(const q of ARCH_DETAILS){if(q===o||q.ownerCell!==o.ownerCell&&Math.hypot(rel(q.x-o.x),rel(q.y-o.y))>2)continue;
   if(o.kind==='awning'&&q.kind==='awning'&&Math.hypot(rel(q.x-o.x),rel(q.y-o.y))<.11)continue; // (its own canopy and valance)
   if(streetBoxesOverlap(o,q,0))bad.push(['overlapping',o.kind,q.kind,o.word||SHOP[o.ownerCell].word]);}
  for(const o of awnings){
   if(ARCH_BLOCKERS.includes(o))bad.push('an awning you walk into');
   if(o.z0<.25)bad.push(['an awning low over the pavement',o.z0]); // (2.5 m)
   const cn=o.nx?o.x:o.y,sg=o.nx||o.ny,reach=(cn-Math.round(cn-sg*.05))*sg+o.hw; // (from the wall line)
   if(reach>.105)bad.push(['an awning reaching the walking line',+reach.toFixed(3)]);}
  // and nothing on the pavement stands in an awning
  for(const o of awnings){const near=(list)=>list.filter(m=>Math.hypot(rel(m.x-o.x),rel(m.y-o.y))<o.hl+.3);
   for(const l of near(lamps))if(streetFixtureBoxes(l,'lamp').some(b=>streetBoxesOverlap(o,b,0)))bad.push('an awning through a lamp');
   for(const m of near(machines))if(streetFixtureBoxes(m,'machine').some(b=>streetBoxesOverlap(o,b,0)))bad.push('an awning over a vending machine');
   for(const t of near(trees))if(streetFixtureBoxes(t,'tree').some(b=>streetBoxesOverlap(o,b,0)))bad.push('an awning through a tree');}
  return {bad:bad.slice(0,10),fascias:fascias.length,expected,awnings:awnings.filter(o=>o.part==='canopy').length,styles:[...new Set(fascias.map(o=>o.style))].sort()};
 });
 assert.deepEqual(r.bad,[]);
 assert.ok(r.fascias>900&&r.fascias===r.expected,`fascias ${r.fascias} for ${r.expected} named faces`);
 assert.deepEqual(r.styles,['board','box','painted']);
 assert.ok(r.awnings>150,`awnings ${r.awnings}`);
}));

test('up close the board carries the name and the wall behind is bare; further off the same lettering is painted on the wall; you walk under an awning',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  // a shop's board seen square on, with open ground in front of it out past the board's draw distance
  const clear=o=>{for(let d=.1;d<14;d+=.05){const k=idx(Math.floor(o.x+o.nx*d),Math.floor(o.y+o.ny*d));if(map[k])return false;}return true;};
  for(const style of ['board','box','painted']){const o=ARCH_DETAILS.find(q=>q.kind==='fascia'&&q.style===style&&q.word.length>3&&SHOP[q.ownerCell].word===q.word&&clear(q));
   if(!o){bad.push([style,'no board with a clear view to test']);continue;}
   const look=d=>{px=o.x+o.nx*d;py=o.y+o.ny*d;a=Math.atan2(-o.ny,-o.nx);pitch=0;const calls=[],w0=wallText,t0=worldText;
    wallText=(...z)=>{if(z[5]===o.word&&w0(...z)){calls.push(['wall',z[7],z[8],z[9]]);return true;}return w0(...z);};
    worldText=(...z)=>{if(z[0]===o.word)calls.push(['board']);return t0(...z);};
    try{render(0);}finally{wallText=w0;worldText=t0;}return calls;};
   const near=look(3),far=look(13);
   if(!near.some(c=>c[0]==='board'))bad.push([style,'no lettering on the board up close']);
   if(near.some(c=>c[0]==='wall'))bad.push([style,'lettering painted behind the board up close']);
   const w=far.find(c=>c[0]==='wall');if(!w)bad.push([style,'no lettering from further off']);
   else if(Math.abs(w[1]-o.zc)>1e-9||Math.abs(w[2]-o.cwid)>1e-9||Math.abs(w[3]-o.band)>1e-9)bad.push([style,'the painted lettering a different size or height from the board']);}
  // the hardware store that becomes IDEA after the city's built: its board takes the new name, fitted inside it
  const moved=ARCH_DETAILS.find(q=>q.kind==='fascia'&&SHOP[q.ownerCell].word!==q.word);
  if(!moved)bad.push('no renamed shop to test');
  else{HIT.face=moved.outSign>0?3:4;HIT.u=0;HIT.w=moved.zc;architectureFasciaShade(moved,0,1,10);
   if(moved.word!==SHOP[moved.ownerCell].word)bad.push('a renamed shop\'s board keeping the old name');
   if(moved.word.length*moved.cwid/2+moved.edge>moved.hl)bad.push('a renamed shop\'s name spilling off its board');}
  const aw=ARCH_DETAILS.find(q=>q.kind==='awning'&&q.part==='canopy');mode='walk';
  const under=[aw.x+aw.nx*.045,aw.y+aw.ny*.045];if(!free(...under))bad.push('blocked under an awning'); // (just inside its front edge)
  return bad;
 });
 assert.deepEqual(r,[]);
}));
