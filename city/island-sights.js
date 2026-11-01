// Native island sights: terrain-fitted models, a few residents, and small wildlife.
// Built once and drawn through the existing spatial buckets and figure caches.
const ISLAND_BIRDS=[];
const ISLAND_FLOWERS=[];
const ISLAND_CIRCLERS=[]; // birds wheeling round Cormorant Rock's stacks: { cx, cy, r, z, w (rad/s), ph, kind, seed }
// One stepped tier of a sea stack: an eight-sided frustum, rb across at its foot and rt at its top, each face a little
// in or out (weathered). The planes are the drawn surface and the collision (landmarkSurfaceHeight) alike
function stackTier(x,y,rb,rt,z0,z1,seed) {
  const k=(rb-rt)/(z1-z0),turn=hash(seed,0,1983)*.8,planes=[[0,0,1,z1],[0,0,-1,-z0]];
  for(let f=0;f<8;f++){const th=f*TAU/8+turn,j=1+(hash(seed,f,1984)-.5)*.12;planes.push([Math.cos(th),Math.sin(th),k,rb*j+k*z0]);}
  const o=islandDetail(x,y,rb*1.1,rb*1.1,z0,z1,'stack');
  Object.assign(o,{planes,seed:hash(seed,1,1985),rb,rt});
  return o;
}
// Cormorant Rock: the stacks, the cormorants' nests crowded on their tops and ledges with birds sitting them, and
// more wheeling round overhead
function buildCormorantRock() {
  ISLAND_CIRCLERS.length=0;
  // a nest (~60 cm across, a heaped rim round a shallow hollow), sat on, or with its owner standing on the rock beside
  // it (outward, so from below it stands up over the edge), or empty
  const nest=(x,y,z,seed,cx,cy)=>{
    const o=islandDetail(x,y,.03,.03,z,z+.016,'nest'),who=hash(seed,1,1988),out=Math.atan2(y-cy,x-cx);
    o.seed=seed;o.profile=[[0,0],[0,.025],[.009,.03],[.015,.028],[.016,.023],[.01,.016],[.006,.01],[.006,0]];
    if(who<.5)ISLAND_BIRDS.push({x,y,z:z+.011,seed:seed*13,kind:'cormorant',nest:true,scaredAt:-99});
    else if(who<.85)ISLAND_BIRDS.push({x:x+Math.cos(out)*.04,y:y+Math.sin(out)*.04,z,seed:seed*13,kind:'cormorant',scaredAt:-99});
  };
  for(const [n,sp] of CORMORANT_SPIRES.entries()) {
    let ground=terrainHeight(sp.x,sp.y);
    for(let k=0;k<8;k++)ground=Math.min(ground,terrainHeight(sp.x+Math.cos(k*TAU/8)*sp.r,sp.y+Math.sin(k*TAU/8)*sp.r));
    const tiers=sp.h>1.2?4:3,top=terrainHeight(sp.x,sp.y)+sp.h;
    let z0=ground-.03,r=sp.r,cx=sp.x,cy=sp.y;
    for(let k=0;k<tiers;k++) {
      const last=k===tiers-1,z1=last?top:z0+(top-z0)/(tiers-k)*(.85+hash(n,k,1981)*.3),rt=r*(last?.62:.8);
      const tier=stackTier(cx,cy,r,rt,z0,z1,n*7+k);
      Object.assign(tier,{spire:n,tier:k,top:last,ground});
      ISLAND_OBSTACLES.push(tier);
      if(last) { // the top: as many nests as fit, round the edge, one in the middle if there's room
        const count=clamp(Math.round(rt/.045),3,7);
        for(let j=0;j<count;j++){const a=j*TAU/count+hash(n,j,1987),q=rt*.6;nest(cx+Math.cos(a)*q,cy+Math.sin(a)*q,z1,n*10+j,cx,cy);}
        if(rt>.25)nest(cx,cy,z1,n*10+9,cx,cy);
        break;
      }
      // the next tier stands back from this one's rim, a little off centre, leaving a ledge to nest on
      const nr=rt*.78,a=hash(n,k,1982)*TAU,off=(rt-nr)*.35,ledge=rt-nr;
      const nx=cx+Math.cos(a)*off,ny=cy+Math.sin(a)*off;
      if(ledge>.065)for(let j=0;j<2;j++) {
        const b=a+Math.PI+(j-.5)*1.3,q=rt*.84,x=cx+Math.cos(b)*q,y=cy+Math.sin(b)*q;
        nest(x,y,landmarkSurfaceHeight(tier,x,y),n*10+5+j,cx,cy);
      }
      cx=nx;cy=ny;z0=z1;r=nr;
    }
  }
  // overhead: three loose rings round the stacks, mostly cormorants, a few gulls, some going the other way
  for(let k=0;k<16;k++) {
    const sp=CORMORANT_SPIRES[k%3],top=terrainHeight(sp.x,sp.y)+sp.h,ring=Math.floor(k/3)%3,r=.6+ring*.5+hash(k,3,1986)*.3;
    ISLAND_CIRCLERS.push({cx:sp.x+(hash(k,1,1986)-.5)*.4,cy:sp.y+(hash(k,2,1986)-.5)*.4,r,z:top+.2+ring*.18+hash(k,4,1986)*.2,
      w:(.55+hash(k,5,1986)*.25)/r*(k%4===3?-1:1),ph:hash(k,6,1986)*TAU,kind:k%5===4?'gull':'cormorant',seed:k});
  }
}
function islandGroundModel(x,y,hl,hw,height,kind,obstacle=false) {
  const samples=[terrainHeight(x,y),terrainHeight(x-hl,y-hw),terrainHeight(x+hl,y-hw),terrainHeight(x-hl,y+hw),terrainHeight(x+hl,y+hw)];
  const o=islandDetail(x,y,hl,hw,Math.min(...samples)-.018,Math.max(...samples)+height,kind);
  if(obstacle)ISLAND_OBSTACLES.push(o);
  return o;
}
function islandWaymark(x,y,word,width=.35) {
  width=Math.min(width*.34,.15);
  const z=terrainHeight(x,y);
  islandDetail(x,y,.006,.006,z-.02,z+.145,'timber');
  const sign=islandDetail(x,y,width,.009,z+.095,z+.15,'sign');
  Object.assign(sign,{word,labelZ:z+.1225,labelH:.025,ink:BLACK});
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
  const fire=GRILLS.find(g=>g.on==='fire'&&near(g.x,g.y,525.5,238)<1);
  if(fire) {
    for(let k=0;k<12;k++){const a=k*TAU/12;islandStone(fire.x+Math.cos(a)*.12,fire.y+Math.sin(a)*.12,.023,hash(k,5,1950));}
    for(const side of [-1,1])islandGroundModel(fire.x+side*.045,fire.y,.07,.014,.025,'driftwood');
    islandWaymark(fire.x+.28,fire.y-.2,'FIRE RING',.36);
  }
  for(const [x,y,word]of [[545.5,230.4,'AIRSTRIP'],[590.3,243.5,'FALLS / LOOKOUT'],[603,250.4,'FERN RIDGE'],[604.5,270.5,'LOOKOUT']])islandWaymark(x,y,word,.42);
  // A survey cairn and a brass telescope give the ridge a recognisable silhouette.
  const [cx,cy]=FERN_LOOKOUT.cairn;
  for(let k=0;k<3;k++) {
    const r=.18-k*.045,z=terrainHeight(cx,cy);
    const stone=islandDetail(cx,cy,r,r,z+k*.085,z+(k+1)*.085,'rock');
    ISLAND_OBSTACLES.push(stone);
    stone.seed=.72;stone.planes=landmarkPlanes(r,r,stone.z0,stone.z1,null).concat([[1,0,1,stone.z1+r*.8],[-1,0,1,stone.z1+r*.8],[0,1,1,stone.z1+r*.8],[0,-1,1,stone.z1+r*.8]]);
  }
  { // the telescope: two legs either side of the tube, the tube along its heading (usable: islands-content.js)
    const {x,y,dir}=FERN_LOOKOUT,z=terrainHeight(x,y),c=Math.cos(dir),s=Math.sin(dir);
    for(const side of [-1,1])islandDetail(x-s*side*.08,y+c*side*.08,.015,.035,z-.02,z+.18,'metal',dir+Math.PI/2);
    Object.assign(islandDetail(x,y,.08,.015,z+.175,z+.205,'metal',dir),{base:YEL});
  }
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
  buildCormorantRock();
  islandWaymark(698,353.9,'BIRD ROOST',.4);
  for(let k=0;k<4;k++) {
    const x=699.1+k*.24,y=353.1+Math.sin(k)*.16;
    islandStone(x,y,.045,.5+k*.1);
    const stone=ISLAND_DETAILS[ISLAND_DETAILS.length-1];
    ISLAND_BIRDS.push({x,y,z:stone.z1+.008,seed:30+k,kind:'cormorant',scaredAt:-99});
  }
  // Crescent Sands: a tide pool rim, driftwood ribs, dune flowers and shore birds.
  islandSkiff(710.3,112.7);
  for(const pool of TIDE_POOL_SITES) {
    const samples=[terrainHeight(pool.x,pool.y)];
    for(let k=0;k<8;k++)samples.push(terrainHeight(pool.x+Math.cos(k*TAU/8)*(pool.r+.07),pool.y+Math.sin(k*TAU/8)*(pool.r+.07)));
    const p=islandDetail(pool.x,pool.y,pool.r+.07,pool.r+.07,Math.min(...samples)-.018,Math.max(...samples)+.055,'tidepool'),r=pool.r;
    p.r=r;p.waterZ=p.z1-.022;p.waterRadius=r-.06;
    p.profile=[[p.z0,0],[p.z0,r+.06],[p.z1-.02,r+.05],[p.z1,r],[p.z1-.01,r-.055],[p.z1-.055,r-.08],[p.z1-.06,0]];
    ISLAND_OBSTACLES.push(p);
    for(let k=0;k<6;k++){const a=k*TAU/6;islandCover(pool.x+Math.cos(a)*(pool.r+.17),pool.y+Math.sin(a)*(pool.r+.17),'rush',k/8,.2);}
  }
  for(let k=0;k<3;k++){const x=720.2+k*.35,y=116.35;ISLAND_BIRDS.push({x,y,z:terrainHeight(x,y)+.008,seed:45+k,kind:'gull',scaredAt:-99});}
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
function drawIslandTidePool(p) {
  const x=p.x-px,y=p.y-py,r=p.r,water=p.waterZ;
  const stone=(i,t,L)=>{const grain=hash(Math.floor(HIT.u*160),Math.floor(HIT.w*160),1951);BG[i]=C(GRAY,2+L*.22*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain*.5);set(i,' ',0);return true;};
  coveLathe(x,y,0,p.profile,stone);
  drum(x,y,p.waterRadius,water-.003,water,(i,t,L)=>{
    const ripple=Math.sin(HIT.u*80+HIT.v*23+T*.8);
    BG[i]=C(BLUE,3);set(i,ripple>.985?'~':' ',C(CYAN,9));
    const u=HIT.u+r*.28,v=HIT.v-r*.2,angle=Math.atan2(v,u),radius=Math.hypot(u,v);
    if(radius<.025+.018*Math.cos(angle*5)){BG[i]=C(ORANGE,5+L*.3);set(i,' ',0);}
    return true;
  });
  // Shells and a crab sit on the actual lip; seaweed rises out of the bowl.
  coveLathe(x+r*.55,y-r*.65,p.z1-.017,[[0,0],[0,.035],[.014,.028],[.024,.008],[.024,0]],homeStone);
  for(let k=0;k<3;k++)coveTube(x-r*.48+k*.018,y-r*.1,water-.035,x-r*.48+k*.018+.01*Math.sin(T+k),y-r*.1,water+.015,.004,GREEN);
  const cx=x+r*.72,cy=y+r*.47,z=p.z1-.008;
  drawBox(boxAt(cx,cy,1,0,.025,.02,z,z+.025),(i,t,L)=>{BG[i]=C(BRICK,4+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;},homeRayEllipsoid);
  for(const side of [-1,1])for(let k=0;k<3;k++)coveTube(cx+side*.015,cy+(k-1)*.013,z+.008,cx+side*.045,cy+(k-1)*.025,z,.003,BRICK);
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
// life size, beside people and pigeons: a herring gull ~60 cm nose to tail, a cormorant ~80 cm (the body is ~10.5 units long)
const ISLAND_BIRD_SIZE={gull:.15,cormorant:.2},ISLAND_BIRD_SPAN={gull:.13,cormorant:.14},ISLAND_BIRD_TALL={gull:.035,cormorant:.055};
// A figure covering less than about half a cell isn't drawn (people far off don't flicker), so past a few dozen metres
// a bird would vanish. Then it's painted as a few solid cells at its true place and size: a body and wings that rise
// and fall with the wingbeat (frame 1 up, 2 down, else held level) or, perched, a short dark upright. Returns false
// when it's near enough to draw properly (true when it's done: painted, or too far off to see)
function drawBirdSpeck(vx,vy,z,kind,flying,frame) {
  const depth=dx*vx+dy*vy;if(depth<.05||depth>vis)return true;
  const sc=projX/depth,span=(flying?ISLAND_BIRD_SPAN[kind]:.04)*sc,tall=(flying?.02:ISLAND_BIRD_TALL[kind])*projY/depth;
  if(span>6||tall>3)return false;
  if(flying?span<.35:tall<.35)return true; // (too far off to see at all)
  const c=Math.floor(cols/2+(-dy*vx+dx*vy)*sc),r=Math.floor(hor-(z+(flying?0:ISLAND_BIRD_TALL[kind]/2)-eye)*projY/depth);
  const fade=Math.max(0,1-depth/vis),col=kind==='gull'?C(WHITE,4+9*fade*amb):C(GRAY,.6+fade*.8);
  const paint=(cc,rr)=>{if(cc<0||cc>=cols||rr<0||rr>=rows)return;const i=rr*cols+cc;if(ZB[i]<=depth)return;BG[i]=col;set(i,' ',0);ZB[i]=depth;FL[i]=0;};
  if(!flying){for(let k=0;k<Math.max(1,Math.round(tall));k++)paint(c,r-k);return true;}
  const half=Math.round(span/2),lift=frame===1?-1:frame===2?1:0; // (under a cell and a half across: just the one cell)
  paint(c,r);for(let k=1;k<=half;k++){paint(c-k,r+(k===half?lift:0));paint(c+k,r+(k===half?lift:0));}
  return true;
}
const ISLAND_GULL_LOOK=animalLook('islandbird',{body:[WHITE,14],wing:[GRAY,10],mark:[GRAY,2],beak:[YEL,13]});
// A great cormorant: black with a bronze sheen on the wings, a long hooked grey bill, a yellow throat patch, a
// slim neck, a stiff wedge tail and short legs on big webbed feet. Frames: 0 standing upright, 1 wings up and 2
// wings down in flight (neck straight out), 3 standing with its wings hung out to dry, 4 sitting a nest, 5 gliding
ANIMAL_BODIES.cormorant=frame=>{
  const R=AR,parts=[],fly=frame===1||frame===2||frame===5,sit=frame===4;
  let head;
  if(fly) {
    head=[0,5.8,4.7];
    parts.push(figEll([0,0,4],AN_I,[1.4,3.4,1.3],()=>R.BODY),figCap([0,2.6,4.3],[0,5.2,4.6],.5,()=>R.BODY),
      figCap([0,-2.6,4],[0,-5.4,3.9],.55,()=>R.BODY),figEll(head,AN_I,[.7,1,.7],()=>R.HEAD),
      figCap([0,6.6,4.7],[0,8.4,4.5],.2,()=>R.BEAK),figCap([0,8.4,4.5],[0,8.55,4.25],.18,()=>R.BEAK),figEll([0,6.4,4.35],AN_I,[.35,.45,.3],()=>R.PALE));
    for(const side of [-1,1]) {
      const elbow=frame===1?[side*5,0,7]:frame===2?[side*5,0,3]:[side*5,0,4.6],tip=frame===1?[side*9.5,-.6,7.6]:frame===2?[side*9,-.6,1.4]:[side*9.8,-.8,4.4];
      parts.push(figCap([side*1.2,.3,4.4],elbow,.75,()=>R.WING),figCap(elbow,tip,.55,()=>R.MARK));
    }
  } else if(sit) {
    head=[0,3,6];
    parts.push(figEll([0,0,2.2],AN_I,[1.8,3.2,1.6],()=>R.BODY),figCap([0,2.2,3],[0,2.7,5.5],.55,()=>R.BODY),
      figCap([0,-2.8,2.4],[0,-4.6,2],.5,()=>R.BODY),figEll(head,AN_I,[.75,1.05,.75],()=>R.HEAD),
      figCap([0,3.9,6],[0,5.6,5.8],.21,()=>R.BEAK),figCap([0,5.6,5.8],[0,5.75,5.55],.18,()=>R.BEAK),figEll([0,3.5,5.6],AN_I,[.4,.5,.38],()=>R.PALE));
    for(const side of [-1,1])parts.push(figEll([side*1.2,-.5,2.8],AN_I,[.6,2.6,1],()=>R.WING));
  } else {
    head=[0,3.1,5.7]; // (stood hunched at forty-five degrees, its tail propped out behind)
    parts.push(figCap([0,-1.2,2.6],[0,1.4,4],1.6,()=>R.BODY),figCap([0,-2.2,2.4],[0,-4.6,1.2],.5,()=>R.BODY),
      figCap([0,1.8,4.2],[0,2.6,5.4],.5,()=>R.BODY),figEll(head,AN_I,[.7,1,.7],()=>R.HEAD),
      figCap([0,4,5.7],[0,5.8,5.5],.2,()=>R.BEAK),figCap([0,5.8,5.5],[0,5.95,5.25],.18,()=>R.BEAK),figEll([0,3.6,5.3],AN_I,[.42,.48,.36],()=>R.PALE));
    for(const side of [-1,1]) {
      parts.push(figCap([side*.7,0,1.2],[side*.7,.3,.2],.35,()=>R.LEG),figEll([side*.7,.8,.15],AN_I,[.55,.85,.15],()=>R.LEG));
      if(frame===3)parts.push(figCap([side*1.3,0,4.2],[side*4.5,-.3,5.2],.8,()=>R.WING),figCap([side*4.5,-.3,5.2],[side*7.5,-.6,3.8],.6,()=>R.WING),figCap([side*7.5,-.6,3.8],[side*8,-.8,2.2],.4,()=>R.MARK));
      else parts.push(figEll([side*1.3,-.6,3.2],AN_I,[.6,2.4,1.4],()=>R.WING));
    }
  }
  return {parts,decals:animalEyes(head,.75,1)};
};
const ISLAND_CORMORANT_LOOK=animalLook('cormorant',{body:[GRAY,2],head:[GRAY,2],wing:[BRICK,3],mark:[GRAY,1],beak:[GRAY,5],pale:[YEL,9],leg:[GRAY,1],eye:[GREEN,11]});
function islandBirdPose(b,time=T) {
  const cycle=mod(time+b.seed*.13,54),scare=time-b.scaredAt;
  const flight=scare>=0&&scare<7?scare/7:cycle>43?(cycle-43)/11:0;
  const lift=Math.sin(flight*Math.PI);
  return {x:b.x+lift*Math.sin(flight*TAU)*1.2,y:b.y+lift*Math.cos(flight*TAU)*.7,z:b.z+lift*.55,
    frame:flight?1+(Math.floor(time*5+b.seed)&1):b.nest?4:b.kind==='cormorant'&&Math.sin(time*.2+b.seed)>.2?3:0};
}
function drawIslandLife() {
  if(!worldReady||px<465)return;
  for(const bird of ISLAND_BIRDS) {
    if(near(px,py,bird.x,bird.y)>18)continue;
    if(!freecam&&!paused&&near(px,py,bird.x,bird.y)<.65&&T-bird.scaredAt>12)bird.scaredAt=T;
    const p=islandBirdPose(bird),vx=p.x-px,vy=p.y-py;
    if(!inView(vx,vy,.12))continue;
    if(drawBirdSpeck(vx,vy,p.z,bird.kind,p.frame===1||p.frame===2,p.frame))continue;
    drawAnimal(vx,vy,p.z,ISLAND_BIRD_SIZE[bird.kind]??.15,Math.cos(bird.seed),Math.sin(bird.seed),bird.kind==='gull'?ISLAND_GULL_LOOK:ISLAND_CORMORANT_LOOK,p.frame);
  }
  for(const c of ISLAND_CIRCLERS) { // wheeling round the stacks: flapping a while, then gliding
    const th=c.ph+T*c.w,x=c.cx+Math.cos(th)*c.r,y=c.cy+Math.sin(th)*c.r*.8,z=c.z+Math.sin(T*.4+c.seed)*.15,vx=x-px,vy=y-py;
    if(Math.hypot(vx,vy)>vis||!inView(vx,vy,.12))continue;
    const glide=c.kind==='cormorant'&&fract(T*.12+c.seed*.37)>.55,frame=glide?5:1+(Math.floor(T*(c.kind==='gull'?3:5)+c.seed)&1);
    if(drawBirdSpeck(vx,vy,z,c.kind,true,frame))continue;
    drawAnimal(vx,vy,z,ISLAND_BIRD_SIZE[c.kind],-Math.sin(th)*Math.sign(c.w),Math.cos(th)*.8*Math.sign(c.w),c.kind==='gull'?ISLAND_GULL_LOOK:ISLAND_CORMORANT_LOOK,frame);
  }
  if(rain>.2||season()==='winter')return;
  let drawn=0;
  for(const flower of ISLAND_FLOWERS) {
    if(drawn>=8)break;
    if(near(px,py,flower.x,flower.y)>7)continue;
    const phase=T*.6+flower.seed*TAU,x=flower.x+Math.sin(phase)*.12,y=flower.y+Math.cos(phase*.7)*.1,z=terrainHeight(x,y)+.13+Math.sin(phase*2)*.025;
    if(!inView(x-px,y-py,.02))continue;
    // by night a firefly's glow; by day a butterfly (~8 cm across), wings beating, facing the way it's going
    if(night>.5)drawArt(x-px,y-py,z,.016,.014,['.'],()=>C(YEL,12));
    else drawAnimal(x-px,y-py,z,.026,Math.cos(phase)*.12,-Math.sin(phase*.7)*.07,BUTTERFLY_LOOKS[Math.floor(flower.seed*5)%5],Math.sin(T*12+flower.seed)>0?0:1);
    drawn++;
  }
}
