// Circular bores are real openings in the closed leaves. Separate recessed
// frosted panes and annular metal trims occupy them; grazing rays hit the bore.
function hospitalDoorLeafRay(ox,oy,oz,rx,ry,rz,b) {
  const t=coveRayRounded(ox,oy,oz,rx,ry,rz,b);if(t<0)return t;
  const u=HIT.u,z=HIT.w-b.windowZ,r=b.windowRadius;
  if((HIT.face!==3&&HIT.face!==4)||u*u+z*z>=r*r)return t;
  const du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c,A=du*du+rz*rz,q=u*du+z*rz;
  if(A>1e-12){const dt=(-q+Math.sqrt(Math.max(0,q*q-A*(u*u+z*z-r*r))))/A,v=HIT.v+dv*dt;
    if(dt>0&&v>=-b.hw-1e-9&&v<=b.hw+1e-9){const x=u+du*dt,w=z+rz*dt,n=Math.hypot(x,w);
      HIT.u=x;HIT.v=v;HIT.w=b.windowZ+w;HIT.nx=-x/n*b.c;HIT.ny=-x/n*b.s;HIT.nz=-w/n;HIT.face=7;return t+dt;}
  }
  return -1;
}
function HOSPITAL_SERVICE_DOORS(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const paint=(i,t,L)=>{BG[i]=C(WHITE,2.8+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.3+L*.06);set(i,' ',0);return true;};
  const frost=(i,t,L)=>{BG[i]=C(CYAN,2.2+L*.2*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const sign=(i,t,L)=>{BG[i]=C(BLUE,1+L*.1);if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,'STAFF ONLY',0,2.515,.13,.17,C(WHITE,13),BG[i]))return true;set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  box('reveal',0,.012,.88,.012,.025,2.20,0,dark);
  box('threshold',0,.055,1.02,.055,0,.025,.006,metal);
  for(const e of [-1,1])box('jamb',e*.95,.055,.07,.055,.025,2.20,.008,metal);
  box('head',0,.055,1.02,.055,2.20,2.32,.008,metal);
  const ringShape={x:0,y:0,profile:[[-.015,.13],[-.015,.145],[.015,.145],[.015,.13],[-.015,.13]]};
  const paneShape={x:0,y:0,profile:[[-.004,0],[-.004,.13],[.004,.13],[.004,0]]};
  for(const e of [-1,1]){
    const u=e*.44,p=box('leaf',u,.045,.433,.025,.025,2.20,.008,paint);
    p.box.windowZ=p.view.windowZ=1.5;p.box.windowRadius=p.view.windowRadius=.13;p.ray=hospitalDoorLeafRay;
    box('kickplate',u,.074,.36,.004,.10,.28,.002,metal);
    box('pushplate',e*.18,.074,.045,.004,.90,1.10,.003,metal);
    for(const [role,v,r,depth,shape,shade]of [['window-trim',.061,.145,.015,ringShape,metal],['frosted-pane',.046,.13,.004,paneShape,frost]]){
      const b={...boxAt(u,v,1,0,r,depth,1.5-r,1.5+r),centerZ:1.5,clockShape:shape};
      parts.push({role,box:b,view:{...b},shade,ray:homeClockRay});
    }
    for(const z of [.4,1.65])hotelLobbyTurned(parts,'hinge',e*.878,.055,[[z,0],[z,.009],[z+.12,.009],[z+.12,0]],metal);
  }
  box('sign',0,.012,.72,.012,2.38,2.65,.003,sign);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y+.055,1,0,1.02,.055,0,2.32),radius:1.15,
    hospitalServiceDoor:{parts,half:1.02,windowRadius:.13}};
}
const HOSPITAL_DOOR_PROPS=ROOM_DEFS.hospital.props,HOSPITAL_DOOR_WALL=ROOM_DEFS.hospital.wall;
ROOM_DEFS.hospital.props=r=>[...HOSPITAL_DOOR_PROPS(r),HOSPITAL_SERVICE_DOORS(2.1,1)];
ROOM_DEFS.hospital.wall=(i,u,uStep,z,d,mx,my,L)=>{
  if(my===0&&Math.abs(u-2.1)<1.05&&z<2.8){BG[i]=C(GREEN,2+L*.08);set(i,' ',0);return true;}
  return HOSPITAL_DOOR_WALL(i,u,uStep,z,d,mx,my,L);
};
