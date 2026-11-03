'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the towers, the cathedral, the screen tower, the construction site and the lighthouse are built in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   const bad=[],share=()=>{let n=0,g=0;for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9.%+$-]/.test(CH[i]))g++;}return g/n;};
   for(const td of [14,22]){
    for(const [sty,name] of [[3,'stone tower'],[4,'cathedral'],[5,'screen tower'],[6,'construction']]){
     paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=td;env(0);render(0);
     let where=null;for(let k=0;k<N*N&&!where;k++){if(STY[k]!==sty)continue;const x=k%N,y=(k/N)|0;for(const [dx2,dy2] of [[0,1],[0,-1],[1,0],[-1,0]]){if(!map[idx(x+dx2,y+dy2)]&&!map[idx(x+dx2*2,y+dy2*2)]&&!map[idx(x+dx2*3,y+dy2*3)]){where=[x+.5+dx2*3,y+.5+dy2*3,Math.atan2(-dy2,-dx2)];break;}}}
     if(!where){bad.push(['not found',name]);continue;}
     px=where[0];py=where[1];a=where[2];pitch=.3;render(0);const s=share();if(s>.01)bad.push([name,td,+(100*s).toFixed(2)]);} // (main had 10-17%)
    // the lighthouse, from its island, by day (at night the stars and its beam's streaks on the sea, the sea's own business, fill the view)
    if(td===14){paused=false;mode='walk';room=me=freecam=null;tod=td;env(0);px=LIGHTHOUSE.x;py=LIGHTHOUSE.y-1.2;a=Math.PI/2;pitch=.45;render(0);const s=share();if(s>.03)bad.push(['lighthouse',td,+(100*s).toFixed(2)]);}}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
