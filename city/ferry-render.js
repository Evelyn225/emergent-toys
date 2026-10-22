// One physical ship model serves shore views and the walkable interior. Window
// openings preserve the city's original colour and depth buffers behind them.
function ferryLetter(text,u,z,t,half,middle) {
  const width=Math.min(.027,half*1.8/(text.length+1)),q=u/width+text.length/2,k=Math.floor(q);
  return k>=0&&k<text.length&&oneCell((fract(q)-.5)*width,t/projX)&&oneCell(z-middle,t/projY)?text[k]:' ';
}
function drawFerry(ship) {
  const [vx,vy]=R(ship.x,ship.y);if(Math.hypot(vx,vy)>vis+FERRY.hl)return;
  const z=FERRY.deck;
  const part=(u,v,hl,hw,z0,z1,shade)=>drawBox(boxAt(vx+ship.c*u-ship.s*v,vy+ship.s*u+ship.c*v,ship.c,ship.s,hl,hw,z0,z1),shade);
  const paint=(i,ch,base,level,background=base,bgLevel=level*.35)=>{set(i,ch,C(base,level));BG[i]=C(background,bgLevel);return true;};
  const flat=(base,level=1,ch=' ')=>(i,t,L)=>paint(i,ch,base,Math.max(3,L*level));
  const line=(u0,v0,z0,u1,v1,z1,r,base=WHITE,light=1)=> {
    const [x0,y0]=ferryPoint(ship,u0,v0),[x1,y1]=ferryPoint(ship,u1,v1);
    rod(x0-px,y0-py,z0,x1-px,y1-py,z1,r,base,light);
  };
  const hull=(i,t,L)=> {
    const h=HIT.w;
    if(HIT.face===6)return false;
    if(HIT.face===5)return paint(i,fract((HIT.u+HIT.v)*24)<.045?'·':' ',STONE,L*.7,STONE,2+day*3);
    const stripe=h>.075&&h<.106;
    if(HIT.face<=4&&h>.035&&h<.065&&Math.abs(fract(HIT.u*2)-.5)<.09)return paint(i,'O',GRAY,L,GRAY,2);
    return paint(i,h<.02?'_':stripe?'=':' ',stripe?WHITE:BLUE,L, stripe?WHITE:BLUE,1+L*.3);
  };
  part(-.12,0,2.13,FERRY.hw,.005,z,hull);
  for(let n=0;n<4;n++)part(2.01+n*.055,0,.03,FERRY.hw*(1-n*.13),.01,z+.015,hull);
  // Teak aft deck, a soft carpet runner through the lounge, yellow gate stripe.
  part(-1.61,0,.61,.59,z-.002,z+.002,(i,t,L)=>paint(i,fract(HIT.u*38)<.08?'|':' ',BRICK,L*.7,BRICK,2+day*2.5));
  part(.3,0,1.27,.445,z+.001,z+.004,(i,t,L)=>paint(i,fract(HIT.u*38)<.035?'.':' ',BLUE,Math.max(5,L*.7),BLUE,2.5+day));
  part(-.98,-.51,.16,.025,z+.003,z+.006,flat(YEL,1.1,'='));
  // Cabin walls: broad uninterrupted window bays with slim mullions. Both
  // inside and outside look through to the real world and the opposite windows.
  for(const side of [-1,1]) {
    part(.32,side*.465,1.3,.009,z,z+.32,(i,t,L)=> {
      const u=HIT.u+.32,h=HIT.w-z;
      const mullion=Math.abs(fract((u+1.03)/.6)-.5)>.48;
      if(h>.105&&h<.278&&!mullion)return false;
      const trim=Math.abs(h-.1)<.007||Math.abs(h-.282)<.007;
      return paint(i,trim?'=':mullion?'|':' ',trim?BRICK:WHITE,Math.max(6,L*.85),h<.095?BLUE:WHITE,h<.095?3:3+day*2);
    });
    // Lower rubbing strake along the exterior, with the vessel's name aft.
    part(.25,side*.478,1.36,.008,z+.025,z+.065,(i,t,L)=> {
      const ch=ferryLetter('ISLAND BELLE',HIT.u,HIT.w-z,t,1.36,.045);
      return paint(i,ch,WHITE,Math.max(7,L),BLUE,3);
    });
  }
  part(-.98,0,.009,.465,z,z+.32,(i,t,L)=> {
    const v=HIT.v,h=HIT.w-z;
    if(Math.abs(v)<.12&&h<.285)return false;
    if(Math.abs(v)>.17&&Math.abs(v)<.415&&h>.11&&h<.275)return false;
    return paint(i,Math.abs(Math.abs(v)-.125)<.012?'|':' ',WHITE,Math.max(6,L),WHITE,3+day*2);
  });
  // Cream ceiling, recessed lamps, a blue cap and a little raised wheelhouse.
  part(.32,0,1.32,.49,z+.32,z+.34,(i,t,L)=> {
    const lamp=Math.abs(HIT.v)<.025&&Math.abs(fract((HIT.u+.32)*2)-.5)<.15;
    return paint(i,lamp?'=':fract(HIT.u*20)<.025?'|':' ',lamp?WARM:WHITE,lamp?15:Math.max(7,L*.8),lamp?WARM:WHITE,lamp?10:4);
  });
  part(.32,0,1.34,.505,z+.34,z+.355,flat(BLUE,.8));
  part(1.9,0,.25,.44,z,z+.37,(i,t,L)=> {
    if(HIT.w-z>.14&&HIT.w-z<.31&&Math.abs(HIT.v)<.39)return paint(i,' ',CYAN,6,BLUE,2);
    return paint(i,' ',WHITE,Math.max(6,L),WHITE,4);
  });
  part(1.9,0,.27,.46,z+.37,z+.39,flat(WHITE));
  part(.85,0,.12,.095,z+.355,z+.49,flat(BLUE,.9));
  part(.85,0,.135,.11,z+.49,z+.51,flat(WHITE));
  // Railings around the entire open deck and both side promenades. The port
  // gate has its own bar and a gangway only while securely alongside a terminal.
  for(const side of [-1,1]) {
    for(const [u0,u1] of side<0?[[-2.18,-1.17],[-.79,2.14]]:[[-2.18,2.14]]) {
      for(const h of [.055,.115])line(u0,side*.59,z+h,u1,side*.59,z+h,.0035);
    }
    for(let u=-2.18;u<=2.15;u+=.36)if(!(side<0&&Math.abs(u+.98)<.2))line(u,side*.59,z,u,side*.59,z+.115,.0045);
  }
  for(const u of [-2.18,2.14])for(const h of [.055,.115])line(u,-.59,z+h,u,.59,z+h,.0035);
  line(-1.17,-.59,z+.11,-.79,-.59,z+.11,.004,YEL,1.2);
  if(ship.stopped) {
    const stop=FERRY_STOPS[ship.stop],gate=ferryPoint(ship,-.98,-.59);
    // Gate is aft; the broad landing plate reaches the actual timber pier.
    const ex=stop.land[0]-gate[0],ey=stop.land[1]-gate[1],len=Math.hypot(ex,ey);
    drawBox(boxAt((gate[0]+stop.land[0])/2-px,(gate[1]+stop.land[1])/2-py,ex/len,ey/len,len/2,.09,.09,z+.005),(i,t,L)=>paint(i,fract(HIT.u*24)<.07?'=':' ',GRAY,L*.9,GRAY,2+day*2));
  }
  // Window seats and the aft deck benches share the same collision records.
  for(let k=0;k<FERRY_SEATS.length;k++) {
    const seat=FERRY_SEATS[k],side=Math.sign(seat.v),base=seat.inside?BLUE:BRICK;
    part(seat.u,seat.v,.18,.075,z+.035,z+.052,flat(base,1.15,'_'));
    part(seat.u,seat.v+side*.065,.18,.009,z+.052,z+.105,flat(base,1));
    for(const end of [-1,1])part(seat.u+end*.16,seat.v,.008,.072,z+.052,z+.076,flat(GRAY));
    for(const end of [-1,1])part(seat.u+end*.12,seat.v,.008,.04,z+.006,z+.035,flat(GRAY,.6));
    if(ferrySeatOccupied(ship.id,k)) {
      const [x,y]=ferryPoint(ship,seat.u,seat.v),look=figStreetLook(9400+ship.id*31+k,[GREEN,RED,STONE,YEL][k%4],BLUE);
      drawFigure(x-px,y-py,z+.007,.175,-ship.s*side,ship.c*side,look,'sit7',{light:Math.max(7,day*12)});
    }
  }
  // Café island: timber facing, brass foot rail, pastry cabinet, espresso
  // machine, cups, menu and a stable barista figure behind the serving edge.
  part(.68,0,.57,.09,z+.01,z+.099,(i,t,L)=>paint(i,fract(HIT.u*24)<.08?'|':' ',BRICK,Math.max(5,L*.9),BRICK,3));
  part(.68,0,.59,.105,z+.099,z+.108,flat(STONE,1.1));
  for(const side of [-1,1])line(.16,side*.13,z+.025,1.2,side*.13,z+.025,.003,YEL,1.2);
  part(.98,0,.12,.065,z+.108,z+.185,flat(GRAY,.95));
  part(.98,-.067,.09,.005,z+.135,z+.174,(i,t,L)=>paint(i,Math.abs(HIT.u)<.04?'o':'|',WHITE,12,GRAY,3));
  for(const u of [.91,1.02])part(u,-.09,.018,.017,z+.109,z+.13,flat(WHITE,1.15));
  part(.32,0,.15,.08,z+.108,z+.17,(i,t,L)=> {
    if(HIT.face!==5&&HIT.w>z+.119&&HIT.w<z+.16)return false;
    return paint(i,'-',WHITE,Math.max(6,L),GRAY,3);
  });
  for(const u of [.23,.32,.41])part(u,0,.025,.04,z+.11,z+.127,flat(YEL,.9,'o'));
  part(.65,0,.1,.015,z+.12,z+.2,(i,t,L)=> {
    const h=HIT.w-z;
    return paint(i,ferryLetter('CAFE',HIT.u,h,t,.1,.17),WARM,13,BLUE,3);
  });
  const [bx,by]=ferryPoint(ship,1.41,0);
  drawFigure(bx-px,by-py,z+.002,.175,-ship.c,-ship.s,figStreetLook(9281,WHITE,BLUE),'stand',{light:10});
  // Destination display faces into the lounge above the serving counter.
  part(1.62,0,.012,.3,z+.235,z+.297,(i,t,L)=> {
    const text=ship.stopped?'AT '+FERRY_STOPS[ship.stop].name:'NEXT '+FERRY_STOPS[ship.next].name;
    return paint(i,ferryLetter(text.toUpperCase(),HIT.v,HIT.w-z,t,.3,.266),YEL,13,BLACK,1);
  });
  // A lifebuoy and flag make the open deck recognisable from the water.
  part(-1.65,.595,.075,.006,z+.03,z+.11,(i,t,L)=>paint(i,Math.abs(HIT.u)<.045&&HIT.w>z+.045&&HIT.w<z+.09?' ':'O',ORANGE,Math.max(7,L),WHITE,3));
  line(-2.02,0,z,-2.02,0,z+.38,.0045,GRAY,1.1);
  part(-2.02,.075,.003,.075,z+.28,z+.36,(i,t,L)=>paint(i,' ',RED,Math.max(7,L),RED,5));
}
function drawFerryTerminal(stop) {
  const [x,y]=R(...stop.land);if(Math.hypot(x,y)>vis)return;
  const ship=nextFerry(stop),wait=ship.wait<.1?'BOARDING':`IN ${Math.ceil(ship.wait)}s`;
  const base=Math.max(.1,outdoorGroundHeight(...stop.land));
  rod(x+.18,y,base,x+.18,y,base+.26,.007,GRAY,1.1);
  drawBox(boxAt(x+.18,y,Math.cos(stop.yaw),Math.sin(stop.yaw),.3,.025,base+.16,base+.26),(i,t,L)=>{
    const upper=HIT.w>base+.212,text=upper?'ISLAND FERRY':wait;
    BG[i]=C(BLUE,3);set(i,ferryLetter(text,HIT.u,HIT.w-base,t,.3,upper ? .235 : .185),C(upper?WHITE:YEL,13));return true;
  });
}
function drawFerries() {
  if(!FERRY.cycle)return;
  for(const stop of FERRY_STOPS)drawFerryTerminal(stop);
  for(let id=0;id<FERRY.count;id++)drawFerry(ferryShip(id));
}
