// The gym's machines, the sports shop's too. Every piece is closed and joined:
// treadmill uprights end in the deck and the console, dumbbell heads sit on the
// rack's rails, ring ropes end inside the corner pads. Parts prepare once.
const gymPaint=(col,base,k=.3)=>(i,t,L)=>{BG[i]=C(col,base+L*k*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
const gymSteel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
function gymBlock(parts,role,x,y,hl,hw,z0,z1,round,shade) {
  const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=x;p.box.y=y;return p;
}
// The runner faces -y. The belt's slats move, and only show up close.
const GYM_DECK=.2;
function gymBeltShade(i,t,L) {
  const slat=HIT.nz>.5?coveGroove(HIT.v+T*2.5,.2,.012,t/projX):0;
  BG[i]=C(GRAY,.9+L*.06+slat*1.3);set(i,' ',0);return true;
}
function gymConsoleShade(i,t,L) {
  BG[i]=C(GRAY,1.5+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);
  if(HIT.face===3&&Math.abs(HIT.u)<.27&&HIT.w>1.09&&HIT.w<1.24) {
    const bar=HIT.w<1.125&&HIT.u<-.25+.5*fract(T*.05); // how far through the session
    BG[i]=bar?C(GREEN,10):C(CYAN,5);
  }
  return true;
}
function TREADMILL(x,y) {
  const parts=[],frame=gymPaint(GRAY,1.5,.28);
  gymBlock(parts,'belt',0,0,.27,.78,GYM_DECK-.03,GYM_DECK,.004,gymBeltShade);
  for(const e of [-1,1])gymBlock(parts,'rail',e*.315,0,.045,.8,0,GYM_DECK+.02,.012,frame);
  gymBlock(parts,'base',0,0,.27,.78,0,GYM_DECK-.03,.01,frame);
  for(const e of [-1,1]) {
    hotelLobbyTube(parts,'upright',e*.31,-.65,GYM_DECK,e*.3,-.82,1.1,.02,gymSteel);
    hotelLobbyTube(parts,'handrail',e*.3,-.78,1.0,e*.32,-.35,.95,.015,gymSteel);
    hotelLobbyTube(parts,'handrail-post',e*.32,-.35,.95,e*.32,-.35,GYM_DECK,.015,gymSteel);
  }
  gymBlock(parts,'console',0,-.85,.36,.08,1.05,1.28,.015,gymConsoleShade);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.36,.93,1.28]),radius:.95,treadmill:{parts,deck:GYM_DECK}};
}
// Two tiers of rails on paired end frames. Each dumbbell's square rubber heads
// rest on the rails, the heavy ones at the end, the bigger sizes below.
const GYM_RACK={half:.88,rail:.09,railR:.015,tiers:[.35,.75],top:.95,count:7};
function WEIGHT_RACK(x,y) {
  const parts=[],{half,rail,railR,tiers,top,count}=GYM_RACK,bells=[];
  const heads=[gymPaint(BRICK,1.3,.3),gymPaint(GRAY,1.1,.3)];
  for(const z of tiers)for(let k=0;k<count;k++) {
    const u=-.72+k*.24,r=.045+k*.006+(z>.5?0:.012),base=z+railR,mid=base+r,shade=heads[k&1];
    for(const e of [-1,1])gymBlock(parts,'head',u,e*rail,r,.022,base,base+2*r,r*.3,shade);
    hotelLobbyTube(parts,'handle',u,-rail,mid,u,rail,mid,.012,gymSteel);
    bells.push({u,z:base,r});
  }
  for(const z of tiers)for(const e of [-1,1])hotelLobbyTube(parts,'rail',-half,e*rail,z,half,e*rail,z,railR,gymSteel);
  for(const u of [-half,half]) {
    for(const e of [-1,1])hotelLobbyTube(parts,'post',u,e*rail,0,u,e*rail,top,.025,gymSteel);
    hotelLobbyTube(parts,'foot',u,-.19,.025,u,.19,.025,.025,gymSteel);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.91,.22,top]),radius:.95,weightRack:{parts,bells}};
}
// The ring's collision reaches the top of its posts: in it is the fight, you
// don't climb in. Filtered canvas with a printed roundel and a taped edge.
function gymRingShade(i,t,L) {
  const {h,top}=GYM_RING;set(i,' ',0);
  if(HIT.face===5) {
    // A flat print seen from above the deck: the pixel's reach along the view
    // grows with t squared, so the print goes before it can break into fragments.
    const r=Math.hypot(HIT.u,HIT.v),f=Math.max(t/projX,t*t/(1.2*projY)),round=f>.24?0:clamp(1-(Math.abs(r-.7)-.1)/Math.max(f,.001),0,1);
    const edge=Math.max(Math.abs(HIT.u),Math.abs(HIT.v))>h-.08;
    BG[i]=edge?C(BLUE,3+L*.2):round>.5?C(RED,3.5+L*.25):C(WHITE,4.5+L*.25);return true;
  }
  BG[i]=HIT.w>top-.06?C(WHITE,3+L*.3):C(BLUE,1.4+L*.2*coveLight(HIT.nx,HIT.ny,HIT.nz));return true;
}
function BOXING_RING(x,y) {
  const parts=[],{h,top}=GYM_RING,post=h-.12,corners=[[-1,-1,RED],[1,-1,WHITE],[1,1,BLUE],[-1,1,WHITE]];
  const height=top+1;
  for(const [ex,ey,col]of corners) {
    const u=ex*post,v=ey*post;
    hotelLobbyTurned(parts,'pad',u,v,[[top+.25,0],[top+.25,.075],[top+.95,.075],[top+.95,0]],gymPaint(col,col===WHITE?4:2.5,.25));
    hotelLobbyTurned(parts,'post',u,v,[[top,0],[top,.04],[height,.04],[height,0]],gymSteel);
  }
  const ropes=[.35,.62,.88].map(z=>top+z),paints=[RED,WHITE,BLUE].map(col=>gymPaint(col,3,.3));
  for(let k=0;k<3;k++)for(let c=0;c<4;c++) {
    const [ax,ay]=corners[c],[bx,by]=corners[(c+1)%4];
    hotelLobbyTube(parts,'rope',ax*post,ay*post,ropes[k],bx*post,by*post,ropes[k],.018,paints[k]);
    parts.at(-1).ray=hotelCurtainRodRay;
  }
  gymBlock(parts,'apron',0,0,h,h,0,top,.012,gymRingShade);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[h,h,height]),radius:Math.hypot(h,h),boxingRing:{parts,ropes,post}};
}
// The heavy bag the trainer talks about: leather on a chain from a ceiling plate.
function GYM_HEAVY_BAG(x,y,height) {
  const parts=[],leather=gymPaint(RED,1.5,.35),bottom=.62,shoulder=1.82;
  hotelLobbyTurned(parts,'bag',0,0,[[bottom,0],[bottom+.02,.12],[bottom+.07,.17],[shoulder-.05,.17],[shoulder,.11],[shoulder,0]],leather);
  hotelLobbyTube(parts,'chain',0,0,shoulder,0,0,height-.02,.01,gymSteel);
  hotelLobbyTurned(parts,'plate',0,0,[[height-.02,0],[height-.02,.06],[height,.06],[height,0]],gymSteel);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.17,.17,bottom,height),radius:.2,heavyBag:{parts,bottom,shoulder,height}};
}
