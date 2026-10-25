// A shallow fitted back bar leaves the original staff aisle intact. All bottle
// feet, glass bases, guard posts and brackets derive from the board tops.
const BAR_BACK={half:3.8,depth:.09,bottom:.085,board:.028,levels:[.862,1.372,1.882],top:2.25};
const BAR_BOTTLES=[
  [[0,0],[0,.035],[.008,.042],[.20,.042],[.245,.016],[.29,.015],[.29,.018],[.316,.018],[.32,.014],[.32,0]],
  [[0,0],[0,.040],[.008,.048],[.15,.048],[.19,.025],[.23,.020],[.23,.024],[.255,.024],[.259,0]],
  [[0,0],[0,.033],[.008,.039],[.19,.039],[.235,.015],[.28,.014],[.28,.017],[.30,.017],[.304,0]],
];
const BAR_TUMBLER=[[0,0],[0,.028],[.005,.033],[.12,.037],[.125,.037],[.125,.033],[.012,.029],[.007,0]];
function barTumblerShade(i,t,L) {
  const inside=HIT.part>=6,rim=HIT.part===5;
  BG[i]=C(CYAN,(inside?.6:rim?4.7:2.5)+L*(inside?.1:.28)*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function barBottleShade(glass,label,base,height,seed) {
  return (i,t,L)=>{
    const z=HIT.w-base,light=coveLight(HIT.nx,HIT.ny,HIT.nz),cap=z>height-.03,band=z>.07&&z<.15;
    const glint=!band&&!cap?Math.max(0,HIT.nx*.6-HIT.ny*.8)**12*.9:0;
    BG[i]=C(cap?YEL:band?label:glass,(cap?3.2:band?4.3:1.8)+L*(band?.3:.24)*light+glint);
    // Quiet printed rules fade before they become disconnected pixels.
    if(band&&coveDetail(t,.08)>.2&&Math.abs(z-.108-seed*.003)<.003)BG[i]=C(glass,2+L*.18);
    set(i,' ',0);return true;
  };
}
function BAR_BACK_BAR(x=6,y=1.09) {
  const q=BAR_BACK,wood=furnitureTimber(BRICK),parts=[],vessels=[],tubes=[],bottles=[];
  const panel=(role,u,v,hl,hw,z0,z1,shade=wood,bevel=.004)=>parts.push({role,u,v,box:boxAt(0,0,1,0,hl,hw,z0,z1),profile:kitchenPanelProfile(hl,hw,z0,z1,Math.min(bevel,hl*.8,hw*.8)),shade});
  const vessel=(role,u,v,z,profile,shade)=>{
    const points=profile.map(([h,r])=>[z+h,r]),r=Math.max(...points.map(p=>p[1]));
    vessels.push({role,u,v,box:{...boxAt(0,0,1,0,r,r,z,Math.max(...points.map(p=>p[0]))),profile:points},shade});
  };
  const tube=(role,u,v,z,uu,vv,zz,r=.005)=>tubes.push({role,ax:u,ay:v,az:z,bx:uu,by:vv,bz:zz,r});
  panel('plinth',0,0,q.half-.045,q.depth-.02,0,q.bottom);
  panel('base',0,0,q.half-.025,q.depth,q.bottom,q.bottom+.035);
  panel('back',0,-q.depth+.01,q.half,.01,q.bottom,q.top);
  for(const side of [-1,1])panel('side',side*(q.half-.015),0,.015,q.depth,q.bottom,q.top);
  // Six cabinet doors fit inside the carcass. Handles sit on two seated pins.
  const width=(q.half-.03)*2/6;
  for(let k=0;k<6;k++){
    const u=-q.half+.03+width*(k+.5),handle=u+(k%2?-1:1)*(width/2-.10);
    panel('door',u,q.depth-.008,width/2-.008,.008,q.bottom+.055,q.levels[0]-.025);
    for(const z of [.38,.50])tube('handle-pin',handle,q.depth,z,handle,q.depth+.01,z,.004);
    tube('handle',handle,q.depth+.01,.38,handle,q.depth+.01,.50,.005);
  }
  for(const [row,z]of q.levels.entries()){
    const top=z+q.board;
    panel('board',0,0,q.half-.03,q.depth,z,top);
    for(const u of [-3.15,-1.05,1.05,3.15]){
      // A horizontal arm meets the underside; its diagonal ends at the same arm.
      tube('bracket-wall',u,-q.depth+.023,z-.14,u,-q.depth+.023,z-.004,.006);
      tube('bracket-arm',u,-q.depth+.023,z-.006,u,q.depth-.025,z-.006,.006);
      tube('bracket-brace',u,-q.depth+.023,z-.12,u,q.depth-.025,z-.006,.004);
    }
    for(const u of [-q.half+.055,-1.25,1.25,q.half-.055])tube('guard-post',u,q.depth-.012,top,u,q.depth-.012,top+.075,.005);
    tube('guard',-q.half+.055,q.depth-.012,top+.075,q.half-.055,q.depth-.012,top+.075,.005);
    for(let bay=0;bay<3;bay++)for(let k=0;k<5;k++){
      const u=(bay-1)*2.5+(k-2)*.15,kind=(row+bay+k)%3,profile=BAR_BOTTLES[kind],height=profile.at(-1)[0];
      const shade=barBottleShade([GREEN,BRICK,CYAN][kind],[STONE,WHITE,WARM][(k+bay)%3],top,height,k);
      vessel('bottle',u,.015,top,profile,shade);bottles.push({u,v:.015,z:top,height,radius:Math.max(...profile.map(p=>p[1])),kind,row});
    }
    // Actual hollow tumblers occupy the gaps between bottles.
    for(const u of [-1.4,-1.05,1.4,1.05])vessel('tumbler',u,.018,top,BAR_TUMBLER,barTumblerShade);
  }
  const metal=(i,t,L)=>{BG[i]=C(YEL,2.4+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    // Nearest parts first: thin guards and handles can reject the wood behind.
    for(const p of tubes){const ax=vx+p.ax,ay=vy+p.ay,bx=vx+p.bx,by=vy+p.by,r=p.r;
      drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(p.az,p.bz)-r,Math.max(p.az,p.bz)+r),ax,ay,az:p.az,bx,by,bz:p.bz,r,barRole:p.role},metal,coveRayCapsule);
    }
    for(const p of vessels)drawBox({...p.box,x:vx+p.u,y:vy+p.v,barRole:p.role},p.shade,coveRayLathe);
    for(let k=parts.length-1;k>=0;k--){const p=parts[k];drawBox({...p.box,x:vx+p.u,y:vy+p.v,...p.profile,barRole:p.role},p.shade,homeRayWorktop);}
  }),box:boxAt(x,y+.008,1,0,q.half,q.depth+.008,0,q.top),radius:Math.hypot(q.half,q.depth+.016),backBar:{levels:q.levels.map(z=>z+q.board),bottles}};
}
