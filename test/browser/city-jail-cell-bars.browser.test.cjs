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
test('jail fronts have cached round uprights buried into walls and sill, joined bands, ceiling contact and open quarter-metre gaps',()=>fixture(async p=>{
  const result=await p.evaluate(()=>{
    const bad=[],fronts=room.props.filter(p=>p.jailBars),draw=drawBox;let checked=0;
    const capture=o=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;};
    if(fronts.length!==6)return{bad:['missing native cell fronts'],checked};
    for(const o of fronts){
      const A=capture(o),B=capture(o),m=o.jailBars,role=q=>m.parts.find(p=>p.view===q.ref)?.role;
      const rods=A.filter(q=>role(q)==='upright'),sill=A.find(q=>role(q)==='sill'),band=A.find(q=>role(q)==='band');
      if(A.length!==27||rods.length!==25||!sill||!band)return{bad:['missing closed components'],checked};
      if(o.walk||!o.peeThrough||o.box.hl!==3||o.box.hw!==.03||o.box.z0!==0||o.box.z1!==3||o.radius<3.0225)bad.push('changed native collision/visibility policy');
      for(let k=0;k<A.length;k++){
        const q=A[k];checked++;
        if(q.ref!==B[k].ref||q.shade!==B[k].shade||q.ray!==B[k].ray)bad.push('rebuilding parts');
        if(q.b.x-q.b.hl<o.x-3.0225-1e-8||q.b.x+q.b.hl>o.x+3.0225+1e-8||q.b.y-q.b.hw<o.y-.03-1e-8||q.b.y+q.b.hw>o.y+.03+1e-8)bad.push('outside physical envelope');
      }
      for(const q of [sill,band]){
        const bottom=q.ray(q.b.x,q.b.y,-1,0,0,1,q.b)-1,top=4-q.ray(q.b.x,q.b.y,4,0,0,-1,q.b);
        if(Math.abs(bottom-q.b.z0)>1e-8||Math.abs(top-q.b.z1)>1e-8)bad.push('open rail caps');
      }
      if(sill.b.z0!==0||sill.b.z1!==.06||band.b.z0!==2.265||band.b.z1!==2.335)bad.push('floating sill or changed band');
      for(let k=0;k<rods.length;k++){
        const q=rods[k],b=q.b,x=o.x-3+k*.25,r=.0225;
        const t=q.ray(x,o.y-1,1.3,0,1,0,b),s=q.ray(x+r*.5,o.y-1,1.3,0,1,0,b),nx=HIT.nx,ny=HIT.ny;
        if(Math.abs(b.x-x)>1e-8||Math.abs(t-(1-r))>1e-8||Math.abs(s-(1-r*Math.sqrt(.75)))>1e-8||Math.abs(nx-.5)>1e-8||Math.abs(ny+Math.sqrt(.75))>1e-8)bad.push('upright not round or wrong pitch');
        const bottom=q.ray(x,o.y,-1,0,0,1,b)-1,top=4-q.ray(x,o.y,4,0,0,-1,b);
        if(bottom>sill.b.z1||bottom<0||Math.abs(top-m.height)>1e-8||band.b.y-band.b.hw>b.y+r||band.b.y+band.b.hw<b.y-r)bad.push('detached upright/caps/band');
        const distant=projX*.12;
        if(k===12&&(q.ray(x+.04,o.y-distant,1.3,0,1,0,b)<0||q.ray(x+.04,o.y-1,1.3,0,1,0,b)>0))bad.push('missing distant coverage or widened close rod');
        if(k<24&&A.some(p=>p.ray(x+.125,o.y-1,1.3,0,1,0,p.b)>0))bad.push('gap filled');
      }
      for(const end of [-1,1]){
        const x=o.x+3*end,y=o.y+(o.y===6?-.012:.012),inside=x+end*.012;
        if(room.grid[Math.floor(y)][Math.floor(inside)]!=='#'||Math.hypot(inside-x,y-o.y)>.0225)bad.push('end rod not buried into wall');
      }
    }
    if(room.props.some(p=>!p.jailBars&&p.peeThrough&&p.box?.hl===3&&p.box.hw===.03))bad.push('old mask retained');
    if(room.grid!==JAIL_GRID||room.def.block!==jailBlock)bad.push('native jail plan changed');
    return{bad,checked};
  });
  assert.equal(result.checked,162);assert.deepEqual(result.bad,[]);
}));
test('native jail bars render near and far with clear sight between rods and preserve movement boundaries and guard identity',()=>fixture(async p=>{
  const r=await p.evaluate(()=>{
    const fronts=room.props.filter(p=>p.jailBars),guard=room.props.find(p=>p.fig&&p.tick&&p.y===7.5),look=guard.fig,out=[];
    for(const y of [3.2,5.3]){
      px=11;py=y;a=Math.PI/2;pitch=0;render(0);const A=[BG.slice(),CH.slice(),COL.slice(),ZB.slice()];
      room.props=room.props.filter(p=>!p.jailBars);render(0);let changed=0,far=0,near=0;
      for(let i=0;i<BG.length;i++){
        if(A[0][i]!==BG[i]||A[1][i]!==CH[i]||A[2][i]!==COL[i]){changed++;if(Math.abs(A[3][i]-(6-py))<.06)near++;}
        if(A[3][i]>9-py&&A[3][i]<50)far++;
      }
      room.props.push(...fronts);render(0);out.push({changed,far,near,clear:free(px,py)});
    }
    const bounds=free(11,5.3)&&!free(11,5.85)&&!free(8.1,3.2)&&!free(13.9,3.2);
    return{out,bounds,same:guard.fig===look};
  });
  assert.ok(r.bounds&&r.same&&r.out.every(q=>q.clear&&q.changed>100&&q.near>50&&q.far>200),JSON.stringify(r));
}));
