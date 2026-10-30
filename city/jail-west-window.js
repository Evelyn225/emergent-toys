// The high opening is privacy glazing: retain its diffuse weather light and
// fit closed frame, sill and round steel guards instead of painted strokes.
function jailBlockText(i,u,z,t,letters,color,background) {
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const dn=WH.dn,sl=WH.sl,wc=WH.wc,step=t/(projX*Math.max(1e-6,Math.abs(rx-dy/projX)));
  WH.dn=Math.max(1e-6,Math.abs(rx*t));WH.sl=-ry/(Math.abs(rx)||1e-6);WH.wc=u;
  try{
    if(wallTextBig(u,step,t,0,.15,.22,7))return wallText(i,u,step,z,t,'BLOCK C',0,1.6,.15,.22,color,background);
    for(const p of letters)if(p.i===i){BG[i]=background;set(i,p.ch,color);return true;}
    return false;
  }finally{WH.dn=dn;WH.sl=sl;WH.wc=wc;}
}
function JAIL_WEST_WINDOW(x,y) {
  const parts=[],letters=[...'BLOCK C'].map(ch=>({ch,i:-1})),metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const pane=hotelLobbyRound(parts,'pane',.004,.61,2.1,2.6,0,(i,t,L)=>{
    BG[i]=C(CYAN,1+day*6);set(i,' ',0);return true;
  });pane.box.x=.014;
  for(const u of [-.4,-.2,0,.2,.4]){
    hotelLobbyTube(parts,'bar',.1,u,2.1,.1,u,2.6,.014,metal);parts.at(-1).ray=hotelCurtainRodRay;
  }
  const sign=hotelLobbyRound(parts,'sign',.60,.024,1.45,1.75,.002,(i,t,L)=>{
    BG[i]=C(GRAY,1.2+L*.12);if(HIT.face===3&&jailBlockText(i,HIT.u,HIT.w,t,letters,C(YEL,13),BG[i]))return true;set(i,' ',0);return true;
  });Object.assign(sign.box,{x:.024,y:0,c:0,s:-1});Object.assign(sign.view,sign.box);
  const surfaces=hotelLobbyDraw(parts),draw=(vx,vy)=>{
    for(let k=0;k<letters.length;k++){
      const xx=vx+.048,yy=vy-(k-3)*.15,forward=dx*xx+dy*yy,across=-dy*xx+dx*yy;
      const col=Math.floor(cols/2+projX*across/forward),row=Math.floor(hor-(1.6-eye)*projY/forward);
      letters[k].i=forward>.01&&col>=0&&col<cols&&row>=0&&row<rows?row*cols+col:-1;
    }
    surfaces(vx,vy);
  };
  return {...ROOM_MODEL(x,y,draw),walk:true,radius:.75,jailWestWindow:{parts,letters}};
}
const JAIL_WINDOW_PROPS=ROOM_DEFS.jail.props,JAIL_WINDOW_WALL=ROOM_DEFS.jail.wall;
ROOM_DEFS.jail.props=r=>{
  const casing=HOME_WINDOW_CASING({face:'west',center:7.5,half:.7,bottom:2,top:2.7},r.W,r.H,1);
  casing.jailWindowCasing=casing.windowCasing;delete casing.windowCasing;
  return [...JAIL_WINDOW_PROPS(r),casing,JAIL_WEST_WINDOW(1,7.5)];
};
ROOM_DEFS.jail.wall=(i,u,uStep,z,d,mx,my,L)=>JAIL_WINDOW_WALL(i,u,uStep,z,d,mx===0&&my>=6&&my<=8&&Math.abs(Math.abs(u)-7.5)<.8&&z>1.4&&z<2.8?1:mx,my,L);
