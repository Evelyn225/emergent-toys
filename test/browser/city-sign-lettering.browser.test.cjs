'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('at the smallest block size every font pixel of every letter reaches the screen; a cell shows exactly its four',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  // 2 cells per letter by 2.5 rows: walk the cells of each glyph and rebuild it from the block characters
  for(const ch of Object.keys(GLYPH5)){
   const du=.5,dv=1/LETTER_MIN_ROWS,seen=new Set();
   for(let row=0;row<3;row++)for(let col=0;col<2;col++){
    const cell=blockGlyph(ch,(col+.5)*du,(row+.5)*dv,du,dv),bits=BLOCK_CELLS.indexOf(cell);if(bits<0)bad.push(['not a block cell',ch,cell]);
    for(let b=0;b<4;b++)if(bits>>b&1)seen.add((col*2+(b&1))+','+Math.floor((((row+.5)*dv+(b&2?dv:-dv)/4))*5));
   }
   for(let gy=0;gy<5;gy++)for(let gx=0;gx<3;gx++)if(glyphOn(ch,gx,gy)&&!seen.has(gx+','+gy))bad.push(['dropped stroke',ch,gx,gy]);
  }
  if(blockGlyph('H',.1,.1,.0001,.0001)!=='█')bad.push('solid ink is not a full block');
  if(blockGlyph('H',.4,.1,.0001,.0001)!==' ')bad.push('the gap in H is not empty');
  if(blockGlyph('H',.1,-.5,.0001,.0001)!==' '||blockGlyph('H',9,.1,.0001,.0001)!==' ')bad.push('ink outside the word');
  if(blockGlyph('H',.25,.1,.5,.0001)!=='▌')bad.push('left half of a cell');
  return bad;
 });
 assert.deepEqual(r,[]);
}));
test('wall lettering: blocks as long as they fit, then the whole word tight on one row, and one size for the whole sign',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],row=(text,cwid,band,d,step)=>{const out=[];WH.dn=d;WH.sl=0;WH.wc=0;for(let u=-cwid*text.length/2;u<cwid*text.length/2;u+=step){CH[0]='?';if(!wallText(0,u+step/2,step,0,d,text,0,0,cwid,band,C(WHITE,12),C(GRAY,1)))out.push('!');else out.push(CH[0]);}return out;};
  const stepAt=d=>d/projX;
  // 4m: an ordinary title is blocks
  const near=row('HOTEL',.3,.36,4,stepAt(4));if(!near.some(c=>BLOCK_CELLS.includes(c)&&c!==' '))bad.push('no blocks up close');if(near.some(c=>/[A-Z]/.test(c)))bad.push('small letters up close');
  // far: the word is whole and has no gaps in it
  const fd=.36*projY/LETTER_MIN_ROWS*1.3,far=row('HOTEL',.3,.36,fd,stepAt(fd)).join('').trim();
  if(far!=='HOTEL')bad.push(['far word not tight',far]);
  // a board wider than its letters needs: fitted lines use the width
  enterRoom('gym',{word:'GYM',ret:[100,100,0]},[8,9.4,-Math.PI/2]);const board=room.props.find(o=>o.gymWallBoard).gymWallBoard.parts[0];if(board.box.z1-board.box.z0<.6)bad.push('board shrank');
  // an oblique sign keeps one size: the decision is shared across its columns for one view
  px=3;py=5.5;a=-.9;pitch=0;render(0);wallTextSizes.clear();
  const big=wallTextIsBig(.5,.01,3,'SIGN',0,2,.3,.36),other=wallTextIsBig(1.5,.5,3,'SIGN',0,2,.3,.36);if(big!==other)bad.push('size decided per column');
  px+=.1;const fresh=wallTextIsBig(1.5,.5,3,'SIGN',0,2,.3,.36);if(fresh===big&&big)bad.push('size kept after the view moved');
  // an angled word keeps all its letters: the columns from each end of the word to its centre match the word's length
  const D=2,base=5,seen=new Map();WH.dn=D;for(let u=-1.5;u<1.5;){const s=base+u,step=(D*D+s*s)/(D*projX);WH.sl=s/D;WH.wc=u;const q=Math.floor(3-columnsToCentre(u,step,0)+.0137);if(q>=0&&q<6)seen.set(q,(seen.get(q)||0)+1);u+=step;}if(seen.size!==6||[...seen.values()].some(n=>n!==1))bad.push(['angled word lost or repeated letters',[...seen]]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));
