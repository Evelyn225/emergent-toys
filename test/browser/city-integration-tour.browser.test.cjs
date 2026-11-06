'use strict';
// The integration tour (WORLD_QUALITY.md, item 32): every interior opens and draws, without errors and in good time,
// and every shop's jump in dev tools puts you on the pavement outside it, never in a hydrant, a bin or a fire engine.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=13;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('every interior opens just inside its door and draws',()=>city(async p=>{
 const r=await p.evaluate(()=>{const home=[px,py,a],bad=[];let n=0,worst=0,worstKind='';
  const spawnFor=kind=>{const d=ROOM_DEFS[kind];if(d.entry)return [d.entry[0],d.entry[1],d.entry[2]??0];const g=d.grid;
   for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++)if(g[y][x]==='D')for(const [dx,dy] of [[0,-1],[0,1],[1,0],[-1,0]])if(g[y+dy]?.[x+dx]==='.')return[x+dx+.5+dx*.3,y+dy+.5+dy*.3,Math.atan2(dy,dx)];
   return null;};
  for(const kind of Object.keys(ROOM_DEFS)){const at=spawnFor(kind);if(!at)continue;
   try{mode='walk';room=null;[px,py,a]=home;enterRoom(kind,{word:kind.toUpperCase(),ret:[...home],lobby:{word:'HOTEL',ret:[...home]},st:0,t0:T-12,opts:[1,2,3],dest:null,track:0,cell:[Math.floor(home[0]),Math.floor(home[1])]},at);
    env(0);render(0);const t0=performance.now();T+=.05;render(0);const ms=performance.now()-t0;if(ms>worst){worst=ms;worstKind=kind;}n++;}
   catch(e){bad.push([kind,String(e.message).slice(0,100)]);}}
  mode='walk';room=null;[px,py,a]=home;return{n,bad,worst,worstKind};});
 assert.deepEqual(r.bad,[]);assert.ok(r.n>=100,`${r.n} interiors`);assert.ok(r.worst<150,`slowest ${r.worstKind} ${r.worst.toFixed(0)}ms`);
}));

test('every shop jump lands you on clear pavement outside it',()=>city(async p=>{
 const bad=await p.evaluate(()=>{const words=new Set();for(let k=0;k<N*N;k++){const sh=SHOP[k];if(sh?.word&&sh.kind!==SHOP_APTS&&sh.kind!==SHOP_SHUT)words.add(sh.word);}
  const bad=[];for(const w of words){devFree();gotoShop(w);if(mode==='walk'&&!free(px,py))bad.push(w);}return bad;});
 assert.deepEqual(bad,[]);
}));
