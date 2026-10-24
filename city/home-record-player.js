// A fitted stereo console: real cabinet boards, sleeved records, a supported
// platter and vinyl annulus, and a tonearm whose needle follows playing state.
const HOME_RECORD_TOP=.945,HOME_RECORD_ARM_RADIUS=.008;
function homeRecordArm(playing) {
  const pivot={u:.15,v:-.17,z:1.005},head=playing?{u:-.09,v:.085,z:.974}:{u:.205,v:.12,z:1.020};
  const du=head.u-pivot.u,dv=head.v-pivot.v,len=Math.hypot(du,dv);
  return {pivot,head,needle:head.z-.029,weight:{u:pivot.u-du/len*.075,v:pivot.v-dv/len*.075,z:pivot.z}};
}
function HOME_RECORD_PLAYER(p) {
  const c=Math.cos(p.a),s=Math.sin(p.a),panels=[],lathes=[],wood=furnitureTimber(BRICK),steel=kitchenSteel;
  let phase=0,last=T,playing=!!p.on;
  const panel=(role,u,v,hl,hw,z0,z1,shade=wood,bevel=.006)=>{
    const q={role,u,v,hl,hw,z0,z1,shade,profile:kitchenTopProfile(hl,hw,z0,z1,bevel)};panels.push(q);return q;
  };
  const lathe=(role,u,v,z,profile,shade)=>{
    const points=profile.map(([h,r])=>[h+z,r]),radius=Math.max(...points.map(q=>q[1]));
    const q={role,u,v,shade,box:{...boxAt(0,0,1,0,radius,radius,Math.min(...points.map(q=>q[0])),Math.max(...points.map(q=>q[0]))),profile:points}};lathes.push(q);return q;
  };
  const cylinder=(role,u,v,z0,z1,r,shade=steel)=>lathe(role,u,v,z0,[[0,0],[0,r],[z1-z0,r],[z1-z0,0]],shade);
  for(const u of [-.45,.45])for(const v of [-.25,.25])
    lathe('foot',u,v,0,[[0,0],[0,.034],[.16,.042],[.16,0]],wood);
  panel('floor',0,0,.55,.35,.16,.20);
  for(const u of [-.53,.53])panel('side',u,0,.02,.35,.20,.80);
  panel('back',0,-.3325,.51,.0175,.20,.80);
  panel('top',0,0,.55,.35,.80,.86,wood,.012);
  const cloth=(i,t,L)=>{
    const weave=Math.sin(HIT.u*600)*Math.sin(HIT.w*600)*coveDetail(t,.06)*.1;
    BG[i]=C(STONE,2.3+L*.23*coveLight(HIT.nx,HIT.ny,HIT.nz)+weave);set(i,' ',0);return true;
  };
  for(const u of [-.355,.355]){
    panel('speaker-baffle',u,.31,.155,.02,.20,.80);
    panel('speaker-cloth',u,.332,.137,.002,.24,.76,cloth,.001);
  }
  for(let k=0;k<9;k++){
    const col=[BLUE,STONE,BRICK,GREEN,WARM][k%5],height=.30+(k%3)*.012;
    const cover=(i,t,L)=>{
      const band=HIT.face===3&&HIT.w>.20+height*.7&&HIT.w<.20+height*.76;
      BG[i]=C(band?STONE:col,2.6+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    };
    panel('sleeve',(k-4)*.025,.175,.009,.155,.20,.20+height,cover,.0015);
  }
  panel('turntable-plinth',-.12,0,.36,.27,.86,.922,wood,.009);
  cylinder('platter',-.20,0,.922,.943,.16);
  const vinyl=(i,t,L)=>{
    const groove=coveGroove(Math.hypot(HIT.u,HIT.v),.002,.0005,t/projX);
    BG[i]=C(BLACK,1+L*.10+groove*.3);set(i,' ',0);return true;
  };
  lathe('vinyl',-.20,0,.943,[[0,.0035],[0,.155],[.002,.155],[.002,.0035],[0,.0035]],vinyl);
  lathe('label',-.20,0,HOME_RECORD_TOP,[[0,.0035],[0,.045],[.0008,.045],[.0008,.0035],[0,.0035]],(i,t,L)=>{
    const angle=Math.atan2(HIT.v,HIT.u)-p.a-phase,mark=Math.cos(angle*2)>.7,col=[BLUE,WARM,RED][p.track||0];
    BG[i]=C(mark?STONE:col,3.8+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  });
  cylinder('spindle',-.20,0,.943,.963,.0025);
  cylinder('arm-pivot',.15,-.17,.922,1.005,.02);
  const parked=homeRecordArm(false),du=parked.head.u-parked.pivot.u,dv=parked.head.v-parked.pivot.v,dz=parked.head.z-parked.pivot.z;
  const restZ=parked.pivot.z+dz*.72-HOME_RECORD_ARM_RADIUS*Math.sqrt(1+dz*dz/(du*du+dv*dv));
  cylinder('arm-rest',parked.pivot.u+du*.72,parked.pivot.v+dv*.72,.922,restZ,.008);
  for(const v of [-.11,.11])cylinder('knob',.39,v,.86,.894,.027);
  cylinder('start-button',.39,.24,.86,.874,.014,(i,t,L)=>{
    BG[i]=C(playing?GREEN:GRAY,playing?8:1.8+L*.15);set(i,' ',0);return true;
  });
  const cartridges=[false,true].map(on=>{const a=homeRecordArm(on);return kitchenTopProfile(.022,.010,a.head.z-.010,a.head.z+.010,.003);});
  const model={...ROOM_MODEL(p.x,p.y,(vx,vy)=>{
    if(playing)phase+=Math.max(0,T-last)*3;last=T;playing=!!p.on;
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const tube=(role,a,b,r,shade=steel)=>{
      const[ax,ay]=at(a.u,a.v),[bx,by]=at(b.u,b.v);
      drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(a.z,b.z)-r,Math.max(a.z,b.z)+r),ax,ay,az:a.z,bx,by,bz:b.z,r,recordRole:role},shade,coveRayCapsule);
    };
    const arm=homeRecordArm(playing),[hx,hy]=at(arm.head.u,arm.head.v);
    tube('tonearm',arm.pivot,arm.head,HOME_RECORD_ARM_RADIUS);
    const start={u:arm.pivot.u+(arm.weight.u-arm.pivot.u)/3,v:arm.pivot.v+(arm.weight.v-arm.pivot.v)/3,z:arm.pivot.z};
    tube('counterweight',start,arm.weight,.0125);
    drawBox({...boxAt(hx,hy,c,s,.022,.010,arm.head.z-.010,arm.head.z+.010),...cartridges[+playing],recordRole:'cartridge'},wood,homeRayWorktop);
    tube('needle',{u:arm.head.u,v:arm.head.v,z:arm.head.z-.0085},{u:arm.head.u,v:arm.head.v,z:arm.needle+.0015},.0015);
    // Nearest details first: their depth rejects the hidden parts of the
    // platter, plinth and cabinet before those surfaces need shading.
    for(let k=lathes.length-1;k>=0;k--){const q=lathes[k],[x,y]=at(q.u,q.v);drawBox({...q.box,x,y,recordRole:q.role},q.shade,coveRayLathe);}
    for(let k=panels.length-1;k>=0;k--){const q=panels[k],[x,y]=at(q.u,q.v);drawBox({...boxAt(x,y,c,s,q.hl,q.hw,q.z0,q.z1),...q.profile,recordRole:q.role},q.shade,homeRayWorktop);}

  }),box:furnishingBox(p),radius:Math.hypot(.55,.35),furnishingKey:p.key,recordPlayer:{panels,lathes}};
  return model;
}
