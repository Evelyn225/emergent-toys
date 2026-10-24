// Wells, grease channels and simmering pots use the same actual surfaces that
// support their food; a painted circle cannot stand in for a recess.
const TAKO={cols:18,rows:4,step:.13,x0:-1.105,y0:-.195,top:.970,wellBase:.938,wellRadius:.035};
const TAKO_WELL=[[0,0],[0,.008],[.005,.020],[.014,.030],[.030,.035],[.032,.035],
  [.032,.032],[.014,.027],[.006,.016],[.004,0]];
function kitchenIron(i,t,L) {
  BG[i]=C(GRAY,.8+L*.065*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function kitchenTakoOpening(u,v) {
  const x=Math.round((u-TAKO.x0)/TAKO.step),y=Math.round((v-TAKO.y0)/TAKO.step);
  return x>=0&&x<TAKO.cols&&y>=0&&y<TAKO.rows&&
    (u-TAKO.x0-x*TAKO.step)**2+(v-TAKO.y0-y*TAKO.step)**2<TAKO.wellRadius**2;
}
function KITCHEN_TAKO_GRIDDLE(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const u of [-1.18,1.18])for(const v of [-.25,.25])
      coveLathe(vx+u,vy+v,0,[[0,0],[0,.03],[.10,.03],[.10,0]],kitchenSteel);
    coveRound(vx,vy,1,0,1.3,.35,.075,.92,.018,kitchenSteel);
    drawBox({...boxAt(vx,vy,1,0,1.2,.35,.92,TAKO.top),...kitchenTopProfile(1.2,.35,.92,TAKO.top,.005)},(i,t,L)=>{
      if(HIT.face===5&&kitchenTakoOpening(HIT.u,HIT.v))return false;
      return kitchenIron(i,t,L);
    },homeRayWorktop);
    for(let row=0;row<TAKO.rows;row++)for(let col=0;col<TAKO.cols;col++) {
      const k=row*TAKO.cols+col,u=TAKO.x0+col*TAKO.step,v=TAKO.y0+row*TAKO.step;
      coveLathe(vx+u,vy+v,TAKO.wellBase,TAKO_WELL,(i,t,L)=>{
        if(HIT.part>=7||HIT.part===6) {
          BG[i]=C(GRAY,HIT.part>=7?.15+L*.035*coveLight(HIT.nx,HIT.ny,HIT.nz):1.8+L*.055*coveLight(HIT.nx,HIT.ny,HIT.nz));
          set(i,' ',0);return true;
        }
        return kitchenIron(i,t,L);
      });
      if(k%13===0)continue; // a few empty wells expose the real mould below
      const done=fract(T*.05+hash(k,1,108)),turn=T*.7+hash(k,2,109)*Math.PI;
      foodOval(vx+u,vy+v,TAKO.wellBase+.004,.028,.028,.056,(i,t,L)=>{
        const grain=Math.sin((HIT.u*Math.cos(turn)+(HIT.w-.970)*Math.sin(turn))*170)*coveDetail(t);
        const sauce=done>.7&&HIT.nz>.3&&Math.sin(HIT.u*150+HIT.v*70)>.1;
        BG[i]=C(sauce?BRICK:WARM,4.4-done*1.6+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain*.2);set(i,' ',0);return true;
      });
    }
    for(const u of [-.65,0,.65])foodOval(vx+u,vy+.351,.76,.035,.012,.06,kitchenGlaze(BRICK));
    // Wooden handles rest on the clear front ledge, joined to their steel picks.
    for(const u of [-1.10,-.72]) {
      coveTube(vx+u,vy+.30,.977,vx+u+.12,vy+.30,.977,.007,BRICK);
      coveTube(vx+u+.11,vy+.30,.977,vx+u+.28,vy+.30,.977,.003,GRAY);
    }
  }),box:boxAt(x,y+.007,1,0,1.3,.358,0,1.006),radius:1.6,kitchenPlate:{kind:'takoyaki'}};
}
function KITCHEN_FLATTOP(x,y,hl=1,hw=.35) {
  const channel={u:0,v:.27,hl:hl-.06,hw:.045,bottom:.915,top:.960};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,0,.90,.015,kitchenSteel);
    drawBox({...boxAt(vx,vy,1,0,hl,hw,.90,.96),...kitchenTopProfile(hl,hw,.90,.96,.004)},(i,t,L)=>{
      if(HIT.face===5&&Math.abs(HIT.u-channel.u)<channel.hl&&Math.abs(HIT.v-channel.v)<channel.hw)return false;
      return kitchenIron(i,t,L);
    },homeRayWorktop);
    foodTray(vx,vy+channel.v,channel.bottom,channel.hl,channel.hw,channel.top-channel.bottom);
    coveRound(vx,vy-hw+.025,1,0,hl,.025,.96,1.12,.008,kitchenSteel);
    for(const u of [-.4,0,.4])foodOval(vx+u,vy+hw+.001,.74,.03,.012,.065,kitchenGlaze(BRICK));
    for(const u of [-.60,-.28])coveLathe(vx+u,vy-.09,.96,[[0,0],[0,.08],[.004,.08],[.005,0]],kitchenFoodShade(YEL));
    for(let k=0;k<8;k++) {
      const u=.05+(k%4)*.17,v=-.08+Math.floor(k/4)*.15;
      foodOval(vx+u,vy+v,.96,.045,.025,.025,kitchenFoodShade(k%2?BRICK:ORANGE));
    }
  }),box:boxAt(x,y+.007,1,0,hl,hw+.013,0,1.12),radius:hl+.3,kitchenPlate:{kind:'flat-top',channel},
    tick:s=>kitchenSteamerSteam(s,.988)};
}
function KITCHEN_POT_STOVE(x,y,water=false) {
  const scale=water?2.8:4.1,wide=water?3.2:2.7,top=water?.50:.45;
  const hl=water?.40:.32,hw=water?.38:.32,potHeight=.168*scale;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,0,top-.035,.015,kitchenSteel);
    const r=.11*wide+.005;
    coveLathe(vx,vy,top-.035,[[0,0],[0,r],[.035,r],[.035,0]],kitchenIron);
    foodOval(vx,vy+hw+.001,top-.16,.035,.012,.06,kitchenGlaze(BRICK));
    kitchenCookware(vx,vy,top,1,0,{kind:'pot',scale,wide,filled:true,liquid:water?GRAY:ORANGE});
    const fill=top+.127*scale;
    if(water)for(const u of [-.13,.13])for(const v of [-.12,.12])
      coveLathe(vx+u,vy+v,fill-.018+Math.sin(T*.8+u*5+v*7)*.002,COUNTER_DONUT_PROFILE,kitchenFoodShade(STONE));
    for(let k=0;k<6;k++) {
      const a=k*Math.PI/3+T*.1,rr=.12+.04*Math.sin(T+k);
      foodOval(vx+Math.cos(a)*rr,vy+Math.sin(a)*rr,fill+.001,.009,.009,.006,kitchenGlaze(water?WHITE:ORANGE));
    }
  }),box:boxAt(x,y+.008,1,0,water?.47:.40,hw+.012,0,top+potHeight+.012),radius:.65,
    kitchenPlate:{kind:water?'bagel-kettle':'stockpot',top,scale,wide},tick:s=>kitchenSteamerSteam(s,top+.127*scale+.025)};
}
