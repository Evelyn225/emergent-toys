'use strict';
// Walking at an angle into a curved shoreline slides you along it, smoothly, rather than sticking and juddering.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('walking into the water at an angle slides along the shore',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);
   const spots=[];for(let k=0;k<N*N&&spots.length<40;k+=3){const x=k%N+.5,y=(k/N|0)+.5;if(!free(x,y))continue;
    let nx=0,ny=0,hit=0;for(let j=0;j<16;j++){const t=j*Math.PI/8;if(!free(x+Math.cos(t)*.12,y+Math.sin(t)*.12)){nx-=Math.cos(t);ny-=Math.sin(t);hit++;}}
    const l=Math.hypot(nx,ny);if(!hit||l<1e-6)continue;nx/=l;ny/=l;const ang=Math.abs(Math.atan2(ny,nx))%(Math.PI/2);
    if(ang<.3||ang>1.27||!isWater(x-nx*.15,y-ny*.15))continue;spots.push([x,y,nx,ny]);}
   let prog=0,jit=0,wet=0,n=0;
   for(const [x,y,nx,ny] of spots)for(const side of [1,-1]){px=x;py=y;const dx=(-ny*side-nx)/Math.SQRT2,dy=(nx*side-ny)/Math.SQRT2;let last=null;
    for(let s=0;s<90;s++){const ox=px,oy=py;move(dx*.0083,dy*.0083);const st=Math.hypot(px-ox,py-oy);if(last!=null&&Math.abs(st-last)>.004)jit++;last=st;if(isWater(px,py))wet++;}
    prog+=Math.hypot(px-x,py-y)/(90*.0083);n++;}
   return{n,prog:prog/n,jitter:jit/n,wet};});
  assert.ok(r.n>=20,'enough shoreline to try '+JSON.stringify(r));
  assert.ok(r.prog>.4,'you keep moving along the shore '+JSON.stringify(r));
  assert.ok(r.jitter<3,'without juddering '+JSON.stringify(r));
  assert.equal(r.wet,0,'and never into the water');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
