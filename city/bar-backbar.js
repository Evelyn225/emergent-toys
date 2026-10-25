// The bar's back bar is a built fitting rather than bottles painted on the
// wall: a timber base cabinet with doors and a stone top, a mirrored upper
// back between timber stiles, two shelf boards and a top canopy with a
// lamp strip under its front edge. Bottles are turned glass, each standing
// on the board below it; the worktop carries upturned glasses on a mat.
// Local u runs along the wall, v out into the room from the wall face.
const BACK_BAR={depth:.18,pullOut:.028,pullRadius:.008,plinth:.1,top:.9,slab:.04,shelfDepth:.17,boards:[1.24,1.6],board:.03,canopy:[1.99,2.05],stile:.02,glow:.008,lamp:.022};
// (z, radius) from the base; every bottle closes at its cap. Few cone
// segments: a wall of bottles is the scene's dominant cost.
const BACK_BAR_BOTTLES={
  whisky:[[0,0],[0,.04],[.15,.04],[.185,.014],[.262,.014],[.262,0]],
  wine:[[0,0],[0,.035],[.18,.035],[.225,.013],[.3,.013],[.3,0]],
  gin:[[0,0],[0,.039],[.17,.039],[.19,.016],[.25,.016],[.25,0]],
  liqueur:[[0,0],[0,.032],[.05,.05],[.12,.04],[.16,.015],[.225,.015],[.225,0]],
};
const BACK_BAR_KINDS=Object.keys(BACK_BAR_BOTTLES);
const BACK_BAR_GLASS={whisky:[BRICK,ORANGE],wine:[GREEN,BRICK],gin:[WHITE,CYAN],liqueur:[BLUE,MAG,RED]};
const BACK_BAR_LABEL=[WHITE,YEL,STONE,RED,WHITE];
const BACK_BAR_TUMBLER=[[0,0],[0,.034],[.004,.037],[.085,.04],[.085,.036],[.010,.033],[.006,0]].map(([z,r])=>[.085-z,r]).reverse();
const backBarCap=kind=>BACK_BAR_BOTTLES[kind].at(-1)[0];
const backBarRadius=kind=>Math.max(...BACK_BAR_BOTTLES[kind].map(p=>p[1]));
// Most cells a bottle's screen box covers miss it (beside the neck, between
// bottles). Reject them against its bounding cylinder before the full lathe.
function backBarRayBottle(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,a=rx*rx+ry*ry,q=x*rx+y*ry,cc=x*x+y*y-(b.hl+1e-8)**2,disc=q*q-a*cc,error=8*Number.EPSILON*(q*q+Math.abs(a*cc));
  if(disc < -error||a<1e-12)return a<1e-12&&cc<=0?coveRayLathe(ox,oy,oz,rx,ry,rz,b):-1;
  const root=Math.sqrt(Math.max(0,disc)),t0=(-q-root)/a,t1=(-q+root)/a;
  if(t1<.01)return -1;
  const z0=oz+rz*t0,z1=oz+rz*t1;
  if(Math.max(z0,z1)<b.z0-1e-8||Math.min(z0,z1)>b.z1+1e-8)return -1;
  return coveRayLathe(ox,oy,oz,rx,ry,rz,b);
}
function backBarBottle(x,y,shape,shade) {
  drawBox({...shape,x,y},shade,backBarRayBottle);
}

