// Map topology lives here so the map and walking routes can later use a bounded world.
const MAP_WORLD = {width:N,height:N,wrap:true};
function mapCoordinate(value,size,world=MAP_WORLD) {return world.wrap?mod(value,size):clamp(value,0,size-.001);}
function mapDifference(value,size,world=MAP_WORLD) {return world.wrap?mod(value+size/2,size)-size/2:value;}
function mapDistance(a,b,world=MAP_WORLD) {
  return Math.hypot(mapDifference(b.x-a.x,world.width,world),mapDifference(b.y-a.y,world.height,world));
}
function findMapRoute(start,goal,world=MAP_WORLD,passable=mapWalkableCell) {
  const W=world.width,H=world.height;
  function key(x,y) {
    if(!world.wrap&&(x<0||y<0||x>=W||y>=H))return -1;
    return mod(y,H)*W+mod(x,W);
  }
  function snap(point) {
    const x=Math.floor(point.x),y=Math.floor(point.y);
    let best=-1,dist=Infinity;
    for(let r=0;r<=10;r++) {
      for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++) {
        if(r&&Math.abs(ox)!==r&&Math.abs(oy)!==r)continue;
        const k=key(x+ox,y+oy);if(k<0)continue;
        const cx=k%W,cy=Math.floor(k/W);if(!passable(cx,cy))continue;
        const d=mapDistance(point,{x:cx+.5,y:cy+.5},world);
        if(d<dist){dist=d;best=k;}
      }
      if(best>=0)return best;
    }
    return -1;
  }
  const from=snap(start),to=snap(goal);if(from<0||to<0)return null;
  const previous=new Int32Array(W*H);previous.fill(-2);previous[from]=-1;
  const queue=new Int32Array(W*H);queue[0]=from;let head=0,tail=1;
  while(head<tail && previous[to]===-2) {
    const k=queue[head++],x=k%W,y=Math.floor(k/W);
    for(const [ox,oy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const next=key(x+ox,y+oy);
      if(next<0||previous[next]!==-2||!passable(next%W,Math.floor(next/W)))continue;
      previous[next]=k;queue[tail++]=next;
    }
  }
  if(previous[to]===-2)return null;
  const path=[];
  for(let k=to;k>=0;k=previous[k])path.push(world===MAP_WORLD&&worldReady?mapRoutePoint(k%W,Math.floor(k/W)):{x:k%W+.5,y:Math.floor(k/W)+.5});
  path.reverse();return path;
}
function mapWalkableCell(x,y) {
  const p=mapRoutePoint(x,y);
  return inWorldGrid(x,y)&&!map[idx(x,y)]&&!isWater(p.x,p.y)&&!architectureBlocked(p.x,p.y)&&!landmarkBlocked(p.x,p.y)&&!islandSightBlocked(p.x,p.y,terrainHeight(p.x,p.y));
}
function mapRoutePoint(x,y) {
  if(worldReady&&x===Math.floor(FOOTBRIDGE.x)&&onFootbridge(FOOTBRIDGE.x,y+.5))return {x:FOOTBRIDGE.x,y:y+.5};
  return {x:x+.5,y:y+.5};
}
let mapWaypoint=null;
function loadMapWaypoint(raw) {
  mapWaypoint=null;
  if(!raw||!Number.isFinite(raw.x)||!Number.isFinite(raw.y)||typeof raw.name!=='string')return;
  if(raw.x<0||raw.y<0||raw.x>=MAP_WORLD.width||raw.y>=MAP_WORLD.height)return;
  mapWaypoint={id:typeof raw.id==='string'?cityWaypointId(raw.id).slice(0,100):'pin',name:raw.name.slice(0,100),x:raw.x,y:raw.y};
}
