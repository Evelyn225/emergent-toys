// Belle's permanent open balcony leaves use the same measured model indoors
// and in the city. Clear panes keep the existing live neighbourhood view;
// their thin leaf colliders include the glass, never the open doorway.
function homeFrenchDoors(r){
  const p=r.def.frenchDoor;if(!p)return [];
  const x=p.wall,y=(p.start+p.end)/2,half=(p.end-p.start)/2,parts=[],variants=new Map(),props=[];
  const paint=(i,t,L)=>{BG[i]=C(WHITE,3.5+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const panel=(i,t,L)=>{BG[i]=C(WHITE,2.1+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const box=(role,u,v,hl,hw,z0,z1,material=paint)=>parts.push({role,box:boxAt(u,v,1,0,hl,hw,z0,z1),material});
  const tube=(role,A,B,radius)=>{
    const[ax,ay,az]=A,[bx,by,bz]=B;
    parts.push({role,box:{...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+radius,Math.abs(by-ay)/2+radius,Math.min(az,bz)-radius,Math.max(az,bz)+radius),ax,ay,az,bx,by,bz,r:radius},material:metal});
  };
  // The head owns the casing corners. The stiles end at its underside.
  for(const e of [-1,1])box('casing-jamb',.035,e*(half+.035),.035,.055,0,p.top);
  box('casing-head',.035,0,.035,half+.09,p.top,p.top+.10);
  const hinge=.045,length=half-.06,end=hinge+length,z0=.035,z1=p.top-.06;
  for(const e of [-1,1]){
    const v=e*(half-.045),mid=(hinge+end)/2;
    for(const u of [hinge+.04,end-.04])box('leaf-stile',u,v,.04,.025,z0,z1);
    for(const [lo,hi]of [[z0,.17],[.70,.80],[z1-.10,z1]])box('leaf-rail',mid,v,length/2-.08,.025,lo,hi);
    box('recessed-panel',mid,v,length/2-.08,.014,.17,.70,panel);
    // Two by two clear lights, with real narrow glazing bars, not painted
    // opaque blue rectangles. Rails/stiles own all corner junctions.
    box('glazing-bar',mid,v,.013,.023,.80,z1-.10);
    const paneHalf=(length/2-.08-.013)/2;
    for(const side of [-1,1])box('glazing-bar',mid+side*(paneHalf+.013),v,paneHalf,.023,1.77,1.80);
    for(const z of [.25,1.25,2.55]){
      box('hinge-plate',hinge-.008,e*(half-.018),.045,.009,z-.04,z+.04,metal);
      tube('hinge-barrel',[hinge,e*(half-.028),z-.045],[hinge,e*(half-.028),z+.045],.012);
    }
    // Lever, rose and connecting post leave a small real finger gap. They
    // project only five centimetres into the opening, clear of the route.
    const u=end-.11,front=v-e*.025;
    box('handle-rose',u,front-e*.005,.025,.005,1.03,1.13,metal);
    tube('handle-post',[u,front-e*.01,1.08],[u,front-e*.05,1.08],.009);
    tube('handle-grip',[u,front-e*.05,1.08],[u-.12,front-e*.05,1.08],.009);
    const b=boxAt(x+mid,y+v,1,0,length/2,.025,z0,z1);
    props.push({box:b,draw:()=>{},homeFrenchDoorSolid:true});
  }
  function variant(scale,base){
    const key=scale+':'+base;let v=variants.get(key);
    if(!v){
      if(variants.size>=2)variants.clear();
      v=parts.map(part=>{
        const a=part.box,b=boxAt(a.x*scale,a.y*scale,1,0,a.hl*scale,a.hw*scale,base+a.z0*scale,base+a.z1*scale),tube=a.ax!==undefined;
        if(tube)Object.assign(b,{ax:a.ax*scale,ay:a.ay*scale,az:base+a.az*scale,bx:a.bx*scale,by:a.by*scale,bz:base+a.bz*scale,r:a.r*scale});
        const shade=tube?part.material:(i,t,L)=>{
          const f=HIT.face;HIT.nx=f===1?1:f===2?-1:0;HIT.ny=f===3?1:f===4?-1:0;HIT.nz=f===5?1:f===6?-1:0;
          return part.material(i,t,L);
        };
        return {role:part.role,local:b,view:{...b},ray:tube?coveRayCapsule:rayBox,shade,tube};
      });variants.set(key,v);
    }return v;
  }
  function draw(vx,vy,scale=1,base=0){
    for(const q of variant(scale,base)){
      const b=q.view,a=q.local;b.x=vx+a.x;b.y=vy+a.y;
      if(q.tube){b.ax=vx+a.ax;b.ay=vy+a.ay;b.bx=vx+a.bx;b.by=vy+a.by;}
      drawBox(b,q.shade,q.ray);
    }
  }
  const model={...ROOM_MODEL(x,y,(vx,vy)=>draw(vx,vy)),drawScaled:draw,radius:half+length,homeFrenchDoor:{parts,variants,opening:p}};
  // The metre-wide native wall needs a closed head and depth reveals. City
  // walls supply their own mass; don't project this infill onto the balcony.
  const plaster=(i,t,L,b)=>{
    const f=HIT.face,u=f===1||f===2?b.y+HIT.v:b.x+HIT.u;
    const light=Math.max(0,1-t/vis)*(f===3||f===4?10:14)*r.def.light;
    return homeWall(i,u,t/projX,HIT.w,t,Math.floor(b.x),Math.floor(b.y),light);
  };
  const surround=(role,b,material)=>{
    const view={...b},shade=(i,t,L)=>{
      if(role==='infill'&&(HIT.face===3||HIT.face===4))return false;
      const f=HIT.face;HIT.nx=f===1?1:f===2?-1:0;HIT.ny=f===3?1:f===4?-1:0;HIT.nz=f===5?1:f===6?-1:0;
      return material(i,t,L,b);
    };
    props.push({...ROOM_MODEL(b.x,b.y,(vx,vy)=>{view.x=vx;view.y=vy;drawBox(view,shade);}),box:b,homeFrenchDoorSurround:role,radius:half+.1});
  };
  surround('infill',boxAt(x+p.thickness/2,y,1,0,p.thickness/2,half,p.top,r.def.height),plaster);
  for(const e of [-1,1]){
    surround('reveal',boxAt(x+p.thickness/2,y+e*(half-.01),1,0,p.thickness/2,.01,0,p.top),paint);
    surround('inner-jamb',boxAt(x-.035,y+e*(half+.035),1,0,.035,.055,0,p.top),paint);
    surround('outer-jamb',boxAt(x+p.thickness+.035,y+e*(half+.035),1,0,.035,.055,0,p.top),paint);
  }
  for(const face of [x-.035,x+p.thickness+.035])surround('native-head',boxAt(face,y,1,0,.035,half+.09,p.top,p.top+.10),paint);
  return [model,...props];
}
