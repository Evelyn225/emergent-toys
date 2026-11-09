const emergencyStreams=new Map();
let emergencyWaterT=0,emergencySmokeT=0;
function rememberWater(key,from,to){emergencyStreams.set(key,{from,to,until:netNow()+.25});}
function sprayEmergencyWater(dt){
  const z=walkGround(px,py)+.17,slope=pitch*rows/projY,hit=hoseHit(px,py,z,a,slope);
  let end=hit?[hit.node.x,hit.node.y,hit.node.z]:[worldCoord(px+Math.cos(a)*2.6),worldCoord(py+Math.sin(a)*2.6),z+slope*2.6];
  if(!hit)for(let d=.08;d<2.6;d+=.025){
    const x=worldCoord(px+Math.cos(a)*d),y=worldCoord(py+Math.sin(a)*d),zz=z+slope*d;
    if(map[idx(x,y)]>zz||zz<terrainHeight(x,y)||solidAt(x,y,.003)){end=[x,y,Math.max(terrainHeight(x,y),zz)];break;}
  }
  rememberWater('self',[px+Math.cos(a)*.08-Math.sin(a)*.026,py+Math.sin(a)*.08+Math.cos(a)*.026,z-.022],end);
  if(hit&&incidentOwned(hit.fire))coolFireNode(hit.fire,hit.node,dt);
  if((emergencyWaterT-=dt)<=0){
    emergencyWaterT=.15;
    if(typeof netSendWater==='function')netSendWater({x:px,y:py,z,yaw:a,slope,end,fire:hit?.fire.id||null,dt:.15});
  }
}
function stepEmergencyWater(dt){
  if(emergencyHoseReady()&&(K.KeyQ||K.MouseUse))sprayEmergencyWater(dt);
  else emergencyWaterT=0;
  if((emergencySmokeT-=dt)<=0){
    emergencySmokeT=.3;
    for(const f of cityFires)if(fireActive(f)&&near(f.x,f.y,px,py)<18){
      const n=f.nodes.find(n=>n.heat>0);if(n)worldPuff(n.x,n.y,n.z+.08,.04,.17,'soot',3,.08);
    }
  }
}
function drawWaterStream(from,to){
  const [x,y,z]=from,ex=rel(to[0]-x),ey=rel(to[1]-y),ez=to[2]-z,[vx,vy]=R(x,y);
  const shade=(i,t,L)=>{const h=hash(i,Math.floor(T*25),93);BG[i]=C(h>.7?WHITE:CYAN,Math.max(6,L*.6)+h*4);set(i,' ',0);return true;};
  for(let j=0;j<10;j++){
    const t=j/10,u=(j+1)/10,at=q=>[vx+ex*q,vy+ey*q,z+ez*q-.035*q*(1-q)];
    drawRod(...at(t),...at(u),.003+t*.006,shade);
  }
  // Breaking droplets at the exact impact point, rather than an opaque cone.
  for(let j=0;j<5;j++){
    const q=fract(T*3+j*.21),s=(j-2)*.008;
    drawRod(vx+ex+s,vy+ey, to[2]+.015,vx+ex+s*2,vy+ey+s,to[2]-.035*q,.002,shade);
  }
}
const emergencyCrewLook=figLook({hat:'hardhat',top:'long',bot:'pants',col:{hat:[YEL,13],top:[YEL,9],bot:[GRAY,4],shoe:[GRAY,2]}});
function emergencySprites(){
  for(const f of cityFires){
    if(near(f.x,f.y,px,py)>vis+1)continue;
    if(f.kind==='building')for(const [k,n]of f.nodes.entries())if(n.heat>0){
      const [vx,vy]=R(n.x,n.y),strength=Math.max(.15,n.heat/n.max);
      const shade=(i,t,L)=>{const h=hash(i,Math.floor(T*17),f.id.length+k);if(h<.18)return false;BG[i]=C(h>.72?YEL:h>.3?ORANGE:RED,8+h*7);set(i,' ',0);return true;};
      for(let j=0;j<3;j++){
        const sway=Math.sin(T*(6+j)+k*2+j)*.015,height=(.065+.075*Math.abs(Math.sin(T*(7+j)+k)))*strength;
        drawRod(vx+(j-1)*.025,vy,n.z-.045,vx+(j-1)*.025+sway,vy,n.z+height,.014*strength,shade);
      }
    }
    const c=cars.find(c=>c.ev&&!c.mine&&c.fireIncident===f&&!c.home),remote=f.remoteCrew;
    const n=c?fireCrewTarget(c):remote?.state==='scene'&&f.nodes.find(n=>n.heat>0);
    if(remote&&!c){const [vx,vy]=R(remote.x,remote.y);drawVehicle({kind:'fire',body:RED,ev:true,state:remote.state,v:remote.v||0},vx,vy,remote.hx,remote.hy);}
    if(n){
      const crew=c||remote,origin=fireCrewOrigin(crew,f),[vx,vy]=R(origin[0],origin[1]);
      drawFigure(vx,vy,walkGround(origin[0],origin[1]),.175,rel(n.x-origin[0]),rel(n.y-origin[1]),emergencyCrewLook,'aim');
      drawWaterStream(origin,[n.x,n.y,n.z]);
    }
  }
  for(const f of medicalCalls)if(!f.out&&f.stage==='waiting'&&near(f.x,f.y,px,py)<vis){
    drawFigure(...R(f.x,f.y),walkGround(f.x,f.y),.175,0,-1,f.look,'sit0');
    drawArt(...R(f.x,f.y),.20,.035,.055,['+'],()=>C(CYAN,15));
  }
  for(const [key,s]of emergencyStreams){if(s.until<netNow()){emergencyStreams.delete(key);continue;}drawWaterStream(s.from,s.to);}
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
