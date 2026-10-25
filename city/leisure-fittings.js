// Leisure interiors (pass 10): the cinema's seat rows, the arcade's cabinets
// and the casino's tables and machines, built. A part helper turns each model
// to face (fx,fy): u across it, v toward its front.
const leisurePart=(vx,vy,c,s)=>(u,v,hl,hw,z0,z1,shade,r=0)=>{
  const x=vx+c*u-s*v,y=vy+s*u+c*v;
  if(r)coveRound(x,y,c,s,hl,hw,z0,z1,r,shade);
  else drawBox(boxAt(x,y,c,s,hl,hw,z0,z1),(i,t,L)=>{const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);});
};
const leisurePaint=(col,base,spread=.3)=>(i,t,L)=>{BG[i]=C(col,base+L*spread*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
// A row of cinema seats along x facing (0,-1): each seat a cushion and a
// back, armrests between them on their standards, end panels.
function CINEMA_ROW(x,y,hl,col=RED) {
  const n=Math.max(1,Math.floor(hl*2/.52)),pitch=hl*2/n,plush=leisurePaint(col,2.2,.35),frame=leisurePaint(GRAY,1,.15);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=0;k<n;k++){const u=-hl+pitch*(k+.5);
      coveRound(vx+u,vy-.02,1,0,pitch/2-.04,.22,.36,.45,.04,plush); // the cushion
      coveRound(vx+u,vy+.27,1,0,pitch/2-.04,.07,.42,1.0,.05,plush);} // the back
    for(let k=0;k<=n;k++){const end=k===0||k===n,u=end?(k?hl-.02:-hl+.02):-hl+pitch*k;
      coveRound(vx+u,vy+.06,1,0,end?.02:.025,end?.3:.24,0,end?.75:.36,.008,frame); // a standard (or the row's end panel, flush with its end)
      if(!end)coveRound(vx+u,vy+.04,1,0,.03,.23,.6,.64,.012,frame);} // its armrest
  }),box:boxAt(x,y+.05,1,0,hl,.31,0,1.0),radius:hl+.3,cinemaRow:{n,pitch}};
}
// An arcade cabinet facing (fx,fy): side panels, the coin door, the control
// deck with its stick and buttons, the screen in its bezel playing, the lit marquee.
function ARCADE_CABINET(x,y,fx,fy,k,body) {
  const c=fy,s=-fx,side=leisurePaint(body,1.2,.3),black=leisurePaint(GRAY,.5,.1);
  const screen=(i,t,L)=>{if(HIT.face!==3)return black(i,t,L);BG[i]=C(NEON[k],2);
    return set(i,'*@#+o~%'[hash(Math.floor(HIT.u*24),Math.floor(HIT.w*20),(T*6|0)+k)*7|0],C(NEON[(k+1)&3],15)),true;};
  const marquee=(i,t,L)=>{BG[i]=C(NEON[(k+2)&3],5+Math.sin(T*3+k)*.8);set(i,' ',0);return true;};
  const coin=(i,t,L)=>{BG[i]=C(GRAY,.8);return set(i,HIT.face===3&&Math.abs(HIT.w-.55)<.02&&Math.abs(HIT.u)<.04?'=':' ',C(RED,12)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=leisurePart(vx,vy,c,s);
    for(const e of [-1,1])part(e*.33,-.02,.02,.38,0,1.8,side,.01); // the side panels
    part(0,-.38,.31,.02,0,1.8,side); // the back
    part(0,.33,.31,.03,0,.8,coin); // the coin door
    part(0,.3,.31,.12,.86,.92,black,.012); // the control deck
    coveTube(vx-c*.1-s*.32,vy-s*.1+c*.32,.92,vx-c*.1-s*.32,vy-s*.1+c*.32,1.0,.008); // the stick
    coveLathe(vx-c*.1-s*.32,vy-s*.1+c*.32,.99,[[0,0],[0,.015],[.02,.02],[.04,0]],leisurePaint(RED,3.4)); // its ball
    for(const j of [0,1,2])coveLathe(vx+c*(.04+j*.07)-s*.33,vy+s*(.04+j*.07)+c*.33,.92,[[0,0],[0,.016],[.012,.016],[.012,0]],leisurePaint(NEON[(k+j)&3],4));
    part(0,.12,.31,.02,1.0,1.55,screen); // the screen, set back in the cabinet
    part(0,.16,.31,.02,.92,1.0,black); part(0,.16,.31,.02,1.55,1.6,black); // its bezel above and below
    part(0,.12,.31,.12,1.6,1.8,marquee); // the marquee
  }),box:boxAt(x,y,c,s,.35,.42,0,1.8),radius:.6,arcade:{fx,fy,k}};
}
// The cashier's cage bars: brass rods from the counter top up to the head rail.
function CASHIER_CAGE_BARS(xs,y,z0,z1) {
  return {...ROOM_MODEL(xs[0],y,(vx,vy)=>{const dxs=xs.map(x=>x-xs[0]);
    for(const d of dxs)coveTube(vx+d,vy,z0,vx+d,vy,z1,.015,YEL);
    coveTube(vx+dxs[0]-.1,vy,z1,vx+dxs.at(-1)+.1,vy,z1,.02,YEL);}),cage:true};
}
// A gaming table: a wood base, a padded rail round a felt top let in below it.
function gamingTable(vx,vy,hl,hw,h,felt) {
  coveRound(vx,vy,1,0,hl-.15,hw-.15,0,h-.08,.04,'wood'); // the base meets the underside of the rail
  coveRound(vx,vy,1,0,hl,hw,h-.08,h,.04,leisurePaint(BRICK,1.4,.3)); // the padded rail
  drawBox(boxAt(vx,vy,1,0,hl-.08,hw-.08,h-.08,h+.001),felt); // the felt, just proud of the rail's inside
}
// Blackjack: the dealt hands as cards on the felt, chip stacks by each seat.
function BLACKJACK_TABLE(x,y,hl=1.3,hw=.6,h=.8) {
  const felt=(i,t,L)=>{BG[i]=C(GREEN,2+L*.06);set(i,' ',0);return true;};
  const cards=BJ_CARDS.map(([u,v,suit,col])=>({u,v,suit,col}));
  const card=q=>(i,t,L)=>{BG[i]=C(WHITE,9);return set(i,HIT.face===5&&Math.abs(HIT.u)<.025&&Math.abs(HIT.v)<.035&&coveDetail(t,.1)>.3?q.suit:' ',C(q.col,12)),true;};
  const chip=[[0,0],[0,.02],[.006,.02],[.006,0]],chips=[[-.8,.45,RED],[0,.48,BLUE],[.8,.45,GREEN],[-.4,-.35,YEL],[.4,-.35,WHITE]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const q of cards)drawBox(boxAt(vx+q.u,vy+q.v,1,0,.04,.06,h+.001,h+.004),card(q)); // the hands, lying on the felt
    for(const [u,v,col] of chips)for(let j=0;j<3;j++)coveLathe(vx+u,vy+v,h+.001+j*.006,chip,leisurePaint(col,3.2)); // chips, stacked on the felt
    gamingTable(vx,vy,hl,hw,h,felt);
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.02),radius:Math.hypot(hl,hw),gaming:{h,cards:cards.length}}; // (the box takes in the chips)
}
// Roulette: the wheel sunk in a bowl at one end, spinning, the ball running
// round it; the layout of numbers on the felt.
function ROULETTE_TABLE(x,y,hl=1.8,hw=.7,h=.8) {
  const wx=-1.2,bowl=[[0,0],[0,.5],[.06,.52],[.06,.46],[.02,.42],[.02,0]];
  const wheel=(i,t,L)=>{const d=Math.hypot(HIT.u,HIT.v),an=Math.atan2(HIT.v,HIT.u)+T*2;
    if(d<.12){BG[i]=C(YEL,6);return set(i,'+',C(YEL,15)),true;}
    BG[i]=(Math.floor(an/TAU*37+37)&1)?C(RED,5):C(GRAY,1.5);set(i,' ',0);return true;};
  const felt=(i,t,L)=>{if(HIT.u<-.4){BG[i]=C(GREEN,2+L*.06);set(i,' ',0);return true;}
    BG[i]=(Math.floor((HIT.u+.4)*5)+Math.floor((HIT.v+.7)*3))&1?C(RED,3):C(GRAY,1.5);return set(i,Math.abs(fract((HIT.u+.4)*5)-.5)<.1?'|':' ',C(WHITE,8)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const a=T*-3.1;coveLathe(vx+wx+Math.cos(a)*.38,vy+Math.sin(a)*.38,h+.02,[[0,0],[0,.012],[.012,.012],[.024,0]],leisurePaint(WHITE,6)); // the ball
    coveLathe(vx+wx,vy,h+.005,[[0,0],[0,.4],[.012,.4],[.012,0]],wheel); // the wheel
    coveLathe(vx+wx,vy,h-.05,bowl,(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,9)); // its bowl
    gamingTable(vx,vy,hl,hw,h,felt);
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.06),radius:Math.hypot(hl,hw),gaming:{h}};
}
// A slot machine facing (fx,fy): a rounded cabinet, the reels turning behind
// their window, the lit topper, the coin tray and the lever on the side.
function SLOT_MACHINE(x,y,fx,fy,ph) {
  const c=fy,s=-fx,body=leisurePaint(GRAY,1.6,.3),reel=[[-.05,0],[-.05,.09],[.05,.09],[.05,0]];
  const reelShade=k=>(i,t,L)=>{const a=Math.atan2(HIT.w-1.12,HIT.u)+T*(6+k)+ph,sym=Math.floor(a/TAU*8+80)%4;
    BG[i]=C(WHITE,7);return set(i,fract(a/TAU*8)<.5?'7@$*'[sym]:' ',C([RED,YEL,GREEN,MAG][sym],14)),true;};
  const topper=(i,t,L)=>{BG[i]=C(NEON[Math.floor(T*5+ph)&3],6);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=leisurePart(vx,vy,c,s);
    part(0,0,.3,.3,0,1.0,body,.04); // the cabinet below the window
    part(0,-.09,.3,.21,1.0,1.35,body,.03); // and behind the reels
    for(const e of [-1,1])part(e*.28,.21,.02,.09,1.0,1.35,body,.008); // the window's cheeks
    part(0,.21,.3,.09,1.24,1.35,body,.01); // its head
    part(0,.02,.32,.28,1.35,1.6,topper,.08); // the topper
    for(const k of [-1,0,1]){const [rx,ry]=[vx+c*k*.11-s*.22,vy+s*k*.11+c*.22];
      drawBox({...boxAt(rx,ry,-s,c,.05,.09,1.03,1.21),centerZ:1.12,clockShape:{x:0,y:0,profile:reel}},reelShade(k+1),homeClockRay);} // the reels, axles across
    part(0,.31,.3,.02,.98,1.01,body,.006); // the window's sill
    part(0,.31,.22,.06,.45,.5,body,.01); // the coin tray
    coveTube(vx+c*.285,vy+s*.285,.95,vx+c*.34,vy+s*.34,.95,.012); // the lever pivot, seated in the cabinet
    coveTube(vx+c*.34,vy+s*.34,.95,vx+c*.34,vy+s*.34,1.35,.012); // the lever
    coveLathe(vx+c*.34,vy+s*.34,1.34,[[0,0],[0,.03],[.04,.035],[.07,0]],leisurePaint(RED,3.6)); // its knob
  }),box:boxAt(x,y,c,s,.38,.37,0,1.6),radius:.5,slot:{fx,fy}};
}
// The club's stage: a plinth with a lit nosing chasing along its edge.
function CLUB_STAGE(x,y,hl,hw,h) {
  const top=leisurePaint(GRAY,1.6,.3),nosing=(i,t,L)=>{const k=Math.floor((HIT.u+hl)*4+T*6);BG[i]=C(NEON[k&3],8);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,0,h-.03,.02,top);
    coveRound(vx,vy,1,0,hl,hw,h-.03,h,.012,leisurePaint(GRAY,2.6,.3)); // the boards
    drawBox(boxAt(vx,vy+hw+.006,1,0,hl-.03,.006,h-.08,h-.045),nosing); // the light strip along the front
  }),box:boxAt(x,y,1,0,hl,hw+.012,0,h),radius:Math.hypot(hl,hw),stage:{h}};
}
// A dance pole from the stage at z0 to the ceiling, with its flanges.
function CLUB_POLE(x,y,z0,z1) {
  const chrome=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,WHITE);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,z0,[[0,0],[0,.07],[.015,.06],[.03,.022],[.03,0]],chrome); // the base flange
    coveTube(vx,vy,z0+.03,vx,vy,z1-.03,.022,WHITE);
    coveLathe(vx,vy,z1-.03,[[0,0],[0,.022],[.015,.06],[.03,.07],[.03,0]],chrome); // the ceiling flange
  }),box:boxAt(x,y,1,0,.07,.07,z0,z1),radius:.1,pole:{z0,z1}};
}
// A candle in its glass on a table top at z, the flame flickering.
function TABLE_CANDLE(x,y,z) {
  const glass=(i,t,L)=>{if(Math.abs(HIT.nx*dx+HIT.ny*dy)>.4&&HIT.w>z+.01)return false;BG[i]=C(RED,1.6);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const f=fract(T*3+x)<.85;
    foodOval(vx,vy,z+.045,.008,.008,f?.03:.024,(i,t,L)=>{BG[i]=C(f?YEL:ORANGE,15);set(i,' ',0);return true;}); // the flame
    coveLathe(vx,vy,z,[[0,0],[0,.025],[.04,.024],[.04,0]],leisurePaint(WHITE,4)); // the candle
    coveLathe(vx,vy,z,[[0,0],[0,.04],[.07,.042],[.07,.036],[.006,.034],[.006,0]],glass); // its glass, clear but for the rim and a tint
  }),box:boxAt(x,y,1,0,.042,.042,z,z+.08),radius:.06,candle:{z}};
}
// A low velvet club chair facing (fx,fy): a cushion on short legs, a
// buttoned back.
function CLUB_CHAIR(x,y,fx,fy,col=MAG,h=.42) {
  const c=fy,s=-fx,velvet=leisurePaint(col,1.6,.35);
  const tufted=(i,t,L)=>{const a=fract(HIT.u*9),b=fract(HIT.w*9),stud=a<.25&&b<.3&&coveDetail(t,.15)>.3;
    BG[i]=C(col,1.4+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)-(stud?.6:0));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=leisurePart(vx,vy,c,s);
    for(const e of [-1,1])for(const f of [-1,1])part(e*.16,f*.16,.02,.02,0,h-.12,GRAY,.006); // the legs
    part(0,0,.22,.22,h-.12,h,velvet,.04); // the cushion
    part(0,-.19,.22,.04,h,.72,tufted,.03); // the buttoned back
  }),box:boxAt(x,y,c,s,.22,.23,0,.72),radius:.32,clubChair:{h}};
}
// The VIP booth: velvet walls on three sides, a curtain across the front in
// folds, parted at the middle, a lit VIP sign over it. Its front faces (fx,fy).
function VIP_BOOTH(x,y,hl,hw,h,fx,fy) {
  const c=fy,s=-fx,velvet=leisurePaint(MAG,.8,.2),n=Math.round(hl*2/.14);
  const fold=k=>leisurePaint(RED,1+(k&1)*.5,.3);
  const sign=(i,t,L)=>{BG[i]=C(GRAY,.4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'VIP',0,h+.11,.06,.09,C(YEL,15),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=leisurePart(vx,vy,c,s);
    part(0,-hw+.03,hl,.03,0,h,velvet); for(const e of [-1,1])part(e*(hl-.03),0,.03,hw,0,h,velvet); // the walls
    part(0,0,hl,hw,h-.03,h,velvet); // its ceiling
    for(let k=0;k<n;k++){const u=-hl+.06+(hl*2-.12)*(k+.5)/n;if(Math.abs(u)<.18)continue; // the parting
      part(u,hw-.04+((k&1)?.012:0),(hl*2-.12)/n/2+.004,.028,.02,h-.06,fold(k),.026);}
    coveTube(vx-c*hl-s*(hw-.04),vy-s*hl+c*(hw-.04),h-.04,vx+c*hl-s*(hw-.04),vy+s*hl+c*(hw-.04),h-.04,.012); // the curtain rail
    part(0,hw+.02,.35,.02,h+.02,h+.2,sign,.01); // the sign
  }),box:boxAt(x,y,1,0,Math.abs(c)*hl+Math.abs(s)*hw,Math.abs(s)*hl+Math.abs(c)*hw+.04,0,h+.2),radius:Math.hypot(hl,hw),vip:{fx,fy}};
}
// The aquarium's touch pool: a tiled basin, its rim at hand height, water you
// can see down through to the sand and what lives on it.
function TOUCH_POOL_TANK(x,y,hl,hw,h=.75) {
  const rim=.08,floor=.42,water=h-.05,tile=(i,t,L)=>{const g=coveGroove(HIT.u+HIT.w,.15,.01,t/projX)*coveDetail(t,.2);BG[i]=C(GRAY,1.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-g*.6);set(i,' ',0);return true;};
  const sand=(i,t,L)=>{BG[i]=C(STONE,2.2+hash(Math.floor(HIT.u*40),Math.floor(HIT.v*40),41)*.6);set(i,' ',0);return true;};
  const ripple=(i,t,L)=>{const n=noise(HIT.u*4+T*.4,HIT.v*4,37);if(n<.62)return false;BG[i]=C(CYAN,2+n*2);return set(i,'~',C(WHITE,10)),true;}; // (clear but for the ripples)
  const life=[];
  for(let k=0;k<9;k++)life.push({u:(hash(k,1,40)-.5)*(hl-rim-.15)*2,v:(hash(k,2,40)-.5)*(hw-rim-.12)*2,kind:k%3});
  const star=(i,t,L)=>{BG[i]=C(ORANGE,3.2+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const urchin=(i,t,L)=>{const spine=fract(Math.atan2(HIT.v,HIT.u)*3+HIT.w*40)<.4;BG[i]=C(MAG,(spine?1.2:2)+L*.25);set(i,' ',0);return true;};
  const anemone=(i,t,L)=>{BG[i]=C(RED,2.8+Math.sin(T*2+HIT.w*60)*.4);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,hl-rim,hw-rim,water-.004,water),ripple); // the water's surface
    for(const q of life){const px_=vx+q.u,py_=vy+q.v;
      if(q.kind===0)for(let a=0;a<5;a++){const an=a*TAU/5;foodOval(px_+Math.cos(an)*.035,py_+Math.sin(an)*.035,floor,.04,.014,.012,star,Math.cos(an),Math.sin(an));} // a starfish
      else if(q.kind===1)foodOval(px_,py_,floor,.04,.04,.05,urchin); // an urchin
      else coveLathe(px_,py_,floor,[[0,0],[0,.03],[.05,.022],[.08,.04],[.08,0]],anemone);} // an anemone
    drawBox(boxAt(vx,vy,1,0,hl-rim,hw-rim,floor-.02,floor),gondolaFlatOr(sand)); // the sand
    for(const e of [-1,1]){coveRound(vx,vy+e*(hw-rim/2),1,0,hl,rim/2,0,h,.01,tile);coveRound(vx+e*(hl-rim/2),vy,1,0,rim/2,hw-rim,0,h,.01,tile);} // the basin's walls
    coveRound(vx,vy,1,0,hl-rim,hw-rim,0,floor-.02,.005,tile); // its floor
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),touchPool:{floor,water,h,life:life.length}};
}
const gondolaFlatOr=shade=>(i,t,L)=>{HIT.nx=0;HIT.ny=0;HIT.nz=1;return shade(i,t,L);};
// A spinner stand of plush sharks: a pole, three round shelves, the sharks
// lying round each with their fins up.
function PLUSH_STAND(x,y) {
  const shelves=[.45,.95,1.45],wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,39);
  const plush=col=>(i,t,L)=>{const belly=HIT.nz<-.2;BG[i]=C(belly?WHITE:col,(belly?3.6:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const [k,z] of shelves.entries())for(let j=0;j<5;j++){const a=j*TAU/5+k*.6+T*.2,col=[GRAY,BLUE,MAG,CYAN][(j+k)&3],sx=vx+Math.cos(a)*.18,sy=vy+Math.sin(a)*.18,c=-Math.sin(a),s=Math.cos(a),sh=plush(col);
      foodOval(sx,sy,z+.02,.11,.04,.07,sh,c,s); // the body, lying round the shelf
      foodOval(sx,sy,z+.07,.025,.008,.05,sh,c,s);} // its fin
    for(const z of shelves)coveLathe(vx,vy,z,[[0,0],[0,.3],[.02,.3],[.02,0]],wood); // the shelves
    coveTube(vx,vy,0,vx,vy,1.6,.02,GRAY);coveLathe(vx,vy,0,[[0,0],[0,.22],[.03,.2],[.03,0]],wood); // the pole, its foot
  }),box:boxAt(x,y,1,0,.3,.3,0,1.6),radius:.35,plushStand:{shelves}};
}
