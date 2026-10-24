// Home palms use one cached skeleton: cane/frond joins and leaflet roots all
// share its points. Closed, flattened leaf solids retain their shape from the
// reverse. Pots, soil and saucers have separate, fitted profiles.
const HOME_PALM_POT=[[0,0],[0,.118],[.01,.128],[.24,.164],[.265,.174],[.29,.178],[.304,.171],[.31,.164],[.31,.155],[.297,.153],[.275,.156],[.032,.109],[.024,.105],[.024,0]];
const HOME_PALM_SAUCER=[[0,0],[0,.153],[.009,.18],[.014,.19],[.027,.19],[.033,.183],[.034,.176],[.024,.169],[.022,.10],[.022,0]];
const HOME_PALM_BASE=.022,HOME_PALM_SOIL=.292;
const HOME_PALM_LEAF_PROFILE=[0,.12,.30,.5,.70,.87,1].map(t=>[t,t===0||t===1?0:Math.sin(Math.PI*t)**.85]);
function homePalmLeaf(root,tip,width,seed) {
  const x=tip.x-root.x,y=tip.y-root.y,z=tip.z-root.z,length=Math.hypot(x,y,z),horizontal=Math.hypot(x,y);
  const axis=[x/length,y/length,z/length],side=[-y/horizontal,x/horizontal,0];
  const up=[-axis[2]*side[1],axis[2]*side[0],axis[0]*side[1]-axis[1]*side[0]];
  const roll=(.45+hash(seed,3,739)*.45)*(seed%2?1:-1),cr=Math.cos(roll),sr=Math.sin(roll);
  const across=side.map((v,k)=>v*cr+up[k]*sr),normal=up.map((v,k)=>v*cr-side[k]*sr);
  return {root,tip,width,seed,length,axis,across,normal,ratio:.0009/width};
}
function homePalmSkeleton(height,half,seed,angle) {
  const stems=[],fronds=[],blades=[];
  for(let k=0;k<3;k++){
    const a=angle+k*Math.PI*2/3+hash(seed,k,731)*.4,root={x:Math.cos(a)*.045,y:Math.sin(a)*.045,z:HOME_PALM_SOIL-.006};
    const crown={x:root.x*.65,y:root.y*.65,z:height*[.68,.88,.56][k]};
    stems.push({a:root,b:crown,r:.006-k*.0007});
    for(let j=0;j<3;j++){
      const az=a+j*Math.PI*2/3+.35,reach=.18+hash(k,j,seed)*.025,points=[];
      for(let n=0;n<=6;n++){
        const t=n/6;
        points.push({x:crown.x+Math.cos(az)*reach*t,y:crown.y+Math.sin(az)*reach*t,
          z:crown.z+height*.12*Math.sin(Math.PI*.78*t)-height*.06*t*t});
      }
      fronds.push(points);
      for(let n=1;n<=5;n++)for(const side of [-1,1]){
        const p=points[n],next=points[n+1],len=Math.hypot(next.x-p.x,next.y-p.y),tx=(next.x-p.x)/len,ty=(next.y-p.y)/len;
        const length=.075+.045*Math.sin(n/6*Math.PI),width=.018+.006*Math.sin(n/6*Math.PI);
        blades.push({root:p,tip:{x:p.x+tx*length*.38-ty*side*length*.86,y:p.y+ty*length*.38+tx*side*length*.86,
          z:p.z-length*.60},width,seed:k*31+j*7+n*2+side});
      }
    }
  }
  // Fit the whole crown before deriving its leaf axes. Scaling the shared
  // points (not only the leaves) preserves every stem and frond attachment.
  const points=new Set([...stems.flatMap(s=>[s.a,s.b]),...fronds.flat(),...blades.flatMap(s=>[s.root,s.tip])]);
  const c=Math.cos(angle),s=Math.sin(angle),extent=Math.max(...blades.flatMap(b=>[b.root,b.tip].flatMap(p=>[Math.abs(p.x*c+p.y*s)+b.width,Math.abs(-p.x*s+p.y*c)+b.width])));
  const fit=Math.min(1,(half-.006)/extent);
  for(const p of points){p.x*=fit;p.y*=fit;}
  const leaves=blades.map(s=>homePalmLeaf(s.root,s.tip,s.width*fit,s.seed));
  const ribs=fronds.flatMap(points=>points.slice(1).map((b,k)=>({a:points[k],b,r:.0033*(1-k*.10)})));
  return {stems,fronds,leaves,ribs};
}
// Intersect an elliptical surface of revolution in the leaf's own frame.
// Its minor radius gives real thickness; normals account for that scaling.
function homePalmRayLeaf(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.leafX,y=oy-b.leafY,z=oz-b.leafZ,a=b.axis,u=b.across,n=b.normal,q=b.ratio;
  const t=coveRayLathe(x*u[0]+y*u[1]+z*u[2],(x*n[0]+y*n[1]+z*n[2])/q,x*a[0]+y*a[1]+z*a[2],
    rx*u[0]+ry*u[1]+rz*u[2],(rx*n[0]+ry*n[1]+rz*n[2])/q,rx*a[0]+ry*a[1]+rz*a[2],b.localShape);
  if(t<0)return t;
  const nx=HIT.nx,ny=HIT.ny/q,nz=HIT.nz;
  const wx=u[0]*nx+n[0]*ny+a[0]*nz,wy=u[1]*nx+n[1]*ny+a[1]*nz,wz=u[2]*nx+n[2]*ny+a[2]*nz,length=Math.hypot(wx,wy,wz);
  HIT.leafAcross=HIT.u;HIT.leafAlong=HIT.w;HIT.w=oz+rz*t;
  HIT.nx=wx/length;HIT.ny=wy/length;HIT.nz=wz/length;HIT.face=HIT.nz>.9?5:HIT.nz<-.9?6:0;
  return t;
}
function homePalmVariant(skeleton,unit,base) {
  const pots=[['pot',HOME_PALM_BASE,HOME_PALM_POT],['saucer',0,HOME_PALM_SAUCER]];
  const high=HOME_PALM_SOIL-HOME_PALM_BASE,inner=[];
  for(let k=HOME_PALM_POT.length-2;k>=0;k--){const point=HOME_PALM_POT[k];if(point[0]>=high)break;inner.push(point);}
  const low=inner[0][0];
  pots.unshift(['soil',HOME_PALM_BASE,[[low,0],...inner,[high,kitchenProfileInnerRadius(HOME_PALM_POT,high)],[high,0]]]);
  const vessels=pots.map(([role,z,profile])=>{
    const points=profile.map(([h,r])=>[base+(h+z)*unit,r*unit]),r=Math.max(...points.map(p=>p[1]));
    return {role,box:{...boxAt(0,0,1,0,r,r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points}};
  });
  const segments=[...skeleton.stems.map(s=>({...s,role:'cane'})),...skeleton.ribs.map(s=>({...s,role:'rachis'}))].map(s=>{
    const ax=s.a.x*unit,ay=s.a.y*unit,az=base+s.a.z*unit,bx=s.b.x*unit,by=s.b.y*unit,bz=base+s.b.z*unit,r=s.r*unit;
    return {role:s.role,box:{...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r}};
  });
  const leaves=skeleton.leaves.map(s=>{
    const profile=HOME_PALM_LEAF_PROFILE.map(([t,r])=>[t*s.length*unit,r*s.width*unit]),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    const origin=[s.root.x*unit,s.root.y*unit,base+s.root.z*unit];
    for(const [t,r]of profile)for(let k=0;k<3;k++){
      const centre=origin[k]+s.axis[k]*t,extent=r*Math.hypot(s.across[k],s.ratio*s.normal[k]);
      lo[k]=Math.min(lo[k],centre-extent);hi[k]=Math.max(hi[k],centre+extent);
    }
    return {seed:s.seed,box:{...boxAt((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,1,0,(hi[0]-lo[0])/2,(hi[1]-lo[1])/2,lo[2],hi[2]),
      leafX:origin[0],leafY:origin[1],leafZ:origin[2],axis:s.axis,across:s.across,normal:s.normal,ratio:s.ratio,localShape:{x:0,y:0,profile}}};
  });
  return {vessels,segments,leaves};
}
function HOME_PALM(x,y,height=1.6,seed=x*7+y,half=.19,angle=0) {
  const skeleton=homePalmSkeleton(height,half,seed,angle),variants=new Map();let unit=1,floor=0;
  const clay=(i,t,L)=>{
    const fine=coveDetail(t,unit*.035),grain=fine?Math.sin(HIT.u/unit*570)*Math.sin((HIT.v+HIT.w-floor)/unit*530)*fine*.04:0;
    BG[i]=C(BRICK,2.6+L*.33*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain);set(i,' ',0);return true;
  };
  const soil=(i,t,L)=>{
    const fine=coveDetail(t,unit*.12),grit=fine?Math.sin(HIT.u/unit*410)*Math.sin(HIT.v/unit*370)*fine:0;
    BG[i]=C(BRICK,.8+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz)+grit*.14);set(i,' ',0);return true;
  };
  const cane=(i,t,L)=>{
    const ring=coveGroove((HIT.w-floor)/unit,.065,.002,t/projX/unit)*.6;
    BG[i]=C(GREEN,2.2+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)-ring);set(i,' ',0);return true;
  };
  const leafShades=skeleton.leaves.map(s=>{
    const tone=hash(s.seed,seed,737)*.5;return (i,t,L)=>{
      const footprint=t/projX/unit,vein=(1-smooth(clamp((Math.abs(HIT.leafAcross/unit)-.0007)/Math.max(.0007,footprint),0,1)))*Math.min(1,.0014/Math.max(.0001,footprint));
      BG[i]=C(GREEN,2.2+tone+L*.42*coveLight(HIT.nx,HIT.ny,HIT.nz)+vein*.55);set(i,' ',0);return true;
    };
  });
  const draw=(vx,vy,scale=1,base=0)=>{
    unit=scale;floor=base;const key=scale+':'+base;
    if(!variants.has(key)){if(variants.size>=2)variants.clear();variants.set(key,homePalmVariant(skeleton,scale,base));}
    const d=variants.get(key);
    for(let k=d.leaves.length-1;k>=0;k--){const b=d.leaves[k].box;drawBox({...b,x:vx+b.x,y:vy+b.y,leafX:vx+b.leafX,leafY:vy+b.leafY,plantRole:'leaf'},leafShades[k],homePalmRayLeaf);}
    for(const s of d.segments){const b=s.box;drawBox({...b,x:vx+b.x,y:vy+b.y,ax:vx+b.ax,ay:vy+b.ay,bx:vx+b.bx,by:vy+b.by,plantRole:s.role},cane,coveRayCapsule);}
    for(const p of d.vessels)drawBox({...p.box,x:vx,y:vy,plantRole:p.role},p.role==='soil'?soil:clay,coveRayLathe);
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>draw(vx,vy)),drawScaled:draw,box:boxAt(x,y,Math.cos(angle),Math.sin(angle),half,half,0,height),radius:Math.hypot(half,half),homePlant:{height,half,skeleton}};
}
function HOME_FURNISHING_PALM(p) {
  const model=HOME_PALM(p.x,p.y,1.6,p.key||1,HOME_FURNITURE.f_plant.hx,p.a);
  model.box=furnishingBox(p);model.furnishingKey=p.key;return model;
}
