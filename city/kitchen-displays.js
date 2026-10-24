// Food cases contain supported solids behind sparse glass highlights. The clear
// panes never replace the food with a picture painted on their outer surface.
function foodRayEllipsoid(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,zc=(b.z0+b.z1)/2,hz=(b.z1-b.z0)/2;
  const u=(x*b.c+y*b.s)/b.hl,v=(-x*b.s+y*b.c)/b.hw,w=(oz-zc)/hz;
  const du=(rx*b.c+ry*b.s)/b.hl,dv=(-rx*b.s+ry*b.c)/b.hw,dw=rz/hz;
  const A=du*du+dv*dv+dw*dw,B=u*du+v*dv+w*dw,D=B*B-A*(u*u+v*v+w*w-1);
  if(D<0)return -1;const t=(-B-Math.sqrt(D))/A;if(t<.01)return -1;
  HIT.u=(u+du*t)*b.hl;HIT.v=(v+dv*t)*b.hw;HIT.w=oz+rz*t;
  const nu=(u+du*t)/b.hl,nv=(v+dv*t)/b.hw,nz=(w+dw*t)/hz,n=Math.hypot(nu,nv,nz);
  HIT.nx=(b.c*nu-b.s*nv)/n;HIT.ny=(b.s*nu+b.c*nv)/n;HIT.nz=nz/n;HIT.face=0;return t;
}
function foodOval(x,y,z,hl,hw,height,shade,c=1,s=0) {
  drawBox(boxAt(x,y,c,s,hl,hw,z,z+height),shade,foodRayEllipsoid);
}
function foodRayTray(ox,oy,oz,rx,ry,rz,b) {
  const outer=homeRayWorktop(ox,oy,oz,rx,ry,rz,b);if(outer<0)return outer;
  const ih=b.hl-.008,iw=b.hw-.008;
  if(HIT.face!==5||Math.abs(HIT.u)>=ih||Math.abs(HIT.v)>=iw)return outer;
  const u=ox-b.x,v=oy-b.y,bottom=b.z0+.008;let best=Infinity,nx=0,ny=0,nz=0;
  const take=(t,x,y,z)=>{
    if(t<outer||t>=best)return;
    const a=u+rx*t,d=v+ry*t,w=oz+rz*t;
    if(Math.abs(a)>ih+1e-8||Math.abs(d)>iw+1e-8||w<bottom-1e-8||w>b.z1+1e-8)return;
    best=t;nx=x;ny=y;nz=z;
  };
  if(Math.abs(rz)>1e-10)take((bottom-oz)/rz,0,0,1);
  for(const side of [-1,1]) {
    if(Math.abs(rx)>1e-10)take((side*ih-u)/rx,-side,0,0);
    if(Math.abs(ry)>1e-10)take((side*iw-v)/ry,0,-side,0);
  }
  if(!Number.isFinite(best))return -1;
  HIT.u=u+rx*best;HIT.v=v+ry*best;HIT.w=oz+rz*best;
  HIT.nx=nx;HIT.ny=ny;HIT.nz=nz;HIT.face=nz?5:0;return best;
}
const foodTrayProfiles=new Map();
function foodTray(x,y,z,hl,hw,depth=.045,shade=kitchenSteel) {
  // One closed shell owns the rim, four inner walls and recessed floor, rather
  // than five overlapping panel passes for every tray in a display.
  const key=[hl,hw,z,depth].join(':');
  if(!foodTrayProfiles.has(key)) {
    if(foodTrayProfiles.size>=32)foodTrayProfiles.clear();
    foodTrayProfiles.set(key,kitchenTopProfile(hl,hw,z,z+depth,.002));
  }
  drawBox({...boxAt(x,y,1,0,hl,hw,z,z+depth),...foodTrayProfiles.get(key)},shade,foodRayTray);
}
function counterPizza(x,y,z,scale=1) {
  const h=.018*scale,r=.18*scale;
  coveLathe(x,y,z,[[0,0],[0,r-.01],[.009,r],[h,r],[h+.006,r-.01],[h*.7,r-.025],[h*.7,0]],kitchenFoodShade(ORANGE));
  coveLathe(x,y,z+h*.7,[[0,0],[0,r-.025],[.002,r-.025],[.002,0]],(i,t,L)=>{
    const cut=coveGroove(Math.atan2(HIT.v,HIT.u)*r,Math.PI*r/3,.002,t/projX)*coveDetail(t);
    BG[i]=C(YEL,3+L*.35-cut*1.4);set(i,' ',0);return true;
  });
  for(let k=0;k<6;k++) {
    const a=k*Math.PI/3,rr=r*.56;
    coveLathe(x+Math.cos(a)*rr,y+Math.sin(a)*rr,z+h*.7+.002,
      [[0,0],[0,.018*scale],[.002,.018*scale],[.002,0]],kitchenFoodShade(RED));
  }
}
function counterPastry(x,y,z,kind=0) {
  if(kind%3===0) { // a crescent assembled from overlapping tapered dough lobes
    for(let k=0;k<5;k++) {
      const a=(k-2)*.43,rr=.055;
      foodOval(x+Math.sin(a)*rr,y+Math.cos(a)*rr-.03,z,.035-.004*Math.abs(k-2),.027,.045-.005*Math.abs(k-2),kitchenFoodShade(ORANGE),Math.cos(a),-Math.sin(a));
    }
  }else {
    const dark=kind%3===1;
    coveLathe(x,y,z,[[0,0],[0,.063],[.009,.068],[.075,.068],[.08,.062],[.08,0]],kitchenFoodShade(dark?BRICK:WHITE));
    coveLathe(x,y,z+.08,[[0,0],[0,.064],[.007,.06],[.007,0]],kitchenFoodShade(dark?WARM:MAG));
    for(const [u,v]of [[-.022,0],[.022,0],[0,.025]])foodOval(x+u,y+v,z+.087,.013,.013,.019,kitchenFoodShade(RED));
  }
}
function counterDeli(x,y,z,kind) {
  if(kind%3===0) { // sliced meats, each slice has its own exposed edge
    for(let k=0;k<4;k++)coveLathe(x+k*.009,y,z+k*.008,[[0,0],[0,.06],[.008,.06],[.008,0]],(i,t,L)=>{
      const fat=Math.sin(HIT.u*340)*Math.sin(HIT.v*280)*coveDetail(t);
      BG[i]=C(fat>.78?WHITE:RED,2.4+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    });
  }else if(kind%3===1) {
    coveLathe(x,y,z,[[0,0],[0,.08],[.08,.08],[.08,0]],(i,t,L)=>{
      const rind=HIT.face!==5;
      BG[i]=C(rind?ORANGE:YEL,2.6+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    });
  }else for(const [u,v]of [[-.035,-.018],[.035,-.018],[0,.035]])
    foodOval(x+u,y+v,z,.022,.016,.045,kitchenFoodShade(GREEN),.7,.7141428429);
}
function KITCHEN_FOOD_CASE(x,y,hl,hw,height,kind,base=BRICK) {
  const bottom=height-.42,shelf=bottom+.025,cabinet=base===BRICK?'wood':base===STONE?furnitureTimber(STONE):base;
  const levels=kind==='bento'||kind==='donuts'?[shelf,shelf+.17]:[shelf];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,0,bottom,.015,cabinet);
    drawBox({...boxAt(vx,vy,1,0,hl-.025,hw-.025,bottom,shelf),...kitchenTopProfile(hl-.025,hw-.025,bottom,shelf,.008)},kitchenSteel,homeRayWorktop);
    // Frames are joined rods. The shelf's top owns the supporting surface.
    for(const side of [-1,1]) {
      for(const end of [-1,1])coveTube(vx+side*(hl-.012),vy+end*(hw-.012),shelf,
        vx+side*(hl-.012),vy+end*(hw-.012),height,.012,GRAY);
      coveTube(vx-hl+.012,vy+side*(hw-.012),height,vx+hl-.012,vy+side*(hw-.012),height,.012,GRAY);
      coveTube(vx+side*(hl-.012),vy-hw+.012,height,vx+side*(hl-.012),vy+hw-.012,height,.012,GRAY);
    }
    const count=COUNTER_FOOD_CASES[kind]||(kind==='icecream'?8:kind==='deli'?9:kind==='pizza'?6:9),step=(hl*2-.3)/count;
    for(const level of levels) {
      if(level!==shelf)drawBox({...boxAt(vx,vy,1,0,hl-.018,hw-.018,level-.015,level),
        ...kitchenTopProfile(hl-.018,hw-.018,level-.015,level,.003)},kitchenSteel,homeRayWorktop);
      for(let k=0;k<count;k++) {
        const u=-hl+.15+step*(k+.5),xx=vx+u;
        if(COUNTER_FOOD_CASES[kind])counterCaseServing(xx,vy,level,kind,k,step,hw);
        else if(kind==='icecream')for(const side of [-1,1]) {
          const yy=vy+side*.19,th=.012,col=ICE[(k*3+(side>0?5:0))%ICE.length][0];
          foodTray(xx,yy,shelf,Math.min(.2,step*.43),.16,.095);
          foodOval(xx,yy,shelf+.008,Math.min(.18,step*.4),.142,.103,kitchenFoodShade(col));
        }else {
          foodTray(xx,vy,shelf,Math.min(step*.44,kind==='pizza'?.24:.16),hw-.075,.024);
          if(kind==='pizza') {if(hash(k,3,951)>.15)counterPizza(xx,vy,shelf+.008);}
          else if(kind==='deli')counterDeli(xx,vy,shelf+.008,k);
          else for(const side of [-1,1])counterPastry(xx,vy+side*.16,shelf+.008,k+(side>0?1:0));
        }
      }
    }
    // Only narrow reflected streaks write glass depth. Clear pixels preserve
    // the actual objects behind both front and end panes, from either side.
    drawBox(boxAt(vx,vy,1,0,hl-.012,hw-.012,shelf,height),(i,t,L)=>{
      const f=HIT.face,u=f<=2?HIT.v:HIT.u,v=f===5?HIT.v:HIT.w;
      const glint=coveGroove(u+v*.55,1.3,.003,t/projX)*coveDetail(t);
      if(glint<.5)return false;
      BG[i]=C(CYAN,2+L*.2);set(i,' ',0);return true;
    });
  },[hl,hw,height]),radius:hl+.5,foodCase:{kind,hl,hw,height,shelf,levels}};
}
function KITCHEN_PREP(x,y,hl,hw,height,kind='dumplings') {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,0,height-.035,.015,'wood');
    drawBox({...boxAt(vx,vy,1,0,hl,hw,height-.035,height),...kitchenTopProfile(hl,hw,height-.035,height)},kitchenSteel,homeRayWorktop);
    const boardH=.018,bhl=hl-.12,bhw=hw-.07;
    drawBox({...boxAt(vx,vy,1,0,bhl,bhw,height,height+boardH),...kitchenTopProfile(bhl,bhw,height,height+boardH,.007)},(i,t,L)=>{
      const fine=coveDetail(t),flour=(Math.sin(HIT.u*170)*Math.sin(HIT.v*210)>.65)*fine;
      coveTimber(i,HIT.u,HIT.v,L,t,HIT.nx,HIT.ny,HIT.nz,7);
      if(flour)BG[i]=C(WHITE,4+L*.2);return true;
    },homeRayWorktop);
    for(let k=0;k<6;k++) {
      const xx=vx-bhl*.7+k*bhl*1.4/5;
      if(kind==='dumplings')for(const side of [-1,1])
        foodOval(xx,vy+side*.12,height+boardH,.028,.023,.035,kitchenFoodShade(WHITE));
      else for(let strand=0;strand<3;strand++)for(let seg=0;seg<4;seg++) {
        const ya=-.16+seg*.08,yb=ya+.08,xa=xx+Math.sin(seg+strand)*.012,xb=xx+Math.sin(seg+1+strand)*.012;
        const az=height+boardH+.003,bz=az;
        const box={...boxAt((xa+xb)/2,vy+(ya+yb)/2,1,0,Math.abs(xb-xa)/2+.003,.043,az-.003,bz+.003),ax:xa,ay:vy+ya,az,bx:xb,by:vy+yb,bz,r:.003};
        drawBox(box,kitchenFoodShade(YEL),coveRayCapsule);
      }
    }
  },[hl,hw,height]),radius:hl+.3,prep:{kind,hl,hw,height}};
}
