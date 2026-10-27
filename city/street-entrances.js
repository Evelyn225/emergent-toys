// Placement-only access reservations, built on the finished native city. These
// are not player colliders or shelter, and are never queried by the renderer.
// Door locations follow each facade's actual door layout; logical shop/lobby
// doors are also protected. Stepped entrances include their outermost tread
// and room to step off it, rather than only the doorway in the wall.
const STREET_ENTRANCES = buildStreetEntrances();
const STREET_ENTRANCE_MOVES = [];
function buildStreetEntrances() {
  const zones=[], cells=new Map(), steps=new Map();
  const add=(x,y,c,s,hl,hw,family,nx,ny,source)=>zones.push({
    x,y,c,s,hl,hw,z0:0,z1:family==='stair-foot'?.32:.2,family,nx,ny,source
  });
  const face=(f,along,half,family,source)=>add(
    (f.side?along:f.line)+f.nx*.15,(f.side?f.line:along)+f.ny*.15,
    f.side?1:0,f.side?0:1,half+.025,.15,family,f.nx,f.ny,source
  );
  const valid=(f,sh)=>{
    const u=(f.start+f.end)/2;
    const k=idx(Math.floor((f.side?u:f.line)-f.nx*.1),Math.floor((f.side?f.line:u)-f.ny*.1));
    return !f.low && map[k]===f.height && (!sh || SHOP[k]===sh);
  };
  for(const b of ARCH_BUILDINGS)for(const f of b.faces)if(f.front && valid(f,b.sh)) {
    const width=f.end-f.start,apartment=b.sh.kind===SHOP_APTS;
    if(b.region==='brownstones' && !b.profile) {
      // Every narrow brownstone bay has its own offset entrance and stoop.
      for(let j=0;j<f.units;j++)face(f,f.start+(j+.5-.24)*f.spacing,
        apartment?f.spacing*.125+.025:.067,apartment?'brownstone-door':'brownstone-shop',b.sh.word);
    } else face(f,(f.start+f.end)/2,b.profile && apartment?Math.min(.23,width*.17):.067,
      b.profile?'housing-door':'architecture-door',b.sh.word);
  }
  for(const b of MERCHANT_BUILDINGS)for(const f of b.faces)if(f.front && valid(f,b.sh)) {
    const width=f.end-f.start;
    // Merchant doors are offset from the face centre towards the first bay.
    face(f,f.start+width*.35,Math.min(.14,width*.12)+.012,'merchant-door',b.sh.word);
  }
  const generic=new Set();
  for(const a of SHOPFRONT_FACES)for(const f of a)if(f?.front && !generic.has(f) && valid(f)) {
    generic.add(f);face(f,(f.start+f.end)/2,.067,'generic-door',SHOP[f.ownerCell]?.word);
  }
  const belle=new Set();
  for(const a of BELLE_FACES)for(const f of a)if(f?.sign && !belle.has(f) && valid(f)) {
    belle.add(f);
    const u=(f.start+f.end)/2;
    const k=idx(Math.floor((f.side?u:f.line)-f.nx*.1),Math.floor((f.side?f.line:u)-f.ny*.1));
    if(SHOP[k]?.kind===SHOP_APTS)continue;
    const width=f.end-f.start,bays=Math.max(1,Math.floor(width/.85)),spacing=width/bays;
    for(let j=0;j<bays;j++) {
      const centre=f.start+(j+.5)*spacing;
      if(Math.abs(centre-f.sign.center)<spacing/2)face(f,centre,spacing*.32,'belle-door',SHOP[k]?.word);
    }
  }
  for(const d of doors) {
    const nx=-d.nx*10,ny=-d.ny*10,wallX=d.x+d.nx*1.2,wallY=d.y+d.ny*1.2;
    add(wallX+nx*.15,wallY+ny*.15,Math.abs(ny),Math.abs(nx),.125,.15,'service-door',nx,ny,d.sh.word);
  }
  for(const o of ARCH_STEPS) {
    if(map[o.ownerCell]!==o.ownerHeight)continue;
    const key=[o.ownerCell,(o.x*o.c+o.y*o.s).toFixed(6),o.nx,o.ny].join(':');
    const g=steps.get(key)||{o,minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};
    const u=(o.x-g.o.x)*o.c+(o.y-g.o.y)*o.s,v=(o.x-g.o.x)*o.nx+(o.y-g.o.y)*o.ny;
    g.minU=Math.min(g.minU,u-o.hl);g.maxU=Math.max(g.maxU,u+o.hl);
    g.minV=Math.min(g.minV,v-o.hw);g.maxV=Math.max(g.maxV,v+o.hw);steps.set(key,g);
  }
  const railsByOwner=new Map();
  for(const r of ARCH_DETAILS)if(r.kind==='rail' && map[r.ownerCell]===r.ownerHeight) {
    if(!railsByOwner.has(r.ownerCell))railsByOwner.set(r.ownerCell,[]);
    railsByOwner.get(r.ownerCell).push(r);
  }
  for(const g of steps.values()) {
    const o=g.o;
    // Reserve the side rails too: the tread alone is narrower than the full
    // built stoop. Group only the rail pair alongside this particular flight.
    for(const r of railsByOwner.get(o.ownerCell)||[]) {
      const u=(r.x-o.x)*o.c+(r.y-o.y)*o.s,v=(r.x-o.x)*o.nx+(r.y-o.y)*o.ny;
      if(u<g.minU-.05 || u>g.maxU+.05 || Math.abs(v)>.3)continue;
      const half=r.hl*Math.abs(r.c*o.c+r.s*o.s)+r.hw*Math.abs(-r.s*o.c+r.c*o.s);
      g.minU=Math.min(g.minU,u-half);g.maxU=Math.max(g.maxU,u+half);
    }
    const u=(g.minU+g.maxU)/2,v=(g.minV+g.maxV+.12)/2;
    add(o.x+o.c*u+o.nx*v,o.y+o.s*u+o.ny*v,o.c,o.s,
      (g.maxU-g.minU)/2+.025,(g.maxV-g.minV+.12)/2,'stair-foot',o.nx,o.ny,SHOP[o.ownerCell]?.word);
  }
  for(const z of zones) {
    const [ex,ey]=geometryBounds(z);
    for(let y=Math.floor(z.y-ey);y<=Math.floor(z.y+ey);y++)for(let x=Math.floor(z.x-ex);x<=Math.floor(z.x+ex);x++) {
      const k=idx(x,y);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(z);
    }
  }
  const conflict=b=>{
    const [ex,ey]=geometryBounds(b);
    for(let y=Math.floor(b.y-ey);y<=Math.floor(b.y+ey);y++)for(let x=Math.floor(b.x-ex);x<=Math.floor(b.x+ex);x++)
      for(const z of cells.get(idx(x,y))||[])if(streetBoxesOverlap(b,z,0))return z;
    return null;
  };
  return {zones,cells,conflict,stairGroups:steps.size};
}
function streetEntranceCollision(box) { return STREET_ENTRANCES.conflict(box); }
function streetEntranceFixtureClear(o,kind) {
  return streetFixtureBoxes(o,kind).every(b=>!streetEntranceCollision(b));
}
// Nearby buckets may still contain the previous cell while this family is
// being fitted. The 3x3 neighbourhood covers the bounded two-metre slide.
function streetEntranceNeighboursOverlap(o,kind,boxes=streetFixtureBoxes(o,kind)) {
  const bx=Math.floor(o.x/8),by=Math.floor(o.y/8);
  const overlaps=(p,k)=>p!==o&&streetFixtureBoxes(p,k).some(b=>boxes.some(a=>streetBoxesOverlap(a,b,.008)));
  for(const [b,k] of [[lampsB,'lamp'],[lightsB,'signal'],[benchesB,'bench'],[treesB,'tree'],[machinesB,'machine'],[extrasB,'bike']])
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)for(const p of b[bi(bx+x,by+y)]) {
      if(k==='bike'&&p.bike==null)continue;
      if(Math.abs(rel(p.x-o.x))<1&&Math.abs(rel(p.y-o.y))<1&&overlaps(p,k))return true;
    }
  return vendors.some(p=>overlaps(p,'vendor'));
}
// Source-layout fitting predates archipelago assembly, and assembly replaces
// junction signals. Refit only native entrance conflicts, sliding along the
// existing kerb/facade, then refresh the same spatial and lighting caches.
for(const [items,buckets,kind] of [[lamps,lampsB,'lamp'],[lights,lightsB,'signal'],[benches,benchesB,'bench'],[trees,treesB,'tree'],[machines,machinesB,'machine']])
  fitStreetFixtures(items,buckets,kind,true);
const entranceBikes=extras.filter(o=>o.bike!=null),oldEntranceBikes=new Set(entranceBikes);
fitStreetFixtures(entranceBikes,bucketed(entranceBikes),'bike',true);
const keptEntranceBikes=new Set(entranceBikes);
for(let j=extras.length-1;j>=0;j--)if(oldEntranceBikes.has(extras[j])&&!keptEntranceBikes.has(extras[j]))extras.splice(j,1);
for(const b of extrasB)b.length=0;
for(const o of extras)extrasB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].push(o);
fitStreetFixtures(vendors,bucketed(vendors),'vendor',true);
rebuildLampGlow();
