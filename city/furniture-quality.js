// Shared furniture at the Cabin Cove geometry/material standard. These builders
// preserve each caller's footprint and seat height; rounded edges stay geometric.
function furnitureCloth(base) {
  return (i,t,L)=>{
    const footprint=t/projX,fine=coveDetail(t),weave=Math.sin(HIT.u*190)*Math.sin((HIT.v+HIT.w)*190)*.12*fine;
    const seam=coveGroove(HIT.u,.44,.002,footprint)*.3;
    BG[i]=C(base,2.2+L*.36*coveLight(HIT.nx,HIT.ny,HIT.nz)+weave-seam);set(i,' ',0);return true;
  };
}
function drawFurnitureSofa(vx,vy,hl,fx,fy,col=BRICK,seat=.48) {
  const c=-fy,s=fx,cloth=furnitureCloth(col),at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
  const part=(u,v,hx,hy,z0,z1,rad,mat='wood')=>{const[x,y]=at(u,v);coveRound(x,y,c,s,hx,hy,z0,z1,rad,mat);};
  for(const u of [-hl+.15,hl-.15])for(const v of [-.27,.27])part(u,v,.045,.045,0,.16,.018);
  part(0,0,hl-.04,.37,.12,seat-.18,.035);
  const count=hl>1.3?3:2,inside=hl-.18,width=inside/count;
  for(let k=0;k<count;k++) {
    const u=-inside+width*(2*k+1);
    part(u,.035,width-.012,.335,seat-.18,seat,.065,cloth);
    part(u,-.32,width-.012,.07,seat-.015,.94,.06,cloth);
  }
  // Arm pads join the base and rear bolster rather than ending inside the seat.
  for(const sign of [-1,1])part(sign*(hl-.085),0,.085,.39,seat-.2,.73,.065,cloth);
}
function drawFurnitureChair(vx,vy,fx,fy,col=BRICK) {
  const c=-fy,s=fx,at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
  const part=(u,v,hx,hy,z0,z1,rad,mat='wood')=>{const[x,y]=at(u,v);coveRound(x,y,c,s,hx,hy,z0,z1,rad,mat);};
  for(const u of [-.23,.23])for(const v of [-.23,.23])part(u,v,.035,.035,0,v<0?1.12:.42,.012);
  for(const u of [-.23,.23])part(u,0,.024,.23,.18,.225,.008);
  for(const v of [-.23,.23])part(0,v,.23,.025,.34,.42,.01);
  part(0,0,.3,.3,.42,.5,.035,furnitureCloth(col));
  for(const z of [.79,1.025])part(0,-.255,.265,.035,z-.075,z+.075,.025);
}
function drawFurnitureTable(vx,vy,hl=.6,hw=.4,height=.78) {
  const legX=Math.max(.055,hl-.11),legY=Math.max(.055,hw-.11),under=height-.06;
  for(const x of [-legX,legX])for(const y of [-legY,legY])coveRound(vx+x,vy+y,1,0,.042,.042,0,under,.014,'wood');
  for(const y of [-legY,legY])coveRound(vx,vy+y,1,0,legX,.026,under-.12,under,.01,'wood');
  for(const x of [-legX,legX])coveRound(vx+x,vy,1,0,.026,legY,under-.12,under,.01,'wood');
  coveRound(vx,vy,1,0,hl,hw,under,height,.023,(i,t,L)=>{
    coveTimber(i,HIT.u,HIT.v,L,t,HIT.nx,HIT.ny,HIT.nz,3);
    if(HIT.face===5){const joint=coveGroove(HIT.v+hw,.24,.003,t/projX);BG[i]=C(BRICK,(BG[i]&15)-joint*.7);}
    return true;
  });
}
