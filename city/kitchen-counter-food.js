// Counter foods live inside the case, on actual trays. Silhouettes, hollows
// and compartments survive end views; fine frosting/grain fades with distance.
const COUNTER_FOOD_CASES={chicken:5,salad:7,bento:8,donuts:8,schmear:8};
const COUNTER_DONUT_PROFILE=Array.from({length:33},(_,k)=>{
  const a=-Math.PI/2+k*Math.PI/16;return [.022+Math.sin(a)*.022,.046+Math.cos(a)*.022];
});
function counterDonut(x,y,z,kind) {
  const glaze=[MAG,WHITE,BRICK,WARM][kind%4];
  coveLathe(x,y,z,COUNTER_DONUT_PROFILE,(i,t,L)=>{
    const frosted=HIT.nz>0,grain=Math.sin(HIT.u*330)*Math.sin(HIT.v*310)*coveDetail(t);
    BG[i]=C(frosted?glaze:ORANGE,3.6+L*.34*coveLight(HIT.nx,HIT.ny,HIT.nz)+(frosted&&grain>.7?.8:0));set(i,' ',0);return true;
  });
}
function counterBento(x,y,z) {
  const lacquer=(i,t,L)=>{
    BG[i]=C(HIT.w>z+.030?RED:GRAY,HIT.w>z+.030?2.8+L*.08:.4+L*.035);set(i,' ',0);return true;
  };
  foodTray(x,y,z,.14,.105,.035,lacquer);
  for(const [u,v,hl,hw]of [[-.015,0,.002,.097],[.06,0,.075,.0015]])
    drawBox({...boxAt(x+u,y+v,1,0,hl,hw,z+.008,z+.031),...kitchenPanelProfile(hl,hw,z+.008,z+.031,.0005)},lacquer,homeRayWorktop);
  foodOval(x-.075,y,z+.008,.045,.066,.037,kitchenFoodShade(WHITE));
  foodOval(x+.055,y-.045,z+.008,.06,.025,.028,(i,t,L)=>{
    const stripes=coveGroove(HIT.u+HIT.v*.7,.012,.0015,t/projX);
    BG[i]=C(ORANGE,3.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-stripes*.6);set(i,' ',0);return true;
  });
  drawBox({...boxAt(x+.065,y+.035,1,0,.040,.025,z+.008,z+.034),
    ...kitchenTopProfile(.040,.025,z+.008,z+.034,.004)},kitchenFoodShade(YEL),homeRayWorktop);
  for(const u of [.05,.08])foodOval(x+u,y+.075,z+.008,.014,.017,.023,kitchenFoodShade(GREEN));
}
function counterChicken(x,y,z,side) {
  foodOval(x,y,z,.045,.058,.07,(i,t,L)=>{
    const crumb=Math.sin(HIT.u*270)*Math.sin(HIT.v*310)*coveDetail(t);
    BG[i]=C(ORANGE,3.2+L*.34*coveLight(HIT.nx,HIT.ny,HIT.nz)+crumb*.4);set(i,' ',0);return true;
  });
  coveTube(x,y+side*.035,z+.025,x,y+side*.092,z+.018,.007,STONE);
  for(const u of [-.006,.006])foodOval(x+u,y+side*.092,z+.008,.009,.012,.022,kitchenFoodShade(STONE));
}
function counterSalad(x,y,z,hl,hw,kind) {
  const col=[GREEN,RED,WHITE,MAG,GREEN,WHITE,RED][kind%7];
  foodTray(x,y,z,hl,hw,.07);
  drawBox({...boxAt(x,y,1,0,hl-.009,hw-.009,z+.008,z+.05),
    ...kitchenTopProfile(hl-.009,hw-.009,z+.008,z+.05,.003)},kitchenFoodShade(col),homeRayWorktop);
  if(kind%7<5)for(let k=0;k<6;k++) {
    const u=(k%2?1:-1)*hl*.40,v=(Math.floor(k/2)-1)*hw*.55;
    foodOval(x+u,y+v,z+.05,.025,.029,.022,kitchenFoodShade(col));
  }
}
function counterSchmear(x,y,z,kind) {
  coveLathe(x,y,z,[[0,0],[0,.075],[.005,.085],[.05,.09],[.055,.09],[.055,.084],[.009,.079],[.008,0]],kitchenGlaze(WHITE));
  const col=[WHITE,WHITE,SKIN,WARM][kind%4];
  coveLathe(x,y,z+.008,[[0,0],[.001,.079],[.038,.083],[.038,0]],(i,t,L)=>{
    const chives=kind%4===1&&Math.sin(HIT.u*370)*Math.sin(HIT.v*290)*coveDetail(t)>.75;
    BG[i]=C(chives?GREEN:col,3.8+L*.31*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  });
}
function counterCaseServing(x,y,z,kind,k,step,hw) {
  if(kind==='bento') {
    for(const side of [-1,1])counterBento(x,y+side*.14,z);
  }else if(kind==='salad')counterSalad(x,y,z,Math.min(step*.43,.20),hw-.075,k);
  else if(kind==='schmear') {
    for(const side of [-1,1])counterSchmear(x,y+side*.13,z,k+(side>0?1:0));
  }else {
    foodTray(x,y,z,Math.min(step*.44,.18),hw-.075,.025);
    for(const side of [-1,1]) {
      if(kind==='chicken')counterChicken(x,y+side*.10,z+.008,side);
      else counterDonut(x,y+side*.13,z+.008,k+(side>0?1:0));
    }
  }
}
// The service side faces -X. Six real pans fit along the wall, with their
// openings cut from the same worktop measurements as their inner tray walls.
const KITCHEN_SALSA={bottom:.88,top:.93,binHalfX:.24,binHalfY:.125,pitch:.30,
  labels:['ROJA','VERDE','ONION','CREMA','LIME','PICO'],kinds:[1,0,2,5,4,6]};
function kitchenSalsaOpening(u,v) {
  const k=Math.round(v/KITCHEN_SALSA.pitch+2.5);
  return k>=0&&k<6&&Math.abs(u)<KITCHEN_SALSA.binHalfX-.008&&Math.abs(v-(k-2.5)*KITCHEN_SALSA.pitch)<KITCHEN_SALSA.binHalfY-.008;
}
function KITCHEN_SALSA_BAR(x=11.63,y=5.6) {
  const s=KITCHEN_SALSA;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.29,.94,0,.10,.014,kitchenIron);
    coveRound(vx,vy,1,0,.32,.97,.10,s.bottom,.015,kitchenSteel);
    drawBox({...boxAt(vx,vy,1,0,.35,1,s.bottom,s.top),...kitchenTopProfile(.35,1,s.bottom,s.top,.006)},(i,t,L)=>{
      if(HIT.face===5&&kitchenSalsaOpening(HIT.u,HIT.v))return false;
      return kitchenSteel(i,t,L);
    },homeRayWorktop);
    for(let k=0;k<6;k++){
      const v=(k-2.5)*s.pitch;
      counterSalad(vx,vy+v,s.bottom,s.binHalfX,s.binHalfY,s.kinds[k]);
      drawBox({...boxAt(vx-.326,vy+v,0,1,.13,.006,.76,.84),...kitchenPanelProfile(.13,.006,.76,.84,.002)},(i,t,L)=>{
        if(HIT.face!==3)return kitchenSteel(i,t,L);
        BG[i]=C(STONE,4+L*.25);
        set(i,worldText(s.labels[k],HIT.u,HIT.w,t,i,vx-.332,vy+v,.80,0,1,.024,.042),C(BLACK,0));return true;
      },homeRayWorktop);
    }
  }),box:boxAt(x,y,1,0,.35,1,0,.965),radius:1.2,kitchenSalsa:true};
}
