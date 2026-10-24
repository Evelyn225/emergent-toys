// Hot-line equipment shares the measured pan, support and handle clearances.
function kitchenFryerWire(i,t,L) {
  const f=HIT.face,u=f<=2?HIT.v:HIT.u,v=f>=5?HIT.v:HIT.w;
  HIT.nx=f===1?1:f===2?-1:0;HIT.ny=f===3?1:f===4?-1:0;HIT.nz=f===5?1:f===6?-1:0;
  if(Math.max(coveGroove(u,.020,.0017,t/projX),coveGroove(v,.020,.0017,t/projX))<.5)return false;
  return kitchenSteel(i,t,L);
}
function KITCHEN_FRYER(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const u of [-.36,.36])for(const v of [-.26,.26])
      coveLathe(vx+u,vy+v,0,[[0,0],[0,.025],[.1,.025],[.1,0]],kitchenSteel);
    coveRound(vx,vy,1,0,.45,.35,.075,.86,.02,kitchenSteel);
    foodTray(vx,vy,.86,.45,.35,.06);
    const oil=(i,t,L)=>{
      const ripple=Math.sin(HIT.u*75+T*2)*Math.sin(HIT.v*80-T*1.6)*coveDetail(t);
      BG[i]=C(ORANGE,2.2+L*.10+ripple*.35);set(i,' ',0);return true;
    };
    drawBox(boxAt(vx,vy,1,0,.442,.342,.883,.885),oil);
    coveRound(vx,vy-.30,1,0,.435,.045,.92,1.19,.012,kitchenSteel);
    for(const u of [-.20,.20]) {
      const floor=.868,top=1.055,cx=vx+u,cy=vy-.04;
      drawBox(boxAt(cx,cy,1,0,.16,.20,floor,floor+.002),kitchenFryerWire);
      for(const side of [-1,1]) {
        drawBox(boxAt(cx+side*.16,cy,1,0,.001,.20,floor,top),kitchenFryerWire);
        drawBox(boxAt(cx,cy+side*.20,1,0,.16,.001,floor,top),kitchenFryerWire);
        coveTube(cx-.16,cy+side*.20,top,cx+.16,cy+side*.20,top,.004,GRAY);
        coveTube(cx+side*.16,cy-.20,top,cx+side*.16,cy+.20,top,.004,GRAY);
        for(const end of [-1,1])coveTube(cx+side*.16,cy+end*.20,floor,cx+side*.16,cy+end*.20,top,.004,GRAY);
      }
      coveTube(cx,vy-.24,top,cx,vy-.27,top,.006,GRAY);
      coveTube(cx,vy+.16,top,cx,vy+.315,1.15,.01,BRICK);
      foodOval(cx,vy-.250,1.09,.025,.012,.05,kitchenGlaze(BRICK));
      for(const [du,dv]of [[-.065,-.07],[.060,-.02],[0,.08]])
        foodOval(cx+du,cy+dv,.886,.038,.030,.045,kitchenFoodShade(ORANGE));
    }
    for(let k=0;k<5;k++) {
      const u=-.32+k*.16,v=.24+.018*Math.sin(T*2+k);
      foodOval(vx+u,vy+v,.885,.006,.006,.006,kitchenGlaze(YEL));
    }
  }),box:boxAt(x,y,1,0,.45,.35,0,1.19),radius:.7,kitchenHotline:{kind:'fryer'}};
}
const KITCHEN_SPIT_PROFILES={
  doner:[[0,0],[0,.07],[.10,.12],[.35,.19],[.68,.245],[.78,.24],[.84,.17],[.86,0]],
  pastor:[[0,0],[0,.11],[.08,.16],[.29,.205],[.52,.18],[.66,.12],[.69,0]]
};
function KITCHEN_SPIT(x,y,kind='doner') {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy-.02,1,0,.32,.35,0,.90,.02,kitchenSteel);
    foodTray(vx,vy,.90,.31,.30,.04);
    // One shell surrounds separate radiant elements; its case stays unlit.
    coveRound(vx,vy-.32,1,0,.30,.045,.94,2.03,.015,kitchenSteel);
    for(let k=0;k<5;k++)drawBox(boxAt(vx,vy-.273,1,0,.255,.004,1.02+k*.18,1.08+k*.18),(i,t,L)=>{
      BG[i]=C(ORANGE,7+Math.sin(T*1.3+k)*.5);set(i,' ',0);return true;
    });
    coveTube(vx,vy-.30,2.02,vx,vy,2.02,.015,GRAY);
    coveLathe(vx,vy,.92,[[0,0],[0,.014],[1.11,.014],[1.11,0]],kitchenSteel);
    const rate=kind==='doner'?.8:1.2;
    coveLathe(vx,vy,1.05,KITCHEN_SPIT_PROFILES[kind],(i,t,L)=>{
      const angle=Math.atan2(HIT.v,HIT.u)+T*rate,footprint=t/projX;
      const seams=coveGroove(HIT.w,.035,.004,footprint),char=Math.sin(angle*9+Math.sin(HIT.w*17)*.35)*coveDetail(t);
      BG[i]=C(kind==='doner'?BRICK:ORANGE,3+L*.33*coveLight(HIT.nx,HIT.ny,HIT.nz)-seams*.5+char*.55);set(i,' ',0);return true;
    });
    if(kind==='pastor')coveLathe(vx,vy,1.76,[[0,0],[0,.075],[.025,.09],[.11,.085],[.14,.06],[.14,0]],(i,t,L)=>{
      const diamond=Math.sin(Math.atan2(HIT.v,HIT.u)*12+HIT.w*28)*Math.sin(HIT.w*80)*coveDetail(t);
      BG[i]=C(YEL,3.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-Math.max(0,diamond)*.7);set(i,' ',0);return true;
    });
  }),box:boxAt(x,y-.015,1,0,.32,.355,0,2.035),radius:.65,kitchenHotline:{kind}};
}
function KITCHEN_YAKITORI(x,y,hl) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const u of [-hl+.10,hl-.10])for(const v of [-.13,.13])
      coveLathe(vx+u,vy+v,0,[[0,0],[0,.025],[.14,.025],[.14,0]],kitchenSteel);
    coveRound(vx,vy,1,0,hl,.20,.12,.92,.012,kitchenSteel);
    foodTray(vx,vy,.92,hl,.20,.08);
    drawBox(boxAt(vx,vy,1,0,hl-.012,.188,.928,.936),(i,t,L)=>{
      BG[i]=C(GRAY,.6+L*.035);set(i,' ',0);return true;
    });
    for(let k=0;k<Math.ceil(hl*7);k++) {
      const u=-hl+.12+k*(hl*2-.24)/Math.ceil(hl*7),v=.06*Math.sin(k*2.3);
      foodOval(vx+u,vy+v,.936,.05,.055,.035,(i,t,L)=>{
        const ember=Math.sin(HIT.u*60+HIT.v*50+T*.7+k)>0.7;
        BG[i]=C(ember?RED:GRAY,ember?5:1+L*.06);set(i,' ',0);return true;
      });
    }
    for(let k=0;k*.16<hl*2-.2;k++) {
      const u=-hl+.12+k*.16;
      coveTube(vx+u,vy-.23,1.004,vx+u,vy+.23,1.004,.004,STONE);
      for(let m=0;m<3;m++)foodOval(vx+u,vy-.08+m*.08,.988,.026,.031,.032,kitchenFoodShade(m===1?GREEN:k%2?BRICK:ORANGE));
    }
  }),box:boxAt(x,y,1,0,hl,.24,0,1.021),radius:hl+.3,kitchenHotline:{kind:'yakitori',half:hl}};
}
