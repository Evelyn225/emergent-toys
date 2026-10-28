'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('grandhotel',{word:'GRAND HOTEL',ret:[53,64.2,0]},[12,15.4,-Math.PI/2]);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('Grand lobby columns and chandelier have actual floor/ceiling contacts, closed supported parts, joined arms and reusable translated geometry',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[],columns=room.props.filter(p=>p.hotelColumn),lamp=room.props.find(p=>p.hotelChandelier),height=room.def.height,draw=drawBox;if(columns.length!==2||!lamp)return['missing fitted columns/chandelier'];
  const capture=(o,x=0,y=0)=>{const a=[];drawBox=(b,shade,ray=rayBox)=>a.push({b:{...b},ref:b,shade,ray});try{o.draw(x,y);}finally{drawBox=draw;}return a;};
  const axis=(q,dir)=>{const from=dir>0?-1:height+1,t=q.ray(q.b.x,q.b.y,from,0,0,dir,q.b);return t>.01?from+dir*t:NaN;};
  for(const o of [...columns,lamp]){
   const meta=o.hotelColumn||o.hotelChandelier,A=capture(o),B=capture(o),M=capture(o,.2,.3);capture(o);const role=q=>meta.parts.find(p=>p.view===q.ref)?.role,one=roleName=>A.find(q=>role(q)===roleName);
   if(meta.height!==height)bad.push('mounting datum differs from native ceiling');
   if(A.length!==meta.parts.length||!A.length)bad.push('parts not actually drawn');
   for(let k=0;k<A.length;k++){const q=A[k],b=q.b;if(q.ref!==B[k].ref||q.ref!==M[k].ref||q.shade!==B[k].shade||Math.abs(M[k].b.x-b.x-.2)>1e-8||Math.abs(M[k].b.y-b.y-.3)>1e-8)bad.push('prepared bounds/material rebuilt or moved wrong');
    if(Math.abs(b.x)+b.hl>o.box.hl+1e-8||Math.abs(b.y)+b.hw>o.box.hw+1e-8||b.z0<o.box.z0-1e-8||b.z1>o.box.z1+1e-8)bad.push('part outside actual fixture bounds');
   }
   if(o.hotelColumn){const list=['plinth','foot','shaft','capital','abacus'].map(one);if(list.some(q=>!q)){bad.push('missing column draw parts');continue;}
    if(Math.abs(axis(list[0],1))>1e-8||Math.abs(axis(list.at(-1),-1)-height)>1e-8)bad.push('column detached from floor/ceiling');
    for(let k=1;k<list.length;k++)if(Math.abs(axis(list[k],1)-axis(list[k-1],-1))>1e-8)bad.push('column join open');
    if(o.box.hl!==list[0].b.hl||o.box.hw!==list[0].b.hw||o.box.z0!==0||o.box.z1!==height)bad.push('column collider not measured from rendered plinth');
    for(const q of list){const z=(q.b.z0+q.b.z1)/2,t=q.ray(1,0,z,-1,0,0,q.b);if(!(t>0&&t<1)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-8)bad.push('column has no closed curved surface');}
   }else{
    const canopy=one('canopy'),stem=one('stem'),hub=one('hub'),sockets=A.filter(q=>role(q)==='socket'),globes=A.filter(q=>role(q)==='globe'),arms=A.filter(q=>role(q)==='arm');
    if(!canopy||!stem||!hub||sockets.length!==3||globes.length!==3||arms.length!==9){bad.push('missing chandelier hardware');continue;}
    if(Math.abs(axis(canopy,-1)-height)>1e-8||Math.abs(axis(stem,-1)-axis(canopy,1))>1e-8||axis(stem,1)<hub.b.z0||axis(stem,1)>hub.b.z1)bad.push('chandelier is not mounted/joined');
    for(const q of globes){const s=sockets.find(s=>Math.hypot(s.b.x-q.b.x,s.b.y-q.b.y)<1e-8);if(!s||Math.abs(axis(q,-1)-axis(s,1))>1e-8)bad.push('globe disconnected from socket');const t=q.ray(q.b.x,q.b.y,-1,0,0,1,q.b);q.shade(0,t,0);if(!(t>0)||(BG[0]&15)<11)bad.push('globe is not a real lit closed surface');}
    const t=canopy.ray(1,0,(canopy.b.z0+canopy.b.z1)/2,-1,0,0,canopy.b);canopy.shade(0,t,0);if((BG[0]&15)>7)bad.push('metal housing emits like a bulb');
    for(const q of arms){const b=q.b,len=Math.hypot(b.bx-b.ax,b.by-b.ay,b.bz-b.az),vx=(b.bx-b.ax)/len,vy=(b.by-b.ay)/len,vz=(b.bz-b.az)/len;
     const t=q.ray(b.ax-vx*.2,b.ay-vy*.2,b.az-vz*.2,vx,vy,vz,b);if(Math.abs(t-(.2-b.r))>1e-7||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-7)bad.push('arm cap is not closed/round');
     for(const[x,y,z]of [[b.ax,b.ay,b.az],[b.bx,b.by,b.bz]]){
      const inHub=Math.hypot(x,y)+b.r<.075&&z>hub.b.z0&&z<hub.b.z1,joined=arms.some(o=>o!==q&&[[o.b.ax,o.b.ay,o.b.az],[o.b.bx,o.b.by,o.b.bz]].some(v=>Math.hypot(x-v[0],y-v[1],z-v[2])<1e-8)),mounted=sockets.some(s=>Math.hypot(s.b.x-x,s.b.y-y)<1e-8&&Math.abs(axis(s,-1)-z)<1e-8);
      if(!inHub&&!joined&&!mounted)bad.push('arm endpoint floats away from hub/arm/socket');
     }
    }
   }
  }
  for(const h of [4.2,6.1]){const c=HOTEL_LOBBY_COLUMN(0,0,h),l=HOTEL_LOBBY_CHANDELIER(0,0,h),top=o=>Math.max(...capture(o).map(q=>{const t=q.ray(0,0,h+1,0,0,-1,q.b);return t>.01?h+1-t:-Infinity;}));if(Math.abs(top(c)-h)>1e-8||Math.abs(top(l)-h)>1e-8)bad.push('fixture uses a hardcoded room height');}
  for(const u of [.2,1.3,3.6])for(const z of [.1,.8,1.5,3,4.8]){roomWall(0,u,.01,z,height,3,0,0,8,1,false);if(CH[0]!==' '||(BG[0]>>4)!==WHITE)bad.push('painted architectural glyphs remain on lobby wall');}
  room.def.wall(0,2,.01,3,3,0,8,0);const dark=BG[0];room.def.wall(0,2,.01,3,3,0,8,12);if(BG[0]===dark)bad.push('wall finish ignores room light');
  ROOM_CEILS.hotel(0,0,0,2,2);if(CH[0]!==' ')bad.push('phantom painted ceiling light remains');
  return bad;});assert.deepEqual(bad,[]);
}));
test('native lobby renders columns and chandelier, blocks only the actual column plinths, permits walking under the lamp and retains check-in access',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],col=room.props.find(p=>p.hotelColumn),lamp=room.props.find(p=>p.hotelChandelier);if(!col||!lamp)return{bad:['missing fixtures']};
  for(const [o,x,y,z]of [[col,col.x+3,col.y,2.6],[lamp,12,11,4.6]]){px=x;py=y;a=Math.atan2(o.y-y,o.x-x);pitch=0;render(0);pitch=(z-eye)/Math.hypot(o.x-x,o.y-y)*projY/rows;render(0);const old=[BG.slice(),CH.slice(),COL.slice()],draw=o.draw;let changed=0;o.draw=()=>{};try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i])changed++;}finally{o.draw=draw;}if(changed<20||!free(px,py))bad.push('fixture not visible from a clear native view');}
  for(const c of room.props.filter(p=>p.hotelColumn))if(free(c.x,c.y)||!free(c.x+.56,c.y))bad.push('column collider missing/too wide');
  px=12;py=7;for(let k=0;k<20;k++)move(0,.1);if(Math.abs(py-9)>1e-8)bad.push('cannot walk under chandelier');
  if(!roomPath(12,15.4,6.5,4.1).length||!free(6.5,4.1))bad.push('check-in route blocked');
  tod=19;money=1000;px=6.5;py=4.1;a=-Math.PI/2;pitch=0;render(0);return{bad,prompt:promptText()};});assert.deepEqual(r.bad,[]);assert.match(r.prompt,/book the Royal Suite/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>!!sleep?.lobby?.suite&&money===750),true);
}));
