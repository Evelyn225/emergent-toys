// Shelf geometry supplies the support planes; item sizes come from the same
// cropped pictures the renderer draws. Saved coordinates are local to a board.
const HOME_SHELF_LAYOUTS=new WeakMap();
let homeShelfMenuTarget=null;
function restoreShelfItem(it) {
  const out={...it},p=it.shelfPlacement;delete out.shelfPlacement;
  if(p&&typeof p.key==='string'&&p.key.length<=120&&Number.isInteger(p.level)&&p.level>=0&&p.level<=3&&[p.u,p.v].every(v=>Number.isFinite(v)&&Math.abs(v)<20))out.shelfPlacement={key:p.key,level:p.level,u:p.u,v:p.v};
  return out;
}
const homeShelfItem=it=>isHomeDecor(it)&&!HOME_FURNITURE[it.id];
function homeShelfSize(it) {
  const p=droppedPicture(it),m=itemSize(it)/Math.max(p.w,p.h);
  return {radius:p.w*m/2,height:p.h*m};
}
function homeShelfSurfaces() {return room.props.flatMap(p=>p.shelfSurfaces||[]);}
function homeShelfLine(s,x,y,z) {
  const eye=interactionEye(),hit={...HIT};
  try{return !s.owner.shelfOccluders.some(b=>{const t=rayBox(px,py,eye,x-px,y-py,z-eye,b);return t>.01&&t<.99;});}
  finally{Object.assign(HIT,hit);}
}
function homeShelfVisible(p) {
  const forward=(p.x-px)*Math.cos(a)+(p.y-py)*Math.sin(a),z=clamp(interactionEye()+pitch*rows/projY*forward,p.z,p.z+p.size.height);
  return homeShelfLine(p.surface,p.x,p.y,z);
}
function homeShelfFits(s,u,v,size,placed) {
  const r=size.radius,top=s.z+size.height;
  if(![u,v,r,top].every(Number.isFinite)||Math.abs(u)+r>s.hl+1e-7||Math.abs(v)+r>s.hw+1e-7||top>Math.min(s.ceiling-.006,(room.def.height||3)-.02))return false;
  const overlap=b=>Math.hypot(Math.max(0,Math.abs(u-b.u)-b.hl),Math.max(0,Math.abs(v-b.v)-b.hw))<r+.004;
  if(s.books.some(overlap)||placed.some(p=>p.surface.key===s.key&&p.surface.level===s.level&&Math.hypot(p.u-u,p.v-v)<p.size.radius+r+.008))return false;
  const x=s.x+s.c*u-s.s*v,y=s.y+s.s*u+s.c*v;
  const b=boxAt(x,y,1,0,r,r,s.z,top);
  return !room.props.some(p=>p!==s.owner&&p.box&&!p.walk&&b.z0<p.box.z1-.001&&b.z1>p.box.z0+.001&&furnishingOverlap(b,p.box,.002));
}
function homeShelfFind(s,size,placed,preferred=0) {
  const span=s.hl-size.radius;if(span<0)return null;
  const positions=[clamp(preferred,-span,span),0];
  for(let k=1;k<=Math.ceil(span/.025);k++)positions.push(clamp(preferred+k*.025,-span,span),clamp(preferred-k*.025,-span,span));
  for(const v of [0,s.hw-size.radius,-s.hw+size.radius])for(const u of positions)if(homeShelfFits(s,u,v,size,placed))return {surface:s,u,v,size,x:s.x+s.c*u-s.s*v,y:s.y+s.s*u+s.c*v,z:s.z};
  return null;
}
function homeShelfLayout() {
  const home=homeRecord();if(!home)return [];
  const items=home.decor||[],signature=items.map(it=>[it.id,it.uses,it.q,it.of,it.kg,it.shelfPlacement?.key,it.shelfPlacement?.level,it.shelfPlacement?.u,it.shelfPlacement?.v].join('|')).join(';');
  const cached=HOME_SHELF_LAYOUTS.get(home);if(cached?.props===room.props&&cached.signature===signature)return cached.placed;
  const primary=homeLayout(room).shelf,surfaces=homeShelfSurfaces().sort((a,b)=>Math.hypot(a.x-primary[0],a.y-primary[1])-Math.hypot(b.x-primary[0],b.y-primary[1])||b.level-a.level),placed=[];
  for(const it of items){
    const size=homeShelfSize(it),saved=it.shelfPlacement,s=saved&&surfaces.find(s=>s.key===saved.key&&s.level===saved.level);let p;
    if(s&&homeShelfFits(s,saved.u,saved.v,size,placed))p={surface:s,u:saved.u,v:saved.v,size,x:s.x+s.c*saved.u-s.s*saved.v,y:s.y+s.s*saved.u+s.c*saved.v,z:s.z};
    else for(const surface of surfaces){p=homeShelfFind(surface,size,placed);if(p)break;}
    if(p)placed.push({...p,it});
  }
  HOME_SHELF_LAYOUTS.set(home,{props:room.props,signature,placed});return placed;
}
function homeShelfAim() {
  if(mode!=='room'||!homeRecord())return [];
  const out=[],eye=interactionEye(),slope=pitch*rows/projY,ax=Math.cos(a),ay=Math.sin(a);
  for(const surface of homeShelfSurfaces()){
    const s=surface,x=px-s.x,y=py-s.y,u=x*s.c+y*s.s,v=-x*s.s+y*s.c,du=ax*s.c+ay*s.s,dv=-ax*s.s+ay*s.c;
    let t=dv<-.001?(s.hw-v)/dv:-1,hitU=u+du*t,hitZ=eye+slope*t,hitV=s.hw;
    if(!(t>0&&t<=2.2&&Math.abs(hitU)<s.hl&&hitZ>=s.z&&hitZ<Math.min(s.ceiling,(room.def.height||3)))){
      t=Math.abs(slope)>.001?(s.z-eye)/slope:-1;hitU=u+du*t;hitV=v+dv*t;hitZ=s.z;
      if(!(t>0&&t<=2.2&&Math.abs(hitU)<s.hl&&Math.abs(hitV)<s.hw))continue;
    }
    const xx=s.x+s.c*hitU-s.s*hitV,yy=s.y+s.s*hitU+s.c*hitV;
    if(interactionClear(xx,yy,hitZ+.002,s.owner)&&homeShelfLine(s,xx,yy,hitZ+.002))out.push({surface:s,u:hitU,x:xx,y:yy,z:hitZ});
  }return out;
}
function homeShelfStore(k,target=homeShelfMenuTarget) {
  const home=homeRecord(),it=inv[k];if(!home||!target||!room.props.includes(target.surface.owner)||!it||!homeShelfItem(it))return [false,'Hold a small item to put on the shelf.'];
  if((home.decor||[]).length>=HOME_SHELF_CAPACITY)return [false,'Take an item down first.'];
  const p=homeShelfFind(target.surface,homeShelfSize(it),homeShelfLayout(),target.u);
  if(!p)return [false,'That item does not fit here. Try another shelf or a smaller item.'];
  const item=takeSlot(k);item.shelfPlacement={key:p.surface.key,level:p.surface.level,u:p.u,v:p.v};(home.decor||=[]).push(item);saveGame();
  return [true,`You put the ${itemName(item)} on the shelf.`];
}
function homeShelfUse(target) {
  if(heldItem())return say(homeShelfStore(held,target)[1],3);
  const home=homeRecord();home.decor||=[];homeShelfMenuTarget=target;
  openStorage(home.decor,'the shelf','Display shelves','Hold an item and look at any shelf to place it. Click a displayed item to take it down.',it=>homeShelfItem(it)&&!!homeShelfFind(target.surface,homeShelfSize(it),homeShelfLayout(),target.u),HOME_SHELF_CAPACITY,k=>homeShelfStore(k,target));
}
function homeShelfTake(p) {
  if(inv.length>=INV_SIZE)return say('Your bag is full.',3);
  const home=homeRecord(),k=home.decor.indexOf(p.it);if(k<0)return;
  const it=home.decor.splice(k,1)[0];delete it.shelfPlacement;carryItem(it,false);saveGame();say(`You take the ${itemName(it)} down.`,3);
}
