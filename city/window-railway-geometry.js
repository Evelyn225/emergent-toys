// Window-local geometry. Static solids are built once and indexed by bounds;
// a pane cell visits only nearby leaves instead of testing every miniature.
let RAILWAY_TREE=null;
const RAILWAY_WHEELS=[];
const RAILWAY_HIT={piece:null,t:0,face:0,u:0,v:0,z:0};
function railwayBounds(o) {
  if(o.bounds)return o.bounds;
  const x=Math.abs(o.c)*o.hl+Math.abs(o.s)*o.hw,y=Math.abs(o.s)*o.hl+Math.abs(o.c)*o.hw;
  return o.bounds=[o.x-x,o.y-y,o.z0,o.x+x,o.y+y,o.z1];
}
function railwayTree(pieces) {
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const o of pieces){const b=railwayBounds(o);for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],b[k]);bounds[k+3]=Math.max(bounds[k+3],b[k+3]);}}
  if(pieces.length<=3)return {bounds,pieces};
  let axis=0;for(let k=1;k<3;k++)if(bounds[k+3]-bounds[k]>bounds[axis+3]-bounds[axis])axis=k;
  pieces.sort((a,b)=>{const x=railwayBounds(a),y=railwayBounds(b);return x[axis]+x[axis+3]-y[axis]-y[axis+3];});
  const at=pieces.length>>1;
  return {bounds,left:railwayTree(pieces.slice(0,at)),right:railwayTree(pieces.slice(at))};
}
// No slab closures or temporary hit objects in this per-cell hot path.
function railwayBoundsHit(b,x,z,du,dz,limit) {
  let lo=Math.max(0,b[1]),hi=Math.min(limit,b[4]);
  if(Math.abs(du)<1e-12){if(x<b[0]||x>b[3])return false;}
  else{const a=(b[0]-x)/du,c=(b[3]-x)/du;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));}
  if(lo>hi)return false;
  if(Math.abs(dz)<1e-12){if(z<b[2]||z>b[5])return false;}
  else{const a=(b[2]-z)/dz,c=(b[5]-z)/dz;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));}
  return lo<=hi;
}
function railwayRay(ox,oy,oz,rx,ry,rz,o) {
  let lo=0,hi=Infinity,face=0;
  const p=o.miniPlanes||o.planeData;
  if(p){
    const x=ox-(o.miniPlanes?0:o.x),y=oy-(o.miniPlanes?0:o.y);
    for(let k=0;k<p.length;k+=4){
      const dist=p[k+3]-p[k]*x-p[k+1]*y-p[k+2]*oz,vel=p[k]*rx+p[k+1]*ry+p[k+2]*rz;
      if(Math.abs(vel)<1e-12){if(dist< -1e-12)return -1;continue;}
      const t=dist/vel;if(vel<0&&t>lo){lo=t;face=o.miniFaces?o.miniFaces[k/4]:k/4;}else if(vel>0)hi=Math.min(hi,t);
      if(lo>hi+1e-12)return -1;
    }
  }else{
    const x=ox-o.x,y=oy-o.y,u=x*o.c+y*o.s,v=-x*o.s+y*o.c,du=rx*o.c+ry*o.s,dv=-rx*o.s+ry*o.c;
    // The axes are deliberately unrolled: no arrays allocated for each ray.
    for(let k=0;k<3;k++){
      const q=k===0?u:k===1?v:oz,d=k===0?du:k===1?dv:rz,a=k===0?-o.hl:k===1?-o.hw:o.z0,b=k===0?o.hl:k===1?o.hw:o.z1;
      if(Math.abs(d)<1e-12){if(q<a||q>b)return -1;continue;}
      const t0=(a-q)/d,t1=(b-q)/d,entry=Math.min(t0,t1);
      if(entry>lo){lo=entry;face=k===0?(d>0?2:1):k===1?(d>0?4:3):(d>0?6:5);}
      hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return -1;
    }
  }
  if(lo<1e-7)return -1;
  HIT.face=face;HIT.u=(ox+rx*lo-o.x)*o.c+(oy+ry*lo-o.y)*o.s;
  HIT.v=-(ox+rx*lo-o.x)*o.s+(oy+ry*lo-o.y)*o.c;HIT.w=oz+rz*lo;
  // Moving train solids carry pitched local coordinates for their paintwork.
  if(o.pose){const u=HIT.u,w=HIT.w-o.poseZ;HIT.u=u*o.pose.cp+w*o.pose.sp;HIT.w=-u*o.pose.sp+w*o.pose.cp;}
  return lo;
}
function railwayVisit(node,x,z,du,dz) {
  if(!node||!railwayBoundsHit(node.bounds,x,z,du,dz,RAILWAY_HIT.t))return;
  if(node.pieces){for(const o of node.pieces)railwayTest(o,x,z,du,dz);}
  else{railwayVisit(node.left,x,z,du,dz);railwayVisit(node.right,x,z,du,dz);}
}
function railwayTest(o,x,z,du,dz,unculled=false) {
  if(!unculled&&!railwayBoundsHit(railwayBounds(o),x,z,du,dz,RAILWAY_HIT.t))return;
  const t=railwayRay(x,0,z,du,1,dz,o);
  if(t>0&&t<RAILWAY_HIT.t){RAILWAY_HIT.piece=o;RAILWAY_HIT.t=t;RAILWAY_HIT.face=HIT.face;RAILWAY_HIT.u=HIT.u;RAILWAY_HIT.v=HIT.v;RAILWAY_HIT.z=HIT.w;}
}
function railwayCast(x,z,du,dz,limit,brute=false) {
  RAILWAY_HIT.piece=null;RAILWAY_HIT.t=limit;
  if(brute)for(const o of RAILWAY_MODELS)railwayTest(o,x,z,du,dz,true);
  else railwayVisit(RAILWAY_TREE,x,z,du,dz);
  for(const o of RAILWAY_TRAIN)railwayTest(o,x,z,du,dz,brute);
  for(const o of RAILWAY_ENGINE)railwayTest(o,x,z,du,dz,brute);
  for(const o of RAILWAY_WHEELS)railwayTest(o,x,z,du,dz,brute);
  return RAILWAY_HIT;
}
// A triangle extruded vertically: its five closed faces share exact vertices
// with its neighbour. Two triangles form each curved/graded strip segment.
function railwayPrism(points,low,high,base,kind) {
  const [a,b,c]=points,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
  const sx=((b.z-a.z)*(c.y-a.y)-(c.z-a.z)*(b.y-a.y))/det;
  const sy=((b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z))/det;
  const h=a.z-sx*a.x-sy*a.y,planes=[-sx,-sy,1,h+high,sx,sy,-1,-h-low];
  for(let k=0;k<3;k++){
    const p=points[k],q=points[(k+1)%3],sign=det>0?1:-1,nx=(q.y-p.y)*sign,ny=(p.x-q.x)*sign;
    planes.push(nx,ny,0,nx*p.x+ny*p.y);
  }
  const o={x:0,y:0,c:1,s:0,base,kind,miniPlanes:Float64Array.from(planes),miniFaces:[5,6,1,2,3],
    bounds:[Math.min(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.min(...points.map(p=>p.z))+low,
      Math.max(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y)),Math.max(...points.map(p=>p.z))+high]};
  RAILWAY_MODELS.push(o);return o;
}
function railwayStrip(a,b,offset,half,low,high,base,kind) {
  const edge=(p,v)=>({x:p.x-p.s*v,y:p.y+p.c*v,z:p.z});
  const p=edge(a,offset-half),q=edge(a,offset+half),r=edge(b,offset-half),s=edge(b,offset+half);
  railwayPrism([p,r,s],low,high,base,kind);railwayPrism([p,s,q],low,high,base,kind);
}
function buildRailwayTrack() {
  const post=p=>{
    const len=Math.hypot(p.c,p.s),c=p.c/len,s=p.s/len;
    for(const side of [-1,1])miniBox(p.x-s*side*.021,p.y+c*side*.021,.0014,.0014,p.z-.0085,p.z+.012,GRAY,'railing');
  };
  for(let k=0;k<RAILWAY_PATH.length-1;k++){
    const a=RAILWAY_PATH[k],b=RAILWAY_PATH[k+1],front=(a.y+b.y)/2<.23,mid=(a.x+b.x)/2;
    railwayStrip(a,b,0,.016,-.0085,-.0025,BRICK,'trackbed');
    for(const side of [-1,1])railwayStrip(a,b,side*.0085,.0012,-.0025,0,YEL,'rail');
    if(!front&&Math.abs(mid)<.06)railwayStrip(a,b,0,.023,-.014,-.0085,STONE,'bridge');
    if(front&&Math.abs(mid)<.15){
      railwayStrip(a,b,0,.023,-.014,-.0085,STONE,'bridge');
      // The ramps rest on shaped masonry; the middle stays open over water.
      if(Math.abs(mid)>.06&&Math.max(a.z,b.z)-.014>.078){
        // Foundation wedges have a level bottom and the actual graded top.
        const before=RAILWAY_MODELS.length;railwayStrip(a,b,0,.021,-.06,-.014,BRICK,'abutment');
        for(const o of RAILWAY_MODELS.slice(before)){
          // Replace the sloped underside with the display's ground plane.
          o.miniPlanes.set([0,0,-1,-.078],4);o.bounds[2]=.078;
        }
      }
      for(const side of [-1,1])railwayStrip(a,b,side*.021,.0014,.012,.015,GRAY,'railing');
      const start=Math.abs(Math.abs(a.x)-.15)<1e-8,end=Math.abs(Math.abs(b.x)-.15)<1e-8;
      if(k%3===0||start)post(start?railwayAtDistance(RAILWAY_ARC[k]+.0015):a);
      if(end)post(railwayAtDistance(RAILWAY_ARC[k+1]-.0015));
    }
  }
  for(const x of [-.045,.045])for(const front of [false,true]){
    const angle=Math.acos(x/.255),p=railwayPoint(front?Math.PI*2-angle:angle);
    miniBox(x,p.y,.007,.019,.062,p.z-.014,BRICK,'pier');
  }
}
function railwayTrainSolid(kind,base,hl,hw,z0,z1,offset=0,side=0) {
  let planes=[1,0,0,hl,-1,0,0,hl,0,1,0,hw,0,-1,0,hw,0,0,1,z1,0,0,-1,-z0],faces=[1,2,3,4,5,6];
  if(kind==='wheel'){
    const r=(z1-z0)/2,mid=(z1+z0)/2;planes=[0,1,0,hw,0,-1,0,hw];faces=[3,4];
    for(let k=0;k<8;k++){const a=(k+.5)*Math.PI/4,nx=Math.cos(a),nz=Math.sin(a);planes.push(nx,0,nz,r*Math.cos(Math.PI/8)+nz*mid);faces.push(nz>0?5:6);}
  }
  return {x:0,y:0,c:1,s:0,hl,hw,z0,z1,offset,side,base,kind,localPlanes:Float64Array.from(planes),miniPlanes:new Float64Array(planes.length),miniFaces:faces,bounds:new Array(6)};
}
function railwayPlace(o,pose) {
  o.pose=pose;o.c=pose.c;o.s=pose.s;
  o.x=pose.x+pose.c*pose.cp*o.offset-pose.s*o.side;
  o.y=pose.y+pose.s*pose.cp*o.offset+pose.c*o.side;
  const z=pose.z+pose.sp*o.offset,p=o.miniPlanes;
  // Transform cached local faces into window coordinates once per frame.
  const local=o.localPlanes;
  for(let k=0;k<local.length;k+=4){
    const u=local[k],v=local[k+1],w=local[k+2],nx=pose.c*(pose.cp*u-pose.sp*w)-pose.s*v,ny=pose.s*(pose.cp*u-pose.sp*w)+pose.c*v,nz=pose.sp*u+pose.cp*w;
    p[k]=nx;p[k+1]=ny;p[k+2]=nz;p[k+3]=local[k+3]+nx*o.x+ny*o.y+nz*z;
  }
  const ex=Math.abs(pose.c*pose.cp)*o.hl+Math.abs(pose.s)*o.hw+Math.abs(pose.c*pose.sp)*(o.z1-o.z0)/2;
  const ey=Math.abs(pose.s*pose.cp)*o.hl+Math.abs(pose.c)*o.hw+Math.abs(pose.s*pose.sp)*(o.z1-o.z0)/2;
  const mid=(o.z0+o.z1)/2,mx=o.x-pose.c*pose.sp*mid,my=o.y-pose.s*pose.sp*mid,mz=z+pose.cp*mid;
  const ez=Math.abs(pose.sp)*o.hl+pose.cp*(o.z1-o.z0)/2;
  o.bounds[0]=mx-ex;o.bounds[1]=my-ey;o.bounds[2]=mz-ez;o.bounds[3]=mx+ex;o.bounds[4]=my+ey;o.bounds[5]=mz+ez;
  // Keep each part's local height relative to its own pitched origin.
  o.poseZ=z;
}

