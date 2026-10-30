// The laundromat's machines were painted on its walls. They stand in the room
// now, on the same 75cm bays machineHere() counts, each with a round porthole.
// The drum's state is read when it's drawn, so your load shows in its machine.
const LAUNDRY_BAY=.75,LAUNDRY_WASHER={first:2,last:11,hl:.345,hw:.25,top:1.22},LAUNDRY_DRYER={hl:.36,hw:.3,each:.92,ys:[2.45,3.2,3.95,4.7]};
// A short round boss on a machine's front: flat face first, then its rim. b.x and
// b.y are on the cabinet, fx/fy point out of it, front is how far the boss stands.
function laundryPortRay(ox,oy,oz,rx,ry,rz,b) {
  const along=rx*b.fx+ry*b.fy,cross=-rx*b.fy+ry*b.fx,dx0=ox-b.x,dy0=oy-b.y;
  const ou=-dx0*b.fy+dy0*b.fx,ov=dx0*b.fx+dy0*b.fy,oh=oz-b.cz,r2=b.r*b.r;
  if(along<0) {
    const t=(b.front-ov)/along;
    if(t>.01){const u=ou+cross*t,h=oh+rz*t;if(u*u+h*h<=r2){HIT.u=u;HIT.v=b.front;HIT.w=h;HIT.nx=b.fx;HIT.ny=b.fy;HIT.nz=0;HIT.face=3;return t;}}
  }
  const A=cross*cross+rz*rz,B=ou*cross+oh*rz,D=B*B-A*(ou*ou+oh*oh-r2);
  if(A<1e-9||D<0)return -1;
  const t=(-B-Math.sqrt(D))/A,v=ov+along*t;
  if(t<.01||v<0||v>b.front)return -1;
  const u=ou+cross*t,h=oh+rz*t;
  HIT.u=u;HIT.v=v;HIT.w=h;HIT.nx=-b.fy*u/b.r;HIT.ny=b.fx*u/b.r;HIT.nz=h/b.r;HIT.face=0;return t;
}
function laundryPort(parts,x,y,z,fx,fy,r,shade) {
  const ex=Math.abs(fy)*r+Math.abs(fx)*.04,ey=Math.abs(fx)*r+Math.abs(fy)*.04;
  const box={...boxAt(x,y,1,0,ex,ey,z-r,z+r),fx,fy,cz:z,r,front:.04};
  parts.push({role:'port',box,view:{...box},shade,ray:laundryPortRay});
}
// A drum seen through its glass: the load tumbles up close and settles to its
// average colour further off, so it never shimmers.
function laundryDrumShade(state) {
  return (i,t,L)=>{
    set(i,' ',0);const r=Math.hypot(HIT.u,HIT.w),s=state();
    if(HIT.face!==3||r>.15)return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
    if(s.clean){BG[i]=C(WHITE,8);return true;}
    if(!s.turning){BG[i]=C(BLUE,.9+L*.05);return true;}
    const lump=coveDetail(t)>.3?Math.sin(Math.atan2(HIT.w,HIT.u)*3+T*s.speed)>.1:r<.1;
    BG[i]=lump?C(s.col,s.mine?8:3.2):C(BLUE,1.2);return true;
  };
}
const laundryEnamel=(i,t,L)=>{BG[i]=C(WHITE,3.3+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
const laundryPlinth=(i,t,L)=>{BG[i]=C(GRAY,.8+L*.08);set(i,' ',0);return true;};
function LAUNDRY_WASHER_MODEL(n,wallY) {
  const parts=[],{hl,hw,top}=LAUNDRY_WASHER,x=(n+.5)*LAUNDRY_BAY,y=wallY+hw,steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const yours=()=>myLaundromat()&&wash.n===n;
  const state=()=>{
    if(yours())return T<wash.done?{turning:true,mine:true,col:WHITE,speed:12}:{clean:true};
    return n%3?{turning:true,col:ITEM_COL[n&7],speed:n&1?6:-6}:{};
  };
  const lamp=(i,t,L)=>{
    const own=yours(),done=own&&T>=wash.done;
    BG[i]=done?C(GREEN,fract(T*2)<.5?12:3):own?C(YEL,12):C(GRAY,.8);set(i,' ',0);return true;
  };
  const add=(role,u,v,a,b,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=v;};
  add('console',0,-hw+.06,hl,.06,1.02,top,.012,steel);
  add('lamp',.24,-hw+.122,.016,.003,1.1,1.13,0,lamp);
  add('coin',-.2,-hw+.122,.04,.004,1.07,1.17,.002,steel);
  laundryPort(parts,0,hw,.62,0,1,.2,laundryDrumShade(state));
  add('cabinet',0,0,hl,hw,.06,1.02,.012,laundryEnamel);
  add('plinth',0,-.01,hl-.02,hw-.03,0,.06,.004,laundryPlinth);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hl,hw,top]),radius:Math.hypot(hl,hw)+.05,laundryWasher:{n,parts}};
}
// Stacked dryers along the side walls. They run or they don't, and you can't use them.
function LAUNDRY_DRYER_STACK(x,y,fx,seed) {
  const parts=[],{hl,hw,each}=LAUNDRY_DRYER;
  const add=(role,u,v,a,b,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=v;};
  for(let k=0;k<2;k++) {
    const z0=.06+k*each,running=hash(seed,k,311)>.45,col=ITEM_COL[(seed+k)&7],state=()=>running?{turning:true,col,speed:fx*4}:{};
    laundryPort(parts,fx*hw,0,z0+each/2,fx,0,.25,laundryDrumShade(state));
    add('cabinet',0,0,hw,hl,z0,z0+each-.004,.012,laundryEnamel);
  }
  add('plinth',-fx*.01,0,hw-.03,hl-.02,0,.06,.004,laundryPlinth);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hw,hl,.06+2*each]),radius:Math.hypot(hl,hw)+.05,laundryDryer:{parts,fx}};
}
// A wire cart on castors, a heap of washing in it.
function LAUNDRY_CART(x,y) {
  const parts=[],hl=.36,hw=.26,floor=.16,rim=.68,steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const wire=(ax,ay,az,bx,by,bz,r=.005)=>{hotelLobbyTube(parts,'wire',ax,ay,az,bx,by,bz,r,steel);parts.at(-1).ray=hotelCurtainRodRay;};
  const cloth=(col)=>{const fold=gymPaint(col,3.2,.35);return (i,t,L)=>fold(i,t,L);};
  const corners=[[-hl,-hw],[hl,-hw],[hl,hw],[-hl,hw]],heap=[[-.14,-.08,.15,.14,.5,RED],[.14,-.06,.17,.15,.56,BLUE],[-.1,.1,.16,.12,.62,WHITE],[.16,.1,.14,.12,.48,GREEN],[0,0,.24,.18,.74,YEL]];
  for(const [u,v,a,b,z1,col]of heap){const p=hotelLobbyRound(parts,'washing',a,b,floor,z1,.05,cloth(col));p.box.x=u;p.box.y=v;}
  for(let c=0;c<4;c++) {
    const [ax,ay]=corners[c],[bx,by]=corners[(c+1)%4];
    wire(ax,ay,rim,bx,by,rim,.008);wire(ax,ay,floor,bx,by,floor,.008);wire(ax,ay,(floor+rim)/2,bx,by,(floor+rim)/2);
    for(const k of [.25,.5,.75])wire(ax+(bx-ax)*k,ay+(by-ay)*k,floor,ax+(bx-ax)*k,ay+(by-ay)*k,rim);
    wire(ax,ay,.045,ax,ay,rim,.011);
    hotelLobbyTurned(parts,'castor',ax,ay,[[0,0],[.002,.025],[.04,.03],[.05,.012],[.05,0]],laundryPlinth);
  }
  const base=hotelLobbyRound(parts,'tray',hl-.01,hw-.01,floor-.012,floor,.003,steel);base.box.x=0;base.box.y=0;
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hl,hw,.74]),radius:Math.hypot(hl,hw)+.03,laundryCart:{parts,floor,rim}};
}
function laundryFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,.4,.003,footprint),coveGroove(wy,.4,.003,footprint));
  const check=footprint>.2?.5:(Math.floor(wx/.4)+Math.floor(wy/.4))&1;
  BG[i]=C(GRAY,2.3+check*.9+L*.25-5*joint);set(i,' ',0);return true;
}
ROOM_FLOORS.laundryVinyl=(i,f,wx,wy,r,x,L)=>laundryFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
function laundryWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY);set(i,' ',0);
  if(z<1.35) {
    const grout=Math.max(coveGroove(u,.3,.003,footprint),coveGroove(z,.3,.003,footprint));
    BG[i]=C(CYAN,2.4+L*.2-4*grout);return true;
  }
  BG[i]=C(WHITE,3.2+L*.28);return true;
}
const LAUNDRY_SHELL_PROPS=ROOM_DEFS.laundry.props;
ROOM_DEFS.laundry.props=r=>{
  r.hotelEntranceExterior=wordEntranceExterior(r,'LAUNDRY');
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1);entry.laundryEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  const props=[...LAUNDRY_SHELL_PROPS(r),entry,wallTitleBoard(r.W/2,1.025,1.45,r.word||'LAUNDRY','OPEN 24 HOURS',C(CYAN,14),1.95,'laundryWallBoard')];
  for(let n=LAUNDRY_WASHER.first;n<=LAUNDRY_WASHER.last;n++)props.push(LAUNDRY_WASHER_MODEL(n,1));
  for(const y of LAUNDRY_DRYER.ys){props.push(LAUNDRY_DRYER_STACK(1+LAUNDRY_DRYER.hw,y,1,Math.round(y*4)),LAUNDRY_DRYER_STACK(r.W-1-LAUNDRY_DRYER.hw,y,-1,Math.round(y*4)+1));}
  const height=r.def.height||3;
  for(const x of [3,7])for(const y of [2.4,4.6]){const o=CEILING_BATTEN(x,y,1.8,height);o.laundryCeilingLight=o.ceilingBatten;delete o.ceilingBatten;props.push(o);}
  const base=homeSkirting({...r,def:{...r.def,tier:1,height,builtSkirting:true},props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]});
  for(const o of base){o.laundrySkirting=o.homeSkirting;delete o.homeSkirting;}
  return [...props,...base];
};
ROOM_DEFS.laundry.doorWall=true;
ROOM_DEFS.laundry.wall=(i,u,uStep,z,d,mx,my,L)=>hotelEntranceGlass(i,u,z,mx,my)||laundryWallFinish(i,u,uStep,z,d,mx,my,L);
ROOM_DEFS.laundry.floor='laundryVinyl';
ROOM_DEFS.laundry.ceil='civicPlaster';
