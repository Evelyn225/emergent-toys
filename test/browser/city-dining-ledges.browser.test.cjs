'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('ledge brackets meet their real underside and wall plates at every mounting orientation',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const [fx,fy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const model=KITCHEN_WALL_LEDGE(0,0,1.05,.2,1.06,fx,fy),b=model.box,shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const top=shapes.find(q=>q.ray===homeRayWorktop&&q.box.hl>1),plates=shapes.filter(q=>q.ray===homeRayWorktop&&q.box.hw===.0075),beams=shapes.filter(q=>q.ray===coveRayCapsule);
   const supported=beams.every(q=>{
    const d=q.box,t=top.ray(d.bx,d.by,0,0,0,1,top.box);
    return t>0&&Math.abs(t-(d.bz+d.r))<1e-6&&plates.some(p=>inBox(p.box,d.ax,d.ay,0)&&d.az>=p.box.z0&&d.az<=p.box.z1);
   });
   const mounted=plates.every(p=>{
    const t=p.ray(p.box.x-fx*.2075,p.box.y-fy*.2075,.8,fx,fy,0,p.box);
    return t>0&&Math.abs(t-.2)<1e-6;
   });
   const bounds=shapes.every(({box:q})=>{
    const u=q.x*b.c+q.y*b.s,v=-q.x*b.s+q.y*b.c,cc=q.c*b.c+q.s*b.s,ss=-q.c*b.s+q.s*b.c;
    return Math.abs(u)+Math.abs(cc)*q.hl+Math.abs(ss)*q.hw<=b.hl+1e-6&&Math.abs(v)+Math.abs(ss)*q.hl+Math.abs(cc)*q.hw<=b.hw+1e-6&&q.z0>=b.z0-1e-6&&q.z1<=b.z1+1e-6;
   });
   out.push({supported,mounted,bounds,plates:plates.length,beams:beams.length});
  }
  return out;
 });for(const q of r){assert.equal(q.plates,2);assert.equal(q.beams,4);assert.ok(q.supported&&q.mounted&&q.bounds,JSON.stringify(q));}
}));

test('the trestle table stands on its feet and supports its top; low-table and coffee settings rest on actual tables',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=KITCHEN_TRESTLE_TABLE(0,0),shapes=[],draw=drawBox;projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const top=shapes.find(q=>q.ray===homeRayWorktop),feet=shapes.filter(q=>q.box.z0===0),posts=shapes.filter(q=>q.box.z0===.045),caps=shapes.filter(q=>Math.abs(q.box.z1-.72)<1e-6);
  const grounded=posts.every(p=>{
   const foot=feet.find(f=>Math.abs(f.box.x-p.box.x)<1e-6),down=foot.ray(p.box.x,p.box.y,1,0,0,-1,foot.box),up=p.ray(p.box.x,p.box.y,0,0,0,1,p.box);
   return down>0&&up>0&&Math.abs(1-down-up)<.0006;
  });
  const supported=caps.every(p=>{
   const down=p.ray(p.box.x,p.box.y,1,0,0,-1,p.box),up=top.ray(p.box.x,p.box.y,0,0,0,1,top.box);return down>0&&up>0&&Math.abs(1-down-up)<.0006;
  });
  const rnd=Math.random,out=[];try{Math.random=()=>.1;
   for(const [kind,word,flag]of [['roastery','COFFEE','diningTrestle'],['izakaya','IZAKAYA','diningLowTable']]){
    enterRoom(kind,{word,ret:[100,100,0]},[5,4,0]);const tables=room.props.filter(q=>q[flag]),settings=room.props.filter(q=>q.tableware&&tables.some(t=>inBox(t.box,q.x,q.y,0))),bad=[];
    for(const setting of settings){
     const table=tables.find(t=>inBox(t.box,setting.x,setting.y,0)),parts=[];
     drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{table.draw(table.x,table.y);}finally{drawBox=draw;}
     if(!parts.some(p=>{const t=p.ray(setting.x,setting.y,2,0,0,-1,p.box);return t>0&&Math.abs(2-t-setting.tableware.support)<.0006;}))bad.push([setting.x,setting.y]);
    }
    out.push({kind,tables:tables.length,settings:settings.length,bad});
   }
  }finally{Math.random=rnd;}return{feet:feet.length,posts:posts.length,caps:caps.length,grounded,supported,out};
 });
 assert.equal(r.feet,2);assert.equal(r.posts,2);assert.equal(r.caps,2);assert.ok(r.grounded&&r.supported);
 for(const q of r.out){assert.ok(q.tables>0&&q.settings===4,JSON.stringify(q));assert.deepEqual(q.bad,[]);}
}));

test('all ten ledges mount to real walls, and every corrected taco stool sits inside on clear floor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[];
  for(const [kind,word]of [['chickenshop','CHICKEN'],['kebabshop','KEBAB'],['bento','BENTO'],['takoyaki','TAKOYAKI'],['donutshop','DONUTS'],['juicebar','JUICE'],['bagelshop','BAGELS'],['taqueria','TACOS']]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,4,0]);const ledges=room.props.filter(q=>q.diningLedge),bad=[];
   for(const q of ledges){const d=q.diningLedge;
    if(roomAt(q.x-d.fx*(d.depth+.001),q.y-d.fy*(d.depth+.001))!=='#')bad.push(['mount',q.x,q.y]);
    const b=q.box,ex=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;
    if(b.x-ex<1-1e-6||b.x+ex>room.W-1+1e-6||b.y-ey<1-1e-6||b.y+ey>room.H-1+1e-6)bad.push(['outside',q.x,q.y]);
   }
   out.push({kind,count:ledges.length,bad});
  }
  const rnd=Math.random;try{Math.random=()=>.9;enterRoom('taqueria',{word:'TACOS',ret:[100,100,0]},[2.25,6,Math.PI]);}finally{Math.random=rnd;}
  const stools=room.props.filter(q=>q.seat&&Math.abs(q.x-1.75)<1e-6),seated=[];
  for(const s of stools){px=s.x+.5;py=s.y;a=Math.PI;body.seat=null;const clear=free(px,py),ok=sitDown();seated.push(clear&&ok&&roomAt(px,py)==='.'&&Math.hypot(px-s.x,py-s.y)<.01);standUp();}
  return{out,stools:stools.map(s=>s.y),seated};
 });
 assert.equal(r.out.reduce((n,q)=>n+q.count,0),10);for(const q of r.out)assert.deepEqual(q.bad,[],q.kind);
 assert.deepEqual(r.stools,[5.9,6.75,7.6]);assert.ok(r.seated.every(Boolean),JSON.stringify(r));
 for(const y of r.stools){
  await p.evaluate(y=>{px=2.25;py=y;a=Math.PI;body.seat=null;render(0);},y);
  await p.keyboard.press('KeyC');
  assert.ok(await p.evaluate(y=>!!body.seat&&roomAt(px,py)==='.'&&Math.abs(px-1.75)<.01&&Math.abs(py-y)<.01,y));
  await p.keyboard.press('KeyC');assert.ok(await p.evaluate(()=>!body.seat));
 }
}));
