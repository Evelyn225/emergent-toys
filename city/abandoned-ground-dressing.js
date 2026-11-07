// Low discarded packing and rooted weeds at permanently abandoned shop fronts.
// Each group fits inside its window bay and the wall-side strip of pavement.
const ABANDONED_GROUND_PARTS=new WeakMap();
function abandonedGroundParts(e){
 let parts=ABANDONED_GROUND_PARTS.get(e);if(parts)return parts;
 parts=[];
 const at=(t,n)=>[e.x+e.tx*t+e.nx*n,e.y+e.ty*t+e.ny*n];
 const add=(kind,t,n,hl,hw,z0,z1,extra={})=>{
  const[x,y]=at(t,n);const p={kind,t,n,hl,hw,z0,z1,box:boxAt(x,y,e.tx,e.ty,hl,hw,z0,z1),...extra};p.view={...p.box};p.shade=(i,t,L)=>abandonedGroundShade(e,p,i,t,L);parts.push(p);
 };
 const[x,y]=at(.12,.035),ground=outdoorGroundHeight(x,y);
 const flatAt=(x,y,hl,hw,z)=>[-1,1].every(a=>[-1,1].every(b=>Math.abs(outdoorGroundHeight(x+e.tx*hl*a+e.nx*hw*b,y+e.ty*hl*a+e.ny*hw*b)-z)<.0006));
 const flat=flatAt(...at(.12,.045),.035,.035,ground);
 if(flat){
  const z=ground,wall=.0006,hl=.035,hw=.025;
  add('carton-base',.12,.035,hl,hw,z,z+.0004);
  for(const s of [-1,1]){
   add('carton-fold',.12,.035+s*(hw-wall/2),hl,wall/2,z+.0004,z+.0035);
   add('carton-fold',.12+s*(hl-wall/2),.035,wall/2,hw-wall,z+.0004,z+.0035);
  }
  add('carton-flap',.12,.07,hl,.01,z,z+.0004);
 }
 for(const[t,n]of [[.20,.05],[.205,.070]]){
  const[x,y]=at(t,n),z=outdoorGroundHeight(x,y);
  if(!flatAt(x,y,.013,.009,z))continue;
  add('litter',t,n,.013,.009,z,z+.00004);
 }
 for(const[t,n]of [[-.075,.009],[-.03,.012],[.235,.01]])for(let j=0;j<3;j++){
  const u=t+(j-1)*.0025,v=n+(j===1?.0015:0),[x,y]=at(u,v),z=outdoorGroundHeight(x,y);
  const r=.0027+hash(j,e.seed*1e3+t,1851)*.0012,h=.022+hash(j,e.seed*1e3+t,1852)*.013;
  add('weed',u,v,r,r,z,z+h,{ray:rayFrustum});parts.at(-1).box.r1=parts.at(-1).view.r1=0;
 }
 ABANDONED_GROUND_PARTS.set(e,parts);return parts;
}
function abandonedGroundShade(e,p,i,t,L){
 const height=(HIT.w-p.z0)/(p.z1-p.z0),top=HIT.face===5;
 if(p.kind==='weed'){
  const sn=seasonIdx(),col=sn===3?BRICK:sn===2?YEL:GREEN;
  BG[i]=C(col,(1.1+L*.24)*frustumLit()+height*.8);
 }else if(p.kind==='litter'){
  if(HIT.u>p.hl*.45&&HIT.v>0||HIT.u< -p.hl*.55&&HIT.v< -p.hw*.3)return false;
  BG[i]=C(WARM,(1.8+L*.25)*shadeFace(HIT.face));
 }else{
  const crease=coveGroove(HIT.u,.018,.0012,t/projY);
  BG[i]=C(BRICK,((top?2.8:1.4)+L*.25-crease*.8)*shadeFace(HIT.face));
 }
 if(top&&p.kind!=='weed'){
  const wx=p.box.x+e.tx*HIT.u-e.ty*HIT.v,wy=p.box.y+e.ty*HIT.u+e.tx*HIT.v;
  paintSettledSnow(i,wx,wy,L*.7,1,0,HIT.w);
 }
 set(i,' ',0);return true;
}
function drawAbandonedGround(e,vx,vy){
 for(const p of abandonedGroundParts(e)){
  p.view.x=vx+p.box.x-e.x;p.view.y=vy+p.box.y-e.y;drawBox(p.view,p.shade,p.ray||rayBox);
 }
}
let ABANDONED_GROUND_B=null;
function abandonedGroundList(){
 if(ABANDONED_GROUND_B)return ABANDONED_GROUND_B;
 // The merged step pass owns its shops; extend only the remaining facade families.
 const covered=new Set(abandonedStepList().flat().map(e=>e.sh));
 const out=abandonedDressingList().flat().filter(e=>!covered.has(e.sh)).map(e=>({...e,family:'brownstones'})),existing=new Set([...covered,...out.map(e=>e.sh)]),lots=new Map(),buildings=new Map(ARCH_BUILDINGS.map(b=>[b.sh,b]));
 for(let k=0;k<map.length;k++){const sh=SHOP[k];if(!sh||sh.kind!==SHOP_SHUT||sh.wilderness||!map[k]||existing.has(sh))continue;if(!lots.has(sh))lots.set(sh,[]);lots.get(sh).push(k);}
 for(const [sh,cells]of lots){
  const k=cells[0],b=buildings.get(sh)||{sh,x0:k%N,y0:Math.floor(k/N)},faces=architectureFaces(b,cells,Array.from({length:4},()=>Object.create(null)));
  for(const f of faces){
   if(f.low||!f.front||f.spacing<.66)continue;
   const along=f.start+(f.end-f.start)*.25,x=f.side?along:f.line,y=f.side?f.line:along,ownerCell=idx(Math.floor(x-f.nx*.05),Math.floor(y-f.ny*.05));
   if(SHOP[ownerCell]!==sh||!free(x+f.nx*.14,y+f.ny*.14))continue;
   out.push({sh,seed:SEED[ownerCell],x,y,tx:f.side?1:0,ty:f.side?0:1,nx:f.nx,ny:f.ny,spacing:f.spacing,family:b.region||'style-'+STY[ownerCell],ownerCell,ownerHeight:map[ownerCell]});
  }
 }
 return ABANDONED_GROUND_B=bucketed(out);
}
function drawAbandonedGroundDressing(){
 forNear(abandonedGroundList(),e=>{
  if(e.sh.kind!==SHOP_SHUT||e.ownerCell!=null&&(SHOP[e.ownerCell]!==e.sh||map[e.ownerCell]!==e.ownerHeight))return;
  const[vx,vy]=R(e.x,e.y);if(Math.hypot(vx,vy)>SHOP_WINDOW.near*2.5||!inView(vx,vy,.3))return;
  drawAbandonedGround(e,vx,vy);
 });
}
