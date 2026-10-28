// Hotel-only round coffee tables. Closed feet meet the floor and their turned
// legs end on the same underside; the suite's stone sits in a real rim recess.
function hotelCoffeeRay(ox,oy,oz,rx,ry,rz,b) {
  let cap=rz<0&&oz>b.z1+1e-8?b.tableCaps.top:rz>0&&oz<b.z0-1e-8?b.tableCaps.bottom:null;
  if(cap){
    let t=(cap.z-oz)/rz,u=ox-b.x+rx*t,v=oy-b.y+ry*t,r2=u*u+v*v;
    const recess=b.tableCaps.recess;
    if(cap===b.tableCaps.top&&recess&&r2<cap.min2-1e-9){
      const tb=(recess.z-oz)/rz,ub=ox-b.x+rx*tb,vb=oy-b.y+ry*tb;
      // A segment with both ends inside this cylindrical hole cannot strike
      // its side. The recessed floor is then the first actual surface.
      if(ub*ub+vb*vb<cap.min2-1e-9){cap=recess;t=tb;u=ub;v=vb;r2=u*u+v*v;}
    }
    // Stay away from profile joins: their tie-breaking belongs to the exact
    // curved ray. An exposed extremal cap is otherwise always the first hit.
    if(t>.01&&r2>cap.min2+1e-9&&r2<cap.max2-1e-9){
      HIT.u=u;HIT.v=v;HIT.w=cap.z;HIT.nx=HIT.ny=0;HIT.nz=cap.nz;HIT.face=cap.nz>0?5:6;HIT.part=cap.part;return t;
    }
  }
  // Conservative outer cylinder: reject rays outside the round silhouette
  // before considering every bevel/profile segment. Padding retains ties.
  const x=ox-b.x,y=oy-b.y,aa=rx*rx+ry*ry,rr=b.hl+1e-7;let lo=.01,hi=Infinity;
  if(aa>1e-16){const dot=x*rx+y*ry,disc=dot*dot-aa*(x*x+y*y-rr*rr);if(disc<0)return -1;const root=Math.sqrt(disc);lo=Math.max(lo,(-dot-root)/aa);hi=Math.min(hi,(-dot+root)/aa);}
  else if(x*x+y*y>rr*rr)return -1;
  if(Math.abs(rz)>1e-16){const a=(b.z0-1e-7-oz)/rz,z=(b.z1+1e-7-oz)/rz;lo=Math.max(lo,Math.min(a,z));hi=Math.min(hi,Math.max(a,z));}
  else if(oz<b.z0-1e-7||oz>b.z1+1e-7)return -1;
  if(hi<lo)return -1;
  return coveRayLathe(ox,oy,oz,rx,ry,rz,b);
}
function HOTEL_COFFEE_TABLE(x,y,tier) {
  const parts=[],wood=furnitureTimber(BRICK);
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,tier===2?YEL:GRAY);
  const rubber=(i,t,L)=>{BG[i]=C(GRAY,.6+L*.10*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const stone=(i,t,L)=>{BG[i]=C(STONE,2.7+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const part=(role,u,v,profile,shade)=>{
    const q=homeLampPart(role,0,profile),caps={top:null,bottom:null};
    for(let k=1;k<profile.length;k++){const[a,ra]=profile[k-1],[z,rb]=profile[k];if(a!==z)continue;const nz=ra>rb?1:-1,key=nz>0?'top':'bottom';if(z===(nz>0?q.box.z1:q.box.z0))caps[key]={z,nz,part:k,min2:Math.min(ra,rb)**2,max2:Math.max(ra,rb)**2};}
    const top=caps.top,wall=top&&profile[top.part+1],floor=top&&profile[top.part+2];
    if(top?.min2>0&&wall&&floor&&wall[1]**2===top.min2&&floor[1]===0&&wall[0]===floor[0]&&wall[0]<top.z)caps.recess={z:wall[0],nz:1,part:top.part+2,min2:0,max2:top.min2};
    q.box.tableCaps=caps;q.box.x=u;q.box.y=v;q.view={...q.box};q.shade=shade;parts.push(q);return q;
  };
  if(tier===2){
    part('stone',0,0,[[.444,0],[.444,.449],[.448,.449],[.46,.445],[.46,0]],stone);
    part('top',0,0,[[.4,0],[.4,.50],[.41,.52],[.45,.52],[.46,.50],[.46,.45],[.444,.45],[.444,0]],wood);
  }else part('top',0,0,[[.4,0],[.4,.50],[.41,.52],[.45,.52],[.46,.50],[.46,0]],wood);
  for(const u of [-.27,.27])for(const v of [-.27,.27]){
    part('leg',u,v,[[.012,0],[.012,.025],[.377,.03],[.385,.05],[.4,.05],[.4,0]],metal);
    part('foot',u,v,[[0,0],[0,.031],[.01,.031],[.012,.025],[.012,0]],rubber);
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const p of parts){p.view.x=vx+p.box.x;p.view.y=vy+p.box.y;drawBox(p.view,p.shade,hotelCoffeeRay);}},[.52,.52,.46]),
    radius:.74,hotelCoffee:{tier,parts}};
}
