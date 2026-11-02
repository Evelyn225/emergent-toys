'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the skate shop quarter pipe is one smooth curve: rising with no flat steps, true to its arc, and lit by its slope',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('skate',{word:'SKATE',neon:CYAN,ret:[100,100,0],cell:[10,10]},[3,3,0]);
   const bad=[],boxes=[],db=drawBox;
   drawBox=(b,shade,ray)=>{if(b.quarterPipe)boxes.push({b,shade,ray});};
   try{for(const o of room.props)if(o.draw&&!o.fig)o.draw(o.x-px,o.y-py,o);}finally{drawBox=db;}
   if(boxes.length!==1)return{bad:['ramp surfaces drawn: '+boxes.length]};
   const {b,shade,ray}=boxes[0];
   // drop rays straight down along the ramp's length, across its width
   const heights=[];
   for(let k=1;k<40;k++){const s=k/40*2*b.hl,u=-b.hl+s;for(const v of [-b.hw*.8,0,b.hw*.8]){
    const t=ray(b.x+u*b.c-v*b.s,b.y+u*b.s+v*b.c,5,0,0,-1,b);
    if(t<0){bad.push(['no surface at',+s.toFixed(2)]);continue;}
    const h=5-t,want=QP_R-Math.sqrt(QP_R*QP_R-s*s);if(Math.abs(h-want)>.002)bad.push(['off the arc',+s.toFixed(2),+h.toFixed(3),+want.toFixed(3)]);
    if(HIT.face!==0)bad.push(['not the curved face',HIT.face]);if(v===0)heights.push(h);}}
   for(let k=1;k<heights.length;k++)if(!(heights[k]>heights[k-1]+1e-4))bad.push(['flat step',k]);
   // the face's normal follows the curve, and the steep top is darker than the foot
   const lit=s=>{const u=-b.hl+s,t=ray(b.x+u*b.c,b.y+u*b.s,5,0,0,-1,b);BG[0]=0;shade(0,t,12);return {nz:HIT.nz,bg:BG[0]&15};};
   const foot=lit(.05),top=lit(2*b.hl-.05);
   if(!(foot.nz>.99&&top.nz<.5))bad.push(['normals',foot.nz,top.nz]);if(!(foot.bg>top.bg))bad.push(['slope shading',foot.bg,top.bg]);
   // seen from the side, a level ray just under the coping meets the curve, not a riser
   const z=QP_TOP*.5,t=ray(b.x-b.hl-1,b.y,z,1,0,0,b);if(t<0||HIT.face!==0)bad.push(['side ray',t,HIT.face]);
   return{bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
