// Home light fittings share closed profiles, an actual bulb/socket and an open
// shade. Profiles and materials are prepared once, outside the drawing loop.
const HOME_LAMP_BULB=[[0,0],[0,.014],[.018,.014],[.032,.030],[.050,.040],[.075,.037],[.094,.022],[.103,0]];
const HOME_LAMP_FABRIC=[[0,.229],[0,.238],[.012,.238],[.408,.140],[.420,.132],[.420,.123],[.408,.131],[.012,.229],[0,.229]];
const HOME_LAMP_ENAMEL=[[0,.238],[0,.250],[.012,.250],[.190,.065],[.210,.055],[.210,.038],[.190,.053],[.012,.238],[0,.238]];
function homeLampPart(role,z,profile) {
  const points=profile.map(([h,r])=>[z+h,r]),radius=Math.max(...points.map(p=>p[1]));
  return {role,box:{...boxAt(0,0,1,0,radius,radius,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points}};
}
function homeLampCylinder(role,z0,z1,radius) {
  return homeLampPart(role,z0,[[0,0],[0,radius],[z1-z0,radius],[z1-z0,0]]);
}
function homeLampModel(x,y,kind,ceiling,on,angle=0) {
  const pendant=kind==='pendant',parts=[],spokes=[],c=Math.cos(angle),s=Math.sin(angle);
  let bulb,shade,socket,mount,stem;
  if(pendant){
    mount=homeLampPart('mount',ceiling-.055,[[0,0],[0,.04],[.015,.078],[.045,.078],[.055,.065],[.055,0]]);
    stem=homeLampCylinder('cord',ceiling-.51,ceiling-.055,.008);
    socket=homeLampCylinder('socket',ceiling-.56,ceiling-.51,.026);
    bulb=homeLampPart('bulb',ceiling-.663,HOME_LAMP_BULB.map(([h,r])=>[.103-h,r]).reverse());
    shade=homeLampPart('shade',ceiling-.72,HOME_LAMP_ENAMEL);
    for(let k=0;k<3;k++){const a=angle+k*Math.PI*2/3;spokes.push({ax:Math.cos(a)*.023,ay:Math.sin(a)*.023,az:ceiling-.525,bx:Math.cos(a)*.055,by:Math.sin(a)*.055,bz:ceiling-.525,r:.0035});}
  }else{
    mount=homeLampPart('base',0,[[0,0],[0,.190],[.012,.214],[.040,.215],[.065,.170],[.075,.045],[.075,0]]);
    stem=homeLampCylinder('stem',.075,1.465,.014);
    socket=homeLampCylinder('socket',1.465,1.51,.023);
    bulb=homeLampPart('bulb',1.51,HOME_LAMP_BULB);
    shade=homeLampPart('shade',1.30,HOME_LAMP_FABRIC);
    for(let k=0;k<3;k++){const a=angle+k*Math.PI*2/3;spokes.push({ax:Math.cos(a)*.019,ay:Math.sin(a)*.019,az:1.475,bx:Math.cos(a)*.136,by:Math.sin(a)*.136,bz:1.695,r:.004});}
  }
  parts.push(bulb,socket,stem,mount,shade);
  let lightOn=true;
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const cord=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const porcelain=(i,t,L)=>{
    BG[i]=lightOn?C(STONE,12+3*coveLight(HIT.nx,HIT.ny,HIT.nz)):C(STONE,1.5+L*.18*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  const lining=(i,t,L)=>{
    const inside=HIT.part>=6,lit=lightOn,fine=coveDetail(t,.08),weave=pendant?0:Math.sin(Math.atan2(HIT.v,HIT.u)*110)*Math.sin(HIT.w*420)*fine*.16;
    const base=pendant&&!inside?GREEN:STONE,glow=inside&&lit?5:!pendant&&lit?.8:0;
    BG[i]=C(base,2.5+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz)+glow+weave);set(i,' ',0);return true;
  };
  const strut=(ax,ay,az,bx,by,bz,r,base=GRAY)=>drawBox({
    ...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r
  },(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,base),coveRayCapsule);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    lightOn=on();
    for(const p of parts)drawBox({...p.box,x:vx,y:vy},p.role==='bulb'?porcelain:p.role==='shade'?lining:p.role==='cord'?cord:metal,coveRayLathe);
    for(const q of spokes)strut(vx+q.ax,vy+q.ay,q.az,vx+q.bx,vy+q.by,q.bz,q.r,GRAY);
    if(!pendant){
      // A physical rotary switch on the stem, at hand height.
      strut(vx-s*.012,vy+c*.012,1.18,vx-s*.033,vy+c*.033,1.18,.007,GRAY);
      strut(vx-s*.033,vy+c*.033,1.18,vx-s*.048,vy+c*.048,1.18,.011,BRICK);
    }
  }),radius:pendant?.27:.25,box:boxAt(x,y,1,0,pendant?.25:.24,pendant?.25:.24,pendant?ceiling-.72:0,pendant?ceiling:1.75),
    lightFitting:{kind,parts,spokes},walk:pendant};
}
function HOME_PENDANT(x,y,ceiling,r,index) {
  return homeLampModel(x,y,'pendant',ceiling,()=>homeRecord(r)?.lights?.['fixed'+index]!==false);
}
function HOME_FLOOR_LAMP(p) {
  const model=homeLampModel(p.x,p.y,'floor',0,()=>p.on,p.a);
  model.box=furnishingBox(p);model.furnishingKey=p.key;return model;
}
