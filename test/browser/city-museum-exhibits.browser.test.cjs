'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);museumStolen={};enterRoom('museum',{...MUSEUM.sh,ret:[100,100,0]},[12.5,16.2,-Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('the T. rex is one joined skeleton standing on its plinth, inside its footprint, and the plinth alone is the collider',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(q=>q.museumRex),{parts}=o.museumRex,{top,hl,hw}=MUSEUM_REX,same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<1e-9;
  const ends=q=>[[q.box.ax,q.box.ay,q.box.az],[q.box.bx,q.box.by,q.box.bz]],tubes=role=>parts.filter(q=>q.role===role);
  if(o.x!==12.5||o.y!==12||o.box.z1!==top||o.box.hl!==hl||o.box.hw!==hw)bad.push('plinth collider changed');
  const spine=tubes('spine');for(let k=1;k<spine.length;k++)if(!same(ends(spine[k-1])[1],ends(spine[k])[0]))bad.push('spine break at '+k);
  if(!same(ends(tubes('neck')[0])[0],ends(spine.at(-1))[1]))bad.push('neck off the spine');
  const skull=parts.find(q=>q.role==='skull').box,neck=ends(tubes('neck')[0])[1];
  if(neck[0]<skull.x-skull.hl||neck[0]>skull.x+skull.hl||neck[2]<skull.z0||neck[2]>skull.z1)bad.push('neck misses the skull');
  const hinge=ends(tubes('jaw-hinge')[0]),jaw=parts.find(q=>q.role==='jaw').box;
  if(hinge[0][2]!==skull.z0||hinge[1][2]>jaw.z1)bad.push('jaw not hinged');
  const ribs=tubes('rib');if(ribs.length!==24)bad.push('ribs '+ribs.length);
  for(const q of ribs.filter((_,k)=>k%2===0))if(Math.abs(ends(q)[0][2]-museumRexSpineZ(ends(q)[0][0]))>1e-9||ends(q)[0][1]!==0)bad.push('rib off the spine');
  for(let k=0;k<2;k++){
   const f=tubes('femur')[k],s=tubes('shin')[k],t=tubes('foot')[k],toe=tubes('toes')[k];
   if(!same(ends(f)[1],ends(s)[0])||!same(ends(s)[1],ends(t)[0])||!same(ends(t)[1],ends(toe)[0]))bad.push('leg break');
   if(Math.abs(ends(toe)[0][2]-toe.box.r-top)>1e-9)bad.push('foot off the plinth');
   const pelvis=parts.find(q=>q.role==='pelvis').box,hip=ends(f)[0];if(Math.abs(hip[0]-pelvis.x)>pelvis.hl||Math.abs(hip[1])>pelvis.hw+f.box.r||hip[2]<pelvis.z0||hip[2]>pelvis.z1)bad.push('femur misses the pelvis');
  }
  for(const q of tubes('armature')){const [a,b]=ends(q);if(a[2]!==top||Math.abs(b[2]-museumRexSpineZ(b[0]))>1e-9)bad.push('armature not plinth to spine');}
  for(const q of parts){const b=q.box;if(Math.abs(b.x)+b.hl>hl+1e-9||Math.abs(b.y)+b.hw>hw+1e-9)bad.push(['outside the plinth',q.role]);if(b.z1>room.def.height-.3)bad.push(['into the ceiling',q.role]);}
  const shade=parts.find(q=>q.role==='spine').shade;HIT.nx=0;HIT.ny=0;HIT.nz=1;shade(0,2,8);if(CH[0]!==' ')bad.push('bone glyph');const day=BG[0]&15;
  // old sprites are gone
  if(room.props.some(q=>q.art))bad.push('sprites left: '+room.props.filter(q=>q.art).length);
  room.burgled=true;shade(0,2,8);if((BG[0]&15)>=day)bad.push('bone glows at night');room.burgled=false;
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('Anubis and the sarcophagus: grounded, inside their colliders, off the wall, with plaques in reach and hiding rules unchanged',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],s=room.props.find(q=>q.museumSarcophagus),a_=room.props.find(q=>q.museumAnubis);
  if(s.box.z1!==.85||s.box.hl!==1.1||s.box.hw!==.5||s.x!==3.5||s.y!==6)bad.push('sarcophagus collider changed');
  const sp=s.museumSarcophagus.parts,by=role=>sp.find(q=>q.role===role).box;
  if(by('plinth').z0!==0||by('chest').z0!==by('plinth').z1||by('lid').z0!==by('chest').z1||by('mask').z0!==by('lid').z1)bad.push('stack gap');
  if(Math.max(...sp.map(q=>q.box.z1))>.85+1e-9)bad.push('above its collider');
  const ap=a_.museumAnubis.parts,top=Math.max(...ap.map(q=>q.box.z1));
  if(Math.abs(top-a_.box.z1)>1e-9)bad.push('Anubis collider height');if(a_.y-a_.box.hw<1)bad.push('Anubis in the wall');
  const part=role=>ap.find(q=>q.role===role).box;
  if(part('plinth').z0!==0)bad.push('Anubis off the floor');
  for(const q of ap.filter(q=>q.role==='leg'))if(Math.min(q.box.az,q.box.bz)!==part('plinth').z1||Math.max(q.box.az,q.box.bz)<part('kilt').z0)bad.push('leg not plinth to kilt');
  if(part('kilt').z1!==part('torso').z0||part('collar').z1!==part('head').z0)bad.push('Anubis stack gap');
  for(const q of ap.filter(q=>q.role==='ear'))if(q.box.z0!==part('head').z1)bad.push('ear off the head');
  if(part('snout').y-part('snout').hw>part('head').y+part('head').hw)bad.push('snout off the head');
  for(const q of ap.filter(q=>q.role==='eye'))if(q.box.y-q.box.hw>part('head').y+part('head').hw+1e-9)bad.push('eye off the head');
  // the plaques still answer, and you can walk up to them
  const near=(x,y)=>{px=x;py=y;return museumSpot()?.text||'';};
  if(!free(3.5,7)||!/SARCOPHAGUS/.test(near(3.5,7)))bad.push('sarcophagus plaque');
  if(!free(5.5,2.2)||!/ANUBIS/.test(near(5.5,2.2)))bad.push('Anubis plaque');
  if(!free(12.5,13.3)||!/TYRANNOSAURUS/.test(near(12.5,13.3)))bad.push('rex plaque');
  // hiding: neither the rex's plinth nor a standing height case hides you, as before
  // the guards' sight check only runs at night, with no ceiling lights in the room
  enterRoom('museum',{...MUSEUM.sh,ret:[100,100,0],line:'',burgled:true,light:.28,loot:0},[12.5,10.5,-Math.PI/2]);
  room.props=room.props.filter(q=>!q.fig);
  body.crouch=0;px=12.5;py=14;const g={x:12.5,y:10};if(hiddenBehind(g))bad.push('plinth hides you standing');
  body.crouch=1;px=3.5;py=7.2;if(!hiddenBehind({x:3.5,y:4.8}))bad.push('sarcophagus no longer hides you crouched');body.crouch=0;
  px=3.5;py=7.2;if(hiddenBehind({x:3.5,y:4.8}))bad.push('sarcophagus hides you standing');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('cases: each piece sits on its pedestal inside clear glass, ropes hang joined between stanchions, the orrery turns and a theft takes the glass and the piece',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],peds=room.props.filter(q=>q.museumPedestal),glass=room.props.filter(q=>q.museumCase),ropes=room.props.filter(q=>q.museumRopes);
  if(peds.length!==2||glass.length!==2||ropes.length!==2)bad.push(['counts',peds.length,glass.length,ropes.length]);
  const {hw,z0,z1}=MUSEUM_CASE;
  for(const o of peds)if(o.box.z1!==z0||o.box.hl!==.45||Math.max(...o.museumPedestal.parts.map(q=>q.box.z1))!==z0)bad.push('pedestal height');
  for(const o of glass){
   if(o.box.z0!==z0||o.box.z1!==z1||o.box.hl!==hw)bad.push('glass box');
   if(o.museumCase.parts.length!==12)bad.push('edges '+o.museumCase.parts.length);
  }
  const star=room.props.find(q=>q.exhibit==='diamond'&&q.museumExhibit),orr=room.props.find(q=>q.exhibit==='orrery'&&q.museumExhibit);
  const cush=star.museumExhibit.parts.find(q=>q.role==='cushion').box,stone=star.museumExhibit.parts.find(q=>q.role==='stone').box;
  if(cush.z0!==z0||Math.abs(stone.z0-cush.z1)>1e-9)bad.push('star not seated');
  for(const q of star.museumExhibit.parts)if(Math.abs(q.box.x)+q.box.hl>hw||Math.abs(q.box.y)+q.box.hw>hw||q.box.z1>z1)bad.push('star outside the glass');
  const foot=orr.museumExhibit.parts.find(q=>q.role==='foot').box;if(foot.z0!==z0)bad.push('orrery off the pedestal');
  const seen=(t)=>{const list=[],draw=drawBox,keep=T;T=t;drawBox=(b,s,ray)=>list.push({...b});try{orr.draw(0,0);}finally{drawBox=draw;T=keep;}return list;};
  const a0=seen(10),a1=seen(40);if(JSON.stringify(a0)===JSON.stringify(a1))bad.push('orrery does not turn');
  for(const b of [...a0,...a1])if(Math.abs(b.x??0)+(b.hl??0)>hw+1e-9||Math.abs(b.y??0)+(b.hw??0)>hw+1e-9||b.z1>z1+1e-9)bad.push('orrery leaves its glass');
  const R=ropes[0].museumRopes.parts,posts=R.filter(q=>q.role==='stanchion'),rope=R.filter(q=>q.role==='rope');
  if(posts.length!==4||rope.length!==16)bad.push('rope counts');
  for(const q of posts)if(q.box.z0!==0)bad.push('stanchion off the floor');
  for(let k=0;k<rope.length;k++){const q=rope[k].box,next=rope[(k+1)%rope.length].box;if(k%4!==3&&Math.hypot(q.bx-next.ax,q.by-next.ay,q.bz-next.az)>1e-9)bad.push('rope break at '+k);}
  const low=Math.min(...rope.map(q=>Math.min(q.box.az,q.box.bz)));if(low>=MUSEUM_ROPE.top-.05||low<.5)bad.push('rope sag '+low);
  for(const k of [0,4,8,12]){const q=rope[k].box;if(!posts.some(s=>Math.hypot(s.box.x-q.ax,s.box.y-q.ay)<1e-9&&Math.abs(q.az-MUSEUM_ROPE.top)<1e-9))bad.push('rope not on its stanchion');}
  if(rope[0].ray!==hotelCurtainRodRay)bad.push('rope breaks up at distance');
  // the old stanchion and gem sprites are gone, and a theft removes the piece and the glass
  room.props=room.props.filter(q=>q.exhibit!=='diamond');
  if(room.props.some(q=>q.exhibit==='diamond'))bad.push('still there');
  museumStolen.diamond=true;enterRoom('museum',{...MUSEUM.sh,ret:[100,100,0]},[12.5,16.2,-Math.PI/2]);
  const card=room.props.find(q=>q.museumStolenCard);if(!card||card.x!==CASES[0].x||card.museumStolenCard.parts[0].box.z0!==z0)bad.push('stolen card');
  if(room.props.some(q=>q.exhibit==='diamond'))bad.push('stolen piece came back');
  if(!room.props.some(q=>q.museumPedestal&&q.x===CASES[0].x))bad.push('pedestal gone after a theft');
  museumStolen={};
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
