// The grocer's floor: tiered produce stands of slatted crates, each heaped
// with packed fruit or veg (laid out and shaded like the pass 3 juice-bar
// crates), a bin of watermelons, a stack of shopping baskets, an upturned
// crate to sit on, and the checkout counter with its belt, scale and till.
const GROCER_PRODUCE={
  orange:{hr:.038,vr:.036,col:ORANGE},apple:{hr:.037,vr:.034,col:RED,apple:true},lime:{hr:.03,vr:.028,col:GREEN},
  lemon:{hr:.032,vr:.03,col:YEL},tomato:{hr:.032,vr:.027,col:RED},onion:{hr:.036,vr:.034,col:WARM},
  potato:{hr:.04,vr:.028,col:STONE},pepper:{hr:.04,vr:.04,col:MAG},cabbage:{hr:.075,vr:.065,col:GREEN,layers:1},
};
const GROCER_PRODUCE_KINDS=Object.keys(GROCER_PRODUCE);
const GROCER_CRATE={depth:.09,wall:.008,tier:.3,rims:[.95,.73,.51]};
// Packed layers in a crate's inner floor (ih, iw: half sizes), each upper
// fruit in the hollow of the four below, sqrt(2)*vr above them.
function grocerLayout(f,ih,iw,floor) {
  const hw=f.hw??f.hr,n=Math.floor(ih/f.hr),m=Math.floor(iw/hw),out=[];
  for(let layer=0;layer<(f.layers||2);layer++)for(let i=0;i<n-layer;i++)for(let j=0;j<m-layer;j++)
    out.push({u:(i-(n-layer-1)/2)*2*f.hr,v:(j-(m-layer-1)/2)*2*hw,z:floor+f.vr*(1+Math.SQRT2*layer),hr:f.hr,hw,vr:f.vr,layer});
  return out;
}
// slatted timber: a groove between boards on the sides, across the floor
function grocerSlats(base=STONE) {
  const wood=furnitureTimber(base,2);
  return (i,t,L)=>{
    wood(i,t,L);
    const side=Math.abs(HIT.nz)<.5,gap=side?coveGroove(HIT.w-.03,.06,.008,t/projX):coveGroove(HIT.u,.12,.01,t/projX);
    BG[i]=C(base,Math.max(0,(BG[i]&15)-gap*2));return true;
  };
}
// One crate's contents relative to its centre: what, the fruit, the price card.
function grocerCrate(kind,hl,hw,rim) {
  const W=GROCER_CRATE,f=GROCER_PRODUCE[kind],base=rim-W.depth,floor=base+W.wall;
  const fruit=grocerLayout(f,hl-W.wall,hw-W.wall,floor);
  const shades=fruit.map((_,k)=>produceShade(f.col,k)),apple=f.apple&&produceAppleProfile(f.hr,f.vr);
  const models=fruit.map((p,k)=>({shade:shades[k],ray:apple?coveRayLathe:foodRayEllipsoid,
    box:apple?{...homeLampPart('fruit',p.z-p.vr,apple).box,x:p.u,y:p.v}:boxAt(p.u,p.v,1,0,p.hr,p.hw,p.z-p.vr,p.z+p.vr)}));
  const shell={...boxAt(0,0,1,0,hl,hw,base,rim),...kitchenTopProfile(hl,hw,base,rim,.002)};
  return {kind,hl,hw,rim,base,floor,fruit,top:Math.max(...fruit.map(q=>q.z+q.vr)),shades,apple,models,shell};
}
// Rotate the cached closed tray into its local axes before intersecting it;
// its recess helper expects an axis-aligned tray. Return world-space normals.
function grocerTrayRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,c=b.c,s=b.s;
  const t=foodRayTray(x*c+y*s,-x*s+y*c,oz,rx*c+ry*s,-rx*s+ry*c,rz,b.trayShape);
  if(t<0)return t;
  const nx=HIT.nx,ny=HIT.ny;HIT.nx=c*nx-s*ny;HIT.ny=s*nx+c*ny;return t;
}
function drawGrocerCrate(vx,vy,q,slats,c=1,s=0) {
  for(let k=q.models.length-1;k>=0;k--){const p=q.models[k],b=p.box;
    drawBox({...b,x:vx+c*b.x-s*b.y,y:vy+s*b.x+c*b.y,c:c*b.c-s*b.s,s:s*b.c+c*b.s},p.shade,p.ray);}
  if(c===1&&s===0)drawBox({...q.shell,x:vx,y:vy},slats,foodRayTray);
  else drawBox({...q.shell,x:vx,y:vy,c,s,trayShape:q.shell},slats,grocerTrayRay);
}
const grocerCard=(i,t,L)=>{ // a white price card, the price a dark line across it
  const line=Math.abs(HIT.w-HIT.z0mid)<.006&&coveDetail(t,.1)>.3;
  BG[i]=C(line?GRAY:WHITE,line?2:5+L*.15);set(i,' ',0);return true;};
