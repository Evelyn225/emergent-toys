// Three shared bay dividers replace four floating striped planes. Folded cloth
// has closed front/back/end surfaces; clips, tracks and ceiling/wall mounts join.
function HOSPITAL_BAY_CURTAIN(y,ceiling) {
  const x=12.425,parts=[],half=.575,step=half*2/24,thickness=.003,rodZ=2.4;
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const cloth=(i,t,L)=>{const hem=HIT.w<.23||HIT.w>2.29;
    // Ceiling bounce lights either side; actual fold normals retain the relief.
    BG[i]=C(CYAN,2.4+L*.28*coveLight(HIT.nx,Math.abs(HIT.ny),HIT.nz)+(hem?-.2:0));set(i,' ',0);return true;};
  const front=Array.from({length:25},(_,k)=>[-half+k*step,-.02*Math.cos(k/24*TAU*4)]);
  const polygon=[...front,...front.map(([u,v])=>[u,v-thickness]).reverse()];
  const edges=polygon.map(([u,v],k)=>{const q=polygon[(k+1)%polygon.length],du=q[0]-u,dv=q[1]-v,n=Math.hypot(du,dv);return{u,v,du,dv,nx:-dv/n,ny:du/n};});
  const b={...boxAt(0,0,1,0,half,.023,.2,2.32),front,edges,step,thickness};
  parts.push({role:'cloth',box:b,view:{...b},shade:cloth,ray:hotelCurtainRay});
  const tube=(role,...args)=>{hotelLobbyTube(parts,role,...args,metal);parts.at(-1).ray=hotelCurtainRodRay;};
  tube('track',11.75-x,.0185,rodZ,13-x,.0185,rodZ,.012);
  const mount=hotelLobbyRound(parts,'wall-mount',.005,.035,rodZ-.035,rodZ+.035,.002,metal);mount.box.x=12.995-x;mount.box.y=.0185;
  for(const at of [12.2,12.8]){
    tube('hanger',at-x,.0185,rodZ,at-x,.0185,ceiling-.02,.004);
    hotelLobbyTurned(parts,'ceiling-mount',at-x,.0185,[[ceiling-.03,0],[ceiling-.03,.035],[ceiling,.035],[ceiling,0]],metal);
  }
  for(const k of [3,9,15,21])tube('clip',front[k][0],front[k][1]-thickness/2,2.317,front[k][0],.0185,rodZ,.004);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y-thickness/2,1,0,half,.0215,.2,2.32),radius:.75,
    hospitalCurtain:{parts,ceiling,rodZ,left:11.85,right:13}};
}
const HOSPITAL_CURTAIN_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>{
  const old=HOSPITAL_CURTAIN_PROPS(r),props=old.filter(p=>!(p.box&&p.box.x===12.35&&p.box.hl===.5&&p.box.hw===.02&&p.box.z0===.2&&p.box.z1===1.95));
  return [...props,...[1.25,3.3,5.35].map(y=>HOSPITAL_BAY_CURTAIN(y,r.def.height||3))];
};
