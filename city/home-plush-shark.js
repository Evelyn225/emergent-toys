// The stuffed body is an ellipsoid with a flat, closed contact patch. This
// wrapper retains the common ellipsoid helper used by shops and restaurants.
function homePlushRayBody(ox,oy,oz,rx,ry,rz,b) {
 const shape=b.plushShape,t=homeRayEllipsoid(ox,oy,oz,rx,ry,rz,shape);
 if(t>.01&&oz+rz*t>=b.z0-1e-9)return t;
 if(Math.abs(rz)<1e-12)return -1;
 const floor=(b.z0-oz)/rz;if(floor<=.01)return -1;
 const x=ox+rx*floor-shape.x,y=oy+ry*floor-shape.y,u=x*shape.c+y*shape.s,v=-x*shape.s+y*shape.c;
 const center=(shape.z0+shape.z1)/2,half=(shape.z1-shape.z0)/2;
 if((u/shape.hl)**2+(v/shape.hw)**2+((b.z0-center)/half)**2>1+1e-9)return -1;
 HIT.u=u;HIT.v=v;HIT.w=b.z0;HIT.nx=HIT.ny=0;HIT.nz=-1;HIT.face=6;return floor;
}
function HOME_PLUSH_SHARK(p) {
 const c=Math.cos(p.a),s=Math.sin(p.a),base=p.z||0,parts=[],hx=.175,hy=.34,hz=.13,bodyCenter=.11;
 const cloth=(colour)=>(i,t,L)=>{
  const grain=Math.sin(HIT.u*800)*Math.sin(HIT.w*740)*.08*coveDetail(t,.08);
  BG[i]=C(colour,2.8+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain);set(i,' ',0);return true;
 };
 const blue=cloth(BLUE),black=cloth(BLACK),white=cloth(WHITE);
 const body=(i,t,L)=>{
  const z=HIT.w-base,belly=z<.095||HIT.nz<-.25;
  (belly?white:blue)(i,t,L);
  const fine=coveDetail(t,.3),footprint=t/projY;
  const mouth=HIT.v>.29&&Math.abs(HIT.u)<.075&&Math.abs(z-.115)<Math.max(.0015,footprint*.65);
  const gill=Math.abs(HIT.u)>.13&&HIT.v>.09&&HIT.v<.17&&z>.115&&z<.175;
  if(fine>.3&&mouth)BG[i]=C(BLACK,1.1+L*.08);
  else if(fine>.3&&gill&&coveGroove(HIT.v-.095,.025,.003,footprint)>.45)BG[i]=C(BLACK,1.4+L*.1);
  return true;
 };
 const ell=(role,u,v,z,hl,hw,hh,shade=blue,turn=0)=>parts.push({role,u,v,z0:base+z-hh,z1:base+z+hh,hl,hw,c:Math.cos(p.a+turn),s:Math.sin(p.a+turn),shade});
 ell('tail-neck',0,-.345,.11,.055,.09,.05);
 for(const side of [-1,1]){
  ell('tail-fin',side*.09,-.415,.105,.11,.06,.028);
  ell('side-fin',side*.1755,-.04,.085,.06,.024,.025,blue,-side*.5);
 }
 ell('dorsal-fin',0,-.09,.265,.018,.085,.085);
 // Eye centres derive from the actual body surface, seating each bead with 12mm overlap.
 const ex=.6,ey=.66,ez=Math.sqrt(1-ex*ex-ey*ey),normal=[ex/hx,ey/hy,ez/hz],len=Math.hypot(...normal);
 for(const side of [-1,1]){
  const nx=side*normal[0]/len,ny=normal[1]/len,nz=normal[2]/len;
  const u=side*ex*hx+nx*.005,v=ey*hy+ny*.005,z=bodyCenter+ez*hz+nz*.005;
  ell('eye',u,v,z,.017,.017,.017,black);
  ell('eye-glint',u+nx*.014,v+ny*.014,z+nz*.014,.0035,.0035,.0035,white);
 }
 return {...ROOM_MODEL(p.x,p.y,(vx,vy)=>{
  const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
  // Cloth pieces overlap the stuffing at their roots, so reverse views close.
  const shape=boxAt(vx,vy,c,s,hx,hy,base+bodyCenter-hz,base+bodyCenter+hz);
  drawBox({...boxAt(vx,vy,c,s,hx,hy,base,base+.24),plushShape:shape,plushRole:'body'},body,homePlushRayBody);
  for(const q of parts){const[x,y]=at(q.u,q.v);drawBox({...boxAt(x,y,q.c,q.s,q.hl,q.hw,q.z0,q.z1),plushRole:q.role},q.shade,homeRayEllipsoid);}
 }),box:furnishingBox(p),radius:Math.hypot(.24,.48),furnishingKey:p.key,plushShark:true};
}
