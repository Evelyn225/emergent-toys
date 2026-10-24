// Mahjong tables are joined tables carrying a felt-lined tray. Tiles are real
// runs: four walls two high, each player's hand standing upright facing them,
// and their discards face up in front of them. Each run is one closed box with
// seams between its tiles, white faces under coloured backs.
const MAHJONG_TILE={w:.026,l:.035,h:.02},MAHJONG_TOP=.70,MAHJONG_FELT=MAHJONG_TOP+.008;
const MAHJONG_MARKS=[RED,GREEN,BLUE,BLACK];
function mahjongRun(kind,back,ox,oy,hl,seed) {
  const {w,h}=MAHJONG_TILE;
  return (i,t,L)=>{
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz),f=t/projX,fine=coveDetail(t);
    const along=HIT.u+hl,k=Math.floor(along/w),seam=coveGroove(along,w,.0016,f);
    const layer=fract((HIT.w-MAHJONG_FELT)/h),out=HIT.nx*ox+HIT.ny*oy;
    // which part of the tile this is: its printed face, plain white, or the back
    const face=kind==='hand'?out>.5:kind==='discard'?HIT.face===5:false;
    const white=face||(kind==='wall'?HIT.face!==5&&layer<.5:kind==='discard'?HIT.face!==5&&layer>.45:out>-.5&&HIT.face!==5);
    BG[i]=C(white?WHITE:back,(white?4.4:2.8)+L*.38*light-seam*1.6);
    if(face&&fine>.3) {
      const cu=along-(k+.5)*w,cv=kind==='hand'?HIT.w-MAHJONG_FELT-.0175:HIT.v;
      if(Math.abs(cu)<.006&&Math.abs(cv)<.009)BG[i]=C(MAHJONG_MARKS[Math.floor(hash(k,seed,631)*4)],4+L*.2);
    }
    set(i,' ',0);return true;
  };
}
function MAHJONG_TABLE(x,y) {
  const {w,l,h}=MAHJONG_TILE,back=YEL,wood=furnitureTimber(BRICK),runs=[];
  // (u axis, outward normal) for each player's side
  for(const [k,[ox,oy]]of [[1,0],[0,1],[-1,0],[0,-1]].entries()) {
    const c=-oy,s=ox,at=(u,v)=>[c*u+ox*v,s*u+oy*v];
    const wallLen=17*w/2,[wx,wy]=at(0,.24); // each wall stops just short of the next one's inner face
    runs.push({kind:'wall',x:wx,y:wy,c,s,hl:wallLen,hw:l/2,z1:MAHJONG_FELT+2*h,ox,oy,k});
    const [hx,hy]=at(0,.36);runs.push({kind:'hand',x:hx,y:hy,c,s,hl:13*w/2,hw:h/2,z1:MAHJONG_FELT+l,ox,oy,k});
    const [dx_,dy_]=at(0,.12);runs.push({kind:'discard',x:dx_,y:dy_,c,s,hl:6*w/2,hw:l/2,z1:MAHJONG_FELT+h,ox,oy,k});
  }
  for(const r of runs){r.profile=kitchenTopProfile(r.hl,r.hw,MAHJONG_FELT,r.z1,.002);r.shade=mahjongRun(r.kind,back,r.ox,r.oy,r.hl,x*31+y*7+r.k);}
  const felt=(i,t,L)=>{
    if(HIT.nz>.9&&HIT.w<MAHJONG_FELT+.001) {
      const fibre=Math.sin(HIT.u*700)*Math.sin(HIT.v*650)*coveDetail(t);
      BG[i]=C(GREEN,2.2+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)+fibre*.15);set(i,' ',0);return true;
    }
    return wood(i,t,L);
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const r of runs)drawBox({...boxAt(vx+r.x,vy+r.y,r.c,r.s,r.hl,r.hw,MAHJONG_FELT,r.z1),...r.profile},r.shade,homeRayWorktop);
    foodTray(vx,vy,MAHJONG_TOP,.45,.45,.022,felt);
    drawFurnitureTable(vx,vy,.45,.45,MAHJONG_TOP);
  }),mj:true,cx:x,cy:y,box:boxAt(x,y,1,0,.45,.45,0,Math.max(...runs.map(r=>r.z1))),radius:.66,
    mahjong:{felt:MAHJONG_FELT,runs:runs.map(({kind,x,y,c,s,hl,hw,z1})=>({kind,x,y,c,s,hl,hw,z1}))}};
}

// Chinese thermos flasks of hot water: a printed red body on a steel foot, a
// steel shoulder and a cork, standing on the tea counter beside cups of tea.
const TEA_THERMOS=[[0,0],[0,.055],[.012,.06],[.02,.066],[.24,.066],[.27,.058],[.30,.04],[.32,.034],[.35,.03],[.36,.026],[.36,0]];
function teaThermosShade(seed,base) {
  return (i,t,L)=>{
    const z=HIT.w-base,light=coveLight(HIT.nx,HIT.ny,HIT.nz);
    if(z<.02||(z>.26&&z<.32))return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
    if(z>=.32){BG[i]=C(STONE,2.6+L*.3*light);set(i,' ',0);return true;} // the cork
    const band=Math.abs(z-.215)<.012,flower=Math.sin(Math.atan2(HIT.v,HIT.u)*7+seed)*Math.sin(z*90)>.82&&coveDetail(t)>.3;
    BG[i]=band?C(YEL,4.5+L*.3*light):C(flower?WHITE:RED,(flower?4:3.2)+L*.38*light);set(i,' ',0);return true;
  };
}
function TEA_COUNTER(x,y,hl=.6,hw=.3,height=.85) {
  const counter=KITCHEN_SERVICE_COUNTER(0,0,hl,hw,height,BRICK,BRICK),flasks=[-.3,0,.3].map((u,k)=>({u,shade:teaThermosShade(k*2.1,height)}));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const q of flasks)coveLathe(vx+q.u,vy-.06,height,TEA_THERMOS,q.shade);
    for(const [u,a]of [[-.15,.4],[.15,-.3],[.45,1.1]])kitchenCup(vx+u,vy+.14,height,a,WHITE,true);
    counter.draw(vx,vy);
  }),box:boxAt(x,y,1,0,hl,hw,0,height+TEA_THERMOS[TEA_THERMOS.length-1][0]),radius:hl+.2,teaCounter:{height,flasks:flasks.map(q=>q.u)}};
}
