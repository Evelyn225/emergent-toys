let furnishingPlacement=null,furnishingEl=null,photoLastT=-10;
function furnishingPanel() {
  if(furnishingEl)return furnishingEl;
  furnishingEl=panel('furnishings');
  const style=document.createElement('style');
  style.textContent=`#furnishings .carry-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #ffffff18}#furnishings .carry-row>span{flex:1 1 160px;min-width:0}#furnishings .carry-row>button{padding:7px 9px;min-height:36px;border:1px solid #ffffff35;color:#ddd;background:#ffffff08}#furnishings .carry-row>button[data-photo]{flex:1;text-align:left}#furnishings .carry-row>button:hover,#furnishings .carry-row>button:focus-visible{color:white;background:#ffffff20}#furnishings h2{margin-top:22px}`;
  document.head.appendChild(style);return furnishingEl;
}
const homeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function refreshFurnishedRoom() {
  const home=mode==='room'&&homeRecord(room);if(!home)return;
  homeBalconyModels.delete(home);
  // Keep constructor-added doors/surrounds and their live privacy state. Raw
  // figures include bodies; rebuilding must not revive or remove residents.
  const figures=room.props.filter(p=>p.fig);
  room.props=[...room.def.props(room).filter(p=>!p.fig),...(room.homeStructuralProps||[]),...figures,...workshopProps(room),...furnishingProps(room)];updateHomeLights();
}

