// Wall fixtures that used to be painted on restaurant walls, built: the pho
// shop's oscillating wall fans, the kissaten's wall clock and the roastery's
// trailing plants. Each mounts on the wall face it stands off; (fx, fy)
// points from that face into the room.

// A side-on lathe (its axis along the facing) and a flat blade, drawn with
// the wall clock's rays: homeClockRay and homeClockRayHand.
function wallLathe(vx,vy,c,s,z,v0,profile,shade) {
  const lo=Math.min(...profile.map(q=>q[0])),hi=Math.max(...profile.map(q=>q[0])),r=Math.max(...profile.map(q=>q[1])),mid=(lo+hi)/2;
  drawBox({...boxAt(vx-s*(v0+mid),vy+c*(v0+mid),c,s,r,(hi-lo)/2,z-r,z+r),centerZ:z,clockShape:{x:0,y:0,profile:profile.map(([v,q])=>[v-mid,q])}},shade,homeClockRay);
}
const PHO_FAN={pivot:.24,cage:.2,blade:.11,width:.04,speed:9,sweep:.55,period:9};
// The fan's heading at time t: it sweeps either side of straight out.
function phoFanHeading(fx,fy,t,phase=0) {
  const a=Math.atan2(fy,fx)+PHO_FAN.sweep*Math.sin(t*TAU/PHO_FAN.period+phase);
  return [Math.cos(a),Math.sin(a)];
}
function PHO_WALL_FAN(x,y,z,fx,fy,phase=0) {
  const F=PHO_FAN,plastic=(base,lv)=>(i,t,L)=>{BG[i]=C(base,lv+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const white=plastic(WHITE,3.6),blue=plastic(CYAN,2.6),wire=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,WHITE);
  const px=x+fx*F.pivot,py=y+fy*F.pivot; // the head turns about this point on its arm
  return {...ROOM_MODEL(px,py,(vx,vy)=>{
    const [hx,hy]=phoFanHeading(fx,fy,T,phase),c=hy,s=-hx; // heading (hx, hy) is the lathe's +v: (-s, c)
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    // v = 0 is the middle of the motor, over the pivot. The front grille: a
    // rim and three rings in one plane.
    const front=.16,spinner=.11,back=.055,W=F.width;
    // (Concentric rings rather than radial spokes: wire that thin would fall
    // back to line glyphs a few metres off.)
    const ring=(v,r)=>wallLathe(vx,vy,c,s,z,v,[[-.002,r-.003],[-.002,r+.003],[.002,r+.003],[.002,r-.003],[-.002,r-.003]],wire);
    for(const r of [.05,.1,.15])ring(front,r);
    wallLathe(vx,vy,c,s,z,front,[[-.002,0],[-.002,.03],[.012,.03],[.012,0]],blue); // the badge on the grille's hub
    // three blades on the spinner, turning, their tips inside the rim
    const spin=T*F.speed;
    for(let k=0;k<3;k++){
      const a=spin+k*TAU/3,ux=Math.cos(a),uz=Math.sin(a),half=F.blade/2,mid=.03+half,cu=ux*mid,[bx,by]=at(cu,spinner);
      drawBox({...boxAt(bx,by,c,s,Math.abs(ux)*half+W,.004,z+uz*mid-Math.abs(uz)*half-W,z+uz*mid+Math.abs(uz)*half+W),handRatio:.004/W,
        handShape:{ax:ux*.03-cu,ay:0,az:z+uz*.03,bx:ux*(.03+F.blade)-cu,by:0,bz:z+uz*(.03+F.blade),r:W}},blue,homeClockRayHand);
    }
    wallLathe(vx,vy,c,s,z,spinner,[[-.012,0],[-.012,.035],[.012,.03],[.016,0]],white); // the spinner
    // rim and back grille, then the motor housing behind
    wallLathe(vx,vy,c,s,z,back,[[-.01,F.cage-.004],[-.01,F.cage+.006],[front-back+.002,F.cage+.006],[front-back+.002,F.cage-.004],[-.01,F.cage-.004]],white);
    for(const r of [.09,.14])ring(back,r);
    wallLathe(vx,vy,c,s,z,-.065,[[0,0],[0,.04],[.02,.065],[.09,.07],[.115,.05],[.12,0]],white);
    // the arm from the wall plate to the pivot under the motor, the post up
    // into it, and the plate
    const [wx,wy]=[vx-fx*F.pivot,vy-fy*F.pivot];
    coveTube(wx+fx*.03,wy+fy*.03,z-.16,vx,vy,z-.11,.016,WHITE);
    coveTube(vx,vy,z-.11,vx,vy,z-.055,.016,WHITE);
    drawBox({...boxAt(wx+fx*.012,wy+fy*.012,-fy,fx,.06,.012,z-.24,z-.08),...kitchenPanelProfile(.06,.012,z-.24,z-.08,.006)},white,homeRayWorktop);
  }),radius:F.pivot+F.cage+.1,phoFan:{x,y,z,fx,fy,phase,px,py}};
}

// A wall clock for the coffee house: the home clock fixture, its back
// standing on the wall face.
function KISSATEN_CLOCK(x,y,z,fx,fy) {
  const depth=HOME_FURNITURE.f_clock.hy,a=Math.atan2(-fx,fy); // the clock faces (-sin a, cos a)
  return {...HOME_WALL_CLOCK({id:'f_clock',x:x+fx*depth,y:y+fy*depth,z,a}),kissatenClock:{x,y,z,fx,fy}};
}

// A trailing plant: a terracotta pot on a wall bracket, vines of leaves
// falling down the wall in front of it.
function trailingVines(seed) {
  return [-1,0,1].map(k=>({off:k*.07+(hash(seed,k,1601)-.5)*.03,len:.45+hash(seed,k,1603)*.35,sway:hash(seed,k,1605)*6}));
}
function TRAILING_PLANT(x,y,z,fx,fy,seed=x*5+y) {
  const c=-fy,s=fx,vines=trailingVines(seed),pot=[[0,0],[0,.05],[.01,.055],[.1,.075],[.1,.085],[.115,.085],[.115,.075],[.105,.073],[.105,0]],potV=.12;
  const clay=(i,t,L)=>{
    if(HIT.nz>.9&&HIT.w>z+.1&&HIT.w<z+.11){BG[i]=C(BRICK,1.2);set(i,' ',0);return true;} // the soil
    BG[i]=C(ORANGE,1.8+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  const leaf=k=>(i,t,L)=>{BG[i]=C(GREEN,1.8+(k%3)*.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const leaves=[];
  // Each vine spills over the pot's front rim and falls back toward the wall.
  const reach=d=>Math.max(.03,potV+.09-d*.25);
  for(const [n,q]of vines.entries())for(let k=1;k*.06<q.len;k++){
    const drop=k*.06,side=Math.sin(k*1.3+q.sway)*.025;
    leaves.push({u:q.off+side,v:reach(drop),z:z+.1-drop,k:k+n});
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    for(const q of leaves){const [lx,ly]=at(q.u,q.v);drawBox(boxAt(lx,ly,c,s,.03,.01,q.z-.028,q.z+.028),leaf(q.k),homeRayEllipsoid);}
    for(const q of vines){const [ax,ay]=at(q.off,reach(0)),[bx,by]=at(q.off,reach(q.len));coveTube(ax,ay,z+.11,bx,by,z+.1-q.len+.03,.003,GREEN);}
    const [px_,py_]=at(0,potV);coveLathe(px_,py_,z,pot,clay);
    // the bracket: a wall plate, an arm under the pot, a brace
    const [wx,wy]=at(0,.006),[ex,ey]=at(0,potV);
    drawBox({...boxAt(wx,wy,c,s,.03,.006,z-.12,z+.01),...kitchenPanelProfile(.03,.006,z-.12,z+.01,.003)},(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY),homeRayWorktop);
    coveTube(wx+fx*.006,wy+fy*.006,z-.006,ex,ey,z-.006,.006,GRAY);
    coveTube(wx+fx*.006,wy+fy*.006,z-.1,ex-fx*.03,ey-fy*.03,z-.008,.004,GRAY);
  }),radius:.45,trailingPlant:{x,y,z,fx,fy,vines,leaves:leaves.map(q=>({...q})),pot:{v:potV,top:z+.115,radius:.085}}};
}
