// Small native models are assembled once on the finished terrain, then bucketed.
const ISLAND_DETAILS=[];
let islandDetailsB=null;
const FERN_CASCADE=[];

function islandDetail(x,y,hl,hw,z0,z1,kind,angle=0) {
  const model={x,y,hl,hw,z0,z1,kind,c:Math.cos(angle),s:Math.sin(angle)};
  ISLAND_DETAILS.push(model);
  return model;
}
function islandStone(x,y,size,seed) {
  const samples=[terrainHeight(x,y),terrainHeight(x-size,y),terrainHeight(x+size,y),terrainHeight(x,y-size),terrainHeight(x,y+size)];
  const z0=Math.min(...samples)-.025,z1=Math.max(...samples)+size*.3;
  const rock=islandDetail(x,y,size,size*.75,z0,z1,'rock');
  rock.planes=landmarkPlanes(rock.hl,rock.hw,z0,z1,'hip');
  rock.seed=seed;
}
function buildIslandScenery() {
  ISLAND_DETAILS.length=FERN_CASCADE.length=0;
  ISLAND_OBSTACLES.length=0;
  for(const island of WILD_ISLANDS) {
    const [x0,y0,x1,y1]=island.dock;
    for(let x=x0+.25;x<x1-.5;x+=3)for(const y of [y0+.06,y1-.06]) {
      const post=islandDetail(x,y,.035,.035,-.025,.12,'timber');post.dockPost=true;ISLAND_OBSTACLES.push(post);
      islandDetail(x,y,.047,.047,.115,.13,'metal');
    }
    // Small cleats sit away from the boarding point and leave the deck open.
    islandDetail(x0+1.7,y0+.12,.07,.025,0,.035,'metal');
    const [lx,ly]=island.landing;
    islandDetail(lx+1.8,ly+.7,.016,.016,0,.18,'timber');
    const marker=islandDetail(lx+1.8,ly+.7,.12,.018,.13,.185,'sign',Math.PI/2);
    Object.assign(marker,{word:island.name.toUpperCase(),ink:BLACK,labelZ:.1575,labelH:.033});
    for(let y=Math.floor(island.y-island.ry);y<island.y+island.ry;y+=4)for(let x=Math.floor(island.x-island.rx);x<island.x+island.rx;x+=4) {
      const seed=hash(x,y,1910),wx=x+(seed-.5)*2,wy=y+(hash(x,y,1911)-.5)*2,edge=wildIslandEdge(wx,wy,island);
      if(edge<.7||edge>16||onPier(wx,wy)||near(wx,wy,lx,ly)<5||map[idx(Math.floor(wx),Math.floor(wy))])continue;
      const approach=wx>FERN_STRIP.x0-28&&wx<FERN_STRIP.x1+28&&Math.abs(wy-FERN_STRIP.y)<3.5;
      if(island.id==='fern'&&(approach||trailDistance(wx,wy)<.7||near(wx,wy,540,245)<5))continue;
      if(seed<.22&&edge<4&&island.id!=='sand')islandStone(wx,wy,.12+seed*.4,seed);
      else if(seed>.85&&edge>2) {
        const z=terrainHeight(wx,wy);
        islandDetail(wx,wy,.13,.13,z,z+.12,island.id==='sand'?'grass':'shrub').seed=seed;
      }
    }
  }
  const house=FERN_HOUSE;
  // A small dock-facing porch; the former south doorway is closed.
  islandDetail(538.88,245.5,.12,.58,0,.008,'timber');
  islandDetail(538.98,245.86,.025,.035,.23,.28,'lamp');
  Object.assign(islandDetail(538.98,246.35,.265,.018,.285,.32,'sign',Math.PI/2),{word:'FERN HOUSE',houseSign:true,ink:BLACK,labelZ:.3025,labelH:.021});
  const [tx,ty]=house.terrace;
  islandDetail(tx,ty,1.2,1.6,0,.004,'deck');
  for(const y of [244.2,246.8]) {
    islandDetail(tx,y,.58,.12,.045,.055,'timber');
    islandDetail(tx,y+.1,.58,.02,.055,.11,'timber');
    for(const x of [tx-.5,tx+.5])islandDetail(x,y,.025,.09,0,.045,'timber');
  }
  for(const y of [244.15,246.85]) {
    islandDetail(538.65,y,.085,.085,0,.075,'pot');
    islandDetail(538.65,y,.13,.13,.075,.21,'shrub').seed=hash(2,y,1912);
  }
  for(const [x,y,angle]of [[707,110,.3],[711,115,-.4],[703,104,.8]]) {
    if(seaAt(x,y))continue;
    const z=terrainHeight(x,y);
    islandDetail(x,y,.4,.035,z-.025,z+.035,'driftwood',angle);
    islandDetail(x+.18*Math.cos(angle),y+.18*Math.sin(angle),.15,.018,z,z+.055,'driftwood',angle+.8);
  }
  // Low rock shelves flank a continuous, inclined sheet of water. Every end is
  // sampled from terrain, so the cascade joins the creek instead of floating.
  for(let y=187;y<194;y+=.5) {
    const x=FERN_FALLS.x+Math.sin((y-FERN_FALLS.y0)*.6)*.15;
    const za=terrainHeight(x,y)+.012,zb=terrainHeight(x,y+.5)+.012,slope=(zb-za)/.5;
    const z=(za+zb)/2,hw=.25,hl=.16+.035*Math.sin(y*2),thickness=.008;
    const planes=[[1,0,0,hl],[-1,0,0,hl],[0,1,0,hw],[0,-1,0,hw],[0,-slope,1,z],[0,slope,-1,-z+thickness]];
    FERN_CASCADE.push({x,y:y+.25,c:1,s:0,hl,hw,z0:Math.min(za,zb)-thickness,z1:Math.max(za,zb),planes});
    if(Math.floor(y*2)%3===0)for(const side of [-1,1])islandStone(x+side*.34,y+.2,.18+hash(side,y,1913)*.12,hash(side,y,1914));
  }
  for(const [x,y]of [[626.15,196],[627.8,196.2],[627.6,197.7]])islandStone(x,y,.18,hash(x,y,1915));
  buildIslandSights();
  buildCoastLife();
  islandDetailsB=bucketed(ISLAND_DETAILS);
}

