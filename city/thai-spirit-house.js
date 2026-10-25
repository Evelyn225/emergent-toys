// The roof panels share one folded profile. Gables meet its underside; the
// garland and blossoms share seven points, attached to the real tray face.
function spiritPrism(vertices,depth) {
  const lo=Math.min(...vertices.map(p=>p[0])),hi=Math.max(...vertices.map(p=>p[0])),u=(lo+hi)/2,points=vertices.map(([x,z])=>[x-u,z]);
  const area=points.reduce((sum,p,k)=>{const q=points[(k+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=Math.sign(area),planes=[[0,1,0,depth,3],[0,-1,0,depth,4]];
  for(let k=0;k<points.length;k++){
    const a=points[k],b=points[(k+1)%points.length],n=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])*sign/n,nz=(a[0]-b[0])*sign/n;
    planes.push([nx,0,nz,nx*a[0]+nz*a[1],10+k]);
  }
  return {u,hl:(hi-lo)/2,hw:depth,z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1])),planes,normals:Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]))};
}
function THAI_SPIRIT_HOUSE(x,y) {
  const parts=[],vessels=[],pipes=[],flowers=[],roof=[[-.255,1.67],[-.204,1.64],[0,1.82],[.204,1.64],[.255,1.67]],sheet=.018;
  const flat=(col,level)=>(i,t,L)=>{BG[i]=C(col,level+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const gold=flat(YEL,3.4),paint=flat(RED,2.4),dark=flat(BRICK,1.2),stone=flat(WHITE,3.6),orange=flat(ORANGE,4.3),yellow=flat(YEL,4.6);
  const panel=(role,u,v,hl,hw,z0,z1,shade,bevel=.003)=>parts.push({role,u,v,box:boxAt(0,0,1,0,hl,hw,z0,z1),profile:kitchenPanelProfile(hl,hw,z0,z1,Math.min(bevel,hl*.7,hw*.7)),shade});
  const prism=(role,v,vertices,depth,shade)=>{const p=spiritPrism(vertices,depth);parts.push({role,u:p.u,v,box:boxAt(0,0,1,0,p.hl,p.hw,p.z0,p.z1),profile:{planes:p.planes,normals:p.normals},shade});};
  const lathe=(role,u,v,z,profile,shade)=>{const p=homeLampPart(role,z,profile);vessels.push({...p,u,v,shade});};
  const pipe=(role,u,v,z,uu,vv,zz,r,shade=gold)=>pipes.push({role,ax:u,ay:v,az:z,bx:uu,by:vv,bz:zz,r,shade});
  lathe('pedestal',0,0,0,[[0,0],[0,.10],[.025,.13],[.07,.13],[.105,.07],[.16,.048],[1.18,.048],[1.23,.065],[1.28,.10],[1.35,.10],[1.35,0]],stone);
  panel('tray',0,0,.28,.22,1.35,1.4,gold,.009);
  panel('floor',0,0,.17,.14,1.4,1.44,gold);
  panel('back',0,-.119,.145,.006,1.44,1.61,dark);
  for(const side of [-1,1]){
    panel('side',side*.15,0,.006,.115,1.44,1.61,paint);
    for(const v of [-.115,.115])lathe('post',side*.145,v,1.44,[[0,0],[0,.013],[.014,.013],[.025,.009],[.155,.009],[.18,.013],[.18,0]],gold);
    panel('lintel',0,side*.12,.17,.014,1.60,1.64,gold);
    prism('gable',side*.12,[[-.204,1.64],[.204,1.64],[0,1.82]],.012,paint);
  }
  for(let k=1;k<roof.length;k++){
    const a=roof[k-1],b=roof[k];prism('roof',0,[a,b,[b[0],b[1]+sheet],[a[0],a[1]+sheet]],.205,paint);
    for(const v of [-.205,.205])pipe('roof-trim',a[0],v,a[1]+sheet,b[0],v,b[1]+sheet,.006);
  }
  pipe('ridge',0,-.205,1.82+sheet,0,.205,1.82+sheet,.006);
  for(const v of [-.205,.205])for(const side of [-1,1])pipe('eave-tip',side*.255,v,1.67+sheet,side*.263,v,1.73,.004);
  lathe('finial',0,0,1.82+sheet,[[0,0],[0,.021],[.008,.024],[.02,.016],[.035,.013],[.05,.018],[.065,.012],[.142,0]],gold);
  panel('altar',0,-.03,.055,.045,1.44,1.465,dark);
  lathe('figurine',0,-.03,1.465,[[0,0],[0,.023],[.007,.023],[.015,.014],[.04,.011],[.05,.016],[.064,.012],[.07,0]],gold);
  for(const u of [-.205,.205])lathe('offering-cup',u,.145,1.4,[[0,0],[0,.018],[.008,.018],[.04,.025],[.045,.025],[.045,.021],[.012,.015],[.008,0]],gold);
  const garland=Array.from({length:7},(_,k)=>({u:-.25+k/6*.5,v:.237,z:1.385-Math.sin(k/6*Math.PI)*.052}));
  for(let k=0;k<garland.length;k++){
    const p=garland[k];flowers.push({u:p.u,v:p.v,z:p.z,r:.011,shade:yellow});
    for(let j=0;j<5;j++){const a=j*TAU/5+k*.41;flowers.push({u:p.u+Math.sin(a)*.009,v:p.v+.002,z:p.z+Math.cos(a)*.009,r:.007,shade:orange});}
    if(k){const a=garland[k-1];pipe('garland-thread',a.u,a.v,a.z,p.u,p.v,p.z,.0018,dark);}
  }
  for(const p of [garland[0],garland.at(-1)])pipe('garland-pin',p.u,.219,p.z,p.u,p.v,p.z,.003);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const p of flowers)drawBox({...boxAt(vx+p.u,vy+p.v,1,0,p.r,p.r,p.z-p.r,p.z+p.r),spiritRole:'flower'},p.shade,homeRayEllipsoid);
    for(const p of pipes){const ax=vx+p.ax,ay=vy+p.ay,bx=vx+p.bx,by=vy+p.by,r=p.r;
      drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(p.az,p.bz)-r,Math.max(p.az,p.bz)+r),ax,ay,az:p.az,bx,by,bz:p.bz,r,spiritRole:p.role},p.shade,coveRayCapsule);
    }
    for(const p of vessels)drawBox({...p.box,x:vx+p.u,y:vy+p.v,spiritRole:p.role},p.shade,coveRayLathe);
    for(let k=parts.length-1;k>=0;k--){const p=parts[k];drawBox({...p.box,x:vx+p.u,y:vy+p.v,...p.profile,spiritRole:p.role},p.shade,homeRayWorktop);}
  }),box:boxAt(x,y,1,0,.285,.27,0,1.98),radius:.4,spiritHouse:{roof,sheet,garland}};
}