function updateHomeLights() {
  if(mode!=='room'||!homeRecord(room))return;
  const home=homeRecord(room),lights=(room.def.lamps||[]).map((p,k)=>home.lights?.['fixed'+k]!==false);
  for(const p of homeFurnishings(home).parts)if(p.id==='f_lamp')lights.push(p.on);
  room.homeBaseLight??=room.def.light;
  room.def={...room.def,light:room.homeBaseLight*(.2+.8*(lights.filter(Boolean).length/Math.max(1,lights.length)))};
}
function homeFixtureTargets() {
  const home=mode==='room'&&homeRecord(room);if(!home)return [];
  const targets=(room.def.lamps||[]).map(([x,y],k)=>({kind:'fixed-lamp',key:'fixed'+k,x,y,z0:(room.def.height||3)-.8,z1:room.def.height||3,radius:.25,reach:3.2}));
  for(const part of homeFurnishings(home).parts) {
    const d=HOME_FURNITURE[part.id];if(d.fixture)targets.push({kind:d.fixture,part,key:part.key,x:part.x,y:part.y,z0:d.wall?part.z-.3:d.height-.4,z1:d.wall?part.z+.3:d.height,radius:Math.min(.35,d.hx),reach:2});
  }
  return targets;
}
function homeFixturePrompt(t) {
  const home=homeRecord(room),on=t.part?t.part.on:home?.lights?.[t.key]!==false;
  if(t.kind==='lamp'||t.kind==='fixed-lamp')return 'E: switch lamp '+(on?'off':'on');
  if(t.kind==='clock')return 'E: read clock · F: furnishings';
  if(t.kind==='record')return on?'E: stop record · F: furnishings':'E: play record · F: furnishings';
  return 'E: choose photograph · F: furnishings';
}
function homeFixtureUse(t) {
  const home=homeRecord(room);if(!home)return;
  if(t.kind==='clock')return say('The clock reads '+String(Math.floor(tod)).padStart(2,'0')+':'+String(Math.floor(fract(tod)*60)).padStart(2,'0')+'.',4);
  if(t.kind==='photo')return openHomePhotos(t.part);
  if(t.part)t.part.on=!t.part.on;
  else {home.lights||={};home.lights[t.key]=home.lights[t.key]===false;}
  updateHomeLights();saveGame();say(t.kind==='record'?(t.part.on?'The needle settles into the groove.':'You lift the needle.'):'Click.',2);
  if(actx)sfxUse('click');
}
function homeRecordAudio() {
  const home=mode==='room'&&homeRecord(room);if(!home)return null;
  const player=homeFurnishings(home).parts.filter(p=>p.id==='f_recordplayer'&&p.on).sort((a,b)=>near(px,py,a.x,a.y)-near(px,py,b.x,b.y))[0];
  if(!player)return null;
  // panned to its side, easing to the middle as you stand over it
  const d=near(px,py,player.x,player.y),side=soundDistanceProfile(player.x-px,player.y-py,0,a).pan*Math.min(1,d/1.5);
  return {song:['bossa','coffee','arcade'][player.track||0],gain:1/(1+(d/4)**2),pan:side};
}
function openHomeFurnishings() {
  const home=mode==='room'&&homeRecord(room);if(!home)return;
  furnishingPanel();
  const parts=homeFurnishings(home).parts;
  const packs=inv.map((it,k)=>HOME_FURNITURE[it.id]?`<button class="item" data-place="${k}">Unpack ${HOME_FURNITURE[it.id].name}</button>`:'').join('');
  showPanel(furnishingEl,`<h1>Home furnishings</h1><p class="sub">Buy flatpacks, lamps, frames and the plush shark at IDEA. Q with a flatpack also starts placement.</p>${packs||'<p>No flatpacks in your bag.</p>'}<h2>In the room</h2>${parts.map(p=>`<div class="carry-row"><span>${HOME_FURNITURE[p.id].name}</span><button data-move="${p.key}">Move</button><button data-pack="${p.key}">Pack</button>${p.id==='f_recordplayer'?`<button data-track="${p.key}">Next record</button>`:''}</div>`).join('')||'<p>No placed furnishings yet.</p>'}<h2>Photographs (${homePhotos.photos.length}/8)</h2><button class="item" data-album>Open album</button><p class="hint">E places · Q rotates · Esc cancels. Exit routes stay clear. F reopens this menu.</p>`);
  furnishingEl.onclick=e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.place!=null)return beginFurnishingPlacement(inv[+button.dataset.place]);
    const key=+(button.dataset.move??button.dataset.pack??button.dataset.track),part=parts.find(p=>p.key===key);
    if(button.hasAttribute('data-album'))return openHomePhotos();
    if(!part)return;
    if(button.dataset.move!=null)return beginFurnishingPlacement(null,part);
    if(button.dataset.pack!=null){if(inv.length>=INV_SIZE)return say('Your bag is full.',2);parts.splice(parts.indexOf(part),1);carryItem({id:part.id,uses:0,furnishing:{on:part.on,track:part.track,photo:part.photo}});refreshFurnishedRoom();}
    if(button.dataset.track!=null)part.track=((part.track||0)+1)%3;
    saveGame();openHomeFurnishings();
  };
}
function beginFurnishingPlacement(item,part=null) {
  const home=mode==='room'&&homeRecord(room);
  if(!home)return say('Unpack furniture inside a home you own.',3);
  if(homeFurnishings(home).parts.length>=48&&!part)return say('This home has room for 48 movable furnishings.',3);
  const id=part?.id||item?.id;if(!HOME_FURNITURE[id])return;
  if(workshopPlacement)endWorkshopPlacement();if(body.seat)standUp();hidePanel(furnishingEl);closeInventory();
  furnishingPlacement={home,id,item,part,a:part?.a||0,held};held=-1;lockMouse();
  say(HOME_FURNITURE[id].wall?'Look at a wall to hang it. E places; Esc cancels.':'Walk and look to position it. E places; Q rotates; Esc cancels.',5);
}
// Cache the authored bed pieces, then probe their actual top surfaces. The
// conservative bed box includes pillows, which are not a flat support plane.
const HOME_PLUSH_BEDS=new WeakMap();
function homePlushBedSupport(p,prop) {
 if(!furnishingOverlap(furnishingBox(p),prop.box))return null;
 let parts=HOME_PLUSH_BEDS.get(prop);
 if(!parts){parts=[];const draw=drawBox;drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{prop.draw(prop.x,prop.y);}finally{drawBox=draw;}HOME_PLUSH_BEDS.set(prop,parts);}
 const hit={...HIT};try{
 const b=furnishingBox(p),d=HOME_FURNITURE[p.id],heights=[];
 for(const u of [-d.hx,0,d.hx])for(const v of [-d.hy,0,d.hy]){
  const x=p.x+b.c*u-b.s*v,y=p.y+b.s*u+b.c*v;
  const height=Math.max(-Infinity,...parts.map(q=>{const t=q.ray(x,y,.9,0,0,-1,q.box);return t>.01?.9-t:-Infinity;}));
  if(!Number.isFinite(height))return null;heights.push(height);
 }
 const top=Math.max(...heights);
 if(top<.3||top>.85||Math.min(...heights)<top-.001||parts.some(q=>q.box.z1>top+.001&&furnishingOverlap(b,q.box,.003)))return null;
 return top;
 }finally{for(const key in HIT)if(!(key in hit))delete HIT[key];Object.assign(HIT,hit);}
}
function furnishingCandidate() {
  const q=furnishingPlacement;if(!q||homeRecord(room)!==q.home)return {ok:false,reason:'Return home.'};
  const d=HOME_FURNITURE[q.id],p={id:q.id,key:q.part?.key??-1,a:q.a,x:0,y:0,z:d.wall?1.6:0};
  if(d.wall) {
    let found=false,previous=[Math.floor(px),Math.floor(py)];
    for(let t=.05;t<=3;t+=.025) {
      const x=px+Math.cos(a)*t,y=py+Math.sin(a)*t,mx=Math.floor(x),my=Math.floor(y),cell=roomAt(mx,my);
      if(cell!=='.') {
        if(cell==='D')return {...p,ok:false,reason:'Keep doors clear.'};
        if(mx!==previous[0]){p.a=Math.cos(a)>0?Math.PI/2:-Math.PI/2;p.x=Math.cos(a)>0?mx-d.hy:mx+1+d.hy;p.y=y;}
        else {p.a=Math.sin(a)>0?Math.PI:0;p.y=Math.sin(a)>0?my-d.hy:my+1+d.hy;p.x=x;}
        p.z=clamp(eye+pitch*rows/projY*t,.65,(room.def.height||3)-.4);found=true;break;
      }
      previous=[mx,my];
    }
    if(!found)return {...p,ok:false,reason:'Look at a wall within three metres.'};
  }else {
    p.x=Math.round((px+Math.cos(a)*1.8)*10)/10;p.y=Math.round((py+Math.sin(a)*1.8)*10)/10;
    const hx=Math.abs(Math.cos(p.a))*d.hx+Math.abs(Math.sin(p.a))*d.hy,hy=Math.abs(Math.sin(p.a))*d.hx+Math.abs(Math.cos(p.a))*d.hy;
    for(const axis of ['x','y']) {
      const half=axis==='x'?hx:hy,limit=axis==='x'?room.W:room.H;
      if(Math.abs(p[axis]-half-1)<.3)p[axis]=1+half;
      if(Math.abs(p[axis]+half-(limit-1))<.3)p[axis]=limit-1-half;
    }
  }
  let support=null;
  if(d.plush) {
    p.z=0;const footprint=furnishingBox(p);
    for(const prop of room.props)if(prop.box&&!prop.walk&&prop.furnishingKey!==p.key) {
      const b=prop.box,height=b.z1;
      if(prop.furniture==='bed'){const top=homePlushBedSupport(p,prop);if(top!=null&&top>p.z){p.z=top;support=prop;}continue;}
      if(prop.draw&&prop.furnishingKey==null)continue;
      if(height>Math.max(.3,p.z)&&height<.85&&[-1,1].every(u=>[-1,1].every(v=>inBox(b,p.x+footprint.c*d.hx*u-footprint.s*d.hy*v,p.y+footprint.s*d.hx*u+footprint.c*d.hy*v,-.01)))){p.z=height;support=null;}
    }
  }
  const obstacles=support?room.props.map(o=>o===support?{...o,box:{...o.box,z1:p.z}}:o):room.props;
  let reason=furnishingFit(p,room.grid,obstacles);
  if(!reason&&!d.wall&&!d.rug) {
    const obstacle=furnishingBox(p),pass=extra=>(x,y)=>room.grid[y]?.[x]==='.'&&!room.props.some(o=>o.box&&!o.walk&&!(q.part&&o.furnishingKey===q.part.key)&&inBox(o.box,x+.5,y+.5,.1))&&(!extra||!inBox(extra,x+.5,y+.5,.1));
    const from={x:room.def.entry[0],y:room.def.entry[1]},world={width:room.W,height:room.H,wrap:false};
    for(const [x,y]of Object.values(room.def.spots||{}))if(findMapRoute(from,{x,y},world,pass(null))&&!findMapRoute(from,{x,y},world,pass(obstacle))){reason='Keep a walking route to the home amenities.';break;}
  }
  return {...p,ok:!reason,reason};
}
function cancelFurnishingPlacement() {if(!furnishingPlacement)return;held=furnishingPlacement.held<inv.length?furnishingPlacement.held:-1;furnishingPlacement=null;}
function confirmFurnishingPlacement() {
  const q=furnishingPlacement,p=furnishingCandidate();if(!p.ok)return say(p.reason,3);
  const state=homeFurnishings(q.home);
  if(q.part)Object.assign(q.part,{x:p.x,y:p.y,a:p.a,z:p.z});
  else {
    const index=inv.indexOf(q.item);if(index<0)return cancelFurnishingPlacement();removeInventoryAt(index);
    state.parts.push({key:state.next++,id:p.id,x:p.x,y:p.y,a:p.a,z:p.z,on:p.id!=='f_recordplayer',photo:0,track:0,...(furnishingItemState(q.item).furnishing||{})});
  }
  cancelFurnishingPlacement();refreshFurnishedRoom();saveGame();say('Placed. F: arrange furnishings.',3);
}
function homeFurnishingKey(e) {
  if(mode!=='room'||paused||game||sleep||!homeRecord(room))return false;
  if(furnishingPlacement) {
    if(e.code==='Escape'){cancelFurnishingPlacement();return true;}
    if(e.code==='KeyE'){if(!e.repeat)confirmFurnishingPlacement();return true;}
    if(e.code==='KeyQ'){if(!e.repeat)furnishingPlacement.a=mod(furnishingPlacement.a+Math.PI/2,TAU);return true;}
  }else if(e.code==='KeyF'&&!e.repeat){openHomeFurnishings();return true;}
  return false;
}
function drawFurnishingPreview() {
  if(!furnishingPlacement||mode!=='room')return;
  const p=furnishingCandidate(),b=furnishingBox(p);
  drawBox({...b,x:b.x-px,y:b.y-py},(i,t,L)=>{if(HIT.face<5&&fract(HIT.u*10)>.12&&fract(HIT.w*10)>.12)return false;set(i,p.ok?'+':'x',C(p.ok?GREEN:RED,14));return true;});
}
function takeHomePhoto() {
  if(T-photoLastT<.6)return;photoLastT=T;
  if(homePhotos.photos.length>=8)return say('Your album is full. F at home opens it; delete a photograph to make room.',4);
  const photo={id:homePhotos.next++,w:48,h:28,chars:'',fg:[],bg:[],title:mode==='room'?room.word||'Home':wildIslandAt(px,py)?.name||districtAt(px,py)||'City view'};
  for(let y=0;y<28;y++)for(let x=0;x<48;x++) {
    const i=Math.min(rows-1,Math.floor((y+.5)*rows/28))*cols+Math.min(cols-1,Math.floor((x+.5)*cols/48));
    photo.chars+=Array.from(CH[i]||' ')[0];photo.fg.push(COL[i]);photo.bg.push(BG[i]);
  }
  homePhotos.photos.push(photo);saveGame();if(actx)sfxUse('click');say(`Photograph ${photo.id} saved. Display it in a frame at home.`,3);
}
function openHomePhotos(part=null) {
  furnishingPanel();
  showPanel(furnishingEl,`<h1>${part?'Choose a photograph':'Photo album'}</h1><p class="sub">Use the compact camera with Q to capture your view. Eight photographs fit in the local album.</p>${homePhotos.photos.map(p=>`<div class="carry-row"><button data-photo="${p.id}">${p.id}: ${homeHtml(p.title)}</button><button data-delete-photo="${p.id}">Delete</button></div>`).join('')||'<p>No photographs yet.</p>'}<button data-photo="0">${part?'Leave frame empty':'Back to furnishings'}</button>`);
  furnishingEl.onclick=e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.deletePhoto!=null){homePhotos.photos=homePhotos.photos.filter(p=>p.id!==+button.dataset.deletePhoto);saveGame();return openHomePhotos(part);}if(button.dataset.photo!=null){if(part){part.photo=+button.dataset.photo;saveGame();hidePanel(furnishingEl);}else openHomeFurnishings();}};
}
function buildIdeaStore() {
  const place=Array.from(CITY_PLACES.values()).filter(p=>p.shop.word==='HARDWARE'&&p.shop.kind!==SHOP_SHUT).sort((a,b)=>a.x0-b.x0||a.y0-b.y0)[0];
  if(place){Object.assign(place.shop,{word:'IDEA',neon:BLUE,hours:[9,21]});}
}
ROOM_FOR.IDEA='idea';
ROOM_DEFS.idea={grid:boxRoom(18,14),entry:[9,12.4,-Math.PI/2],height:3.4,light:.9,floor:'fernwood',ceil:'idea',keeper:[9,2],
  wall:(i,u,us,z,d,mx,my,L)=>{BG[i]=C(z<.7?BLUE:WHITE,z<.7?2+L*.1:5+L*.15);if(my===0&&wallText(i,u,us,z,d,'IDEA',9,2.3,.4,.55,C(BLUE,12),C(YEL,8)))return true;set(i,' ',0);return true;},
  props:r=>[
    ...counterBox(9,2.8,1.7),standing(9,2,BLUE),
    ...[{id:'f_sofa',x:3,y:5,a:0},{id:'f_table',x:3,y:8,a:0},{id:'f_chair',x:3,y:10,a:0},{id:'f_recordplayer',x:9,y:5,a:0,on:true},{id:'f_lamp',x:10.3,y:5,a:0,on:true},{id:'f_plant',x:15,y:9,a:0},{id:'f_frame',x:16.965,y:6,a:Math.PI/2,z:1.8,photo:0},{id:'f_clock',x:16.96,y:3.8,a:Math.PI/2,z:2.1}].map((p,k)=>furnishingProp({...p,key:-100-k},r)),
    ...tableBox(14.3,5,.9,.4),ROOM_MODEL(14.3,5,(vx,vy)=>homePlushShark(vx,vy,1,0,.8)),
    ...[[3,5],[9,6],[14,5],[3,10],[9,10],[14,10]].map(([x,y],k)=>HOME_PENDANT(x,y,3.4,r,k)),
  ]};
