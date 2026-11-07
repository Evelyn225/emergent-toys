'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('garage, tyre shop, welder, courier office, gym, phone shop, pawnbroker, off-licence, jeweller and the hotel and motel lobbies get their extra fittings inside the walls, show from the room, and keep the counter and the door reachable',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const out={};for(const kind of ['garage','tireshop','welding','courier','gym','phones','pawn','liquor','jeweler','hotel','motel']){const d=ROOM_DEFS[kind],g=d.grid,W=g[0].length,H=g.length,entry=d.entry||[W/2,H-1.6,-Math.PI/2];
  enterRoom(kind,{word:kind.toUpperCase(),neon:YEL,ret:[100,100,0]},entry);
  const bad=[];
  for(const o of room.props)if(o.sparseAdded&&o.box){const b=o.box,rx=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ry=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;if(b.x-rx<.95||b.x+rx>W-.95||b.y-ry<.95||b.y+ry>H-.95)bad.push(kind+' through the wall at '+b.x.toFixed(2)+','+b.y.toFixed(2));}
  const saved=room.props,k=d.keeper,goal=[k[0],k[1]+(k[1]<H/2?1:-1)*.9],route=()=>roomPath(entry[0],entry[1],goal[0],goal[1]).length>0;let changed=0;
  px=W/2;py=H/2+.5;pitch=-.1;for(const ang of [-Math.PI/2,0,Math.PI,Math.PI/2]){a=ang;room.props=saved;render(0);const A=BG.slice();room.props=saved.filter(o=>!o.sparseAdded);render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==A[i])changed++;}
  room.props=saved.filter(o=>!o.sparseAdded);const before=route();room.props=saved;const after=route();
  out[kind]={bad,changed,before,after,added:saved.filter(o=>o.sparseAdded).length};}return out;});
 for(const [kind,q] of Object.entries(r)){assert.deepEqual(q.bad,[],kind);assert.ok(q.added>=1&&(!q.before||q.after),kind+' '+JSON.stringify(q));assert.ok(q.changed>150,kind+' additions barely show: '+q.changed);}
}));
