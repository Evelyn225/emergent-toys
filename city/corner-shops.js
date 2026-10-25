// The corner shops' fittings, built. The gas station: the counter and what
// stands on it (till, pump console, a jar of jerky), the coffee and hot-food
// counters with a stack of cups, the chest freezer of ice, the ATM, a peg
// stand of crisps, the newspaper rack. The bodega: its counter behind a
// plexiglass screen. (The gas station's oil shelf is a wall-shelf run.)
// A part in a model's frame: u along (c,s), v along (-s,c). Rounded parts (r)
// give their own normals; plain boxes get theirs from the face they hit.
const GAS_PART=(vx,vy,c,s)=>(u,v,hl,hw,z0,z1,shade,r=0)=>{
  const x=vx+c*u-s*v,y=vy+s*u+c*v;
  if(r)coveRound(x,y,c,s,hl,hw,z0,z1,r,shade);else drawBox(boxAt(x,y,c,s,hl,hw,z0,z1),gondolaFlat(c,s,shade));
};
const gasPaint=(col,base,spread=.3)=>(i,t,L)=>{BG[i]=C(col,base+L*spread*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
// (models facing (fx,fy) put +v that way: c=fy, s=-fx)
// A shop counter along u (c,s), the customers on +v: a set-back plinth, a
// laminate carcass with a panel per metre on the customers' face and an
// overhanging top. col: one colour, or a list the panels take in turn.
function SHOP_COUNTER(x,y,hl,hw,h,c,s,col=GRAY) {
  const cols=[].concat(col),panels=Math.max(cols.length>1?Math.round(hl*2/.6):1,Math.ceil(hl*2/1)),pw=hl/panels;
  const lam=gasPaint(cols[0],1.8),panelLam=cols.map(c=>gasPaint(c,1.8)),top=gasPaint(STONE,3.6,.25),kick=(i,t,L)=>{BG[i]=C(GRAY,.8+L*.06);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl-.04,hw-.05,0,.1,kick,.008); // the plinth
    part(0,-.01,hl-.02,hw-.03,.08,h-.035,lam,.012); // the carcass
    for(let k=0;k<panels;k++)part(-hl+pw*(2*k+1),hw-.02,pw-.04,.012,.18,h-.12,panelLam[k%cols.length],.008); // panels on the customers' face
    part(0,0,hl,hw,h-.035,h,top,.012); // the top
  }),box:boxAt(x,y,c,s,hl,hw,0,h),radius:Math.hypot(hl,hw),shopCounter:{hl,hw,h,c,s}};
}
// A till on a counter top at z, its screen to the clerk (direction fx,fy).
function GAS_TILL(x,y,z,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{BG[i]=C(GREEN,1.4);return set(i,HIT.face===3&&coveDetail(t,.1)>.3&&Math.abs(HIT.w-(z+.2))<.012?'$':' ',C(GREEN,13)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.17,.15,z,z+.09,GRAY,.012); // the drawer
    part(0,-.02,.02,.02,z+.09,z+.14,GRAY,.008); // its post
    part(0,0,.14,.012,z+.13,z+.29,(i,t,L)=>{if(HIT.face!==3){BG[i]=C(GRAY,1.1);set(i,' ',0);return true;}return screen(i,t,L);}); // the screen
  }),box:boxAt(x,y,c,s,.17,.15,z,z+.29),radius:.25,till:{z,fx,fy}};
}
// The pump console: a sloped-faced box of six lit buttons, one per pump, to
// the clerk; a pump that's filling shows green.
function PUMP_CONSOLE(x,y,z,fx,fy,station) {
  const c=fy,s=-fx;
  const face=(i,t,L)=>{
    if(HIT.face!==3){BG[i]=C(GRAY,1.2+L*.2);set(i,' ',0);return true;}
    const k=Math.floor((HIT.u+.2)/.4*3),row=HIT.w<z+.12?1:0,n=k+3*row;
    const on=station&&cars.some(car=>gasFilling(car)&&car.pit.st===station&&car.pit.lane===n%3);
    BG[i]=C(on?GREEN:GRAY,on?3:.8);return set(i,String(n+1),C(WHITE,13)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,.02,.22,.14,z,z+.05,GRAY,.01); // its foot
    part(0,0,.2,.012,z+.05,z+.24,face); // the button panel
    part(0,-.04,.2,.03,z+.05,z+.24,GRAY,.01); // the case behind it
  }),box:boxAt(x,y,c,s,.22,.16,z,z+.24),radius:.3};
}
// A glass jar on the counter, its lid on, strips of jerky stood up inside.
function JERKY_JAR(x,y,z) {
  const glass=[[0,0],[0,.085],[.012,.09],[.2,.09],[.22,.07],[.235,.07],[.235,.06],[.012,.078],[.012,0]];
  const lid=[[.225,0],[.225,.074],[.25,.074],[.255,.06],[.255,0]];
  const jerky=[[.012,0],[.012,.075],[.17,.07],[.19,0]];
  const glassShade=(i,t,L)=>{const n=Math.abs(HIT.nx*dx+HIT.ny*dy);if(n>.35&&HIT.w>z+.02&&HIT.w<z+.2)return false;BG[i]=C(CYAN,1.6+L*.15);set(i,' ',0);return true;};
  const meat=(i,t,L)=>{const strip=Math.sin(Math.atan2(HIT.v,HIT.u)*9)>.2;BG[i]=C(BRICK,(strip?1.6:2.4)+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,z,lid,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,RED));
    coveLathe(vx,vy,z,glass,glassShade); // clear through its sides
    coveLathe(vx,vy,z,jerky,meat);
  }),box:boxAt(x,y,1,0,.09,.09,z,z+.255),radius:.1,jar:{z,top:z+.255}};
}
// A stack of paper cups, nested: a tapered column with a rolled rim on each.
function CUP_STACK(x,y,z,n=6) {
  const prof=[[0,0],[0,.03]];for(let k=0;k<n;k++){const b=k*.02;prof.push([b+.08,.042],[b+.085,.045],[b+.09,.04]);}prof.push([(n-1)*.02+.09,0]);
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveLathe(vx,vy,z,prof,(i,t,L)=>{BG[i]=C(WHITE,3.6+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;})),
    box:boxAt(x,y,1,0,.045,.045,z,z+(n-1)*.02+.09),radius:.06};
}
// The chest freezer of bagged ice: a white body, the lid on its hinge line, a
// handle along the front and ICE across it.
function ICE_CHEST(x,y,hl,hw,h,fx,fy) {
  const c=fy,s=-fx,white=gasPaint(WHITE,2.6,.3);
  const front=(i,t,L)=>{BG[i]=C(WHITE,2.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));
    if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'ICE',0,h*.55,.1,.16,C(BLUE,14),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,hw,.06,h-.07,white,.03); // the body
    part(0,0,hl-.03,hw-.03,0,.06,(i,t,L)=>{BG[i]=C(GRAY,.8);set(i,' ',0);return true;},.01); // its base
    part(0,0,hl+.005,hw+.005,h-.07,h,white,.025); // the lid
    part(0,hw+.01,hl*.6,.012,h-.1,h-.075,GRAY,.006); // the handle, along the lid's front edge
    part(0,hw+.002,hl*.5,.002,.2,h-.2,front); // the ICE decal
  }),box:boxAt(x,y,c,s,hl,hw+.025,0,h),radius:Math.hypot(hl,hw)};
}
// The ATM: a steel cabinet, the screen recessed under a hood, keypad, card and
// cash slots, facing (fx,fy).
function ATM_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,hl=.25,hw=.2,h=1.55;
  const screen=(i,t,L)=>{BG[i]=C(BLUE,3);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'ATM',0,1.33,.05,.08,C(WHITE,14),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,hw,0,h,GRAY,.02); // the cabinet
    part(0,hw+.04,hl-.02,.04,1.42,1.46,GRAY,.008); // the hood over the screen
    part(0,hw+.003,.17,.003,1.12,1.4,screen); // the screen
    part(0,hw+.05,.12,.05,.96,.99,(i,t,L)=>{BG[i]=C(GRAY,1.4);const key=coveGroove(HIT.u,.035,.006,t/projX)*coveGroove(HIT.v,.03,.006,t/projX);set(i,' ',0);BG[i]=C(GRAY,1.4+key*2);return true;},.005); // the keypad shelf
    part(.17,hw+.006,.04,.006,1.02,1.04,(i,t,L)=>{BG[i]=C(GREEN,2);set(i,' ',0);return true;}); // the card slot's light
    part(0,hw+.004,.12,.004,.8,.83,(i,t,L)=>{BG[i]=C(GRAY,.4);set(i,' ',0);return true;}); // the cash slot
  }),box:boxAt(x,y,c,s,hl,hw+.1,0,h),radius:.4,atm:{fx,fy}};
}
// A low peg stand of crisps: a pegboard spine on a base, bags hung in rows on
// both faces, each bag on its hook.
function CRISP_STAND(x,y,hl,hw,h,seed) {
  const base=.18,spine=.02,bags=[];
  for(const side of [-1,1])for(let row=0;row<3;row++)for(let k=0;k<Math.floor(hl*2/.17);k++){
    const u=-hl+.1+k*.17,z=h-.12-row*.3;
    if(hash(k,row*2+(side>0),seed)<.1)continue; // one sold out
    bags.push({u,side,z,col:ITEM_COL[Math.floor(hash(k,row,seed+side)*8)]});
  }
  const peg=(i,t,L)=>{const hole=coveGroove(HIT.u,.04,.006,t/projX)*coveGroove(HIT.w,.04,.006,t/projX)*coveDetail(t,.3);BG[i]=C(WHITE,3.2-hole*1.5);set(i,' ',0);return true;};
  const bagShade=col=>(i,t,L)=>{const band=Math.abs(HIT.w-HIT.bz)<.02;BG[i]=C(band?WHITE:col,(band?4.4:2.6)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const shades=bags.map(b=>{const sh=bagShade(b.col);return (i,t,L)=>{HIT.bz=b.z-.08;return sh(i,t,L);};});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    bags.forEach((b,n)=>{const v=b.side*(spine/2+.06);
      foodOval(vx+b.u,vy+v,b.z-.17,.065,.03,.17,shades[n]); // the bag, puffed
      drawBox(boxAt(vx+b.u,vy+b.side*(spine/2+.03),1,0,.004,.03,b.z-.004,b.z),(i,t,L)=>coveMetal(i,L,0,b.side,0));}); // its hook
    drawBox(boxAt(vx,vy,1,0,hl-.02,spine/2,base,h),peg);
    coveRound(vx,vy,1,0,hl,hw,0,base,.015,GRAY); // the base
    coveRound(vx,vy,1,0,hl-.01,.03,h,h+.03,.01,GRAY); // the cap
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.03),radius:Math.hypot(hl,hw),crispStand:{bags,spine,base,h}};
}
// The newspaper rack: a wire stand of three sloping tiers, papers folded on each.
function NEWS_RACK(x,y,fx,fy) {
  const c=fy,s=-fx,tiers=[[.2,.1],[.42,.02],[.64,-.06]],papers=[];
  tiers.forEach(([z,v],k)=>{for(const u of [-.12,.12])papers.push({u,v,z:z+.01,h:.02+hash(k,u*10|0,3)*.03,col:k===1?CYAN:WHITE});});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    for(const q of papers)part(q.u,q.v,.11,.07,q.z,q.z+q.h,(i,t,L)=>{BG[i]=C(q.col===WHITE?WHITE:GRAY,3+L*.2);
      return set(i,HIT.face===5&&coveDetail(t,.1)>.3&&fract((HIT.v+1)*30)<.3?'-':' ',C(GRAY,5)),true;});
    for(const [z,v] of tiers)part(0,v,.24,.075,z,z+.01,GRAY,.004); // the wire trays
    for(const u of [-.24,.24])part(u,-.06,.008,.008,0,.75,GRAY,.004); // the uprights
  }),box:boxAt(x,y,c,s,.25,.18,0,.75),radius:.3,newsRack:{papers,tiers}};
}
// A wet-floor cone: a turned yellow cone on a square-ish foot, a black band
// with the warning round it and a grip on top.
function WET_FLOOR_CONE(x,y) {
  const prof=[[0,0],[0,.16],[.025,.16],[.025,.11],[.55,.03],[.58,.03],[.6,.02],[.6,0]];
  const shade=(i,t,L)=>{const band=Math.abs(HIT.w-.32)<.05;BG[i]=C(band?GRAY:YEL,(band?.6:3.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));
    return set(i,band&&coveDetail(t,.1)>.3&&fract(Math.atan2(HIT.v,HIT.u)/TAU*6)<.3?'!':' ',C(YEL,14)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveLathe(vx,vy,0,prof,shade)),box:boxAt(x,y,1,0,.16,.16,0,.6),radius:.2,wetFloor:true};
}
// A plexiglass screen standing on a counter top at z, along u (c,s): clear
// panes with a glint across them in a steel frame of posts and a head rail,
// a gap under the middle pane to pass things through.
function PLEXI_SCREEN(x,y,hl,z,h,c,s) {
  const posts=[-hl,-hl/3,hl/3,hl].map(u=>u+(u<0?.012:-.012)),gap=.12;
  const pane=(i,t,L)=>fract((HIT.u+HIT.w)*2.5)<.04?(set(i,'/',C(WHITE,8)),true):false; // see-through but for the glint
  const panes=[0,1,2].map(k=>{const a=posts[k]+.012,b=posts[k+1]-.012;return {u:(a+b)/2,hl:(b-a)/2,z0:k===1?z+gap:z};});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    for(const p of panes)part(p.u,0,p.hl,.004,p.z0,z+h-.03,pane);
    for(const u of posts)part(u,0,.012,.012,z,z+h-.03,GRAY,.004);
    part(0,0,hl,.015,z+h-.03,z+h,GRAY,.006); // the head rail
    part(0,0,panes[1].hl,.015,z+gap-.012,z+gap,GRAY,.004); // the rail over the pass-through
  }),box:boxAt(x,y,c,s,hl,.015,z,z+h),radius:hl,plexi:{z,h,gap,panes}};
}
