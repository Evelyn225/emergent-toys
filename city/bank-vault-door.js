// Turned steel parts face west from the real east wall. Cache the profiles,
// bounds and material closures; use the common circular ray unchanged.
function bankVaultDisc(parts,role,u,z,profile,shade) {
  const lo=Math.min(...profile.map(p=>p[0])),hi=Math.max(...profile.map(p=>p[0])),center=(lo+hi)/2,radius=Math.max(...profile.map(p=>p[1]));
  const box={...boxAt(-center,u,0,1,radius,(hi-lo)/2,z-radius,z+radius),centerZ:z,clockShape:{x:0,y:0,profile:profile.map(([v,r])=>[v-center,r])}};
  const p={role,box,view:{...box},shade,ray:homeClockRay};parts.push(p);return p;
}
function BANK_VAULT_DOOR(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.5+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const door=(i,t,L)=>{BG[i]=C(GRAY,2.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const disc=(role,u,z,profile,shade=metal)=>bankVaultDisc(parts,role,u,z,profile,shade);
  const plate=(role,u,v,hl,hw,z0,z1)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,.005,metal);Object.assign(p.box,{x:-v,y:u,c:0,s:1});Object.assign(p.view,p.box);};
  const tube=(role,u,v,z,uu,vv,zz,r)=>hotelLobbyTube(parts,role,-v,u,z,-vv,uu,zz,r,metal);
  disc('surround',0,1.3,[[0,1.03],[0,1.14],[.035,1.17],[.10,1.17],[.125,1.13],[.125,1.03],[0,1.03]]);
  disc('leaf',0,1.3,[[.018,0],[.018,1.025],[.085,1.025],[.095,1.015],[.095,0]],door);
  disc('wheel-hub',0,1.3,[[.095,0],[.095,.07],[.11,.10],[.245,.10],[.25,.085],[.25,0]]);
  disc('wheel-rim',0,1.3,[[.22,.295],[.225,.315],[.245,.315],[.255,.295],[.245,.285],[.225,.285],[.22,.295]]);
  for(let k=0;k<8;k++){
    const a=k*TAU/8,c=Math.cos(a),s=Math.sin(a);
    tube('spoke',c*.075,.235,1.3+s*.075,c*.295,.235,1.3+s*.295,.014);
    disc('surround-bolt',c*1.10,1.3+s*1.10,[[.122,0],[.122,.012],[.134,.012],[.134,0]]);
  }
  disc('combination-dial',-.45,1.8,[[.095,0],[.095,.075],[.105,.085],[.12,.085],[.125,.075],[.145,.075],[.145,0]],(i,t,L)=>{
    if(HIT.face!==3)return metal(i,t,L);
    if(Math.abs(HIT.u)<.003&&HIT.w>1.84){BG[i]=C(WHITE,10);set(i,' ',0);return true;}return dark(i,t,L);
  });
  for(const z of [.94,1.66]){
    plate('hinge-leaf',.865,.1125,.075,.0325,z-.04,z+.04);
    plate('hinge-anchor',1.025,.1335,.035,.0115,z-.04,z+.04);
    tube('hinge-barrel',.965,.145,z-.065,.965,.145,z+.065,.03);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x-.0875,y,0,1,1.17,.0875,.13,2.47),radius:1.2,bankVault:{parts}};
}
const BANK_VAULT_PROPS=ROOM_DEFS.bank.props,BANK_VAULT_WALL=ROOM_DEFS.bank.wall;
ROOM_DEFS.bank.props=r=>[...BANK_VAULT_PROPS(r),BANK_VAULT_DOOR(r.W-1,r.H/2),
  {...ROOM_MODEL(r.W-1,r.H/2,()=>{}),box:boxAt(r.W-1-.175,r.H/2,0,1,.315,.08,.985,1.615),bankVaultWheelCollider:true}];
ROOM_DEFS.bank.wall=(i,u,uStep,z,d,mx,my,L)=>{
  if(mx===room.W-1&&z<2.6){BG[i]=C(WHITE,3);set(i,' ',0);return true;}
  return BANK_VAULT_WALL(i,u,uStep,z,d,mx,my,L);
};
