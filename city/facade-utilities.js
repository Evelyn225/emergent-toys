// Utilities on the building fronts along the streets, placed on the finished
// city: downpipes from the roof to the pavement (a hopper head under the
// parapet, a bracket every couple of metres, a shoe at the foot that pours in
// the rain) and, beside some of them, an electric or a gas meter at hand
// height. Clear of doors, vending machines and anything on the facade.
// {x, y, ax, ay: out of the wall, c, s: along it, h: its top, meter}
const PIPE = { r: .005, off: .011, bracket: .2, head: .03, gap: .013 }; // (gap: the street geometry's clearance pad, and a little)
const facadePipes = [];
// The pipe's way up the wall from (wx, wy) on the face (n out of it) toward height h: [{z, out}] points from the
// shoe to the hopper head, stepping out round a thin moulding and back, stopping under a deep one or the cornice;
// or null if there's no clear run of at least two metres.
function pipeRoute(wx, wy, nx, ny, h) {
  const c = Math.abs(ny), s = Math.abs(nx), x = wx + nx * PIPE.off, y = wy + ny * PIPE.off;
  if (doors.some(d => Math.abs(rel(d.x - x)) < .4 && Math.abs(rel(d.y - y)) < .4 && Math.abs(rel(d.x - x) * c + rel(d.y - y) * s) < .09)) return null; // (not across a door)
  if (machines.some(m => Math.abs(rel(m.x - x)) < .12 && Math.abs(rel(m.y - y)) < .12)) return null;
  const col = { x, y, c, s, hl: .009, hw: PIPE.off - .002, z0: .02, z1: h }, seen = new Set(), bands = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of streetGeometryCells[idx(Math.floor(x) + i, Math.floor(y) + j)] || []) {
    if (seen.has(o) || o.ownerCell != null && map[o.ownerCell] !== o.ownerHeight) continue;
    seen.add(o);
    const reach = rel(o.x - wx) * nx + rel(o.y - wy) * ny + Math.abs(o.hl * (o.c * nx + o.s * ny)) + Math.abs(o.hw * (-o.s * nx + o.c * ny)); // (how far out of the wall it stands)
    if (streetBoxesOverlap({ ...col, hl: .016, hw: PIPE.off + PIPE.r + .002 }, o)) bands.push({ z0: o.z0, z1: o.z1, reach }); // (as wide as the hopper head)
  }
  bands.sort((a, b) => a.z0 - b.z0);
  const pts = [{ z: .03, out: PIPE.off }];
  let top = h;
  for (const b of bands) {
    if (b.z1 < .03) continue;
    if (b.z0 > top) break;
    if (b.z1 - b.z0 < .06 && b.reach < .06 && b.z0 > pts[pts.length - 1].z + .06 && b.z1 + .06 < top) { // a thin moulding: step out round it
      const out = b.reach + PIPE.r + PIPE.gap;
      pts.push({ z: b.z0 - .04, out: PIPE.off }, { z: b.z0 - PIPE.gap - .003, out }, { z: b.z1 + PIPE.gap + .003, out }, { z: b.z1 + .04, out: PIPE.off });
    } else { top = Math.min(top, b.z0 - PIPE.gap); break; } // a cornice: the hopper head goes under it
  }
  if (top - PIPE.head < .2) return null;
  pts.push({ z: top - PIPE.head, out: PIPE.off });
  return { pts: pts.filter(q => q.z <= top - PIPE.head + 1e-9), top };
}
const facadePipesB = bucketed([]);
// Down each street front's two ends (its corners and party walls), clear of the lettering centred on it.
for (const bld of ARCH_BUILDINGS) for (const f of bld.faces || []) {
  if (!f.street || f.low || f.height < .3) continue;
  for (const [end, along] of [[-1, f.start + .06], [1, f.end - .06]]) {
    const wx = f.side ? along : f.line, wy = f.side ? f.line : along, key = Math.floor(wx * 7) * 7919 + Math.floor(wy * 7);
    if (districtAt(wx, wy) === 'belle' || landmarkOf.has(bi(Math.floor(wx / 8), Math.floor(wy / 8)))) continue; // (they have their own detailing)
    if (hash(Math.floor(wx * 3), Math.floor(wy * 3), 1500) > .45 || !ROAD[idx(Math.floor(wx + f.nx * .1), Math.floor(wy + f.ny * .1))]) continue; // (a street in front)
    const x = worldCoord(wx + f.nx * PIPE.off), y = worldCoord(wy + f.ny * PIPE.off);
    if (facadePipes.some(q => Math.abs(rel(q.x - x)) < .25 && Math.abs(rel(q.y - y)) < .25)) continue;
    const route = pipeRoute(worldCoord(wx), worldCoord(wy), f.nx, f.ny, f.height - .015);
    if (!route) continue;
    const r = hash(Math.floor(wx * 3), Math.floor(wy * 3), 1510);
    const p = { x, y, ax: f.nx, ay: f.ny, c: Math.abs(f.ny), s: Math.abs(f.nx), h: route.top, pts: route.pts, meter: r < .3 ? 'electric' : r < .5 ? 'gas' : null, side: -end }; // (the meter on the front's side)
    facadePipes.push(p); facadePipesB[bi(Math.floor(x / 8), Math.floor(y / 8))].push(p);
  }
}
// Prepared only when a pipe is first seen; city placements and route data stay
// immutable. Tube rays restore camera-relative coordinates for thin glyphs.
const FACADE_PIPE_MODELS=new WeakMap();
const facadePipeWater=(i,u,z,du,dz)=>{
  if(Math.abs(u)>.006+du||fract(z*40-T*6)>.5)return false;
  BG[i]=C(CYAN,3);return set(i,z<.004?'~':'|',C(WHITE,9)),true;
};
function buildFacadePipeModel(p){
  const parts=[],k=PIPE,at=(a,v)=>[p.c*a+p.ax*(v-k.off),p.s*a+p.ay*(v-k.off)];
  const paint=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const add=(role,box,shade,ray=rayBox,near=true)=>{const q={role,box,shade,ray,near};parts.push(q);return q;};
  const tube=(role,A,B,r,col=GRAY,near=true)=>{
    const [ax,ay,az]=A,[bx,by,bz]=B,box={...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r};
    const q=add(role,box,col===GRAY?paint:(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,col),coveRayCapsule,near);q.tube=true;
    q.lineBox={...box,hl:box.hl+.01,hw:box.hw+.01,z0:box.z0-.01,z1:box.z1+.01};
    q.lineShade=(i,t,L)=>{if(r*2*projX/t>1.5)BG[i]=C(col,.8+L*.25*1.1);return set(i,courierGlyph(HIT.u,HIT.v,HIT.w,bx-ax,by-ay,bz-az),C(col,L*1.1)),true;};return q;
  };
  for(let n=1;n<p.pts.length;n++){
    const a=p.pts[n-1],b=p.pts[n];tube('pipe',[...at(0,a.out),a.z],[...at(0,b.out),b.z],k.r,GRAY,false);
  }
  const [hx,hy]=at(0,k.off+.002);
  add('hopper',{...boxAt(hx,hy,p.c,p.s,.016,.013,p.h-k.head,p.h),round:.004},paint,coveRayRounded);
  const bracketPaint=(i,t,L)=>{HIT.nx=p.ax;HIT.ny=p.ay;HIT.nz=0;return paint(i,t,L);};
  for(let z=.15;z<p.h-k.head-.05;z+=k.bracket){
    if(p.pts.some((q,n)=>n&&q.out!==k.off&&Math.abs(q.z-z)<.05))continue;
    add('bracket',boxAt(...at(0,k.off/2),p.c,p.s,.007,k.off/2+k.r,z,z+.005),bracketPaint);
  }
  const [sx,sy]=at(0,k.off+.022);tube('shoe',[0,0,.034],[sx,sy,.012],k.r);
  parts.push({role:'water',x:sx,y:sy,near:true});
  if(p.meter){
    if(p.meter==='gas'){const [gx,gy]=at(p.side*.05,.016);tube('gas',[gx,gy,0],[gx,gy,.085],.003,YEL);}
    add('meter',boxAt(...at(p.side*.05,.008),p.c,p.s,.014,.008,.085,.125),(i,t,L)=>{
      HIT.nx=HIT.face===3||HIT.face===4?p.ax:0;HIT.ny=HIT.face===3||HIT.face===4?p.ay:0;HIT.nz=HIT.face===5?1:0;
      const dial=Math.hypot(HIT.u,HIT.w-.11)<.006&&(HIT.face===3||HIT.face===4);
      BG[i]=dial?C(WHITE,3.4):C(p.meter==='gas'?YEL:GRAY,(p.meter==='gas'?2:1.6)+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));return set(i,' ',0),true;
    });
  }
  for(const q of parts)if(q.box){
    const moved=ray=>(ox,oy,oz,rx,ry,rz,B)=>{
      const x=B.x-q.box.x,y=B.y-q.box.y,t=ray(ox-x,oy-y,oz,rx,ry,rz,q.box);
      if(t>=0&&q.tube){HIT.u+=x;HIT.v+=y;}return t;
    };
    q.moved=moved(q.ray);if(q.tube)q.lineMoved=moved(rayRod);
  }
  return {parts,draw(x,y,near){
    for(const q of parts){
      if(q.near&&!near)continue;
      if(q.role==='water'){if(rain>.2)drawShape(x+q.x,y+q.y,0,.02,.02,facadePipeWater);continue;}
      const line=q.tube&&q.box.r*2*projX/Math.max(.02,dx*(x+q.box.x)+dy*(y+q.box.y))<1.5,B=line?q.lineBox:q.box;
      drawBox({...B,x:x+B.x,y:y+B.y},line?q.lineShade:q.shade,x||y?(line?q.lineMoved:q.moved):(line?rayRod:q.ray));
    }
  }};
}
function facadePipeModel(p){let model=FACADE_PIPE_MODELS.get(p);if(!model){model=buildFacadePipeModel(p);FACADE_PIPE_MODELS.set(p,model);}return model;}
function drawFacadePipe(p,vx,vy){facadePipeModel(p).draw(vx,vy,Math.hypot(vx,vy)<3);}
function drawFacadeUtilities() {
  forNear(facadePipesB, p => { const [vx, vy] = R(p.x, p.y); if (Math.hypot(vx, vy) < vis && inView(vx, vy, .05)) drawFacadePipe(p, vx, vy); });
}
