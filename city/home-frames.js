// Four mitred rails share one opening. The backing, mat, photograph and glass
// occupy separate depths; the reverse has wall pads and hanging hardware.
const HOME_PHOTO_GLYPHS=new WeakMap();
function homeFrameRail(vertices,z) {
  const lo=Math.min(...vertices.map(p=>p[0])),hi=Math.max(...vertices.map(p=>p[0])),u=(lo+hi)/2;
  const points=vertices.map(([x,y])=>[x-u,y+z]),planes=[[0,1,0,.025,3],[0,-1,0,.024,4]];
  const area=points.reduce((sum,p,k)=>{const q=points[(k+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=Math.sign(area);
  for(let k=0;k<points.length;k++){
    const p=points[k],q=points[(k+1)%points.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
    const nx=(q[1]-p[1])*sign/length,nz=(p[0]-q[0])*sign/length,d=nx*p[0]+nz*p[1];
    planes.push([nx,0,nz,d,10+k]);
    // Bevel the exposed inner/outer edges, keeping the mitres joined.
    if(Math.abs(nx)<1e-8||Math.abs(nz)<1e-8)planes.push([nx,1,nz,d+.025-.006,20+k]);
  }
  const normals=Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]));
  return {u,hl:(hi-lo)/2,z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1])),planes,normals};
}
function HOME_PHOTO_FRAME(p) {
  const c=Math.cos(p.a),s=Math.sin(p.a),wood=furnitureTimber(BRICK),parts=[];
  const rails=[
    [[-.4,.3],[.4,.3],[.34,.24],[-.34,.24]],
    [[.4,.3],[.4,-.3],[.34,-.24],[.34,.24]],
    [[.4,-.3],[-.4,-.3],[-.34,-.24],[.34,-.24]],
    [[-.4,-.3],[-.4,.3],[-.34,.24],[-.34,-.24]]
  ].map(v=>homeFrameRail(v,p.z));
  const plain=(base,level)=>(i,t,L)=>{BG[i]=C(base,level+L*.24*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const backing=plain(BRICK,1.8),paper=plain(STONE,4.5),rubber=plain(GRAY,.6),metal=kitchenSteel;
  const part=(role,u,v,hl,hw,z0,z1,shade,bevel=.001)=>{
    const q={role,u,v,hl,hw,z0:p.z+z0,z1:p.z+z1,shade,profile:kitchenPanelProfile(hl,hw,p.z+z0,p.z+z1,bevel)};parts.push(q);return q;
  };
  part('backing',0,-.008,.36,.003,-.26,.26,backing);
  part('mat',0,-.004,.344,.001,-.244,.244,paper);
  for(const u of [-.365,.365])for(const z of [-.265,.265])part('wall-pad',u,-.0295,.012,.0055,z-.012,z+.012,rubber);
  for(const u of [-.35,.35])for(const z of [-.1,.1])part('retaining-tab',u,-.013,.018,.002,z-.012,z+.012,metal);
  for(const u of [-.25,.25])part('wire-anchor',u,-.0195,.015,.0085,.125,.155,metal);
  let photo=null,chars=null;
  const printHalf=.31,printHeight=.31/1.4; // retain the existing saved-photo display proportions
  const print=(i,t,L)=>{
    if(!photo){BG[i]=C(STONE,4.5+L*.2);set(i,' ',0);return true;}
    const u=clamp((HIT.u/printHalf+1)/2,0,.999),v=clamp((p.z+printHeight-HIT.w)/(2*printHeight),0,.999);
    const k=Math.floor(v*photo.h)*photo.w+Math.floor(u*photo.w),light=clamp(L/12,.25,1);
    const shade=col=>col===NONE?C(STONE,4):C(col>>4,(col&15)*light);
    BG[i]=shade(photo.bg[k]);set(i,chars[k],shade(photo.fg[k]));return true;
  };
  const glass=(i,t,L)=>{
    const glint=coveGroove(HIT.u+(HIT.w-p.z)*.7,1.3,.003,t/projX)*coveDetail(t,.5);
    if(glint<.6)return false;BG[i]=C(CYAN,2+L*.15);set(i,' ',0);return true;
  };
  return {...ROOM_MODEL(p.x,p.y,(vx,vy)=>{
    photo=homePhotos.photos.find(q=>q.id===p.photo);
    if(photo&&!HOME_PHOTO_GLYPHS.has(photo))HOME_PHOTO_GLYPHS.set(photo,Array.from(photo.chars));
    chars=photo&&HOME_PHOTO_GLYPHS.get(photo);
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    let[x,y]=at(0,.001);drawBox({...boxAt(x,y,c,s,.34,.001,p.z-.24,p.z+.24),frameRole:'glass'},glass);
    [x,y]=at(0,-.0026);drawBox({...boxAt(x,y,c,s,printHalf,.0004,p.z-printHeight,p.z+printHeight),frameRole:'print'},print);
    for(const q of parts){[x,y]=at(q.u,q.v);drawBox({...boxAt(x,y,c,s,q.hl,q.hw,q.z0,q.z1),...q.profile,frameRole:q.role},q.shade,homeRayWorktop);}
    for(const q of rails){[x,y]=at(q.u,0);drawBox({...boxAt(x,y,c,s,q.hl,.025,q.z0,q.z1),planes:q.planes,normals:q.normals,frameRole:'rail'},wood,homeRayWorktop);}
    const tube=(role,u,v,z,uu,vv,zz,r)=>{
      const[ax,ay]=at(u,v),[bx,by]=at(uu,vv);
      drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,p.z+Math.min(z,zz)-r,p.z+Math.max(z,zz)+r),ax,ay,az:p.z+z,bx,by,bz:p.z+zz,r,frameRole:role},metal,coveRayCapsule);
    };
    for(const u of [-.25,.25])tube('hanging-wire',u,-.027,.14,0,-.0305,.24,.0015);
    tube('wall-pin',0,-.033,.24,0,-.025,.24,.002);
  }),box:furnishingBox(p),radius:Math.hypot(.4,.035),walk:true,furnishingKey:p.key,photoFrame:{rails,parts,printHalf,printHeight}};
}
