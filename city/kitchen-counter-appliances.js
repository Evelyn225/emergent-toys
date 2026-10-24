// Small appliances sit on their existing worktops. Cases, vessels, liquids and
// controls remain separate surfaces, with filtered fine detail at a distance.
function KITCHEN_BLENDER(x,y,col) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.105,.10,1,1.12,.018,kitchenSteel);
    coveLathe(vx,vy,1.12,[[0,0],[0,.055],[.03,.060],[.28,.086],[.30,.087],[.304,.083],
      [.304,.077],[.032,.053],[.01,0]],(i,t,L)=>kitchenDrinkGlass(i,t,L,vx,vy));
    const juice=(i,t,L)=>{
      const swirl=Math.sin(Math.atan2(HIT.v,HIT.u)*3+T*4+HIT.w*21)*coveDetail(t);
      BG[i]=C(col,3.7+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)+swirl*.35);set(i,' ',0);return true;
    };
    const r=.053+(.077-.053)*(.23-.032)/(.304-.032);
    coveLathe(vx,vy,1.13,[[0,0],[.022,.053],[.22,r],[.22,0]],juice);
    coveLathe(vx,vy,1.424,[[0,0],[0,.089],[.02,.088],[.028,.075],[.028,0]],kitchenSteel);
    coveLathe(vx,vy,1.452,[[0,0],[0,.025],[.02,.025],[.02,0]],kitchenGlaze(BRICK));
    kitchenHandle(vx+.071,vy,1.29,1,0,.048,.007,GRAY);
    foodOval(vx,vy+.104,1.04,.025,.009,.035,kitchenGlaze(BRICK));
  }),box:boxAt(x,y,1,0,.14,.12,1,1.472),radius:.3,kitchenCounter:{kind:'blender',support:1}};
}
function KITCHEN_RICE_COOKER(x,y) {
  const white=kitchenGlaze(WHITE),black=kitchenGlaze(BLACK);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,.90,[[0,0],[0,.12],[.015,.155],[.04,.177],[.18,.18],[.20,.175],[.20,0]],kitchenGlaze(WHITE));
    coveLathe(vx,vy,1.10,[[0,0],[0,.18],[.008,.185],[.025,.17],[.048,.11],[.052,0]],(i,t,L)=>{
      if(HIT.w<1.109)return kitchenSteel(i,t,L);return white(i,t,L);
    });
    for(const side of [-1,1])coveTube(vx+side*.055,vy+.04,1.148,vx+side*.055,vy+.04,1.17,.008,GRAY);
    coveTube(vx-.055,vy+.04,1.17,vx+.055,vy+.04,1.17,.008,GRAY);
    // A dark recessed vent is on the lid, clear of the carrying handle.
    coveLathe(vx-.06,vy,1.149,[[0,0],[0,.012],[.006,.012],[.006,.008],[.002,.008],[.002,0]],(i,t,L)=>{
      if(HIT.part===5)return black(i,t,L);return kitchenSteel(i,t,L);
    });
    foodOval(vx,vy+.178,.99,.05,.01,.04,kitchenGlaze(BRICK));
    foodOval(vx+.02,vy+.188,1.002,.008,.003,.010,(i,t,L)=>{BG[i]=C(ORANGE,9);set(i,' ',0);return true;});
  }),box:boxAt(x,y,1,0,.19,.195,.90,1.18),radius:.3,kitchenCounter:{kind:'rice-cooker',support:.90},
    tick:s=>kitchenSteamerSteam(s,1.155,-.06,0)};
}
function kitchenCounterCarafe(x,y,z) {
  coveLathe(x,y,z,COFFEE_CARAFE,(i,t,L)=>{
    if(HIT.w>z+.162||HIT.part===1||HIT.part===9)return kitchenSteel(i,t,L);
    return kitchenDrinkGlass(i,t,L,x,y);
  });
  const r=.061-(.073-.02)*(.061-.056)/(.10-.02);
  coveLathe(x,y,z+.007,[[0,0],[.013,.061],[.066,r],[.066,0]],kitchenFoodShade(BRICK));
  kitchenHandle(x,y+.061,z+.075,0,1,.031,.006,BRICK);
}
function KITCHEN_DRIP_BREWER(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.20,.17,.92,.94,.007,kitchenSteel);
    coveRound(vx-.15,vy,1,0,.05,.16,.94,1.42,.013,kitchenGlaze(BRICK));
    coveRound(vx-.03,vy,1,0,.17,.16,1.27,1.42,.015,kitchenSteel);
    coveLathe(vx+.07,vy,.94,[[0,0],[0,.075],[.01,.075],[.01,0]],kitchenSteel);
    kitchenCounterCarafe(vx+.07,vy,.95);
    coveLathe(vx+.07,vy,1.14,[[0,0],[0,.025],[.11,.07],[.13,.07],[.13,0]],kitchenGlaze(BRICK));
    foodOval(vx+.141,vy+.11,1.32,.008,.018,.035,kitchenGlaze(BLACK));
    foodOval(vx+.142,vy+.06,1.33,.003,.006,.012,(i,t,L)=>{BG[i]=C(RED,8);set(i,' ',0);return true;});
  }),box:boxAt(x,y,1,0,.205,.17,.92,1.42),radius:.35,kitchenCounter:{kind:'drip-brewer',support:.92}};
}
function KITCHEN_HOTDOG_ROLLER(x,y) {
  // Round sausages touch both neighbouring rollers instead of floating at
  // their highest points. The cross-section uses their summed radii.
  const bottom=.968+Math.sqrt((.012+.021)**2-.03**2)-.021;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.19,.30,.92,.955,.008,kitchenSteel);
    for(const side of [-1,1])coveRound(vx,vy+side*.283,1,0,.19,.017,.95,.99,.006,kitchenSteel);
    for(let k=0;k<6;k++)coveTube(vx-.15+k*.06,vy-.27,.968,vx-.15+k*.06,vy+.27,.968,.012,GRAY);
    for(let k=0;k<5;k++)for(const side of [-1,1])foodOval(vx-.12+k*.06,vy+side*.13,bottom,.021,.10,.042,(i,t,L)=>{
      const stripe=Math.sin(HIT.v*90+T*1.2)*coveDetail(t);
      BG[i]=C(BRICK,3.2+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz)+stripe*.3);set(i,' ',0);return true;
    });
    for(const u of [-.19,.19])for(const v of [-.30,.30])coveTube(vx+u,vy+v,.95,vx+u,vy+v,1.22,.006,GRAY);
    for(const side of [-1,1])coveTube(vx-.19,vy+side*.30,1.22,vx+.19,vy+side*.30,1.22,.006,GRAY);
    const glass=(i,t,L)=>{
      if(Math.abs(HIT.v+.12)>.004||coveDetail(t)<.2)return false;
      BG[i]=C(WHITE,3+L*.15);set(i,' ',0);return true;
    };
    drawBox(boxAt(vx,vy,1,0,.19,.30,1.214,1.216),glass);
    drawBox(boxAt(vx+.19,vy,1,0,.001,.30,.96,1.216),glass);
  }),box:boxAt(x,y,1,0,.21,.315,.92,1.226),radius:.4,kitchenCounter:{kind:'hotdog-roller',support:.92}};
}
function KITCHEN_SLUSH_MACHINE(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.17,.25,.92,1.055,.012,kitchenSteel);
    for(const [side,col]of [[-1,RED],[1,BLUE]]) {
      const cy=vy+side*.12;
      coveLathe(vx-.015,cy,1.055,[[0,0],[0,.085],[.025,.095],[.275,.095],[.29,.09],[.29,0]],
        (i,t,L)=>kitchenDrinkGlass(i,t,L,vx-.015,cy));
      coveLathe(vx-.015,cy,1.067,[[0,0],[0,.078],[.02,.089],[.245,.089],[.245,0]],(i,t,L)=>{
        const swirl=Math.sin(HIT.w*45+Math.atan2(HIT.v,HIT.u)*3-T*2)*coveDetail(t);
        BG[i]=C(col,3.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)+swirl*.4);set(i,' ',0);return true;
      });
      coveTube(vx+.075,cy,1.09,vx+.15,cy,1.09,.01,GRAY);
      coveTube(vx+.15,cy,1.09,vx+.15,cy,1.04,.01,GRAY);
      coveTube(vx+.105,cy,1.10,vx+.13,cy,1.16,.008,BRICK);
    }
    coveRound(vx-.015,vy,1,0,.115,.235,1.345,1.42,.012,kitchenGlaze(WHITE));
    foodTray(vx+.14,vy,.92,.045,.23,.025);
  }),box:boxAt(x,y,1,0,.19,.26,.92,1.42),radius:.4,kitchenCounter:{kind:'slush-machine',support:.92}};
}
