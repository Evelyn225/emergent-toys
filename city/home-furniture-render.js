function homeRayEllipsoid(ox,oy,oz,rx,ry,rz,b) {
  const z=(b.z0+b.z1)/2,h=(b.z1-b.z0)/2,x=ox-b.x,y=oy-b.y;
  const u=(x*b.c+y*b.s)/b.hl,v=(-x*b.s+y*b.c)/b.hw,w=(oz-z)/h,du=(rx*b.c+ry*b.s)/b.hl,dv=(-rx*b.s+ry*b.c)/b.hw,dw=rz/h;
  const a=du*du+dv*dv+dw*dw,q=u*du+v*dv+w*dw,disc=q*q-a*(u*u+v*v+w*w-1);if(disc<0)return -1;
  const t=(-q-Math.sqrt(disc))/a;if(t<.01)return -1;
  HIT.u=(u+du*t)*b.hl;HIT.v=(v+dv*t)*b.hw;HIT.w=oz+rz*t;
  const nx=(u+du*t)/b.hl,ny=(v+dv*t)/b.hw,nz=(w+dw*t)/h,n=Math.hypot(nx,ny,nz);
  HIT.nx=(nx*b.c-ny*b.s)/n;HIT.ny=(nx*b.s+ny*b.c)/n;HIT.nz=nz/n;HIT.face=0;return t;
}
function homePlushShark(vx,vy,c,s,zBase=0) {
  const ell=(x,y,z,hx,hy,hz,base)=>drawBox(boxAt(vx+c*x-s*y,vy+s*x+c*y,c,s,hx,hy,zBase+z-hz,zBase+z+hz),(i,t,L)=>{BG[i]=C(base,2.5+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;},homeRayEllipsoid);
  ell(0,0,.18,.19,.38,.17,BLUE);ell(0,.2,.115,.165,.23,.09,WHITE);
  for(const side of [-1,1]){ell(side*.2,0,.14,.14,.08,.035,BLUE);ell(side*.115,-.37,.15,.14,.1,.04,BLUE);ell(side*.14,.27,.24,.027,.027,.027,BLACK);ell(side*.148,.282,.25,.009,.009,.009,WHITE);}
  ell(0,-.08,.34,.035,.13,.14,BLUE);
}
function furnishingProp(p,r) {
  if(p.id==='sharkplush')return HOME_PLUSH_SHARK(p);
  if(p.id==='f_lamp')return HOME_FLOOR_LAMP(p);
  if(p.id==='f_recordplayer')return HOME_RECORD_PLAYER(p);
  if(p.id==='f_frame')return HOME_PHOTO_FRAME(p);
  if(p.id==='f_clock')return HOME_WALL_CLOCK(p);
  if(p.id==='f_plant')return HOME_FURNISHING_PALM(p);
  const d=HOME_FURNITURE[p.id],c=Math.cos(p.a),s=Math.sin(p.a);
  const prop=ROOM_MODEL(p.x,p.y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const wood=(u,v,hx,hy,z0,z1,rad=.025,mat='wood')=>{const [x,y]=at(u,v);coveRound(x,y,c,s,hx,hy,z0,z1,rad,mat);};
    const tube=(u,v,z,uu,vv,zz,rad=.015,base=GRAY)=>{const [x,y]=at(u,v),[xx,yy]=at(uu,vv);coveTube(x,y,z,xx,yy,zz,rad,base);};
    const fabric=(i,t,L)=>{BG[i]=C(BLUE,2.8+L*.27*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    if(p.id==='f_chair') {
      for(const x of [-.22,.22])for(const y of [-.22,.22])wood(x,y,.035,.035,0,.43,.014);
      wood(0,0,.29,.29,.4,.47,.025);for(const x of [-.25,.25])wood(x,-.25,.03,.03,.45,1.05,.014);
      for(const z of [.76,.94])wood(0,-.25,.25,.028,z-.065,z+.065,.02);
    }else if(p.id==='f_table') {
      for(const x of [-.8,.8])for(const y of [-.35,.35])wood(x,y,.045,.045,0,.73,.018);
      for(const y of [-.4,.4])wood(0,y,.84,.03,.6,.73,.015);
      for(const y of [-.333,0,.333])wood(0,y,.95,.164,.73,.8,.025);
    }else if(p.id==='f_sofa') {
      for(const x of [-1,1])for(const y of [-.3,.3])wood(x,y,.06,.06,0,.18);
      wood(0,0,1.2,.46,.15,.34,.07,'wood');
      for(const side of [-1,1]){wood(side*.53,.025,.51,.38,.32,.49,.09,fabric);wood(side*1.12,0,.08,.46,.34,.72,.065,fabric);wood(side*.53,-.36,.51,.1,.46,.95,.075,fabric);}
    }else if(p.id==='f_rug') {
      wood(0,0,1.3,.9,.002,.014,.005,(i,t,L)=>{const edge=Math.abs(HIT.u)>1.21||Math.abs(HIT.v)>.81;BG[i]=C(edge?STONE:BLUE,2.7+L*.2);set(i,edge?'=':' ',C(STONE,L));return true;});
    }
  });
  prop.radius=Math.hypot(d.hx,d.hy)+.2;prop.box=furnishingBox(p);prop.walk=!!(d.rug||d.wall);prop.furnishingKey=p.key;
  if(d.seat)Object.assign(prop,{seat:true,h:d.seat,fx:-s,fy:c});return prop;
}
function furnishingProps(r) {const home=homeRecord(r);return home?homeFurnishings(home).parts.map(p=>furnishingProp(p,r)):[];}
