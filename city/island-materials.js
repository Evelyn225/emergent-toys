// Normals follow the actual convex rock or rotated box, rather than stale HIT
// normals left by an earlier primitive. Small grooves filter in world units.
function islandModelNormal(m){
 if(m.planes){const n=m.planes[HIT.face],length=Math.hypot(n[0],n[1],n[2]);return[n[0]/length,n[1]/length,n[2]/length];}
 const n=HIT.face===1?[1,0,0]:HIT.face===2?[-1,0,0]:HIT.face===3?[0,1,0]:HIT.face===4?[0,-1,0]:HIT.face===5?[0,0,1]:[0,0,-1];
 return[(m.c??1)*n[0]-(m.s||0)*n[1],(m.s||0)*n[0]+(m.c??1)*n[1],n[2]];
}
const ISLAND_SHRUB_MODELS=new WeakMap();
function drawIslandPlantModel(m,x,y){
 if(m.kind==='grass'){
  const height=m.z1-m.z0;
  drawShape(x,y,m.z0,m.hl,height,(i,u,z,du,dz,L)=>{
   const n=(u-Math.sin(T*1.3+(m.seed||0)*12)*.006*z/height)/m.hl;
   if(Math.abs(n)>.8*(1-z/height)||Math.abs(Math.sin(n*12+z*15))<.7)return false;
   BG[i]=C(seasonIdx()===3?WARM:YEL,1+L*.35);set(i,' ',0);return true;
  });return;
 }
 let parts=ISLAND_SHRUB_MODELS.get(m);
 if(!parts){
  const h=m.z1-m.z0;parts=[[-.32,0,.42,.67],[.28,.08,.56,.82],[0,-.18,.67,1]].map(([u,v,z,top])=>{
   const r=top===1?.64:.58,b=boxAt(u*m.hl,v*m.hw,1,0,m.hl*r,m.hw*r,m.z0+Math.max(0,z-.34)*h,m.z0+top*h);
   return{role:'foliage',box:b,view:{...b},ray:homeRayEllipsoid,shade:(i,t,L)=>{const height=(HIT.w-m.z0)/h,detail=coveDetail(t,.08)*(Math.sin(HIT.u*65+HIT.w*71)*.15);BG[i]=C(seasonIdx()===2?WARM:GREEN,(1.2+L*.27*coveLight(HIT.nx,HIT.ny,HIT.nz))*(seasonIdx()===3?.75:1)+height*.7+detail);set(i,' ',0);if(HIT.nz>.4)paintSettledSnow(i,m.x+b.x+HIT.u,m.y+b.y+HIT.v,L,HIT.nz,0,HIT.w);return true;}};
  });
  const trunk=boxAt(0,0,1,0,m.hl*.055,m.hw*.055,m.z0-.003,m.z0+h*.5);
  parts.unshift({role:'stem',box:trunk,view:{...trunk},ray:rayBox,shade:(i,t,L)=>{BG[i]=C(BRICK,1+L*.25);set(i,' ',0);return true;}});
  ISLAND_SHRUB_MODELS.set(m,parts);
 }
 for(const p of parts){p.view.x=x+p.box.x;p.view.y=y+p.box.y;drawBox(p.view,p.shade,p.ray);}
}
// Only the land marks become tones; creek water, swash, foam and all their
// timing/height fields return unchanged. The airstrip dash becomes yellow paint.
const ISLAND_LAND_SURFACE=islandSurface,ISLAND_LAND_SHORE=islandShoreSurface;
islandSurface=(...args)=>{
 const s=ISLAND_LAND_SURFACE(...args);if(s&&!s.water){if(s.ch==='='){s.background=YEL;s.lift=3;s.tone=1.2;}s.ch=' ';}return s;
};
islandShoreSurface=(...args)=>{const s=ISLAND_LAND_SHORE(...args);if(!s.water)s.ch=' ';return s;};
