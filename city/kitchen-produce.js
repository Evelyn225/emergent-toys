// Produce crates are open slatted shells on a stacked crate. Round fruit packs
// in square layers, each upper fruit resting in the hollow of the four below;
// banana hands lie on the crate floor as curved fingers joined at a crown.
const PRODUCE_FRUIT={orange:{hr:.038,vr:.036,layers:3,col:ORANGE},apple:{hr:.037,vr:.034,layers:3,col:RED},
  lime:{hr:.032,vr:.030,layers:2,col:GREEN}};
const PRODUCE_RIM=.60,PRODUCE_HL=.32,PRODUCE_HW=.26,PRODUCE_WALL=.008;
// Fruit centres relative to the crate, from the floor up. Upper layers sit at
// sqrt(2)*vr above the one beneath: the spheroids touch all four neighbours.
function produceLayout(kind,floor) {
  const f=PRODUCE_FRUIT[kind],ih=PRODUCE_HL-PRODUCE_WALL,iw=PRODUCE_HW-PRODUCE_WALL,out=[];
  const n=Math.floor(ih/f.hr),m=Math.floor(iw/f.hr);
  for(let layer=0;layer<f.layers;layer++)for(let i=0;i<n-layer;i++)for(let j=0;j<m-layer;j++)
    out.push({u:(i-(n-layer-1)/2)*2*f.hr,v:(j-(m-layer-1)/2)*2*f.hr,z:floor+f.vr*(1+Math.SQRT2*layer),hr:f.hr,vr:f.vr,layer});
  return out;
}
// Hands of five fingers on concentric arcs. Four lie on the crate floor; two
// more rest across them on the lower fingers' tops. Every footprint stays
// inside the inner walls.
const PRODUCE_FINGER=.036;
function produceBananas(floor) {
  const out=[],crowns=[],top=floor+PRODUCE_FINGER;
  for(const [hu,hv,flip,z0]of [[-.15,-.118,1,floor],[.15,-.118,-1,floor],[-.15,.118,-1,floor],[.15,.118,1,floor],
    [-.15,0,-1,top],[.15,0,1,top]]) {
    for(let j=0;j<5;j++)for(let k=0;k<4;k++) {
      const R=.16+j*.033,a=(-.45+(k+.5)*.225)*flip,hw=k===0?.014:k===3?.015:PRODUCE_FINGER/2;
      out.push({u:hu+R*Math.sin(a),v:hv+R*Math.cos(a)-.22,c:Math.cos(a),s:-Math.sin(a),
        hl:R*.225*.65,hw,z0,z1:z0+hw*2,tip:k===3?flip:0,R,a,upper:z0>floor});
    }
    const a=-.47*flip;
    crowns.push({u:hu+.226*Math.sin(a),v:hv+.226*Math.cos(a)-.22,c:Math.sin(a),s:Math.cos(a),hl:.075,hw:.013,z0,z1:z0+.026});
  }
  return {fingers:out,crowns};
}
function produceShade(col,k) {
  const tone=hash(k,3,171)*.5-.25;
  return (i,t,L)=>{
    const fine=coveDetail(t),pore=Math.sin(HIT.u*900)*Math.sin(HIT.v*870+HIT.w*610)*fine;
    const streak=col===RED?Math.sin(Math.atan2(HIT.v,HIT.u)*9+k)*.35:0;
    BG[i]=C(col,5.2+tone+streak+L*.5*coveLight(HIT.nx,HIT.ny,HIT.nz)+pore*.15);set(i,' ',0);return true;
  };
}
function produceAppleProfile(hr,vr) {
  const pts=Array.from({length:9},(_,k)=>{const a=-Math.PI/2+k*Math.PI/8;return [vr*(1+Math.sin(a)),hr*Math.cos(a)];});
  pts[8]=[2*vr-.008,0];return pts; // the stalk sits in a dimple
}
function KITCHEN_PRODUCE_CRATE(x,y,kind) {
  const depth=kind==='banana'?.07:.10,base=PRODUCE_RIM-depth,floor=base+PRODUCE_WALL,wood=furnitureTimber(STONE);
  const slats=(i,t,L)=>{
    wood(i,t,L);
    const side=Math.abs(HIT.nz)<.5,gap=side?coveGroove(HIT.w-.05,.1,.01,t/projX):coveGroove(HIT.v,.087,.008,t/projX);
    BG[i]=C(STONE,Math.max(0,(BG[i]&15)-gap*3));return true;
  };
  const baseProfile=kitchenTopProfile(PRODUCE_HL,PRODUCE_HW,0,base,.004);
  const fruit=kind==='banana'?null:produceLayout(kind,floor),bananas=kind==='banana'?produceBananas(floor):null;
  const f=PRODUCE_FRUIT[kind],shades=fruit&&fruit.map((_,k)=>produceShade(f.col,k));
  const apple=kind==='apple'&&produceAppleProfile(f.hr,f.vr),top=fruit?Math.max(...fruit.map(q=>q.layer)):0;
  const peel=produceShade(YEL,1),nub=kitchenFoodShade(BRICK),crown=kitchenFoodShade(GREEN);
  const height=fruit?Math.max(...fruit.map(q=>q.z+q.vr)):floor+2*PRODUCE_FINGER;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    // Top layer first: the depth test then rejects most hidden fruit beneath
    // before intersecting it, and the crate last behind whatever covers it.
    if(fruit)for(let k=fruit.length-1;k>=0;k--) {
      const q=fruit[k];
      if(apple&&q.layer===top)foodOval(vx+q.u,vy+q.v,q.z+q.vr-.010,.0025,.0025,.022,nub);
      if(apple)coveLathe(vx+q.u,vy+q.v,q.z-q.vr,apple,shades[k]);
      else foodOval(vx+q.u,vy+q.v,q.z-q.vr,q.hr,q.hr,2*q.vr,shades[k]);
    }
    else {
      for(const q of bananas.crowns)foodOval(vx+q.u,vy+q.v,q.z0,q.hl,q.hw,q.z1-q.z0,crown,q.c,q.s);
      for(let k=bananas.fingers.length-1;k>=0;k--) {
        const q=bananas.fingers[k];
        if(q.tip) { // the dark flower end, just past the last segment
          const a=q.a+.12*q.tip;foodOval(vx+q.u+q.R*(Math.sin(a)-Math.sin(q.a)),vy+q.v+q.R*(Math.cos(a)-Math.cos(q.a)),q.z0+.008,.007,.007,.014,nub);
        }
        foodOval(vx+q.u,vy+q.v,q.z0,q.hl,q.hw,q.z1-q.z0,peel,q.c,q.s);
      }
    }
    foodTray(vx,vy,base,PRODUCE_HL,PRODUCE_HW,depth,slats);
    drawBox({...boxAt(vx,vy,1,0,PRODUCE_HL,PRODUCE_HW,0,base),...baseProfile},slats,homeRayWorktop);
  }),box:boxAt(x,y,1,0,PRODUCE_HL,PRODUCE_HW,0,height),radius:Math.hypot(PRODUCE_HL,PRODUCE_HW),
    produceCrate:{kind,floor,rim:PRODUCE_RIM,inner:[PRODUCE_HL-PRODUCE_WALL,PRODUCE_HW-PRODUCE_WALL],fruit,bananas}};
}
