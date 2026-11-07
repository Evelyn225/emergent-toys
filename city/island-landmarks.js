// Island landmarks prepare closed convex pieces once on the finished terrain.
// The same planes provide drawing, walking clearance and height queries.
const ISLAND_LANDMARKS=[];
function islandLandmarkGroup(id,x,y){const g={id,x,y,parts:[],ground:terrainHeight(x,y)};ISLAND_LANDMARKS.push(g);return g;}
function islandLandmarkPrism(g,polygon,y0,y1,material='stone',role='stone'){
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),lo=Math.min(...xs),hi=Math.max(...xs),cx=(lo+hi)/2,cy=(y0+y1)/2;
 const middle=polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]);
 const planes=[[0,1,0,(y1-y0)/2],[0,-1,0,(y1-y0)/2]];
 for(let k=0;k<polygon.length;k++){
  const a=polygon[k],b=polygon[(k+1)%polygon.length];let nx=b[1]-a[1],nz=a[0]-b[0],d=nx*a[0]+nz*a[1];
  if(nx*middle[0]+nz*middle[1]>d){nx=-nx;nz=-nz;d=-d;}
  planes.push([nx,0,nz,d-nx*cx]);
 }
 const p={x:g.x+cx,y:g.y+cy,c:1,s:0,hl:(hi-lo)/2,hw:(y1-y0)/2,z0:Math.min(...zs),z1:Math.max(...zs),planes,material,role,landmarkPart:true};
 p.planeData=roofPlaneData(planes);p.view={...p};p.shade=(i,t,L)=>islandLandmarkShade(p,i,t,L);g.parts.push(p);ISLAND_OBSTACLES.push(p);return p;
}
function islandLandmarkBox(g,x,y,hl,hw,z0,z1,material,role){return islandLandmarkPrism(g,[[x-hl,z0],[x+hl,z0],[x+hl,z1],[x-hl,z1]],y-hw,y+hw,material,role);}
function islandLandmarkFoot(g,x,y,hl,hw){return Math.min(...[[-hl,-hw],[hl,-hw],[-hl,hw],[hl,hw],[0,0]].map(([u,v])=>terrainHeight(g.x+x+u,g.y+y+v)))-.012;}
function islandLandmarkFinish(g){
 const minX=Math.min(...g.parts.map(p=>p.x-p.hl)),maxX=Math.max(...g.parts.map(p=>p.x+p.hl)),minY=Math.min(...g.parts.map(p=>p.y-p.hw)),maxY=Math.max(...g.parts.map(p=>p.y+p.hw));
 const root=islandDetail(g.x,g.y,Math.max(g.x-minX,maxX-g.x),Math.max(g.y-minY,maxY-g.y),Math.min(...g.parts.map(p=>p.z0)),Math.max(...g.parts.map(p=>p.z1)),'landmark');root.landmark=g;g.root=root;
}
function islandLandmarkShade(p,i,t,L){
 const n=p.planes[HIT.face],len=Math.hypot(n[0],n[1],n[2]),nx=n[0]/len,ny=n[1]/len,nz=n[2]/len;
 const fine=coveDetail(t,.1),fp=t/projY,wood=p.material==='wood'||p.material==='bleached',wx=p.x+HIT.u,wy=p.y+HIT.v;
 let base=p.material==='canvas'?GREEN:p.material==='flower'?(seasonIdx()===2?WARM:MAG):p.material==='soil'?BRICK:wood?(p.material==='bleached'?GRAY:BRICK):GRAY;
 let detail=wood?Math.sin(HIT.w*210+Math.sin(wx*7))*fine*.3:Math.sin(wx*17+wy*11+HIT.w*31)*fine*.16;
 if(p.material==='stone'){detail-=coveGroove(HIT.w+Math.sin(wx*3)*.006,.15,.01,fp)*1.6;detail+=(hash(Math.floor(HIT.w/.15),3,331)-.5)*.9;}
 BG[i]=C(base,(p.material==='soil'?.7:1.7)*(.35+.65*day)+L*.30*coveLight(nx,ny,nz)+detail);
 set(i,' ',0);
 if(nz>.35&&p.material!=='flower'&&!(p.role==='crate'||p.role==='lid'))paintSettledSnow(i,wx,wy,L,nz,0,HIT.w);
 return true;
}
function drawIslandLandmark(g,vx,vy){
 for(const p of g.parts){if(seasonIdx()===3&&(p.role==='bloom'||p.role==='stem'))continue;p.view.x=vx+p.x-g.x;p.view.y=vy+p.y-g.y;drawBox(p.view,p.shade,rayMansard);}
}
function islandLandmarkInterval(p,x,y,pad=0){
 const u=x-p.x,v=y-p.y;if(Math.abs(u)>p.hl+pad||Math.abs(v)>p.hw+pad)return null;
 let lo=p.z0,hi=p.z1;
 for(const[nx,ny,nz,d]of p.planes){const limit=d-nx*u-ny*v+pad*Math.hypot(nx,ny);if(Math.abs(nz)<1e-12){if(limit<0)return null;}else if(nz>0)hi=Math.min(hi,limit/nz);else lo=Math.max(lo,limit/nz);}
 return lo<=hi?[lo,hi]:null;
}
function buildIslandArch(){
 const g=islandLandmarkGroup('cormorant-arch',695.8,357.5),sample=[];
 for(const x of [-.8,.8])for(const y of [-.28,.28])sample.push(terrainHeight(g.x+x,g.y+y));
 const base=Math.max(...sample);g.spring=base+.30;
 // A remnant of bedrock with an eroded, off-centre opening: no matching
 // columns, ring thickness or semicircular crown. Adjacent facets share edges.
 const xs=[-1.25,-1.03,-.82,-.58,-.34,-.10,.15,.40,.67,.88,1.08,1.26];
 const tops=[.20,.62,.94,1.18,1.24,1.13,1.17,1.02,.88,.91,.53,.15];
 const opening=[null,null,null,.30,.74,.80,.73,.58,.30,null,null,null];
 const depths=[.16,.24,.32,.28,.27,.24,.31,.29,.36,.26,.22,.12];
 for(let k=0;k<xs.length-1;k++){
  const x0=xs[k],x1=xs[k+1],cx=(x0+x1)/2,half=(x1-x0)/2,depth=(depths[k]+depths[k+1])/2;
  const bottom=islandLandmarkFoot(g,cx,0,half,depth),a=opening[k]===null?bottom:base+opening[k],b=opening[k+1]===null?bottom:base+opening[k+1];
  const offset=Math.sin(k*2.1)*.035;
  islandLandmarkPrism(g,[[x0,a],[x1,b],[x1,base+tops[k+1]],[x0,base+tops[k]]],offset-depth,offset+depth,'stone',opening[k]===null&&opening[k+1]===null?'pier':'arch');
 }
 for(const [x,y,w,h]of [[-1.18,.30,.23,.17],[.98,-.30,.20,.14]]){
  const foot=islandLandmarkFoot(g,x,y,w,.20),top=terrainHeight(g.x+x,g.y+y)+h;
  islandLandmarkPrism(g,[[x-w,foot],[x+w,foot],[x+w*.7,top-.035],[x-w*.25,top],[x-w*.8,top-.055]],y-.20,y+.20,'stone','pier');
 }
 islandLandmarkFinish(g);
}
function buildIslandWreck(){
 const g=islandLandmarkGroup('crescent-wreck',710.3,113.35),z=g.ground;g.keel=z-.025;
 // A narrow buried keel and open bent side planks, with separate inner ribs.
 islandLandmarkBox(g,0,0,.40,.018,z-.04,z+.005,'bleached','keel');
 const nodes=Array.from({length:9},(_,k)=>{const u=(k-4)*.10;return{u,width:.125*Math.sqrt(Math.max(0,1-(u/.415)**2)),lift:.025+.045*(u/.4)**2};});
 for(const side of [-1,1])for(let k=0;k<nodes.length-1;k++){
  const a=nodes[k],b=nodes[k+1],ym=side*(a.width+b.width)/2,hw=Math.abs(a.width-b.width)/2+.012;
  islandLandmarkPrism(g,[[a.u,z+a.lift],[b.u,z+b.lift],[b.u,z+b.lift+.055],[a.u,z+a.lift+.055]],ym-hw,ym+hw,'bleached','hull');
 }
 for(const u of [-.27,-.09,.09,.27]){
  const w=.125*Math.sqrt(1-(u/.415)**2);
  islandLandmarkBox(g,u,0,.012,w,z-.008,z+.012,'wood','rib-floor');
  for(const side of [-1,1])islandLandmarkBox(g,u,side*(w-.014),.012,.012,z+.012,z+.082,'wood','rib-side');
 }
 // One broken thwart remains; the empty hull stays visibly open to the sand.
 islandLandmarkBox(g,-.09,0,.034,.11,z+.075,z+.089,'wood','thwart');
 islandLandmarkFinish(g);
}
function buildIslandCamp(){
 const g=islandLandmarkGroup('fern-camp-shelter',529.8,240.3),corners=[];
 for(const x of [-.27,.27])for(const y of [-.17,.17])corners.push(terrainHeight(g.x+x,g.y+y));
 const z=Math.max(...corners),roof=x=>z+.285-x*.075;
 for(const x of [-.27,.27])for(const y of [-.17,.17])islandLandmarkBox(g,x,y,.014,.014,islandLandmarkFoot(g,x,y,.014,.014),roof(x)-.012,'wood','post');
 islandLandmarkPrism(g,[[-.34,roof(-.34)-.012],[.34,roof(.34)-.012],[.34,roof(.34)],[-.34,roof(-.34)]],-.23,.23,'canvas','roof');
 for(const y of [-.17,.17])islandLandmarkPrism(g,[[-.29,roof(-.29)-.035],[.29,roof(.29)-.035],[.29,roof(.29)-.012],[-.29,roof(-.29)-.012]],y-.014,y+.014,'wood','beam');
 for(const [x,y,h]of [[-.12,-.08,.07],[.08,-.08,.095]]){
  const bottom=islandLandmarkFoot(g,x,y,.08,.06),top=Math.max(z,bottom)+h;
  islandLandmarkBox(g,x,y,.08,.06,bottom,top,'wood','crate');
  islandLandmarkBox(g,x,y,.085,.065,top,top+.009,'wood','lid');
 }
 islandLandmarkFinish(g);
}
function buildIslandGarden(){
 const g=islandLandmarkGroup('juniper-garden',785.9,243.1);
 for(const side of [-1,1]){
  const x=side*.45,z=Math.max(...[-.17,.17].flatMap(u=>[-.42,.42].map(v=>terrainHeight(g.x+x+u,g.y+v)))),soil=z+.065,bottom=islandLandmarkFoot(g,x,0,.17,.42);
  for(const u of [-.16,.16])islandLandmarkBox(g,x+u,0,.012,.42,bottom,z+.08,'stone','bed-wall');
  for(const y of [-.408,.408])islandLandmarkBox(g,x,y,.148,.012,bottom,z+.08,'stone','bed-end');
  islandLandmarkBox(g,x,0,.147,.395,bottom,soil,'soil','soil');
  for(let k=0;k<5;k++){
   const y=(k-2)*.14,top=soil+.055+(k%2)*.025;
   islandLandmarkBox(g,x,y,.004,.004,soil,top,'canvas','stem');
   islandLandmarkPrism(g,[[x-.022,top],[x,top+.028],[x+.022,top],[x,top-.01]],y-.018,y+.018,'flower','bloom');
  }
 }
 const seat=Math.max(terrainHeight(g.x,g.y-.56)+.045,...[-.2,.2].flatMap(x=>[-.07,.07].map(y=>terrainHeight(g.x+x,g.y-.56+y)+.02)));
 g.seat={x:g.x,y:g.y-.56,z:seat,fx:0,fy:1,h:(seat-terrainHeight(g.x,g.y-.56))*10};
 // Clear the old scatter immediately under the new built beds and bench.
 for(let k=ISLAND_DETAILS.length-1;k>=0;k--){const o=ISLAND_DETAILS[k];if(o.kind==='cover'&&Math.abs(o.x-g.x)<.66&&Math.abs(o.y-g.y)<.66){ISLAND_DETAILS.splice(k,1);const j=ISLAND_FLOWERS.indexOf(o);if(j>=0)ISLAND_FLOWERS.splice(j,1);}}
 for(const x of [-.14,.14])islandLandmarkBox(g,x,-.56,.018,.06,islandLandmarkFoot(g,x,-.56,.018,.06),seat-.012,'stone','bench-foot');
 islandLandmarkBox(g,0,-.56,.20,.07,seat-.012,seat,'wood','bench-seat');
 islandLandmarkBox(g,0,-.618,.20,.012,seat,seat+.06,'wood','bench-back');
 islandLandmarkFinish(g);
}
const BASE_ISLAND_SKIFF=islandSkiff;
islandSkiff=(x,y)=>{if(Math.abs(x-710.3)<.001&&Math.abs(y-112.7)<.001)return;return BASE_ISLAND_SKIFF(x,y);};
const BASE_ISLAND_SIGHTS=buildIslandSights;
buildIslandSights=()=>{BASE_ISLAND_SIGHTS();ISLAND_LANDMARKS.length=0;buildIslandArch();buildIslandWreck();buildIslandCamp();buildIslandGarden();};

const BASE_ISLAND_NEAR_SEAT=nearSeat;
nearSeat=()=>{
 if(mode==='walk'&&!fx.skating){const seat=ISLAND_LANDMARKS.find(g=>g.seat)?.seat;if(seat&&Math.hypot(px-seat.x,py-seat.y)<.15)return seat;}
 return BASE_ISLAND_NEAR_SEAT();
};
