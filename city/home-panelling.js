// Closed Shaker-style wainscot: periodic recessed fields are real cavities in
// a shallow extrusion. A constant number of analytic plane hits replaces a
// separate mesh for every stile and rail.
function homePanellingRay(ox,oy,oz,rx,ry,rz,b) {
  let t=rayBox(ox,oy,oz,rx,ry,rz,b);if(t<0)return t;
  const f=HIT.face;let nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0,nz=f===5?1:f===6?-1:0;
  HIT.panelBack=false;
  if(f===3){
    const u=HIT.u,v=HIT.v,z=HIT.w,tile=Math.floor((b.phase+u)/.8),lo=Math.max(-b.hl+.09,tile*.8-b.phase+.035),hi=Math.min(b.hl-.09,(tile+1)*.8-b.phase-.035),bottom=b.z0+.035,top=b.z1-.035;
    if(u>lo&&u<hi&&z>bottom&&z<top){
      const du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
      let dt=(-b.hw+.008-v)/dv;nu=0;nv=1;nz=0;HIT.panelBack=true;
      if(Math.abs(du)>1e-12){const d=((du>0?hi:lo)-u)/du;if(d<dt){dt=d;nu=du>0?-1:1;nv=0;HIT.panelBack=false;}}
      if(Math.abs(rz)>1e-12){const d=((rz>0?top:bottom)-z)/rz;if(d<dt){dt=d;nu=nv=0;nz=rz>0?-1:1;HIT.panelBack=false;}}
      HIT.u=u+du*dt;HIT.v=v+dv*dt;HIT.w=z+rz*dt;t+=dt;HIT.face=7;
    }
  }
  HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;return t;
}
function homePanelling(r) {
  if(!r.def.builtPanelling)return [];
  const bottom=r.props.find(p=>p.homeSkirting)?.homeSkirting.profile.at(-1)[1]??.155;
  // Meet the actual sill underside; the rail/frieze stops at its real casing.
  let top=.855;const draw=drawBox;drawBox=b=>{top=Math.min(top,b.z0);};
  try{for(const p of r.props.filter(p=>p.windowCasing))p.draw(p.x,p.y);}finally{drawBox=draw;}
  const layout=homeWallMoulding(r,[[bottom,top,.026]],false,'homePanelLayout')[0],parts=layout.homePanelLayout.parts.map(p=>{
    const b=p.box,view={...b,phase:b.x*b.c+b.y*b.s},[fx,fy]=p.normal;
    const shade=(i,t,L)=>{const detail=smooth(clamp((.035*projX/t-.2)/.8,0,1)),base=3.5+((HIT.panelBack?3.25:4.1)-3.5)*detail;
      BG[i]=C(WHITE,base+L*.28*coveLight(HIT.nx*detail+fx*(1-detail),HIT.ny*detail+fy*(1-detail),HIT.nz*detail));set(i,' ',0);return true;};
    return{box:b,view,shade,normal:p.normal,wall:p.wall};
  });
  const model={...ROOM_MODEL(0,0,(vx,vy)=>{for(const p of parts){p.view.x=vx+p.box.x;p.view.y=vy+p.box.y;drawBox(p.view,p.shade,homePanellingRay);}}),walk:true,radius:Math.hypot(r.W,r.H),homePanelling:{parts,bottom,top}};
  return[model,...homeWallMoulding(r,[[top,.855,.026],[.855,.88,.03],[.88,.915,.045],[.915,.945,.032]],false,'homeChairRail')];
}
