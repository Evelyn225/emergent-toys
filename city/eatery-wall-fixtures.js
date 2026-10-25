// Wall fixtures that used to be painted in the ice-cream parlour and the
// burger joint, built: a rack of wafer cones in wire rings, and the kitchen
// pass with its steel shelf, heat lamps and ticket rail. Each mounts on the
// wall face it stands off; (fx, fy) points into the room and local u runs
// along the wall.
const CONE_RACK={rows:[1.32,1.58],per:6,pitch:.28,ring:.03,v:.075,stack:4,step:.022};
const WAFER_CONE=[[0,0],[0,.003],[.12,.028],[.13,.031],[.13,.027],[.02,.005],[.02,0]];
function waferShade(seed) { // golden wafer, a diamond grid pressed into it
  return (i,t,L)=>{
    const a=Math.atan2(HIT.v,HIT.u),f=t/projX,r=Math.hypot(HIT.u,HIT.v);
    const grid=Math.min(1,coveGroove(a*r*6+HIT.w*6,.08,.012,f*6)+coveGroove(a*r*6-HIT.w*6,.08,.012,f*6))*coveDetail(t,.3);
    BG[i]=C(seed&1?ORANGE:YEL,(seed&1?3.4:3)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-grid*1.1);set(i,' ',0);return true;
  };
}
function ICECREAM_CONE_RACK(x,y,fx,fy) {
  const R=CONE_RACK,c=-fy,s=fx,holders=[];
  for(const [row,z]of R.rows.entries())for(let k=0;k<R.per;k++)holders.push({u:(k-(R.per-1)/2)*R.pitch,z,row});
  const half=(R.per-1)/2*R.pitch+.06,steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  const wafers=[0,1,2,3].map(waferShade);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    for(const [n,q]of holders.entries()) {
      const [hx,hy]=at(q.u,R.v),ring=R.ring,base=q.z-.12; // the lowest cone rests in the ring at 2.8 cm across, inside the ring's 2.7 cm hole
      for(let k=R.stack-1;k>=0;k--)coveLathe(hx,hy,base+k*R.step,WAFER_CONE,wafers[(n+k)&3]);
      coveLathe(hx,hy,q.z-.004,[[0,ring-.003],[0,ring+.003],[.006,ring+.003],[.006,ring-.003],[0,ring-.003]],steel);
      const [ax,ay]=at(q.u,R.v-ring),[bx,by]=at(q.u,.02);coveTube(ax,ay,q.z,bx,by,q.z,.004,GRAY);
    }
    // a steel rail along each row on two wall plates
    for(const z of R.rows) {
      const [rx0,ry0]=at(-half,.02),[rx1,ry1]=at(half,.02);coveTube(rx0,ry0,z,rx1,ry1,z,.008,GRAY);
      for(const e of [-1,1]){const [px_,py_]=at(e*(half-.04),.006);drawBox({...boxAt(px_,py_,c,s,.025,.006,z-.04,z+.04),...kitchenPanelProfile(.025,.006,z-.04,z+.04,.003)},steel,homeRayWorktop);
        const [qx,qy]=at(e*(half-.04),.012);coveTube(qx,qy,z,px_+fx*.02,py_+fy*.02,z,.008,GRAY);}
    }
  }),radius:half+.1,coneRack:{x,y,fx,fy,holders,half,v:R.v,ring:R.ring}};
}

// The burger joint's pass: a hatch through to the kitchen (the opening stays
// in the wall painter: a dim kitchen with the griddle glowing low), framed in
// steel, with a steel pass shelf, a heat-lamp hood over it and a ticket rail.
const BURGER_PASS={bottom:1.12,top:1.66,shelf:.24,frame:.03,hood:.2};
function burgerPassOpening(u,z,u0,half) { // inside the hatch, for the wall painter
  const P=BURGER_PASS;return Math.abs(u-u0)<half-P.frame&&z>P.bottom&&z<P.top-P.frame;
}
function BURGER_KITCHEN_PASS(x,y,half,fx,fy) {
  const P=BURGER_PASS,c=-fy,s=fx,steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  const tickets=[-.55,-.2,.3,.62].map((u,k)=>({u,h:.09+(k%2)*.02}));
  const lamp=(i,t,L)=>{ // a red bulb glowing under the hood
    BG[i]=C(HIT.nz< -.3?ORANGE:RED,HIT.nz< -.3?12:6+L*.2);set(i,' ',0);return true;
  };
  const paper=(i,t,L)=>{
    const line=coveGroove(HIT.w,.012,.002,t/projX)*coveDetail(t,.2);
    BG[i]=C(WHITE,6.5+L*.15-line*2);set(i,' ',0);return true;
  };
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    // tickets clipped to the rail, then the rail
    const railZ=P.top+.18; // above the hood
    for(const q of tickets){const [tx,ty]=at(q.u,.03);drawBox(boxAt(tx,ty,c,s,.035,.001,railZ-q.h,railZ-.005),paper);}
    const [r0x,r0y]=at(-half+.05,.03),[r1x,r1y]=at(half-.05,.03);coveTube(r0x,r0y,railZ,r1x,r1y,railZ,.008,GRAY);
    // the heat-lamp hood: a steel box over the shelf, two lamps under it
    const hood0=P.frame/2+.001,hood1=P.shelf+.02,[hx,hy]=at(0,(hood0+hood1)/2); // in front of the frame
    for(const e of [-.45,.45]){const [lx,ly]=at(e,P.shelf/2+.02);coveLathe(lx,ly,P.top-.13,[[0,0],[0,.028],[.03,.035],[.045,.03],[.05,0]],lamp);
      coveTube(lx,ly,P.top-.08,lx,ly,P.top-.02,.006,GRAY);}
    drawBox({...boxAt(hx,hy,c,s,half-.12,(hood1-hood0)/2,P.top-.02,P.top+.02),...kitchenTopProfile(half-.12,(hood1-hood0)/2,P.top-.02,P.top+.02,.008)},steel,homeRayWorktop);
    // the pass shelf, on two brackets
    const [sx,sy]=at(0,P.shelf/2);
    drawBox({...boxAt(sx,sy,c,s,half,P.shelf/2,P.bottom-.025,P.bottom),...kitchenTopProfile(half,P.shelf/2,P.bottom-.025,P.bottom,.006)},steel,homeRayWorktop);
    for(const e of [-1,1]){const [bx,by]=at(e*(half-.12),.006),[ex,ey]=at(e*(half-.12),P.shelf-.03);coveTube(bx,by,P.bottom-.16,ex,ey,P.bottom-.027,.006,GRAY);}
    // the steel frame round the hatch, its four sides meeting at the corners
    for(const e of [-1,1]){const [fx_,fy_]=at(e*(half-P.frame/2),.008);drawBox({...boxAt(fx_,fy_,c,s,P.frame/2,.008,P.bottom,P.top),...kitchenPanelProfile(P.frame/2,.008,P.bottom,P.top,.003)},steel,homeRayWorktop);}
    const [tx,ty]=at(0,.008);drawBox({...boxAt(tx,ty,c,s,half-P.frame,.008,P.top-P.frame,P.top),...kitchenPanelProfile(half-P.frame,.008,P.top-P.frame,P.top,.003)},steel,homeRayWorktop);
  }),box:boxAt(x+fx*P.shelf/2,y+fy*P.shelf/2,c,s,half,P.shelf/2,P.bottom-.025,P.top+.18),walk:true,radius:half+.1,
    burgerPass:{x,y,half,fx,fy,shelf:P.shelf,bottom:P.bottom,top:P.top,tickets}};
}