function backBarBottleShade(kind,glass,label,base) {
  const top=backBarCap(kind),labelZ=kind==='wine'?[.06,.13]:kind==='liqueur'?[.04,.09]:[.05,.12];
  return (i,t,L)=>{
    const z=HIT.w-base,light=coveLight(HIT.nx,HIT.ny,HIT.nz),glint=HIT.nz<.4&&light>.85&&coveDetail(t)>.5;
    if(z>top-.03){BG[i]=C(kind==='wine'?BRICK:GRAY,3+L*.3*light);set(i,' ',0);return true;} // cap or foil
    BG[i]=z>labelZ[0]&&z<labelZ[1]&&HIT.nz<.9?C(label,4+L*.35*light):C(glass,2.4+L*.32*light+(glint?2.4:0));
    set(i,' ',0);return true;
  };
}
// Bottles stand in groups inside each bay, clear of the stiles and the
// board's front edge. The worktop row keeps the middle of every bay for
// the mat of glasses.
function backBarStock(half,bays,x,y) {
  const pitch=half*2/bays,out=[],{stile,shelfDepth,boards,board,top}=BACK_BAR;
  const rows=[{z:top,worktop:true},...boards.map(b=>({z:b+board}))];
  for(const [row,{z,worktop}]of rows.entries())for(let k=0;k<bays;k++) {
    const u0=-half+pitch*k+stile+.012,u1=-half+pitch*(k+1)-stile-.012,mat=pitch*.5-.2;
    const kinds=[];let u=u0;
    for(let n=0;n<9;n++) {
      const kind=BACK_BAR_KINDS[Math.floor(hash(k*16+n,row+x*5,y*7+907)*BACK_BAR_KINDS.length)],r=backBarRadius(kind);
      if(u+2*r>u1)break;
      if(!worktop||u+2*r<u0+mat||u>u1-mat)kinds.push({kind,u:u+r,r});
      u+=2*r+.012+(hash(k*16+n,row,913)<.18?.05:0);
    }
    const shift=worktop?0:Math.max(0,(u1-u)/2); // centre a shelf's group in its bay
    for(const q of kinds) {
      const glass=BACK_BAR_GLASS[q.kind],h=hash(k*16+row,q.u*100|0,919);
      out.push({...q,u:q.u+shift,v:worktop?.08:shelfDepth*.5,z,bay:k,row,
        glass:glass[Math.floor(h*glass.length)],label:BACK_BAR_LABEL[Math.floor(h*37)%BACK_BAR_LABEL.length]});
    }
  }
  return out;
}
// (x, y): the middle of the wall face it backs onto; (fx, fy) points into the room.
function BAR_MIRRORED_BACK_BAR(x,y,half,fx=0,fy=1,neon=MAG) {
  const c=-fy,s=fx,{depth,plinth,top,slab,shelfDepth,boards,board,canopy,stile,glow}=BACK_BAR;
  const bays=Math.max(2,Math.round(half*2/.95)),pitch=half*2/bays,front=depth+BACK_BAR.pullOut+BACK_BAR.pullRadius,cx=x+fx*front/2,cy=y+fy*front/2;
  const stock=backBarStock(half,bays,x,y),glasses=[];
  for(let k=0;k<bays;k++)for(let n=0;n<3;n++)glasses.push({u:-half+pitch*(k+.5)+(n-1)*.09,v:.12});
  const timber=seed=>(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed);
  const boxTimber=seed=>(i,t,L)=>{ // rayBox gives a face, not a normal
    const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;
    return coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,c*nu-s*nv,s*nu+c*nv,f===5?1:f===6?-1:0,seed);
  };
  const stone=(i,t,L)=>{BG[i]=C(STONE,3.4+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const mirror=(i,t,L)=>{ // smoked glass: dark, a soft vertical sheen, brighter under the lamp strip
    const sheen=.5+.5*Math.sin(HIT.u*3.1+1),lamp=Math.max(0,1-(canopy[0]-HIT.w)/.35);
    BG[i]=C(GRAY,.8+L*.06*sheen+lamp*1.6);set(i,' ',0);return true;
  };
  const lamp=(i,t,L)=>{ // a diffuser lit along its underside and front, the housing's ends dark
    if(HIT.nz>.5||HIT.face===1||HIT.face===2){BG[i]=C(GRAY,1.5+L*.1);set(i,' ',0);return true;}
    // Narrower than a cell far off: dim with its coverage rather than pop.
    BG[i]=C(neon,3+9*Math.min(1,BACK_BAR.lamp/(t/projX)));set(i,' ',0);return true;
  };
  const mat=(i,t,L)=>{BG[i]=C(GRAY,.6+L*.05-coveGroove(HIT.u,.02,.006,t/projX)*.4);set(i,' ',0);return true;};
  const tumbler=(i,t,L)=>{
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz),glint=HIT.nz<.3&&light>.9;
    BG[i]=C(CYAN,1.4+L*.18*light+(glint?2.2:0));set(i,' ',0);return true;
  };
  const shades=stock.map(q=>backBarBottleShade(q.kind,q.glass,q.label,q.z));
  const timbers=Array.from({length:bays+16},(_,k)=>timber(k)),carcassTimber=boxTimber(1);
  const doorPanel=kitchenPanelProfile(pitch/2-.012,.006,plinth+.02,top-slab-.02,.004),matPanel=kitchenPanelProfile(.16,.05,top,top+.006,.002);
  const shelfPanels=boards.map(b=>kitchenPanelProfile(pitch/2-stile,shelfDepth/2,b,b+board,.003));
  const stilePanels=[stile/2,stile].map(hl=>kitchenPanelProfile(hl,shelfDepth/2,top,canopy[0],.003));
  const worktopPanel=kitchenTopProfile(half+.01,depth/2+.01,top-slab,top,.01),canopyPanel=kitchenTopProfile(half+.01,depth/2,canopy[0],canopy[1],.01);
  const lampPanel=kitchenPanelProfile(half,glow,canopy[0]-BACK_BAR.lamp,canopy[0],.002),profiles=new Map();
  const shape=(profile,z)=>{const points=profile.map(([h,r])=>[z+h,r]),r=Math.max(...profile.map(p=>p[1]));return {...boxAt(0,0,1,0,r,r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points};};
  const bottleShapes=stock.map(q=>{const key=q.kind+':'+q.z;if(!profiles.has(key))profiles.set(key,shape(BACK_BAR_BOTTLES[q.kind],q.z));return profiles.get(key);});
  const glassShape=shape(BACK_BAR_TUMBLER,top+.006);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    // Nearest first, so the depth buffer turns away what sits behind.
    for(const q of glasses){const [gx,gy]=at(q.u,q.v);backBarBottle(gx,gy,glassShape,tumbler);}
    for(let k=0;k<bays;k++){const [mx,my]=at(-half+pitch*(k+.5),.12);drawBox({...boxAt(mx,my,c,s,.16,.05,top,top+.006),...matPanel},mat,homeRayWorktop);}
    stock.forEach((q,n)=>{const [bx,by]=at(q.u,q.v);backBarBottle(bx,by,bottleShapes[n],shades[n]);});
    // Door pulls, doors, and the cabinet behind them.
    for(let k=0;k<bays;k++) {
      const mid=-half+pitch*(k+.5),pull=top-.13;
      const [ax,ay]=at(mid-.06,depth+BACK_BAR.pullOut),[bx,by]=at(mid+.06,depth+BACK_BAR.pullOut);
      coveTube(ax,ay,pull,bx,by,pull,BACK_BAR.pullRadius,GRAY); // the pull bar, on two posts back to the door face
      for(const e of [-.06,.06]){const [qx,qy]=at(mid+e,depth+.012),[rx,ry]=at(mid+e,depth+BACK_BAR.pullOut);coveTube(qx,qy,pull,rx,ry,pull,.006,GRAY);}
      const [dx_,dy_]=at(-half+pitch*(k+.5),depth+.006);
      drawBox({...boxAt(dx_,dy_,c,s,pitch/2-.012,.006,plinth+.02,top-slab-.02),...doorPanel},timbers[k+2],homeRayWorktop);
    }
    const [tx,ty]=at(0,depth/2+.01);
    drawBox({...boxAt(tx,ty,c,s,half+.01,depth/2+.01,top-slab,top),...worktopPanel},stone,homeRayWorktop);
    // The carcass and recessed plinth are plain boxes, mostly behind the
    // doors: the renderer clips those column by column.
    const [kx,ky]=at(0,depth/2);
    drawBox(boxAt(kx,ky,c,s,half,depth/2,plinth,top-slab),carcassTimber);
    const [px0,py0]=at(0,(depth-.04)/2);
    drawBox(boxAt(px0,py0,c,s,half-.02,(depth-.04)/2,0,plinth),(i,t,L)=>{BG[i]=C(BRICK,1.2+L*.08);set(i,' ',0);return true;});
    // Upper fitting: full-height stiles from worktop to canopy, a board
    // between each pair at the same heights, all on the same front plane.
    for(let k=0;k<bays;k++)for(const b of boards) {
      const [sx,sy]=at(-half+pitch*(k+.5),shelfDepth/2),hl=pitch/2-stile;
      drawBox({...boxAt(sx,sy,c,s,hl,shelfDepth/2,b,b+board),...shelfPanels[boards.indexOf(b)]},timbers[5+k],homeRayWorktop);
    }
    for(let k=0;k<=bays;k++) {
      const [sx,sy]=at(-half+pitch*k,shelfDepth/2),hl=k===0||k===bays?stile/2:stile,du=k===0?stile/2:k===bays?-stile/2:0,[ex,ey]=[sx+c*du,sy+s*du];
      drawBox({...boxAt(ex,ey,c,s,hl,shelfDepth/2,top,canopy[0]),...stilePanels[k===0||k===bays?0:1]},timbers[k+9],homeRayWorktop);
    }
    const [lx,ly]=at(0,shelfDepth+glow+.003);
    drawBox({...boxAt(lx,ly,c,s,half,glow,canopy[0]-BACK_BAR.lamp,canopy[0]),...lampPanel},lamp,homeRayWorktop);
    const [ox,oy]=at(0,depth/2);
    drawBox({...boxAt(ox,oy,c,s,half+.01,depth/2,canopy[0],canopy[1]),...canopyPanel},timbers[6],homeRayWorktop);
    const [mx,my]=at(0,.006);
    drawBox(boxAt(mx,my,c,s,half,.006,top,canopy[0]),mirror);
  }),box:boxAt(cx,cy,c,s,half+.01,front/2,0,canopy[1]),radius:Math.hypot(half,depth)+.05,
    backBar:{x,y,half,fx,fy,bays,pitch,stock:stock.map(({kind,u,v,z,r,bay,row})=>({kind,u,v,z,r,bay,row})),glasses}};
}
