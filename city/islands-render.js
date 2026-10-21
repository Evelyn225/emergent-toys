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
  for(const island of WILD_ISLANDS) {
    const [x0,y0,x1,y1]=island.dock;
    for(let x=x0+.25;x<x1-.5;x+=3)for(const y of [y0+.06,y1-.06]) {
      islandDetail(x,y,.035,.035,-.025,.12,'timber');
      islandDetail(x,y,.047,.047,.115,.13,'metal');
    }
    // Small cleats sit away from the boarding point and leave the deck open.
    islandDetail(x0+1.7,y0+.12,.07,.025,0,.035,'metal');
    const [lx,ly]=island.landing;
    islandDetail(lx+1.8,ly+.7,.022,.022,0,.22,'timber');
    islandDetail(lx+1.8,ly+.7,.15,.025,.16,.23,'sign',Math.PI/2).word=island.name.toUpperCase();
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
  islandDetail(540.5,247.17,.58,.35,.28,.31,'timber');
  for(const x of [540.03,540.97])islandDetail(x,247.45,.018,.018,0,.29,'trim');
  islandDetail(540.14,247.025,.035,.025,.23,.28,'lamp');
  islandDetail(540.5,247.52,.33,.025,.285,.32,'sign');
  const [tx,ty]=house.terrace;
  islandDetail(tx,ty,1.1,1.6,0,.004,'deck');
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
  islandDetailsB=bucketed(ISLAND_DETAILS);
}

