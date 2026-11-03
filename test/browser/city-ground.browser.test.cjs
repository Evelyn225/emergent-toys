'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the ground off the streets is colour: promenade, sea wall, sand, building sites, yards; hoardings, fences and portapotties; repairs in the asphalt',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   // floor cells over each kind of ground, looked down on from above it
   for(const kind of ['waterfront','construction','yard']){let s=null;for(let by=1;by<N/8-1&&!s;by++)for(let bx=1;bx<N/8-1&&!s;bx++)if(blockKind(bx,by)===kind&&!(worldReady&&naturalCoastAt(bx*8+4,by*8+4))&&!ROAD[idx(bx*8+4,by*8+4)])s=[bx*8+4,by*8+4];
    if(!s){bad.push(['no '+kind]);continue;}let n=0,g=0;
    for(const ang of [0,Math.PI/2,Math.PI,-Math.PI/2]){px=s[0];py=s[1];a=ang;pitch=-.5;render(0);
     for(let rr=Math.ceil(hor)+2;rr<rows;rr++)for(let c=0;c<cols;c++){const i=rr*cols+c;if(FL[i]!==1&&FL[i]!==2)continue;
      const d=ZB[i],sx=2*(c+.5)/cols-1,wx=px+(dx-dy*tf*sx)*d,wy=py+(dy+dx*tf*sx)*d;
      if(blockKind(Math.floor(wx/8),Math.floor(wy/8))!==kind||ROAD[idx(Math.floor(wx),Math.floor(wy))])continue;n++;if(CH[i]!==' '&&CH[i]!=='')g++;}}
    if(n<20)bad.push([kind,'too few floor samples',n]);else if(g/n>.05)bad.push([kind,'characters on the ground',g,n]);}
   // the solids: a hoarding, a chain-link fence's rail and post, a portapotty
   for(const [kind,keepX] of [['hoarding',false],['chain',true],['potty',false]]){const o=solids.find(q=>q.kind===kind);if(!o){bad.push(['no '+kind]);continue;}
    const f=SOLID_SHADE[kind](o);let n=0,g=0;
    for(let u=-o.hl;u<o.hl;u+=o.hl/30)for(let w=o.z0+.005;w<o.z1;w+=(o.z1-o.z0)/20){HIT.face=3;HIT.u=u;HIT.v=o.hw;HIT.w=w;CH[0]=' ';if(f(0,1,10)!==false){n++;if(CH[0]!==' '&&!(keepX&&CH[0]==='x'))g++;}}
    if(!n)bad.push([kind,'drew nothing']);else if(g)bad.push([kind,'characters',g,n]);}
   // repairs: up close some asphalt is patched darker; far off the patches settle into the road
   const tones=fp=>{const s=new Set();for(let wx=40;wx<44;wx+=.013){const t=roadSurface(wx,8*40+1,2,0,1,40,40,fp<.01?.2:30,10);s.add(t[1].toFixed(2));}return s.size;};
   if(!(tones(.001)>tones(1)))bad.push(['no repairs up close',tones(.001),tones(1)]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