ROOM_CEILS.idea=(i)=>{BG[i]=C(WHITE,5);set(i,' ',0);};
DENSE.camera=()=>sculpt(36,20,(x,y)=>{
  const dx=Math.max(Math.abs(x)-7,0),dy=Math.max(Math.abs(y)-3.6,0);
  if(Math.hypot(dx,dy)>1.5)return y>-6&&y<-4.9&&x>3&&x<6?['#',C(GRAY,9)]:null;
  const lens=Math.hypot(x-1.5,y);
  if(lens<3.3){if(lens>2.6)return ['#',C(GRAY,6+4*dSphere(x-1.5,y,3.3))];return ['#',C(x<1&&y<-1?WHITE:BLUE,x<1&&y<-1?11:2+3*dSphere(x-1.5,y,2.7))];}
  if(x<-4&&y<-1.8)return ['#',C(CYAN,4)];
  return ['#',C(GRAY,x>6?2:3+dLight(-.25,-.4,.8)*5)];
});
// Flatpacks keep their own silhouette in the bag and in the player's hands.
function heldFurnitureFlatpack(it) {
  return sculpt(64,26,(x,y)=>{
    const u=x+17,v=y+8;
    if(u<0||u>34)return null;
    const top=-u*.14,edge=top+5;
    if(v<top||v>edge+15)return null;
    const lid=v<edge,right=u>27,tape=Math.abs(u-16)<1.1;
    if(tape)return ['#',C(STONE,lid?9:7)];
    if(!lid&&!right&&u>3&&u<12&&v>edge+4&&v<edge+10){
      const icon=(Math.abs(u-7.5)<3.5&&Math.abs(v-edge-7)<.45)||(Math.abs(u-5)<.45&&v>edge+7)||(Math.abs(u-10)<.45&&v>edge+7);
      return [icon?'|':' ',C(BRICK,7)];
    }
    if(!lid&&!right&&u>19&&u<24&&v>edge+9&&v<edge+12)return ['|',C(BRICK,3)];
    return ['#',C(WARM,lid?8:right?4:6)];
  });
}
for(const id of Object.keys(HOME_FURNITURE))if(id.startsWith('f_'))DENSE[id]=heldFurnitureFlatpack;
