// The ocean changes surface, not geography: piers, bridges and inland lakes keep
// their normal collision. Snowy weather in another season does not freeze it.
const oceanFrozen = () => season() === 'winter';
const oceanIceAt = (x,y) => oceanFrozen() && seaAt(x,y) && isWater(x,y);
const iceSkatesOn = () => mode === 'walk' && fx.iceSkating && inv.some(it=>it.id==='iceskates');
let iceShore = null;
const ICE_TRACK_LIFE=16,ICE_TRACK_LIMIT=160,iceTracks=[],iceTrackCells=new Map();
let iceTraceFrom=null;
const iceTrackKey=(x,y)=>(Math.floor(x*2)+16384)*32768+Math.floor(y*2)+16384;
function trimIceTracks() {
  while(iceTracks.length&&(!oceanFrozen()||iceTracks.length>ICE_TRACK_LIMIT||T-iceTracks[0].t>ICE_TRACK_LIFE)) {
    const old=iceTracks.shift();
    for(const key of old.cells) {
      const list=iceTrackCells.get(key),at=list.indexOf(old);list.splice(at,1);
      if(!list.length)iceTrackCells.delete(key);
    }
  }
}
function traceIceBlades(x,y) {
  if(!iceSkatesOn()||body.z>0||body.vz>0||!oceanIceAt(px,py)){iceTraceFrom=null;return;}
  if(!iceTraceFrom||Math.hypot(rel(x-iceTraceFrom.lastX),rel(y-iceTraceFrom.lastY))>.05)
    iceTraceFrom={x,y,lastX:x,lastY:y};
  iceTraceFrom.lastX=px;iceTraceFrom.lastY=py;
  x=iceTraceFrom.x;y=iceTraceFrom.y;
  const ex=rel(px-x),ey=rel(py-y),d=Math.hypot(ex,ey);
  if(d<.04)return; // resting blades and high frame rates do not fill the trail budget
  iceTraceFrom.x=px;iceTraceFrom.y=py;
  const nx=-ey/d,ny=ex/d;
  for(const side of [-1,1]) {
    const offset=side*.012,track={x:x+nx*offset,y:y+ny*offset,ex,ey,d2:d*d,t:T,brake:!!K.KeyC,cells:[]};
    for(let gx=Math.floor((Math.min(track.x,track.x+ex)-.012)*2);gx<=Math.floor((Math.max(track.x,track.x+ex)+.012)*2);gx++)
      for(let gy=Math.floor((Math.min(track.y,track.y+ey)-.012)*2);gy<=Math.floor((Math.max(track.y,track.y+ey)+.012)*2);gy++) {
        const key=(gx+16384)*32768+gy+16384;
        if(!iceTrackCells.has(key))iceTrackCells.set(key,[]);
        iceTrackCells.get(key).push(track);track.cells.push(key);
      }
    iceTracks.push(track);
  }
  trimIceTracks();
}
function iceBladeMark(x,y,foot) {
  const list=iceTrackCells.get(iceTrackKey(x,y));if(!list)return 0;
  let mark=0;
  for(const p of list) {
    const u=clamp(((x-p.x)*p.ex+(y-p.y)*p.ey)/p.d2,0,1),d=Math.hypot(x-p.x-p.ex*u,y-p.y-p.ey*u);
    const width=p.brake?.008:.0025;
    mark=Math.max(mark,clamp((width-d)/Math.max(.002,foot)+.5,0,1)*(1-(T-p.t)/ICE_TRACK_LIFE));
  }
  return mark;
}

