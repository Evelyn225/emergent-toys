// Mounted displays replace flat wall pictures. Upright rings and hollow cups
// share the food/tableware profiles; labels use the prop font's projection.
const KITCHEN_BAGEL_FLAVOURS=['PLAIN','SESAME','POPPY','EVERYTHING','ONION','RAISIN','SALT','GARLIC'];
const KITCHEN_UPRIGHT_RING_SHAPE={x:0,y:0,profile:COUNTER_DONUT_PROFILE.map(([z,r])=>[z-.022,r])};
function kitchenRayUprightRing(ox,oy,oz,rx,ry,rz,b) {
  const t=coveRayLathe(ox-b.x,oz-b.centerZ,oy-b.y,rx,rz,ry,KITCHEN_UPRIGHT_RING_SHAPE);
  if(t<0)return t;
  const v=HIT.v,w=HIT.w,ny=HIT.ny,nz=HIT.nz;
  HIT.v=w;HIT.w=b.centerZ+v;HIT.ny=nz;HIT.nz=ny;HIT.face=0;return t;
}
function kitchenUprightBagel(x,y,floor,kind) {
  const centerZ=floor+.068,sesameKind=kind===1||kind===3||kind===6||kind===7,poppyKind=kind===2||kind===3;
  drawBox({...boxAt(x,y,1,0,.068,.022,floor,floor+.136),centerZ},(i,t,L)=>{
    const fine=coveDetail(t),grain=Math.sin(HIT.u*470)*Math.sin((HIT.w-centerZ)*410)*fine;
    const sesame=sesameKind&&grain>.79,poppy=poppyKind&&grain<-.83;
    BG[i]=C(poppy?BLACK:sesame?STONE:WARM,poppy?0:3.2+L*.33*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain*.18);set(i,' ',0);return true;
  },kitchenRayUprightRing);
}
function KITCHEN_BAGEL_RACK(x=5,y=1.15) {
  const levels=[1.22,1.72],half=1.38,wood=furnitureTimber(BRICK),labels=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)labels.push({word:KITCHEN_BAGEL_FLAVOURS[row*4+col],x:x-1.05+col*.7,y:y+.133,z:levels[row]-.0625});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const side of [-1,1])coveRound(vx+side*1.36,vy-.125,1,0,.02,.025,1.105,1.98,.006,wood);
    coveRound(vx,vy-.125,1,0,half,.025,1.94,1.98,.006,wood);
    for(const [row,z]of levels.entries()) {
      drawBox({...boxAt(vx,vy,1,0,half,.125,z-.025,z),...kitchenTopProfile(half,.125,z-.025,z,.003)},wood,homeRayWorktop);
      for(let col=0;col<4;col++) {
        const u=-1.05+col*.7,kind=row*4+col,word=KITCHEN_BAGEL_FLAVOURS[kind];
        foodTray(vx+u,vy,z,.30,.125,.04,wood);
        drawBox({...boxAt(vx+u,vy-.118,1,0,.30,.007,z+.008,z+.15),
          ...kitchenPanelProfile(.30,.007,z+.008,z+.15,.003)},wood,homeRayWorktop);
        for(const du of [-.2175,-.0725,.0725,.2175])for(const dv of [-.05,.06])
          kitchenUprightBagel(vx+u+du,vy+dv,z+.008,kind);
        const bandZ=z-.0625;
        drawBox({...boxAt(vx+u,vy+.125,1,0,.295,.008,z-.10,z-.025),
          ...kitchenPanelProfile(.295,.008,z-.10,z-.025,.003)},(i,t,L)=>{
          if(HIT.face!==3)return wood(i,t,L);
          BG[i]=C(STONE,4+L*.25);
          set(i,worldText(word,HIT.u,HIT.w,t,i,vx+u,vy+.133,bandZ,1,0,.038,.052),C(BLACK,0));return true;
        },homeRayWorktop);
        for(const du of [-.27,.27])foodOval(vx+u+du,vy+.134,z-.07,.006,.003,.012,kitchenSteel);
      }
    }
  }),box:boxAt(x,y,1,0,half,.15,1.105,1.98),radius:1.6,kitchenRack:{kind:'bagels',levels,labels}};
}
function KITCHEN_CUP_RACK(x=4.6,y=1.12) {
  const levels=[1.20,1.56,1.92],half=1.8,wood=furnitureTimber(BRICK),colors=[WHITE,BLUE,RED,GREEN,YEL,WHITE],scales=[.8,.95,1.15];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const side of [-1,1]) {
      coveRound(vx+side*half,vy-.095,1,0,.025,.025,1.145,2.10,.007,wood);
      for(const z of [1.30,2.02])foodOval(vx+side*half,vy-.068,z,.009,.003,.018,kitchenSteel);
    }
    for(const [row,z]of levels.entries()) {
      drawBox({...boxAt(vx,vy,1,0,half,.12,z-.025,z),...kitchenTopProfile(half,.12,z-.025,z,.003)},wood,homeRayWorktop);
      for(let k=0;k<12;k++) {
        const u=(k-5.5)*.28,scale=scales[(k+row)%3],col=colors[(k+row*2)%colors.length];
        kitchenVessel(vx+u,vy,z,'cup',col,scale);
        kitchenHandle(vx+u+.04*scale,vy,z+.057*scale,1,0,.032*scale,.006,col);
      }
    }
  }),box:boxAt(x,y,1,0,half+.025,.12,1.145,2.10),radius:2,kitchenRack:{kind:'cups',levels}};
}
