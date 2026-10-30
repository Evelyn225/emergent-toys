'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('jail',{word:'JAIL',until:T+60,ret:[100,100,0]},[11,3.2,Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('west jail privacy window has cached closed casing, supported sill, recessed pane and round bars joined into frame',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],frame=room.props.find(p=>p.jailWindowCasing),o=room.props.find(p=>p.jailWestWindow),draw=drawBox;if(!frame||!o)return{bad:['missing fitted privacy window'],checked:0};
  const capture=o=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;},F=capture(frame),A=capture(o),FB=capture(frame),B=capture(o),role=q=>o.jailWestWindow.parts.find(p=>p.view===q.ref)?.role,one=r=>A.find(q=>role(q)===r),bars=A.filter(q=>role(q)==='bar');
  if(F.length!==8||A.length!==7)return{bad:['missing physical window components'],checked:F.length+A.length};
  for(const [array,again]of [[F,FB],[A,B]])for(let k=0;k<array.length;k++){
   const q=array[k],b=q.b,top=3-q.ray(b.x,b.y,3,0,0,-1,b),bottom=q.ray(b.x,b.y,-1,0,0,1,b)-1;
   if(q.ref!==again[k].ref||q.shade!==again[k].shade||q.ray!==again[k].ray)bad.push('rebuilt window');
   if(Math.abs(top-b.z1)>1e-8||Math.abs(bottom-b.z0)>1e-8)bad.push('open caps');
  }
  const bottom=F[0].b,top=F[1].b,jambs=F.slice(2,4).map(q=>q.b),sill=F[7].b,pane=one('pane').b,sign=one('sign').b;
  if(Math.abs(sill.x-sill.hw-1)>1e-8||Math.abs(sill.z1-bottom.z0)>1e-8||jambs.some(b=>Math.abs(b.x-b.hw-1)>1e-8||b.z0!==bottom.z1||b.z1!==top.z0))bad.push('floating sill/frame');
  const sides=[...jambs].sort((a,b)=>a.y-b.y);if(Math.abs(pane.y-pane.hw-(sides[0].y+sides[0].hl))>1e-8||Math.abs(pane.y+pane.hw-(sides[1].y-sides[1].hl))>1e-8)bad.push('pane side gap');
  if(pane.z0!==bottom.z1||pane.z1!==top.z0||pane.x+pane.hl>=bottom.x+bottom.hw||Math.abs(sign.x-sign.hw-1)>1e-8)bad.push('pane not recessed or floating plaque');
  if(bars.length!==5)bad.push('missing bars');
  for(let k=0;k<bars.length;k++){
   const q=bars[k],b=q.b,y=7.1+k*.2,r=.014,t=q.ray(2,y,2.45,-1,0,0,b),s=q.ray(2,y+r*.5,2.45,-1,0,0,b),nx=HIT.nx,ny=HIT.ny;
   if(Math.abs(t-(.9-r))>1e-8||Math.abs(s-(.9-r*Math.sqrt(.75)))>1e-8||Math.abs(nx-Math.sqrt(.75))>1e-8||Math.abs(ny-.5)>1e-8)bad.push('bar not round or pitch changed');
   if(b.z0>bottom.z1||b.z1<top.z0||b.x-r>bottom.x+bottom.hw||b.x-r<bottom.x-bottom.hw)bad.push('bar not welded into frame');
  }
  const gap=[...F,...A].map(q=>({q,t:q.ray(2,7.8,2.45,-1,0,0,q.b)})).filter(q=>q.t>0).sort((a,b)=>a.t-b.t)[0];if(!gap||role(gap.q)!=='pane'||Math.abs(gap.t-.982)>1e-8)bad.push('window gaps blocked');
  for(const[u,z]of [[7.5,2.4],[7.5,1.6]]){ROOM_DEFS.jail.wall(0,u,.01,z,2,0,7,8);const c=[BG[0],CH[0],COL[0]];jailWallFinish(0,u,.01,z,2,1,7,8);if(c.some((v,k)=>v!==[BG[0],CH[0],COL[0]][k]))bad.push('old window/plaque paint retained');}
  if(o.box||!o.walk||room.grid!==JAIL_GRID||room.def.block!==jailBlock)bad.push('jail policy changed');return{bad,checked:F.length+A.length};
 });assert.equal(r.checked,15);assert.deepEqual(r.bad,[]);
}));
test('native privacy pane follows day and night with visible round bars and casing, while the prisoner stays in the cell',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=room.props.find(p=>p.jailWestWindow),frame=room.props.find(p=>p.jailWindowCasing),pane=o.jailWestWindow.parts.find(p=>p.role==='pane'),bars=o.jailWestWindow.parts.filter(p=>p.role==='bar'),before=[px,py],out=[];toggleFreecam();Object.assign(freecam,{x:2.2,y:7.5,z:2.35,yaw:Math.PI,pitch:0});
  for(const time of [12,23]){
   tod=time;env(0);const partHits=new Map(),barHits=new Map(),shade=pane.shade,shades=bars.map(p=>p.shade);
   const hook=(base,map)=>(i,t,L)=>{const ok=base(i,t,L);map.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;};pane.shade=hook(shade,partHits);bars.forEach((p,k)=>p.shade=hook(shades[k],barHits));try{renderFreecam();}finally{pane.shade=shade;bars.forEach((p,k)=>p.shade=shades[k]);}
   const visible=map=>[...map].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col),glass=visible(partHits),steel=visible(barHits),A=[BG.slice(),CH.slice(),COL.slice()],d=frame.draw;frame.draw=()=>{};let changed=0;try{renderFreecam();for(let i=0;i<BG.length;i++)if(BG[i]!==A[0][i]||CH[i]!==A[1][i]||COL[i]!==A[2][i])changed++;}finally{frame.draw=d;}
   out.push({pane:glass.length,bars:steel.length,frame:changed,level:glass.length?glass.reduce((s,[i,q])=>s+(q.bg&15),0)/glass.length:0});
  }
  freecam=null;return{out,held:px===before[0]&&py===before[1]};
 });assert.ok(r.held&&r.out.every(q=>q.pane>50&&q.bars>20&&q.frame>20)&&r.out[0].level>r.out[1].level+2,JSON.stringify(r));
}));
test('native BLOCK C plaque scales and every distant oblique letter reads once in order without wall-context leaks',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=room.props.find(p=>p.jailWestWindow),sign=o.jailWestWindow.parts.find(p=>p.role==='sign'),shade=sign.shade,out=[];let leaked=false;toggleFreecam();
  for(const far of [false,true]){const x=far?12:2,y=far?6.5:7.5;Object.assign(freecam,{x,y,z:1.6,yaw:Math.atan2(7.5-y,1-x),pitch:0});const hits=new Map();sign.shade=(i,t,L)=>{const ctx=[WH.dn,WH.sl,WH.wc],ok=shade(i,t,L);if(ctx.some((v,k)=>v!==[WH.dn,WH.sl,WH.wc][k]))leaked=true;if(BG[i]===C(YEL,13)||COL[i]===C(YEL,13)&&CH[i]!==' ')hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;};try{renderFreecam();}finally{sign.shade=shade;}const ink=[...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).sort((a,b)=>a[0]-b[0]);out.push({pixels:ink.length,word:ink.map(([i,q])=>q.ch).filter(c=>'BLOCK'.includes(c)).join('')});}
  freecam=null;return{out,leaked};
 });assert.ok(!r.leaked&&r.out[0].pixels>r.out[1].pixels&&r.out[1].pixels>=6,JSON.stringify(r));assert.equal(r.out[1].word,'BLOCKC',JSON.stringify(r));
}));
