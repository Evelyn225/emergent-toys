// The dim sum hall's live seafood tank is a built tank rather than fish
// painted on a box: a steel cabinet with doors, a glass tank in a steel frame
// under a lit hood, a gravel bed, an air stone with rising bubbles, groupers
// swimming loops through the water and live lobsters, claws banded, on the
// gravel. Local u runs along the wall, v out into the room from the wall face.
const SEAFOOD_TANK={depth:.56,cabinet:.78,rail:.03,glass:.006,water:1.44,top:1.52,hood:1.62,gravel:.04,post:.016};
// Each grouper swims an ellipse: long along the tank, narrow across it, so it
// turns through the cross-tank direction at each end instead of flipping.
function seafoodTankFish(half,inner,seed) {
  return [0,1,2].map(k=>({len:.15-k*.015,z:1.02+k*.13+hash(seed,k,1401)*.04,
    a:half-.24,b:inner-.21,period:13+hash(seed,k,1403)*6,phase:hash(seed,k,1405)*6.3,col:[BRICK,ORANGE,BRICK][k]}));
}
function seafoodFishPose(f,t) {
  const w=Math.PI*2/f.period,p=w*t+f.phase,u=f.a*Math.sin(p),v=f.b*Math.cos(p),du=f.a*w*Math.cos(p),dv=-f.b*w*Math.sin(p),h=Math.hypot(du,dv);
  return {u,v,c:du/h,s:dv/h};
}
function seafoodSkin(base,belly,seed) { // darker back, paler belly, mottled like a grouper
  return (i,t,L)=>{
    const spot=hash(Math.floor(HIT.u*60),Math.floor(HIT.w*60),seed)>.78&&coveDetail(t,.5)>.3;
    BG[i]=C(HIT.nz< -.3?belly:base,(HIT.nz< -.3?3.4:2.4)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-(spot?1.2:0));set(i,' ',0);return true;
  };
}
// (x, y): the middle of the wall face behind it; (fx, fy) points into the room.
function SEAFOOD_TANK_UNIT(x,y,half,fx=1,fy=0,seed=7) {
  const T_=SEAFOOD_TANK,c=-fy,s=fx,depth=T_.depth,hw=depth/2,cx=x+fx*hw,cy=y+fy*hw,inner=hw-T_.post;
  const fish=seafoodTankFish(half,inner,seed),floor=T_.cabinet+T_.rail+T_.gravel;
  const lobsters=[{u:-half*.45,v:-.04,turn:.5},{u:half*.35,v:.06,turn:-2.4}];
  const bubbles=Array.from({length:7},(_,k)=>({k,r:.006+hash(seed,k,1411)*.004}));
  const steel=kitchenSteel;
  const doorShade=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  const glass=(i,t,L)=>{ // clear: only sparse diagonal glints where the light catches it
    const glint=coveGroove(HIT.u+HIT.w*.6,.9,.004,t/projX)*coveDetail(t);
    if(glint<.5)return false;BG[i]=C(CYAN,2.6+L*.2);set(i,' ',0);return true;
  };
  const back=(i,t,L)=>{ // the inside back: blue water light, deeper lower down
    const z=(HIT.w-floor)/(T_.water-floor);BG[i]=C(BLUE,1.2+z*1.6+L*.05);set(i,' ',0);return true;
  };
  const gravel=(i,t,L)=>{
    const g=hash(Math.floor(HIT.u*90),Math.floor((HIT.v+HIT.w)*90),1413),fine=coveDetail(t,.3);
    BG[i]=C(g>.6?STONE:g>.3?BRICK:GRAY,2+L*.12+(fine?g-.5:0));set(i,' ',0);return true;
  };
  const surface=(i,t,L)=>{ // seen from above: the water only shows where ripples catch the hood light
    const ripple=Math.sin(HIT.u*40+T*2)*Math.sin(HIT.v*36-T*1.6);
    if(ripple<.82||coveDetail(t)<.2)return false;BG[i]=C(CYAN,3+L*.2);set(i,' ',0);return true;
  };
  const hoodShade=(i,t,L)=>{ // its lamp shows under the hood's front lip
    if(HIT.nz< -.9){BG[i]=C(WHITE,9);set(i,' ',0);return true;}
    return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  };
  const shell=(base)=>(i,t,L)=>{BG[i]=C(base,1.8+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const band=(i,t,L)=>{BG[i]=C(YEL,4+L*.3);set(i,' ',0);return true;};
  const eye=(i,t,L)=>{BG[i]=C(BLACK,0);set(i,' ',0);return true;};
  const bubble=(i,t,L)=>{BG[i]=C(WHITE,5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const skins=fish.map((f,k)=>seafoodSkin(f.col,STONE,seed*5+k));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*(hw+v),vy+s*u+fy*(hw+v)]; // v measured from the tank's middle
    // (cc, ss): a heading in the tank's own (u, v) frame, turned into the world
    const ell=(u,v,z,cc,ss,hx,hy,hz,shade)=>{const [ex,ey]=at(u,v),gx=c*cc+fx*ss,gy=s*cc+fy*ss;drawBox(boxAt(ex,ey,gx,gy,hx,hy,z-hz,z+hz),shade,homeRayEllipsoid);};
    // The frame and glass nearest the room first.
    for(const side of [-1,1]){const [px_,py_]=at(side*(half-T_.post),inner);coveTube(px_,py_,T_.cabinet,px_,py_,T_.top,T_.post,GRAY);}
    const [gx0,gy0]=at(0,hw-T_.glass);drawBox(boxAt(gx0,gy0,c,s,half-T_.post*2,T_.glass/2,T_.cabinet+T_.rail,T_.top-T_.rail),glass);
    for(const side of [-1,1]){
      // Seen from inside the tank (through the front), the end panes show the
      // water edge on; seen from outside they are clear.
      const [sx,sy]=at(side*(half-T_.glass/2),0),inside=side>0?2:1;
      drawBox(boxAt(sx,sy,c,s,T_.glass/2,inner,T_.cabinet+T_.rail,T_.top-T_.rail),(i,t,L)=>HIT.face===inside&&HIT.w<T_.water?back(i,t,L):glass(i,t,L));
    }
    // Swimming groupers: body, tail, dorsal fin and eyes share one heading.
    fish.forEach((f,k)=>{
      const q=seafoodFishPose(f,T),L_=f.len;
      ell(q.u,q.v,f.z,q.c,q.s,L_,L_*.32,L_*.4,skins[k]);
      const tail=-L_*1.05,wag=Math.sin(T*5+k)*.3;
      ell(q.u+q.c*tail-q.s*wag*.05,q.v+q.s*tail+q.c*wag*.05,f.z,q.c,q.s,L_*.28,L_*.06,L_*.3,skins[k]);
      ell(q.u-q.c*L_*.1,q.v-q.s*L_*.1,f.z+L_*.36,q.c,q.s,L_*.6,L_*.05,L_*.1,skins[k]);
      for(const side of [-1,1])ell(q.u+q.c*L_*.7-q.s*side*L_*.24,q.v+q.s*L_*.7+q.c*side*L_*.24,f.z+L_*.1,1,0,.008,.008,.008,eye);
    });
    // Live lobsters on the gravel: carapace, tail segments and fan, banded claws, feelers.
    for(const [n,o]of lobsters.entries()) {
      const cc=Math.cos(o.turn),ss=Math.sin(o.turn),z=floor,P=(a,b)=>[o.u+cc*a-ss*b,o.v+ss*a+cc*b];
      const dark=shell(n?GREEN:BLUE);
      let [u,v]=P(0,0);ell(u,v,z+.03,cc,ss,.07,.035,.03,dark);
      for(let k=0;k<4;k++){[u,v]=P(-.08-k*.03,0);ell(u,v,z+.022,cc,ss,.022,.032-k*.004,.02,dark);}
      [u,v]=P(-.205,0);ell(u,v,z+.012,cc,ss,.02,.04,.008,dark);
      for(const side of [-1,1]) {
        const [au,av]=P(.06,side*.03),[bu,bv]=P(.12,side*.07),[a0,a1]=at(au,av),[b0,b1]=at(bu,bv);
        coveTube(a0,a1,z+.025,b0,b1,z+.022,.008,n?GREEN:BLUE); // the arm
        [u,v]=P(.17,side*.08);ell(u,v,z+.022,cc,ss,.05,.022,.018,dark);
        [u,v]=P(.15,side*.08);ell(u,v,z+.022,cc,ss,.006,.024,.02,band); // the rubber band round the claw
        const sway=Math.sin(T*1.3+n*2+side)*.03,[f0,f1]=at(...P(.07,side*.012)),[e0,e1]=at(...P(.3,side*(.1+sway)));
        coveTube(f0,f1,z+.04,e0,e1,z+.12+sway,.0025,RED); // feelers
        for(let k=0;k<3;k++){const [l0,l1]=at(...P(-.02+k*.03,side*.03)),[m0,m1]=at(...P(-.03+k*.03,side*.06));coveTube(l0,l1,z+.02,m0,m1,floor,.003,n?GREEN:BLUE);}
      }
    }
    // Bubbles rising from the air stone in the back corner.
    const [ax,ay]=at(half-.12,-inner+.06);
    for(const b of bubbles){const z=floor+.03+fract(T*.35+b.k/bubbles.length)*(T_.water-floor-.04);coveLathe(ax+Math.sin(z*30+b.k)*.008,ay,z,[[0,0],[0,b.r*.6],[b.r,b.r],[b.r*2,b.r*.6],[b.r*2,0]],bubble);}
    coveLathe(ax,ay,floor-.005,[[0,0],[0,.03],[.025,.026],[.03,0]],(i,t,L)=>{BG[i]=C(GRAY,1.5+L*.15);set(i,' ',0);return true;});
    const [wx,wy]=at(0,0);
    drawBox(boxAt(wx,wy,c,s,half-T_.glass,inner,T_.water-.002,T_.water),surface);
    drawBox(boxAt(wx,wy,c,s,half-T_.glass,inner,T_.cabinet+T_.rail,floor),gravel);
    const [bx,by]=at(0,-inner+.005);drawBox(boxAt(bx,by,c,s,half,.005,floor,T_.top),back);
    // Rails, hood and the cabinet below.
    for(const [z0,z1]of [[T_.cabinet,T_.cabinet+T_.rail],[T_.top-T_.rail,T_.top]])drawBox({...boxAt(wx,wy,c,s,half,hw,z0,z1),...kitchenPanelProfile(half,hw,z0,z1,.004)},steel,homeRayWorktop);
    drawBox({...boxAt(wx,wy,c,s,half,hw,T_.top,T_.hood),...kitchenTopProfile(half,hw,T_.top,T_.hood,.01)},hoodShade,homeRayWorktop);
    for(const side of [-1,1]) {
      const [dx_,dy_]=at(side*half/2,hw+.006),[hx0,hy0]=at(side*.06,hw+.03),[hx1,hy1]=at(side*.06,hw+.006);
      coveTube(hx0,hy0,.36,hx0,hy0,.6,.008,GRAY);for(const z of [.38,.58])coveTube(hx0,hy0,z,hx1,hy1,z,.006,GRAY);
      drawBox({...boxAt(dx_,dy_,c,s,half/2-.01,.006,.08,T_.cabinet-.04),...kitchenPanelProfile(half/2-.01,.006,.08,T_.cabinet-.04)},doorShade,homeRayWorktop);
    }
    drawBox({...boxAt(wx,wy,c,s,half,hw,0,T_.cabinet),...kitchenPanelProfile(half,hw,0,T_.cabinet,.006)},steel,homeRayWorktop);
  }),box:boxAt(cx,cy,c,s,half,hw,0,T_.hood),radius:Math.hypot(half,hw)+.05,
    seafoodTank:{x,y,half,fx,fy,depth,inner,floor,water:T_.water,top:T_.top,fish,lobsters,bubbles:bubbles.length}};
}
