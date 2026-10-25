'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=26;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('plush sharks have a flat contact patch, connected fins and seated eyes inside their saved placement bounds',()=>fixture(async p=>{
 const results=await p.evaluate(()=>{
  const out=[],draw=drawBox;
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,.63])for(const z of [0,.55]){
   const p={id:'sharkplush',key:1,x:4,y:5,a:angle,z},model=furnishingProp(p,{}),parts=[],bad=[],c=Math.cos(angle),s=Math.sin(angle);
   drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});try{model.draw(4,5);}finally{drawBox=draw;}
   const body=parts.find(q=>q.box.plushRole==='body'),m=model.box,at=(u,v)=>[4+c*u-s*v,5+s*u+c*v];
   // The whole contact ellipse, rather than one tangential point, reaches
   // the real floor/bed height. The body is closed from below and above.
   for(const [u,v]of [[0,0],[.07,0],[-.07,0],[0,.14],[0,-.14]]){
    const [x,y]=at(u,v),t=body.ray(x,y,z-.2,0,0,1,body.box);
    if(Math.abs(t-.2)>1e-7||HIT.nz!==-1)bad.push(['support',u,v,t]);
   }
   const top=body.ray(4,5,z+1,0,0,-1,body.box);if(Math.abs(1-top-.24)>1e-7)bad.push('body top');
   for(const q of parts){const b=q.box,cc=b.c*c+b.s*s,ss=-b.c*s+b.s*c,u=(b.x-4)*c+(b.y-5)*s,v=-(b.x-4)*s+(b.y-5)*c;
    if(Math.abs(u)+Math.abs(cc)*b.hl+Math.abs(ss)*b.hw>m.hl+1e-7||Math.abs(v)+Math.abs(ss)*b.hl+Math.abs(cc)*b.hw>m.hw+1e-7||b.z0<m.z0-1e-7||b.z1>m.z1+1e-7)bad.push(['bounds',b.plushRole]);
   }
   const inside=(q,x,y,w)=>{const b=q.box,dx=x-b.x,dy=y-b.y;return (((dx*b.c+dy*b.s)/b.hl)**2+((-dx*b.s+dy*b.c)/b.hw)**2+((w-(b.z0+b.z1)/2)/((b.z1-b.z0)/2))**2)<1;};
   // Intersections are probed on the rendered solids, including eye roots.
   const joined=(parent,child)=>{const b=child.box;
    for(let ix=-3;ix<=3;ix++)for(let iy=-3;iy<=3;iy++)for(let iz=-3;iz<=3;iz++){
     const u=ix/3*b.hl,v=iy/3*b.hw,x=b.x+b.c*u-b.s*v,y=b.y+b.s*u+b.c*v,w=(b.z0+b.z1)/2+iz/3*(b.z1-b.z0)/2;
     if(w>=z&&inside(child,x,y,w)&&inside(parent,x,y,w))return true;
    }return false;
   };
   const raw={box:body.box.plushShape},neck=parts.find(q=>q.box.plushRole==='tail-neck'),eyes=parts.filter(q=>q.box.plushRole==='eye');
   for(const q of parts.filter(q=>['side-fin','dorsal-fin','tail-neck','eye'].includes(q.box.plushRole)))if(!joined(raw,q))bad.push(['detached',q.box.plushRole]);
   for(const q of parts.filter(q=>q.box.plushRole==='tail-fin'))if(!joined(neck,q))bad.push('tail detached');
   for(const q of parts.filter(q=>q.box.plushRole==='eye-glint'))if(!eyes.some(eye=>joined(eye,q)))bad.push('glint detached');
   out.push({bad,pieces:parts.length,kind:!!model.plushShark});
  }return out;
 });for(const q of results){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.ok(q.kind&&q.pieces===11);}
}));

test('the IDEA plush shark fits flush to a wall and stays supported when placed, saved and packed on a bed',()=>fixture(async p=>{
 await p.evaluate(()=>{money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();enterRoom('idea',{word:'IDEA',ret:room.ret},[9,3.8,-Math.PI/2]);render(0);});
 await p.keyboard.press('KeyE');await p.locator('[data-buy="sharkplush"]').click();await p.keyboard.press('KeyE');
 const placed=await p.evaluate(()=>{
  mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();held=inv.findIndex(q=>q.id==='sharkplush');px=4.1;py=4.45;a=-Math.PI/2;pitch=-.4;env(0);render(0);beginFurnishingPlacement(inv[held]);return furnishingCandidate();
 });assert.ok(placed.ok,JSON.stringify(placed));
 await p.keyboard.press('KeyE');
 const state=await p.evaluate(()=>{const q=homeFurnishings(homeRecord()).parts.find(q=>q.id==='sharkplush');saveGame();return q;});assert.ok(state.z>0,'toy should rest on the bed');
 await p.reload();await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();env(0);render(0);});
 const restored=await p.evaluate(()=>homeFurnishings(homeRecord()).parts.find(q=>q.id==='sharkplush'));assert.equal(restored.z,state.z);
 await p.keyboard.press('KeyF');await p.locator(`[data-pack="${state.key}"]`).click();assert.ok(await p.evaluate(()=>inv.some(q=>q.id==='sharkplush')&&!homeFurnishings(homeRecord()).parts.some(q=>q.id==='sharkplush')));
 await p.keyboard.press('KeyE');
 const flush=await p.evaluate(()=>{px=20.9;py=20;a=0;env(0);render(0);beginFurnishingPlacement(inv.find(q=>q.id==='sharkplush'));return furnishingCandidate();});
 assert.ok(flush.ok,JSON.stringify(flush));assert.ok(Math.abs(flush.x+.24-23)<1e-7);

}));


test('all four native home beds admit clear duvet placement while pillows, folds and edges are rejected; support geometry caches',()=>fixture(async p=>{
 const result=await p.evaluate(()=>['home','loft','bellehome','islandhome'].map(kind=>{
  room=makeRoom(kind);const bed=room.props.find(p=>p.furniture==='bed'),b=bed.box,base={id:'sharkplush',a:Math.atan2(b.s,b.c),z:0};
  const at=(u,v)=>({...base,x:b.x+b.c*u-b.s*v,y:b.y+b.s*u+b.c*v});
  const draw=bed.draw;let built=0;bed.draw=(...args)=>{built++;return draw(...args);};
  const before={...HIT};let top,pillow,fold,edge;
  try{top=homePlushBedSupport(at(0,b.hw*.45),bed);pillow=homePlushBedSupport(at(0,-b.hw*.66),bed);fold=homePlushBedSupport(at(0,-b.hw*.28+.045),bed);edge=homePlushBedSupport(at(b.hl,b.hw*.45),bed);homePlushBedSupport(at(0,b.hw*.45),bed);}finally{bed.draw=draw;}
  return{kind,top,pillow,fold,edge,built,hitRestored:JSON.stringify(HIT)===JSON.stringify(before)};
 }));
 for(const q of result){assert.ok(q.top>.3&&q.top<.85,JSON.stringify(q));assert.equal(q.pillow,null,q.kind);assert.equal(q.fold,null,q.kind);assert.equal(q.edge,null,q.kind);assert.equal(q.built,1,q.kind);assert.ok(q.hitRestored,JSON.stringify(q));}
}));
