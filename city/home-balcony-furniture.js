// A small Belle bistro set, authored once in metres and reused on the actual
// city balcony. This is home-only: shared restaurant/shop furniture is intact.
function HOME_BALCONY_FURNITURE(x,y,kind,fx=0,fy=1){
  const chair=kind==='chair',c=chair?-fy:1,s=chair?fx:0,parts=[],variants=new Map();
  // Furniture's v axis points toward its occupant's facing direction. It is
  // the reverse of the box ray's perpendicular axis (symmetric for a box).
  const xy=(u,v)=>chair?[c*u+fx*v,s*u+fy*v]:[u,v];
  const block=(role,u,v,hl,hw,z0,z1,round,material)=>{
    const[x,y]=xy(u,v);parts.push({role,material,box:{...boxAt(x,y,c,s,hl,hw,z0,z1),round}});
  };
  const tube=(role,A,B,r)=>{
    const[u,v,az]=A,[uu,vv,bz]=B,[ax,ay]=xy(u,v),[bx,by]=xy(uu,vv);
    parts.push({role,material:'metal',tube:true,box:{...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r}});
  };
  if(chair){
    const foot=.26,shoulder=.25,lo=.018,hi=.437,r=.018;
    for(const u of [-1,1])for(const v of [-1,1])tube('leg',[u*foot,v*foot,lo],[u*shoulder,v*shoulder,hi],r);
    const brace=foot+(shoulder-foot)*(.2-lo)/(hi-lo);
    for(const e of [-1,1]){
      tube('stretcher',[e*brace,-brace,.2],[e*brace,brace,.2],.011);
      tube('stretcher',[-brace,e*brace,.2],[brace,e*brace,.2],.011);
      block('seat-frame',e*.265,0,.025,.29,.405,.455,.007,'paint');
      block('seat-frame',0,e*.265,.24,.025,.405,.455,.007,'paint');
      tube('back-post',[e*.26,-.265,.43],[e*.26,-.265,1.0],.016);
    }
    // The pressed pan supports the slats and stops unresolved gaps exposing
    // a checkerboard of ground pixels at ordinary standing distance.
    // Its edge meets the inner frame face, so their exposed tops never
    // overlap in the same plane between the slats.
    block('seat-pan',0,0,.24,.24,.44,.455,.004,'paint');
    for(const v of [-.19,0,.19])block('seat-slat',0,v,.29,.085,.455,.5,.008,'paint');
    const arc=[[-.26,1],[-.20,1.07],[0,1.10],[.20,1.07],[.26,1]];
    for(let k=1;k<arc.length;k++)tube('back-arch',[arc[k-1][0],-.265,arc[k-1][1]],[arc[k][0],-.265,arc[k][1]],.016);
    tube('back-rail',[-.26,-.265,.62],[.26,-.265,.62],.014);
    for(const u of [-.13,0,.13]){
      const k=arc.findIndex((p,j)=>j&&u<=p[0]),a=arc[k-1],b=arc[k],top=a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]);
      tube('back-picket',[u,-.265,.62],[u,-.265,top],.011);
    }
  }else{
    block('tabletop',0,0,.65,.5,.72,.78,.018,'wood');
    for(const e of [-1,1]){
      block('apron',0,e*.37,.52,.026,.60,.72,.008,'wood');
      block('apron',e*.52,0,.026,.344,.60,.72,.008,'wood');
    }
    for(const u of [-1,1])for(const v of [-1,1])tube('leg',[u*.55,v*.40,.022],[u*.52,v*.37,.698],.022);
  }
  function variant(scale,base){
    const key=scale+':'+base;let v=variants.get(key);
    if(!v){
      if(variants.size>=2)variants.clear();
      const topLight=coveLight(0,0,1),paint=(i,t,L,seat=false)=>{
        const light=coveLight(HIT.nx,HIT.ny,HIT.nz);
        // Subcell bevel sides otherwise become scattered dark cells across
        // a thin white seat. Average their light into the top while viewed
        // from above; preserve the rounded shading once it resolves nearby.
        const resolve=seat&&eye>base+.5*scale?smooth(clamp((.008*scale*Math.min(projX,projY)/t-.35)/.65,0,1)):1;
        BG[i]=C(WHITE,3+L*.3*(resolve===1?light:topLight+(light-topLight)*resolve));set(i,' ',0);return true;
      };
      const wood=(i,t,L)=>coveTimber(i,HIT.u/scale,(HIT.v+HIT.w-base)/scale,L,t/scale,HIT.nx,HIT.ny,HIT.nz,3);
      const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,chair?WHITE:GRAY);
      const lineShade=(i,t,L)=>{BG[i]=C(chair?WHITE:GRAY,2.5+L*.16);set(i,' ',0);return true;};
      v=parts.map(p=>{
        const a=p.box,b=boxAt(a.x*scale,a.y*scale,a.c,a.s,a.hl*scale,a.hw*scale,base+a.z0*scale,base+a.z1*scale);
        if(p.tube)Object.assign(b,{ax:a.ax*scale,ay:a.ay*scale,az:base+a.az*scale,bx:a.bx*scale,by:a.by*scale,bz:base+a.bz*scale,r:a.r*scale});
        else b.round=a.round*scale;
        const seat=p.role==='seat-slat'||p.role==='seat-pan';
        return {role:p.role,local:b,view:{...b},ray:p.tube?coveRayCapsule:coveRayRounded,shade:p.material==='wood'?wood:p.material==='paint'?(seat?(i,t,L)=>paint(i,t,L,true):paint):metal,lineShade,tube:!!p.tube};
      });variants.set(key,v);
    }return v;
  }
  function draw(vx,vy,scale=1,base=0){
    for(const p of variant(scale,base)){
      const b=p.view,q=p.local;b.x=vx+q.x;b.y=vy+q.y;
      if(p.tube){b.ax=vx+q.ax;b.ay=vy+q.ay;b.bx=vx+q.bx;b.by=vy+q.by;}
      const thin=p.tube&&2*b.r*Math.min(projX,projY)/Math.max(.05,dx*b.x+dy*b.y)<1.5;
      drawBox(b,thin?p.lineShade:p.shade,thin?rayRod:p.ray);
    }
  }
  const hl=chair?.31:.65,hw=chair?.31:.5,height=chair?1.12:.78;
  return {...ROOM_MODEL(x,y,(vx,vy)=>draw(vx,vy),[hl,hw,height]),radius:Math.hypot(hl,hw),drawScaled:draw,
    homeBalconyFurniture:{kind,parts,variants},...(chair?{seat:true,fx,fy,h:.5}:null)};
}
function homeBalconyDining(r){
  return r.def.balcony?[
    HOME_BALCONY_FURNITURE(22.3,6,'table'),
    HOME_BALCONY_FURNITURE(22.3,7.2,'chair',0,-1),
    HOME_BALCONY_FURNITURE(22.3,4.8,'chair',0,1),
  ]:[];
}
