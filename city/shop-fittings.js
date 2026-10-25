// Small shop fittings shared between rooms: a stack of binders or books lying
// flat, and a rug on the floor.
// A stack lying flat at z: each [hl, hw, thickness, colour], bottom first,
// each resting on the one beneath, the spines along u (c, s).
function BOOK_STACK(x,y,z,books,c=1,s=0) {
  const tops=[];let h=z;for(const b of books){tops.push(h);h+=b[2];}
  const cover=col=>(i,t,L)=>{const edge=HIT.face!==5&&HIT.face!==6&&Math.abs(HIT.nz)<.5&&(HIT.face===1||HIT.face===2);
    BG[i]=C(edge?WHITE:col,(edge?3.2:2.2)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const hl=Math.max(...books.map(b=>b[0])),hw=Math.max(...books.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>books.forEach((b,k)=>coveRound(vx,vy,c,s,b[0],b[1],tops[k],tops[k]+b[2],.004,cover(b[3])))),
    box:boxAt(x,y,c,s,hl,hw,z,h),radius:Math.hypot(hl,hw),bookStack:{z,top:h,tops}};
}
// A rug on the floor, a border round it: (u, v) from its centre to shade(e, u, v) by e, the distance in from its edge.
function FLOOR_RUG(x,y,hl,hw,field,border,c=1,s=0) {
  const shade=(i,t,L)=>{const e=Math.min(hl-Math.abs(HIT.u),hw-Math.abs(HIT.v));
    BG[i]=C(e<.12?border:field,e<.12?3:1.6+L*.2);return set(i,e>.12&&fract((HIT.u+HIT.v)*3)<.15?'+':' ',C(border,7)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,0,.012),gondolaFlat(c,s,shade))),rug:true};
}
// A disc standing on edge, its axis along v (facing fx,fy): a side-on lathe.
function shopDisc(vx,vy,c,s,z,profile,shade) {
  const r=Math.max(...profile.map(p=>p[1])),d=Math.max(...profile.map(p=>Math.abs(p[0])));
  drawBox({...boxAt(vx,vy,c,s,r,d,z-r,z+r),centerZ:z,clockShape:{x:0,y:0,profile}},shade,homeClockRay);
}
// The key cutter on a counter top at z: a cast base, the vice carriage, the
// motor housing, and the cutting wheel on edge turning, to the customer (fx,fy).
function KEY_CUTTER(x,y,z,fx,fy) {
  const c=fy,s=-fx,wheel=[[-.006,0],[-.006,.055],[.006,.055],[.006,0]];
  const spin=(i,t,L)=>{const a=Math.atan2(HIT.w-(z+.17),HIT.u)+T*25,tooth=fract(a/TAU*24)<.5&&Math.hypot(HIT.u,HIT.w-(z+.17))>.045;
    BG[i]=C(GRAY,(tooth?3.6:2.4)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.18,.15,z,z+.05,GRAY,.012); // the base
    part(.06,-.05,.08,.07,z+.05,z+.25,GRAY,.02); // the motor housing
    part(0,.037,.008,.017,z+.162,z+.178,GRAY,.004); // the spindle out to the wheel
    part(-.07,.05,.06,.05,z+.05,z+.1,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE),.008); // the vice carriage
    shopDisc(vx-s*.06-c*.0,vy+c*.06,c,s,z+.17,wheel,spin); // the wheel, turning
  }),box:boxAt(x,y,c,s,.18,.15,z,z+.25),radius:.25,keyCutter:{z}};
}
// Boards stood on end against a wall: [u, height] along u (c,s) from (x, y).
function LUMBER(x,y,boards,c=0,s=1,t=.05,w=.12) {
  const shade=(i,tt,L)=>coveTimber(i,HIT.u,HIT.w,L,tt,HIT.nx,HIT.ny,HIT.nz,7);
  const span=Math.max(...boards.map(b=>Math.abs(b[0])))+w,h=Math.max(...boards.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const [u,bh] of boards)coveRound(vx+c*u,vy+s*u,c,s,w,t,0,bh,.006,shade);}),
    box:boxAt(x,y,c,s,span,t,0,h),radius:span,lumber:{boards,t,w}};
}
// Coils of garden hose lying on the floor, turn on turn: each turn a ring.
function HOSE_COILS(x,y,R=.34,turns=6,r=.022,col=GREEN) {
  // (an octagon of tube section: a finer one costs more than it shows at this size)
  const ring=k=>{const zc=r+k*2*r,pts=[];for(let j=0;j<=8;j++){const a=Math.PI/2-j*Math.PI/4;pts.push([zc+r*Math.sin(a),R+r*Math.cos(a)]);}return pts;};
  const rings=Array.from({length:turns},(_,k)=>ring(k));
  const shade=(i,t,L)=>{BG[i]=C(col,2.2+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(let k=turns-1;k>=0;k--)coveLathe(vx,vy,0,rings[k],shade);}),
    box:boxAt(x,y,1,0,R+r,R+r,0,turns*2*r),radius:R+r,hose:{R,r,turns}};
}
// Bags of compost lying flat, one on another: plump rounded slabs with a printed band.
function COMPOST_BAGS(x,y,n=4,hl=.4,hw=.28,h=.16) {
  const shade=k=>(i,t,L)=>{const band=Math.abs(HIT.nz)<.6&&Math.abs(HIT.u)<.15&&HIT.face!==5;
    BG[i]=C(band?YEL:k&1?GREEN:BRICK,(band?3:1.8)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(let k=n-1;k>=0;k--)coveRound(vx,vy,1,0,hl-k*.01,hw-k*.008,k*h,(k+1)*h,.05,shade(k));}),
    box:boxAt(x,y,1,0,hl,hw,0,n*h),radius:Math.hypot(hl,hw),bags:{n,h}};
}
// A plain bulkhead hanging from the ceiling over an opening.
function BULKHEAD(x,y,hl,hw,z0,z1,c=1,s=0) {
  const shade=gondolaFlat(c,s,(i,t,L)=>{BG[i]=C(GRAY,1.8+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,z0,z1),shade)),box:{...boxAt(x,y,c,s,hl,hw,z0,z1)},overhead:true};
}
// The blood-pressure machine facing (fx,fy): a white cabinet, the cuff's
// ring on the front at arm height, the readout above it.
function BP_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,ring=[[-.03,.06],[-.03,.09],[.03,.09],[.03,.06],[-.03,.06]];
  const white=(i,t,L)=>{BG[i]=C(WHITE,2.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const readout=(i,t,L)=>{BG[i]=C(CYAN,3);return set(i,HIT.face===3&&coveDetail(t,.1)>.3?(HIT.w>1.08?'1':'2'):' ',C(WHITE,14)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.3,.28,0,1.3,white,.03); // the cabinet
    part(0,.282,.12,.003,.95,1.18,readout); // the readout
    shopDisc(vx-s*.3,vy+c*.3,c,s,.75,ring,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY)); // the cuff's ring, standing proud
  }),box:boxAt(x,y,c,s,.3,.33,0,1.3),radius:.45,bpMachine:{fx,fy}};
}
// A small desk: a top on two side panels and a modesty panel; (fx,fy) is the
// way its sitter faces, the modesty panel on the far side.
function SMALL_DESK(x,y,hl,hw,h,fx,fy,col=WHITE) {
  const c=fy,s=-fx,lam=(i,t,L)=>{BG[i]=C(col,2.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,hw,h-.03,h,lam,.008); // the top
    for(const e of [-1,1])part(e*(hl-.015),0,.015,hw-.02,0,h-.03,lam,.004); // the side panels
    part(0,hw-.03,hl-.03,.008,.3,h-.03,lam,.003); // the modesty panel
  }),box:boxAt(x,y,c,s,hl,hw,0,h),radius:Math.hypot(hl,hw),desk:{h}};
}
// A flat monitor on a desk top at z, its screen to (fx,fy).
function DESK_MONITOR(x,y,z,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(GRAY,1.1);set(i,' ',0);return true;}BG[i]=C(CYAN,3.2);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.08,.06,z,z+.012,GRAY,.004); // the foot
    part(0,-.02,.012,.01,z+.012,z+.1,GRAY,.004); // the neck
    part(0,0,.15,.012,z+.08,z+.27,screen); // the screen
  }),box:boxAt(x,y,c,s,.15,.06,z,z+.27),radius:.2,monitor:{z}};
}
// A rubber mat on the floor with rounded edges.
function FLOOR_MAT(x,y,hl,hw,h=.03,col=GRAY,c=1,s=0) {
  const shade=(i,t,L)=>{BG[i]=C(col,1+L*.15*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveRound(vx,vy,c,s,hl,hw,0,h,Math.min(.012,h*.45),shade)),box:boxAt(x,y,c,s,hl,hw,0,h),mat:true};
}
// A video store's returns box facing (fx,fy): a steel drop box on its foot,
// a hooded slot with its flap, RETURNS over it.
function RETURNS_BOX(x,y,fx,fy) {
  const c=fy,s=-fx,blue=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE);
  const label=(i,t,L)=>{BG[i]=C(WHITE,4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'RETURNS',0,.8,.018,.03,C(BLUE,3),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.25,.2,.06,.9,blue,.03); // the box
    part(0,0,.22,.17,0,.06,GRAY,.01); // its foot
    part(0,.205,.14,.005,.66,.7,(i,t,L)=>{BG[i]=C(GRAY,.4);set(i,' ',0);return true;}); // the slot's flap, dark
    part(0,.22,.16,.02,.7,.72,blue,.006); // the hood over it
    part(0,.202,.12,.002,.76,.84,label); // the label
  }),box:boxAt(x,y,c,s,.25,.24,0,.9),radius:.35,returnsBox:{fx,fy}};
}
// The queue-ticket screen on its pole, facing (fx,fy), the number blinking.
function QUEUE_SCREEN(x,y,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(GRAY,1.6);set(i,' ',0);return true;}BG[i]=C(CYAN,4);return set(i,fract(T)<.5&&coveDetail(t,.1)>.3?'#':' ',C(WHITE,13)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.12,.12,0,.02,GRAY,.006); // the foot
    part(0,0,.018,.018,.02,1.22,GRAY,.008); // the pole
    part(0,0,.18,.03,1.2,1.5,screen); // the screen
  }),box:boxAt(x,y,c,s,.18,.12,0,1.5),radius:.25};
}
// A chest of drawers against a wall, its fronts to (fx,fy): a plinth, the
// carcass, three rows of drawers each with two knobs, a top.
function DRESSER(x,y,hl,hw,h,fx,fy) {
  const c=fy,s=-fx,wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,11),rows=3,rh=(h-.14)/rows;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,-.01,hl-.03,hw-.04,0,.08,wood,.006); // the plinth
    part(0,-.01,hl-.01,hw-.02,.07,h-.03,wood,.01); // the carcass
    for(let k=0;k<rows;k++){const z=.09+k*rh;
      part(0,hw-.02,hl-.04,.012,z+.01,z+rh-.01,wood,.006); // a drawer front
      for(const u of [-hl*.45,hl*.45])part(u,hw-.002,.012,.012,z+rh/2-.012,z+rh/2+.012,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL),.008);} // its knobs
    part(0,0,hl,hw,h-.035,h,wood,.012); // the top
  }),box:boxAt(x,y,c,s,hl,hw+.01,0,h),radius:Math.hypot(hl,hw)};
}
// A sewing machine on a table top at z, its needle end along +u: the bed, the
// pillar, the arm across, the head with the needle going.
function SEWING_MACHINE(x,y,z,c=1,s=0) {
  const body=(i,t,L)=>{BG[i]=C(GRAY,1.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s),up=fract(T*6)<.5?.01:0;
    part(0,0,.2,.1,z,z+.04,body,.01); // the bed
    part(-.15,0,.04,.06,z+.04,z+.2,body,.015); // the pillar
    part(-.01,0,.18,.045,z+.16,z+.22,body,.02); // the arm across
    part(.14,0,.04,.05,z+.09,z+.22,body,.015); // the head
    part(.14,.02,.003,.003,z+.05+up,z+.09,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),.002); // the needle, going
  }),box:boxAt(x,y,c,s,.2,.1,z,z+.22),radius:.25,sewing:{z}};
}
// A slatted crate of LPs, their top edges each a colour.
function RECORD_CRATE(x,y,hl,hw,seed) {
  const depth=.32,slats=grocerSlats(),sleeve=RECORD_BIN.sleeve,pitch=RECORD_BIN.pitch,len=hl*2-.04;
  const edges=gondolaFlat(1,0,(i,t,L)=>{const j=Math.floor((HIT.u+len/2)/pitch),col=RECORD_COLS[Math.floor(hash(j,seed,72)*RECORD_COLS.length)];
    BG[i]=C(col,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-coveGroove(HIT.u+len/2,pitch,.0015,t/projX)*coveDetail(t,.15)*1.2);set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,len/2,Math.min(hw-.02,sleeve/2),.012,.012+sleeve),edges); // the LPs, on edge
    foodTray(vx,vy,0,hl,hw,depth,slats);
  }),box:boxAt(x,y,1,0,hl,hw,0,.012+sleeve),radius:Math.hypot(hl,hw),recordCrate:{hl,hw,depth}};
}
// A low tea table: a top with an apron on four short legs.
function TEA_TABLE(x,y,hl,hw,h) {
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,5);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,h-.04,h,.01,wood); // the top
    coveRound(vx,vy,1,0,hl-.04,hw-.04,h-.09,h-.04,.006,wood); // the apron
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.07),vy+f*(hw-.07),1,0,.03,.03,0,h-.09,.008,wood); // the legs
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),teaTable:{h}};
}
// A floor cushion, plump, its piping a darker band.
function FLOOR_CUSHION(x,y,hl,hw,h,col) {
  const shade=(i,t,L)=>{const piping=Math.abs(HIT.w-h/2)<.008&&Math.abs(HIT.nz)<.6;BG[i]=C(col,(piping?1.4:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveRound(vx,vy,1,0,hl,hw,0,h,Math.min(.045,h*.45),shade)),box:boxAt(x,y,1,0,hl,hw,0,h),cushion:true};
}
const paintShade=(col,base,spread=.3)=>(i,t,L)=>{BG[i]=C(col,base+L*spread*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
// The motel's ice machine facing (fx,fy): a white cabinet, the bin door
// below with its handle, the snowflake panel above.
function ICE_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,white=paintShade(WHITE,2.8),flake=(i,t,L)=>{BG[i]=C(BLUE,4.5);return set(i,HIT.face===3&&coveDetail(t,.1)>.3&&(Math.abs(HIT.u)<.008||Math.abs(HIT.w-1.27)<.008)?'*':' ',C(WHITE,14)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.4,.35,.05,1.5,white,.03); part(0,0,.37,.32,0,.06,GRAY,.01); // cabinet and foot
    part(0,.352,.3,.004,.25,.8,white); part(0,.37,.18,.015,.68,.71,GRAY,.006); // the bin door, its handle
    part(0,.352,.2,.003,1.15,1.4,flake); // the panel
  }),box:boxAt(x,y,c,s,.4,.385,0,1.5),radius:.55};
}
// A wall rack of brochures facing (fx,fy): a back board and four tiers of
// pockets, a fan of leaflets standing in each.
function BROCHURE_RACK(x,y,hl,fx,fy) {
  const c=fy,s=-fx,board=paintShade(BRICK,1.6),cols=[YEL,CYAN,MAG,GREEN],n=Math.max(2,Math.floor(hl*2/.22));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,-.12,hl,.02,0,1.4,board,.006); // the back board
    for(let row=0;row<4;row++){const z=.5+row*.22;
      for(let k=0;k<n;k++){const u=-hl+hl/n*(2*k+1);
        part(u,-.064,hl/n-.02,.036,z+.005,z+.2,paintShade(cols[(k+row)&3],3.2,.25)); // the leaflets, against the board
        part(u,-.02,hl/n-.012,.008,z+.005,z+.1,(i,t,L)=>{BG[i]=C(CYAN,1.2);set(i,' ',0);return true;},.003);} // the clear pocket front
      part(0,-.06,hl,.045,z-.01,z+.005,board,.003);} // its shelf
  }),box:boxAt(x,y,c,s,hl,.15,0,1.4),radius:hl+.1,brochures:true};
}
// A steel workbench: a thick top, four angle legs, a shelf low down.
function WORKBENCH(x,y,hl,hw,h,col=GRAY) {
  const top=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,col);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,h-.05,h,.008,top); // the top
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.05),vy+f*(hw-.05),1,0,.025,.025,0,h-.05,.004,top); // the legs
    coveRound(vx,vy,1,0,hl-.05,hw-.05,.15,.18,.004,top); // the shelf
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),bench:{h}};
}
// A bench vice and a grinder on a bench top at z: the vice's jaws and screw,
// the grinder's motor and two wheels on edge.
function VICE_AND_GRINDER(x,y,z) {
  const blue=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE),wheel=[[-.012,0],[-.012,.09],[.012,.09],[.012,0]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx-.2,vy,1,0,.08,.07,z,z+.06,.01,blue); // the vice's body
    for(const e of [-1,1])coveRound(vx-.2,vy+e*.03,1,0,.06,.012,z+.06,z+.14,.004,blue); // its jaws
    coveTube(vx-.2,vy-.07,z+.08,vx-.2,vy-.18,z+.08,.008); // the screw handle
    coveRound(vx+.2,vy,1,0,.07,.06,z,z+.16,.02,GRAY); // the grinder's motor
    for(const e of [-1,1])shopDisc(vx+.2,vy+e*.09,1,0,z+.12,wheel,(i,t,L)=>{BG[i]=C(GRAY,1.6+L*.2);set(i,' ',0);return true;});
  }),box:boxAt(x,y,1,0,.3,.2,z,z+.21),radius:.4,vice:{z}};
}
// A cantilever rack of steel stock against a wall, facing (fx,fy): uprights,
// arms out from them, bars lying across the arms.
function STEEL_RACK(x,y,hl,fx,fy,h=1.8) {
  const c=fy,s=-fx,ups=[-hl+.05,0,hl-.05],arms=[.35,.75,1.15,1.55];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    for(const u of ups){part(u,-.2,.04,.06,0,h,GRAY,.008);for(const z of arms)part(u,0,.02,.26,z-.03,z,GRAY,.004);} // uprights and arms
    for(const [k,z] of arms.entries())for(let j=0;j<4;j++){const v=-.18+j*.11,r=.012+((k+j)%3)*.006;
      const [ax,ay]=[vx+c*(-hl)-s*v,vy+s*(-hl)+c*v],[bx,by]=[vx+c*hl-s*v,vy+s*hl+c*v];coveTube(ax,ay,z+r,bx,by,z+r,r);} // the bars, resting on the arms
  }),box:boxAt(x,y,c,s,hl,.3,0,h),radius:hl+.1,steelRack:{arms}};
}
// A gate half made, stood against a wall: a frame of tube, bars across it,
// a scroll along the middle.
function GATE_FRAME(x,y,hl,h,c=0,s=1) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const P=(u,z)=>[vx+c*u,vy+s*u,z],tube=(a,b)=>coveTube(...P(...a),...P(...b),.015);
    tube([-hl,.03],[hl,.03]);tube([-hl,h-.03],[hl,h-.03]);tube([-hl,.03],[-hl,h-.03]);tube([hl,.03],[hl,h-.03]); // the frame
    for(let u=-hl+.4;u<hl-.1;u+=.4)tube([u,.03],[u,h-.03]); // bars
    for(let k=0;k<12;k++){const u0=-hl+k*hl/6,u1=u0+hl/6;tube([u0,.8+Math.sin(u0*6)*.25],[u1,.8+Math.sin(u1*6)*.25]);} // the scroll
  }),box:boxAt(x,y,c,s,hl,.03,0,h),radius:hl,gate:{h}};
}
// A coffee vending machine facing (fx,fy): the cabinet, its lit panel, the cup bay.
function COFFEE_VENDING(x,y,fx,fy) {
  const c=fy,s=-fx,panel=(i,t,L)=>{BG[i]=C(BRICK,3);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'COFFEE',0,.98,.02,.035,C(WHITE,14),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.25,.25,0,1.1,GRAY,.02);
    part(0,.252,.18,.003,.82,1.06,panel);
    part(0,.21,.08,.045,.38,.56,(i,t,L)=>{BG[i]=C(GRAY,.4);set(i,' ',0);return true;}); // the cup bay, dark inside
    part(0,.27,.04,.015,.5,.53,GRAY,.004); // the coin slot's plate
  }),box:boxAt(x,y,c,s,.25,.29,0,1.1),radius:.4};
}
// The change machine facing (fx,fy): a cabinet, the note slot lit, the coin cup.
function CHANGE_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,sign=(i,t,L)=>{BG[i]=C(YEL,4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'CHANGE',0,1.25,.02,.035,C(GRAY,1),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.3,.2,0,1.4,GRAY,.02);
    part(0,.202,.2,.003,1.18,1.32,sign);
    part(0,.205,.08,.005,1.05,1.07,(i,t,L)=>{BG[i]=C(GREEN,3);set(i,' ',0);return true;}); // the note slot
    coveLathe(vx-s*.25,vy+c*.25,.55,[[0,0],[0,.07],[.06,.075],[.06,.065],[.01,.06],[.01,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz)); // the coin cup
  }),box:boxAt(x,y,c,s,.3,.33,0,1.4),radius:.4};
}
// A meat slicer on a counter top at z, its blade on edge to (fx,fy) turning.
function MEAT_SLICER(x,y,z,fx,fy) {
  const c=fy,s=-fx,blade=[[-.004,0],[-.004,.12],[.004,.12],[.004,0]];
  const spin=(i,t,L)=>{const a=Math.atan2(HIT.w-(z+.17),HIT.u)+T*30,glint=fract(a/TAU*3)<.1;BG[i]=C(GRAY,(glint?5:3)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.22,.17,z,z+.05,GRAY,.015); // the base
    part(-.04,-.04,.1,.06,z+.05,z+.22,GRAY,.02); // the motor housing behind the blade
    shopDisc(vx-s*.04,vy+c*.04,c,s,z+.17,blade,spin); // the blade
    part(.09,.09,.08,.05,z+.05,z+.08,GRAY,.008); // the carriage
  }),box:boxAt(x,y,c,s,.22,.17,z,z+.29),radius:.3,slicer:{z}};
}
// A take-a-number dispenser on its pole, the tickets to (fx,fy).
function TICKET_DISPENSER(x,y,fx,fy) {
  const c=fy,s=-fx,red=paintShade(RED,4,.2);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.12,.12,0,.02,GRAY,.006); part(0,0,.016,.016,.02,1.16,GRAY,.006); // foot and pole
    part(0,0,.1,.08,1.15,1.35,red,.03); // the dispenser
    part(0,.085,.025,.004,1.2,1.25,(i,t,L)=>{BG[i]=C(WHITE,5);set(i,' ',0);return true;}); // the ticket sticking out
  }),box:boxAt(x,y,c,s,.12,.12,0,1.35),radius:.2};
}
// An upholstered armchair facing (fx,fy), its seat at h: four feet, a base,
// one seat cushion, a back cushion, two arms joined to base and back.
function ARMCHAIR(x,y,fx,fy,col=BRICK,h=.42) {
  const c=-fy,s=fx,cloth=furnitureCloth(col),at=(u,v)=>[x+c*u+fx*v,y+s*u+fy*v],hl=.38;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const part=(u,v,a,b,z0,z1,r,mat='wood')=>coveRound(vx+c*u+fx*v,vy+s*u+fy*v,c,s,a,b,z0,z1,r,mat);
    for(const u of [-hl+.1,hl-.1])for(const v of [-.27,.27])part(u,v,.035,.035,0,.12,.012); // the feet
    part(0,0,hl-.04,.36,.1,h-.15,.03); // the base
    part(0,.04,hl-.16,.32,h-.15,h,.06,cloth); // the seat cushion
    part(0,-.31,hl-.16,.08,h-.02,.95,.06,cloth); // the back
    for(const e of [-1,1])part(e*(hl-.08),0,.08,.38,h-.18,h+.22,.06,cloth); // the arms
  }),box:boxAt(x,y,c,s,hl,.4,0,.95),radius:.55,armchair:{fx,fy,h}};
}
// Old suitcases lying one on another: [x, y, z0, z1, colour] each, a handle
// on the front and two straps round each.
function SUITCASE_PILE(cases) {
  const x=cases[0][0],y=cases[0][1],top=Math.max(...cases.map(q=>q[3]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const [cx,cy,z0,z1,col] of cases){const px=vx+cx-x,py=vy+cy-y,h=z1-z0;
    coveRound(px,py,1,0,.4,.28,z0,z1,.03,paintShade(col,2.2,.3)); // the case
    for(const e of [-.22,.22])coveRound(px+e,py,1,0,.025,.285,z0+.005,z1+.004,.004,paintShade(BRICK,1.2,.2)); // its straps
    coveTube(px-.07,py+.29,z0+h*.55,px+.07,py+.29,z0+h*.55,.01,BRICK);}}), // the handle
    box:boxAt(x,y,1,0,.42,.3,0,top),radius:.55,suitcases:{cases}};
}
// The tailor's cutting table: a top on four legs, a length of cloth laid on
// it with the pattern chalked, a rule along the front edge.
function CUTTING_TABLE(x,y,hl,hw,h,col=BLUE) {
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,13);
  const cloth=(i,t,L)=>{const u=HIT.u,v=HIT.v,chalk=Math.abs(Math.abs(u-.2)-.5)<.012||Math.abs(v-Math.sin(u*3)*.1)<.012;
    BG[i]=C(col,2.2+L*.2);return set(i,chalk&&coveDetail(t,.1)>.3?'.':' ',C(WHITE,12)),true;};
  const rule=(i,t,L)=>{BG[i]=C(YEL,4);return set(i,fract(HIT.u*10)<.1&&coveDetail(t,.1)>.3?'|':' ',C(GRAY,2)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,.9,.4,h,h+.004),gondolaFlat(1,0,cloth)); // the cloth, flat on the top
    drawBox(boxAt(vx,vy+hw-.025,1,0,hl-.05,.02,h,h+.003),gondolaFlat(1,0,rule)); // the rule
    coveRound(vx,vy,1,0,hl,hw,h-.04,h,.01,wood);
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.08),vy+f*(hw-.08),1,0,.035,.035,0,h-.04,.01,wood);
    coveRound(vx,vy,1,0,hl-.1,hw-.1,.12,.15,.006,wood); // the shelf low down
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.004),radius:Math.hypot(hl,hw),cuttingTable:{h}};
}
// A fitting mirror standing on its feet, the glass to (fx,fy).
function FITTING_MIRROR(x,y,hl,h,fx,fy) {
  const c=fy,s=-fx,glass=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(BRICK,1.8);set(i,' ',0);return true;}BG[i]=C(CYAN,1.4+(HIT.w*.6));return set(i,fract((HIT.u+HIT.w)*2)<.05?'/':' ',C(WHITE,12)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,.02,.08,h,glass); // the glass in its frame
    for(const e of [-1,1]){part(e*(hl+.015),0,.015,.03,0,h,'wood',.006);part(e*hl,0,.04,.15,0,.04,'wood',.01);} // the frame's sides, the feet
    part(0,0,hl+.03,.03,h,h+.03,'wood',.008); // its head
  }),box:boxAt(x,y,c,s,hl+.04,.15,0,h+.03),radius:hl+.1,mirror:{fx,fy}};
}
// A curtain drawn back on its rail: the folds bunched as soft columns, along u (c,s).
function CURTAIN_DRAWN(x,y,hl,z0,z1,col,c=1,s=0) {
  const fold=k=>(i,t,L)=>{BG[i]=C(col,1.6+(k&1)*.6+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;},n=Math.max(3,Math.round(hl*2/.12));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=0;k<n;k++){const u=-hl+hl/n*(2*k+1),v=(k&1)?.012:-.012;coveRound(vx+c*u-s*v,vy+s*u+c*v,c,s,hl/n+.004,.03,z0,z1,.028,fold(k));}
    coveTube(vx-c*(hl+.05),vy-s*(hl+.05),z1+.03,vx+c*(hl+.05),vy+s*(hl+.05),z1+.03,.012); // the rail
  }),box:boxAt(x,y,c,s,hl,.045,0,z1+.05),radius:hl+.1,curtain:true};
}
// A hot-dog roller on a counter at z: a steel tray, the rollers turning, the
// sausages resting between them.
function HOTDOG_ROLLER_AT(x,y,z) {
  const n=6,pitch=.04,r=.012,sr=.021,roll=(i,t,L)=>{const ridge=fract(HIT.u*20+T*2)<.5;BG[i]=C(GRAY,(ridge?3.2:2.4)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const sz=z+.03+r+Math.sqrt((r+sr)**2-(pitch/2)**2); // a sausage's centre, touching both rollers under it
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const k of [0,2,4])coveTube(vx-.14,vy+(-n/2+k+1)*pitch,sz,vx+.14,vy+(-n/2+k+1)*pitch,sz,sr,BRICK); // the sausages
    for(let k=0;k<n;k++){const v=(-n/2+k+.5)*pitch;drawBox({...boxAt(vx,vy+v,1,0,.18,r,z+.03,z+.03+2*r),ax:vx-.18,ay:vy+v,az:z+.03+r,bx:vx+.18,by:vy+v,bz:z+.03+r,r},roll,coveRayCapsule);}
    coveRound(vx,vy,1,0,.22,.14,z,z+.03,.008,GRAY); // the tray
  }),box:boxAt(x,y,1,0,.22,.14,z,sz+sr),radius:.3,roller:{z}};
}
