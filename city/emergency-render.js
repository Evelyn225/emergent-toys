function drawFirePlume(vx,vy,z,width,height,seed,strength=1){
  if(strength<=0||dx*vx+dy*vy<.05||dx*vx+dy*vy>vis||!inView(vx,vy,width+.02))return;
  const scale=Math.sqrt(strength),w=width*(.35+.65*scale),h=height*(.2+.8*scale),frame=cityFlameFrame(seed,T);
  drawShape(vx,vy,z,w,h,(i,u,v)=>{
    const heat=cityFlameSample(frame,u/w,v/h)*(.55+.45*scale);
    if(heat<=.075)return false;
    BG[i]=heat>.96?C(WHITE,15):heat>.72?C(YEL,15):heat>.4?C(ORANGE,13):C(RED,7+heat*13);
    set(i,' ',0);return true;
  });
}
const emergencyStreams=new Map();
let emergencyWaterT=0,emergencySmokeT=0;
function rememberWater(key,from,to,dt=.15){const hit=hoseSurfaceHit(from,to);wetHoseImpact(hit,dt);emergencyStreams.set(key,{from,to:hit?[hit.x,hit.y,hit.z]:to,hit,until:netNow()+.25});}
function sprayEmergencyWater(dt){
  const z=walkGround(px,py)+.17,slope=pitch*rows/projY,hit=hoseHit(px,py,z,a,slope);
  let end=hit?[hit.node.x,hit.node.y,hit.node.z]:[worldCoord(px+Math.cos(a)*2.6),worldCoord(py+Math.sin(a)*2.6),z+slope*2.6];
  if(!hit)for(let d=.08;d<2.6;d+=.025){
    const x=worldCoord(px+Math.cos(a)*d),y=worldCoord(py+Math.sin(a)*d),zz=z+slope*d;
    if(map[idx(x,y)]>zz||zz<terrainHeight(x,y)||solidAt(x,y,.003)){end=[x,y,Math.max(terrainHeight(x,y),zz)];break;}
  }
  rememberWater('self',[px+Math.cos(a)*.08-Math.sin(a)*.026,py+Math.sin(a)*.08+Math.cos(a)*.026,z-.022],end,dt);
  if(hit&&incidentOwned(hit.fire))coolFireNode(hit.fire,hit.node,dt);
  if((emergencyWaterT-=dt)<=0){
    emergencyWaterT=.15;
    if(typeof netSendWater==='function')netSendWater({x:px,y:py,z,yaw:a,slope,end,fire:hit?.fire.id||null,dt:.15});
  }
}
function stepEmergencyWater(dt){
  stepHoseWetness(dt);
  for(const f of cityFires)if(fireActive(f)){const c=cars.find(c=>c.ev&&!c.mine&&c.fireIncident===f&&!c.home),n=c?fireCrewTarget(c):f.remoteCrew?.state==='scene'&&f.nodes.find(n=>n.heat>0);if(n){const origin=fireCrewOrigin(c||f.remoteCrew,f);wetHoseImpact(hoseSurfaceHit(origin,[n.x,n.y,n.z]),dt);}}
  if(emergencyHoseReady()&&(K.KeyQ||K.MouseUse))sprayEmergencyWater(dt);
  else emergencyWaterT=0;
  if((emergencySmokeT-=dt)<=0){
    emergencySmokeT=.3;
    for(const f of cityFires)if(fireActive(f)&&near(f.x,f.y,px,py)<18){
      const n=f.nodes.find(n=>n.heat>0);if(n)worldPuff(n.x,n.y,n.z+.08,.04,.17,'soot',3,.08);
    }
  }
}
function drawWaterStream(from,to,impact){
  const [x,y,z]=from,ex=rel(to[0]-x),ey=rel(to[1]-y),ez=to[2]-z,[vx,vy]=R(x,y),range=Math.hypot(ex,ey),distance=Math.max(.01,range);
  const sideX=-ey/distance,sideY=ex/distance,arc=.28*(range/2.6)**2,backdrop=BG.slice(),savedGlow=drawNoGlow;
  const at=q=>[vx+ex*q,vy+ey*q,z+ez*q+arc*q*(1-q)];
  const shade=(opacity,phase)=>(i,t,L)=>{
    const shine=.5+.5*Math.sin(T*32-phase+HIT.w*350),tint=C(shine>.87?WHITE:WET,Math.max(4,L*.45)+shine*4);
    BG[i]=hazeTint(backdrop[i],tint,opacity);set(i,' ',0);return true;
  };
  drawNoGlow=1; // Water reflects light; it is not an emissive cyan tube.
  try{
    // A narrow continuous pressure core. Surface highlights run towards impact.
    for(let j=0;j<16;j++)drawRod(...at(j/16),...at((j+1)/16),.0014+j/16*.0007,shade(.62,j*.9));
    // The outer jet breaks into droplets, moving with the water rather than
    // blinking at unrelated cells. Its spread grows towards the impact point.
    for(let j=0;j<22;j++){
      const q=fract(T*2.1+j*.618),angle=j*2.39996,spread=(.001+.012*q*q)*Math.min(1,range/2.6),p=at(q),tail=at(Math.max(0,q-.022));
      const across=Math.cos(angle)*spread,up=Math.sin(angle)*spread;
      drawRod(p[0]+sideX*across,p[1]+sideY*across,p[2]+up,tail[0]+sideX*across,tail[1]+sideY*across,tail[2]+up,.0009,shade(.4,j*1.3));
    }
    if(!impact)return;
    const ground=impact.nz>.5;
    for(let j=0;j<12;j++){
      const age=fract(T*2.7+j*.618),angle=j*2.39996,spread=.045*age,px_=vx+ex,py_=vy+ey;
      const sx=ground?Math.cos(angle)*spread:sideX*Math.cos(angle)*spread-ex/distance*.025*age;
      const sy=ground?Math.sin(angle)*spread:sideY*Math.cos(angle)*spread-ey/distance*.025*age;
      const lift=ground?Math.sin(age*Math.PI)*.04:Math.sin(angle)*.035*age-.06*age*age;
      drawRod(px_+sx,py_+sy,to[2]+lift,px_+sx,py_+sy,to[2]+lift-.004,.0009,shade(.38,j));
    }
  }finally{drawNoGlow=savedGlow;}
}
const emergencyCrewLook=figLook({hat:'hardhat',top:'long',bot:'pants',col:{hat:[YEL,13],top:[YEL,9],bot:[GRAY,4],shoe:[GRAY,2]}});
function emergencySprites(){
  for(const f of cityFires){
    if(near(f.x,f.y,px,py)>vis+1)continue;
    if(f.kind==='building')for(const [k,n]of f.nodes.entries())if(n.heat>0){
      drawFirePlume(...R(n.x,n.y),n.z-.05,.11,.23,hash(Math.floor(n.x*100),Math.floor(n.y*100),k)*50,n.heat/n.max);
    }
    const c=cars.find(c=>c.ev&&!c.mine&&c.fireIncident===f&&!c.home),remote=f.remoteCrew;
    const n=c?fireCrewTarget(c):remote?.state==='scene'&&f.nodes.find(n=>n.heat>0);
    if(remote&&!c){const [vx,vy]=R(remote.x,remote.y);drawVehicle({kind:'fire',body:RED,ev:true,state:remote.state,v:remote.v||0},vx,vy,remote.hx,remote.hy);}
    if(n){
      const crew=c||remote,origin=fireCrewOrigin(crew,f),[vx,vy]=R(origin[0],origin[1]);
      drawFigure(vx,vy,walkGround(origin[0],origin[1]),.175,rel(n.x-origin[0]),rel(n.y-origin[1]),emergencyCrewLook,'aim');
      const hit=hoseSurfaceHit(origin,[n.x,n.y,n.z]);drawWaterStream(origin,hit?[hit.x,hit.y,hit.z]:[n.x,n.y,n.z],hit);
    }
  }
  for(const f of medicalCalls)if(!f.out&&f.stage==='waiting'&&near(f.x,f.y,px,py)<vis){
    drawFigure(...R(f.x,f.y),walkGround(f.x,f.y),.175,0,-1,f.look,'sit0');
    drawArt(...R(f.x,f.y),.20,.035,.055,['+'],()=>C(CYAN,15));
  }
  for(const [key,s]of emergencyStreams){if(s.until<netNow()){emergencyStreams.delete(key);continue;}drawWaterStream(s.from,s.to,s.hit);}
}
let emergencyNozzlePicture=null;
function drawHoseHeld(){
  // The same sampled solid surfaces and hand mask as other held tools.
  emergencyNozzlePicture||=sculptSurface(38,28,(x,y)=>{
    const paint=(c,l)=>[' ',C(c,l)],length=Math.hypot(6,17),u=((x+5)*6+(y+11)*17)/length,v=(-(x+5)*17+(y+11)*6)/length;
    if(heldToolPolygon(x,y,[[1,2],[6,2],[9,5],[8,8],[3,8],[2,6]]))return paint(GRAY,x>6?3:7);
    if(y>6&&Math.abs(x-(y-6)*.38-1)<1.8)return paint(GRAY,3+Math.abs(Math.sin(y*2))*2);
    if(u<0||u>18||Math.abs(v)>2.2-(u/18)*.6)return null;
    const edge=Math.abs(v)/(2.2-u/18*.6),rib=u>9&&u<15&&fract(u*.7)<.3;
    if(u<1.2)return paint(edge>.68?YEL:GRAY,edge>.68?12:1);
    return paint(rib?GRAY:YEL,(rib?4:9)+(1-edge)*4-v*.3);
  });
  const [art,col]=emergencyNozzlePicture,s=Math.max(9,Math.round(cv.height/90)),hsz=Math.max(12,Math.round(cv.height/65)),cx=cv.width*.72,hy=cv.height*.85;
  g.font=s+'px monospace';const w=g.measureText('M').width;
  drawBehindHand(cx,hy,hsz,()=>artText(art,cx-art[0].length*w/2,hy-s*19,s,col));g.font=FS+'px monospace';
}
