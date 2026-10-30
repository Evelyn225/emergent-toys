// The museum's exhibits, as models instead of sprites. Everything answers to
// museumLit(), so the dark holds at night until a torch finds it. The plinth,
// pedestal and sarcophagus colliders keep their old heights: the guards' sight
// check (hiddenBehind) reads them, and bones and glass must not hide you.
const museumFinish=(col,base,k=.3)=>(i,t,L)=>{BG[i]=C(col,(base+L*k*coveLight(HIT.nx,HIT.ny,HIT.nz))*museumLit());set(i,' ',0);return true;};
const museumBlock=(parts,role,u,v,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
const MUSEUM_REX={top:.35,hl:3,hw:.9,height:3.55};
// Side-on, head towards +x: a spine down the whole animal, each bone its own tube.
const MUSEUM_REX_SPINE=[[-2.75,.95,.018],[-2.1,1.2,.03],[-1.4,1.55,.045],[-.8,1.85,.06],[-.35,2.05,.07],[.2,2.25,.07],[.75,2.4,.06],[1.15,2.6,.05],[1.45,2.85,.045]];
function museumRexSpineZ(x) {
  const s=MUSEUM_REX_SPINE;
  for(let k=1;k<s.length;k++)if(x<=s[k][0]){const f=(x-s[k-1][0])/(s[k][0]-s[k-1][0]);return s[k-1][1]+f*(s[k][1]-s[k-1][1]);}
  return s.at(-1)[1];
}
function MUSEUM_TREX(x,y) {
  const parts=[],{top,hl,hw,height}=MUSEUM_REX,bone=museumFinish(WHITE,2.6,.5),steel=museumFinish(GRAY,1.2,.3),tube=(role,a,b,r,shade=bone)=>hotelLobbyTube(parts,role,a[0],a[1],a[2],b[0],b[1],b[2],r,shade);
  museumBlock(parts,'skull',1.78,0,.32,.13,2.86,3.2,.06,bone);
  museumBlock(parts,'jaw',1.8,0,.27,.1,2.7,2.79,.03,bone);
  tube('jaw-hinge',[1.56,0,2.86],[1.56,0,2.74],.03);
  for(let k=1;k<MUSEUM_REX_SPINE.length;k++) {
    const [ax,az,ar]=MUSEUM_REX_SPINE[k-1],[bx,bz,br]=MUSEUM_REX_SPINE[k];
    tube('spine',[ax,0,az],[bx,0,bz],Math.max(ar,br));
  }
  tube('neck',[1.45,0,2.85],[1.56,0,2.92],.045);
  for(let k=0;k<6;k++) {
    const u=-.2+k*.18,z=museumRexSpineZ(u),reach=.22-Math.abs(k-2.5)*.015;
    for(const e of [-1,1]){tube('rib',[u,0,z],[u,e*reach,z-.26],.014);tube('rib',[u,e*reach,z-.26],[u+.05,e*reach*.55,z-.62],.012);}
  }
  museumBlock(parts,'pelvis',-.35,0,.28,.2,1.92,2.2,.05,bone);
  for(const e of [-1,1]) {
    const v=e*.24,hip=[-.35,v,2],knee=[.05,v,1.25],ankle=[-.25,v,.62],toe=[.12,v,top+.03];
    tube('femur',hip,knee,.06);tube('shin',knee,ankle,.05);tube('foot',ankle,toe,.04);
    tube('toes',toe,[.42,v,top+.03],.03);
    tube('arm',[.72,e*.16,2.1],[.95,e*.18,1.85],.02);tube('arm',[.95,e*.18,1.85],[1.06,e*.18,1.96],.016);
  }
  for(const u of [-1.2,.5])tube('armature',[u,0,top],[u,0,museumRexSpineZ(u)],.018,steel);
  museumBlock(parts,'plinth',0,0,hl,hw,0,top,.02,museumFinish(STONE,2,.3));
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hl,hw,top]),radius:Math.hypot(hl,hw),museumRex:{parts}};
}
function MUSEUM_SARCOPHAGUS(x,y) {
  const parts=[],hl=1.1,hw=.5,height=.85,gold=museumFinish(YEL,2.2,.35);
  const lid=(i,t,L)=>{
    gold(i,t,L);
    const fine=coveDetail(t),band=coveGroove(HIT.u,.28,.05,t/projX);
    if(band>.5&&fine>.2)BG[i]=C(BLUE,(1.8+L*.25)*museumLit());
    return true;
  };
  const face=(i,t,L)=>{gold(i,t,L);return true;};
  museumBlock(parts,'plinth',0,0,hl,hw,0,.08,.01,museumFinish(STONE,1.6,.3));
  museumBlock(parts,'chest',0,0,hl-.03,hw-.03,.08,.56,.05,gold);
  museumBlock(parts,'lid',0,0,hl-.03,hw-.05,.56,.74,.09,lid);
  hotelLobbyTurned(parts,'mask',-.72,0,[[.74,0],[.74,.2],[.78,.19],[.83,.13],[height,.06],[height,0]],face);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hl,hw,height]),radius:Math.hypot(hl,hw),museumSarcophagus:{parts,height}};
}
// Anubis stands against the back wall, looking out into the room (+y).
function MUSEUM_ANUBIS(x,y) {
  const parts=[],dark=museumFinish(GRAY,.9,.3),gold=museumFinish(YEL,2.6,.35),height=1.9;
  museumBlock(parts,'plinth',0,0,.34,.28,0,.2,.012,museumFinish(STONE,1.8,.3));
  for(const e of [-1,1])hotelLobbyTube(parts,'leg',e*.08,0,.2,e*.08,0,.95,.05,dark);
  hotelLobbyTurned(parts,'kilt',0,0,[[.85,0],[.85,.17],[1.08,.13],[1.08,0]],gold);
  museumBlock(parts,'torso',0,0,.13,.09,1.08,1.46,.03,dark);
  for(const e of [-1,1])hotelLobbyTube(parts,'arm',e*.15,0,1.42,e*.17,.04,1.05,.032,dark);
  hotelLobbyTurned(parts,'collar',0,0,[[1.44,0],[1.44,.15],[1.51,.1],[1.51,0]],gold);
  museumBlock(parts,'head',0,.01,.07,.085,1.51,1.7,.025,dark);
  museumBlock(parts,'snout',0,.12,.035,.075,1.56,1.62,.012,dark);
  for(const e of [-1,1]) {
    museumBlock(parts,'ear',e*.05,0,.022,.012,1.7,height,.008,dark);
    museumBlock(parts,'eye',e*.04,.095,.012,.002,1.63,1.65,0,gold);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.34,.28,height]),radius:.5,museumAnubis:{parts,height}};
}
function MUSEUM_PEDESTAL(x,y) {
  const parts=[];
  museumBlock(parts,'top',0,0,.45,.45,.84,.9,.012,museumFinish(STONE,2.6,.3));
  museumBlock(parts,'shaft',0,0,.4,.4,.08,.84,.012,museumFinish(GRAY,1.5,.3));
  museumBlock(parts,'foot',0,0,.45,.45,0,.08,.012,museumFinish(STONE,1.7,.3));
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.45,.45,.9]),radius:.65,museumPedestal:{parts}};
}
// Clear glass with a steel edge: you see straight through it, and so do the guards.
const MUSEUM_CASE={hw:.38,z0:.9,z1:1.5,edge:.008};
function MUSEUM_CASE_GLASS(x,y,id) {
  const parts=[],{hw,z0,z1,edge}=MUSEUM_CASE,steel=museumFinish(CYAN,2.6,.4),corners=[[-hw,-hw],[hw,-hw],[hw,hw],[-hw,hw]];
  const wire=(ax,ay,az,bx,by,bz)=>{hotelLobbyTube(parts,'edge',ax,ay,az,bx,by,bz,edge,steel);parts.at(-1).ray=hotelCurtainRodRay;};
  for(let c=0;c<4;c++) {
    const [ax,ay]=corners[c],[bx,by]=corners[(c+1)%4];
    wire(ax,ay,z0,ax,ay,z1);wire(ax,ay,z0,bx,by,z0);wire(ax,ay,z1,bx,by,z1);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[hw,hw,z1]),box:boxAt(x,y,1,0,hw,hw,z0,z1),radius:.6,exhibit:id,museumCase:{parts}};
}
// A brilliant cut on a velvet cushion. It catches the light as you move and twinkles.
function MUSEUM_STAR(x,y,id) {
  const parts=[],z=MUSEUM_CASE.z0,seat=z+.05;
  const stone=(i,t,L)=>{
    const facet=Math.floor(Math.atan2(HIT.ny,HIT.nx)*4+HIT.nz*3),glint=fract(T*1.5+facet*.37)<.2;
    BG[i]=C(glint?WHITE:CYAN,(glint?13:5+((facet&1)?2:0)+L*.2)*museumLit());set(i,' ',0);return true;
  };
  hotelLobbyTurned(parts,'stone',0,0,[[seat,0],[seat+.09,.1],[seat+.125,.075],[seat+.125,0]],stone);
  museumBlock(parts,'cushion',0,0,.17,.17,z,seat,.018,museumFinish(RED,2,.3));
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.25,exhibit:id,museumExhibit:{parts,seat}};
}
// Brass planets on brass arms round a gold sun. The year turns very slowly.
const MUSEUM_ORBITS=[[.1,.018,RED,1.1],[.17,.022,CYAN,.7],[.25,.03,ORANGE,.4]];
function MUSEUM_ORRERY(x,y,id) {
  const parts=[],z=MUSEUM_CASE.z0,brass=museumFinish(YEL,2.8,.4),hub=z+.28,sun=museumFinish(YEL,8,.3);
  hotelLobbyTurned(parts,'foot',0,0,[[z,0],[z,.12],[z+.03,.1],[z+.04,.03],[hub,.012],[hub,0]],brass);
  hotelLobbyTurned(parts,'sun',0,0,[[hub-.05,0],[hub-.035,.035],[hub,.05],[hub+.035,.035],[hub+.05,0]],sun);
  const fixed=hotelLobbyDraw(parts),planets=MUSEUM_ORBITS.map(([r,size,col,speed],k)=>({r,size,speed,k,shade:museumFinish(col,3.5,.35),arm:{}}));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const q of planets) {
      const a=T*q.speed*.3+q.k*2.1,px_=vx+Math.cos(a)*q.r,py_=vy+Math.sin(a)*q.r,zz=hub-.012-q.k*.012;
      foodOval(px_,py_,zz-q.size,q.size,q.size,2*q.size,q.shade);
      coveTube(vx,vy,zz,px_,py_,zz,.004,YEL);
    }
    fixed(vx,vy);
  }),walk:true,radius:.32,exhibit:id,museumExhibit:{parts,planets,hub}};
}
// The card left where a stolen piece stood.
function MUSEUM_STOLEN_CARD(x,y) {
  const parts=[],z=MUSEUM_CASE.z0,card=(i,t,L)=>{
    BG[i]=C(WHITE,5*museumLit());
    if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,'STOLEN',0,z+.1,.05,.06,C(RED,13),BG[i]))return true;
    set(i,' ',0);return true;
  };
  museumBlock(parts,'card',0,0,.17,.006,z,z+.17,.002,card);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.2,museumStolenCard:{parts}};
}
// Brass stanchions with a red rope sagging between them.
const MUSEUM_ROPE={reach:1.1,top:.95,sag:.14};
function MUSEUM_ROPES(x,y) {
  const parts=[],{reach,top,sag}=MUSEUM_ROPE,brass=museumFinish(YEL,2.8,.4),velvet=museumFinish(RED,2.8,.35),corners=[[-reach,-reach],[reach,-reach],[reach,reach],[-reach,reach]];
  for(let c=0;c<4;c++) {
    const [ax,ay]=corners[c],[bx,by]=corners[(c+1)%4];
    hotelLobbyTurned(parts,'stanchion',ax,ay,[[0,0],[0,.09],[.03,.08],[.05,.02],[top-.03,.016],[top-.02,.03],[top+.04,.03],[top+.05,0]],brass);
    for(let k=0;k<4;k++) {
      const f0=k/4,f1=(k+1)/4,h=f=>top-sag*4*f*(1-f);
      hotelLobbyTube(parts,'rope',ax+(bx-ax)*f0,ay+(by-ay)*f0,h(f0),ax+(bx-ax)*f1,ay+(by-ay)*f1,h(f1),.012,velvet);
      parts.at(-1).ray=hotelCurtainRodRay;
    }
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:reach*1.5,museumRopes:{parts}};
}
