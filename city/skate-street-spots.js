// Small street lines in existing open park edges and service yards. Placement
// preserves vegetation, paths, buildings and traffic; no new full-size parks.
const SKATE_STREET_SITES=[],SKATE_STREET_FEATURES=[],SKATE_STREET_CELLS=new Map();
function skateStreetPoint(site,u,v){return [site.x+site.c*u-site.s*v,site.y+site.s*u+site.c*v];}
function skateStreetFeature(site,u,v,hl,hw,height,kind='skateledge',extra={}){
  const [x,y]=skateStreetPoint(site,u,v),o={x,y,c:site.c,s:site.s,hl,hw,z0:site.base,z1:site.base+height,kind,material:'concrete',low:true,spot:true,streetSite:site.id,...extra};
  SKATE_STREET_FEATURES.push(o);SKATE_FEATURES.push(o);solids.push(o);
  const ex=Math.abs(o.c)*o.hl+Math.abs(o.s)*o.hw,ey=Math.abs(o.s)*o.hl+Math.abs(o.c)*o.hw;
  if(!o.streetRail)for(let ix=Math.floor(x-ex);ix<=Math.floor(x+ex);ix++)for(let iy=Math.floor(y-ey);iy<=Math.floor(y+ey);iy++){
    const key=idx(ix,iy),bucket=SKATE_STREET_CELLS.get(key)||[];bucket.push(o);SKATE_STREET_CELLS.set(key,bucket);
  }
  return o;
}
function skateStreetGrind(o,points,kind=o.kind){
  const a=points[0],b=points.at(-1);
  GRINDS.push({points,ax:a[0],ay:a[1],bx:b[0],by:b[1],z:o.z1-terrainHeight(o.x,o.y),kind,material:o.material,feature:o});
}
function skateStreetEdges(o,from=-o.hl,to=o.hl){
  for(const side of o.kind==='skaterail'?[0]:[-1,1]){
    const point=u=>[o.x+o.c*u-o.s*side*o.hw,o.y+o.s*u+o.c*side*o.hw,o.z1];
    skateStreetGrind(o,[point(from),point(to)]);
  }
}
function skateStreetBank(site,u,v,hl,hw,height,run=hl*2-.08,shape='kicker'){
  const o=skateStreetFeature(site,u,v,hl,hw,height,'skateramp',{ramp:shape,run,ray:rayRamp});
  if(shape==='funbox')skateStreetEdges(o,-hl+run,hl-run);
  return o;
}
// A sloped tube and its posts share the grind path's exact endpoints. Model
// rays run in the object's local frame; the ordinary solid buckets still cull.
function skateStreetRail(site,v,points){
  const mid=(points[0][0]+points.at(-1)[0])/2,hl=(points.at(-1)[0]-points[0][0])/2,model=[];
  const part=(u0,z0,u1,z1,width)=>{
    const du=u1-u0,dz=z1-z0,len=Math.hypot(du,dz),f=[du/len,0,dz/len];
    model.push({px:(u0+u1)/2-mid,py:0,pz:site.base+(z0+z1)/2,A:[f,[0,1,0],[-f[2],0,f[0]]],E:[len/2,width,width]});
  };
  for(let i=1;i<points.length;i++)part(...points[i-1],...points[i],.003);
  for(const [u,z]of points)part(u,0,u,z,.003);
  const ray=(ox,oy,oz,rx,ry,rz,b)=>{
    const qx=ox-b.x,qy=oy-b.y,u=qx*b.c+qy*b.s,v=-qx*b.s+qy*b.c,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
    let nearest=Infinity,hit=null;
    for(const p of model){const t=rayOBox(u,v,oz,du,dv,rz,p);if(t>.01&&t<nearest){nearest=t;hit={...HIT,w:oz+rz*t};}}
    if(!hit)return -1;Object.assign(HIT,hit);return nearest;
  };
  const top=Math.max(...points.map(p=>p[1]))+.003,o=skateStreetFeature(site,mid,v,hl+.003,.003,top,'skatestreetrail',{streetRail:points.map(([u,z])=>[u-mid,site.base+z+.003]),material:'metal',ray});
  skateStreetGrind(o,points.map(([u,z])=>[...skateStreetPoint(site,u,v),site.base+z+.003]),'handrail');
  return o;
}
SOLID_SHADE.skatestreetrail=()=> (i,t,L)=>{BG[i]=SK_STEEL(L,HIT.face===5);return set(i,' ',0),true;};
function skateStreetRailHeight(o,x,y){
  const u=rel(x-o.x)*o.c+rel(y-o.y)*o.s,points=o.streetRail;
  for(let i=1;i<points.length;i++)if(u<=points[i][0]){const [a,z]=points[i-1],[b,w]=points[i];return z+(w-z)*clamp((u-a)/(b-a),0,1);}
  return points.at(-1)[1];
}
function skateStreetGround(x,y){
  let h=0;
  for(const o of SKATE_STREET_CELLS.get(idx(Math.floor(x),Math.floor(y)))||[]){
    const dx=rel(x-o.x),dy=rel(y-o.y),u=dx*o.c+dy*o.s,v=-dx*o.s+dy*o.c;
    if(Math.abs(u)<=o.hl&&Math.abs(v)<=o.hw)h=Math.max(h,o.ramp?rampHeight(o,u):o.z1);
  }
  return h;
}
function skateStreetSiteClear(x,y,c,s){
  const hx=Math.abs(c)*1.1+Math.abs(s)*.52,hy=Math.abs(s)*1.1+Math.abs(c)*.52;
  const near=(o,pad=.12)=>Math.abs(rel(o.x-x))<hx+Math.abs(o.c??1)*(o.hl||0)+Math.abs(o.s||0)*(o.hw||0)+pad&&Math.abs(rel(o.y-y))<hy+Math.abs(o.s||0)*(o.hl||0)+Math.abs(o.c??1)*(o.hw||0)+pad;
  if(SKATE_PATCHES.some(p=>Math.abs(rel(p.x-x))<hx+p.hl+.2&&Math.abs(rel(p.y-y))<hy+p.hw+.2))return false;
  if(SKATE_STREET_SITES.some(p=>Math.hypot(rel(p.x-x),rel(p.y-y))<12))return false;
  if(trees.some(o=>near(o,.3))||benches.some(o=>near(o,.35))||solids.some(o=>near(o))||ARCH_BLOCKERS.some(o=>near(o))||LANDMARK_SOLIDS.some(o=>near(o)))return false;
  if(typeof GRILLS!=='undefined'&&GRILLS.some(o=>near(o,.25)))return false;
  let base=null;
  for(let u=-1.1;u<=1.1001;u+=.22)for(let v=-.52;v<=.5201;v+=.26){
    const wx=x+c*u-s*v,wy=y+s*u+c*v,bx=Math.floor(wx/8),by=Math.floor(wy/8),lx=mod(wx,8),ly=mod(wy,8);
    if(isWater(wx,wy)||ROAD[idx(Math.floor(wx),Math.floor(wy))]||map[idx(Math.floor(wx),Math.floor(wy))])return false;
    if(blockKind(bx,by)==='park'&&(inPond(lx,ly,bx,by,.2)||Math.abs(lx-5)<.35||Math.abs(ly-5)<.35))return false;
    const h=roadGroundHeight(wx,wy);if(base===null)base=h;else if(Math.abs(base-h)>.002)return false;
  }
  return true;
}
function buildStreetSkateSpots(){
  SKATE_STREET_SITES.length=SKATE_STREET_FEATURES.length=0;SKATE_STREET_CELLS.clear();
  const candidates=[],positions=[[6.6,6.6,0],[6.6,3.4,Math.PI/2],[3.4,6.6,0]];
  for(const v of [2.6,2.9,3.2,3.5,3.8,4.1,6,6.3,6.9,7.2])positions.push([6.6,v,0],[v,6.6,Math.PI/2]);
  for(let by=0;by<NB;by++)for(let bx=0;bx<NB;bx++){
    if(!['park','yard'].includes(blockKind(bx,by))||SKATEPARK&&bx===SKATEPARK.bx&&by===SKATEPARK.by)continue;
    for(const [u,v,yaw]of positions){
      const x=bx*8+u,y=by*8+v,c=Math.cos(yaw),s=Math.sin(yaw);
      if(skateStreetSiteClear(x,y,c,s))candidates.push({x,y,c,s,bx,by,district:districtOf(bx,by),base:roadGroundHeight(x,y)});
    }
  }
  const styles=['stairs','dock','banks','manuals','rails','gap'],used=new Set();
  const descriptions={
    kickers:['Kicker and flat bar','A low launch ramp with a clear landing, plus a parallel steel flat bar. Practice small airs or line up an ollie onto the rail away from the street.'],
    flatbars:['Twin flat bars','Two low steel rails with separate approaches and room to roll out. A small bank links the lines on this quiet patch of paving.'],
    stairs:['Four-step rail','A roll-up bank reaches a 72 cm landing and four 18 cm stairs. Two steel handrails run flat, down the steps and out onto the approach; line up on the upper deck for a downhill grind or ollie the set.'],
    dock:['Loading dock','A bank reaches a 60 cm loading platform with grindable edges and a sloped steel exit rail. Pop off the dock or carry a manual across the adjacent low pad.'],
    banks:['Bank-to-ledge plaza','Broad banks lead onto a 45 cm deck with steel-edged grind lines. A low ledge and flat bar make alternate exits, with clear run-up and landing space.'],
    manuals:['Manual link','Two low eight-meter pads with a two-meter gap, plus a parallel concrete ledge. Link manuals, flips and a grind across the open paving.'],
    rails:['Angled rail line','Three low steel bars at different angles, with space between them to pop out, steer and transfer. A broad low bank offers another approach.'],
    gap:['Ledge transfer','Two six-meter ledges separated by a three-meter transfer gap, plus a long low manual pad. Build speed on the clear approaches and link the line.']
  };
  while(SKATE_STREET_SITES.length<14){
    // Keep the original eight lines stable; spread the additional small spots
    // across the remaining open spaces rather than filling one neighbourhood.
    if(SKATE_STREET_SITES.length>=8)candidates.sort((a,b)=>{
      const distance=p=>Math.min(...SKATE_STREET_SITES.map(s=>Math.hypot(rel(p.x-s.x),rel(p.y-s.y))));
      return distance(b)-distance(a);
    });
    const site=candidates.find(p=>!used.has(p.district)&&skateStreetSiteClear(p.x,p.y,p.c,p.s))||candidates.find(p=>skateStreetSiteClear(p.x,p.y,p.c,p.s));
    if(!site)break;
    const type=SKATE_STREET_SITES.length>=8?(SKATE_STREET_SITES.length%2?'flatbars':'kickers'):site.district==='industrial'&&!SKATE_STREET_SITES.some(p=>p.type==='dock')?'dock':styles.find(type=>!SKATE_STREET_SITES.some(p=>p.type===type))||styles[SKATE_STREET_SITES.length%styles.length];
    const id='skate-street:'+SKATE_STREET_SITES.length;Object.assign(site,{id,type});used.add(site.district);SKATE_STREET_SITES.push(site);
    const box=(u,v,hl,hw,h,kind='skateledge',edge=true,extra={})=>{const o=skateStreetFeature(site,u,v,hl,hw,h,kind,extra);if(edge)skateStreetEdges(o);return o;};
    if(type==='kickers'){
      skateStreetBank(site,-.35,-.2,.28,.13,.035);
      skateStreetRail(site,.22,[[-.65,.03],[.65,.03]]);
    }else if(type==='flatbars'){
      for(const v of [-.22,.22])skateStreetRail(site,v,[[-.6,.028],[.6,.028]]);
      skateStreetBank(site,0,0,.35,.08,.025,.14,'funbox');
    }else if(type==='stairs'){
      skateStreetBank(site,-.72,0,.25,.22,.072);box(-.26,0,.21,.22,.072);
      for(let i=0;i<4;i++)box(-.05+(i+.5)*.025,0,.0125,.22,.072-i*.018,'skateledge',false,{walkStep:true});
      for(const side of [-1,1])skateStreetRail(site,side*.2,[[-.35,.117],[-.05,.117],[.05,.045],[.35,.045]]);
    }else if(type==='dock'){
      skateStreetBank(site,-.74,-.08,.24,.2,.06);box(-.25,-.08,.25,.2,.06);box(.64,.23,.3,.1,.018,'manualpad');
      skateStreetRail(site,-.25,[[-.42,.105],[-.05,.105],[.28,.035],[.5,.035]]);
    }else if(type==='banks'){
      skateStreetBank(site,-.28,0,.55,.22,.045,.2,'funbox');box(.61,-.25,.3,.035,.035);box(.61,.25,.3,.004,.027,'skaterail');
    }else if(type==='manuals'){
      box(-.5,-.12,.4,.1,.018,'manualpad');box(.5,-.12,.4,.1,.018,'manualpad');box(0,.24,.65,.035,.035);
    }else if(type==='rails'){
      for(const [u,v,angle]of [[-.65,-.18,.2],[0,.12,-.25],[.65,-.18,.2]])box(u,v,.24,.004,.028,'skaterail',true,{c:Math.cos(Math.atan2(site.s,site.c)+angle),s:Math.sin(Math.atan2(site.s,site.c)+angle),material:'metal'});
      skateStreetBank(site,0,-.3,.4,.08,.025,.15,'funbox');
    }else{
      box(-.45,-.2,.3,.035,.04);box(.45,-.2,.3,.035,.04);box(0,.22,.8,.1,.018,'manualpad');
    }
    const hx=Math.abs(site.c)*1.1+Math.abs(site.s)*.52,hy=Math.abs(site.s)*1.1+Math.abs(site.c)*.52;
    SKATE_PATCHES.push({x:site.x,y:site.y,hl:hx,hw:hy});
    const [x,y]=skateStreetPoint(site,-1.02,.4),[name,description]=descriptions[type];
    SKATE_SPOTS.push({id,name:cap(site.district.replace(/[-_]/g,' '))+' · '+name,x,y,line:{x:site.x,y:site.y},description,street:true,district:site.district});
  }
}

// Square steel remains exact up close. Below a character in thickness, use
// the city's measured rod renderer so a rail stays a line rather than dots.
function drawStreetSkateRail(o){
 const [x,y]=R(o.x,o.y),depth=dx*x+dy*y;
 if(Math.hypot(x,y)>vis+1||!inView(x,y,o.hl+.1))return;
 if(.006*projX/Math.max(.02,depth)>1.5){
  drawBox(boxAt(x,y,o.c,o.s,o.hl,o.hw,o.z0,o.z1),SOLID_SHADE.skatestreetrail(o),o.ray);return;
 }
 const point=([u,z])=>[x+o.c*u,y+o.s*u,z-.003],points=o.streetRail.map(point);
 const steel=(i,t,L)=>{BG[i]=SK_STEEL(L,true);set(i,' ',0);return true;};
 for(let j=1;j<points.length;j++)drawRod(...points[j-1],...points[j],.003,steel);
 for(const [xx,yy,z]of points)drawRod(xx,yy,o.z0,xx,yy,z,.003,steel);
}
