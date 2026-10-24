'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('doughnuts have a through-hole and a supported bottom; bento food fits inside recessed compartments',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,capture=fn=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{fn();}finally{drawBox=draw;}return out;};
  const ring=capture(()=>counterDonut(0,0,.7,0))[0],hit=(x,z,d)=>{const t=ring.ray(x,0,z,0,0,d,ring.box);return{t,z:z+t*d,n:HIT.nz};};
  const holes=[-.015,0,.015].map(x=>hit(x,2,-1)),top=hit(.046,2,-1),bottom=hit(.046,.5,1);
  const bento=capture(()=>counterBento(0,0,.7)),tray=bento.find(q=>q.ray===foodRayTray);
  const t=tray.ray(0,0,2,0,0,-1,tray.box),floor=2-t;
  const food=bento.filter(q=>q.ray===foodRayEllipsoid),contained=food.every(q=>Math.abs(q.box.x)+q.box.hl<.133&&Math.abs(q.box.y)+q.box.hw<.098&&Math.abs(q.box.z0-floor)<1e-6);
  return{holes,top,bottom,floor,food:food.length,contained};
 });
 assert.ok(r.holes.every(q=>q.t<0));assert.ok(Math.abs(r.top.z-.744)<1e-6&&r.top.n>.9);assert.ok(Math.abs(r.bottom.z-.7)<1e-6&&r.bottom.n<-.9);
 assert.ok(Math.abs(r.floor-.708)<1e-6&&r.food===4&&r.contained);
}));

test('all five food cases show real contents through the front and end panes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const original=counterCaseServing,out=[];
  for(const kind of ['chickenshop','kebabshop','bento','donutshop','bagelshop']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,4,0]);const model=room.props.find(o=>o.foodCase);room.props=[model];
   for(const side of ['front','end']){
    px=model.x+(side==='end'?model.foodCase.hl+.8:0);py=model.y+(side==='front'?1.15:0);a=side==='front'?-Math.PI/2:Math.PI;body.crouch=side==='end'?1:0;pitch=side==='front'?-.3:-.1;
    counterCaseServing=()=>{};render(0);const empty=BG.slice();counterCaseServing=original;render(0);
    let changed=0;for(let i=0;i<BG.length;i++)if(empty[i]!==BG[i])changed++;out.push({kind,side,changed});
   }
  }
  counterCaseServing=original;return out;
 });for(const q of r)assert.ok(q.changed>8,JSON.stringify(q));
}));

test('case shelves support every tray/tub and leave contents inside their measured cabinet',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];projX=10000;
  for(const [kind,expected]of [['chickenshop',5],['kebabshop',7],['bento',32],['donutshop',16],['bagelshop',16]]){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,4,0]);const model=room.props.find(o=>o.foodCase),m=model.foodCase,shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const servings=shapes.filter(q=>q.ray===foodRayTray||kind==='bagelshop'&&q.ray===coveRayLathe&&Math.abs(q.box.z1-q.box.z0-.055)<1e-6);
   const support=servings.every(q=>shapes.some(s=>{
    if(s.ray!==homeRayWorktop||Math.abs(s.box.z1-q.box.z0)>1e-6)return false;
    const t=s.ray(q.box.x,q.box.y,2,0,0,-1,s.box);return t>0&&Math.abs(2-t-q.box.z0)<1e-6;
   }));
   const mounted=m.levels.slice(1).every(level=>{
    const shelf=shapes.find(q=>q.ray===homeRayWorktop&&Math.abs(q.box.z1-level)<1e-6&&q.box.hl>m.hl-.02);
    return shelf&&[-1,1].every(a=>[-1,1].every(b=>shapes.some(q=>{
     const p=q.box;if(q.ray!==coveRayCapsule||Math.abs(p.ax-p.bx)>1e-8||Math.abs(p.ay-p.by)>1e-8)return false;
     return Math.hypot(shelf.box.x+a*shelf.box.hl-p.ax,shelf.box.y+b*shelf.box.hw-p.ay)<=p.r&&p.az<level-.0075&&p.bz>level-.0075;
    })));
   });
   const bounds=shapes.every(q=>Math.abs(q.box.x)+q.box.hl<=m.hl+.001&&Math.abs(q.box.y)+q.box.hw<=m.hw+.001&&q.box.z0>=0&&q.box.z1<=m.height+.013);
   out.push({kind,expected,servings:servings.length,support,mounted,bounds,levels:m.levels.length});
  }
  return out;
 });for(const q of r){assert.equal(q.servings,q.expected,JSON.stringify(q));assert.ok(q.support&&q.mounted&&q.bounds,JSON.stringify(q));assert.equal(q.levels,['bento','donutshop'].includes(q.kind)?2:1);}
}));

test('food case footprints stay unchanged and all five clerks still sell through real E input',()=>fixture(async p=>{
 for(const [kind,word,x,y,hl,hw,height]of [['chickenshop','CHICKEN',5.6,3.15,1.05,.3,1.35],['kebabshop','KEBAB',5.6,3.2,1.7,.32,1.15],['bento','BENTO',4.6,3.1,2,.35,1.05],['donutshop','DONUTS',5,3.15,1.9,.35,1.15],['bagelshop','BAGELS',5,3.15,1.9,.33,1.15]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const model=room.props.find(o=>o.foodCase),bad=[];
   for(const q of room.props.filter(q=>q.fig))if(inBox(model.box,q.x,q.y,.18))bad.push([q.x,q.y]);
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{bad,clear:free(px,py),prompt:promptText(),dimensions:[model.box.hl,model.box.hw,model.box.z1]};
  },{kind,word,x,y});
  assert.deepEqual(r.dimensions,[hl,hw,height]);assert.deepEqual(r.bad,[]);assert.ok(r.clear);assert.match(r.prompt,/E: shop$/,JSON.stringify({kind,...r}));
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