// A stand: three tiers of crates stepping down toward its customers (fx,fy),
// each tier's crates on a timber riser. hl: half its length.
function PRODUCE_STAND(x,y,hl,seed,fx=0,fy=1) {
  const W=GROCER_CRATE,tiers=[],slats=grocerSlats(),c=fy,s=-fx;
  const riser=gondolaFlat(c,s,grocerSlats(BRICK)),at=(vx,vy,u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
  for(let k=0;k<3;k++){
    const n=Math.max(1,Math.floor(hl*2/.5)),pitch=hl*2/n,rim=W.rims[k],v=-W.tier+k*W.tier,crates=[];
    for(let j=0;j<n;j++){const kind=GROCER_PRODUCE_KINDS[Math.floor(hash(j,k,seed)*GROCER_PRODUCE_KINDS.length)];
      crates.push({u:-hl+pitch*(j+.5),...grocerCrate(kind,pitch/2-.012,W.tier/2-.015,rim)});}
    tiers.push({v,rim,base:rim-W.depth,crates});
  }
  const cards=[];
  for(const t of tiers)for(const q of t.crates)cards.push({u:q.u,v:t.v+q.hw+.0015,z0:q.rim-.045,z1:q.rim-.008});
  const cardShade=c=>(i,t,L)=>{HIT.z0mid=(c.z0+c.z1)/2;return grocerCard(i,t,L);};
  const cardShades=cards.map(cardShade);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const t of tiers){
      for(const q of t.crates){const [cx,cy]=at(vx,vy,q.u,t.v);drawGrocerCrate(cx,cy,q,slats,c,s);}
      const [rx,ry]=at(vx,vy,0,t.v);drawBox(boxAt(rx,ry,c,s,hl,W.tier/2,0,t.base),riser); // the riser the crates stand on
    }
    for(let k=0;k<cards.length;k++){const q=cards[k],[cx,cy]=at(vx,vy,q.u,q.v);drawBox(boxAt(cx,cy,c,s,.03,.0015,q.z0,q.z1),cardShades[k]);}
  }),box:boxAt(x,y,c,s,hl,W.tier*1.5,0,W.rims[0]),radius:Math.hypot(hl,W.tier*1.5)+.1,
    produceStand:{tiers,hl,cards,c,s}};
}
// A slatted bin of watermelons, a false floor halfway down.
function WATERMELON_BIN(x,y,h=.8) {
  const hl=.5,depth=.3,base=h-depth,floor=base+GROCER_CRATE.wall,f={hr:.115*1.18,hw:.115,vr:.1,layers:2},slats=grocerSlats();
  // Pack using both physical radii. Stretching after a circular layout made
  // adjacent melons intersect, including the four contacts in the upper layer.
  const melons=grocerLayout(f,hl-GROCER_CRATE.wall,hl-GROCER_CRATE.wall,floor),bodyShade=gondolaFlat(1,0,slats);
  const models=melons.map((p,k)=>({box:boxAt(p.u,p.v,1,0,p.hr,p.hw,p.z-p.vr,p.z+p.vr),shade:(i,t,L)=>{
    const stripe=Math.sin(Math.atan2(HIT.v,HIT.w-p.z)*7+k)>.35,detail=coveDetail(t,.2);
    BG[i]=C(GREEN,2.7+(stripe?-1.1:.7)*detail+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  }}));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=models.length-1;k>=0;k--){const p=models[k];drawBox({...p.box,x:vx+p.box.x,y:vy+p.box.y},p.shade,foodRayEllipsoid);}
    foodTray(vx,vy,base,hl,hl,depth,slats);
    drawBox(boxAt(vx,vy,1,0,hl,hl,0,base),bodyShade); // the bin below its false floor
  }),box:boxAt(x,y,1,0,hl,hl,0,h),radius:hl*1.5,produceBin:{melons,floor,base,hl,h}};
}
// Shopping baskets stacked by the door, the top one with its handles folded down.
function BASKET_STACK(x,y,n=5) {
  const hl=.24,hw=.18,depth=.08,cols=[RED,ORANGE];
  const plastic=col=>(i,t,L)=>{const mesh=coveGroove(HIT.u+HIT.w,.025,.006,t/projX)*(Math.abs(HIT.nz)<.5?1:0);
    BG[i]=C(col,2.4+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)-mesh*1.2);set(i,' ',0);return true;};
  const shades=cols.map(plastic),top=n*depth;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const e of [-1,1])drawBox({...boxAt(vx,vy+e*(hw-.004),1,0,hl*.6+.006,.006,top,top+.012),ax:vx-hl*.6,ay:vy+e*(hw-.004),az:top+.006,bx:vx+hl*.6,by:vy+e*(hw-.004),bz:top+.006,r:.006},shades[(n-1)&1],coveRayCapsule); // the handles, lying on the rim
    for(let k=n-1;k>=0;k--)foodTray(vx,vy,k*depth,hl,hw,depth,shades[k&1]);
  }),box:boxAt(x,y,1,0,hl,hw,0,top+.012),radius:Math.hypot(hl,hw),baskets:{n,depth,hl,hw}};
}
// A crate turned over to sit on: the slatted floor on top, the open side down.
function UPTURNED_CRATE(x,y,h=.38) {
  const slats=gondolaFlat(1,0,grocerSlats());
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,1,0,.2,.17,0,h),slats)),box:boxAt(x,y,1,0,.2,.17,0,h),radius:.3};
}
// The checkout along y, the cashier on +x: a laminate counter on a set-back
// plinth, the belt running in a channel between steel rails toward the till,
// a weighing plate let into the top at the till end, the till on a swivel
// post and the card reader on its stand.
function CHECKOUT_COUNTER(x,y,hl) {
  const H=.88,hw=.32,c=0,s=1; // u along y; v toward -x, the customers' side
  const flat=shade=>gondolaFlat(c,s,shade),steel=flat((i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  const laminate=flat((i,t,L)=>{BG[i]=C(WHITE,2.6+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  const kick=flat((i,t,L)=>{BG[i]=C(GRAY,.8+L*.06);set(i,' ',0);return true;});
  const belt=flat((i,t,L)=>{const rib=coveGroove(HIT.u-T*.25,.05,.006,t/projX);BG[i]=C(GRAY,.7+L*.06+rib*.6);set(i,' ',0);return true;});
  const glass=flat((i,t,L)=>{BG[i]=C(CYAN,1.2+L*.1);set(i,' ',0);return true;});
  const screen=flat((i,t,L)=>{if(HIT.face!==4){BG[i]=C(GRAY,1.1);set(i,' ',0);return true;}
    BG[i]=C(GREEN,1.2);return set(i,Math.abs(HIT.w-1.12)<.012&&coveDetail(t,.1)>.3?'$':' ',C(GREEN,12)),true;});
  const beltLen=hl-.32,bu=-hl+.04+beltLen/2;
  const parts=[
    [0,0,hl,hw-.04,0,.1,kick],[0,0,hl,hw,.1,H-.03,laminate], // plinth, carcass
    [bu,0,beltLen/2,.22,H-.045,H-.02,belt], // the belt, in its channel
    ...[-1,1].map(e=>[bu,e*.26,beltLen/2,.04,H-.03,H,steel]), // rails either side
    [-hl+.02,0,.02,.22,H-.03,H,steel], // the far end cap
    [hl-.14,0,.14,hw,H-.03,H,steel], // the till end's top
    [hl-.48,0,.12,hw,H-.03,H,steel], // between belt and scale
    [hl-.31,-.04,.05,hw-.04,H-.03,H-.01,steel],[hl-.31,-.04,.045,hw-.08,H-.01,H,glass], // the scale's frame and glass, flush with the top
    [hl-.1,-.14,.012,.012,H,H+.12,steel],[hl-.1,-.14,.09,.06,H+.12,H+.14,steel], // the till's swivel post and drawer
    [hl-.1,-.14,.08,.008,H+.14,H+.3,screen], // its screen, to the cashier
    [hl-.06,.2,.04,.025,H,H+.09,kick], // the card reader on its stand, to the customer
  ];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const [u,v,a,b,z0,z1,shade]of parts){const [px_,py_]=[vx-s*v+c*u,vy+c*v+s*u];drawBox(boxAt(px_,py_,c,s,a,b,z0,z1),shade);}}),
    box:boxAt(x,y,1,0,hw,hl,0,H),radius:hl+.1,checkout:{hl,hw,H,parts:parts.length}};
}
