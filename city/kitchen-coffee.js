// Coffee apparatus: closed metal shells, hollow glass/ceramic vessels and
// working parts attached to their supports rather than painted on a box.
const COFFEE_DRUM=[[-.28,0],[-.28,.26],[-.25,.29],[.22,.29],[.26,.26],[.26,0]];
function kitchenRayRoastDrum(ox,oy,oz,rx,ry,rz,b) {
  // Reuse the closed lathe intersection with its axis along the room's y.
  const t=coveRayLathe(ox-b.x,oz-b.axisZ,oy-b.y,rx,rz,ry,{x:0,y:0,profile:COFFEE_DRUM});
  if(t<0)return t;
  const v=HIT.v,w=HIT.w,ny=HIT.ny,nz=HIT.nz;
  HIT.v=w;HIT.w=b.axisZ+v;HIT.ny=nz;HIT.nz=ny;HIT.face=0;return t;
}
const kitchenBrass=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
function KITCHEN_COFFEE_ROASTER(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const u of [-.32,.32])for(const v of [-.23,.23])
      coveLathe(vx+u,vy+v,0,[[0,0],[0,.03],[.10,.03],[.10,0]],kitchenSteel);
    coveRound(vx,vy,1,0,.41,.31,.075,.54,.025,kitchenSteel);
    drawBox({...boxAt(vx,vy,1,0,.29,.28,.49,1.07),axisZ:.78},kitchenSteel,kitchenRayRoastDrum);
    foodOval(vx,vy+.275,.535,.245,.025,.49,kitchenBrass);
    coveTube(vx-.10,vy+.321,.78,vx+.10,vy+.321,.78,.012,BRICK);
    for(const side of [-1,1])coveTube(vx+side*.10,vy+.295,.78,vx+side*.10,vy+.321,.78,.009,GRAY);
    // The hopper is open and thin-walled; its throat enters the drum.
    coveLathe(vx,vy,1.06,[[0,.045],[.08,.045],[.37,.23],[.39,.23],[.395,.225],
      [.395,.219],[.09,.039],[0,.039],[0,.045]],kitchenBrass);
    coveLathe(vx+.27,vy-.24,.83,[[0,0],[0,.04],[2.17,.04],[2.17,0]],kitchenSteel);
    // A pedestal supports the cooling pan independently of the roaster body.
    coveRound(vx+.04,vy+.62,1,0,.14,.14,0,.51,.02,kitchenSteel);
    coveLathe(vx+.04,vy+.62,.50,[[0,0],[0,.29],[.02,.32],[.145,.32],
      [.15,.315],[.15,.305],[.025,.30],[.015,0]],kitchenSteel);
    const beans=(i,t,L)=>{
      const fine=coveDetail(t),grain=Math.sin(HIT.u*170)*Math.sin(HIT.v*190)*fine;
      BG[i]=C(BRICK,1.4+L*.17+grain*.35);set(i,' ',0);return true;
    };
    coveLathe(vx+.04,vy+.62,.58,[[0,0],[0,.30],[.005,.30],[.005,0]],beans);
    for(let k=0;k<12;k++) {
      const a=k*2.39996,r=.09+.14*(k%3)/2;
      foodOval(vx+.04+Math.cos(a)*r,vy+.62+Math.sin(a)*r,.585,.018,.012,.018,beans,Math.cos(a),Math.sin(a));
    }
    coveLathe(vx+.04,vy+.62,.51,[[0,0],[0,.015],[.26,.015],[.26,0]],kitchenSteel);
    const a=T*1.5;
    coveTube(vx+.04-Math.cos(a)*.27,vy+.62-Math.sin(a)*.27,.61,
      vx+.04+Math.cos(a)*.27,vy+.62+Math.sin(a)*.27,.61,.009,GRAY);
  }),box:boxAt(x,y+.32,1,0,.43,.64,0,1.455),radius:1.2,kitchenCoffee:{kind:'roaster'}};
}
const COFFEE_CARAFE=[[0,0],[0,.055],[.02,.067],[.10,.061],[.16,.03],[.17,.031],
  [.17,.026],[.10,.056],[.02,.061],[.007,0]];
const COFFEE_CONE=[[0,.010],[.01,.016],[.14,.075],[.15,.075],[.15,.070],[.015,.011],[0,.006],[0,.010]];
function KITCHEN_POUR_OVER(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,1,[[0,0],[0,.105],[.02,.105],[.02,0]],kitchenSteel);
    coveTube(vx-.087,vy,1.02,vx-.087,vy,1.30,.009,BRICK);
    coveTube(vx-.087,vy,1.30,vx-.03,vy,1.30,.008,BRICK);
    coveLathe(vx,vy,1.02,COFFEE_CARAFE,(i,t,L)=>{
      if(HIT.w>1.182||HIT.part===1||HIT.part===9)return kitchenSteel(i,t,L);
      return kitchenDrinkGlass(i,t,L,vx,vy);
    });
    coveLathe(vx,vy,1.027,[[0,0],[0,.052],[.013,.060],[.065,.056],[.065,0]],kitchenFoodShade(BRICK));
    kitchenHandle(vx+.061,vy,1.095,1,0,.031,.006,BRICK);
    const ceramic=kitchenGlaze(WHITE),paper=kitchenGlaze(STONE);
    coveLathe(vx,vy,1.24,COFFEE_CONE,(i,t,L)=>(HIT.part===5?paper:ceramic)(i,t,L));
    // A paper filter and grounds sit below the lip, above the drain throat.
    const groundsRadius=.011+(.070-.011)*(.08-.015)/(.15-.015);
    coveLathe(vx,vy,1.255,[[0,0],[0,.011],[.065,groundsRadius],[.065,0]],kitchenFoodShade(BRICK));
    foodOval(vx,vy,1.228-fract(T*1.8)*.09,.003,.003,.008,kitchenFoodShade(BRICK));
  }),box:boxAt(x,y,1,0,.106,.106,1,1.39),radius:.25,kitchenCoffee:{kind:'pour-over'}};
}
function KITCHEN_ESPRESSO(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy-.16,1,0,.31,.07,1,1.50,.015,kitchenSteel);
    coveRound(vx,vy-.035,1,0,.31,.19,1.31,1.50,.02,kitchenGlaze(RED));
    foodTray(vx,vy+.03,1,.30,.195,.035);
    for(const u of [-.135,.135]) {
      coveLathe(vx+u,vy+.055,1.245,[[0,0],[0,.038],[.085,.038],[.085,0]],kitchenSteel);
      coveTube(vx+u,vy+.065,1.272,vx+u,vy+.24,1.272,.012,BRICK);
      kitchenVessel(vx+u,vy+.055,1.008,'cup',WHITE,.85);
      foodOval(vx+u,vy+.161,1.39,.024,.010,.048,kitchenSteel);
      kitchenVessel(vx+u,vy-.045,1.50,'cup',WHITE,.70);
    }
    coveTube(vx+.28,vy-.06,1.32,vx+.28,vy+.18,1.24,.008,GRAY);
    foodOval(vx,vy+.161,1.405,.034,.010,.06,kitchenGlaze(WHITE));
    coveTube(vx,vy+.173,1.435,vx+.015,vy+.173,1.445,.002,BRICK);
  }),box:boxAt(x,y,1,0,.32,.255,1,1.575),radius:.5,kitchenCoffee:{kind:'espresso'}};
}
