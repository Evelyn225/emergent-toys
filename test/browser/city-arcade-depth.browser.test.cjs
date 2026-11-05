'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('Shotengai roof records its own ray depth in front of walls and later geometry',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1170,height:800}});
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const result=await p.evaluate(()=>{
  tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;
  const spots=[];for(let by=1;by<N/8-1&&spots.length<3;by++)for(let bx=1;bx<N/8-1&&spots.length<3;bx++)if(districtOf(bx,by)==='shotengai'&&arcadeAt(bx*8+3,by*8+1))spots.push([bx*8+3,by*8+1]);
  let covered=0,bad=0,hidden=0,leaked=0;const sprites=CITY.sprites;
  try{CITY.sprites=()=>{
   const cells=[];
   for(let c=0;c<cols;c++)for(let r=0;r<Math.min(rows,hor);r++){
    const up=(hor-r-.5)/projY,t=(ARCADE_Z-eye)/up,cx=2*c/cols-1,rx=dx-dy*tf*cx,ry=dy+dx*tf*cx;
    const wx=px+rx*t,wy=py+ry*t,i=r*cols+c;
    if(t<=0||t>40||!arcadeAt(wx,wy)||!arcadeRoofPart(worldCoord(wx),worldCoord(wy)))continue;
    covered++;if(ZB[i]>t+1e-4)bad++;
    if(Math.abs(ZB[i]-t)<1e-4){cells.push([i,BG[i],CH[i]]);}
   }
   // Broad geometry above the canopy must not punch through its recorded depth.
   drawBox(boxAt(dx*2,dy*2,dx,dy,3,3,ARCADE_Z+.1,ARCADE_Z+.6),(i)=>{BG[i]=C(MAG,15);set(i,'X',0);return true;});
   for(const [i,bg,ch] of cells){hidden++;if(BG[i]!==bg||CH[i]!==ch)leaked++;}
  };
  for(const td of [14,22])for(const [x,y] of spots)for(const ang of [0,.6,Math.PI/2]){tod=td;env(0);px=x;py=y;a=ang;pitch=.45;render(0);}
  }finally{CITY.sprites=sprites;}
  return {covered,bad,hidden,leaked};
 });assert.ok(result.covered>1000,JSON.stringify(result));assert.equal(result.bad,0,JSON.stringify(result));assert.ok(result.hidden>1000);assert.equal(result.leaked,0,JSON.stringify(result));
 }finally{await browser.close();}
});
