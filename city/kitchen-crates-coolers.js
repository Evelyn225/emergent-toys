// Drinks coolers, sacks and beer crates are built objects: a cooler is a lit
// carcass with shelves, real cans and bottles behind framed glass doors; sacks
// are filled pillows or open standing jute; crates are plastic shells holding
// bottles in a divided grid. Nothing is painted onto a box face any more.
const COOLER_HEIGHT=1.95,COOLER_LEVELS=[.12,.44,.76,1.08,1.40],COOLER_TOP=1.75,COOLER_WALL=.03;
const COOLER_COLOURS=[RED,GREEN,ORANGE,WHITE,YEL,CYAN,BLUE,MAG];
const COOLER_CAN=[[0,0],[0,.030],[.004,.033],[.112,.033],[.120,.026],[.122,.026],[.122,0]];
const COOLER_BOTTLE=[[0,0],[0,.027],[.005,.030],[.15,.030],[.20,.014],[.25,.012],[.255,.014],[.262,.013],[.262,0]];
const CRATE_BOTTLE=[[0,0],[0,.033],[.006,.036],[.19,.036],[.235,.016],[.275,.014],[.282,.016],[.29,.014],[.29,0]];
function coolerCanShade(col,top) {
  return (i,t,L)=>{
    const lid=HIT.w>top-.008,light=coveLight(HIT.nx,HIT.ny,HIT.nz);
    if(lid)return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
    BG[i]=C(col,4.2+L*.42*light);set(i,' ',0);return true;
  };
}
function coolerBottleShade(col,glass,base) {
  return (i,t,L)=>{
    const z=HIT.w-base,light=coveLight(HIT.nx,HIT.ny,HIT.nz);
    if(z>.248){BG[i]=C(col,5+L*.3*light);set(i,' ',0);return true;} // the cap
    BG[i]=z>.06&&z<.13?C(col,4.4+L*.42*light):C(glass,2.2+L*.3*light);set(i,' ',0);return true;
  };
}
// (fx,fy) points out of the doors into the room; the back stands at the wall.
function KITCHEN_DRINKS_COOLER(x,y,half,depth,fx,fy) {
  const c=-fy,s=fx,doors=Math.max(2,Math.round(half*2/.6)),pitch=half*2/doors,steel=kitchenSteel;
  const panel=(hl,hw,z0,z1)=>({...kitchenPanelProfile(hl,hw,z0,z1,.004)});
  const facing=()=>HIT.nx*fx+HIT.ny*fy>.6;
  const carcass=(i,t,L)=>facing()&&HIT.w<COOLER_TOP&&HIT.w>COOLER_LEVELS[0]?(BG[i]=C(WHITE,6+L*.25),set(i,' ',0),true):steel(i,t,L);
  const header=(i,t,L)=>{
    if(!facing())return steel(i,t,L);
    BG[i]=C(WHITE,9+L*.2);
    set(i,worldText('COLD DRINKS',-HIT.u,HIT.w,t,i,headerX,headerY,COOLER_TOP+.1,ex,ey,.055,.075),C(BLACK,0));return true;
  };
  const grille=(i,t,L)=>{
    if(!facing())return steel(i,t,L);
    const slot=coveGroove(HIT.w,.025,.010,t/projX);BG[i]=C(GRAY,Math.max(.5,2.4+L*.2-slot*2));set(i,' ',0);return true;
  };
  const glass=(i,t,L)=>{
    const glint=coveGroove(HIT.u+HIT.w*.55,1.1,.004,t/projX)*coveDetail(t);
    if(glint<.5)return false;BG[i]=C(CYAN,2.4+L*.2);set(i,' ',0);return true;
  };
  const ex=fy,ey=-fx;let headerX=0,headerY=0;
  // Products: one front-facing row per shelf, cans and bottles on alternate
  // shelves, grouped in facings of three.
  const goods=[],inner=half-COOLER_WALL-.01;
  for(const [row,z]of COOLER_LEVELS.entries()) {
    const can=row%2===0,spacing=can?.074:.068,n=Math.floor(inner*2/spacing);
    for(let k=0;k<n;k++) {
      const col=COOLER_COLOURS[Math.floor(hash(Math.floor(k/3),row,x*7+y,601)*COOLER_COLOURS.length)];
      const glassCol=[GREEN,BRICK,WHITE][Math.floor(k/3+row)%3];
      goods.push({u:(k-(n-1)/2)*spacing,v:depth-.12,z,can,shade:can?coolerCanShade(col,z+.122):coolerBottleShade(col,glassCol,z)});
    }
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    [headerX,headerY]=at(0,depth-.01);
    for(let d=0;d<doors;d++) { // handles first: the nearest parts
      const u=-half+pitch*(d+.5)+(d%2?-1:1)*(pitch/2-.07),[ax,ay]=at(u,depth+.035),[bx,by]=at(u,depth+.01);
      coveTube(ax,ay,.80,ax,ay,1.30,.011,GRAY);
      for(const z of [.82,1.28])coveTube(ax,ay,z,bx,by,z,.007,GRAY);
    }
    for(let d=0;d<=doors;d++) {
      const [sx,sy]=at(-half+pitch*d,depth-.015),w=d===0||d===doors?.022:.03;
      drawBox({...boxAt(sx,sy,c,s,w,.015,COOLER_LEVELS[0],COOLER_TOP),...panel(w,.015,COOLER_LEVELS[0],COOLER_TOP)},steel,homeRayWorktop);
    }
    for(const [z0,z1]of [[COOLER_LEVELS[0],COOLER_LEVELS[0]+.04],[COOLER_TOP-.04,COOLER_TOP]]) {
      const [rx,ry]=at(0,depth-.015);drawBox({...boxAt(rx,ry,c,s,half,.015,z0,z1),...panel(half,.015,z0,z1)},steel,homeRayWorktop);
    }
    const [wx,wy]=at(0,depth-.015);drawBox(boxAt(wx,wy,c,s,half-.02,.004,COOLER_LEVELS[0]+.04,COOLER_TOP-.04),glass);
    for(const q of goods) {
      const [gx,gy]=at(q.u,q.v);coveLathe(gx,gy,q.z,q.can?COOLER_CAN:COOLER_BOTTLE,q.shade);
    }
    for(const z of COOLER_LEVELS.slice(1)) {
      const [sx,sy]=at(0,-.03);
      drawBox({...boxAt(sx,sy,c,s,half-COOLER_WALL,depth-.08,z-.015,z),...kitchenTopProfile(half-COOLER_WALL,depth-.08,z-.015,z,.003)},steel,homeRayWorktop);
    }
    const [hx,hy]=at(0,0);
    drawBox({...boxAt(hx,hy,c,s,half,depth,COOLER_TOP,COOLER_HEIGHT),...kitchenTopProfile(half,depth,COOLER_TOP,COOLER_HEIGHT,.01)},header,homeRayWorktop);
    drawBox({...boxAt(hx,hy,c,s,half,depth,0,COOLER_LEVELS[0]),...panel(half,depth,0,COOLER_LEVELS[0])},grille,homeRayWorktop);
    for(const side of [-1,1]) {
      const [sx,sy]=at(side*(half-COOLER_WALL/2),0);
      drawBox({...boxAt(sx,sy,c,s,COOLER_WALL/2,depth,COOLER_LEVELS[0],COOLER_TOP),...panel(COOLER_WALL/2,depth,COOLER_LEVELS[0],COOLER_TOP)},steel,homeRayWorktop);
    }
    const [bx,by]=at(0,-depth+COOLER_WALL/2);
    drawBox({...boxAt(bx,by,c,s,half,COOLER_WALL/2,COOLER_LEVELS[0],COOLER_TOP),...panel(half,COOLER_WALL/2,COOLER_LEVELS[0],COOLER_TOP)},carcass,homeRayWorktop);
  }),box:boxAt(x,y,c,s,half,depth,0,COOLER_HEIGHT),radius:Math.hypot(half,depth)+.05,
    drinksCooler:{half,depth,fx,fy,doors,goods:goods.map(({u,v,z,can})=>({u,v,z,can}))}};
}

