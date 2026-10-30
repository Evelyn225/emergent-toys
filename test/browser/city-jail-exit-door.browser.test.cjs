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
test('jail exit door has grounded joined cached steel frame, real window bore and recessed pane, attached lever and supported hinges',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailExitDoor),draw=drawBox;if(!o)return{bad:['missing fitted exit'],checked:0};
  const capture=()=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;},A=capture(),B=capture(),role=q=>o.jailExitDoor.parts.find(p=>p.view===q.ref)?.role,one=r=>A.find(q=>role(q)===r),many=r=>A.filter(q=>role(q)===r),bottom=q=>q.ray(q.b.x,q.b.y,-1,0,0,1,q.b)-1,top=q=>3-q.ray(q.b.x,q.b.y,3,0,0,-1,q.b);
  if(A.length!==18)return{bad:['missing closed door components'],checked:A.length};
  for(let k=0;k<A.length;k++){const q=A[k];if(q.ref!==B[k].ref||q.ray!==B[k].ray||q.shade!==B[k].shade)bad.push('rebuilding door');if(Math.abs(top(q)-q.b.z1)>1e-8||Math.abs(bottom(q)-q.b.z0)>1e-8)bad.push('open caps');}
  const sill=one('threshold'),head=one('head'),jambs=many('jamb'),leaf=one('leaf'),pane=one('wired-pane'),rim=one('window-trim'),sign=one('sign'),esc=one('escutcheon'),spindle=one('spindle'),lever=one('lever');
  if(Math.abs(bottom(sill))>1e-8||jambs.some(q=>Math.abs(bottom(q)-top(sill))>1e-8||Math.abs(top(q)-bottom(head))>1e-8||Math.abs(q.b.x+q.b.hw-21)>1e-8)||Math.abs(sign.b.x+sign.b.hw-21)>1e-8)bad.push('floating sill/jamb/head/sign');
  if(Math.abs(leaf.b.y-leaf.b.hl-(jambs[0].b.y+jambs[0].b.hl)-.003)>1e-8||Math.abs(jambs[1].b.y-jambs[1].b.hl-(leaf.b.y+leaf.b.hl)-.003)>1e-8||leaf.b.z0!==sill.b.z1||leaf.b.z1!==head.b.z0)bad.push('leaf not fitted');
  if(leaf.ray(20,7.5,1.65,1,0,0,leaf.b)>0)bad.push('window painted over solid leaf');
  const t=leaf.ray(20,7.5-.929*5,1.65,1,5,0,leaf.b);if(t<0||HIT.face!==7)bad.push('bore lacks inner surface');
  if(Math.abs(pane.ray(20,7.5,1.65,1,0,0,pane.b)-.95)>1e-8||Math.abs(pane.ray(22,7.5,1.65,-1,0,0,pane.b)-1.042)>1e-8||rim.ray(20,7.5,1.65,1,0,0,rim.b)>0||Math.abs(rim.ray(20,7.7175,1.65,1,0,0,rim.b)-.91)>1e-8)bad.push('pane not recessed/closed or trim filled');
  if(Math.abs(esc.b.x+esc.b.hw-(leaf.b.x-leaf.b.hw))>1e-8||Math.abs(spindle.b.ax-(esc.b.x-esc.b.hw))>1e-8||Math.abs(spindle.b.bx-lever.b.ax)>1e-8||spindle.b.by!==lever.b.ay||spindle.b.bz!==lever.b.az)bad.push('handle support gap');
  const overlaps=(a,b)=>a.x-a.hw<=b.x+b.hw&&a.x+a.hw>=b.x-b.hw&&a.y-a.hl<=b.y+b.hl&&a.y+a.hl>=b.y-b.hl;
  for(let k=0;k<2;k++){const j=many('hinge-jamb')[k].b,l=many('hinge-leaf')[k].b,h=many('hinge-barrel')[k].b;if(Math.abs(j.x+j.hw-(jambs[0].b.x-jambs[0].b.hw))>1e-8||Math.abs(l.x+l.hw-(leaf.b.x-leaf.b.hw))>1e-8||!overlaps(j,h)||!overlaps(l,h))bad.push('hinge not attached');}
  for(const[u,z]of [[7.95,1.05],[7.5,2.45],[7,.2]]){ROOM_DEFS.jail.wall(0,u,.01,z,2,21,7,8);const c=[BG[0],CH[0],COL[0]];jailWallFinish(0,u,.01,z,2,20,7,8);if(c.some((v,k)=>v!==[BG[0],CH[0],COL[0]][k]))bad.push('old door/EXIT paint retained');}
  if(!o.walk||o.box||room.grid!==JAIL_GRID||room.def.block!==jailBlock||o.x!==21||o.y!==7.5)bad.push('jail policy or mounting changed');
  return{bad,checked:A.length};
 });assert.equal(r.checked,18);assert.deepEqual(r.bad,[]);
}));
test('native jail EXIT lettering scales, keeps every distant oblique letter once and restores wall context',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=room.props.find(p=>p.jailExitDoor),sign=o.jailExitDoor.parts.find(p=>p.role==='sign'),shade=sign.shade,out=[],before=[px,py];let leaked=false;
  toggleFreecam();for(const far of [false,true]){
   const x=far?10:20.2,y=far?6.6:7.5;Object.assign(freecam,{x,y,z:2.45,yaw:Math.atan2(7.5-y,21-x),pitch:0});const ink=new Map();
   sign.shade=(i,t,L)=>{const ctx=[WH.dn,WH.sl,WH.wc],ok=shade(i,t,L);if(ctx.some((v,k)=>v!==[WH.dn,WH.sl,WH.wc][k]))leaked=true;if(BG[i]===C(WHITE,13)||COL[i]===C(WHITE,13)&&CH[i]!==' ')ink.set(i,{bg:BG[i],ch:CH[i],col:COL[i],t});return ok;};try{renderFreecam();}finally{sign.shade=shade;}
   const visible=[...ink].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col);out.push({count:visible.length,letters:visible.map(([i,q])=>q.ch).filter(c=>'EXIT'.includes(c)).sort().join('')});
  }
  freecam=null;return{out,leaked,held:px===before[0]&&py===before[1]};
 });assert.ok(!r.leaked&&r.held&&r.out[0].count>r.out[1].count&&r.out[1].count>0,JSON.stringify(r));assert.equal(r.out[1].letters,'EITX',JSON.stringify(r));
}));
test('native recessed jail window actually shows filtered wire against its pane',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=room.props.find(p=>p.jailExitDoor),pane=o.jailExitDoor.parts.find(p=>p.role==='wired-pane'),shade=pane.shade,hits=new Map();toggleFreecam();Object.assign(freecam,{x:20.3,y:7.5,z:1.65,yaw:0,pitch:0});
  pane.shade=(i,t,L)=>{const ok=shade(i,t,L);hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;};try{renderFreecam();}finally{pane.shade=shade;}
  const visible=[...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col),colors=[...new Set(visible.map(([i,q])=>q.bg))];freecam=null;
  return{pixels:visible.length,colors};
 });assert.ok(r.pixels>100&&r.colors.length>=2,JSON.stringify(r));
}));
