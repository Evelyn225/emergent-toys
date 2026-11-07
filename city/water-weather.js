// Prepared flowing sheets keep their real terrain-fitted planes and depth.
const WATER_CASCADE_MODELS=new WeakMap();
function drawWaterCascadeSheet(sheet){
 let model=WATER_CASCADE_MODELS.get(sheet);
 if(!model){
  model={view:{...sheet,planeData:roofPlaneData(sheet.planes)},shade:(i,t,L)=>{
   const y=sheet.y+HIT.v,fp=t/projY,normal=sheet.planes[4],length=Math.hypot(normal[0],normal[1],normal[2]);
   const front=coveGroove(y-T*(2.4/11)+Math.sin(HIT.u*31)*(.25/11),1/11,.018,fp);
   const light=coveLight(0,normal[1]/length,normal[2]/length),foam=front;
   BG[i]=C(foam>.65?WHITE:foam>.25?CYAN:BLUE,1.5+day*2+L*.2*light+foam*(2+day*3));set(i,' ',0);return true;
  }};
  WATER_CASCADE_MODELS.set(sheet,model);
 }
 model.view.x=sheet.x-px;model.view.y=sheet.y-py;drawBox(model.view,model.shade,rayMansard);
}
// Precipitation and settled snow use the same actual overhead geometry. The
// convex interval preserves the arch's opening; its top still catches snow.
const WATER_WEATHER_BOUNDS=[Math.min(...WILD_ISLANDS.map(i=>i.x-i.rx-2)),Math.min(...WILD_ISLANDS.map(i=>i.y-i.ry-2)),Math.max(...WILD_ISLANDS.map(i=>i.x+i.rx+2)),Math.max(...WILD_ISLANDS.map(i=>i.y+i.ry+2))];
function waterWeatherCoverAt(x,y,z){
 if(x<WATER_WEATHER_BOUNDS[0]||y<WATER_WEATHER_BOUNDS[1]||x>WATER_WEATHER_BOUNDS[2]||y>WATER_WEATHER_BOUNDS[3])return false;
 if(islandRoofHeight(x,y)>z+.02)return true;
 for(const g of ISLAND_LANDMARKS){
  const root=g.root;if(Math.abs(x-g.x)>root.hl||Math.abs(y-g.y)>root.hw||root.z1<=z+.02)continue;
  for(const p of g.parts){if(p.z1<=z+.02)continue;const span=islandLandmarkInterval(p,x,y);if(span&&span[1]>z+.02)return true;}
 }
 return false;
}
const WATER_WEATHER_SNOW=snowExposed;
snowExposed=(x,y,z=0)=>WATER_WEATHER_SNOW(x,y,z)&&!waterWeatherCoverAt(x,y,z);
