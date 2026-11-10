// Station furniture is closed geometry with one measured collision footprint.
// No glyph-texture blocks: metal, enamel, rubber and painted masonry use the
// city's filtered surfaces and the same fitting text as the hospital.
ROOM_FOR['FIRE DEPT']='firestation';
function EMERGENCY_TERMINAL(x,y,kind){
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const paint=(i,t,L)=>{BG[i]=C(kind==='amb'?CYAN:RED,1.8+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const desk=(i,t,L)=>{BG[i]=C(GRAY,1.7+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,r,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,r,shade);p.box.x=u;p.box.y=v;return p;};
  for(const u of [-.64,.64])for(const v of [-.27,.27])box('leg',u,v,.022,.022,.03,.81,.005,metal);
  box('cabinet',-.45,0,.23,.32,.12,.78,.015,paint);
  for(const z of [.33,.55,.74])box('drawer-pull',-.45,.329,.12,.012,z-.008,z+.008,.006,metal);
  box('worktop',0,0,.82,.4,.81,.86,.025,desk);
  box('monitor-foot',0,-.15,.19,.12,.86,.88,.01,metal);
  box('monitor-neck',0,-.19,.025,.025,.88,1.12,.005,metal);
  box('monitor-shell',0,-.19,.48,.04,1.08,1.65,.018,desk);
  const screenHalf=.435,textHalf=screenHalf-.075;
  const screen=(i,t,L)=>{
    const bg=C(BLUE,2);BG[i]=bg;
    if(HIT.face===3){
      for(const [text,z,size]of [['DISPATCH',1.53,.072],[kind==='amb'?'PARAMEDIC':'FIRE & RESCUE',1.35,.052],['SIGN ON / OFF',1.18,.046]]){
        // The text helper takes a per-character width, not the whole label.
        const width=Math.min(size,textHalf*2/text.length);
        if(hotelFittingText(i,HIT.u,HIT.w,t,text,0,z,width,width*1.2,C(CYAN,14),bg))return true;
      }
    }
    set(i,' ',0);return true;
  };
  box('screen',0,-.146,screenHalf,.004,1.12,1.61,.005,screen);
  box('keyboard',.08,.18,.32,.12,.86,.89,.008,metal);
  // Radio: speaker perforations disappear once smaller than a pixel.
  box('radio',.61,-.12,.13,.16,.86,1.10,.012,(i,t,L)=>{const grille=HIT.face===3&&Math.abs(HIT.u)<.09&&HIT.w<1.05;BG[i]=C(GRAY,grille?1:3+L*.2);set(i,' ',0);return true;});
  hotelLobbyTube(parts,'aerial',.68,-.2,1.1,.68,-.2,1.54,.005,metal);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.82,.4,0,1.65),radius:1,emergencyDispatch:kind,emergencyParts:parts};
}
function FIRE_EQUIPMENT(x,y){
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
    const paint=(i,t,L)=>{BG[i]=C(RED,2+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const rubber=(i,t,L)=>{BG[i]=C(YEL,2+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    for(const sx of [-.64,.64])drawBox(boxAt(vx+sx,vy,1,0,.025,.28,0,2.15),metal);
    for(const z of [.12,1.15,2.12])drawBox(boxAt(vx,vy,1,0,.68,.28,z,z+.035),metal);
    for(const sx of [-.31,.31]){
      // Coiled hose: concentric closed round segments, sitting on a shelf.
      for(const radius of [.13,.19,.25])for(let k=0;k<20;k++){
        const t=k/20*TAU,u=(k+1)/20*TAU;
        drawRod(vx+sx+Math.cos(t)*radius,vy+.08,.41+Math.sin(t)*radius,vx+sx+Math.cos(u)*radius,vy+.08,.41+Math.sin(u)*radius,.023,rubber);
      }
      drawRod(vx+sx-.08,vy+.08,.66,vx+sx-.08,vy+.08,.79,.035,metal);
      drum(vx+sx,vy,.11,1.19,1.67,paint);
      drawRod(vx+sx,vy,1.67,vx+sx,vy,1.79,.025,metal);
      drawRod(vx+sx,vy+.03,1.79,vx+sx+.15,vy+.06,1.69,.012,metal);
    }
  },[.69,.29,2.16]),fireEquipment:true};
}
function FIRE_LOCKER(x,y,k){
  const p=ROOM_MODEL(x,y,(vx,vy)=>{
    const metal=(i,t,L)=>{BG[i]=C(GRAY,2+L*.22*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const cloth=(i,t,L)=>{const stripe=HIT.w>1.12&&HIT.w<1.18||HIT.w>.74&&HIT.w<.81;BG[i]=C(stripe?YEL:GRAY,(stripe?7:1.2)+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    for(const sx of [-.38,.38])drawBox(boxAt(vx+sx,vy,1,0,.018,.32,.07,2.24),metal);
    drawBox(boxAt(vx,vy-.3,1,0,.36,.018,.07,2.24),metal);
    for(const z of [.07,.5,1.83,2.20])drawBox(boxAt(vx,vy,1,0,.36,.32,z,z+.035),metal);
    drawBox(boxAt(vx,vy,1,0,.20,.065,.66,1.47),cloth);
    for(const s of [-1,1])drawRod(vx+s*.2,vy,1.4,vx+s*.29,vy+.015,1.01,.066,cloth);
    drawBox(boxAt(vx,vy,1,0,.23,.15,1.88,1.98),solid(YEL));
    drum(vx,vy,.17,1.98,2.10,solid(YEL));
    for(const s of [-1,1])drawBox(boxAt(vx+s*.13,vy+.04,1,0,.07,.17,.105,.38),solid(GRAY));
  },[.4,.33,2.24]);p.fireLocker=k;return p;
}
function fireStationWall(i,u,uStep,z,d,mx,my,L){
  const stripe=z>.98&&z<1.06;
  BG[i]=C(stripe?RED:z<1?GRAY:WARM,(stripe?2.5:2)+L*.24);
  if(my===0&&u>6&&u<14&&z<2.6){
    const bay=Math.abs(u-10)<.055||Math.abs(u-6.1)<.07||Math.abs(u-13.9)<.07||z>2.48;
    BG[i]=C(bay?GRAY:RED,(bay?3:1.5)+L*.24-coveGroove(z,.18,.012,Math.max(uStep,d/projY)));
    if(z>1.65&&z<2.05&&!bay){BG[i]=C(CYAN,1.4+day*2);}
  }
  if(my===0&&wallText(i,u,uStep,z,d,'FIRE & RESCUE',3.2,2.5,.14,.2,C(RED,15),BG[i]))return true;
  if(mx===0&&z>1.4&&wallText(i,u,uStep,z,d,'CREW ROOM',8.2,2.1,.13,.17,C(GRAY,12),BG[i]))return true;
  set(i,' ',0);return true;
}
ROOM_DEFS.firestation={grid:boxRoom(16,12),light:.95,floor:'concrete',ceil:'strip',wall:fireStationWall,spawn:[8,10.3],props:r=>{
  const props=[EMERGENCY_TERMINAL(3.2,2.5,'fire'),FIRE_EQUIPMENT(7,1.4),FIRE_EQUIPMENT(9,1.4),
    SMALL_DESK(3.3,7.5,1.3,.55,.76,0,1,BRICK),BENCHP(3.3,8.6,0,-1),standing(3.6,1.6,BLUE)];
  for(let k=0;k<4;k++)props.push(FIRE_LOCKER(10.5+k,10.1,k));
  props.push({...sitting(3,8.6,BLUE,.45),face:[0,-1]});
  // A clear central aisle joins dispatch, the lockers and the exit. Equipment
  // stays against the bay wall rather than in the doorway approach.
  props.push(ROOM_MODEL(13.8,4.2,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,.4,1.1,0,.8),solid(GRAY));
    drawBox(boxAt(vx,vy,1,0,.42,1.12,.8,.84),solid(STONE));
    drum(vx,vy-.5,.16,.84,1.13,CHROME);
    drawRod(vx,vy-.5,1.13,vx,vy-.5,1.25,.03,CHROME);
  },[.42,1.12,1.25]));
  return props;
}};
const EMERGENCY_HOSPITAL_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>[...EMERGENCY_HOSPITAL_PROPS(r),EMERGENCY_TERMINAL(11.5,7.6,'amb')];
