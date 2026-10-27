// Source-layout wall mounting can be lost at the finished headland seams.
// Rehome only those orphaned machines, using real native frontage planes.
// This runs before the first model is drawn and before later kerbs are placed.
const NATIVE_MACHINE_PLACEMENT = {moved:[],unfitted:[]};
function fitNativeMachineMounts() {
  NATIVE_MACHINE_PLACEMENT.moved.length=0;NATIVE_MACHINE_PLACEMENT.unfitted.length=0;
  const faces=STREET_ENTRANCES.zones.filter(z=>z.family!=='service-door'&&z.family!=='stair-foot');
  for(const o of machines) {
    if(machineMountClear(o))continue;
    const before={x:o.x,y:o.y,c:o.c,s:o.s,fs:o.fs,kind:o.kind},candidates=[];
    const add=(wallX,wallY,nx,ny,along)=>{
      const c=Math.abs(ny),s=Math.abs(nx),fs=Math.sign(-s*nx+c*ny);
      for(const u of along) {
        const x=wallX+nx*.04+c*u,y=wallY+ny*.04+s*u,d=Math.hypot(rel(x-before.x),rel(y-before.y));
        if(d<=16)candidates.push({x:worldCoord(x),y:worldCoord(y),c,s,fs,d});
      }
    };
    // Include nearby blank side walls, rather than carrying a machine a block
    // away simply because a street face has no door. CITY's actual solid shop
    // cells bound these planes; the full entrance/geometry checks still apply.
    for(let y=Math.floor(before.y)-4;y<=Math.floor(before.y)+4;y++)for(let x=Math.floor(before.x)-4;x<=Math.floor(before.x)+4;x++) {
      const cell=idx(x,y);if(map[cell]<VM_H||!SHOP[cell])continue;
      for(const [nx,ny]of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const street=idx(x+nx,y+ny);if(map[street]||!ROAD[street])continue;
        add(x+(nx>0?1:nx<0?0:.5),y+(ny>0?1:ny<0?0:.5),nx,ny,[-.3,0,.3]);
      }
    }
    for(const z of faces) {
      if(Math.hypot(rel(z.x-before.x),rel(z.y-before.y))>16)continue;
      add(z.x-z.nx*.15,z.y-z.ny*.15,z.nx,z.ny,[-.3,.3,-.5,.5,-.75,.75,-1,1]);
    }
    candidates.sort((a,b)=>a.d-b.d);let fitted=false;
    for(const p of candidates) {
      o.x=p.x;o.y=p.y;o.c=p.c;o.s=p.s;o.fs=p.fs;
      if(!ROAD[idx(o.x,o.y)]||isWater(o.x,o.y)||!machineMountClear(o)||elStairLocal(o.x,o.y))continue;
      if(stations.some(s=>Math.hypot(rel(s.x-o.x),rel(s.y-o.y))<.7))continue;
      if(!streetEntranceFixtureClear(o,'machine')||!streetFixtureClear(o,'machine')||streetEntranceNeighboursOverlap(o,'machine'))continue;
      const fx=-o.s*o.fs,fy=o.c*o.fs,front={x:o.x+fx*.15,y:o.y+fy*.15,c:1,s:0,hl:.025,hw:.025,z0:0,z1:.2};
      if(streetGeometryCollision(front,true)||streetEntranceCollision(front)||streetEntranceNeighboursOverlap(o,'machine',[front]))continue;
      fitted=true;break;
    }
    if(!fitted){Object.assign(o,before);NATIVE_MACHINE_PLACEMENT.unfitted.push(o);continue;}
    // Maintain the live placement index after each move, not only at the end:
    // later candidates must see an earlier machine at its new wall.
    const old=machinesB[bi(Math.floor(before.x/8),Math.floor(before.y/8))];
    old.splice(old.indexOf(o),1);machinesB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].push(o);
    NATIVE_MACHINE_PLACEMENT.moved.push({o,before,distance:Math.hypot(rel(o.x-before.x),rel(o.y-before.y))});
  }
}
fitNativeMachineMounts();
