ROOM_FOR.COURIER='courier';
const COURIER_DISPATCH_LINES=['ROOFTOP COURIERS','PARCEL DISPATCH','GREEN ROOF $80','SPEED BONUS $40'];
function courierWall(i,u,uStep,z,d,mx,my,L) {
  if(my===0&&Math.abs(u-10.3)<2.4&&z>1.85&&z<2.85) {
    BG[i]=C(GREEN,2);
    for(const [row,text] of COURIER_DISPATCH_LINES.entries())
      if(wallText(i,u,uStep,z,d,text,10.3,2.65-row*.2,.17,.16,C(STONE,L),C(GREEN,2)))return true;
    return set(i,' ',0),true;
  }
  BG[i]=C(BRICK,1+L*.12);
  return set(i,fract(u*4+(Math.floor(z*8)&1)*.5)<.12?'|':'_',C(BRICK,L*.7)),true;
}
function courierFacade(i,u,uStep,z,h,d,side,mx,my,fog,wc) {
  const L=fog*amb*(side?11:15),center=side?179.5:102.5,along=rel(wc-center);
  const readableCenter=(Math.sign(u*wc)||1)*center;
  BG[i]=C(BRICK,2+L*.2);
  if(z>h-.06||Math.abs(z-.48)<.022)return set(i,'=',C(STONE,L));
  if(z>.33&&z<.43) {
    BG[i]=C(GREEN,2);
    return wallText(i,u,uStep,z,d,'ROOFTOP COURIERS',readableCenter,.38,.09,.065,C(STONE,Math.max(L,night*12)),C(GREEN,2))||set(i,' ',0);
  }
  if(z<.33&&Math.abs(along)<.21) {
    BG[i]=C(GREEN,1+L*.16);return set(i,Math.abs(along)<.01?'|':fract(z*15)<.1?'=':':',C(STONE,L)),true;
  }
  const bay=along+.5-Math.floor(along+.5);
  if(z>.7&&z<1.2&&bay>.18&&bay<.82) {
    if(z<.73||z>1.17||bay<.21||bay>.79)return set(i,z<.73||z>1.17?'=':'|',C(STONE,L));
    BG[i]=C(CYAN,2+day);return set(i,Math.abs(bay-.5)<.012?'|':Math.abs(z-.95)<.012?'-':':',C(CYAN,L));
  }
  const mortar=fract(z*24)<.12||fract(wc*8+(Math.floor(z*24)&1)*.5)<.055;
  return set(i,mortar?'_':hash(Math.floor(wc*20),Math.floor(z*30),8)>.96?'.':' ',C(mortar?STONE:BRICK,L*.65));
}
ROOM_DEFS.courier={grid:boxRoom(14,10,{'3,0':'E','4,0':'E'}),light:.9,floor:'wood',ceil:'strip',wall:courierWall,
  ex:4,keeper:[10.3,3.1],spawn:[7,8.3],props:()=>{
    const props=[standing(10.3,3.1,GREEN),BX(10.3,4,2.1,.35,0,1,solid(BRICK))];
    for(const x of [1.7,2.5,3.3])for(const z of [0,.55])props.push(BX(x,6.2,.32,.35,z,z+.5,solid(BRICK,{top:'='})));
    props.push(BX(10,4,.3,.2,1,1.4,solid(STONE,{top:'='})),BX(11.2,4,.25,.18,1,1.3,solid(BRICK)));
    return props;
  }};
