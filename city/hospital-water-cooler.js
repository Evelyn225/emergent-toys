// A real dispensing recess, including side/floor/head surfaces, replaces the
// old blue block. This local ray shares the prepared rounded cabinet bounds.
function hospitalCoolerRay(ox,oy,oz,rx,ry,rz,b) {
  let t=coveRayRounded(ox,oy,oz,rx,ry,rz,b);HIT.coolerBack=false;
  if(t<0||HIT.face!==3||Math.abs(HIT.u)>=.23||HIT.w<=.49||HIT.w>=.85)return t;
  const u=HIT.u,v=HIT.v,z=HIT.w,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
  let dt=(b.hw-.06-v)/dv,nu=0,nv=1,nz=0;HIT.coolerBack=true;
  if(Math.abs(du)>1e-12){const d=((du>0?.23:-.23)-u)/du;if(d<dt){dt=d;nu=du>0?-1:1;nv=0;HIT.coolerBack=false;}}
  if(Math.abs(rz)>1e-12){const d=((rz>0?.85:.49)-z)/rz;if(d<dt){dt=d;nu=nv=0;nz=rz>0?-1:1;HIT.coolerBack=false;}}
  HIT.u=u+du*dt;HIT.v=v+dv*dt;HIT.w=z+rz*dt;HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;HIT.face=7;return t+dt;
}
function HOSPITAL_WATER_COOLER(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.4+L*.08);set(i,' ',0);return true;};
  const white=(i,t,L)=>{BG[i]=C(WHITE,2.8+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const body=(i,t,L)=>HIT.coolerBack?dark(i,t,L):white(i,t,L);
  const blue=(i,t,L)=>{BG[i]=C(BLUE,2.8+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  for(const u of [-.25,.25])for(const v of [-.25,.25])box('foot',u,v,.025,.025,0,.05,.006,dark);
  box('plinth',0,0,.3,.3,.05,.08,.02,white);
  box('cabinet',0,0,.3,.3,.08,1,.03,body).ray=hospitalCoolerRay;
  hotelLobbyTurned(parts,'bottle-collar',0,-.06,[[1,0],[1,.065],[1.04,.065],[1.04,0]],white);
  hotelLobbyTurned(parts,'bottle',0,-.06,[[1.04,0],[1.04,.045],[1.075,.045],[1.105,.075],[1.125,.13],[1.15,.16],[1.18,.16],[1.185,.164],[1.195,.164],[1.20,.16],[1.28,.16],[1.285,.164],[1.295,.164],[1.30,.16],[1.35,.16],[1.375,.15],[1.39,.135],[1.4,.12],[1.4,0]],blue);
  for(const u of [-.09,.09]){
    hotelLobbyTube(parts,'tap',u,.24,.74,u,.28,.74,.012,metal);
    hotelLobbyTurned(parts,'nozzle',u,.28,[[.68,.004],[.68,.008],[.74,.008],[.74,0],[.735,0],[.735,.004],[.68,.004]],metal);
    hotelLobbyTurned(parts,'tap-handle',u,.265,[[.747,0],[.747,.014],[.78,.014],[.78,0]],(i,t,L)=>{BG[i]=C(u<0?RED:BLUE,2.8+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  }
  box('tray-well',0,.271,.22,.031,.49,.495,0,dark);
  for(const u of [-.214,.214])box('tray-side',u,.271,.006,.031,.495,.515,.002,metal);
  for(const v of [.244,.298])box('tray-rim',0,v,.208,.004,.495,.515,.001,metal);
  for(let k=-6;k<=6;k++)box('tray-grate',k*.03,.271,.006,.023,.510,.515,.001,metal);
  // Face east from the west wall. Rotate cached bounds and capsule endpoints
  // once; rotationally symmetric vertical lathe parts retain their profiles.
  for(const p of parts){const b=p.box,u=b.x,v=b.y;b.x=v;b.y=-u;b.c=0;b.s=-1;
    if(b.ax!=null){const ax=b.ax,ay=b.ay,bx=b.bx,by=b.by;b.ax=ay;b.ay=-ax;b.bx=by;b.by=-bx;}
    Object.assign(p.view,b);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,0,-1,.3,.302,0,1.4),radius:.45,hospitalWaterCooler:{parts}};
}
const HOSPITAL_COOLER_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>[...HOSPITAL_COOLER_PROPS(r).filter(p=>!(p.box&&p.box.x===1.5&&p.box.y===8.4&&p.box.z1===1.4)),HOSPITAL_WATER_COOLER(1.3,8.4)];