function winterSkateShops() {
  if(!oceanFrozen())return [];
  return [
    {x:MARINA.x+1,y:MARINA.fingers[0]-1.2,name:'JETTY ICE SKATES'},
    {x:MARINA.x-1,y:MARINA.fingers[1]+1.2,name:'FROST & GLIDE'}
  ];
}
const nearWinterSkateShop = () => mode==='walk' ? winterSkateShops().find(s=>Math.hypot(rel(px-s.x),rel(py-s.y))<.65) : null;
const winterShopBlocked = (x,y,pad=.03) => winterSkateShops().some(s=>Math.abs(rel(x-s.x))<.3+pad&&Math.abs(rel(y-s.y))<.16+pad);
function winterIcePrompt() {
  const shop=nearWinterSkateShop();
  const lace=mode==='walk'&&heldItem()?.id==='iceskates'&&!iceSkatesOn();
  if(shop)return `E: ${shop.name.toLowerCase()} · ice skates ${fmt$(ITEMS.iceskates.price)}${lace?' | Q: lace up':''}`;
  if(lace)return 'Q: lace up your ice skates · glide, carve and brake on winter ice';
  if(mode!=='walk'||!oceanIceAt(px,py))return '';
  return iceSkatesOn()?'ICE SKATING · WASD: push / carve | Shift: sprint | C: brake | Space: jump':'SLIPPERY ICE · walk carefully · winter skate shops beside the marina jetty';
}
// Acceleration follows the camera, but velocity takes time to turn. Releasing
// input coasts; opposite input scrubs speed before pushing in the new direction.
function stepIceMotion(f,s,run,dt) {
  if(dt<=0)return;
  const skates=iceSkatesOn(),brake=!!K.KeyC,cx=Math.cos(a),cy=Math.sin(a);
  const wx=cx*f-cy*s,wy=cy*f+cx*s,input=Math.hypot(f,s);
  let vx=body.mx||0,vy=body.my||0;
  const drag=brake?(skates?5.5:2.8):(skates?.16:.7),decay=Math.exp(-drag*dt);
  vx*=decay;vy*=decay;
  if(input&&!brake) {
    const acc=skates?(run?1.65:1.15):.65;
    vx+=wx*acc*dt;vy+=wy*acc*dt;
    if(skates) {
      // Blades carve a broad arc while retaining speed through a gentle turn.
      const speed=Math.hypot(vx,vy),yaw=Math.atan2(vy,vx),wish=Math.atan2(wy,wx);
      const turn=clamp(mod(wish-yaw+Math.PI,TAU)-Math.PI,-1.6*dt,1.6*dt);
      vx=Math.cos(yaw+turn)*speed;vy=Math.sin(yaw+turn)*speed;
    }
  }
  const speed=Math.hypot(vx,vy),cap=skates?(run?2.8:1.9):(run?.8:.5);
  if(speed>cap){const limit=Math.max(cap,speed-2*dt);vx*=limit/speed;vy*=limit/speed;}
  body.mx=vx;body.my=vy;body.hop=1;
}
function moveOnIce(dt) {
  // Small swept steps keep a fast glide from skipping a thin jetty or seawall.
  const startX=px,startY=py,n=Math.max(1,Math.ceil(Math.hypot(body.mx||0,body.my||0)*dt/.025));
  for(let k=0;k<n;k++) {
    const x=px,y=py,dx=body.mx*dt/n,dy=body.my*dt/n;
    move(dx,dy);
    if(Math.abs(rel(px-x))<Math.abs(dx)*.1)body.mx=0;
    if(Math.abs(rel(py-y))<Math.abs(dy)*.1)body.my=0;
  }
  traceIceBlades(startX,startY);
}
function stepWinterOcean() {
  trimIceTracks();
  if(!oceanFrozen()||mode!=='walk'||body.z>0||!iceSkatesOn())iceTraceFrom=null;
  if(fx.iceSkating&&!inv.some(it=>it.id==='iceskates'))fx.iceSkating=false;
  if(mode!=='walk')return;
  if(!isWater(px,py)) {
    if(dryLand(px,py))iceShore=[px,py];
    return;
  }
  if(oceanFrozen()||!seaAt(px,py))return;
  // Thawing, including a loaded save or an orrery turn, must never leave a
  // pedestrian stranded on liquid water. Prefer the shore they stepped off.
  let shore=iceShore&&dryLand(...iceShore)?iceShore:null;
  for(let radius=.5;!shore&&radius<=32;radius+=.5) {
    const n=Math.ceil(TAU*radius/.5);
    for(let k=0;k<n;k++) {
      const x=worldCoord(px+Math.cos(k*TAU/n)*radius),y=worldCoord(py+Math.sin(k*TAU/n)*radius);
      if(dryLand(x,y)){shore=[x,y];break;}
    }
  }
  [px,py]=shore||[MARINA.x,MARINA.y0];body.mx=body.my=body.z=body.vz=0;body.seat=null;
  say('The winter ice thaws. You make it safely back to shore.',4);
}