// A column sees the same horizontal ray at every row. Project conservative
// bounds once, then retain only solids covering each row. Static lists survive
// unchanged camera frames; the seventeen moving solids have separate lists.
const RAILWAY_COLUMNS=[];
let railwayMotionVersion=0;
function railwayColumnRows(b,x,du,normal,d) {
  let lo=Math.max(0,b[1]),hi=b[4];
  if(Math.abs(du)<1e-12){if(x<b[0]||x>b[3])return null;}
  else{const a=(b[0]-x)/du,c=(b[3]-x)/du;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));}
  if(lo>hi)return null;
  const z0=Math.min((b[2]*normal+eye*lo)/(normal+lo),(b[2]*normal+eye*hi)/(normal+hi));
  const z1=Math.max((b[5]*normal+eye*lo)/(normal+lo),(b[5]*normal+eye*hi)/(normal+hi));
  const first=Math.max(0,Math.floor(hor-(z1-eye)*projY/d-1)),last=Math.min(rows-1,Math.ceil(hor-(z0-eye)*projY/d));
  return first<=last?[first,last]:null;
}
function railwayColumnIndex(node,x,du,normal,d,buckets) {
  if(!railwayColumnRows(node.bounds,x,du,normal,d))return;
  if(node.pieces){for(const o of node.pieces)railwayColumnPiece(o,x,du,normal,d,buckets);}
  else{railwayColumnIndex(node.left,x,du,normal,d,buckets);railwayColumnIndex(node.right,x,du,normal,d,buckets);}
}
function railwayColumnPiece(o,x,du,normal,d,buckets) {
  const span=railwayColumnRows(railwayBounds(o),x,du,normal,d);if(!span)return;
  for(let r=span[0];r<=span[1];r++)buckets[r].push(o);
}
function railwayColumnCast(i,x,z,du,dz,limit,normal,d) {
  const col=i%cols,row=(i/cols)|0;
  let cache=RAILWAY_COLUMNS[col];
  if(!cache||cache.rows!==rows)cache=RAILWAY_COLUMNS[col]={rows,static:Array.from({length:rows},()=>[]),moving:Array.from({length:rows},()=>[])};
  if(cache.x!==x||cache.du!==du||cache.normal!==normal||cache.d!==d||cache.eye!==eye||cache.hor!==hor||cache.proj!==projY){
    for(const list of cache.static)list.length=0;
    Object.assign(cache,{x,du,normal,d,eye,hor,proj:projY,version:-1});
    railwayColumnIndex(RAILWAY_TREE,x,du,normal,d,cache.static);
  }
  if(cache.version!==railwayMotionVersion){
    for(const list of cache.moving)list.length=0;
    for(const o of RAILWAY_TRAIN)railwayColumnPiece(o,x,du,normal,d,cache.moving);
    for(const o of RAILWAY_ENGINE)railwayColumnPiece(o,x,du,normal,d,cache.moving);
    for(const o of RAILWAY_WHEELS)railwayColumnPiece(o,x,du,normal,d,cache.moving);
    cache.version=railwayMotionVersion;
  }
  RAILWAY_HIT.piece=null;RAILWAY_HIT.t=limit;
  for(const o of cache.static[row])railwayTest(o,x,z,du,dz);
  for(const o of cache.moving[row])railwayTest(o,x,z,du,dz);
  return RAILWAY_HIT;
}
