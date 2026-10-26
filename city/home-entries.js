// Private apartment entrances use a fitted opaque leaf, not the shop's glass
// exit painter. The existing D cells and E exit remain the source of collision
// and interaction; these pieces sit on their inner wall face.
const HOME_ENTRY_STYLES = [
  { width:.98, leaf:BLUE, frame:BRICK, metal:GRAY, timber:true },
  { width:1.08, leaf:GRAY, frame:GRAY, metal:GRAY },
  { width:1.18, leaf:STONE, frame:WHITE, metal:YEL },
];
function HOME_ENTRY_DOOR(r) {
  const tier=r.def.tier,style=HOME_ENTRY_STYLES[tier],half=style.width/2,leafHalf=half-.004;
  const parts=[],c=-1,s=0,at=(u,v)=>[-u,-v],frontLight=coveLight(0,-1,0);
  const paint=(col,base=2.4)=>(i,t,L,light=coveLight(HIT.nx,HIT.ny,HIT.nz))=>{BG[i]=C(col,base+L*.30*light);set(i,' ',0);return true;};
  const leaf=paint(style.leaf),panel=paint(style.leaf,1.0),frame=style.timber?(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,17):paint(style.frame,tier===2?4.4:3.4);
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,style.metal),shadow=paint(BLACK);
  const add=(role,local,material,ray=rayBox)=>{
    const shade=ray===rayBox?(i,t,L)=>{
      const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;
      HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;
      // A millimetre-deep rail edge must not sparkle as separate bright cells
      // once its projected face is smaller than a pixel. Retain its real
      // surface/normal, filtering only the unresolved lighting contrast.
      const coverage=f>4?smooth(clamp(Math.abs(eye-HIT.w)*2*local.hw*projY/(t*t)-.5,0,1)):1;
      return material(i,t,L,frontLight+(coveLight(HIT.nx,HIT.ny,HIT.nz)-frontLight)*coverage);
    }:material;
    const p={role,local,view:{...local},shade,ray};parts.push(p);return p;
  };
  const box=(role,u,v,hl,hw,z0,z1,material,round=0)=>add(role,{...boxAt(...at(u,v),c,s,hl,hw,z0,z1),...(round?{round}:null)},material,round?coveRayRounded:rayBox);
  const tube=(role,A,B,radius)=>{
    const [u,v,az]=A,[uu,vv,bz]=B,[ax,ay]=at(u,v),[bx,by]=at(uu,vv);
    const p=add(role,{...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+radius,Math.abs(by-ay)/2+radius,Math.min(az,bz)-radius,Math.max(az,bz)+radius),ax,ay,az,bx,by,bz,r:radius},metal,coveRayCapsule);
    p.moved=(ox,oy,oz,rx,ry,rz,b)=>{
      const x=b.x-p.local.x,y=b.y-p.local.y,t=coveRayCapsule(ox-x,oy-y,oz,rx,ry,rz,p.local);
      if(t>=0){HIT.u+=x;HIT.v+=y;}return t;
    };
  };
  // A black rebate backs the millimetre leaf gaps. Horizontal members own the
  // frame corners; the jambs meet the threshold and head without coplanar caps.
  box('rebate',0,.008,half,.008,.035,2.19,shadow);
  box('threshold',0,.060,half+.09,.060,0,.035,metal,.006);
  for(const e of [-1,1])box('jamb',e*(half+.045),.040,.045,.040,.035,2.19,frame);
  box('head',0,.040,half+.09,.040,2.19,2.28,frame);
  // One closed back supports recessed panels between separate stiles/rails.
  box('leaf',0,.027,leafHalf,.016,.038,2.18,leaf);
  for(const e of [-1,1])box('stile',e*(leafHalf-.045),.049,.045,.014,.038,2.18,leaf);
  for(const [lo,hi]of [[.038,.18],[.95,1.10],[2.05,2.18]])box('rail',0,.049,leafHalf-.09,.014,lo,hi,leaf);
  for(const [lo,hi]of [[.205,.925],[1.125,2.025]]){
    const inner=leafHalf-.105;
    box('panel',0,.0435,inner,.0045,lo,hi,panel);
  }
  // Hinge plates bridge the reveal into the jamb; closed barrels touch their
  // plates. The lever has an attached rose/post and real space for fingers.
  for(const z of [.30,1.0,1.85]){
    box('hinge-plate',-half+.005,.068,.040,.005,z,z+.08,metal,.002);
    const [x,y]=at(-half+.015,.081),profile=[[z,0],[z,.009],[z+.08,.009],[z+.08,0]];
    add('hinge-barrel',{...boxAt(x,y,1,0,.009,.009,z,z+.08),profile},metal,coveRayLathe);
  }
  const handle=half-.060;
  box('handle-plate',handle,.070,.025,.007,1.015,1.145,metal,.006);
  tube('handle-post',[handle,.077,1.07],[handle,.122,1.07],.0115);
  tube('handle-grip',[handle,.122,1.07],[handle-.13,.122,1.07],.0115);
  return {...ROOM_MODEL(r.def.entry[0],r.H-1,(vx,vy)=>{
    for(const p of parts){const b=p.view;b.x=vx+p.local.x;b.y=vy+p.local.y;drawBox(b,p.shade,p.moved||p.ray);}
  }),radius:half+.25,homeEntry:{tier,width:style.width,half,leafHalf,parts}};
}