// ---- sacks
function sackWeave(base,lv) {
  return (i,t,L)=>{
    const f=t/projX,weave=(coveGroove(HIT.u,.006,.002,f)+coveGroove(HIT.w+HIT.v,.006,.002,f))*coveDetail(t);
    BG[i]=C(base,lv+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)-weave*.6);set(i,' ',0);return true;
  };
}
// Paper flour sacks lie flat, printed with blue bands: two layers of two,
// one across the top. Each layer's underside meets the flat top beneath.
const FLOUR_SACK={hl:.3,hw:.225,h:.16,r:.06};
function flourSackLayout() {
  const {hl,hw,h}=FLOUR_SACK,out=[];
  for(let layer=0;layer<2;layer++)for(const v of [-hw,hw])out.push({u:0,v,c:1,s:0,z0:layer*h,z1:(layer+1)*h});
  out.push({u:0,v:0,c:0,s:1,z0:2*h,z1:3*h});
  return out.map(q=>({...q,hl,hw}));
}
function KITCHEN_FLOUR_SACKS(x,y) {
  const sacks=flourSackLayout(),{hl,hw,h,r}=FLOUR_SACK,paper=sackWeave(WHITE,6);
  const printed=(i,t,L)=>{
    paper(i,t,L);
    if(HIT.nz>.3&&Math.abs(Math.abs(HIT.u)-hl*.66)<.02)BG[i]=C(BLUE,4+L*.2); // the printed bands
    return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=sacks.length-1;k>=0;k--) {
      const q=sacks[k],sx=vx+q.u,sy=vy+q.v;
      coveRound(sx,sy,q.c,q.s,q.hl,q.hw,q.z0,q.z1,r,printed);
    }
  }),box:boxAt(x,y,1,0,hl,hw*2,0,3*h),radius:Math.hypot(hl,hw*2),sacks:{kind:'flour',parts:sacks,round:r}};
}
// An opened paper sack standing on a worktop: its filled body, and the
// mouth folded over in a flat roll across the top.
function KITCHEN_UPRIGHT_FLOUR_SACK(x,y,z) {
  const paper=sackWeave(WHITE,6),printed=(i,t,L)=>{
    paper(i,t,L);if(Math.abs(HIT.w-z-.12)<.02&&HIT.nz<.5)BG[i]=C(BLUE,4+L*.2);return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.17,.035,z+.30,z+.35,.017,paper);
    coveRound(vx,vy,1,0,.2,.15,z,z+.31,.05,printed);
  }),box:boxAt(x,y,1,0,.2,.15,z,z+.35),radius:.26,sack:{kind:'flour',upright:true,floor:z,body:[z,z+.31],fold:[z+.30,z+.35]}};
}
// Open jute coffee sacks stand with their tops rolled down round the beans,
// printed with two stripes all the way round.
const COFFEE_SACK=[[0,0],[0,.17],[.03,.2],[.25,.23],[.44,.212],[.50,.214],[.525,.228],[.548,.218],[.55,.200],[.535,.192],[.47,.188],[.47,0]];
const COFFEE_BEANS=.47;
function KITCHEN_COFFEE_SACK(x,y,origin) {
  const jute=sackWeave(STONE,3);
  const shade=(i,t,L)=>{
    if(HIT.nz>.9&&HIT.w<COFFEE_BEANS+.002) { // green coffee: pale olive beans
      const bean=Math.sin(HIT.u*420)*Math.sin(HIT.v*380+HIT.u*90)*coveDetail(t);
      BG[i]=C(YEL,2.6+L*.22-Math.max(0,bean)*1.1);set(i,' ',0);return true;
    }
    jute(i,t,L);
    if(Math.abs(HIT.w-.13)<.014||Math.abs(HIT.w-.37)<.014)BG[i]=C(RED,2.6+L*.2);
    return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveLathe(vx,vy,0,COFFEE_SACK,shade)),
    box:boxAt(x,y,1,0,.23,.23,0,.55),radius:.25,sack:{kind:'coffee',origin,beans:COFFEE_BEANS}};
}

