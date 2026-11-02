'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('streets are surfaces: no dither on asphalt or pavement, kerbs, centre dashes and zebra stripes as paint that settles far off, darker at night',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   const bad=[],hue=c=>c>>4;
   // the floor below the horizon, standing in streets: road and pavement cells paint no characters (lamps, fixtures and the
   // like are drawn over it, so only floor cells count)
   for(const [x,y,ang] of [[41.5,73.5,0],[41.5,73.5,1.57],[60.5,40.5,3.14]]){[px,py]=citySourcePoint(x,y);a=ang;pitch=0;render(0);
    let g=0,n=0;for(let rr=Math.ceil(hor)+2;rr<rows;rr++)for(let c=0;c<cols;c++){const i=rr*cols+c;if(FL[i]!==1&&FL[i]!==2)continue;
     const d=ZB[i],wx=px+(dx-dy*tf*(2*(c+.5)/cols-1))*d,wy=py+(dy+dx*tf*(2*(c+.5)/cols-1))*d;if(!ROAD[idx(Math.floor(wx),Math.floor(wy))])continue;n++;if(CH[i]!==' '&&CH[i]!=='')g++;}
    if(!n)bad.push(['no street floor in view',x,y]);else if(g/n>.01)bad.push(['street glyphs',x,y,+(100*g/n).toFixed(1)]);}
   // a road along x (road 2: e = ly across it): pavement, kerb, asphalt and the centre line where they belong
   const L=10,at=(e,along,d=.5)=>roadSurface(along,8*40+e,2,0,e,40,40,d,L),lvl=v=>v[1];
   const pave=at(.1,3),kerb=at(ROAD_SURFACE.kerb-.004,3),tar=at(.6,3);
   if(pave[0]!==GRAY||kerb[0]!==GRAY||tar[0]!==GRAY||!(lvl(kerb)>lvl(pave)&&lvl(pave)>lvl(tar)))bad.push(['bands',pave,kerb,tar]);
   const dashes=new Set();for(let s=0;s<1;s+=.02)dashes.add(at(1,3+s)[0]);if(!(dashes.has(YEL)&&dashes.has(GRAY)))bad.push(['centre dashes',[...dashes]]);
   const farDash=new Set();for(let s=0;s<1;s+=.02)farDash.add(at(1,3+s,40)[0]);if(farDash.has(YEL))bad.push('centre dashes shimmer far off');
   // at night the same asphalt is darker
   tod=23;env(0);const night=at(.6,3);tod=12;env(0);if(!(lvl(night)<lvl(tar)))bad.push(['night',lvl(night),lvl(tar)]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