function courierPrompt() {
  if(mode==='ladder')return 'W/S: climb up/down | E or Space: let go';
  if(courierAtRecipient())return `E: deliver the gardening supplies to ${COURIER_GARDEN.name}`;
  const ladder=courierLadderNear();
  if(ladder)return `E: grab the ladder (${ladder.end==='bottom'?'up to the roof':'down to the street'})`;
  if(mode==='room'&&room.kind==='courier'&&nearKeeper())
    return courierJob?'E: ask the dispatcher about your delivery':`E: take a rooftop delivery ($80 + up to $40 speed bonus)`;
  return '';
}
function courierUse() {
  if(mode==='ladder'){leaveCourierLadder();return true;}
  if(courierAtRecipient()) {
    const result=finishCourier();saveGame();
    say(`"Perfect! The tomatoes were getting impatient." ${COURIER_GARDEN.name} takes the supplies. Delivery: ${fmt$(result.pay)}${result.bonus?` (${fmt$(result.bonus)} speed bonus)`:''}.`,6);
    return true;
  }
  const nearby=courierLadderNear();
  if(nearby){grabCourierLadder(nearby);return true;}
  if(mode==='room'&&room.kind==='courier'&&nearKeeper()) {
    if(courierJob)say(`"${courierRoute().directions} If you fall, use the apartment elevators to get back up. The parcel's safe in your courier bag."`,8);
    else {
      startCourier();saveGame();
      say(`"Gardening supplies for ${COURIER_GARDEN.name}. Eighty dollars, plus a speed bonus. Stairs are on your left." The parcel goes in your courier bag, leaving your hands free.`,8);
    }
    return true;
  }
  if(mode==='roof'&&near(px,py,COURIER_GARDEN.x,COURIER_GARDEN.y)<.3&&Math.abs(roofH-COURIER_GARDEN.z)<.1) {
    say('"The roof gets the best sun. Want a tomato?"',4);return true;
  }
  return false;
}
function grabCourierLadder({ladder,end}) {
  const p=ladder[end];climbing={ladder,z:p[2]};
  mode='ladder';room=null;roofLot=null;body.z=body.vz=body.peak=0;body.seat=null;body.mx=body.my=0;
  px=ladder.x-Math.cos(ladder.yaw)*.08;py=ladder.y-Math.sin(ladder.yaw)*.08;a=ladder.yaw;pitch=0;
  say('W/S to climb. E or Space to let go.',3);
}
function finishCourierClimb(end) {
  const {ladder}=climbing,p=ladder[end];climbing=null;
  [px,py]=p;body.z=body.vz=body.peak=0;body.mx=body.my=0;body.groundMode=null;
  room=null;roofH=p[2];roofLot=new Set();mode=end==='top'?'roof':'walk';
  if(mode==='roof')notePoliceRoofEntry(px,py,[ladder.bottom[0],ladder.bottom[1],ladder.yaw]);
}
function stepCourierLadder(dt) {
  if(!climbing)return;
  const direction=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0);
  const {ladder}=climbing;
  climbing.z=clamp(climbing.z+direction*dt*.27,ladder.bottom[2],ladder.top[2]);
  if(direction>0&&climbing.z>=ladder.top[2])finishCourierClimb('top');
  else if(direction<0&&climbing.z<=ladder.bottom[2])finishCourierClimb('bottom');
}
function leaveCourierLadder() {
  if(!climbing)return;
  const {ladder,z}=climbing;
  if(z>=ladder.top[2]-.08)return finishCourierClimb('top');
  if(z<=ladder.bottom[2]+.08)return finishCourierClimb('bottom');
  climbing=null;room=null;mode='walk';roofH=0;roofLot=null;
  body.z=z*10;body.vz=0;body.peak=body.z;body.groundMode=null;
  body.mx=-Math.cos(ladder.yaw)*.18;body.my=-Math.sin(ladder.yaw)*.18;
}
function courierText() {
  const r=courierRoute();if(!r)return '';
  return `COURIER: gardening supplies → ${r.recipient.name}'s roof garden | base $80 | speed bonus ${fmt$(courierBonus(r,courierJob.took))}`;
}
const COURIER_BAG_ART=['\\', ' \\', ' .\\----.', '/==[ ]==\\', '|  >[]  |', '| SEEDS |', '|_______|', ' \\_____/'];
function drawCourierBag() {
  if(!courierJob||!onFootMode()&&mode!=='ladder')return;
  const size=clamp(Math.round(cv.height/65),8,15),sway=climbing?Math.sin(T*5)*2:Math.sin(T*7)*Math.min(3,Math.hypot(body.mx||0,body.my||0)*4);
  g.font=size+'px monospace';
  artText(COURIER_BAG_ART,-2+sway,cv.height-size*7.3,size,ch=>C(ch==='['||ch===']'?STONE:GREEN,13));
  g.font=FS+'px monospace';
}
function courierBox(kind,x,y,hl,hw,z0,z1,col=GRAY,block=true) {
  const o={kind,x,y,hl,hw,z0,z1,c:1,s:0,col,block};COURIER_SCENERY.push(o);return o;
}
for(const o of [...COURIER_SURFACES.filter(o=>o.kind==='bridge'),...COURIER_STAIRS]) {
  const vertical=o.axis==='y',length=vertical?o.hw:o.hl;
  for(const side of [-1,1]) {
    const x=o.x+(vertical?side*(o.hl+.006):0),y=o.y+(vertical?0:side*(o.hw+.006));
    const rail=courierBox('rail',x,y,vertical?.003:o.hl,vertical?o.hw:.003,0,0,GRAY);
    rail.h0=o.h0+.105;rail.h1=o.h1+.105;rail.axis=o.axis;rail.thickness=.006;
    rail.z0=Math.min(rail.h0,rail.h1)-rail.thickness;rail.z1=Math.max(rail.h0,rail.h1);rail.planes=courierSurfacePlanes(rail);
    const count=Math.ceil(length*2/.65);
    for(let k=0;k<=count;k++) {
      const position=-length+length*2*k/count;
      const sx=x+(vertical?0:position),sy=y+(vertical?position:0),z=courierSurfaceTop(o,sx,sy);
      courierBox('post',sx,sy,.004,.004,z,z+.105,GRAY);
    }
    if(o.kind==='stairs') {
      const beam=courierBox('stringer',x,y,vertical?.007:o.hl,vertical?o.hw:.007,Math.min(o.h0,o.h1),Math.max(o.h0,o.h1),GRAY,false);
      beam.h0=o.h0;beam.h1=o.h1;beam.axis=o.axis;beam.thickness=.025;
      beam.planes=[...courierSurfacePlanes(beam),[0,0,-1,-beam.z0,6]];
    }
  }
  if(o.kind==='bridge') {
    // Short bearing pads sit behind the cornice; nothing extends into the facade or the lane below.
    for(const end of [-1,1]) {
      const x=o.x+(vertical?0:end*(o.hl-.07)),y=o.y+(vertical?end*(o.hw-.07):0);
      const base=courierMapHeight(x,y);
      if(base)for(const side of [-1,1])
        courierBox('bearing',x+(vertical?side*.075:0),y+(vertical?0:side*.075),.022,.022,base,o.z0,GRAY,false);
    }
    for(const side of [-1,1]) {
      // Under-deck beams stop short of both walls, leaving their decorative cornices intact.
      courierBox('beam',o.x+(vertical?side*.085:0),o.y+(vertical?0:side*.085),
        vertical?.008:o.hl-.32,vertical?o.hw-.32:.008,o.z0-.025,o.z0,GRAY,false);
    }
  }
}
// Machinery, washing and a potting terrace give the roofs distinct purposes.
const tankZ=courierMapHeight(182.7,107.8);
const courierTank=courierBox('tank',182.7,107.8,.2,.2,tankZ+.06,tankZ+.36,BRICK);
courierTank.planes=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4),0,.19,k+1]);
courierTank.planes.push([0,0,1,courierTank.z1,5],[0,0,-1,-courierTank.z0,6]);
const tankCap=courierBox('tank-cap',182.7,107.8,.22,.22,tankZ+.36,tankZ+.45,GRAY);
tankCap.planes=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4),.22/.09,(tankZ+.45)*.22/.09,k+7]);
tankCap.planes.push([0,0,-1,-tankCap.z0,6]);
for(const x of [182.56,182.84])for(const y of [107.66,107.94])courierBox('tank-leg',x,y,.015,.015,tankZ,tankZ+.08,GRAY);
for(const x of [181,182])courierBox('laundry-pole',x,106.8,.012,.012,1.5,1.73,GRAY);
for(const x of [181.22,181.5,181.78])courierBox('laundry',x,106.8,.08,.008,1.57,1.72,[WHITE,BLUE,RED][Math.round((x-181.22)/.28)],false);
courierBox('clothesline',181.5,106.8,.5,.003,1.725,1.73,GRAY,false);
for(const [x,y] of [[198.4,101.4],[199.5,101.5],[199.65,102.7],[198.5,103.35]]) {
  const z=courierMapHeight(x,y);courierBox('planter',x,y,.15,.12,z,z+.055,BRICK);
  courierBox('plant',x,y,.12,.1,z+.055,z+.19,GREEN,false);
}
courierBox('potting-table',198.65,102.7,.24,.12,COURIER_GARDEN.z+.08,COURIER_GARDEN.z+.088,BRICK);
for(const dx of [-.2,.2])for(const dy of [-.08,.08])courierBox('table-leg',198.65+dx,102.7+dy,.009,.009,COURIER_GARDEN.z,COURIER_GARDEN.z+.08,BRICK);
courierBox('soil-sack',198.3,102.7,.075,.065,COURIER_GARDEN.z,COURIER_GARDEN.z+.09,STONE);
for(const x of [198.3,198.5])courierBox('trellis-post',x,101.4,.007,.007,1.4,1.67,BRICK);
for(const z of [1.5,1.58,1.66])courierBox('trellis',198.4,101.4,.11,.004,z,z+.005,BRICK,false);
const oldPrintSign=courierBox('print-sign',177.98,101.5,.35,.008,.65,.82,GREEN,false);
oldPrintSign.c=0;oldPrintSign.s=1;
const COURIER_SIGNS=[[179.5,102.35,'v'],[179.5,106.35,'>'],[182.5,107.4,'v'],[183.5,108.1,'v'],
  [183.55,109.5,'>'],[186.5,109.35,'^'],[186.5,107.35,'>'],
  [188.2,106.85,'>'],[190.7,107.4,'>'],[191.4,107.4,'^'],[191.4,103.4,'^'],
  [191.4,101.25,'>'],[194.35,101.55,'v'],[194.32,102.4,'>'],[197.65,102.4,'>'],
  [182.8,106.52,'>',true],[184.52,106.52,'>',true],[191.6,102.35,'>',true],[192.73,102.35,'>',true]]
  .map(([x,y,arrow,shortcut=false])=>
    ({x,y,arrow,shortcut,z:Math.max(courierMapHeight(x,y),courierRoofHeight(x,y))+.002}));