// ---- beer crates
const CRATE_COLS=5,CRATE_ROWS=4;
function crateShell(col,hl,hw) {
  // (top,base) bound one crate. Closed crates have open lattice sides, dark
  // because their insides are in shadow; every crate has a hand hold at each
  // end and a seam where it sits on the one below. Upturned bases show the
  // drainage grid.
  return (i,t,L,top=-9,base=-9,lattice=false)=>{
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz),f=t/projX,z=HIT.w;
    let dark=0;
    if(HIT.face===5)dark=Math.min(1,coveGroove(HIT.u,.045,.014,f)+coveGroove(HIT.v,.045,.014,f))*.7;
    else if(HIT.face!==6) {
      const end=HIT.face<=2,along=end?HIT.v/hw:HIT.u/hl,cells=end?2:4,k=fract((along+1)/2*cells);
      if(z<base+.012)dark=1.6;
      else if(end&&Math.abs(HIT.v)<.07&&z>top-.09&&z<top-.045)dark=2.4; // the hand hold
      else if(lattice&&k>.14&&k<.86&&z>base+.05&&z<top-(end?.11:.07))dark=2.4;
    }
    BG[i]=C(col,Math.max(.3,4.6+L*.42*light-dark*2));set(i,' ',0);return true;
  };
}
// A stack of `levels` crates, each `h` tall. Closed crates are stacked or
// upturned (their solid base on top); an open top crate holds empty bottles
// in a divided grid with their necks above the rim.
function KITCHEN_BEER_CRATE(x,y,{levels=1,open=false,hl=.3,hw=.22,h=.3,col=YEL}={}) {
  const shade=crateShell(col,hl,hw),closed=open?levels-1:levels,top=closed*h,openH=.25;
  const cellU=(hl-.008)*2/CRATE_COLS,cellV=(hw-.008)*2/CRATE_ROWS,bottles=[];
  if(open)for(let i=0;i<CRATE_COLS;i++)for(let j=0;j<CRATE_ROWS;j++)
    if(hash(i,j,x*13+y,611)>.1)bottles.push({u:-hl+.008+cellU*(i+.5),v:-hw+.008+cellV*(j+.5),z:top+.008});
  const glass=(i,t,L)=>{
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz),glint=HIT.nz<.3&&light>.9;
    BG[i]=C(BRICK,1.6+L*.28*light+(glint?2:0));set(i,' ',0);return true;
  };
  const profiles=Array.from({length:closed},(_,k)=>kitchenTopProfile(hl,hw,k*h,(k+1)*h,.012));
  const crates=profiles.map((_,k)=>(i,t,L)=>shade(i,t,L,(k+1)*h,k*h,true)),rim=(i,t,L)=>shade(i,t,L,top+openH,top);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const q of bottles)coveLathe(vx+q.u,vy+q.v,q.z,CRATE_BOTTLE,glass);
    if(open) {
      for(let i=1;i<CRATE_COLS;i++)drawBox({...boxAt(vx-hl+.008+cellU*i,vy,1,0,.003,hw-.008,top+.008,top+openH-.03),
        ...kitchenPanelProfile(.003,hw-.008,top+.008,top+openH-.03,.001)},shade,homeRayWorktop);
      for(let j=1;j<CRATE_ROWS;j++)drawBox({...boxAt(vx,vy-hw+.008+cellV*j,1,0,hl-.008,.003,top+.008,top+openH-.03),
        ...kitchenPanelProfile(hl-.008,.003,top+.008,top+openH-.03,.001)},shade,homeRayWorktop);
      foodTray(vx,vy,top,hl,hw,openH,rim);
    }
    for(let k=closed-1;k>=0;k--)drawBox({...boxAt(vx,vy,1,0,hl,hw,k*h,(k+1)*h),...profiles[k]},crates[k],homeRayWorktop);
  }),box:boxAt(x,y,1,0,hl,hw,0,open?Math.max(top+openH,...bottles.map(q=>q.z+.29)):top),radius:Math.hypot(hl,hw)+.02,
    beerCrate:{levels,open,hl,hw,h,top,openH,bottles,cell:[cellU,cellV]}};
}
