// The shop/restaurant closing pass starts with the fluorescent strip ceilings.
// Other room families and authored hanging lamps keep their own renderers.
const INTERIOR_BATTEN_ROOMS=new Set(['store','gas','grocer','deli','hardware','sports','toys','thrift','pharmacy','tobacco','video','records','tattoo','herbs','phones','pawn','liquor','jeweler','bodega','markethall','fruitshop','motel','welding','tireshop','tailor','antiques','drugstore','delicatessen','gacha','showroom','realty','books','florist','petshop','barber','cafe','bar','diner','noodle','tea','karaoke','pizzeria','burgerjoint','taqueria','sushibar','icecream','bakery','chickenshop','kebabshop','bento','takoyaki','yakitori','donutshop','juicebar','bagelshop','thai','pho','dumplings','dimsum','kissaten','izakaya','mahjong','roastery','noodlehouse']);
// Closed bevels on both faces. All clipping planes and normals prepare once;
// the existing convex-surface ray is used unchanged.
function ceilingBattenPrism(half,width,z0,z1,bevel) {
  const p=kitchenTopProfile(half,width,z0,z1,bevel);
  for(const [nx,ny,d,id]of [[1,0,half-z0-bevel,11],[-1,0,half-z0-bevel,12],[0,1,width-z0-bevel,13],[0,-1,width-z0-bevel,14]]){
    p.planes.push([nx,ny,-1,d,id]);p.normals[id]=[nx/Math.SQRT2,ny/Math.SQRT2,-1/Math.SQRT2];
  }
  return {...boxAt(0,0,0,1,half,width,z0,z1),...p};
}
function CEILING_BATTEN(x,y,length,ceiling) {
  const n=Math.max(1,Math.ceil(length/1.8)),pitch=length/n,half=Math.min(1.4,pitch-.12)/2,parts=[];
  const metal=(i,t,L)=>{BG[i]=C(WHITE,2.3+L*.22*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const glass=(i,t,L)=>{BG[i]=C(WHITE,HIT.nz<-.7?12.5:4.2+L*.12);set(i,' ',0);return true;};
  const clip=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const add=(u,a,b,z0,z1,bevel,shade)=>parts.push({box:{...ceilingBattenPrism(a,b,z0,z1,bevel),y:u},shade});
  for(let k=0;k<n;k++){const u=-length/2+pitch*(k+.5);
    // The lower clips and diffuser reject hidden housing pixels first.
    for(const e of [-1,1])add(u+e*(half-.08),.012,.18,ceiling-.064,ceiling-.052,.002,clip);
    add(u,half-.028,.17,ceiling-.061,ceiling-.052,.002,glass);
    add(u,half,.2,ceiling-.055,ceiling,.008,metal);
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const p of parts)drawBox({...p.box,x:vx,y:vy+p.box.y},p.shade,homeRayWorktop);}),
    box:boxAt(x,y,0,1,length/2,.2,ceiling-.064,ceiling),walk:true,overhead:true,radius:Math.hypot(length/2,.2),ceilingBatten:{ceiling,length,modules:n}};
}
// This runs after the current room has been assigned. Reuse the existing
// partition-aware ceiling layout, including its doorway and tall-prop gaps.
function prepareInteriorBattens() {
  const R=room,style=R?.def.ceil;
  if(!R||R.kind==='station'||R.kind==='train'||style!=='strip'||ROOM_CEILS[style])return false;
  if(R.interiorBattens)return true;
  const runs=[],spec={...CEIL_STRIP,onFitting:(x0,y0,x1,y1,value)=>{if(value===1)runs.push({x:(x0+x1)/2,y:(y0+y1)/2,length:y1-y0});}};
  const mask=ceilMask('physical-strip',spec),ceiling=R.def.height||3;
  const fixtures=runs.map(q=>CEILING_BATTEN(q.x,q.y,q.length,ceiling));
  R.interiorBattens={mask,fixtures};R.props.push(...fixtures);return true;
}