const courierSceneryB=bucketed(COURIER_SCENERY),courierSignsB=bucketed(COURIER_SIGNS),courierSurfacesB=bucketed(COURIER_SURFACES);
function courierRoofBlocked(x,y,z,pad=.025) {
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const o of courierSceneryB[bi(Math.floor(x/8)+i,Math.floor(y/8)+j)])
    if(o.block&&z<o.z1-.015&&z+.16>o.z0&&courierContains(o,x,y,pad))return true;
  return false;
}
function drawCourier() {
  if(mode==='room')return;
  forNear(courierSurfacesB,o=>{
    const [x,y]=R(o.x,o.y);
    drawBox({...o,x,y},(i,t,L)=>{
      const top=HIT.face===5,along=o.axis==='y'?HIT.v:HIT.u,across=o.axis==='y'?HIT.u:HIT.v;
      const half=o.axis==='y'?o.hl:o.hw;
      const edge=top&&Math.abs(across)>half-.012;
      const seam=top&&fract((along+(o.axis==='y'?o.y:o.x))*12)<.09;
      const grain=hash(Math.floor((o.x+HIT.u)*45),Math.floor((o.y+HIT.v)*45),9);
      const col=top&&!edge&&o.kind!=='hut'?BRICK:GRAY;
      BG[i]=C(col,1.5+L*(top?.32:.18));
      let ch=' ';
      if(edge)ch='|';
      else if(seam)ch='=';
      else if(grain>.88)ch='.';
      else if(grain<.08&&top)ch='-';
      set(i,ch,C(seam?STONE:col,L*(seam?.65:.85)));
      if(HIT.face===5)paintSettledSnow(i,o.x+HIT.u,o.y+HIT.v,L*.7,1,0,HIT.w);
      return true;
    },rayBeveledBay);
  });
  forNear(courierSceneryB,o=>{
    const [x,y]=R(o.x,o.y);drawBox({...o,x,y},(i,t,L)=>{
      if(o.kind==='plant') {
        const leaf=hash(Math.floor((o.x+HIT.u)*65),Math.floor(HIT.w*65),Math.floor((o.y+HIT.v)*65));
        if(leaf<.4)return false;
        const col=leaf>.96?RED:GREEN;
        BG[i]=C(col,2+L*.25);return set(i,leaf>.96?'o':leaf>.7?'%':'&',C(col,L)),true;
      }
      if(o.kind==='print-sign') {
        BG[i]=C(GREEN,2);
        for(const [row,text] of ['PRINT','& POST'].entries()) {
          const q=HIT.u/.09+text.length/2,k=Math.floor(q);
          if(k>=0&&k<text.length&&oneCell((fract(q)-.5)*.09,t/projX)&&oneCell(HIT.w-(.785-row*.08),t/projY))return set(i,text[k],C(STONE,L)),true;
        }
        return set(i,' ',0),true;
      }
      BG[i]=C(o.col,1.5+L*.35);
      const ch=o.kind==='tank'?(fract(HIT.w*20)<.15?'=':'|'):o.kind==='laundry'?'~':HIT.face===5?'_':'|';
      return set(i,ch,C(o.col,L)),true;
    },o.planes?rayBeveledBay:rayBox);
  });
  for(const ladder of COURIER_LADDERS) {
    const [x,y]=R(ladder.x,ladder.y);if(Math.hypot(x,y)>vis)continue;
    const c=-Math.sin(ladder.yaw),s=Math.cos(ladder.yaw),z0=ladder.bottom[2],z1=ladder.top[2]+.12;
    for(const side of [-1,1])drawBox({x:x+c*.055*side,y:y+s*.055*side,c,s,hl:.007,hw:.012,z0,z1},solid(GREEN));
    drawBox({x,y,c,s,hl:.055,hw:.008,z0,z1},(i,t,L)=>{
      if(fract((HIT.w-z0)*32)>.16)return false;
      BG[i]=C(GRAY,3+L*.3);return set(i,'=',C(STONE,L)),true;
    });
  }
  // Paint on the deck, with fixed orientation rather than camera-facing floating labels.
  forNear(courierSignsB,o=>{
    const [x,y]=R(o.x,o.y),{arrow}=o;
    drawBox({x,y,c:1,s:0,hl:.13,hw:.09,z0:o.z,z1:o.z+.002},(i,t,L)=>{
      if(HIT.face!==5)return false;
      const u=HIT.u/.13,v=HIT.v/.09;
      const across=arrow==='>'?v:u,forward=arrow==='^'?-v:arrow==='>'?u:v;
      if(!(Math.abs(across)<.09&&forward<.45 || forward>.15&&Math.abs(across)<(.95-forward)*.65))return false;
      return set(i,'#',C(o.shortcut?CYAN:YEL,L*1.2)),true;
    });
  });
  drawArt(...R(COURIER_GARDEN.x,COURIER_GARDEN.y),COURIER_GARDEN.z,.055,.175,ART.keeper,(ch,row,L)=>C(row<3?SKIN:GREEN,L));
}
