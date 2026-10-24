'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('upright bagels have a real through-hole and correctly rotated normals',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{kitchenUprightBagel(0,0,.5,0);}finally{drawBox=draw;}
  const q=shapes[0],front=q.ray(.046,2,.568,0,-1,0,q.box),ny=HIT.ny,n=Math.hypot(HIT.nx,HIT.ny,HIT.nz),
   hole=q.ray(0,2,.568,0,-1,0,q.box),bottom=q.ray(0,0,.3,0,0,1,q.box),z=HIT.w,nz=HIT.nz;
  return{front,ny,n,hole,bottom,z,nz};
 });
 assert.ok(Math.abs(r.front-1.978)<1e-6&&r.ny>.9&&Math.abs(r.n-1)<1e-6);assert.ok(r.hole<0);assert.ok(r.bottom>0&&Math.abs(r.z-.5)<1e-6&&r.nz<-.9);
}));

test('mounted racks support every bagel and empty cup, with all fittings inside their bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];projX=10000;
  for(const kind of ['bagelshop','kissaten']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,4,0]);const model=room.props.find(o=>o.kitchenRack),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
   const bagels=shapes.filter(q=>q.ray===kitchenRayUprightRing),cups=shapes.filter(q=>q.ray===coveRayLathe),bins=shapes.filter(q=>q.ray===foodRayTray);
   const supported=(kind==='bagelshop'?bagels:cups).every(q=>{
    const base=q.box.z0,under=kind==='bagelshop'?bins.find(b=>inBox(b.box,q.box.x,q.box.y,0)&&Math.abs(b.box.z0+.008-base)<1e-6):
     shapes.find(b=>b.ray===homeRayWorktop&&Math.abs(b.box.z1-base)<1e-6&&b.box.hl>1);
    if(!under)return false;
    const down=under.ray(q.box.x,q.box.y,3,0,0,-1,under.box),up=q.ray(q.box.x,q.box.y,base-.1,0,0,1,q.box);
    return down>0&&up>0&&Math.abs((3-down)-(base-.1+up))<1e-6;
   });
   const bounds=shapes.every(q=>Math.abs(q.box.x-model.box.x)+q.box.hl<=model.box.hl+1e-6&&Math.abs(q.box.y-model.box.y)+q.box.hw<=model.box.hw+1e-6&&q.box.z0>=model.box.z0-1e-6&&q.box.z1<=model.box.z1+1e-6);
   const hollow=cups.every(q=>{const t=q.ray(q.box.x,q.box.y,3,0,0,-1,q.box);return t>0&&3-t<q.box.z0+.025;});
   out.push({kind,bagels:bagels.length,cups:cups.length,bins:bins.length,supported,bounds,hollow,wall:Math.abs(model.box.y-model.box.hw-1)<1e-6});
  }
  return out;
 });
 assert.equal(r[0].bagels,64);assert.equal(r[0].bins,8);assert.equal(r[1].cups,36);
 for(const q of r)assert.ok(q.supported&&q.bounds&&q.hollow&&q.wall,JSON.stringify(q));
}));

test('physical bagel labels use projected black lettering that grows at close range',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bagelshop',{word:'BAGELS',ret:[100,100,0]},[5,4,-Math.PI/2]);const rack=room.props.find(o=>o.kitchenRack);room.props=[rack];
  const label=rack.kitchenRack.labels[0],out=[];
  for(const distance of [1.2,.6]){
   px=label.x;py=label.y+distance;a=-Math.PI/2;body.crouch=0;pitch=0;render(0);
   pitch=(label.z-eye)*projY/(distance*rows);render(0);
   const c0=Math.max(0,Math.floor(cols/2-.295*projX/distance)),c1=Math.min(cols-1,Math.ceil(cols/2+.295*projX/distance)),
    r0=Math.max(0,Math.floor(hor-(label.z+.026-eye)*projY/distance)-1),r1=Math.min(rows-1,Math.ceil(hor-(label.z-.026-eye)*projY/distance)+1);
   let count=0,left=Infinity,right=-Infinity;
   for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
    const i=r*cols+c;if(CH[i]!==' '&&(COL[i]>>4)===BLACK){count++;left=Math.min(left,c);right=Math.max(right,c);}
   }
   out.push({distance,count,width:right-left+1});
  }
  return{words:rack.kitchenRack.labels.map(l=>l.word),samples:out};
 });
 assert.deepEqual(r.words,['PLAIN','SESAME','POPPY','EVERYTHING','ONION','RAISIN','SALT','GARLIC']);
 assert.ok(r.samples[0].count>0&&r.samples[1].count>r.samples[0].count*2,JSON.stringify(r));
 assert.ok(r.samples[1].width>r.samples[0].width*1.5,JSON.stringify(r));
}));

test('wall racks clear their clerks and real E purchases still work in both shops',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['bagelshop','BAGELS',5,3.15],['kissaten','KISSATEN',5.55,2.95]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const rack=room.props.find(o=>o.kitchenRack),bad=[];
   for(const q of room.props.filter(q=>q.fig))if(inBox(rack.box,q.x,q.y,.18))bad.push([q.x,q.y]);
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.deepEqual(r.bad,[]);assert.ok(r.clear);assert.match(r.prompt,/E: shop$/);await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
