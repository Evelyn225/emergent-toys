// Hollow elliptical profiles share their outer lip, inner wall and floor. The
// ray parameter stays in world units; normals use the inverse ellipse scale.
function bathroomRayOval(ox,oy,oz,rx,ry,rz,b) {
  const t=coveRayLathe((ox-b.x)/b.sx,(oy-b.y)/b.sy,oz,rx/b.sx,ry/b.sy,rz,b.lathe);
  if(t<0)return t;
  HIT.u*=b.sx;HIT.v*=b.sy;
  const nx=HIT.nx/b.sx,ny=HIT.ny/b.sy,nz=HIT.nz,n=Math.hypot(nx,ny,nz);
  HIT.nx=nx/n;HIT.ny=ny/n;HIT.nz=nz/n;HIT.face=HIT.nz>.9?5:HIT.nz<-.9?6:0;
  return t;
}
function bathroomOval(x,y,sx,sy,base,profile,shade) {
  const points=profile.map(([z,r])=>[base+z,r]),r=Math.max(...points.map(p=>p[1]));
  drawBox({...boxAt(x,y,1,0,sx*r,sy*r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),sx,sy,lathe:{x:0,y:0,profile:points}},shade,bathroomRayOval);
}
function bathroomPaint(i,t,L) { // matte painted joinery: doors, soffits
  BG[i]=C(WHITE,3.1+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function bathroomEnamel(i,t,L) {
  BG[i]=C(WHITE,3.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function bathroomPipe(ax,ay,az,bx,by,bz,r,base=GRAY) {
  // Bathroom fixtures are viewed from within arm's reach: keep the plumbing a
  // solid curved surface instead of changing it into line glyphs nearby.
  drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r},
    (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,base),coveRayCapsule);
}
function bathroomTap(x,y,fx,fy,z) {
  const at=(u,v,h)=>[x-fy*u+fx*v,y+fx*u+fy*v,z+h];
  const tube=(u,v,h,uu,vv,hh,r=.012)=>bathroomPipe(...at(u,v,h),...at(uu,vv,hh),r,GRAY);
  tube(0,-.19,0,0,-.19,.16);
  for(let k=0;k<6;k++) {
    const a=k*Math.PI/12,b=(k+1)*Math.PI/12;
    tube(0,-.14-.05*Math.cos(a),.16+.05*Math.sin(a),0,-.14-.05*Math.cos(b),.16+.05*Math.sin(b));
  }
  tube(0,-.14,.21,0,-.06,.21);tube(0,-.06,.21,0,-.06,.18);
  for(const side of [-1,1]) {
    tube(0,-.19,.075,side*.045,-.19,.075,.01);
    const [x0,y0,z0]=at(side*.045,-.19,.075);
    coveLathe(x0,y0,z0-.015,[[0,0],[0,.018],[.03,.018],[.03,0]],
      (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
  }
}
function bathroomMirrorMount(x,y,fx,fy) {
  for(let d=.2;d<=1;d+=.02) {
    const wx=x-fx*d,wy=y-fy*d,cx=Math.floor(wx),cy=Math.floor(wy),cell=room?.grid[cy]?.[cx];
    if(!cell||!'#W'.includes(cell))continue;
    const plane=fx>0?cx+1:fx<0?cx:fy>0?cy+1:cy;
    return {x:fx?plane+fx*.025:x,y:fy?plane+fy*.025:y,wall:true};
  }
  return {x:x-fx*.2,y:y-fy*.2,wall:false};
}
function BATHROOM_SINK(x,y,fx,fy) {
  let mirror;
  return furnitureModel(x,y,1,0,.24,.24,.86,(vx,vy)=>{
    coveLathe(vx,vy,0,[[0,0],[0,.09],[.025,.09],[.07,.07],[.59,.055],[.72,.095],[.735,0]],bathroomEnamel);
    bathroomOval(vx,vy,.22,.22,0,[[.72,0],[.72,.42],[.75,.72],[.82,.96],[.845,1],[.86,.96],[.86,.77],[.835,.74],[.775,.38],[.765,0]],bathroomEnamel);
    coveLathe(vx,vy,.765,[[0,0],[0,.023],[.002,.023],[.002,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
    bathroomTap(vx,vy,fx,fy,.86);
    mirror||=bathroomMirrorMount(x,y,fx,fy);
    const mx=vx+mirror.x-x,my=vy+mirror.y-y,c=-fy,s=fx;
    if(!mirror.wall)for(const side of [-1,1])bathroomPipe(mx+c*side*.16,my+s*side*.16,.84,mx+c*side*.16,my+s*side*.16,1.2,.012,GRAY);
    coveRound(mx,my,c,s,.25,.025,1.15,1.75,.018,GRAY);
    coveRound(mx+fx*.026,my+fy*.026,c,s,.222,.002,1.18,1.72,.001,(i,t,L)=>{
      const sheen=Math.exp(-(((HIT.u+.08*Math.sin(a))/.13+(HIT.w-1.45)*.8)**2));
      BG[i]=C(CYAN,2.3+L*.12+sheen*.8);set(i,' ',0);return true;
    });
  });
}
function BATHROOM_TOILET(x,y,back=-1,mat=steel) {
  const metal=mat===steel,finish=metal?(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY):bathroomEnamel;
  const cy=y+back*.3,by=y+back*.04;
  const cistern={...furnitureModel(x,cy,1,0,.24,.09,.82,(vx,vy)=>{
    coveRound(vx,vy,1,0,.23,.085,.48,.8,.025,finish);
    coveRound(vx,vy,1,0,.24,.09,.79,.82,.012,finish);
    bathroomPipe(vx,vy,.48,vx,vy,.31,.018,metal?GRAY:WHITE);
    bathroomPipe(vx,vy,.31,vx,vy-back*.16,.31,.018,metal?GRAY:WHITE);
    bathroomPipe(vx+.13,vy-back*.095,.7,vx+.19,vy-back*.095,.7,.012,GRAY);
  }),box:boxAt(x,cy,1,0,.24,.09,.3,.82)};
  const pedestal=furnitureModel(x,y+back*.02,1,0,.11,.13,.31,(vx,vy)=>{
    bathroomOval(vx,vy,.11,.13,0,[[0,0],[0,.9],[.025,1],[.11,.68],[.26,.58],[.31,.78],[.31,0]],finish);
  });
  const bowl={...furnitureModel(x,by,1,0,.21,.26,.42,(vx,vy)=>{
    bathroomOval(vx,vy,.21,.26,0,[[.28,0],[.28,.55],[.32,.72],[.37,.94],[.405,1],[.42,.97],[.42,.72],[.395,.68],[.32,.35],[.31,0]],finish);
    bathroomOval(vx,vy,.21,.26,.327,[[0,0],[0,.36],[.001,.36],[.001,0]],(i,t,L)=>{
      const swirl=T-flushT<2.5;
      BG[i]=C(BLUE,1.7+L*.13);
      const ripple=Math.sin(Math.atan2(HIT.v,HIT.u)*3-T*10)*Math.hypot(HIT.u,HIT.v);
      set(i,swirl&&ripple>.045?'~':' ',C(CYAN,L));return true;
    });
  }),box:boxAt(x,by,1,0,.21,.26,.28,.42),loo:[x,by]};
  return [cistern,pedestal,bowl];
}
function BATHROOM_TUB(x,y) {
  return {...furnitureModel(x,y,1,0,.42,1.04,.62,(vx,vy)=>{
    for(const u of [-.2,.2])for(const v of [-.5,.5])coveRound(vx+u,vy+v,1,0,.035,.045,0,.105,.015,GRAY);
    bathroomOval(vx,vy,.42,1.04,0,[[.08,0],[.08,.68],[.14,.82],[.3,.96],[.56,1],[.605,1],[.62,.985],[.62,.9],[.56,.87],[.24,.68],[.19,.57],[.18,0]],bathroomEnamel);
    coveLathe(vx,vy-.48,.187,[[0,0],[0,.025],[.003,.025],[.003,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
    bathroomTap(vx,vy-.8,0,1,.62);
  }),bath:true};
}

// A shallow, walk-in tray. Its rim stays below the room's 5 cm obstruction
// threshold; only the glass side has a full-height collision footprint.
function BATHROOM_SHOWER(x,y,halfWidth=.7) {
  const tray={...furnitureModel(x,y,1,0,halfWidth,.9,.047,(vx,vy)=>{
    coveRound(vx,vy,1,0,halfWidth,.9,.005,.047,.035,(i,t,L)=>{
      if(HIT.face===5&&Math.abs(HIT.u)<halfWidth-.065&&Math.abs(HIT.v)<.835)return false;
      return bathroomEnamel(i,t,L);
    });
    coveRound(vx,vy,1,0,halfWidth-.065,.835,.005,.013,.025,bathroomEnamel);
    coveLathe(vx,vy+.48,.013,[[0,0],[0,.065],[.003,.065],[.003,0]],(i,t,L)=>{
      coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
      if(HIT.face===5&&Math.abs(HIT.u)<.047&&fract(HIT.v/.018)<.25)BG[i]=C(GRAY,.6);
      return true;
    });
    // The controls, riser and head share the rear wall plane at y + .9.
    for(const z of [.95,1.8])bathroomPipe(vx,vy+.895,z,vx,vy+.84,z,.032);
    bathroomPipe(vx,vy+.84,.95,vx,vy+.84,1.98,.017);
    bathroomPipe(vx,vy+.84,1.98,vx,vy+.72,2.09,.017);
    bathroomPipe(vx,vy+.72,2.09,vx,vy+.49,2.09,.017);
    coveLathe(vx,vy+.49,2.035,[[0,0],[0,.1],[.018,.115],[.04,.08],[.055,0]],(i,t,L)=>{
      coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
      if(HIT.nz<-.8&&hash(Math.floor(HIT.u*120),Math.floor(HIT.v*120),7)>.6)BG[i]=C(GRAY,1);
      return true;
    });
    bathroomPipe(vx-.12,vy+.84,.98,vx+.12,vy+.84,.98,.028);
    for(const side of [-1,1])bathroomPipe(vx+side*.12,vy+.84,.98,vx+side*.12,vy+.77,.98,.023);
    coveRound(vx+.38,vy+.82,1,0,.19,.08,1.27,1.3,.012,GRAY);
    coveLathe(vx+.38,vy+.82,1.3,[[0,0],[0,.04],[.12,.04],[.13,.025],[.15,.025],[.15,0]],(i,t,L)=>{
      BG[i]=C(WHITE,3+L*.25);set(i,' ',0);return true;
    });
  }),shower:true,radius:1.2};
  const side={...furnitureModel(x-halfWidth+.02,y+.03,1,0,.02,.85,2.12,(vx,vy)=>{
    for(const v of [-.85,.85])bathroomPipe(vx,vy+v,.047,vx,vy+v,2.12,.018);
    for(const z of [.065,2.1])bathroomPipe(vx,vy-.85,z,vx,vy+.85,z,.018);
    // Clear glass keeps the plumbing/world visible; a broad, filtered glint
    // reads as glass without replacing everything behind it with a blue wall.
    drawBox(boxAt(vx,vy,1,0,.005,.83,.08,2.08),(i,t,L)=>{
      const band=Math.abs(HIT.v-.19-(HIT.w-1.1)*.14),width=Math.max(.024,t/projX);
      if(band>width||HIT.face!==1&&HIT.face!==2)return false;
      BG[i]=C(CYAN,2+L*.12);set(i,' ',0);return true;
    });
  }),box:boxAt(x-halfWidth+.02,y+.03,1,0,.02,.85,.047,2.12)};
  return [tray,side];
}

// Discover the real gaps in WC partitions. Both faces and the full wall depth
// use the same opening bounds; none of the new trim occupies walking space.
function bathroomOpenings(r) {
  const w=r.def.wc;if(!w)return [];
  const solid=(x,y)=>'#W'.includes(r.grid[y]?.[x]||' '),open=(x,y)=>r.grid[y]?.[x]==='.';
  const result=[];
  const scan=(cross,lo,hi,vertical)=>{
    for(let start=lo;start<hi;start++) {
      const cell=u=>vertical?[cross,u]:[u,cross];
      if(!open(...cell(start)))continue;
      let end=start+1;while(end<hi&&open(...cell(end)))end++;
      if(solid(...cell(start-1))&&solid(...cell(end))&&
        Array.from({length:end-start},(_,k)=>start+k).every(u=>vertical?open(cross-1,u)&&open(cross+1,u):open(u,cross-1)&&open(u,cross+1)))
        result.push({vertical,cross,start,end});
      start=end-1;
    }
  };
  scan(w.y0-1,w.x0,w.x1,false);scan(w.y1,w.x0,w.x1,false);
  scan(w.x0-1,w.y0,w.y1,true);scan(w.x1,w.y0,w.y1,true);
  return result;
}
function bathroomSurrounds(r) {
  const height=r.def.height||3;
  return bathroomOpenings(r).map(p=>{
    const {vertical,cross,start,end}=p,c=vertical?0:1,s=vertical?1:0,x=vertical?cross+.5:(start+end)/2,y=vertical?(start+end)/2:cross+.5,half=(end-start)/2;
    return {...ROOM_MODEL(x,y,(vx,vy)=>{
      const trim=(u,v,hl,hw,z0,z1)=>coveRound(vx+c*u-s*v,vy+s*u+c*v,c,s,hl,hw,z0,z1,.01,bathroomPaint);
      for(const side of [-1,1])trim(side*(half-.006),0,.006,.5,0,2.2); // (a liner proud of the jamb, never in its plane)
      // (the soffit is a flat box: a rounded marcher breaks up on so wide and thin a slab seen edge-on from below)
      drawBox(boxAt(vx,vy,c,s,half,.5,2.2,2.26),bathroomPaint);
      // Close above the opening instead of leaving a free-floating lintel.
      if(height>2.26)drawBox(boxAt(vx,vy,c,s,half,.5,2.26,height),solid(WHITE));
      for(const face of [-1,1]) {
        for(const side of [-1,1])trim(side*(half+.045),face*.516,.045,.016,0,2.3);
        trim(0,face*.516,half,.016,2.26,2.3);
      }
    }),box:boxAt(x,y,c,s,half,.5,2.2,height),bathroomOpening:p,radius:half+.8};
  });
}

// Pocket leaves slide into the partition; only the portion in the doorway is
// rendered/solid. Track, opaque leaf and collision all use the same opening.
function bathroomDoorBox(d,open=d.open) {
  const left=d.start+(d.end-d.start)*open,right=d.end;
  if(right-left<.005)return null;
  const u=(left+right)/2;
  return boxAt(d.vertical?d.cross+.5:u,d.vertical?u:d.cross+.5,d.vertical?0:1,d.vertical?1:0,(right-left)/2,.025,.04,2.16);
}
function BATHROOM_POCKET_DOOR(r,p,index) {
  const {vertical,cross,start,end}=p,width=end-start,c=vertical?0:1,s=vertical?1:0;
  const home=homeRecord(r),d={...p,index,home,open:home?.bathroomDoors?.[index]===false?0:1};
  d.target=d.open;
  const x=vertical?cross+.5:(start+end)/2,y=vertical?(start+end)/2:cross+.5;
  const prop={...ROOM_MODEL(x,y,(vx,vy)=>{
    const part=(u,v,hl,hw,z0,z1,shade)=>drawBox(boxAt(vx+c*u-s*v,vy+s*u+c*v,c,s,hl,hw,z0,z1),shade);
    const paint=(i,t,L)=>{BG[i]=C(WHITE,2.7+L*.22);set(i,' ',0);return true;};
    const trimPaint=(i,t,L)=>{BG[i]=C(WHITE,2.15+L*.2);set(i,' ',0);return true;};
    // The track is entirely ABOVE the leaf, never behind a translucent seam.
    part(0,0,width/2,.035,2.16,2.19,solid(GRAY));
    const box=bathroomDoorBox(d);
    if(box) {
      drawBox({...box,x:vx+box.x-x,y:vy+box.y-y},paint);
      const half=box.hl,offset=(box.x-x)*c+(box.y-y)*s;
      if(half>.12)for(const side of [-1,1]) {
        // Shallow, joined rails on each solid face. Nothing clips through the wall.
        for(const z of [.18,1.05,2.02])part(offset,side*.029,Math.max(.01,half-.06),.004,z,z+.025,trimPaint);
        for(const edge of [-1,1])part(offset+edge*(half-.05),side*.029,.018,.004,.18,2.045,trimPaint);
      }
    }
    // The recessed pull remains reachable at the pocket edge when fully open.
    const handle=-width/2+Math.min(d.open*width,width-.073)+.055;
    if(handle<width/2-.005)for(const side of [-1,1]) {
      part(handle,side*.03,.018,.006,.92,1.14,solid(GRAY));
      part(handle,side*.037,.008,.002,.95,1.11,solid(BLACK));
    }
  }),radius:width+.7,bathroomDoor:d};
  prop.box=bathroomDoorBox(d);d.prop=prop;return prop;
}
function bathroomDoorUse(prop) {
  const d=prop.bathroomDoor;d.target=d.target===1?0:1;
  if(d.home){d.home.bathroomDoors||=[];d.home.bathroomDoors[d.index]=d.target===1;saveGame();}
  if(actx){burst(actx.currentTime,.22,[filt('lowpass',1100)],.035);tone(actx.currentTime+.2,95,.035,.025);}
}
function stepBathroomDoors(dt) {
  if(mode!=='room'||!room.bathroomDoors)return;
  for(const prop of room.bathroomDoors) {
    const d=prop.bathroomDoor;
    if(d.target===0&&wanted.stars&&searchedRoom===room&&roomCops.some(c=>!c.dead&&Math.hypot(c.x-prop.x,c.y-prop.y)<1.5))bathroomDoorUse(prop);
    if(d.open===d.target)continue;
    const next=d.open+Math.sign(d.target-d.open)*Math.min(Math.abs(d.target-d.open),dt*1.7/(d.end-d.start)),box=bathroomDoorBox(d,next);
    if(next<d.open&&box&&(inBox(box,px,py,.23)||room.props.some(p=>isRoomPerson(p)&&!p.dead&&inBox(box,p.x,p.y,.23)))) {
      d.target=1;if(d.home){d.home.bathroomDoors||=[];d.home.bathroomDoors[d.index]=true;saveGame();}say('Give the sliding door room to close.',2);continue;
    }
    d.open=next;prop.box=box;
  }
}
