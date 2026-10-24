// Shared close-up home models. Surfaces have real edges and joined supports;
// screens and bulbs are the only emissive parts of their housings.
function televisionProgramme(u,v,time,channel) {
  let base=BLUE,level=4,ch=' ',ink=WHITE;
  if(channel===0) { // live harbour: passing ferry, moving clouds and gulls
    const horizon=.52,cloud=Math.sin(u*12+time*.13)+Math.cos(u*23-time*.07);
    if(v<.36&&Math.abs(v-(.21+cloud*.035))<.045){base=WHITE;level=8;}
    if(v>horizon){base=CYAN;level=3;ch=Math.sin(u*42+v*85-time*2)>.96?'~':' ';}
    const boat=fract(time*.025)*1.4-.2,dx=u-boat;
    if(v>.54&&v<.61&&Math.abs(dx)<.2-(v-.54)*.8){base=WHITE;level=9;}
    if(v>.45&&v<.54&&Math.abs(dx+.015)<.125){base=STONE;level=7;if(v<.515&&Math.sin((dx+.14)*75)>-.1){base=BLUE;level=1;}}
    const bird=fract(time*.04+.2);if(Math.abs(v-(.2+.03*Math.sin(u*21+time)))<.012&&Math.abs(u-bird)<.035){base=GRAY;level=1;}
  } else if(channel===1) { // cooking show: chef, chopping board, pan and steam
    base=v>.67?BRICK:STONE;level=v>.67?4:7;
    if(u>.09&&u<.9&&v>.2&&v<.3){base=BRICK;level=3;}
    if(((u-.38)/.095)**2+((v-.38)/.12)**2<1){base=WARM;level=9;}
    if(Math.abs(u-.38)<.1&&v>.44&&v<.7){base=WHITE;level=10;}
    if(v>.29&&v<.34&&Math.abs(u-.38)<.12){base=WHITE;level=12;}
    const hand=.62+.08*Math.sin(time*2.4),arm=.51+(u-.42)*(.6+.22*Math.sin(time*2.4));
    if(u>.42&&u<hand&&Math.abs(v-arm)<.027){base=WARM;level=9;}
    if(((u-.72)/.14)**2+((v-.72)/.04)**2<1){base=GRAY;level=1;}
    if(v>.32&&v<.65&&Math.min(Math.abs(u-.68-.025*Math.sin(v*22-time*2)),Math.abs(u-.76-.02*Math.sin(v*25-time*1.7)))<.012){base=WHITE;level=10;ch='~';}
    if(v>.7&&v<.73&&u>.2&&u<.5){base=YEL;level=7;}
  } else if(channel===2) { // miniature rail documentary, train moving past skyline
    const skyline=.48+.12*Math.sin(Math.floor(u*15)*8);
    base=v>skyline?GRAY:BLUE;level=v>skyline?3:6;
    if(v>skyline&&v<.65&&fract(u*45)<.3&&fract(v*35)<.25){base=WARM;level=8;}
    if(v>.74){base=BRICK;level=3;}
    const train=fract(u-time*.07);
    if(v>.53&&v<.73&&train<.85){base=STONE;level=8;if(v<.64&&v>.56&&fract(train*10)<.68){base=CYAN;level=2;}if(v>.69){base=BLUE;level=2;}}
    if(v>.76&&v<.8){base=GRAY;level=1;}
  } else { // evening news: anchor, animated weather map and ticker
    base=BLUE;level=3;
    if(u>.52&&u<.94&&v>.15&&v<.65){base=CYAN;level=5;if(Math.sin(u*18+v*8)>.15){base=GREEN;level=4;}}
    if(((u-.29)/.085)**2+((v-.35)/.105)**2<1){base=WARM;level=10;}
    if(v>.42&&v<.69&&Math.abs(u-.29)<.12-(.69-v)*.12){base=GRAY;level=2;}
    if(v>.64&&v<.75){base=BRICK;level=4;}
    if(u>.55&&v>.2&&v<.65&&Math.abs(u-(.68+.03*Math.sin(v*15+time*.5)))<.018){base=WHITE;level=11;}
    if(v>.8){base=WHITE;level=9;ch=fract(u*32+time*.8)<.35?'-':' ';ink=BLACK;}
  }
  return {base,level,ch,ink};
}
function TELEVISION(x,y,r,scale=1,angle=0) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const c=Math.cos(angle),s=Math.sin(angle),at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const shell={...boxAt(vx,vy,c,s,.74*scale,.07*scale,.7*scale,1.55*scale),round:.025*scale};
    drawBox(shell,(i,t,L)=>{
      if(HIT.face===3&&Math.abs(HIT.u)<.65*scale&&HIT.w>.79*scale&&HIT.w<1.47*scale)return false;
      BG[i]=C(GRAY,.8+L*.14*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    },coveRayRounded);
    const [sx,sy]=at(0,.063*scale);
    drawBox(boxAt(sx,sy,c,s,.65*scale,.001*scale,.79*scale,1.47*scale),(i,t,L)=>{
      if(!r.tv||HIT.face!==3){BG[i]=C(GRAY,.4+L*.035);set(i,' ',0);return true;}
      const frame=televisionProgramme((HIT.u/(.65*scale)+1)/2,(1.47*scale-HIT.w)/(.68*scale),T,(r.tvChannel??Math.floor(T/24))%4);
      BG[i]=C(frame.base,frame.level);set(i,frame.ch,C(frame.ink,12));return true;
    });
    for(const side of [-1,1]){const [ax,ay]=at(side*.42*scale,.01*scale),[bx,by]=at(side*.5*scale,.1*scale);coveTube(ax,ay,.7*scale,bx,by,.61*scale,.018*scale,GRAY);}
  }),radius:scale,box:boxAt(x,y,Math.cos(angle),Math.sin(angle),.74*scale,.12*scale,.61*scale,1.55*scale)};
}

