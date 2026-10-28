// Grand lobby fixtures use the actual room ceiling as their mounting datum.
// Prepared closed parts share endpoints and reuse view bounds at every draw.
function hotelLobbyTurned(parts,role,x,y,profile,shade) {
  const p=homeLampPart(role,0,profile);p.box.x=x;p.box.y=y;p.view={...p.box};p.shade=shade;p.ray=coveRayLathe;parts.push(p);return p;
}
function hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade) {
  const box={...boxAt(0,0,1,0,hl,hw,z0,z1),round},p={role,box,view:{...box},shade,ray:coveRayRounded};parts.push(p);return p;
}
function hotelLobbyTube(parts,role,ax,ay,az,bx,by,bz,r,shade) {
  const box={...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r};
  const p={role,box,view:{...box},shade,ray:coveRayCapsule};parts.push(p);return p;
}
function hotelLobbyDraw(parts) {
  return (vx,vy)=>{for(const p of parts){const b=p.box,v=p.view;v.x=vx+b.x;v.y=vy+b.y;if(b.ax!=null){v.ax=vx+b.ax;v.ay=vy+b.ay;v.bx=vx+b.bx;v.by=vy+b.by;}drawBox(v,p.shade,p.ray);}};
}
function HOTEL_LOBBY_COLUMN(x,y,height) {
  const parts=[],stone=(i,t,L)=>{BG[i]=C(STONE,2.6+L*.26*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  hotelLobbyRound(parts,'plinth',.34,.34,0,.12,.025,stone);
  hotelLobbyTurned(parts,'foot',0,0,[[.12,0],[.12,.27],[.145,.27],[.185,.245],[.22,.22],[.22,0]],stone);
  hotelLobbyTurned(parts,'shaft',0,0,[[.22,0],[.22,.22],[height-.42,.205],[height-.42,0]],stone);
  hotelLobbyTurned(parts,'capital',0,0,[[height-.42,0],[height-.42,.205],[height-.37,.205],[height-.31,.26],[height-.25,.26],[height-.14,.30],[height-.10,.31],[height-.10,0]],stone);
  hotelLobbyRound(parts,'abacus',.34,.34,height-.10,height,.018,stone);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.34,.34,height]),radius:.5,hotelColumn:{height,parts}};
}
function HOTEL_LOBBY_CHANDELIER(x,y,height) {
  const parts=[],ends=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const glass=(i,t,L)=>{BG[i]=C(STONE,12+3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  hotelLobbyTurned(parts,'canopy',0,0,[[height-.07,0],[height-.07,.055],[height-.052,.12],[height-.03,.18],[height,.18],[height,0]],metal);
  hotelLobbyTurned(parts,'stem',0,0,[[height-.55,0],[height-.55,.018],[height-.07,.018],[height-.07,0]],metal);
  hotelLobbyTurned(parts,'hub',0,0,[[height-.61,0],[height-.61,.075],[height-.50,.075],[height-.50,0]],metal);
  for(let k=0;k<3;k++){
    const a=k*TAU/3,c=Math.cos(a),s=Math.sin(a),points=[[.055,height-.55],[.28,height-.68],[.50,height-.66],[.68,height-.55]];
    for(let j=1;j<points.length;j++){const[r,z]=points[j-1],[rr,zz]=points[j];hotelLobbyTube(parts,'arm',c*r,s*r,z,c*rr,s*rr,zz,.018,metal);}
    const u=c*.68,v=s*.68;ends.push({x:u,y:v,z:height-.55});
    hotelLobbyTurned(parts,'socket',u,v,[[height-.66,0],[height-.66,.043],[height-.55,.043],[height-.55,0]],metal);
    hotelLobbyTurned(parts,'globe',u,v,[[height-.93,0],[height-.91,.06],[height-.85,.11],[height-.77,.115],[height-.70,.07],[height-.66,.025],[height-.66,0]],glass);
  }
  parts.sort((a,b)=>Number(b.role==='globe')-Number(a.role==='globe'));
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,box:boxAt(x,y,1,0,.8,.8,height-.93,height),radius:.85,hotelChandelier:{height,parts,ends}};
}

// The enlarged lobby no longer repeats its old decorative glyphs across
// metres of wall. Physical columns and lamps supply the relief and light.
function hotelLobbyWall(i,u,uStep,z,d,mx,my,L) {
  BG[i]=C(WHITE,3+L*.30);set(i,' ',0);return true;
}
