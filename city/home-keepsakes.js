// Small home keepsakes share the shelf's existing saved footprint and facing.
// Static shapes cache per inventory object; placement and taking remain in the
// shelf system, so the displayed model cannot enlarge its reserved space.
const HOME_KEEPSAKE_MODELS=new WeakMap();
function homeKeepsakeModel(it,size) {
 const cached=HOME_KEEPSAKE_MODELS.get(it);
 if(cached&&cached.id===it.id&&cached.radius===size.radius&&cached.height===size.height)return cached;
 if(!['duck','snowglobe'].includes(it.id))return null;
 const R=size.radius,H=size.height,parts=[],state={z:0};
 const flat=(base,level)=>(i,t,L)=>{BG[i]=C(base,level+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
 const yellow=flat(YEL,4.1),orange=flat(ORANGE,3.9),eyes=flat(BLACK,.4),wood=furnitureTimber(BRICK),snow=flat(WHITE,5),green=flat(GREEN,2.5);
 const lathe=(role,u,v,profile,shade)=>{
  const points=profile.map(([z,r])=>[z*H,r*R]),radius=Math.max(...points.map(p=>p[1]));
  parts.push({role,u:u*R,v:v*R,hl:radius,hw:radius,z0:Math.min(...points.map(p=>p[0])),z1:Math.max(...points.map(p=>p[0])),profile:points,shade,ray:coveRayLathe});
 };
 const ell=(role,u,v,z,hx,hy,hz,shade)=>parts.push({role,u:u*R,v:v*R,hl:hx*R,hw:hy*R,z0:(z-hz)*H,z1:(z+hz)*H,shade,ray:homeRayEllipsoid});
 if(it.id==='duck'){
  lathe('body',0,0,[[0,0],[0,.55],[.04,.72],[.15,.86],[.30,.85],[.43,.70],[.50,.45],[.51,0]],yellow);
  ell('tail',0,-.65,.36,.22,.32,.12,yellow);
  ell('head',0,.35,.72,.45,.45,.28,yellow);
  ell('beak',0,.80,.68,.27,.18,.065,orange);
  for(const side of [-1,1])ell('eye',side*.30,.66,.82,.055,.055,.04,eyes);
 }else{
  lathe('base',0,0,[[0,0],[0,.75],[.025,.82],[.12,.82],[.16,.75],[.16,0]],wood);
  lathe('snow-floor',0,0,[[.16,0],[.16,.68],[.18,.68],[.18,0]],snow);
  lathe('trunk',0,0,[[.18,0],[.18,.055],[.31,.055],[.31,0]],wood);
  lathe('tree',0,0,[[.28,0],[.28,.35],[.44,.13],[.44,.29],[.57,.10],[.57,.21],[.75,0]],green);
  const glass=(i,t,L)=>{
   const rx=state.x+HIT.u,ry=state.y+HIT.v,rz=HIT.w-eye,incidence=Math.abs((rx*HIT.nx+ry*HIT.ny+rz*HIT.nz)/Math.hypot(rx,ry,rz));
   const edge=1-smooth(clamp((incidence-state.edgeLimit*.8)/(state.edgeLimit*.2),0,1));
   const glint=coveGroove(HIT.u+((HIT.w-state.z)/H)*R*.7,R*1.5,R*.035,t/projX)*coveDetail(t,Math.max(.15,R*4));
   if(Math.max(edge,glint)<.42)return false;BG[i]=C(CYAN,5.2+edge+L*.08*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  lathe('glass',0,0,[[.16,.70],[.22,.82],[.38,.94],[.56,.94],[.74,.80],[.90,.51],[1,0],[.97,0],[.87,.48],[.72,.76],[.55,.90],[.39,.90],[.24,.78],[.18,.68],[.16,.70]],glass);
 }
 const model={id:it.id,radius:R,height:H,parts,state};HOME_KEEPSAKE_MODELS.set(it,model);return model;
}
function drawHomeKeepsake(p) {
 const model=homeKeepsakeModel(p.it,p.size);if(!model)return false;
 if(!inView(p.x-px,p.y-py,model.radius))return true;
 if(model.state.z!==p.z||!model.positioned){
  model.state.z=p.z;model.positioned=true;
  for(const q of model.parts)if(q.profile)q.placedProfile=q.profile.map(([z,r])=>[p.z+z,r]);
 }
 model.state.x=p.x-px;model.state.y=p.y-py;
 model.state.edgeLimit=Math.min(.85,Math.sqrt(2*Math.hypot(model.state.x,model.state.y,p.z+model.height*.5-eye)/(projY*Math.min(model.radius,model.height/2))));
 const {c,s}=p.surface;
 for(const q of model.parts){
  const x=p.x-px+c*q.u-s*q.v,y=p.y-py+s*q.u+c*q.v;
  drawBox({...boxAt(x,y,c,s,q.hl,q.hw,p.z+q.z0,p.z+q.z1),...(q.profile?{profile:q.placedProfile}:{}),keepsakeRole:q.role},q.shade,q.ray);
 }
 return true;
}
