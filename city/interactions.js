// E and its prompt resolve the same visible target before proximity fallbacks.
// Rooms use metres; the outdoor world uses ten-metre cells.
function interactionEye() {
  if(mode==='room')return 1.7+stairRise(px,py)+eyeLift();
  if(mode==='roof')return roofH+.17+eyeLift()*.1;
  if(mode==='walk')return .17+walkGround(px,py)+eyeLift()*.1;
  return eye;
}
function interactionClear(x,y,z,ignore=null) {
  const eye=interactionEye();
  const inside=mode==='room',ex=inside?x-px:rel(x-px),ey=inside?y-py:rel(y-py),ez=z-eye;
  const n=Math.max(2,Math.ceil(Math.hypot(ex,ey)/(inside?.07:.012)));
  for(let k=1;k<n;k++) {
    const f=k/n,xx=px+ex*f,yy=py+ey*f,zz=eye+ez*f;
    const h=inside?ROOMW.cell(Math.floor(xx),Math.floor(yy)):CITY.cell(Math.floor(xx),Math.floor(yy));
    if(h>zz+.015)return false;
    if(!inside&&terrainHeight(xx,yy)>zz+.003)return false;
  }
  if(!inside)for(let by=-1;by<=1;by++)for(let bx=-1;bx<=1;bx++)for(const solid of solidsB[bi(Math.floor(px/8)+bx,Math.floor(py/8)+by)]) {
    const sx=rel(solid.x-px),sy=rel(solid.y-py);
    if(Math.hypot(sx,sy)>Math.hypot(ex,ey)+solid.hl+solid.hw)continue;
    const saved={...HIT};let t;
    try{t=rayBox(0,0,eye,ex,ey,ez,{...solid,x:sx,y:sy});}finally{Object.assign(HIT,saved);}
    if(t>.01&&t<.98)return false;
  }
  if(inside) {
    const saved={...HIT};let clear=true;
    try {
      for(const prop of room.props)if(prop!==ignore&&!(ignore&&prop.furnishingKey===ignore.key)&&prop.box&&!prop.walk&&!prop.shotPermeable) {
        const t=rayBox(px,py,eye,ex,ey,ez,prop.box);
        if(t>.01&&t<.98){clear=false;break;}
      }
    }finally{Object.assign(HIT,saved);}
    if(!clear)return false;
  }
  return true;
}
function interactionScore(x,y,z0,z1,radius,reach,ignore=null,strict=false) {
  const eye=interactionEye();
  const inside=mode==='room',ex=inside?x-px:rel(x-px),ey=inside?y-py:rel(y-py),d=Math.hypot(ex,ey);
  if(d>reach)return Infinity;
  const forward=ex*Math.cos(a)+ey*Math.sin(a),side=-ex*Math.sin(a)+ey*Math.cos(a);
  if(forward<-.01)return Infinity;
  const slope=pitch*rows/projY,aimZ=eye+slope*Math.max(.01,forward),z=clamp(aimZ,z0,z1);
  const horizontal=Math.max(0,Math.abs(Math.atan2(side,Math.max(.001,forward)))-Math.atan2(radius,Math.max(.001,d)));
  const vertical=Math.abs(Math.atan2(z-eye,Math.max(.001,d))-Math.atan(slope));
  if(horizontal>(strict?.12:.23)||vertical>(strict?.12:.32)||!interactionClear(x,y,z,ignore))return Infinity;
  return horizontal*horizontal+vertical*vertical*.7+.012*d/reach;
}
function interactionFocus() {
  if(!['walk','room','roof'].includes(mode)||sleep||freecam||wanted.busted||mode==='room'&&room.kind==='train'||mode==='walk'&&elWalkGround(px,py)>EL_TREAD)return null;
  const inside=mode==='room',unit=inside?1:.1;
  let best=null,score=Infinity;
  const offer=(kind,who,x,y,z0,z1,radius,reach,ignore=null,strict=false)=>{
    const value=interactionScore(x,y,z0,z1,radius,reach,ignore,strict);
    if(value<score){score=value;best={kind,who};}
  };
  const at=placeKey();
  if(at!==null)for(const d of dropped)if(d.at===at&&Math.abs((d.z||0)-(inside?0:mode==='roof'?roofH:outdoorGroundHeight(px,py)))<.08) {
    const z=d.displayZ??(inside?0:d.z||0);
    offer('drop',d,d.x,d.y,z,z+.2*unit,.16*unit,inside?1.6:.28);
  }
  if(inside) {
    for(const prop of room.bathroomDoors||[]){
      const d=prop.bathroomDoor,c=d.vertical?0:1,s=d.vertical?1:0,width=d.end-d.start;
      const offset=d.open>.85?width/2-.06:width*d.open/2;
      offer('bathroom-door',prop,prop.x+c*offset,prop.y+s*offset,.4,2.1,d.open>.85?.12:Math.min(.45,width*(1-d.open)/2),2.2,prop);
    }
    for(const t of homeFixtureTargets())offer('home-fixture',t,t.x,t.y,t.z0,t.z1,t.radius,t.reach,t.part,true);
    const keeper=room.def.keeper;
    for(const p of room.props)if(isRoomPerson(p)&&!(keeper&&Math.hypot(p.x-keeper[0],p.y-keeper[1])<.12)) {
      const seated=typeof p.pose==='string'&&p.pose.startsWith('sit');
      offer(p.service?'service':'room-person',p,p.x,p.y,.3,seated?(p.seatZ??.45)+1.05:1.8,.28,1.8);
    }
    if(keeper&&!room.keeperDead)offer('keeper',keeper,...keeper,.7,1.8,.28,2);
  }else if(mode==='walk') {
    for(const p of [...people,...fairFolk])if(!p.hidden&&!p.dead&&!p.flee&&!p.down) {
      if(near(px,py,p.x,p.y)>.45)continue;
      const ground=walkGround(p.x,p.y);
      offer('person',p,p.x,p.y,ground+.03,ground+.18,.035,.45);
    }
  }
  return best;
}
function focusedInteractionPrompt(target=interactionFocus()) {
  if(target?.kind==='bathroom-door')return target.who.bathroomDoor.target===1?'E: close bathroom door':'E: open bathroom door';
  if(target?.kind==='home-fixture')return homeFixturePrompt(target.who);
  if(target?.kind==='drop')return `E: pick up the ${itemName(target.who)}`;
  if(target?.kind==='person'||target?.kind==='room-person'&&!target.who.cabbie)return 'E: talk';
  return '';
}
function useFocusedInteraction(target=interactionFocus()) {
  if(target?.kind==='bathroom-door'){bathroomDoorUse(target.who);return true;}
  if(target?.kind==='home-fixture'){homeFixtureUse(target.who);return true;}
  if(target?.kind==='drop'){say(pickUpDropped(target.who)[1]);return true;}
  if(target?.kind==='person'){talkTo(target.who);return true;}
  if(target?.kind==='room-person'&&!target.who.cabbie){talkInRoom();return true;}
  return false;
}