test('real signs fill their boards: both title lines span most of the board, and plaques use their height',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],seen={};const orig=hotelFittingText;
  hotelFittingText=(i,u,z,t,text,u0,z0,w,h,...rest)=>{seen[text]={w,h,z0};return orig(i,u,z,t,text,u0,z0,w,h,...rest);};
  const shade=(o,kind)=>{const q=o[kind].parts[0];HIT.face=3;HIT.u=0;HIT.w=q.box.z0+.1;HIT.nx=0;HIT.ny=1;HIT.nz=0;q.shade(0,3,8);return q.box;};
  try{
   enterRoom('gym',{word:'GYM',ret:[100,100,0]},[8,9.4,-Math.PI/2]);let b=shade(room.props.find(o=>o.gymWallBoard),'gymWallBoard');
   const sub=seen['NO PAIN NO GAIN'],name=seen.GYM;if(!sub||!name)bad.push(['lines not drawn',Object.keys(seen)]);else{
    if(sub.w*15<2*b.hl*.8)bad.push(['line does not fill the width',sub.w*15,2*b.hl]);if(sub.w*15>2*b.hl)bad.push('line wider than the board');
    if(name.h+sub.h<(b.z1-b.z0)*.8)bad.push('lines do not fill the height');
    if(name.z0+name.h/2>b.z1||sub.z0-sub.h/2<b.z0)bad.push('lines off the board');
    if(name.z0-name.h/2<sub.z0+sub.h/2-1e-9)bad.push('lines overlap');
   }
   enterRoom('storage',{word:'STORAGE',ret:[100,100,0],cell:[10,10]},[7,8.4,-Math.PI/2]);b=shade(room.props.find(o=>o.storageWallBoard),'storageWallBoard');
   const long=seen['ONE UNIT EVERY BRANCH'];if(!long||long.w*21>2*b.hl)bad.push('a long line overflows');
   enterRoom('bank',{word:'BANK',ret:[100,100,0]},[7,7.4,-Math.PI/2]);b=shade(room.props.find(o=>o.bankWallTitle),'bankWallTitle');
   const bank=seen.BANK;if(!bank||bank.w*4<2*b.hl*.8||bank.h<(b.z1-b.z0)*.8)bad.push(['bank name does not fill its board',bank]);
  }finally{hotelFittingText=orig;}
  return bad;
 });
 assert.deepEqual(r,[]);
}));
test('block cells are exact rectangles in both renderers, and come from the atlas rather than a font',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const n=cols*rows;for(let i=0;i<n;i++){CH[i]=' ';COL[i]=C(WHITE,15);BG[i]=NONE;FOGS[i]=0;FOGB[i]=0;}
  const at=(r,c)=>r*cols+c;CH[at(4,4)]='█';CH[at(4,6)]='▘';CH[at(4,8)]='▚';CH[at(4,10)]='▄';
  const calls=[],text=g.fillText;g.fillText=function(...args){calls.push(args[0]);return text.apply(this,args);};try{present2D();}finally{g.fillText=text;}const lit=(cx,cy)=>{const d=g.getImageData(Math.floor(cx),Math.floor(cy),1,1).data;return d[0]>120;};
  const bad=[],q=(c,fx,fy)=>lit((c+fx)*cw,(4+fy)*FS);
  if(calls.length)bad.push(['block cells went through the font',calls]);
  if(![.25,.75].every(x=>[.25,.75].every(y=>q(4,x,y))))bad.push('full block');
  if(!q(6,.25,.25)||q(6,.75,.25)||q(6,.25,.75)||q(6,.75,.75))bad.push('top-left quadrant');
  if(!q(8,.25,.25)||q(8,.75,.25)||q(8,.25,.75)||!q(8,.75,.75))bad.push('diagonal quadrants');
  if(q(10,.25,.25)||q(10,.75,.25)||!q(10,.25,.75)||!q(10,.75,.75))bad.push('lower half');
  return bad;
 });
 assert.deepEqual(r,[]);
}));
