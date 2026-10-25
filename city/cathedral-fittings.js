// The cathedral's fittings, built: the sanctuary steps, the altar under its
// cloth with its cross and candlesticks, the altar rail, the pulpit, the
// font, the votive stand, the pews and the chandeliers on their chains.
const cathStone=(i,t,L)=>{const g=coveGroove(HIT.w,.3,.006,t/projX)*coveDetail(t,.3);BG[i]=C(GRAY,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-g*.5);set(i,' ',0);return true;};
const cathGold=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
const cathOak=seed=>(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed);
const cathFlame=(x,y,z)=>{const f=fract(T*7+x*3)<.5;foodOval(x,y,z,.01,.01,f?.035:.028,(i,t,L)=>{BG[i]=C(f?YEL:ORANGE,15);set(i,' ',0);return true;});};
// Two broad steps up to the sanctuary, each with a rounded nosing.
function SANCTUARY_STEPS(x,y,hl,hw,h) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy-.15,1,0,hl,hw-.15,h/2,h,.02,cathStone); // the upper step
    coveRound(vx,vy,1,0,hl,hw,0,h/2,.02,cathStone); // the lower
  }),box:boxAt(x,y,1,0,hl,hw,0,h),walk:true,steps:{h}};
}
// The altar: a stone block, its cloth laid over the top and hanging down the front.
function ALTAR(x,y,hl,hw,h,base=0) {
  h+=base;
  const cloth=(i,t,L)=>{const hem=HIT.w<h-.32&&HIT.w>h-.36;BG[i]=C(hem?YEL:WHITE,(hem?4:4.4)+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl+.02,hw+.02,h-.01,h+.006,.004,cloth); // the cloth on top
    coveRound(vx,vy+hw+.01,1,0,hl-.1,.008,h-.4,h-.01,.003,cloth); // and down the front
    coveRound(vx,vy,1,0,hl,hw,base+.06,h-.01,.015,cathStone); coveRound(vx,vy,1,0,hl+.04,hw+.04,base,base+.06,.01,cathStone); // the block, its plinth
  }),box:boxAt(x,y,1,0,hl+.04,hw+.04,base,h+.006),radius:Math.hypot(hl,hw),altar:{h:h+.006}};
}
// A gold cross standing on a base at z.
function ALTAR_CROSS(x,y,z,h=1.8,arm=.45) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.12,.08,z,z+.06,.01,cathGold); // its base
    coveRound(vx,vy,1,0,.04,.04,z+.06,z+h,.008,cathGold); // the upright
    coveRound(vx,vy,1,0,arm,.04,z+h*.62,z+h*.62+.1,.008,cathGold); // the arms
  }),box:boxAt(x,y,1,0,arm,.08,z,z+h),radius:arm,cross:{z}};
}
// A floor candlestick: a spread foot, a turned stem, a drip pan, the candle and its flame.
function CANDLESTICK(x,y,h=1.5,base=0) {
  const stem=[[0,0],[0,.16],[.04,.14],[.08,.04],[.6,.03],[.65,.05],[.7,.03],[h-.12,.025],[h-.1,.07],[h-.08,.07],[h-.08,0]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    cathFlame(vx,vy,base+h+.14);
    coveLathe(vx,vy,base+h-.08,[[0,0],[0,.022],[.22,.02],[.22,0]],(i,t,L)=>{BG[i]=C(WHITE,5+L*.2);set(i,' ',0);return true;}); // the candle
    coveLathe(vx,vy,base,stem,cathGold);
  }),box:boxAt(x,y,1,0,.16,.16,base,base+h+.18),radius:.2,candlestick:{h}};
}
// The altar rail along x: a kneeler step, turned balusters, the top rail.
function ALTAR_RAIL(x,y,hl,h=.9) {
  const oak=cathOak(17),n=Math.round(hl*2/.18);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,.07,h-.06,h,.015,oak); // the rail
    for(let k=0;k<=n;k++)coveLathe(vx-hl+.03+(hl*2-.06)*k/n,vy,.12,[[0,0],[0,.025],[.15,.035],[.35,.022],[.55,.03],[h-.18,.025],[h-.18,0]],oak); // the balusters
    coveRound(vx,vy,1,0,hl,.07,0,.12,.01,oak); // the sill they stand on
    coveRound(vx,vy+.25,1,0,hl,.12,0,.14,.04,(i,t,L)=>{BG[i]=C(RED,1.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}); // the kneeler, on the people's side
  }),box:boxAt(x,y+.13,1,0,hl,.26,0,h),radius:hl+.1,rail:{h}};
}
// The pulpit: a tub on a stem, a sloping book rest on its rim.
function PULPIT(x,y,fx,fy) {
  const length=Math.hypot(fx,fy)||1;fx/=length;fy/=length;
  const oak=cathOak(23),tub=[[0,0],[0,.22],[.06,.18],[.08,.12],[.55,.14],[.62,.38],[1.15,.4],[1.2,.42],[1.2,.36],[.7,.34],[.7,0]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,0,tub,oak);
    for(let k=0;k<3;k++)coveRound(vx+fx*(.34-k*.04),vy+fy*(.34-k*.04),fy,-fx,.16,.06,1.2+k*.03,1.23+k*.03,.006,oak); // the book rest, stepped back up
  }),box:boxAt(x,y,1,0,.42,.42,0,1.32),radius:.45,pulpit:{fx,fy}};
}
// The font: a stone bowl on a pedestal, holy water still in it.
function FONT(x,y,h=1.0) {
  const bowl=[[0,0],[0,.3],[.08,.26],[.12,.14],[.55,.12],[.62,.42],[h,.5],[h,.44],[h-.12,.38],[h-.12,0]];
  const water=(i,t,L)=>{BG[i]=C(CYAN,2+noise(HIT.u*6+T*.3,HIT.v*6,505)*2);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,h-.10,[[0,0],[0,.38],[.001,.38],[.001,0]],water);
    coveLathe(vx,vy,0,bowl,cathStone);
  }),box:boxAt(x,y,1,0,.5,.5,0,h),radius:.55,font:{h}};
}
// The votive stand: a sloped rack in three tiers of tealights, as many lit
// as candles have been lit today (count()).
function VOTIVE_STAND(x,y,hl,count) {
  const oak=cathOak(29),tiers=[.7,.78,.86],slots=[];
  tiers.forEach((z,row)=>{for(let k=0;k<8;k++)slots.push({u:-hl+.1+k*(hl*2-.2)/7,v:.15-row*.12,z});});
  const cup=[[0,0],[0,.025],[.03,.027],[.03,.022],[.012,.02],[.012,0]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const lit=count();
    slots.forEach((q,n)=>{const px_=vx+q.u,py_=vy+q.v;if(n<lit)cathFlame(px_,py_,q.z+.025);
      coveLathe(px_,py_,q.z,cup,n<lit?(i,t,L)=>{BG[i]=C(RED,4+fract(T*6+n*.37)*1.5);set(i,' ',0);return true;}:leisurePaint(WHITE,3.4));});
    tiers.forEach((z,row)=>coveRound(vx,vy+.15-row*.12,1,0,hl,.06,.66,z,.006,oak)); // the tiers
    coveRound(vx,vy,1,0,hl,.25,0,.66,.02,oak); // the stand
  }),box:boxAt(x,y,1,0,hl,.25,0,.92),radius:hl+.1,votive:{slots:slots.length}};
}
// A pew along x facing (0,-1): the seat, the back with a book ledge, carved
// ends with finials, and on the floor behind it a kneeler for the row behind.
function PEW(x,y,hl) {
  const oak=cathOak(31);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl-.04,.22,.4,.45,.015,oak); // the seat
    coveRound(vx,vy+.26,1,0,hl-.04,.04,.45,1.0,.015,oak); // the back
    coveRound(vx,vy+.26,1,0,hl-.04,.05,.88,.92,.012,oak); // the book ledge along its top, for the row behind
    for(const e of [-1,1]){coveRound(vx+e*(hl-.03),vy+.04,1,0,.03,.28,0,1.0,.012,oak); // the carved ends
      coveLathe(vx+e*(hl-.03),vy+.04,1.0,[[0,0],[0,.035],[.04,.04],[.07,0]],oak);} // their finials
    for(const e of [-1,1])coveRound(vx+e*(hl-.12),vy+.48,1,0,.04,.04,0,.06,.008,oak); // the kneeler's feet
    coveRound(vx,vy+.48,1,0,hl-.04,.08,.06,.14,.03,(i,t,L)=>{BG[i]=C(RED,1.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}); // the kneeler, for the row behind
  }),box:boxAt(x,y+.13,1,0,hl,.43,0,1.07),radius:hl+.2,pew:true};
}
// A chandelier hung from the vault on its chain: a gilt ring of arms, a
// candle and flame on each.
function CHANDELIER_RING(x,y,z,top,r=.4,arms=6) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=0;k<arms;k++){const a=k*TAU/arms,ax=vx+Math.cos(a)*r,ay=vy+Math.sin(a)*r;
      cathFlame(ax,ay,z+.14);
      coveLathe(ax,ay,z+.02,[[0,0],[0,.016],[.12,.015],[.12,0]],leisurePaint(WHITE,5)); // the candle
      coveLathe(ax,ay,z,[[0,0],[0,.04],[.02,.04],[.02,0]],cathGold); // its cup
      coveTube(vx,vy,z-.1,ax,ay,z,.01,YEL);} // the arm
    coveLathe(vx,vy,z-.25,[[0,0],[0,.03],[.1,.08],[.18,.03],[.2,0]],cathGold); // the boss
    coveTube(vx,vy,z-.05,vx,vy,top,.012,GRAY); // the chain, right up to the vault
  }),chandelier:{z,top,r}};
}
