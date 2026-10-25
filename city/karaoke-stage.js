// The karaoke room's stage, speakers and screen are built: a platform with a
// carpeted deck, a metal nosing and a lit riser; PA cabinets with corner caps,
// a perforated steel grille and a top handle; a floor wedge monitor turned to
// the singer; and a wall-mounted screen whose unlit case and brackets are
// separate from the lit picture, the lyrics lighting up as they are sung.
const KARAOKE={stage:{x:6,y:2.3,hl:2,hw:.6,top:.3,deck:.025,nosing:.02},
  screen:{x:6,half:1.25,bottom:1.35,top:2.55,depth:.07,stand:.06},
  speaker:{hl:.28,hw:.2,h:.9,corner:.035},
  lyric:{w:.16,h:.22}};
// The lyric line and how much of it has been sung, from the music's clock
// (which may run from before zero: mod, not %, keeps the line in range).
function karaokeLyric(t) {
  const line=LYRICS[mod(Math.floor(t/5),LYRICS.length)];
  return {line,sung:fract(t/5)*1.3*line.length};
}
function KARAOKE_STAGE_PLATFORM(neon) {
  const {x,y,hl,hw,top,deck,nosing}=KARAOKE.stage;
  const carpet=(i,t,L)=>{ // black stage carpet, a fine pile that fades with distance
    const pile=hash(Math.floor(HIT.u*120),Math.floor(HIT.v*120),1501)*coveDetail(t,.3);
    BG[i]=C(GRAY,.5+L*.05+pile*.4);set(i,' ',0);return true;
  };
  const riser=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.06*shadeFace(HIT.face));set(i,' ',0);return true;}; // painted black ply
  const strip=(i,t,L)=>{ // the front board, a strip light along its top under the nosing
    if(HIT.face===3&&HIT.w>top-deck-nosing-.03){BG[i]=C(neon,11);set(i,' ',0);return true;}
    return riser(i,t,L);
  };
  const metal=(i,t,L)=>{const f=HIT.face;return coveMetal(i,L,f===1?1:f===2?-1:0,f===3?1:f===4?-1:0,f===5?1:f===6?-1:0);};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    // The front nosing caps the front board; the deck and riser stop behind
    // them, so no two faces share a plane. (The room is on +y.)
    drawBox(boxAt(vx,vy+hw-nosing/2,1,0,hl,nosing/2,top-deck-nosing,top),metal);
    drawBox(boxAt(vx,vy+hw-nosing/2,1,0,hl,nosing/2,0,top-deck-nosing),strip);
    drawBox(boxAt(vx,vy-nosing/2,1,0,hl,hw-nosing/2,top-deck,top),carpet);
    drawBox(boxAt(vx,vy-nosing/2,1,0,hl,hw-nosing/2,0,top-deck),riser);
  }),box:boxAt(x,y,1,0,hl,hw,0,top),radius:Math.hypot(hl,hw),karaokeStage:{x,y,hl,hw,top}};
}
// a PA cabinet on the floor, its grille facing (0, 1)
function KARAOKE_SPEAKER(x,y) {
  const {hl,hw,h,corner}=KARAOKE.speaker;
  const cabinet=(i,t,L)=>{BG[i]=C(GRAY,.6+L*.07*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const grille=(i,t,L)=>{ // perforated steel: holes too small to see far off blend into an even grey
    const f=t/projX,holes=Math.min(1,coveGroove(HIT.u,.008,.004,f)+coveGroove(HIT.w,.008,.004,f));
    const badge=Math.abs(HIT.u)<.05&&Math.abs(HIT.w-(h-.11))<.012;
    BG[i]=badge?C(WHITE,7):C(GRAY,1.6+L*.1-holes*.9);set(i,' ',0);return true;
  };
  const cap=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),front=hw-.012; // (the cabinet's face; the grille and caps stand proud of it to hw)
  const grilleProfile=kitchenPanelProfile(hl-.03,.006,.05,h-.05,.004); // (fixed: built once, not every frame)
  const feet=[[0,0],[0,.025],[.015,.022],[.015,0]],rubber=(i,t,L)=>{BG[i]=C(GRAY,.4);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const ex of [-1,1])for(const ez of [0,1]){ // steel corner caps on the front corners
      const cz=ez?h-corner:corner;coveRound(vx+ex*(hl-corner),vy+hw-corner,1,0,corner,corner,cz-corner,cz+corner,.012,cap);
    }
    drawBox({...boxAt(vx,vy+front+.006,1,0,hl-.03,.006,.05,h-.05),...grilleProfile},grille,homeRayWorktop); // proud of the cabinet front
    coveTube(vx-.08,vy,h+.02,vx+.08,vy,h+.02,.012,GRAY); // the carrying handle, on two posts
    for(const e of [-.08,.08])coveTube(vx+e,vy,h,vx+e,vy,h+.02,.01,GRAY);
    coveRound(vx,vy-.006,1,0,hl,hw-.006,.015,h,.025,cabinet);
    for(const ex of [-1,1])for(const ey of [-1,1])coveLathe(vx+ex*(hl-.05),vy+ey*(hw-.05),0,feet,rubber);
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.032),radius:Math.hypot(hl,hw)+.05,karaokeSpeaker:{hl,hw,h}};
}
// a floor wedge monitor on the stage, its sloped face turned up to the singer at -y
function KARAOKE_MONITOR(x,y,z) {
  const hl=.24,hw=.16,low=.08,high=.26;
  // the slope runs from high at +y down to low at -y
  const slope=(high-low)/(2*hw),n=Math.hypot(slope,1);
  // (cos, sin) of the box frame are (1, 0), so local v is world y
  const planes=[[1,0,0,hl,1],[-1,0,0,hl,2],[0,1,0,hw,3],[0,-1,0,hw,4],[0,0,-1,-z,6],[0,-slope/n,1/n,(z+(low+high)/2)/n,5]];
  const normals=Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]));
  const shade=(i,t,L)=>{
    if(HIT.face===5){const f=t/projX,holes=Math.min(1,coveGroove(HIT.u,.008,.004,f)+coveGroove(HIT.v,.008,.004,f));BG[i]=C(GRAY,1.5+L*.1-holes*.8);set(i,' ',0);return true;}
    BG[i]=C(GRAY,.6+L*.07*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox({...boxAt(vx,vy,1,0,hl,hw,z,z+high),planes,normals},shade,homeRayWorktop)),
    radius:.3,karaokeMonitor:{hl,hw,z,low,high}};
}
// Letters as wide as fits the whole line inside the bezel.
function karaokeLetter(line) {
  const {half}=KARAOKE.screen;return Math.min(KARAOKE.lyric.w,(2*(half-.04)-.12)/line.length);
}
// The screen hangs on the back wall face at y = wallY, its picture facing +y.
function KARAOKE_SCREEN(wallY) {
  const {x,half,bottom,top,depth,stand}=KARAOKE.screen,{w,h}=KARAOKE.lyric,bezel=.04,mid=(bottom+top)/2;
  const cy=wallY+stand+depth/2;
  const caseShade=(i,t,L)=>{BG[i]=C(GRAY,.5+L*.06*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const caseProfile=kitchenPanelProfile(half,depth/2,bottom,top,.012); // (built once)
  let cx=0,cyv=0;
  const picture=(i,t,L)=>{
    // a slow colour wash behind the words, and the line itself, sung part in magenta
    const {line,sung}=karaokeLyric(T),wash=.5+.5*Math.sin(HIT.u*1.3+T*.4);
    const lw=karaokeLetter(line),p=Math.floor(HIT.u/lw+line.length/2);
    const ch=worldText(line,HIT.u,HIT.w,t,i,cx,cyv,mid-.12,1,0,lw,h);
    BG[i]=C(BLUE,2+wash*1.4);set(i,ch,C(p>=0&&p<sung?MAG:WHITE,15));return true;
  };
  return {...ROOM_MODEL(x,cy,(vx,vy)=>{
    cx=vx;cyv=vy+depth/2+.001;
    drawBox(boxAt(vx,vy+depth/2+.0005,1,0,half-bezel,.0005,bottom+bezel,top-bezel),picture);
    drawBox({...boxAt(vx,vy,1,0,half,depth/2,bottom,top),...caseProfile},caseShade,homeRayWorktop);
    for(const e of [-.5,.5]) // the wall brackets behind it
      drawBox(boxAt(vx+e,vy-depth/2-stand/2,1,0,.05,stand/2,mid-.2,mid+.2),(i,t,L)=>coveMetal(i,L,0,0,1));
  }),box:boxAt(x,wallY+(stand+depth+.001)/2,1,0,half,(stand+depth+.001)/2,bottom,top),walk:true,radius:half+.1,karaokeScreen:{x,y:cy,half,bottom,top,depth,stand,wallY}};
}
