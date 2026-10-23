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
const HOME_PHOTO_GLYPHS=new WeakMap();
function furnishingProp(p,r) {
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
    }else if(p.id==='f_lamp') {
      coveLathe(vx,vy,0,[[0,0],[0,.18],[.025,.22],[.05,.16],[.06,.04],[.06,0]],homeStone);tube(0,0,.05,0,0,1.55,.018);
      coveLathe(vx,vy,1.3,[[0,.24],[.02,.25],[.4,.14],[.42,.13],[.42,.115],[.02,.23]],homeStone);
      dot(vx,vy,1.43,.06,(i,t,L)=>{BG[i]=C(p.on?WARM:STONE,p.on?12:3);set(i,' ',0);return true;});
    }else if(p.id==='f_recordplayer') {
      for(const x of [-.44,.44])for(const y of [-.25,.25])wood(x,y,.04,.04,0,.16,.018);
      wood(0,0,.55,.35,.15,.87,.025);wood(0,.35,.5,.025,.24,.75,.018);wood(0,0,.55,.35,.87,.94,.025);
      const [x,y]=at(-.13,0);coveLathe(x,y,.94,[[0,0],[0,.24],[.025,.24],[.025,0]],(i,t,L)=>{BG[i]=C(BLACK,1);const angle=Math.atan2(HIT.v,HIT.u)+(p.on?T*3:0);set(i,Math.hypot(HIT.u,HIT.v)<.075?(Math.sin(angle*2)>.5?'-':' '):' ',C(p.on?YEL:STONE,8));return true;});
      tube(.36,-.2,.96,.36,-.2,1.04,.012,YEL);tube(.36,-.2,1.04,p.on?.1:.36,p.on?.08:.19,p.on?.99:1.04,.012,YEL);
      wood(.44,.26,.035,.035,.94,.97,.012,GRAY);
    }else if(p.id==='f_frame') {
      wood(0,0,.4,.035,p.z-.3,p.z+.3,.012);
      const [x,y]=at(0,.036),photo=homePhotos.photos.find(q=>q.id===p.photo);
      if(photo&&!HOME_PHOTO_GLYPHS.has(photo))HOME_PHOTO_GLYPHS.set(photo,Array.from(photo.chars));
      const chars=photo&&HOME_PHOTO_GLYPHS.get(photo);
      drawBox(boxAt(x,y,c,s,.35,.001,p.z-.25,p.z+.25),(i,t,L)=>{
        const u=clamp((HIT.u/.35+1)/2,0,.999),v=clamp((p.z+.25-HIT.w)/.5,0,.999);
        if(!photo){BG[i]=C(STONE,4+L*.15);set(i,' ',0);return true;}
        const k=Math.floor(v*photo.h)*photo.w+Math.floor(u*photo.w),shade=col=>col===NONE?C(GRAY,2):C(col>>4,(col&15)*clamp(L/12,.25,1));
        BG[i]=shade(photo.bg[k]);set(i,chars[k],shade(photo.fg[k]));return true;
      });
    }else if(p.id==='f_rug') {
      wood(0,0,1.3,.9,.002,.014,.005,(i,t,L)=>{const edge=Math.abs(HIT.u)>1.21||Math.abs(HIT.v)>.81;BG[i]=C(edge?STONE:BLUE,2.7+L*.2);set(i,edge?'=':' ',C(STONE,L));return true;});
    }else if(p.id==='f_plant')POT_PLANT(p.x,p.y,1.6).draw(vx,vy);
    else if(p.id==='sharkplush')homePlushShark(vx,vy,c,s,p.z||0);
  });
  prop.radius=Math.hypot(d.hx,d.hy)+.2;prop.box=furnishingBox(p);prop.walk=!!(d.rug||d.wall);prop.furnishingKey=p.key;
  if(d.seat)Object.assign(prop,{seat:true,h:d.seat,fx:-s,fy:c});return prop;
}
function furnishingProps(r) {const home=homeRecord(r);return home?homeFurnishings(home).parts.map(p=>furnishingProp(p,r)):[];}
