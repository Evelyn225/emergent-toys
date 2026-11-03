'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
// stand in the open in front of a landmark (by its facade style) and look at it: how much of the view is characters, lettering aside
const VIEW=`(sty,td)=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=td;env(0);render(0);
 let where=null;for(let k=0;k<N*N&&!where;k++){if(STY[k]!==sty)continue;const x=k%N,y=(k/N)|0;for(const [dx2,dy2] of [[0,1],[0,-1],[1,0],[-1,0]]){const kk=idx(x+dx2,y+dy2);if(!map[kk]&&!map[idx(x+dx2*3,y+dy2*3)]&&!map[idx(x+dx2*2,y+dy2*2)]){where=[x+.5+dx2*3,y+.5+dy2*3,Math.atan2(-dy2,-dx2)];break;}}}
 if(!where)return null;px=where[0];py=where[1];a=where[2];pitch=.3;render(0);let n=0,g=0;for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9.%+$-]/.test(CH[i]))g++;}return g/n;}`;
test('the Grand Hotel, the casino, the stock exchange and the museum are built in colour: stone, gilt, glass and bronze',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(`(()=>{const view=${VIEW},bad=[];
   for(const [sty,name] of [[25,'Grand Hotel'],[20,'casino'],[21,'exchange'],[23,'museum']])for(const td of [14,22]){const s=view(sty,td);if(s===null)bad.push(['not found',name]);else if(s>.01)bad.push([name,td,+(100*s).toFixed(2)]);}
   return {bad};})()`); // (main had: hotel 47%, exchange 24%, casino 19%, museum 10%)
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
