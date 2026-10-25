// Shop shelf islands are built gondolas. A room's 'S' cells used to be wall
// blocks with goods painted on their faces; at room build each rectangle of
// them becomes floor with a gondola standing on it: a plinth, a pegboard
// spine, shelves on both long faces, end caps, and stock as solid facings
// sized and coloured for the shop. The collision footprint is the old block's.
const GONDOLA={height:1.75,plinth:.12,levels:[.15,.55,.95,1.35],board:.025,spine:.02,upright:.03,inset:.04};
// What a shop stocks, as facings: [width, height fraction of the shelf gap, depth fraction, colours]
const GONDOLA_STOCK={
  grocery:{widths:[.07,.09,.12,.2],cols:[RED,YEL,BLUE,GREEN,ORANGE,WHITE,MAG,CYAN],label:true},
  pharmacy:{widths:[.06,.08,.1],cols:[WHITE,BLUE,CYAN,GREEN,RED],label:true,short:true},
  books:{widths:[.03,.035,.045,.05],cols:[RED,BLUE,GREEN,BRICK,YEL,WHITE,MAG],spines:true},
  hardware:{widths:[.12,.15,.2],cols:[RED,BLUE,YEL,GRAY,ORANGE],bins:true},
  video:{widths:[.018,.018,.02],cols:[BLUE,RED,BLACK,GREEN,MAG,YEL],spines:true},
  wine:{widths:[.085],cols:[GREEN,BRICK,BLACK],bottles:true},
  toys:{widths:[.12,.18,.25,.3],cols:[RED,YEL,BLUE,GREEN,MAG,ORANGE,CYAN],label:true},
};
const GONDOLA_FOR={store:'grocery',bodega:'grocery',gas:'grocery',grocer:'grocery',drugstore:'pharmacy',pharmacy:'pharmacy',books:'books',hardware:'hardware',video:'video',liquor:'wine',toys:'toys'};
// Rectangles of 'S' cells, each grown right then down from its first cell.
function gondolaBlocks(grid) {
  const used=new Set(),out=[];
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
    if(grid[y][x]!=='S'||used.has(x+','+y))continue;
    let x1=x;while(grid[y][x1+1]==='S'&&!used.has((x1+1)+','+y))x1++;
    let y1=y;for(;;){const n=y1+1;if(!grid[n])break;let ok=true;for(let k=x;k<=x1;k++)if(grid[n][k]!=='S'||used.has(k+','+n))ok=false;if(!ok)break;y1=n;}
    for(let j=y;j<=y1;j++)for(let k=x;k<=x1;k++)used.add(k+','+j);
    out.push({x0:x,y0:y,x1:x1+1,y1:y1+1});
  }
  return out;
}
// The facings on one shelf face of a gondola: (u along the gondola, side ±1).
function gondolaFacings(len,depth,kind,seed) {
  const S=GONDOLA_STOCK[kind],G=GONDOLA,out=[];
  for(const [n,z]of G.levels.entries()){
    const top=(G.levels[n+1]??G.height-.05)-.03,gap=top-z-G.board;
    for(const side of [-1,1]){
      let u=-len/2+G.upright+.01,k=0;
      while(u<len/2-G.upright-.02){
        const h=hash(k,n*2+(side>0),seed),spine=S.widths[Math.floor(h*S.widths.length)];
        // Spines stand pressed together: a run of them, one height, is one solid
        // (thousands of separate 2 cm boxes cost tens of milliseconds).
        const w=S.spines?spine*(4+Math.floor(hash(k,n,seed+11)*6)):spine;
        if(u+w>len/2-G.upright-.01)break;
        if(hash(k,n,seed+7)>.06){ // (the odd gap where something's sold out)
          const hf=S.short?.45+h*.3:S.spines?.7+h*.25:.55+h*.4;
          out.push({u:u+w/2,side,z:z+G.board,w,h:Math.min(gap,gap*hf),d:S.bins?Math.min(.32,depth*.85):depth*(S.spines?.75:.85),col:S.cols[Math.floor(hash(k,n,seed+3)*S.cols.length)],k,spine});
        }
        u+=w+(S.spines?.002:.008);k++;
      }
    }
  }
  return out;
}
// The existing tray ray works in its own axes. Translate and rotate it here
// so an aisle along y has the same closed rim, cavity and floor as one along x.
function gondolaBinRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,c=b.c,s=b.s;
  const t=foodRayTray(x*c+y*s,-x*s+y*c,oz,rx*c+ry*s,-rx*s+ry*c,rz,b.gondolaBin);
  if(t>0){const nx=HIT.nx,ny=HIT.ny;HIT.nx=c*nx-s*ny;HIT.ny=s*nx+c*ny;}
  return t;
}
function gondolaWasherShade(i,t,L) {
  const seam=coveGroove(HIT.w,.004,.001,t/projX)*coveDetail(t,.08);
  BG[i]=C(GRAY,3.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-seam*1.2);set(i,' ',0);return true;
}
function SHOP_GONDOLA(b,kind,seed) {
  const G=GONDOLA,S=GONDOLA_STOCK[kind],alongX=b.x1-b.x0>=b.y1-b.y0;
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,len=(alongX?b.x1-b.x0:b.y1-b.y0)-.02,half=(alongX?b.y1-b.y0:b.x1-b.x0)/2-.01;
  const c=alongX?1:0,s=alongX?0:1,depth=half-G.spine/2-G.inset;
  const facings=gondolaFacings(len,depth,kind,seed);
  // face normals for plain boxes in the gondola's frame
  const flat=shade=>(i,t,L)=>{const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);};
  const steel=flat((i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  const plinth=flat((i,t,L)=>{BG[i]=C(GRAY,.9+L*.06);set(i,' ',0);return true;});
  const peg=flat((i,t,L)=>{const f=t/projX,hole=Math.min(1,coveGroove(HIT.u,.025,.006,f)*coveGroove(HIT.w,.025,.006,f)*4)*coveDetail(t,.3);BG[i]=C(WHITE,3.6+L*.12-hole*1.6);set(i,' ',0);return true;});
  const goodsShade=q=>(S.bottles||S.bins?f=>f:flat)((i,t,L)=>{ // (a turned bottle's ray gives its own normals)
    const front=HIT.face===3||HIT.face===4,light=coveLight(HIT.nx,HIT.ny,HIT.nz);
    if(S.label&&front&&Math.abs(HIT.w-(q.z+q.h*.55))<q.h*.18){BG[i]=C(WHITE,5+L*.2*light);set(i,' ',0);return true;} // the label band
    if(S.spines&&front){ // each spine its own colour, a dark line where two meet, a title line across
      const j=Math.floor((HIT.u+q.w/2)/q.spine),edge=coveGroove(HIT.u+q.w/2,q.spine,.002,t/projX)*coveDetail(t,.15);
      const col=S.cols[Math.floor(hash(j,q.k,q.z*100|0)*S.cols.length)];
      if(coveDetail(t,.15)>.3&&Math.abs(HIT.w-(q.z+q.h*.8))<.006){BG[i]=C(YEL,5);set(i,' ',0);return true;}
      BG[i]=C(col,(col===WHITE?4.2:2.4)+L*.3*light-edge*1.6);set(i,' ',0);return true;
    }
    if(S.bins&&HIT.face===5){BG[i]=C(GRAY,1.2);set(i,' ',0);return true;} // an open bin of parts
    BG[i]=C(q.col,(q.col===WHITE?4.4:2.6)+L*.3*light);set(i,' ',0);return true;
  });
  const shades=facings.map(goodsShade);
  const bottle=[[0,0],[0,.032],[.005,.035],[.2,.035],[.25,.014],[.3,.012],[.31,0]];
  const contents=[];
  const boxes=facings.map((q,n)=>{
    // wine: the front bottle of each row; everything else a solid facing
    const v=S.bottles?q.side*(G.spine/2+G.inset+depth*.7):S.bins?q.side*(half-G.inset-q.d/2):q.side*(G.spine/2+G.inset+depth/2+.005),ox=c*q.u-s*v,oy=s*q.u+c*v;
    if(S.bins){
      const floor=q.z+.008;
      for(const [u,v,h]of [[-.021,-.05,.036],[.021,.05,.048],[0,0,.024]]){
        const part=homeLampPart('washers',floor,[[0,.006],[0,.014],[h,.014],[h,.006],[0,.006]]);
        contents.push({ox:ox+c*u-s*v,oy:oy+s*u+c*v,box:{...part.box,gondolaContents:true},shade:gondolaWasherShade,ray:coveRayLathe});
      }
      return {ox,oy,shade:shades[n],ray:gondolaBinRay,box:{...boxAt(0,0,c,s,q.w/2,q.d/2,q.z,q.z+q.h),
        gondolaBin:{...boxAt(0,0,1,0,q.w/2,q.d/2,q.z,q.z+q.h),...kitchenTopProfile(q.w/2,q.d/2,q.z,q.z+q.h,.002)}}};
    }
    return S.bottles?{ox,oy,shade:shades[n],ray:coveRayLathe,box:{...boxAt(0,0,1,0,.035,.035,q.z,q.z+.31),profile:bottle.map(([h,r])=>[h+q.z,r])}}
      :{ox,oy,shade:shades[n],ray:rayBox,box:boxAt(0,0,c,s,q.w/2,q.d/2,q.z,q.z+q.h)};
  });
  const order=boxes.map((_,n)=>n);let orderDx=NaN,orderDy=NaN;
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    // Facings are pre-built (a gondola holds hundreds); each frame only moves them.
    // Nearest first, so the depth buffer turns away the facings behind them
    // (looking down an aisle hundreds of them overlap on screen).
    // Translation adds the same depth to every facing, so only a turn can
    // change this order. Keep exact directions, including reversed views.
    if(dx!==orderDx||dy!==orderDy){
      for(const q of boxes)q.near=dx*q.ox+dy*q.oy;
      order.sort((a,b)=>boxes[a].near-boxes[b].near);orderDx=dx;orderDy=dy;
    }
    for(const q of contents){q.box.x=vx+q.ox;q.box.y=vy+q.oy;drawBox(q.box,q.shade,q.ray);}
    for(const n of order){const q=boxes[n];q.box.x=vx+q.ox;q.box.y=vy+q.oy;drawBox(q.box,q.shade,q.ray);}
    for(const z of G.levels){const [sx,sy]=at(0,0);drawBox(boxAt(sx,sy,c,s,len/2-G.upright,half,z,z+G.board),steel);}
    for(const e of [-1,1]){const [ux,uy]=at(e*(len/2-G.upright/2),0);drawBox(boxAt(ux,uy,c,s,G.upright/2,half,0,G.height),steel);} // end uprights
    const [px,py_]=at(0,0);
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,G.spine/2,G.levels[0],G.height),peg);
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,half,G.height-.03,G.height),steel); // the top cap
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,half-.03,0,G.plinth),plinth);
  }),box:boxAt(cx,cy,1,0,(b.x1-b.x0)/2,(b.y1-b.y0)/2,0,G.height),radius:Math.hypot(len,half*2)/2+.1,
    gondola:{block:b,kind,len,half,depth,alongX,facings:facings.length}};
}
// At room build: the 'S' cells become floor with a gondola on each block.
function shopGondolas(r) {
  if(!r.grid.some(row=>row.includes('S')))return [];
  const kind=GONDOLA_STOCK[GONDOLA_FOR[r.kind]]?GONDOLA_FOR[r.kind]:'grocery',blocks=gondolaBlocks(r.grid);
  r.grid=r.grid.map(row=>row.replace(/S/g,'.'));
  return blocks.map((b,k)=>SHOP_GONDOLA(b,kind,k*13+b.x0*7+b.y0));
}
