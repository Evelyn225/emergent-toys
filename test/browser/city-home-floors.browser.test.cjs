'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('home timber and rugs resolve real world-aligned material joints, filter both screen axes, dim with lights and leave native floor depth intact',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],tiers=[];if(typeof homeFloorFinish!=='function')return{bad:['missing home floor finishes'],tiers:[]};
  for(const kind of ['home','loft','bellehome']){enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);render(0);const tier=room.def.tier,style=HOME_FLOOR_TIMBER[tier],colors=[];
   const wood=(x,y,fp=.001,L=8)=>{homeFloorWood(0,x,y,L,fp,tier);if(CH[0]!==' ')bad.push('painted material glyph');return BG[0];};
   for(let y=.007;y<.7;y+=.013)for(let x=.037;x<.6;x+=.057)colors.push(wood(x,y));
   if(new Set(colors).size<2)bad.push(kind+' unresolved near material');
   colors.push(wood(.13,0),wood(.13,style.width/2));
   const distant=[];for(let y=.007;y<1.7;y+=.13)for(let x=.037;x<1.6;x+=.17)distant.push(wood(x,y,2));
   if(new Set(distant).size!==1)bad.push('distant board phase aliases');
   const groove=coveGroove,joined=wood(.13,0);coveGroove=()=>0;let unjoined;try{unjoined=wood(.13,0);}finally{coveGroove=groove;}if(joined===unjoined)bad.push('timber joints have no near relief');
   if(wood(.13,.13,.001,0)===wood(.13,.13,.001,12))bad.push('timber ignores lamp light');
   const native=(wx,wy,depth,rx=1,ry=0)=>{const row=rows-2;eye=1.7;hor=row+.5-eye*projY/depth;px=wx-rx*depth;py=wy-ry*depth;roomFloor(0,row,0,rx,ry);return{bg:BG[0],ch:CH[0],depth:ZB[0],floor:FL[0]};};
   const material=homeFloorFinish,seen=[];homeFloorFinish=(...q)=>{seen.push(q.slice(1));return material(...q);};
   try{const first=native(5,room.H-3,3),moved=native(5,room.H-3,3,0,1);if(first.bg!==moved.bg||first.ch!==moved.ch||first.depth!==3||first.floor!==1)bad.push('native world coordinate/depth changed');if(seen.length<2||seen.some(q=>q[0]!==5||q[1]!==room.H-3))bad.push('native material coordinates move with camera');if(seen.length&&Math.abs(seen[0][3]-Math.max(3/projX,9/(1.7*projY)))>1e-8)bad.push('missing grazing row footprint');}finally{homeFloorFinish=material;}
   if(tier){const[x,y]=room.def.home.sofa,inside=(wx,wy,L)=>{homeFloorFinish(0,wx,wy,L,.001);if(CH[0]!==' ')bad.push('painted rug glyph');return BG[0];};
    if(inside(x,y,8)>>4!==(tier===2?GREEN:BLUE))bad.push('rug lost native footprint/tint');
    if(inside(x+2.5,y,8)>>4!==BRICK)bad.push('rug extends past original bounds');
    if(inside(x,y,0)===inside(x,y,12))bad.push('rug ignores lighting');
   }
   tiers.push({tier,width:style.width,length:style.length});
  }return{bad,tiers};});assert.deepEqual(r.bad,[]);assert.equal(new Set(r.tiers.map(t=>t.width)).size,3);
}));
test('native home views use the new finish while bathroom, balcony, Fern and private walking routes retain their own surfaces',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[];let used=0;const finish=typeof homeFloorFinish==='function'&&homeFloorFinish;if(!finish)return['missing finish'];
  homeFloorFinish=(...args)=>{used++;return finish(...args);};
  try{for(const kind of ['home','loft','bellehome']){enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);px=5;py=room.H-3;a=0;pitch=-.3;render(0);if(!free(px,py))bad.push(kind+' review camera blocked');
   const count=used;if(!count)bad.push('native floor does not render finish');
   const draw=drawBox;let slabs=0;drawBox=(b,...rest)=>{if(b.z0<.001&&b.z1>.001&&b.hl>3&&b.hw>3)slabs++;return draw(b,...rest);};try{render(0);}finally{drawBox=draw;}if(slabs)bad.push('duplicate giant floor slab');
   const native=(x,y)=>{const row=rows-2,d=3;eye=1.7;hor=row+.5-eye*projY/d;px=x-d;py=y;roomFloor(0,row,0,1,0);};
   let prior=used;native(room.def.wc.x0+.5,2);if(used!==prior)bad.push('wood replaces bathroom');
   if(kind==='bellehome'){prior=used;native(22,12.5);if(used!==prior)bad.push('wood replaces balcony paving');}
   for(const c of room.def.homePassages||[]){px=(c.start+c.end)/2;py=c.cross-.7;for(let i=0;i<24;i++)move(0,.1);if(Math.abs(py-c.cross-1.7)>1e-8)bad.push('passage route changed');}
  }
  let prior=used;enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);render(0);if(used!==prior)bad.push('Fern floor changed');
  enterRoom('islandshelter',{ret:[100,100,0]},[3,6,0]);render(0);if(used!==prior)bad.push('Cabin floor changed');
  }finally{homeFloorFinish=finish;}return bad;});assert.deepEqual(r,[]);
}));
