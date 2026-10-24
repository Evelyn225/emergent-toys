// Drinks have a supported cabinet, working clearance, and separate wet/glass
// surfaces. Small ridges and reflections fade with projected size.
const DRINK_STATION={top:1,shakeHalf:.34,sodaHalf:.46,halfDepth:.27};
function kitchenDrinkBase(x,y,half) {
  for(const side of [-1,1])for(const end of [-1,1])
    coveLathe(x+side*(half-.05),y+end*.20,0,[[0,0],[0,.025],[.09,.025],[.09,0]],kitchenSteel);
  coveRound(x,y,1,0,half,.25,.075,.97,.018,kitchenGlaze(WHITE));
  drawBox({...boxAt(x,y,1,0,half+.015,.27,.97,DRINK_STATION.top),
    ...kitchenTopProfile(half+.015,.27,.97,DRINK_STATION.top,.006)},kitchenSteel,homeRayWorktop);
  // The cupboard is mounted to its front, with its handle ends in the door.
  drawBox({...boxAt(x,y+.252,1,0,half-.025,.008,.14,.90),
    ...kitchenPanelProfile(half-.025,.008,.14,.90,.004)},kitchenGlaze(WHITE),homeRayWorktop);
  coveTube(x-.07,y+.279,.81,x+.07,y+.279,.81,.009,GRAY);
  for(const side of [-1,1])coveTube(x+side*.07,y+.255,.81,x+side*.07,y+.279,.81,.007,GRAY);
}
function KITCHEN_SHAKE_MACHINE(x,y) {
  const top=DRINK_STATION.top;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    kitchenDrinkBase(vx,vy,DRINK_STATION.shakeHalf);
    coveRound(vx,vy-.13,1,0,.275,.065,top,1.61,.02,kitchenGlaze(GREEN));
    drawBox({...boxAt(vx,vy+.055,1,0,.28,.145,top,top+.035),
      ...kitchenTopProfile(.28,.145,top,top+.035,.006)},kitchenSteel,homeRayWorktop);
    for(const u of [-.18,0,.18]) {
      // Each head projects over a hollow steel mixing cup on a little rest.
      coveRound(vx+u,vy+.025,1,0,.074,.135,1.46,1.65,.025,kitchenGlaze(GREEN));
      coveLathe(vx+u,vy+.085,1.035,[[0,0],[0,.062],[.025,.062],[.025,0]],kitchenSteel);
      coveLathe(vx+u,vy+.085,1.06,[[0,0],[0,.044],[.01,.047],[.22,.060],[.225,.060],
        [.225,.055],[.018,.042],[.012,0]],kitchenSteel);
      coveLathe(vx+u,vy+.085,1.24,[[0,0],[0,.052],[.001,.052],[.001,0]],kitchenGlaze(WARM));
      coveTube(vx+u,vy+.085,1.235,vx+u,vy+.085,1.48,.008,GRAY);
      foodOval(vx+u,vy+.165,1.52,.022,.012,.04,kitchenGlaze(WHITE));
    }
  }),box:boxAt(x,y+.015,1,0,.355,.285,0,1.65),radius:.65,kitchenDrink:{kind:'shake',support:top}};
}
function KITCHEN_SODA_FOUNTAIN(x,y) {
  const top=DRINK_STATION.top,colors=[RED,ORANGE,BRICK,CYAN];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    kitchenDrinkBase(vx,vy,DRINK_STATION.sodaHalf);
    coveRound(vx,vy-.14,1,0,.405,.075,top,1.72,.018,kitchenSteel);
    coveRound(vx,vy-.025,1,0,.405,.17,1.39,1.72,.018,kitchenSteel);
    foodTray(vx,vy+.07,top,.405,.175,.035);
    for(let k=0;k<4;k++) {
      const u=(k-1.5)*.19;
      // Real separate badges, levers and bent nozzles occupy the recess.
      drawBox({...boxAt(vx+u,vy+.15,1,0,.073,.009,1.48,1.66),
        ...kitchenPanelProfile(.073,.009,1.48,1.66,.004)},kitchenGlaze(colors[k]),homeRayWorktop);
      coveTube(vx+u,vy+.105,1.40,vx+u,vy+.105,1.325,.012,GRAY);
      coveTube(vx+u,vy+.105,1.325,vx+u,vy+.18,1.325,.012,GRAY);
      coveTube(vx+u,vy+.18,1.325,vx+u,vy+.18,1.285,.012,GRAY);
      coveTube(vx+u,vy+.11,1.39,vx+u,vy+.18,1.43,.009,GRAY);
      foodOval(vx+u,vy+.18,1.418,.021,.016,.04,kitchenGlaze(colors[k]));
    }
    // A cup is supported by the recessed tray floor, clear of the nozzle.
    kitchenVessel(vx-.095,vy+.10,top+.008,'cup',WHITE,1.15);
  }),box:boxAt(x,y+.015,1,0,.475,.285,0,1.72),radius:.72,kitchenDrink:{kind:'soda',support:top}};
}
const SIPHON={bottom:1.11,radius:.085,bulbHeight:.17,fill:1.19,chamber:1.31};
function kitchenDrinkGlass(i,t,L,x,y) {
  // Clear areas retain the world behind them. Only the rim and narrow curved
  // reflected strips write depth; coffee is a separate volume behind these.
  const fine=coveDetail(t),rx=x+HIT.u,ry=y+HIT.v,rz=HIT.w-eye;
  const facing=Math.abs(HIT.nx*rx+HIT.ny*ry+HIT.nz*rz)/Math.max(.01,Math.hypot(rx,ry,rz));
  if(facing>.35&&!(fine>.2&&Math.abs(HIT.u+.031)<.007&&HIT.v>0))return false;
  BG[i]=C(WHITE,2+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function KITCHEN_SIPHON(x,y) {
  const z=SIPHON.bottom,coffee=kitchenFoodShade(BRICK),glass=kitchenGlaze(WHITE),
    fillRadius=.081*Math.sqrt(1-((SIPHON.fill-z-.004)/.081-1)**2);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const clearGlass=(i,t,L)=>kitchenDrinkGlass(i,t,L,vx,vy);
    coveLathe(vx,vy,1,[[0,0],[0,.12],[.018,.12],[.026,.10],[.026,0]],kitchenSteel);
    coveTube(vx-.108,vy,1.018,vx-.108,vy,1.37,.012,GRAY);
    coveTube(vx-.108,vy,1.30,vx,vy,1.30,.01,GRAY);
    // A small spirit burner and a shaped flame sit below the lower globe.
    coveLathe(vx,vy,1.026,[[0,0],[0,.033],[.035,.033],[.04,.019],[.04,0]],kitchenSteel);
    foodOval(vx,vy,1.066,.013,.013,.038,(i,t,L)=>{
      BG[i]=C(CYAN,7+Math.sin(T*9)*.8);set(i,' ',0);return true;
    });
    foodOval(vx,vy,z,.085,.085,.17,clearGlass);
    foodOval(vx,vy,z+.004,.081,.081,.162,(i,t,L)=>HIT.w<SIPHON.fill&&coffee(i,t,L));
    coveLathe(vx,vy,SIPHON.fill,[[0,0],[0,fillRadius],[.001,fillRadius],[.001,0]],coffee);
    coveLathe(vx,vy,1.26,[[0,.022],[.045,.022],[.05,.029],[.05,.023],[0,.017],[0,.022]],clearGlass);
    // The top is a genuinely hollow brewing chamber and rolled glass lip.
    coveLathe(vx,vy,SIPHON.chamber,[[0,0],[0,.042],[.012,.060],[.208,.060],[.214,.057],
      [.214,.053],[.016,.053],[.008,0]],(i,t,L)=>{
      if(HIT.part===1||HIT.part===7||HIT.w>SIPHON.chamber+.202)return glass(i,t,L);
      return clearGlass(i,t,L);
    });
    coveLathe(vx,vy,SIPHON.chamber+.015,[[0,0],[0,.052],[.052,.052],[.052,0]],coffee);
    coveTube(vx,vy,SIPHON.fill,vx,vy,SIPHON.chamber+.03,.006,GRAY);
    kitchenHandle(vx+.055,vy,SIPHON.chamber+.11,1,0,.047,.009,BRICK);
  }),box:boxAt(x,y,1,0,.12,.12,1,1.524),radius:.35,kitchenDrink:{kind:'siphon',support:1}};
}
