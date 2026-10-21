// Native chart coordinates: these islands never pass through the legacy city transform.
const WILD_ISLANDS = [
  { id: 'fern', name: 'Fern Island', x: 586, y: 220, rx: 66, ry: 76, hill: 2.8, phase: .7,
    dock: [510, 235, 522, 236], landing: [521.5, 235.5], note: 'Rough airstrip, waterfall, woodland trails and a house for sale. Boat or light aircraft access.' },
  { id: 'cabin', name: 'Cabin Cove', x: 490, y: 393, rx: 15, ry: 18, hill: .65, phase: 1.8,
    dock: [472, 395, 479, 396], landing: [478.5, 395.5], note: 'An unlocked fishing shelter with benches and a visitors\' log, beside a quiet fishing jetty. Boat access.' },
  { id: 'rock', name: 'Cormorant Rock', x: 697, y: 352, rx: 10, ry: 14, hill: .9, phase: 2.6,
    dock: [684, 354, 690, 355], landing: [689.5, 354.5], note: 'A rocky fishing outcrop with a low landing on its west side. Boat access.' },
  { id: 'sand', name: 'Crescent Sands', x: 719, y: 109, rx: 23, ry: 11, hill: .18, phase: .2,
    dock: [691, 110, 700, 111], landing: [699.5, 110.5], note: 'Pale sand, driftwood and shallow dunes. Boat access.' },
  { id: 'wood', name: 'Juniper Isle', x: 789, y: 244, rx: 18, ry: 23, hill: .8, phase: 3.1,
    dock: [767, 247, 776, 248], landing: [775.5, 247.5], note: 'A private house among the trees. You can knock, but nobody seems to be home. Boat access.' },
];
const FERN_STRIP = { x0: 551, x1: 617, y: 220, hw: 1.3 };
const FERN_HOUSE = { x0: 539, y0: 244, x1: 542, y1: 247, door: [540.5, 247.2], terrace: [537.8, 245.5] };
const ISLAND_CABINS = [
  {...FERN_HOUSE, id:'fern-house', name:'Fern House', h:.38, pitch:.22, wood:BRICK, roof:GRAY},
  {id:'cabin-cove',name:'Cabin Cove fishing shelter',door:[492,392.2],room:'islandshelter',x0:491,y0:390,x1:493,y1:392,h:.29,pitch:.17,wood:BRICK,roof:GREEN},
  {id:'juniper-house',name:'Juniper House',door:[791,241.2],x0:790,y0:239,x1:792,y1:241,h:.3,pitch:.18,wood:STONE,roof:BRICK},
];
const ISLAND_ROOFS=[];
const FERN_FALLS={x:627,y0:186,y1:200,poolY:196.5};
const FERN_TRAILS = [
  [[521.5,235.5],[536,238],[536,248],[540.5,248],[540.5,247.2]],
  [[536,238],[545,230],[551,224],[555,222]],
  [[545,230],[565,240],[590,243],[615,236],[628,215],[627,197]],
];
const WILD_FIELDS=new Map();
let fernTrailField=null;
function wildFieldSample(field,x,y) {
  const fx=(x-field.x0)*2,fy=(y-field.y0)*2,gx=Math.floor(fx),gy=Math.floor(fy);
  if(gx<0||gy<0||gx+1>=field.w||gy+1>=field.h)return null;
  const u=fx-gx,v=fy-gy,k=gy*field.w+gx,a=field.values;
  return (a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+field.w]*(1-u)+a[k+field.w+1]*u)*v;
}
function wildIslandEdge(x,y,island) {
  const field=WILD_FIELDS.get(island.id);
  if(field)return wildFieldSample(field,x,y)??-1000;
  return wildAnalyticEdge(x,y,island);
}
function wildAnalyticEdge(x, y, island) {
  const ex = (x-island.x)/island.rx, ey = (y-island.y)/island.ry;
  if (Math.abs(ex)>1.3 || Math.abs(ey)>1.3) return -1000;
  const angle = Math.atan2(ey,ex);
  const radius = 1 + .075*Math.sin(angle*3+island.phase) + .045*Math.sin(angle*5-island.phase);
  const edge=(radius-Math.hypot(ex,ey))*Math.min(island.rx,island.ry);
  if(island.id==='sand') {
    const cove=Math.hypot((x-island.x-island.rx*.55)*.7,y-island.y)-island.ry*.78;
    return Math.min(edge,cove);
  }
  return edge;
}
function wildIslandAt(x, y, margin = 0) {
  if (!worldReady || x < 465) return null;
  return WILD_ISLANDS.find(island => wildIslandEdge(x,y,island)>-margin) || null;
}
function onFernStrip(x,y,margin=0) {
  return worldReady && x>=FERN_STRIP.x0-margin && x<=FERN_STRIP.x1+margin && Math.abs(y-FERN_STRIP.y)<=FERN_STRIP.hw+margin;
}
function trailDistance(x,y) {
  if(fernTrailField){const cached=wildFieldSample(fernTrailField,x,y);if(cached!==null)return cached;}
  return fernTrailDistance(x,y);
}
function fernTrailDistance(x,y) {
  let distance = Infinity;
  for (const trail of FERN_TRAILS) for (let k=1;k<trail.length;k++) {
    const [ax,ay]=trail[k-1],[bx,by]=trail[k],ux=bx-ax,uy=by-ay;
    const t=clamp(((x-ax)*ux+(y-ay)*uy)/(ux*ux+uy*uy),0,1);
    distance=Math.min(distance,Math.hypot(x-ax-ux*t,y-ay-uy*t));
  }
  return distance;
}
function buildWildIslandFields() {
  function field(island,sample) {
    const x0=Math.floor(island.x-island.rx*1.3)-2,y0=Math.floor(island.y-island.ry*1.3)-2;
    const w=(Math.ceil(island.x+island.rx*1.3)+2-x0)*2+1,h=(Math.ceil(island.y+island.ry*1.3)+2-y0)*2+1;
    const values=new Float32Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)values[y*w+x]=sample(x0+x/2,y0+y/2);
    return {x0,y0,w,h,values};
  }
  for(const island of WILD_ISLANDS)WILD_FIELDS.set(island.id,field(island,(x,y)=>wildAnalyticEdge(x,y,island)));
  fernTrailField=field(WILD_ISLANDS[0],fernTrailDistance);
}
function wildGroundHeight(x,y,island) {
  const edge=wildIslandEdge(x,y,island);
  if(edge<=.5)return 0;
  const beach=terrainEase((edge-.5)/6);
  let height=island.hill*beach*(.65+.35*Math.sin((x-island.x)*.045+(y-island.y)*.028+1));
  // Broad low landing pads and trails keep every island explorable on foot.
  const [lx,ly]=island.landing;
  height*=terrainEase((Math.hypot(x-lx,y-ly)-3)/9);
  if(island.id==='fern') {
    const runwayDistance=Math.hypot(Math.max(0,FERN_STRIP.x0-20-x,x-FERN_STRIP.x1-20),Math.max(0,Math.abs(y-FERN_STRIP.y)-FERN_STRIP.hw-1.5));
    height*=terrainEase(runwayDistance/8);
    const houseDistance=Math.hypot(Math.max(0,FERN_HOUSE.x0-2-x,x-FERN_HOUSE.x1-3),Math.max(0,FERN_HOUSE.y0-2-y,y-FERN_HOUSE.y1-2));
    height*=terrainEase(houseDistance/7);
    height=Math.min(height,.12+trailDistance(x,y)*.11);
    // A shallow, level collecting pool; the trail approaches along its west bank.
    const pool=Math.hypot((x-FERN_FALLS.x)/.9,(y-FERN_FALLS.poolY)/1.35);
    if(pool<1.5)height=.12+(height-.12)*terrainEase((pool-1)/.5);
  }
  return height;
}
function islandRoofHeight(x,y) {
  if(!worldReady||x<465)return 0;
  let top=0;
  for(const roof of ISLAND_ROOFS)top=Math.max(top,landmarkSurfaceHeight(roof,x,y));
  return top;
}
function fernCreekDistance(x,y) {
  if(y<FERN_FALLS.y0||y>FERN_FALLS.y1||Math.abs(x-FERN_FALLS.x)>1.5)return 10;
  const center=FERN_FALLS.x+Math.sin((y-FERN_FALLS.y0)*.6)*.15;
  const stream=Math.abs(x-center)-(.14+.045*Math.sin(y*3.3));
  const pool=(Math.hypot((x-FERN_FALLS.x)/.72,(y-FERN_FALLS.poolY)/1.12)-1)*.72;
  return Math.min(stream,pool);
}
// Shared world-anchored texture: floor triangles and level ground use the same marks.
function islandSurface(x,y) {
  const island=wildIslandAt(x,y);
  if(!island)return null;
  const grain=hash(Math.floor(x*21),Math.floor(y*21),1875);
  const patch=noise(x*.3,y*.3,1876),edge=wildIslandEdge(x,y,island);
  if(island.id==='fern') {
    const creek=fernCreekDistance(x,y);
    if(creek<0)return {base:CYAN,background:BLUE,ch:fract(y*5-T*1.8+grain*.4)<.14?'~':' ',color:'#528b9f',tone:1.1,water:true};
    if(creek<.16+patch*.12)return {base:GRAY,background:GREEN,ch:grain>.97?'.':' ',color:'#64715d',tone:1};
    if(onFernStrip(x,y)) {
      let ch=grain>.85?':':' ';
      if(Math.abs(y-FERN_STRIP.y)<.04&&fract(x*.5)<.45)ch='=';
      return {base:WARM,background:BRICK,ch,color:'#8c805c',tone:1};
    }
    if(trailDistance(x,y)<.08+patch*.07)return {base:WARM,background:BRICK,ch:grain>.86?':':'.',color:'#8c805c',tone:.9};
  }
  if(island.id==='rock') {
    let ch=grain>.75?':':' ';
    if(grain>.9)ch='o';
    return {base:GRAY,background:GRAY,ch,color:'#727777',tone:.8+patch*.3};
  }
  return islandShoreSurface(x,y,edge,true,island.id==='sand',grain,patch);
}
function islandShoreSurface(x,y,edge,beach,allSand=false,grain=hash(Math.floor(x*21),Math.floor(y*21),1875),patch=noise(x*.3,y*.3,1876)) {
  if(!beach&&edge<1.2+patch*.6)return {base:GRAY,background:GRAY,ch:grain>.93?':':' ',color:'#727777',tone:.9};
  if(edge<.4+patch*.2)return {base:WARM,background:BRICK,ch:grain>.92?':':' ',color:'#827858',tone:.8};
  if(beach&&(edge<2.3+patch*1.2||allSand)) {
    const grass=edge>1.6&&grain>.91&&patch>.55;
    let ch=grain>.93?'.':' ';
    if(grass)ch='\'';
    return {base:grass?GREEN:YEL,background:STONE,ch,color:'#b3a16c',tone:.8+patch*.18,lift:3.8};
  }
  const scrub=edge<4.5&&patch>.45;
  let ch=grain>.84?',':' ';
  if(grain>.94)ch='\'';
  return {base:GREEN,background:scrub?WARM:GREEN,ch,color:'#2a5a30',tone:1+patch*.12};
}
