// Small boarded patches and torn paper left on permanently shut brownstone
// shop windows. Positions come from the same facade bays as the actual shutter.
let ABANDONED_DRESSING_B=null;
const ABANDONED_DRESSING_PARTS=new WeakMap();
function abandonedDressingList(){
 if(ABANDONED_DRESSING_B)return ABANDONED_DRESSING_B;
 const out=[];
 for(const b of ARCH_BUILDINGS){
  if(b.sh.kind!==SHOP_SHUT||b.sh.wilderness||b.profile||b.region!=='brownstones')continue;
  for(const f of b.faces){
   if(!f.front||f.low||f.spacing<.4)continue;
   const unit=Math.min(f.units-1,Math.floor(hash(b.x0,b.y0,1841)*f.units));
   const along=f.start+(unit+.5)*f.spacing;
   out.push({sh:b.sh,seed:b.seed,x:f.side?along:f.line,y:f.side?f.line:along,
    tx:f.side?1:0,ty:f.side?0:1,nx:f.nx,ny:f.ny,spacing:f.spacing});
  }
 }
 return ABANDONED_DRESSING_B=bucketed(out);
}
function abandonedDressingParts(e){
 let parts=ABANDONED_DRESSING_PARTS.get(e);if(parts)return parts;
 parts=[];
 const add=(kind,t,n,hl,hw,z0,z1,index=0)=>{
  parts.push({kind,t,n,hl,hw,z0,z1,index,box:boxAt(e.x+e.tx*t+e.nx*n,e.y+e.ty*t+e.ny*n,e.tx,e.ty,hl,hw,z0,z1)});
 };
 // Rear battens touch the facade plane. Each plank sits on their fronts,
 // with a screw over both supports. Some patches use horizontal timber.
 const horizontal=hash(e.seed*1e3,0,1843)>.5;
 if(horizontal){
  for(const t of [-.07,.07])add('batten',t,.002,.0075,.002,.075,.235);
  for(let j=0;j<4;j++){
   const z=.095+j*.033;
   add('plank',0,.0055,.10+hash(j,e.seed*1e3,1842)*.004,.0015,z-.014,z+.014,j);
   for(const t of [-.07,.07])add('screw',t,.00745,.001,.00045,z-.001,z+.001,j);
  }
 }else{
  for(const z of [.095,.22])add('batten',0,.002,.06,.002,z-.0075,z+.0075);
  for(let j=0;j<4;j++){
   const t=(j-1.5)*.028,top=.265+hash(j,e.seed*1e3,1842)*.004;
   add('plank',t,.0055,.013,.0015,.055,top,j);
   for(const z of [.095,.22])add('screw',t,.00745,.001,.00045,z-.001,z+.001,j);
  }
 }
 for(let j=0;j<2;j++)add('paper',(horizontal ? .135 : .085)+j*.023,.00002+j*.00004,.013,.00002,.125+j*.014,.159+j*.014,j);
 ABANDONED_DRESSING_PARTS.set(e,parts);return parts;
}
function drawAbandonedDressing(e,vx,vy){
 const parts=abandonedDressingParts(e);
 for(const p of parts){
  const box={...p.box,x:vx+(p.box.x-e.x),y:vy+(p.box.y-e.y)};
  drawBox(box,(i,t,L)=>{
   if(p.kind==='paper'){
    const u=HIT.u/p.hl,v=(HIT.w-p.z0)/(p.z1-p.z0);
    // Missing lower corners expose the steel; these are paper remnants rather
    // than a new sign identifying the former business.
    if(v<.16+(Math.floor((u+1)*4+p.index)&1)*.12||u>.6&&v>.86)return false;
    BG[i]=C(v<.42?WARM:WHITE,(2+L*.28)*shadeFace(HIT.face));
   }else if(p.kind==='screw')BG[i]=C(GRAY,(1+L*.2)*shadeFace(HIT.face));
   else{
    const fp=t/projY,across=p.hl>(p.z1-p.z0)/2?HIT.w:HIT.u,grain=coveGroove(across+p.index*.003,.008,.001,fp);
    const split=p.hl>(p.z1-p.z0)/2
     ? Math.abs(HIT.w-(p.z0+p.z1)/2)<Math.max(.0005,fp*.3)&&HIT.u>p.hl-.034
     : Math.abs(HIT.u+.003)<Math.max(.0005,fp*.3)&&HIT.w>p.z1-.034;
    BG[i]=C(p.kind==='batten'?BRICK:p.index&1?GRAY:WARM,((split?1:2.2)+L*.24-grain*.9)*shadeFace(HIT.face));
   }
   return set(i,' ',0),true;
  });
 }
}
function abandonedShopDressing(){
 forNear(abandonedDressingList(),e=>{
  if(e.sh.kind!==SHOP_SHUT)return;
  const[vx,vy]=R(e.x,e.y);if(Math.hypot(vx,vy)>SHOP_WINDOW.near*2.5||!inView(vx,vy,.22))return;
  drawAbandonedDressing(e,vx,vy);
 });
 drawAbandonedGroundDressing();
}