function islandTimberShade(model,i,t,L) {
  const top=HIT.face===5,wood=model.kind==='timber'||model.kind==='deck'||model.kind==='driftwood';
  let base=wood?BRICK:GRAY;
  if(model.kind==='trim'||model.kind==='sign')base=STONE;
  if(model.kind==='pot')base=BRICK;
  const brightness=(wood?1.6:2.2)+L*(top?.3:.2);
  BG[i]=C(base,brightness);
  if(model.word&&(HIT.face===3||HIT.face===4)) {
    const along=HIT.face===3?HIT.u:-HIT.u;
    if(wallText(i,along,t/projX,HIT.w,t,model.word,0,.195,Math.min(.028,.25/model.word.length),.04,C(GREEN,Math.max(5,L)),BG[i]))return true;
  }
  let ch=' ';
  if(wood) {
    if(top)ch=fract((model.y+HIT.v)*12)<.07?'|':' ';
    else ch=fract(HIT.w*45)<.09?'=':' ';
  }
  else if(model.kind==='metal')ch=top?'=':'|';
  else if(model.kind==='sign')ch=top?'=':' ';
  set(i,ch,C(wood?WARM:base,L*.7));
  return true;
}
function islandRockShade(model,i,t,L) {
  const moss=HIT.face>=6&&model.seed>.4;
  const grain=hash(Math.floor((model.x+HIT.u)*37),Math.floor(HIT.w*59),1916);
  const base=moss?GREEN:GRAY;
  BG[i]=C(base,1.1+L*(HIT.face>=6?.28:.16));
  set(i,grain>.96?'.':' ',C(moss?GREEN:STONE,L*.65));
  return true;
}
function drawIslandShrub(model,vx,vy) {
  const grass=model.kind==='grass',height=model.z1-model.z0;
  drawShape(vx,vy,model.z0,model.hl,height,(i,u,z,du,dz,L)=>{
    const sway=Math.sin(T*1.3+model.seed*12)*.006*z/height,local=(u-sway)/model.hl;
    if(grass) {
      if(Math.abs(local)>.8*(1-z/height)||Math.abs(Math.sin(local*12+z*15))<.7)return false;
      set(i,z>height*.8?'\'':'|',C(YEL,L*.75));return true;
    }
    if(local*local+((z-height*.48)/(height*.53))**2>1)return false;
    const grain=hash(Math.floor(u*75),Math.floor(z*75),Math.floor(model.seed*1000));
    if(grain>.88)return false;
    BG[i]=C(GREEN,1.1+L*.18);
    set(i,grain>.73?'\'':grain<.06&&model.seed>.8?'*':' ',C(grain<.06?WARM:GREEN,L*.85));return true;
  });
}
function islandRoofShade(roof,i,t,L) {
  if(roof.part==='chimney') {
    landmarkStone(i,HIT.face<2?HIT.v:HIT.u,HIT.w,GRAY,L);
    if(HIT.w>roof.z1-.035){BG[i]=C(GRAY,1+L*.15);set(i,'=',C(STONE,L*.8));}
    return true;
  }
  const end=HIT.face===2||HIT.face===3,cabin=roof.cabin;
  if(end) {
    BG[i]=C(cabin.wood,1.8+L*.2);
    set(i,fract(HIT.w*32)<.07?'=':' ',C(WARM,L*.6));return true;
  }
  const edge=Math.abs(HIT.v)>roof.hw-.025||HIT.w<roof.z0+.025;
  const seam=fract(HIT.v*9)<.055;
  BG[i]=C(edge?STONE:cabin.roof,1.2+L*(HIT.face===6?.27:.17));
  let mark=seam?'/':' ';
  if(edge)mark='=';
  set(i,mark,C(edge?STONE:cabin.roof,L*.9));
  paintSettledSnow(i,roof.x+HIT.u,roof.y+HIT.v,L,.7,0,HIT.w);
  return true;
}
function islandCabinFacade(i,u,uStep,z,h,d,side,mx,my,fog,wc) {
  const cabin=ISLAND_CABINS.find(c=>mx>=c.x0&&mx<c.x1&&my>=c.y0&&my<c.y1);
  if(!cabin)return;
  const light=fog*amb*(side?10:13),along=side?wc-cabin.x0:wc-cabin.y0;
  const width=side?cabin.x1-cabin.x0:cabin.y1-cabin.y0;
  const corner=Math.min(along,width-along),front=side&&py>cabin.y1;
  const terrace=!side&&px<cabin.x0&&cabin.id==='fern-house';
  const door=front&&Math.abs(along-width/2)<.075||terrace&&Math.abs(along-1.5)<.075;
  BG[i]=C(cabin.wood,1.9+light*.19);
  if(front&&cabin.id!=='fern-house'&&wallText(i,along-width/2,uStep,z,d,cabin.room?'SHELTER':'PRIVATE',0,.275,.028,.028,C(STONE,Math.max(light,5)),BG[i]))return;
  if(corner<.045||z>h-.035){BG[i]=C(STONE,2+light*.2);set(i,z>h-.035?'=':'|',C(STONE,light));return;}
  if(z<.04){BG[i]=C(GRAY,1.4+light*.2);set(i,fract(wc*9)<.06?'|':' ',C(STONE,light*.5));return;}
  if(door&&z<.27) {
    const du=front?along-width/2:along-1.5;
    if(Math.abs(du)>.06||z>.255){BG[i]=C(STONE,2+light*.2);set(i,z>.255?'_':'|',C(STONE,light));return;}
    BG[i]=C(GREEN,1.2+light*.12);
    let mark=' ';
    if(z>.17&&z<.24)mark=':';
    else if(Math.abs(du-.037)<.012&&Math.abs(z-.12)<.012)mark='o';
    set(i,mark,C(z>.17?WARM:YEL,Math.max(light,night*8)));return;
  }
  const bay=width===3?.72:.5,spacing=width===3?1.55:1;
  const du=along-bay-Math.round((along-bay)/spacing)*spacing;
  if(Math.abs(du)<.14&&z>.12&&z<.27) {
    const frame=Math.abs(du)>.12||z<.13||z>.26||Math.abs(du)<.009||Math.abs(z-.2)<.007;
    if(frame) {
      BG[i]=C(STONE,2+light*.2);
      set(i,Math.abs(du)<.009?'|':'=',C(STONE,light));return;
    }
    BG[i]=C(night>.35?WARM:CYAN,1.2+night*4);
    set(i,fract(du*4+z*6)<.05?'/':' ',C(WARM,Math.max(light*.65,night*11)));return;
  }
  set(i,fract(z*37)<.075?'=':fract(wc*8)<.025?'|':' ',C(WARM,light*.5));
}
function drawFernCascade() {
  if(near(px,py,FERN_FALLS.x,191)>vis+12)return;
  for(const sheet of FERN_CASCADE) {
    drawBox({...sheet,x:sheet.x-px,y:sheet.y-py},(i,t,L)=>{
      const worldY=sheet.y+HIT.v,flow=fract(worldY*11-T*2.4+Math.sin(HIT.u*31)*.25);
      BG[i]=C(BLUE,1.5+day*2);
      set(i,flow<.22?'~':flow>.92?':':' ',C(flow<.22?WHITE:CYAN,Math.max(4,L)));return true;
    },rayMansard);
  }
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
    if(model.kind==='shrub'||model.kind==='grass'){drawIslandShrub(model,vx,vy);return;}
    if(model.kind==='lamp') {
      drawBox({...model,x:vx,y:vy},(i,t,L)=>{BG[i]=C(WARM,3+night*6);set(i,'o',C(YEL,10+night*5));return true;});return;
    }
    drawBox({...model,x:vx,y:vy},(i,t,L)=>model.kind==='rock'?islandRockShade(model,i,t,L):islandTimberShade(model,i,t,L),model.planes?rayMansard:rayBox);
  });
  for(const roof of ISLAND_ROOFS)if(inView(roof.x-px,roof.y-py,roof.hl+roof.hw))
    drawBox({...roof,x:roof.x-px,y:roof.y-py},(i,t,L)=>islandRoofShade(roof,i,t,L),rayMansard);
  const [lx,ly]=WILD_ISLANDS[0].landing;
  if(near(px,py,lx,ly)<vis) {
    drawBox(boxAt(lx+1-px,ly+.7-py,1,0,.12,.08,0,.09),solid(BRICK,{top:'='}));
    drawArt(lx+1-px,ly+.7-py,.105,.25,.035,['TACKLE'],()=>C(WARM,12));
  }
  if(near(px,py,540.5,247)<vis) {
    const label=homeAt(SHOP[cityPlaceCell('fern-house')])?'FERN HOUSE':'FOR SALE';
    drawArt(540.5-px,247.55-py,.294,.45,.022,[label],()=>C(GREEN,10));
    if(night>.25)for(let k=0;k<4;k++) {
      const p=fract(T*.14+k*.25),x=541.25+p*.17;
      drawShape(x-px,245.1-py,.76+p*.3,.035+p*.04,.05,(i,u,z,du,dz,L)=>{
        if(hash(Math.floor(u*120),Math.floor(z*120),k)>.3)return false;
        set(i,'.',C(GRAY,3));return true;
      });
    }
  }
  drawFernCascade();
}