function homeStone(i,t,L) {BG[i]=C(STONE,3.5+L*.22*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}
function HOME_FRIDGE(x,y,{angle=0,height=1.9,halfWidth=.43,halfDepth=.4}={}) {
  const c=Math.cos(angle),s=Math.sin(angle),hw=halfDepth,doorWidth=halfWidth-.04;
  const doors=[[.13,height*1.28/1.9],[height*1.31/1.9,height-.05]].map(([z0,z1])=>{
    const bottom=z0+.012,top=z1-.012,hl=doorWidth,hw=.022,b=.012;
    const planes=[[1,0,0,hl,1],[-1,0,0,hl,2],[0,1,0,hw,3],[0,-1,0,hw,4],[0,0,1,top,5],[0,0,-1,-bottom,6],
      [1,1,0,hl+hw-b,7],[-1,1,0,hl+hw-b,8],[0,1,1,hw+top-b,9],[0,1,-1,hw-bottom-b,10]];
    const normals=Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]));
    return {z0,z1,hl,hw,bottom,top,planes,normals};
  });
  const enamel=(i,t,L)=>{BG[i]=C(WHITE,2.9+L*.26*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const part=(u,v,hl,depth,z0,z1,r,shade)=>{const[xx,yy]=at(u,v);coveRound(xx,yy,c,s,hl,depth,z0,z1,r,shade);};
    const pipe=(u,v,z,uu,vv,zz,r)=>bathroomPipe(...at(u,v),z,...at(uu,vv),zz,r);
    for(const u of [-halfWidth+.13,halfWidth-.13])for(const v of [-hw+.1,hw-.1])part(u,v,.035,.035,0,.09,.01,GRAY);
    part(0,0,halfWidth,hw,.08,height,.045,enamel);
    for(const door of doors) {
      const {z0,z1,hl,bottom,top,planes,normals}=door,[sx,sy]=at(0,hw+.002),[dx,dy]=at(0,hw+.027);
      drawBox(boxAt(sx,sy,c,s,doorWidth+.009,.012,z0,z1),(i,t,L)=>{BG[i]=C(GRAY,.6+L*.1);set(i,' ',0);return true;});
      drawBox({...boxAt(dx,dy,c,s,hl,.022,bottom,top),planes,normals},enamel,homeRayWorktop);
      const lo=z0+.13,hi=Math.min(z1-.1,lo+.36),handle=halfWidth-.15;
      for(const z of [lo,hi])pipe(handle,hw+.05,z,handle,hw+.08,z,.012);
      pipe(handle,hw+.08,lo,handle,hw+.08,hi,.014);
    }
    part(0,hw,halfWidth-.09,.015,.08,.115,.008,GRAY);
  }),radius:Math.hypot(halfWidth,hw)+.3,box:boxAt(x-s*.05,y+c*.05,c,s,halfWidth,hw+.05,0,height),
    kitchenAppliance:{kind:'fridge',angle,height}};
}
// Fixed convex worktop planes avoid marching across a broad, thin slab.
function homeRayWorktop(ox,oy,oz,rx,ry,rz,b) {
  const t=rayBeveledBay(ox,oy,oz,rx,ry,rz,b);if(t<0)return t;
  const n=b.normals[HIT.face];HIT.nx=b.c*n[0]-b.s*n[1];HIT.ny=b.s*n[0]+b.c*n[1];HIT.nz=n[2];return t;
}
function FERN_KITCHEN(r) {
  const planes=[[1,0,0,1.77,1],[-1,0,0,1.77,2],[0,1,0,.42,3],[0,-1,0,.42,4],[0,0,1,.95,5],[0,0,-1,-.88,6],
    [1,0,1,2.695,7],[-1,0,1,2.695,8],[0,1,1,1.345,9],[0,-1,1,1.345,10]];
  const normals=Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]));
  return {...ROOM_MODEL(15.35,1.42,(vx,vy)=>{
    const sink=vx-.9,cut=(i,t,L)=>{if(HIT.face===5&&Math.hypot((HIT.u+.9)/.28,HIT.v/.28)<1)return false;return homeStone(i,t,L);};
    for(const offset of [-1.4,-.7,0,.7,1.4]) {
      drawBox(boxAt(vx+offset,vy,1,0,.34,.39,.08,.88),(i,t,L)=>{
        if(HIT.face===5)return false; // the worktop owns this exposed surface
        const f=HIT.face,nx=f===1?1:f===2?-1:0,ny=f===3?1:f===4?-1:0;
        return coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,nx,ny,f===6?-1:0,3);
      });
      coveRound(vx+offset,vy+.395,1,0,.31,.025,.14,.82,.02,'wood',4);
      coveTube(vx+offset-.1,vy+.43,.72,vx+offset+.1,vy+.43,.72,.014,GRAY);
    }
    const top={...boxAt(vx,vy,1,0,1.77,.42,.88,.95),planes,normals};drawBox(top,cut,homeRayWorktop);
    coveLathe(sink,vy,.76,[[0,0],[0,.12],[.19,.28],[.2,.29],[.21,.27],[.04,.12],[.04,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
    coveTube(sink,vy-.26,.95,sink,vy-.26,1.23,.018,GRAY);coveTube(sink,vy-.26,1.23,sink,vy-.03,1.23,.018,GRAY);
    const oven=vx+1.08;
    for(const dx of [-.14,.14])for(const dy of [-.16,.16])coveLathe(oven+dx,vy+dy,.95,[[0,0],[0,.09],[.012,.09],[.012,0]],(i,t,L)=>{BG[i]=C(GRAY,1.1);set(i,' ',0);return true;});
    coveRound(oven,vy+.424,1,0,.28,.014,.26,.63,.025,GRAY);
    coveTube(oven-.21,vy+.456,.69,oven+.21,vy+.456,.69,.014,GRAY);
    kitchenHobware(vx,vy,.95,1,0,1.08);
  }),radius:2,box:boxAt(15.35,1.42,1,0,1.77,.42,0,.95)};
}
function fernHomeQuality() {
  const def=ROOM_DEFS.islandhome,extra={};
  for(let y=1;y<=10;y++)extra['9,'+y]='#';
  for(let x=1;x<=22;x++)extra[x+',10']='#';
  for(const x of [5,6,15,16])extra[x+',10']='.';
  for(let y=11;y<=22;y++)extra['13,'+y]='#';
  extra['13,16']=extra['13,17']='.';
  for(let y=1;y<=6;y++)extra['18,'+y]='W';
  for(let x=18;x<=22;x++)extra[x+',6']='W';extra['19,6']=extra['20,6']='.';
  def.grid=boxRoom(24,24,extra);def.wc={x0:19,y0:1,x1:23,y1:6,sign:[21,6,21.5]};
  def.home={shelf:[1.18,13],pet:[2,20],bed:[4.1,2.25],closet:[7.5,1.4],sofa:[3,16.8],tv:[3,11.4],fridge:[11.6,1.45],dining:[14.7,6]};
  def.spots={bed:[4.1,3.7],closet:[7.5,2.5],shelf:[2.2,13],pet:[2,20],fridge:[11.6,2.6],stove:[16.4,2.6],workshop:[15.5,13],tv:[3,12.65]};
  def.bedBounds=[4.1,2.25,1.3,1.05];def.lamps=[[4.5,5],[14.5,6],[5,17],[18,16]];
  def.shelfAxis=[0,1];
  def.floor='fernwood';def.bathFloor='fernBath';
  def.props=r=>[
    ...FURNITURE_BED(4.1,2.25,1.32,1.05,GREEN,0,.61,1.22),
    FURNITURE_STORAGE(7.5,1.35,.9,.35,2.2),
    FURNITURE_STORAGE(1.18,13,.75,.18,1.05,-Math.PI/2,true),
    HOME_FRIDGE(11.6,1.45),FERN_KITCHEN(r),
    ...toilet(21,1.42,-1,porcelain),washbasin(19.45,1.35,0,1),BATHTUB(22.5,3.7),
    ...tableBox(14.7,6,1.15,.65),...homeChair(14.7,7.2,0,-1,GREEN),...homeChair(14.7,4.8,0,1,GREEN),
    KITCHEN_SETTING(14.4,6.29,.78,{meal:'coffee'}),
    ...couch(3,16.8,1.8,0,-1,GREEN),...tableBox(3,14.4,.9,.45),
    FURNITURE_STORAGE(3,11.3,.9,.3,.61),TELEVISION(3,11.4,r),
    FURNITURE_STORAGE(14.4,13,.65,.4,1.1,-Math.PI/2),
    POT_PLANT(10.65,11.6,1.5),POT_PLANT(22.45,8.6,1.4),
    ...def.lamps.map(([x,y],k)=>HOME_PENDANT(x,y,def.height,r,k)),
  ];
}
fernHomeQuality();
ROOM_FLOORS.fernwood=(i,f,x,y,row,column,L)=>{
  const depth=Math.max(.1,eye*projY/Math.max(1,row-hor)),footprint=depth/projX;
  const board=Math.floor(y/.3),seam=Math.max(coveGroove(y,.3,.008,footprint),coveGroove(x+(board&1)*1.3,2.6,.008,footprint));
  BG[i]=C(BRICK,3.2+f*1.8-seam*.9);set(i,' ',0);
};
ROOM_FLOORS.fernBath=(i,f,x,y,row,column,L)=>{
  const footprint=Math.max(.001,eye*projY/Math.max(1,row-hor)/projX);
  const grout=Math.max(coveGroove(x,.4,.008,footprint),coveGroove(y,.4,.008,footprint));
  BG[i]=C(STONE,4.5+L*.18-grout*1.2);set(i,' ',0);
};
