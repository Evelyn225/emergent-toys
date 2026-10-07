// Static clearance and shelter are resolved once after all building families have supplied their geometry.
const STREET_GEOMETRY = [...ARCH_DETAILS, ...LANDMARK_SOLIDS, ...PAVILION_SOLIDS, ...belleDetails, ...solids];
const streetGeometryCells = new Array(N * N);
function geometryBounds(o) {
  return [Math.abs(o.c) * o.hl + Math.abs(o.s) * o.hw, Math.abs(o.s) * o.hl + Math.abs(o.c) * o.hw];
}
for (const o of STREET_GEOMETRY) {
  const [ex, ey] = geometryBounds(o);
  for (let y = Math.floor(o.y - ey); y <= Math.floor(o.y + ey); y++) for (let x = Math.floor(o.x - ex); x <= Math.floor(o.x + ex); x++) {
    const cell = idx(x, y); (streetGeometryCells[cell] || (streetGeometryCells[cell] = [])).push(o);
  }
}
function streetBoxesOverlap(a_, b, pad = 0.012) {
  if (a_.z0 >= b.z1 + pad || a_.z1 <= b.z0 - pad) return false;
  const rx = rel(b.x - a_.x), ry = rel(b.y - a_.y);
  for (const [cx, cy] of [[a_.c,a_.s],[-a_.s,a_.c],[b.c,b.s],[-b.s,b.c]]) {
    const span = a_.hl * Math.abs(cx * a_.c + cy * a_.s) + a_.hw * Math.abs(-cx * a_.s + cy * a_.c)
      + b.hl * Math.abs(cx * b.c + cy * b.s) + b.hw * Math.abs(-cx * b.s + cy * b.c);
    if (Math.abs(rx * cx + ry * cy) >= span + pad) return false;
  }
  return true;
}
function streetGeometryCollision(box, walls = true) {
  const [ex, ey] = geometryBounds(box), visited = new Set();
  for (let y = Math.floor(box.y - ey - .02); y <= Math.floor(box.y + ey + .02); y++) for (let x = Math.floor(box.x - ex - .02); x <= Math.floor(box.x + ex + .02); x++) {
    const cell = idx(x, y);
    if (walls && map[cell] > box.z0 && streetBoxesOverlap(box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5,z0:0,z1:map[cell]},0)) return {kind:'wall'};
    for (const o of streetGeometryCells[cell] || []) {
      if (visited.has(o)) continue;
      visited.add(o);
      if (o.ownerCell != null && map[o.ownerCell] !== o.ownerHeight) continue;
      if (streetBoxesOverlap(box,o)) return o;
    }
  }
  return null;
}
function streetFixtureBoxes(o, kind) {
  const box = (hl,hw,z0,z1,x=o.x,y=o.y,c=1,s=0) => ({x,y,c,s,hl,hw,z0,z1});
  if (kind === 'lamp') {
    if (districtAt(o.x,o.y) === 'belle') return belleLampParts(o.x,o.y,o.ax,o.ay);
    const top = o.top ?? LAMP_TOP;
    return [box(.028,.028,0,.06),box(.012,.012,.06,top+.02),
      box(REACH/2+.008,.012,top,top+NECK+.008,o.x+o.ax*REACH/2,o.y+o.ay*REACH/2,o.ax,o.ay),
      box(.033,.033,top-.14,top,o.x+o.ax*REACH,o.y+o.ay*REACH)];
  }
  if (kind === 'signal') return [box(.025,.025,0,.4)];
  if (kind === 'blade') return [box(.022,.006,0,.33,o.x,o.y,0,1)];
  if (kind === 'el-stairs') return [box(.11,.11,0,EL_BOT-.02)];
  if (kind === 'bench') return [box(.18,.07,.01,.13,o.x,o.y,-o.fy,o.fx)];
  if (kind === 'tree') return [box(.03,.03,0,.6*(o.s || 1))];
  return [box(VM_HL,VM_HW,0,VM_H,o.x,o.y,o.c,o.s)];
}
const streetFixtureClear = (o,kind) => streetFixtureBoxes(o,kind).every(b => !streetGeometryCollision(b,kind !== 'machine'));
function fixtureStreetDirection(o) {
  if (o.ax != null) return [o.ax,o.ay];
  const x = mod(o.x,8), y = mod(o.y,8);
  if (ROAD[idx(Math.floor(o.x),Math.floor(o.y))]) {
    if (x < 2 && (y >= 2 || Math.abs(x-1) > Math.abs(y-1))) return [x<1?1:-1,0];
    if (y < 2) return [0,y<1?1:-1];
  }
  return null;
}
const STREET_CLEARANCE = { checked: {}, moved: {}, removed: {}, conflicts: {} };
function fixtureSpaceTaken(o,buckets) {
  const bx=Math.floor(o.x/8),by=Math.floor(o.y/8);
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)for(const p of buckets[bi(bx+x,by+y)])
    if(p!==o&&Math.hypot(rel(o.x-p.x),rel(o.y-p.y))<.2)return true;
  return false;
}
function fitStreetFixtures(items, buckets, kind) {
  STREET_CLEARANCE.checked[kind] = items.length; STREET_CLEARANCE.moved[kind] = 0; STREET_CLEARANCE.removed[kind] = 0;
  for (let k=items.length-1;k>=0;k--) {
    const o=items[k];
    if (kind==='lamp') o.top = arcadeAt(o.x,o.y) ? ARCADE_Z-NECK-.03 : LAMP_TOP;
    if (streetFixtureClear(o,kind)) continue;
    for (const b of streetFixtureBoxes(o,kind)) {
      const hit=streetGeometryCollision(b,kind!=='machine');
      if (hit) STREET_CLEARANCE.conflicts[hit.kind]=(STREET_CLEARANCE.conflicts[hit.kind]||0)+1;
    }
    const start=[o.x,o.y], direction=fixtureStreetDirection(o); let fitted=false;
    const candidates=[];
    if (direction) {
      const [nx,ny]=direction;
      let offsets=[.06,.12,.16,0];
      if(kind==='blade')offsets=[.06,.12,.16,.24,.3,0];
      if(kind==='machine')offsets=[0]; // wall-mounted machines slide along their facade
      for (const inward of offsets) for (const along of [0,-.35,.35,-.7,.7,-1.05,1.05])
        candidates.push([start[0]+nx*inward-ny*along,start[1]+ny*inward+nx*along]);
    } else for (const radius of [.2,.4,.6]) for(let n=0;n<8;n++) candidates.push([start[0]+Math.cos(n*Math.PI/4)*radius,start[1]+Math.sin(n*Math.PI/4)*radius]);
    for (const [x,y] of candidates) {
      o.x=mod(x,N);o.y=mod(y,N);
      if (isWater(o.x,o.y) || direction && !ROAD[idx(Math.floor(o.x),Math.floor(o.y))]) continue;
      if(kind==='machine') {
        const fx=-o.s*o.fs,fy=o.c*o.fs;
        if(!map[idx(o.x-fx*.1,o.y-fy*.1)]||map[idx(o.x+fx*.3,o.y+fy*.3)]
          ||stations.some(s=>Math.hypot(rel(s.x-o.x),rel(s.y-o.y))<.7))continue;
      }
      if (fixtureSpaceTaken(o,buckets)) continue;
      if (streetFixtureClear(o,kind)) {fitted=true;break;}
    }
    if (fitted) STREET_CLEARANCE.moved[kind]++;
    else {items.splice(k,1);STREET_CLEARANCE.removed[kind]++;}
  }
  for (const bucket of buckets) bucket.length=0;
  for (const o of items) buckets[bi(Math.floor(o.x/8),Math.floor(o.y/8))].push(o);
}
fitStreetFixtures(lamps,lampsB,'lamp');
fitStreetFixtures(lights,lightsB,'signal');
fitStreetFixtures(benches,benchesB,'bench');
fitStreetFixtures(trees,treesB,'tree');
fitStreetFixtures(machines,machinesB,'machine');
const subwayBlades=stations.flatMap(s=>{
  s.blades=[-1,1].map(e=>({x:s.x+e*(SUBWAY_HOLE[0]+.02),y:s.y-e*(SUBWAY_HOLE[1]+.025),ax:0,ay:-1}));
  return s.blades;
});
fitStreetFixtures(subwayBlades,bucketed(subwayBlades),'blade');
const elStairs=EL_STATIONS.flatMap(s=>{
  s.stairs=[0,1].map(tr=>({x:s.x,y:EL_Y+(tr?1.86:.14),ax:0,ay:tr?-1:1}));
  return s.stairs;
});
fitStreetFixtures(elStairs,bucketed(elStairs),'el-stairs');
// Ground-light queries visit only the heads whose pools can reach this cell, including relocated lamps.
for (const l of lamps) {
  const belle = districtAt(l.x,l.y)==='belle';
  l.gx=mod(l.x+(belle?0:l.ax*REACH),N);l.gy=mod(l.y+(belle?0:l.ay*REACH),N);
  for(let y=Math.floor(l.gy-.55);y<=Math.floor(l.gy+.55);y++)for(let x=Math.floor(l.gx-.55);x<=Math.floor(l.gx+.55);x++) {
    const cell=idx(x,y);(lampGlowCells[cell]||(lampGlowCells[cell]=[])).push(l);
  }
}
function geometrySurfaceHeight(o,x,y) {
  const rx=rel(x-o.x),ry=rel(y-o.y),u=rx*o.c+ry*o.s,v=-rx*o.s+ry*o.c;
  if(Math.abs(u)>o.hl||Math.abs(v)>o.hw)return 0;
  let top=o.z1,bottom=o.z0;
  if(o.planes)for(const [nx,ny,nz,limit] of o.planes) {
    const d=limit-nx*u-ny*v;
    if(!nz){if(d<0)return 0;}else if(nz>0)top=Math.min(top,d/nz);else bottom=Math.max(bottom,d/nz);
  }
  return top>=bottom?top:0;
}
const groundSnowCells = new Array(N * N);
function groundSnowShelter(cell, overhead) {
  const cx = cell % N + .5, cy = Math.floor(cell / N) + .5, rectangles = [], complex = [];
  const sameOwner = (a,b) => a.o.ownerCell === b.o.ownerCell && a.o.ownerHeight === b.o.ownerHeight;
  const contains = (a,b) => a.x0 <= b.x0 && a.y0 <= b.y0 && a.x1 >= b.x1 && a.y1 >= b.y1;
  for (const o of overhead) {
    if (o.z1 <= .02) continue;
    if (o.planes || !(Math.abs(o.c) === 1 && o.s === 0 || Math.abs(o.s) === 1 && o.c === 0)) { complex.push(o); continue; }
    const [ex,ey] = geometryBounds(o), x = .5 + rel(o.x-cx), y = .5 + rel(o.y-cy);
    const r = { x0: Math.max(0,x-ex), x1: Math.min(1,x+ex), y0: Math.max(0,y-ey), y1: Math.min(1,y+ey), o };
    if (r.x0 > r.x1 || r.y0 > r.y1 || rectangles.some(a => sameOwner(a,r) && contains(a,r))) continue;
    for (let n=rectangles.length-1;n>=0;n--) if (sameOwner(r,rectangles[n]) && contains(r,rectangles[n])) rectangles.splice(n,1);
    rectangles.push(r);
  }
  return { rectangles, complex };
}
function groundSnowExposed(x,y,cell,overhead) {
  if (!overhead) return true;
  const shelter = groundSnowCells[cell] || (groundSnowCells[cell] = groundSnowShelter(cell,overhead)), fx = fract(x), fy = fract(y);
  for (const r of shelter.rectangles) {
    if (r.o.ownerCell != null && map[r.o.ownerCell] !== r.o.ownerHeight) continue;
    if (fx < r.x0-1e-10 || fx > r.x1+1e-10 || fy < r.y0-1e-10 || fy > r.y1+1e-10) continue;
    // At exact geometry/cell boundaries keep the original world-coordinate rounding and inclusive edge rules.
    if (Math.min(Math.abs(fx-r.x0),Math.abs(fx-r.x1),Math.abs(fy-r.y0),Math.abs(fy-r.y1)) < 1e-10)
      return geometrySnowExposed(x,y,0,overhead);
    return false;
  }
  return geometrySnowExposed(x,y,0,shelter.complex);
}
function geometrySnowExposed(x,y,z,overhead) {
  if(!overhead)return true;
  for (const o of overhead) {
    if (o.z1<=z+.02 || o.ownerCell!=null&&map[o.ownerCell]!==o.ownerHeight) continue;
    if (geometrySurfaceHeight(o,x,y)>z+.02) return false;
  }
  return true;
}
function snowExposed(x,y,z=0) {
  if (underEl(y) && z<EL_BOT || arcadeAt(x,y) && z<ARCADE_Z) return false;
  const cell = idx(Math.floor(x),Math.floor(y)), overhead = streetGeometryCells[cell];
  const canopy = BELLE_ROOF_INFILL[cell] && BELLE_ROOF_CELLS[cell];
  if (canopy && z < canopy.h - .02) return false;
  if (z === 0) return groundSnowExposed(x,y,cell,overhead);
  return geometrySnowExposed(x,y,z,overhead);
}
