// Planting on the finished city: kerb troughs leave the 1.2 m walking line free;
// park shrubs stay off paths, ponds, trees, benches and the skate areas.
const PLANTER = { hl:.09, hw:.035, top:.065, wall:.008, soil:.052 };
const SHRUB_CLUMPS = [
  {u:-.065,v:0,z:.075,r:.07,h:.07},
  {u:0,v:0,z:.10,r:.08,h:.085},
  {u:.065,v:0,z:.078,r:.07,h:.073}
];
const PLANTER_PARTS = [
  {u:0,v:0,hl:PLANTER.hl,hw:PLANTER.hw,z0:0,z1:.01,role:'base'},
  ...[-1,1].flatMap(side=>[
    {u:0,v:side*(PLANTER.hw-PLANTER.wall/2),hl:PLANTER.hl,hw:PLANTER.wall/2,z0:.01,z1:PLANTER.top,role:'wall'},
    {u:side*(PLANTER.hl-PLANTER.wall/2),v:0,hl:PLANTER.wall/2,hw:PLANTER.hw-PLANTER.wall,z0:.01,z1:PLANTER.top,role:'wall'}
  ]),
  {u:0,v:0,hl:PLANTER.hl-PLANTER.wall,hw:PLANTER.hw-PLANTER.wall,z0:.01,z1:PLANTER.soil,role:'soil'}
];
function plantingFootprint(o,u,v,pad,lo,hi) {
  if(o.kind==='planter')return hi>=0&&lo<=PLANTER.top&&Math.hypot(Math.max(0,Math.abs(u)-PLANTER.hl),Math.max(0,Math.abs(v)-PLANTER.hw))<=pad;
  return SHRUB_CLUMPS.some(q=>{
    const dz=Math.max(lo-q.z,q.z-hi,0)/q.h;
    return dz<=1&&Math.hypot(u-q.u,v-q.v)<=q.r*Math.sqrt(1-dz*dz)+pad;
  });
}
const PLANTER_CLUMPS=[-.055,0,.055].map((u,k)=>({u,v:0,z:PLANTER.soil+.035+(k===1?.008:0),r:.034,h:.045}));
function buildPlantingModel(o,near) {
  const view={z:0},parts=[];
  const add=(p,leaf=false)=>{
    const box=boxAt(o.c*p.u-o.s*p.v,o.s*p.u+o.c*p.v,o.c,o.s,leaf?p.r:p.hl,leaf?p.r:p.hw,leaf?p.z-p.h:p.z0,leaf?p.z+p.h:p.z1);
    const shade=(i,t,L)=>{
      if(leaf){
        const height=(HIT.w-view.z-box.z0)/(box.z1-box.z0),fine=near?clamp(1-t/projY/.015,0,1):0;
        const detail=leafClump(HIT.u/p.r*2+o.seed*7,height*3)*fine;
        const sn=seasonIdx(),autumn=o.kind==='planter'&&sn===2;
        BG[i]=C(autumn?ORANGE:GREEN,(1.1+L*.25)*(.65+height*.65+detail)*(sn===3?.8:1));
      }else{
        const top=HIT.face===5,soil=p.role==='soil';
        BG[i]=C(soil?BRICK:o.col,soil?.6+L*.075:(1.6+L*.3)*shadeFace(HIT.face)+(top?.8:0));
      }
      set(i,' ',0);
      const exposure=leaf?HIT.nz:HIT.face===5?1:0;
      if(exposure>.5){paintSettledSnow(i,o.x+o.c*(p.u+HIT.u)-o.s*(p.v+HIT.v),o.y+o.s*(p.u+HIT.u)+o.c*(p.v+HIT.v),L*.7,exposure,0,HIT.w);set(i,' ',0);}
      return true;
    };
    const ray=leaf?homeRayEllipsoid:rayBox,local={...box};
    const shiftedRay=(ox,oy,oz,rx,ry,rz,B)=>{
      const height=B.z0-box.z0;local.x=B.x;local.y=B.y;
      const t=ray(ox,oy,oz-height,rx,ry,rz,local);if(t>=0)HIT.w+=height;return t;
    };
    parts.push({role:leaf?'leaves':p.role,box,shade,ray,shiftedRay});
  };
  if(o.kind==='planter')for(const p of PLANTER_PARTS)add(p);
  for(const p of o.kind==='planter'?PLANTER_CLUMPS:SHRUB_CLUMPS)add(p,true);
  return {parts,draw(x,y,z){view.z=z;for(const p of parts)drawBox({...p.box,x:x+p.box.x,y:y+p.box.y,z0:z+p.box.z0,z1:z+p.box.z1},p.shade,p.shiftedRay);}};
}
const drawStreetPlanter=(o,x,y,z,near)=>kerbModel(o,near).draw(x,y,z);
const drawParkShrub=drawStreetPlanter;
KERB_KINDS.planter={hl:PLANTER.hl,hw:PLANTER.hw,h:.15};
KERB_DRAW.planter=drawStreetPlanter;
const parkShrubs=[],parkShrubsB=bucketed([]),parkShrubCells=new Uint8Array(N*N);
function parkShrubAt(x,y,pad,z=null,height=Infinity){
  if(pad<=.4&&!parkShrubCells[idx(x,y)])return null;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const o of parkShrubsB[bi(Math.floor(x/8)+i,Math.floor(y/8)+j)]){
    const lo=z===null?0:z-terrainHeight(o.x,o.y);
    if(plantingFootprint(o,rel(x-o.x),rel(y-o.y),pad,lo,lo+height))return o;
  }return null;
}
function drawParkShrubs(){forNear(parkShrubsB,o=>{const[x,y]=R(o.x,o.y),d=Math.hypot(x,y);if(d>Math.min(vis,9*lodScale())||!inView(x,y,o.hl))return;drawParkShrub(o,x,y,terrainHeight(o.x,o.y),d<KERB_NEAR*lodScale());});}
for(const edge of [CURB,2-CURB])alongStreets(4.5,edge,(x,y,ax,ay,bx,by)=>{
  const district=districtAt(x-ax*.5,y-ay*.5);
  if(!['midtown','brownstones','chinatown'].includes(district)||hash(bx,by,edge<1?1961:1962)>.32)return;
  if(SKATE_SPOTS.some(p=>p.id.startsWith('skate-kerb:')&&Math.hypot(rel(p.x-x),rel(p.y-y))<4))return;
  addKerb(x,y,'planter',ax,ay,{col:district==='midtown'?STONE:BRICK});
});
// Leave the east/south park edges available for the concurrent street-skate lines.
for(const [bx,by] of parks)for(const [u,v] of [[2.2,2.2],[2.2,4.2],[4.2,2.2],[4.2,4.2]]){
  const x=bx*8+u,y=by*8+v,hl=.14,hw=.09,z=terrainHeight(x,y);
  if(map[idx(x,y)]||ROAD[idx(x,y)]||isWater(x,y)||inPond(u,v,bx,by,.4))continue;
  if(trees.some(t=>Math.hypot(rel(t.x-x),rel(t.y-y))<.4)||benches.some(b=>Math.hypot(rel(b.x-x),rel(b.y-y))<.5))continue;
  if(SKATE_PATCHES.some(p=>Math.abs(rel(x-p.x))<p.hl+.3&&Math.abs(rel(y-p.y))<p.hw+.3))continue;
  if([-1,1].some(s=>Math.abs(terrainHeight(x+s*hl,y)-z)>.002||Math.abs(terrainHeight(x,y+s*hw)-z)>.002))continue;
  const o={x,y,c:1,s:0,hl,hw,h:.19,kind:'shrub',seed:hash(x,y,1963)};
  if(streetGeometryCollision({...o,z0:z,z1:z+o.h},true)||streetEntranceCollision({...o,z0:z,z1:z+o.h}))continue;
  parkShrubs.push(o);parkShrubsB[bi(Math.floor(x/8),Math.floor(y/8))].push(o);
  for(let ix=Math.floor(x-hl-.4);ix<=Math.floor(x+hl+.4);ix++)for(let iy=Math.floor(y-hw-.4);iy<=Math.floor(y+hw+.4);iy++)parkShrubCells[idx(ix,iy)]=1;
}
