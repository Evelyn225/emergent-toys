// Native island sights: terrain-fitted models, a few residents, and small wildlife.
// Built once and drawn through the existing spatial buckets and figure caches.
const ISLAND_BIRDS=[];
const ISLAND_FLOWERS=[];
function islandGroundModel(x,y,hl,hw,height,kind,obstacle=false) {
  const samples=[terrainHeight(x,y),terrainHeight(x-hl,y-hw),terrainHeight(x+hl,y-hw),terrainHeight(x-hl,y+hw),terrainHeight(x+hl,y+hw)];
  const o=islandDetail(x,y,hl,hw,Math.min(...samples)-.018,Math.max(...samples)+height,kind);
  if(obstacle)ISLAND_OBSTACLES.push(o);
  return o;
}
function islandWaymark(x,y,word,width=.35) {
  width=Math.min(width*.45,.2);
  const z=terrainHeight(x,y);
  islandDetail(x,y,.007,.007,z-.02,z+.18,'timber');
  const sign=islandDetail(x,y,width,.012,z+.105,z+.18,'sign');
  Object.assign(sign,{word,labelZ:z+.1425,labelH:.025});
}
function islandCover(x,y,kind,seed,size=.15) {
  if(seaAt(x,y)||onPier(x,y)||map[idx(x,y)]||onFernStrip(x,y,4))return;
  if(ISLAND_CABINS.some(c=>x>c.x0-.2&&x<c.x1+.2&&y>c.y0-.2&&y<c.y1+.4))return;
  size*=.45;
  const z=terrainHeight(x,y),o=islandDetail(x,y,size,size,z,z+(kind==='flower'?.08:kind==='fern'?.065:.09),'cover');
  o.cover=kind;o.seed=seed;
  if(kind==='flower')ISLAND_FLOWERS.push(o);
}
function buildIslandSights() {
  ISLAND_BIRDS.length=ISLAND_FLOWERS.length=0;
  for(const island of WILD_ISLANDS) {
    const paths=island.id==='fern'?FERN_TRAILS:ISLAND_PATHS[island.id];
    for(const path of paths)for(let k=1;k<path.length;k++) {
      const [ax,ay]=path[k-1],[bx,by]=path[k],length=near(ax,ay,bx,by),ux=(bx-ax)/length,uy=(by-ay)/length;
      for(let d=1;d<length;d+=2.6)for(const side of [-1,1]) {
        const seed=hash(ax+d,ay+side,1940),off=.35+seed*.45;
        const x=ax+ux*d-uy*off*side,y=ay+uy*d+ux*off*side;
        islandCover(x,y,island.id==='rock'?'lichen':island.id==='sand'?'rush':seed>.52?'flower':'fern',seed,.13+seed*.1);
      }
    }
    // Resting birds at each landing, clear of the boarding lane. The roost has
    // dark cormorants instead of gulls; flight starts and ends at the same perch.
    for(let k=0;k<3;k++) {
      const x=island.landing[0]+1.1+k*.36,y=island.landing[1]-1.1-k*.2;
      if(!seaAt(x,y))ISLAND_BIRDS.push({x,y,z:terrainHeight(x,y)+.008,seed:k+island.x,kind:island.id==='rock'?'cormorant':'gull',scaredAt:-99});
    }
  }
  // Fern: a small camp beside the existing fire, with rolled mats and a real
  // pitched canvas tent. Foundations and obstacles use the same model geometry.
  const tent=islandGroundModel(528.6,239.2,.43,.32,.27,'canvas',true);
  tent.base=ORANGE;tent.planes=landmarkPlanes(tent.hl,tent.hw,tent.z0,tent.z1,'gable');
  for(const [x,y]of [[527.7,239.2],[526,238.7]])islandGroundModel(x,y,.27,.045,.06,'driftwood');
  const pack=islandGroundModel(528,238.9,.06,.05,.1,'canvas');pack.base=GREEN;
  islandWaymark(527.8,237.85,'WOODLAND CAMP',.45);
  islandWaymark(523.6,236.1,'HOUSE / FALLS',.45);
  for(const [x,y,word]of [[545.5,230.4,'AIRSTRIP'],[590.3,243.5,'FALLS / LOOKOUT'],[603,250.4,'FERN RIDGE']])islandWaymark(x,y,word,.42);
  // A survey cairn and a brass telescope give the ridge a recognisable silhouette.
  for(let k=0;k<3;k++) {
    const r=.18-k*.045,z=terrainHeight(604.1,250.1);
    const stone=islandDetail(604.1,250.1,r,r,z+k*.085,z+(k+1)*.085,'rock');
    ISLAND_OBSTACLES.push(stone);
    stone.seed=.72;stone.planes=landmarkPlanes(r,r,stone.z0,stone.z1,null).concat([[1,0,1,stone.z1+r*.8],[-1,0,1,stone.z1+r*.8],[0,1,1,stone.z1+r*.8],[0,-1,1,stone.z1+r*.8]]);
  }
  const z=terrainHeight(603.8,249.5);
  for(const x of [603.72,603.88])islandDetail(x,249.5,.015,.035,z-.02,z+.18,'metal');
  Object.assign(islandDetail(603.8,249.5,.08,.015,z+.175,z+.205,'metal',Math.PI/2),{base:YEL});
  for(const [x,y]of [[626.3,194.8],[627.9,195.7],[626.1,197.2]])islandCover(x,y,'fern',hash(x,y,1941),.27);
  // Cabin Cove: repaired nets and floats, a fish box, and a little hauled-up skiff.
  for(const x of [488.55,489.65])islandGroundModel(x,395.15,.025,.025,.3,'timber');
  const net=islandGroundModel(489.1,395.15,.55,.01,.27,'net');net.z0=net.z1-.22;
  for(const x of [488.7,489,489.3,489.6]) {
    const z=terrainHeight(x,395.15);
    Object.assign(islandDetail(x,395.15,.025,.025,z+.25,z+.29,'canvas'),{base:WARM});
  }
  islandGroundModel(489.9,395.3,.12,.08,.075,'timber');
  islandSkiff(481,397.2);
  // Cormorant Rock: two solid, faceted sea stacks with bird perches.
  for(const [x,y,hl,hw,height]of [[700.6,350.6,.62,.5,.95],[702.1,352.5,.45,.5,1.25]]) {
    const rock=islandGroundModel(x,y,hl,hw,height,'rock',true);
    rock.seed=.8;rock.stack=true;
    const sx=.4/hl,sy=.35/hw;
    rock.planes=landmarkPlanes(hl,hw,rock.z0,rock.z1,null).concat([
      [1,1,0,hl+hw-.15],[-1,-1,0,hl+hw-.12],
      [sx,0,1,rock.z1+sx*hl*.3],[-sx,0,1,rock.z1+sx*hl*.25],
      [0,sy,1,rock.z1+sy*hw*.45],[0,-sy,1,rock.z1+sy*hw*.3],
    ]);
    ISLAND_BIRDS.push({x,y,z:rock.z1+.008,seed:x,kind:'cormorant',scaredAt:-99});
  }
  islandWaymark(698,353.9,'BIRD ROOST',.4);
  // Crescent Sands: a tide pool rim, driftwood ribs, dune flowers and shore birds.
  islandSkiff(710.3,112.7);
  for(let k=0;k<8;k++) {
    const angle=k*TAU/8,x=720+Math.cos(angle)*.86,y=115.4+Math.sin(angle)*.6;
    islandStone(x,y,.055+hash(k,1,1942)*.04,hash(k,2,1942));
    if(k%2===0)islandCover(x+.15,y+.2,'rush',k/8,.2);
  }
  islandWaymark(719,115.35,'TIDE POOLS',.38);
  // Juniper: a modest sheltered garden, washing on the line and sea-facing trees.
  for(const y of [241.7,242.5])for(let x=785;x<787.2;x+=.35)islandCover(x,y,'flower',hash(x,y,1943),.13);
  for(const x of [785,787.3])islandGroundModel(x,240.6,.025,.025,.3,'timber');
  const line=islandGroundModel(786.15,240.6,1.15,.006,.29,'metal');line.z0=line.z1-.008;
  for(let k=0;k<4;k++) {
    const cloth=islandGroundModel(785.4+k*.48,240.6,.12,.008,.28,'cloth');
    cloth.z0=cloth.z1-.15;cloth.seed=k;cloth.base=[WHITE,CYAN,STONE,BLUE][k];
  }
  islandWaymark(787,243.85,'SEA GARDEN',.38);
}
function islandSkiff(x,y) {
  const z=terrainHeight(x,y);
  for(const side of [-1,1])for(let k=0;k<5;k++) {
    const u=(k-2)*.13,width=.12*Math.sqrt(Math.max(0,1-(u/.34)**2));
    islandDetail(x+u,y+side*width,.075,.014,z-.015,z+.07,'driftwood');
  }
  for(const u of [-.2,0,.2])islandDetail(x+u,y,.015,.11,z+.025,z+.045,'timber');
}
function islandCoverShade(model,i,u,z,L) {
  const h=model.z1-model.z0,n=u/model.hl;
  if(Math.abs(n)>1||z<0||z>h)return false;
  if(model.cover==='lichen') {
    if(z>h*.18||n*n+((z-h*.08)/(h*.1))**2>1)return false;
    BG[i]=C(GRAY,2+L*.2);set(i,':',C(YEL,L*.8));return true;
  }
  const stem=Math.abs(n-Math.sin(T*.9+model.seed*8)*.045*z/h)<.06;
  if(model.cover==='flower') {
    const centre=clamp(Math.round(n/.55),-1,1)*.55,head=.7+.1*Math.sin(centre*7+model.seed*9);
    const stalk=Math.abs(n-centre)<.035&&z/h<head;
    const petal=((n-centre)/.13)**2+((z/h-head)/.1)**2<1;
    if(!petal&&!stalk)return false;
    const color=petal?([MAG,YEL,WHITE][Math.floor(model.seed*3)%3]):GREEN;
    BG[i]=C(color,petal?3+L*.35:1+L*.18);set(i,petal?'*':'|',C(color,L*1.1));return true;
  }
  if(model.cover==='rush') {
    if(!stem&&Math.abs(Math.sin(n*14+z*11))<.91)return false;
    set(i,z>h*.8?'\'':'|',C(YEL,L*.85));return true;
  }
  const leaf=Math.abs(n)<(1-z/h)*.9&&Math.sin(z/h*22+Math.abs(n)*8)>.1&&hash(Math.floor(n*15),Math.floor(z/h*18),Math.floor(model.seed*1000))>.2;
  if(!stem&&!leaf)return false;
  BG[i]=C(GREEN,1.4+L*.18);set(i,stem?'|':n<0?'/':'\\',C(GREEN,L*.8));return true;
}
function islandFabricShade(model,i,t,L) {
  if(model.kind==='net') {
    if(fract((HIT.u+model.hl)*25)>.1&&fract(HIT.w*35)>.1)return false;
    set(i,'#',C(GREEN,L*.8+2));return true;
  }
  const base=model.base??STONE;
  BG[i]=C(base,2+L*.3);
  set(i,model.kind==='cloth'&&fract(HIT.u*30)<.08?'|':HIT.w<model.z0+.02?'_':' ',C(base,L));return true;
}
// A small cached seabird body: folded wings on a perch, raised/lowered wings in flight.
ANIMAL_BODIES.islandbird=frame=>{
  const R=AR,parts=[figEll([0,0,3.5],AN_I,[2.2,4,2],()=>R.BODY),figEll([0,3.4,5],AN_I,[1.5,1.7,1.5],()=>R.HEAD),figCap([0,4.6,4.8],[0,6.5,4.5],.5,()=>R.BEAK)];
  for(const side of [-1,1]) {
    if(frame===0)parts.push(figEll([side*1.6,-.5,4],AN_I,[.9,3.3,1.1],()=>R.WING),figCap([side*.8,0,2],[side*.8,.7,.2],.3,()=>R.LEG));
    else {
      const wingZ=frame===3?4:frame===1?7:1.5,tipZ=frame===3?4:frame===1?6:2;
      parts.push(figCap([side*1.5,0,4],[side*7,-1,wingZ],.65,()=>R.WING),figCap([side*7,-1,wingZ],[side*10,-2,tipZ],.35,()=>R.MARK));
      if(frame===3)parts.push(figCap([side*.8,0,2],[side*.8,.7,.2],.3,()=>R.LEG));
    }
  }
  return {parts,decals:animalEyes([0,3.4,5],1.5,1)};
};
const ISLAND_GULL_LOOK=animalLook('islandbird',{body:[WHITE,14],wing:[GRAY,10],mark:[GRAY,2],beak:[YEL,13]});
const ISLAND_CORMORANT_LOOK=animalLook('islandbird',{body:[GRAY,3],wing:[GRAY,2],mark:[GRAY,1],beak:[WARM,10]});
function islandBirdPose(b,time=T) {
  const cycle=mod(time+b.seed*.13,54),scare=time-b.scaredAt;
  const flight=scare>=0&&scare<7?scare/7:cycle>43?(cycle-43)/11:0;
  const lift=Math.sin(flight*Math.PI);
  return {x:b.x+lift*Math.sin(flight*TAU)*1.2,y:b.y+lift*Math.cos(flight*TAU)*.7,z:b.z+lift*.55,
    frame:flight?1+(Math.floor(time*5+b.seed)&1):b.kind==='cormorant'&&Math.sin(time*.2+b.seed)>.2?3:0};
}
function drawIslandLife() {
  if(!worldReady||px<465)return;
  for(const bird of ISLAND_BIRDS) {
    if(near(px,py,bird.x,bird.y)>18)continue;
    if(!freecam&&!paused&&near(px,py,bird.x,bird.y)<.65&&T-bird.scaredAt>12)bird.scaredAt=T;
    const p=islandBirdPose(bird),vx=p.x-px,vy=p.y-py;
    if(!inView(vx,vy,.12))continue;
    drawAnimal(vx,vy,p.z,.055,Math.cos(bird.seed),Math.sin(bird.seed),bird.kind==='gull'?ISLAND_GULL_LOOK:ISLAND_CORMORANT_LOOK,p.frame);
  }
  if(rain>.2||season()==='winter')return;
  let drawn=0;
  for(const flower of ISLAND_FLOWERS) {
    if(drawn>=8)break;
    if(near(px,py,flower.x,flower.y)>7)continue;
    const phase=T*.6+flower.seed*TAU,x=flower.x+Math.sin(phase)*.12,y=flower.y+Math.cos(phase*.7)*.1,z=terrainHeight(x,y)+.13+Math.sin(phase*2)*.025;
    if(!inView(x-px,y-py,.02))continue;
    drawArt(x-px,y-py,z,.016,.014,[night>.5?'.':Math.sin(T*12+flower.seed)>0?'v':'^'],()=>C(night>.5?YEL:MAG,night>.5?12:10));drawn++;
  }
}
