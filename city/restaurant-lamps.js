// Restaurant lamps and parlour chairs that were still painted drums and line
// rods, built: round red lanterns with gold caps and tassels, Tiffany shades
// of leaded coloured glass, enamelled heat-lamp shades with their bulbs
// glowing underneath, and wire parlour chairs. Every lamp hangs on a cord
// from a ceiling rose.
function restaurantCord(vx,vy,z,ceiling) {
  coveLathe(vx,vy,ceiling-.02,[[0,0],[0,.03],[.006,.032],[.02,.02],[.02,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz)); // the rose
  coveLathe(vx,vy,z,[[0,0],[0,.003],[ceiling-.02-z,.003],[ceiling-.02-z,0]],(i,t,L)=>{BG[i]=C(GRAY,.6);set(i,' ',0);return true;});
}
// A round paper lantern: a globe on vertical ribs between gold caps, lit from
// inside (brightest where you look straight through), a gold tassel below.
const ROUND_LANTERN={radius:.22,height:.34,cap:.085,capH:.035,tassel:.24};
const ROUND_LANTERN_GLOBE=(()=>{
  const {radius:R,height:H,cap}=ROUND_LANTERN,out=[[0,0],[0,cap]];
  for(let k=1;k<12;k++){const f=k/12,r=R*Math.sqrt(1-(2*f-1)**2);out.push([H*f,Math.max(cap,r)]);}
  return [...out,[H,cap],[H,0]];
})();
function ROUND_LANTERN_LAMP(x,y,top=2.3) {
  const {height:H,cap,capH,tassel}=ROUND_LANTERN,base=top-H,ceiling=()=>room.def.height||3;
  const paper=(i,t,L)=>{
    const r=Math.hypot(HIT.u,HIT.v),view=r>1e-6?Math.abs((HIT.u*dx+HIT.v*dy)/r):1;
    const rib=coveGroove(Math.atan2(HIT.v,HIT.u)*ROUND_LANTERN.radius,.07,.004,t/projX)*coveDetail(t,.4);
    BG[i]=C(RED,(4.2+4.2*view)*(.5+.5*Math.max(night,.35))-rib*2.6);set(i,' ',0);return true;
  };
  const gold=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const fringe=(i,t,L)=>{const cord=coveGroove(Math.atan2(HIT.v,HIT.u)*.03,.006,.002,t/projX)*coveDetail(t,.2);BG[i]=C(YEL,4.4+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)-cord*1.6);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,base-tassel,[[0,0],[0,.03],[.16,.018],[.18,.012],[.18,0]],fringe); // the tassel, its cords flaring out
    coveLathe(vx,vy,base-tassel+.18,[[0,0],[0,.014],[tassel-.18-capH,.008],[tassel-.18-capH,0]],gold); // its knot and cord up to the cap
    coveLathe(vx,vy,base-capH,[[0,0],[0,cap*.7],[capH*.6,cap+.01],[capH,cap+.01],[capH,0]],gold);
    coveLathe(vx,vy,base,ROUND_LANTERN_GLOBE,paper);
    coveLathe(vx,vy,top,[[0,0],[0,cap+.01],[capH*.4,cap+.01],[capH,cap*.7],[capH,0]],gold);
    restaurantCord(vx,vy,top+capH,ceiling());
  }),radius:ROUND_LANTERN.radius+.05,roundLantern:{x,y,top,base,height:H,bottom:base-tassel}};
}
// A Tiffany shade: a dome of coloured glass in leaded segments, a brass cap,
// the bulb's glow under it.
const TIFFANY_SHADE=[[0,0],[0,.24],[.012,.24],[.05,.215],[.11,.15],[.16,.08],[.18,.045],[.18,0]];
function TIFFANY_LAMP(x,y,bottom=1.77) {
  const ceiling=()=>room.def.height||3,top=bottom+.18;
  const glass=(i,t,L)=>{
    if(HIT.nz< -.9){BG[i]=C(WARM,13);set(i,' ',0);return true;} // looking up at the bulb through the open rim
    const a=Math.atan2(HIT.v,HIT.u),seg=Math.floor((a/Math.PI+1)*6),band=Math.floor((HIT.w-bottom)/.06);
    const f=t/projX,lead=Math.min(1,coveGroove(a*.2,Math.PI*.2/6,.004,f)+coveGroove(HIT.w-bottom,.06,.004,f))*coveDetail(t,.4);
    const col=[RED,YEL,GREEN,ORANGE,YEL,GREEN][(seg+band)%6];
    BG[i]=C(col,(4+2*Math.max(night,.4))-lead*3.4);set(i,' ',0);return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,bottom,TIFFANY_SHADE,glass);
    coveLathe(vx,vy,top-.005,[[0,0],[0,.05],[.02,.04],[.04,.012],[.04,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL)); // the brass cap
    restaurantCord(vx,vy,top+.035,ceiling());
  }),radius:.27,tiffanyLamp:{x,y,bottom,top}};
}
// An enamelled heat-lamp shade, its bulb glowing under the rim.
const HEAT_LAMP_SHADE=[[0,0],[0,.12],[.015,.115],[.06,.07],[.11,.035],[.13,.025],[.13,0]];
function HEAT_LAMP(x,y,bottom,col=RED) {
  const ceiling=()=>room.def.height||3;
  const shade=(i,t,L)=>{
    if(HIT.nz< -.9){BG[i]=C(HIT.u*HIT.u+HIT.v*HIT.v<.004?YEL:ORANGE,HIT.u*HIT.u+HIT.v*HIT.v<.004?14:11);set(i,' ',0);return true;} // the bulb and the glow round it
    BG[i]=C(col,2.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,bottom,HEAT_LAMP_SHADE,shade);
    restaurantCord(vx,vy,bottom+.13,ceiling());
  }),radius:.15,heatLamp:{x,y,bottom,top:bottom+.13}};
}
// A wire parlour chair: a padded round seat on a wire ring, four splayed
// legs joined by a ring low down, and a round hoop back facing the seat, its
// inner ring held in the hoop by four short bars.
const WIRE_CHAIR_BACK={hoop:[.148,.165,.005],inner:[.07,.08,.003],bars:4,wire:.004};
function WIRE_CHAIR(x,y,fx,fy,col) {
  const seatZ=.48,hz=.76,c=fy,s=-fx; // the back hoop faces (fx, fy): its axis is the lathe's +v, (-s, c)
  const wire=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,WHITE);
  const cushion=(i,t,L)=>{BG[i]=C(col,3.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveLathe(vx,vy,seatZ-.045,[[0,0],[0,.19],[.01,.2],[.035,.2],[.045,.185],[.045,0]],cushion);
    coveLathe(vx,vy,seatZ-.06,[[0,.17],[0,.18],[.015,.18],[.015,.17],[0,.17]],wire); // the seat ring
    coveLathe(vx,vy,.16,[[0,.172],[0,.184],[.01,.184],[.01,.172],[0,.172]],wire); // the leg ring, where the splayed legs pass
    for(const [ex,ey]of [[1,1],[1,-1],[-1,1],[-1,-1]])coveTube(vx+ex*.13,vy+ey*.13,.008,vx+ex*.12,vy+ey*.12,seatZ-.06,.008,WHITE);
    const bx=vx-fx*.17,by=vy-fy*.17;
    for(const e of [-1,1])coveTube(bx+fy*e*.1,by-fx*e*.1,seatZ-.05,bx+fy*e*.1,by-fx*e*.1,hz-.12,.008,WHITE); // two back posts up to the hoop
    // the hoop and its inner ring, turned side-on with the wall clock's lathe ray
    const B=WIRE_CHAIR_BACK;
    for(const [r0,r1,d]of [B.hoop,B.inner])
      drawBox({...boxAt(bx,by,c,s,r1,d,hz-r1,hz+r1),centerZ:hz,clockShape:{x:0,y:0,profile:[[-d,r0],[-d,r1],[d,r1],[d,r0],[-d,r0]]}},wire,homeClockRay);
    for(let k=0;k<B.bars;k++){ // the bars, flat in the hoop's plane, from inside the inner ring out into the hoop
      const a=(k+.5)*TAU/B.bars,ux=Math.cos(a),uz=Math.sin(a),r0=B.inner[0]+.004,r1=B.hoop[0]+.006,mid=(r0+r1)/2,half=(r1-r0)/2,W=B.wire;
      drawBox({...boxAt(bx+c*ux*mid,by+s*ux*mid,c,s,Math.abs(ux)*half+W,.003,hz+uz*mid-Math.abs(uz)*half-W,hz+uz*mid+Math.abs(uz)*half+W),handRatio:.003/W,
        handShape:{ax:ux*(r0-mid),ay:0,az:hz+uz*r0,bx:ux*(r1-mid),by:0,bz:hz+uz*r1,r:W}},wire,homeClockRayHand);
    }
  },[.2,.2,seatZ]),seat:true,fx,fy,h:seatZ,wireChair:{x,y,fx,fy,seat:seatZ,back:hz}};
}
