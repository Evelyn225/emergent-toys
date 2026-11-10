// Local surface water from the shared hose streams. It never changes the weather.
const hoseWetPatches=[],HOSE_WET_MAX=96;
function hoseSurfaceHit(from,to){
 const ex=rel(to[0]-from[0]),ey=rel(to[1]-from[1]),ez=to[2]-from[2],len=Math.hypot(ex,ey,ez);
 if(len<.01)return null;
 const extend=Math.min(.22,len*.35),end=[from[0]+ex*(1+extend/len),from[1]+ey*(1+extend/len),from[2]+ez*(1+extend/len)];
 let best=peeObjectHit(...from,...end,true);
 const offer=h=>{if(h&&(!best||h.t<best.t))best=h;};
 for(const c of cars)if(!c.wrecked||c.fireIncident){const v=VEHICLES[c.kind];if(v&&near(c.x,c.y,from[0],from[1])<3.5)offer(peeBoxHit(...from,...end,{x:c.x,y:c.y,c:c.hx,s:c.hy,hl:v[0],hw:v[1],z0:terrainHeight(c.x,c.y),z1:terrainHeight(c.x,c.y)+v[2]}));}
 const steps=Math.ceil(len/.018);let prev=from;
 for(let k=1;k<=steps;k++){
  const t=k/steps,p=from.map((v,j)=>v+(end[j]-v)*t),x=worldCoord(p[0]),y=worldCoord(p[1]),ground=terrainHeight(x,y),height=map[idx(x,y)];
  if(height>p[2]){const hit=peeWallHit(...prev,...p,height);if(hit){hit.t=(k-1+hit.t)/steps;offer(hit);}break;}
  if(p[2]<=ground){let lo=(k-1)/steps,hi=t;for(let n=0;n<9;n++){const m=(lo+hi)/2,xx=from[0]+(end[0]-from[0])*m,yy=from[1]+(end[1]-from[1])*m,zz=from[2]+(end[2]-from[2])*m;if(zz<=terrainHeight(xx,yy))hi=m;else lo=m;}offer({t:hi,x:from[0]+(end[0]-from[0])*hi,y:from[1]+(end[1]-from[1])*hi,z:terrainHeight(x,y),nx:0,ny:0,nz:1});break;}
  prev=p;
 }
 if(best){best.x=worldCoord(best.x);best.y=worldCoord(best.y);}return best;
}
function addHoseWetPatch(hit,dt){
 if(!hit||hit.nz<0||isWater(hit.x,hit.y))return;
 let q=hoseWetPatches.find(q=>q.nx*hit.nx+q.ny*hit.ny+q.nz*hit.nz>.95&&Math.hypot(rel(q.x-hit.x),rel(q.y-hit.y),q.z-hit.z)<.055);
 if(!q){if(hoseWetPatches.length>=HOSE_WET_MAX)hoseWetPatches.shift();q={x:hit.x,y:hit.y,z:hit.z,nx:hit.nx,ny:hit.ny,nz:hit.nz,water:0,life:1,drip:.1,seed:hash(Math.floor(hit.x*300),Math.floor(hit.y*300),419)};hoseWetPatches.push(q);}
 q.water=Math.min(1,q.water+dt*.65);q.life=1;
}
function wetHoseImpact(hit,dt){
 addHoseWetPatch(hit,dt);
 if(hit&&!hit.nz){const x=hit.x+hit.nx*.012,y=hit.y+hit.ny*.012;addHoseWetPatch({x,y,z:terrainHeight(x,y),nx:0,ny:0,nz:1},dt*.6);}
}
function stepHoseWetness(dt){
 for(let k=hoseWetPatches.length-1;k>=0;k--){const q=hoseWetPatches[k];q.life-=dt/180;
  if(q.life<=0){hoseWetPatches.splice(k,1);continue;}
  if(q.nz||q.water<.08||mode==='room'||near(q.x,q.y,px,py)>vis)continue;
  if((q.drip-=dt)>0)continue;q.drip=.15+(1-q.water)*.6;
  const offset=(noise(q.seed*20,T*.6,412)-.5)*(.025+.06*q.water),x=q.x+q.nx*.004-q.ny*offset,y=q.y+q.ny*.004+q.nx*offset;
  partAdd({kind:'drip',x,y,z:q.z-.01,vx:0,vy:0,vz:-.015,age:0,life:4,ground:terrainHeight(x,y),seed:q.seed});
 }
}
function drawHoseWetness(){
 if(mode==='room'||!hoseWetPatches.length)return;
 for(const q of hoseWetPatches){
  const [vx,vy]=R(q.x,q.y),depth=dx*vx+dy*vy,radius=(.035+.11*Math.sqrt(q.water))*Math.sqrt(q.life);
  if(depth<.04||depth>vis||Math.hypot(vx,vy)>vis||q.nx*-vx+q.ny*-vy+q.nz*(eye-q.z)<=0)continue;
  // Conservative projected bounds, then intersect each ray with the actual surface plane.
  const nearDepth=Math.max(.03,depth-radius),cx=cols/2+(-dy*vx+dx*vy)*projX/depth,cy=hor-(q.z-eye)*projY/depth;
  const rx_=radius*projX/nearDepth*2,ry_=radius*projY/nearDepth*2;
  for(let r=Math.max(0,Math.floor(cy-ry_));r<Math.min(rows,Math.ceil(cy+ry_));r++)for(let c=Math.max(0,Math.floor(cx-rx_));c<Math.min(cols,Math.ceil(cx+rx_));c++){
   const i=r*cols+c,tan=(2*(c+.5)/cols-1)*tf,rx=dx-dy*tan,ry=dy+dx*tan,rz=(hor-r-.5)/projY,den=q.nx*rx+q.ny*ry+q.nz*rz;
   if(Math.abs(den)<1e-6)continue;const t=(q.nx*vx+q.ny*vy+q.nz*(q.z-eye))/den;
   if(t<=0||Math.abs(ZBG[i]-t)>Math.max(.003,t*.004)||BG[i]===NONE)continue;
   const x=rx*t-vx,y=ry*t-vy,z=eye+rz*t-q.z,u=q.nz?x:-q.ny*x+q.nx*y,v=q.nz?y:z;
   const edge=Math.hypot(u/radius,v/(radius*(q.nz?1:1.6)))+(noise((q.x+x)*25,(q.y+y+z)*25,417)-.5)*.24;
   if(edge>1)continue;const strength=q.life*Math.min(1,(1-edge)*4),bg=BG[i];
   BG[i]=hazeTint(bg,C(bg>>4,(bg&15)*.6),strength*.65);
   if(q.nz&&q.water>.12&&edge<.8){FL[i]=2;ZBG[i]=t;}
  }
 }
}