function islandTimberShade(model,i,t,L) {
  const [nx,ny,nz]=islandModelNormal(model),top=nz>.5,wood=model.kind==='timber'||model.kind==='deck'||model.kind==='driftwood';
  let base=wood?BRICK:GRAY;
  if(model.kind==='trim'||model.kind==='sign')base=STONE;
  if(model.kind==='pot')base=BRICK;
  if(model.kind==='canvas')base=model.base||GREEN;
  if(model.base!==undefined)base=model.base;
  const brightness=(wood?1.6:2.2)+L*(top?.3:.2);
  BG[i]=C(base,brightness);
  if(model.word&&(HIT.face===3||HIT.face===4)) {
    const word=model.houseSign?(homeAt(SHOP[cityPlaceCell('fern-house')])?'FERN HOUSE':'FOR SALE'):model.word;
    const side=HIT.face===3?1:-1,[x,y]=R(model.x-model.s*side*model.hw,model.y+model.c*side*model.hw);
    set(i,worldText(word,HIT.u*side,HIT.w,t,i,x,y,model.labelZ??.195,model.c*side,model.s*side,Math.min(.028,model.hl*1.7/word.length),model.labelH??.04),C(model.ink??BLACK,15));
    return true;
  }
  const fp=t/projY,fine=coveDetail(t,.08);
  if(wood){
    const joint=coveGroove(top?HIT.v:HIT.w,top?1/12:1/45,top?.004:.002,fp);
    const grain=Math.sin(HIT.v*140+Math.sin(HIT.u*8))*fine*.25;
    BG[i]=C(base,brightness+grain-joint*1.4);
  }else if(model.kind==='metal')coveMetal(i,L,nx,ny,nz,base);
  set(i,' ',0);if(nz>.4)paintSettledSnow(i,model.x+model.c*HIT.u-model.s*HIT.v,model.y+model.s*HIT.u+model.c*HIT.v,L,nz,0,HIT.w);
  return true;
}
function islandRockShade(model,i,t,L) {
  const [nx,ny,nz]=islandModelNormal(model),fine=coveDetail(t,.1),fp=t/projY;
  const x=model.x+HIT.u,y=model.y+HIT.v,fraction=(HIT.w-model.z0)/(model.z1-model.z0);
  const moss=fraction<.22&&model.seed>.4&&noise(x*14,y*14,1916)>.5;
  const joint=coveGroove(HIT.w+Math.sin(x*7)*.003,.045,.003,fp);
  BG[i]=C(moss?GREEN:GRAY,1.4+L*.27*coveLight(nx,ny,nz)+(noise(x*19,y*19,1916)-.5)*fine*.5-joint*.8);
  set(i,' ',0);if(nz>.4)paintSettledSnow(i,x,y,L,nz,0,HIT.w);return true;
}
// Cormorant Rock's stacks: warped bedding planes with darker partings, vertical joints, lichen low down, the tops
// crusted white and white runs of guano down the faces from every ledge. Small detail fades with distance
function islandStackShade(m,i,t,L) {
  const p=m.planes[HIT.face],n=Math.hypot(p[0],p[1],p[2]),nx=p[0]/n,ny=p[1]/n,nz=p[2]/n,light=coveLight(nx,ny,nz);
  const z=HIT.w,wx=m.x+HIT.u,wy=m.y+HIT.v,foot=t/projY,fine=coveDetail(t,.15),lit=.2+.8*day; // (its own colour fades with the daylight, like the ground's)
  if(nz>.9) { // the top, whitewashed, darker rock showing through
    const crust=noise(wx*30,wy*30,1991)*fine+.5*(1-fine);
    BG[i]=C(crust>.35?WHITE:GRAY,((crust>.35?4.2:2)+L*.3*light)*lit);set(i,' ',0);return true;
  }
  if(nz<-.9){BG[i]=C(GRAY,.5*lit);set(i,' ',0);return true;}
  const along=-ny*wx+nx*wy,bed=z*16+Math.sin(along*2.3+m.seed*9)*.35;
  const layer=hash(Math.floor(bed),m.spire,1992),parting=coveGroove(bed,1,.12,foot*16),joint=coveGroove(along+hash(Math.floor(bed),3,1993)*.3,.23,.012,foot)*.8;
  const run=hash(Math.floor(along*28),m.tier,1994),guano=run>.45&&m.z1-z<(.2+.6*run*run)*(m.top?1:.6)*(m.z1-m.z0);
  const rim=m.z1-z<.03,lichen=!guano&&z-m.ground<.55&&noise(along*14,z*18,1995+m.spire)>.78;
  let col=GRAY,level=1.55+(layer-.5)*.8*fine;
  if(lichen){col=ORANGE;level=1.7;}
  if(guano||rim){col=WHITE;level=3.8;}
  level*=(1-.45*parting)*(1-.5*joint);
  BG[i]=C(col,(level+L*.26*light)*lit);set(i,' ',0);return true;
}
// a cormorant's nest: a heaped ring of sticks and weed round a hollow, streaked white
const islandNestShade=m=>(i,t,L)=>{
  const r=Math.hypot(HIT.u,HIT.v),ang=Math.atan2(HIT.v,HIT.u),fine=coveDetail(t,.03),inner=HIT.nz>.4&&r<.02;
  const stick=hash(Math.floor(ang*14+r*90),Math.floor(HIT.w*300),m.seed*97|0)>.5,splash=r>.026&&hash(Math.floor(ang*9),Math.floor(r*250),1990)>.84;
  BG[i]=C(splash&&fine>.3?WHITE:inner?BRICK:stick?WARM:BRICK,(splash?2.6:inner?.8:1.4+(stick?.5:0)*fine)*(.2+.8*day)+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));
  set(i,' ',0);return true;
};
function drawIslandShrub(model,vx,vy){drawIslandPlantModel(model,vx,vy);}
function islandRoofShade(roof,i,t,L) {
  if(roof.cabin.id==='cabin-cove')return coveRoofShade(roof,i,t,L);
  if(roof.part==='chimney') {
    landmarkStone(i,HIT.face<2?HIT.v:HIT.u,HIT.w,GRAY,L);
    if(HIT.w>roof.z1-.035){BG[i]=C(GRAY,1+L*.15);set(i,' ',0);}
    return true;
  }
  const end=HIT.face===2||HIT.face===3,cabin=roof.cabin;
  if(end) {
    BG[i]=C(cabin.wood,1.8+L*.2);
    BG[i]=C(cabin.wood,(BG[i]&15)-coveGroove(HIT.w,1/32,.002,t/projY)*1.2);set(i,' ',0);return true;
  }
  const edge=Math.abs(HIT.v)>roof.hw-.025||HIT.w<roof.z0+.025;
  BG[i]=C(edge?STONE:cabin.roof,1.2+L*(HIT.face===6?.27:.17));
  BG[i]=C(edge?STONE:cabin.roof,(BG[i]&15)-coveGroove(HIT.v,1/9,.006,t/projY)*1.3);
  set(i,' ',0);
  paintSettledSnow(i,roof.x+HIT.u,roof.y+HIT.v,L,.7,0,HIT.w);
  return true;
}
function islandCabinFacade(i,u,uStep,z,h,d,side,mx,my,fog,wc) {
  const cabin=ISLAND_CABINS.find(c=>mx>=c.x0&&mx<c.x1&&my>=c.y0&&my<c.y1);
  if(!cabin)return;
  if(cabin.id==='fern-house')return fernHouseFacade(cabin,i,z,d,side,wc,fog);
  if(cabin.id==='cabin-cove')return coveFacade(cabin,i,z,h,d,side,wc,fog);
  const light=fog*amb*(side?10:13),along=side?wc-cabin.x0:wc-cabin.y0;
  const width=side?cabin.x1-cabin.x0:cabin.y1-cabin.y0;
  const corner=Math.min(along,width-along),front=side&&py>cabin.y1;
  const terrace=!side&&px<cabin.x0&&cabin.id==='fern-house';
  const door=front&&Math.abs(along-width/2)<.075||terrace&&Math.abs(along-1.5)<.075;
  BG[i]=C(cabin.wood,1.9+light*.19);
  if(front&&cabin.id!=='fern-house'&&wallText(i,along-width/2,uStep,z,d,cabin.room?'SHELTER':'PRIVATE',0,.275,.028,.028,C(STONE,Math.max(light,5)),BG[i]))return;
  if(corner<.045||z>h-.035){BG[i]=C(STONE,2+light*.2);set(i,' ',0);return;}
  if(z<.04){BG[i]=C(GRAY,1.4+light*.2);BG[i]=C(GRAY,(BG[i]&15)-coveGroove(wc,1/9,.006,d/projY));set(i,' ',0);return;}
  if(door&&z<.27) {
    const du=front?along-width/2:along-1.5;
    if(Math.abs(du)>.06||z>.255){BG[i]=C(STONE,2+light*.2);set(i,' ',0);return;}
    BG[i]=C(GREEN,1.2+light*.12);
    let mark=' ';
    if(z>.17&&z<.24)mark=':';
    else if(Math.abs(du-.037)<.012&&Math.abs(z-.12)<.012)mark='o';
    if(mark!== ' ')BG[i]=C(z>.17?WARM:YEL,Math.max(light,night*8));set(i,' ',0);return;
  }
  const bay=width===3?.72:.5,spacing=width===3?1.55:1;
  const du=along-bay-Math.round((along-bay)/spacing)*spacing;
  if(Math.abs(du)<.14&&z>.12&&z<.27) {
    const frame=Math.abs(du)>.12||z<.13||z>.26||Math.abs(du)<.009||Math.abs(z-.2)<.007;
    if(frame) {
      BG[i]=C(STONE,2+light*.2);
      set(i,' ',0);return;
    }
    BG[i]=C(night>.35?WARM:CYAN,1.2+night*4);
    set(i,' ',0);return;
  }
  BG[i]=C(cabin.wood,(BG[i]&15)-Math.max(coveGroove(z,1/37,.002,d/projY),coveGroove(wc,1/8,.003,d/projY))*.9);set(i,' ',0);
}
function drawFernCascade() {
  if(near(px,py,FERN_FALLS.x,191)>vis+12)return;
  for(const sheet of FERN_CASCADE)drawWaterCascadeSheet(sheet);
  for(let k=0;k<9;k++) {
    const p=fract(T*.65+k*.113),x=FERN_FALLS.x+(hash(k,2,1917)-.5)*.6;
    const y=193.2+p*.25,z=terrainHeight(x,y)+.015+Math.sin(p*Math.PI)*.065;
    drawArt(x-px,y-py,z,.025,.025,[p<.4?'.':'\''],()=>C(WHITE,8+day*3));
  }
}
function drawWildScenery() {
  if(!worldReady||!islandDetailsB)return;
  forNear(islandDetailsB,model=>{
    const vx=model.x-px,vy=model.y-py;
    if(!inView(vx,vy,model.hl+.2))return;
    if(model.landmark){drawIslandLandmark(model.landmark,vx,vy);return;}
    if(model.kind==='wire'){const [a,b]=model.ends;rod(a[0]-px,a[1]-py,a[2],b[0]-px,b[1]-py,b[2],.002,GRAY,1);return;}
    if(model.kind==='tidepool'){drawIslandTidePool(model);return;}
    if(model.kind==='cover') {
      if((model.cover==='flower'||model.cover==='fern')&&season()==='winter')return;
      if(near(px,py,model.x,model.y)<12)drawShape(vx,vy,model.z0,model.hl,model.z1-model.z0,(i,u,z,du,dz,L)=>islandCoverShade(model,i,u,z,L));
      return;
    }
    if(model.kind==='net'||model.kind==='cloth'||model.kind==='canvas') {
      const sway=0; // pinned to its supporting line; folds move in the material
      drawBox({...model,x:vx,y:vy+sway},(i,t,L)=>islandFabricShade(model,i,t,L),model.planes?rayMansard:rayBox);return;
    }
    if(model.kind==='shrub'||model.kind==='grass'){drawIslandShrub(model,vx,vy);return;}
    if(model.kind==='stack'){drawBox({...model,x:vx,y:vy},(i,t,L)=>islandStackShade(model,i,t,L),rayMansard);return;}
    if(model.kind==='nest'){if(near(px,py,model.x,model.y)<16)coveLathe(vx,vy,model.z0,model.profile,islandNestShade(model));return;}
    if(model.kind==='lamp') {
      drawBox({...model,x:vx,y:vy},(i,t,L)=>{BG[i]=C(WARM,3+night*6);set(i,' ',0);return true;});return;
    }
    drawBox({...model,x:vx,y:vy},(i,t,L)=>model.kind==='rock'?islandRockShade(model,i,t,L):islandTimberShade(model,i,t,L),model.planes?rayMansard:rayBox);
  });
  for(const roof of ISLAND_ROOFS)if(!(COVE_VIEW.active&&roof.cabin===COVE_VIEW.hiddenCabin)&&inView(roof.x-px,roof.y-py,roof.hl+roof.hw))
    drawBox({...roof,x:roof.x-px,y:roof.y-py},(i,t,L)=>islandRoofShade(roof,i,t,L),rayMansard);
  if(!COVE_VIEW.active){drawCoveExterior();drawFernExterior();}
  const [lx,ly]=WILD_ISLANDS[0].landing;
  if(near(px,py,lx,ly)<vis) {
    drawBox(boxAt(lx+1-px,ly+.7-py,1,0,.12,.08,0,.09),solid(BRICK,{top:'='}));
    drawArt(lx+1-px,ly+.7-py,.105,.25,.035,['TACKLE'],()=>C(WARM,12));
  }
  if(near(px,py,540.5,247)<vis) {
    if(night>.25)for(let k=0;k<4;k++) {
      const p=fract(T*.14+k*.25),x=541.25+p*.17;
      drawShape(x-px,245.1-py,.76+p*.3,.035+p*.04,.05,(i,u,z,du,dz,L)=>{
        if(hash(Math.floor(u*120),Math.floor(z*120),k)>.3)return false;
        set(i,'.',C(GRAY,3));return true;
      });
    }
  }
  drawFernCascade();
  drawIslandLife();
}
