// Small, deterministic gatherings live on clear beach/grass patches, never on streets or landings.
const COAST_GATHERINGS=[];
function coastPatchClear(x,y,r=.8){
 const base=terrainHeight(x,y);
 for(const [ox,oy]of [[0,0],[r,r],[r,-r],[-r,r],[-r,-r]]){
  const wx=x+ox,wy=y+oy;
  if(seaAt(wx,wy)||onPier(wx,wy)||ROAD[idx(wx,wy)]||map[idx(wx,wy)]||Math.abs(terrainHeight(wx,wy)-base)>.04)return false;
 }
 return !solids.some(s=>near(s.x,s.y,x,y)<r+.3)&&!trees.some(t=>near(t.x,t.y,x,y)<r*.8)&&!doors.some(d=>near(d.x,d.y,x,y)<2);
}
function buildCoastLife(){
 COAST_GATHERINGS.length=0;
 const candidates=[];
 for(let y=74;y<410;y+=3)for(let x=58;x<470;x+=3){
  if(!naturalCoastAt(x,y))continue;
  const ground=coastalGround(x,y);
  if(ground.depth>1.1&&ground.depth<3.2&&coastPatchClear(x,y))candidates.push({x,y,beach:ground.beach,seed:hash(x,y,9621)});
 }
 for(const island of WILD_ISLANDS)for(let y=island.y-island.ry;y<island.y+island.ry;y+=3)for(let x=island.x-island.rx;x<island.x+island.rx;x+=3){
  const edge=wildIslandEdge(x,y,island);
  if(edge>1.4&&edge<3.5&&near(x,y,...island.landing)>4&&!onFernStrip(x,y,5)&&coastPatchClear(x,y))candidates.push({x,y,beach:island.id==='sand',seed:hash(x,y,9621)});
 }
 candidates.sort((a,b)=>a.seed-b.seed);
 for(const site of candidates){
  if(COAST_GATHERINGS.length>=24)break;
  if(COAST_GATHERINGS.some(o=>near(o.x,o.y,site.x,site.y)<16))continue;
  const z=terrainHeight(site.x,site.y),index=COAST_GATHERINGS.length,fire=index%3===1;
  const group={...site,z,fire,people:[]};COAST_GATHERINGS.push(group);
  const cloth=islandDetail(site.x,site.y,.29,.22,z+.003,z+.006,'cloth');cloth.base=index%2?BLUE:RED;cloth.seed=site.seed;
  islandDetail(site.x+.16,site.y+.04,.045,.035,z+.006,z+.07,'timber');
  for(let n=0;n<3+(index%2);n++){
   const angle=n*TAU/4+.35,x=site.x+Math.cos(angle)*.32,y=site.y+Math.sin(angle)*.32;
   group.people.push({x,y,z:terrainHeight(x,y)+.004,seed:index*17+n,pose:n===2?'stand':'sit2',look:figStreetLook(9670+index*17+n,[BLUE,GREEN,MAG,ORANGE][n],BLUE)});
  }
  if(fire){const o={x:site.x-.58,y:site.y+.1,z:terrainHeight(site.x-.58,site.y+.1),on:'fire',nightOnly:true};group.campfire=o;GRILLS.push(o);FIRES.push(o);}
  for(let n=0;n<9;n++){
   const a=n*TAU/9,x=site.x+Math.cos(a)*(.85+n*.035),y=site.y+Math.sin(a)*(.85+n*.035);
   if(!coastPatchClear(x,y,.12))continue;
   islandCover(x,y,n%3?'flower':'fern',hash(x,y,9622),.2);
  }
 }
}
function coastGroupActive(group){return season()!=='winter'&&rain<.45&&tod>=8&&(tod<21||group.fire);}
function coastFigureTargets(){
 const out=[];
 for(const group of COAST_GATHERINGS)for(const p of group.people)if(p.dead||coastGroupActive(group))out.push(sceneFigureTarget(p,p.x,p.y,p.z));
 return out;
}
function drawCoastLife(){
 for(const group of COAST_GATHERINGS){
  if(near(px,py,group.x,group.y)>Math.min(vis,18))continue;
  for(const p of group.people){
   if(!p.dead&&!coastGroupActive(group)||!inView(rel(p.x-px),rel(p.y-py),.2))continue;
   const face=Math.atan2(group.y-p.y,group.x-p.x);
   drawSceneFigure(sceneFigureTarget(p,p.x,p.y,p.z),p.look,p.pose,Math.cos(face),Math.sin(face));
  }
 }
}
