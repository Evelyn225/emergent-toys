// Lettering on the east wall uses local +Y across and -X out of the wall.
// Keep close block text, cache small-letter centres and restore wall context.
function jailExitText(i,u,z,t,letters,color,background) {
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const dn=WH.dn,sl=WH.sl,wc=WH.wc,step=t/(projX*Math.max(1e-6,Math.abs(-rx+dy/projX)));
  WH.dn=Math.max(1e-6,Math.abs(rx*t));WH.sl=ry/(Math.abs(rx)||1e-6);WH.wc=u;
  try{
    if(wallTextBig(u,step,t,0,.13,.20,4))return wallText(i,u,step,z,t,'EXIT',0,2.45,.13,.20,color,background);
    for(const p of letters)if(p.i===i){BG[i]=background;set(i,p.ch,color);return true;}
    return false;
  }finally{WH.dn=dn;WH.sl=sl;WH.wc=wc;}
}
function JAIL_EXIT_DOOR(x,y) {
  const parts=[],letters=[...'EXIT'].map(ch=>({ch,i:-1})),metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const paint=(i,t,L)=>{BG[i]=C(GRAY,2+L*.24*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade=metal)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);Object.assign(p.box,{x:-v,y:u,c:0,s:1});Object.assign(p.view,p.box);return p;};
  box('threshold',0,.055,.76,.055,0,.025,.006);
  for(const u of [-.7,.7])box('jamb',u,.055,.06,.055,.025,2.20,.006);
  box('head',0,.055,.76,.055,2.20,2.32,.006);
  const leaf=box('leaf',0,.046,.637,.025,.025,2.20,.006,paint);
  leaf.box.windowZ=leaf.view.windowZ=1.65;leaf.box.windowRadius=leaf.view.windowRadius=.21;leaf.ray=hospitalDoorLeafRay;
  box('kickplate',0,.075,.55,.004,.10,.28,.002);
  box('escutcheon',.43,.081,.03,.01,.96,1.12,.003);
  hotelLobbyTube(parts,'spindle',-.091,.43,1.04,-.14,.43,1.04,.009,metal);
  hotelLobbyTube(parts,'lever',-.14,.43,1.04,-.14,.22,1.04,.012,metal);
  for(const z of [.4,1.65]){
    box('hinge-jamb',-.675,.115,.025,.005,z,z+.12,0);
    box('hinge-leaf',-.622,.0955,.024,.0245,z,z+.12,0);
    hotelLobbyTurned(parts,'hinge-barrel',-.116,-.645,[[z,0],[z,.009],[z+.12,.009],[z+.12,0]],metal);
  }
  bankVaultDisc(parts,'window-trim',0,1.65,[[.06,.21],[.06,.225],[.09,.225],[.09,.21],[.06,.21]],metal);
  bankVaultDisc(parts,'wired-pane',0,1.65,[[.042,0],[.042,.21],[.05,.21],[.05,0]],(i,t,L)=>{
    const wire=Math.max(coveGroove(HIT.u,.04,.0018,t/projX),coveGroove(HIT.w,.04,.0018,t/projY));
    BG[i]=C(CYAN,2.1+L*.20*coveLight(HIT.nx,HIT.ny,HIT.nz)-12*wire);set(i,' ',0);return true;
  });
  box('sign',0,.024,.38,.024,2.32,2.58,.002,(i,t,L)=>{
    BG[i]=C(GREEN,1.1+L*.08);if(HIT.face===3&&jailExitText(i,HIT.u,HIT.w,t,letters,C(WHITE,13),BG[i]))return true;set(i,' ',0);return true;
  });
  const surfaces=hotelLobbyDraw(parts),draw=(vx,vy)=>{
    for(let k=0;k<letters.length;k++){
      const xx=vx-.048,yy=vy+(k-1.5)*.13,forward=dx*xx+dy*yy,across=-dy*xx+dx*yy;
      const col=Math.floor(cols/2+projX*across/forward),row=Math.floor(hor-(2.45-eye)*projY/forward);
      letters[k].i=forward>.01&&col>=0&&col<cols&&row>=0&&row<rows?row*cols+col:-1;
    }
    surfaces(vx,vy);
  };
  return {...ROOM_MODEL(x,y,draw),walk:true,radius:.80,jailExitDoor:{parts,letters}};
}
const JAIL_EXIT_PROPS=ROOM_DEFS.jail.props,JAIL_EXIT_WALL=ROOM_DEFS.jail.wall;
ROOM_DEFS.jail.props=r=>[...JAIL_EXIT_PROPS(r),JAIL_EXIT_DOOR(JAIL_W-1,7.5)];
ROOM_DEFS.jail.wall=(i,u,uStep,z,d,mx,my,L)=>JAIL_EXIT_WALL(i,u,uStep,z,d,mx===JAIL_W-1&&my>=6&&my<=8&&z<2.8?JAIL_W-2:mx,my,L);
