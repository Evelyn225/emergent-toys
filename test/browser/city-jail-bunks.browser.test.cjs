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
test('jail bunks have grounded cached steel legs, closed joined frames and supported bedding mirrored clear of cell walls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],beds=room.props.filter(p=>p.jailBunk),draw=drawBox;let checked=0;
  if(beds.length!==6)return{bad:['missing six fitted bunks'],checked};
  for(const o of beds){
   const capture=()=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;},A=capture(),B=capture(),role=q=>o.jailBunk.parts.find(p=>p.view===q.ref)?.role,many=r=>A.filter(q=>role(q)===r),one=r=>many(r)[0],bottom=q=>q.ray(q.b.x,q.b.y,-1,0,0,1,q.b)-1,top=q=>4-q.ray(q.b.x,q.b.y,4,0,0,-1,q.b);
   if(A.length!==16)return{bad:['missing bunk parts'],checked};
   for(let k=0;k<A.length;k++){
    const q=A[k],b=q.b;checked++;
    if(q.ref!==B[k].ref||q.shade!==B[k].shade||q.ray!==B[k].ray)bad.push('rebuilding bunk');
    if(b.x-b.hl<o.x-.95-1e-8||b.x+b.hl>o.x+.95+1e-8||b.y-b.hw<o.y-.42-1e-8||b.y+b.hw>o.y+.42+1e-8||Math.abs(top(q)-b.z1)>1e-8||Math.abs(bottom(q)-b.z0)>1e-8)bad.push('outside envelope or open cap');
   }
   const feet=many('foot'),legs=many('leg'),long=many('long-rail'),ends=many('end-rail'),platform=one('platform'),mattress=one('mattress'),blanket=one('blanket'),pillow=one('pillow');
   if(feet.length!==4||legs.length!==4||long.length!==2||ends.length!==2)bad.push('missing frame supports');
   for(let k=0;k<feet.length;k++)if(Math.abs(bottom(feet[k]))>1e-8||Math.abs(top(feet[k])-bottom(legs[k]))>1e-8||!long.some(q=>inBox(q.b,legs[k].b.x,legs[k].b.y,.026)&&Math.abs(bottom(q)-top(legs[k]))<1e-8))bad.push('floating foot/leg/frame');
   for(const q of long)for(const e of ends)if(Math.abs(Math.abs(q.b.x-e.b.x)-(q.b.hl+e.b.hl))>1e-8||e.b.y-e.b.hw>q.b.y+q.b.hw||e.b.y+e.b.hw<q.b.y-q.b.hw||q.b.z0!==e.b.z0||q.b.z1!==e.b.z1)bad.push('open frame corners');
   if(Math.abs(bottom(platform)-top(long[0]))>1e-8||Math.abs(bottom(mattress)-top(platform))>1e-8||Math.abs(bottom(blanket)-top(mattress))>1e-8||Math.abs(top(blanket)-.58)>1e-8||Math.abs(bottom(pillow)-top(blanket))>1e-8)bad.push('unsupported bedding');
   const t=pillow.ray(pillow.b.x+pillow.b.hl*.6,pillow.b.y,2,0,0,-1,pillow.b),z=2-t,mid=(pillow.b.z0+pillow.b.z1)/2,half=(pillow.b.z1-pillow.b.z0)/2;
   if(Math.abs(z-(mid+half*.8))>1e-8)bad.push('pillow not shaped');
   const wall=o.jailBunk.fy>0?1:12,gap=o.jailBunk.fy>0?o.y-.42-wall:wall-o.y-.42;
   if(Math.abs(gap-.13)>1e-8||o.walk||o.box.z1!==.69||o.box.hl!==.95||o.box.hw!==.42)bad.push('far bunk not mirrored or incorrect collider');
  }
  if(room.props.some(p=>!p.jailBunk&&p.box&&p.box.hl===.95&&p.box.hw===.42&&[.42,.58].includes(p.box.z1)))bad.push('old painted bases retained');
  return{bad,checked};
 });assert.equal(r.checked,96);assert.deepEqual(r.bad,[]);
}));
test('native jail bedding and open legs are visible, all seats and inmates rest on clear mattress edges and cabbie remains reachable',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailBunk&&p.x===9.9&&p.y===1.55),seats=room.props.filter(p=>p.seat),draw=drawBox,parts=[];
  drawBox=(b,shade,ray=rayBox)=>parts.push({b:{...b},ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
  if(seats.length!==12)bad.push('missing seats');
  for(const s of seats){const bed=room.props.find(p=>p.jailBunk&&Math.abs(p.x-s.x)<.5&&Math.abs(p.y+p.jailBunk.fy*.35-s.y)<1e-8);if(!bed||s.h!==.58||s.fx!==0||s.fy!==bed.jailBunk.fy)bad.push('seat in mattress centre or facing bed');else{let top=-Infinity;const d=drawBox;drawBox=(b,shade,ray=rayBox)=>{const t=ray(s.x,s.y,2,0,0,-1,b);if(t>0)top=Math.max(top,2-t);};try{bed.draw(bed.x,bed.y);}finally{drawBox=d;}if(Math.abs(top-s.h)>1e-8)bad.push('seat not supported');}}
  const inmate=room.props.find(p=>p.fig&&p.x===10.2&&p.pose==='sit');if(!inmate||Math.abs(inmate.y-11.1)>1e-8||inmate.seatZ!==.58||inmate.face?.[1]!==-1)bad.push('seated inmate unsupported');
  const out=[];for(const low of [false,true]){
   px=low?9.08:9.9;py=2.6;body.crouch=low?1:0;a=-Math.PI/2;pitch=0;render(0);pitch=((low?.2:.55)-eye)/(py-1.55)*projY/rows;
   const legs=o.jailBunk.parts.filter(p=>p.role==='leg'),shades=legs.map(p=>p.shade),hits=new Map();
   if(low)legs.forEach((p,k)=>p.shade=(i,t,L)=>{const ok=shades[k](i,t,L);hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;});
   try{render(0);}finally{legs.forEach((p,k)=>p.shade=shades[k]);}
   if(low&&[...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).length<5)bad.push('legs missing in actual low view');
   const A=[BG.slice(),CH.slice(),COL.slice()],d=o.draw;o.draw=()=>{};let changed=0;try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==A[0][i]||CH[i]!==A[1][i]||COL[i]!==A[2][i])changed++;}finally{o.draw=d;}
   const gap=parts.every(q=>q.ray(9.9,2.6,.2,0,-1,0,q.b)<0);out.push({clear:free(px,py),changed,gap});
  }
  if(free(10.2,1.55)||!free(10.2,2.6))bad.push('bunk collider missing or blocks approach');
  const grid=room.grid,bars=room.props.filter(p=>p.jailBars).length;enterRoom('jail',{word:'JAIL',until:T+60,cabbie:true,ret:[100,100,0]},[11,3.2,Math.PI/2]);const cab=room.props.find(p=>p.cabbie);if(!cab||cab.seatZ!==.58||Math.abs(cab.y-1.9)>1e-8||cab.face?.[1]!==1)bad.push('cabbie not on mattress edge');
  if(cab){px=cab.x;py=cab.y+.9;a=-Math.PI/2;render(0);if(!/talk to your cab driver/.test(promptText()))bad.push('cabbie conversation blocked');}
  return{bad,out,plan:room.grid===grid&&bars===6&&room.def.block===jailBlock};
 });assert.deepEqual(r.bad,[]);assert.ok(r.plan&&r.out.every(q=>q.clear&&q.changed>100&&q.gap),JSON.stringify(r));
}));
test('real C sits on the jail mattress edge facing the clear cell and stands back on free floor',()=>fixture(async p=>{
 await p.evaluate(()=>{px=10.2;py=2.6;a=-Math.PI/2;render(0);});assert.equal(await p.evaluate(()=>free(px,py)),true);await p.keyboard.press('c');const r=await p.evaluate(()=>({seated:!!body.seat,x:px,y:py,h:body.seat?.h,a}));assert.ok(r.seated&&Math.abs(r.x-10.2)<1e-8&&Math.abs(r.y-1.9)<1e-8&&r.h===.58&&Math.abs(r.a-Math.PI/2)<1e-8,JSON.stringify(r));await p.keyboard.press('c');assert.deepEqual(await p.evaluate(()=>[!!body.seat,px,py,free(px,py)]),[false,10.2,2.6,true]);
}));
