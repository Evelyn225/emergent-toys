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
  oil:{widths:[.07,.07,.09,.13],cols:[YEL,GRAY,RED,BLUE,BLUE],label:true}, // quarts of motor oil, jugs of screenwash
  cds:{widths:[.01,.01,.014],cols:[RED,ORANGE,YEL,GREEN,CYAN,BLUE,MAG,WHITE,BRICK],spines:true}, // CDs and tapes, spines out
  florist:{widths:[.12,.14,.16],cols:[RED,MAG,YEL,WHITE,ORANGE],pots:true}, // potted plants in bloom
  thrift:{widths:[.08,.11,.14,.18],cols:[BRICK,GREEN,BLUE,YEL,GRAY,WHITE,MAG],mixed:true}, // bric-a-brac: boxes, jugs and vases
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
function gondolaFacings(len,depth,kind,seed,sides=[-1,1],levels=GONDOLA.levels,height=GONDOLA.height) {
  const S=GONDOLA_STOCK[kind],G=GONDOLA,out=[];
  for(const [n,z]of levels.entries()){
    const top=(levels[n+1]??height-.05)-.03,gap=top-z-G.board;
    for(const side of sides){
      let u=-len/2+G.upright+.01,k=0;
      while(u<len/2-G.upright-.02){
        const h=hash(k,n*2+(side>0),seed),spine=S.widths[Math.floor(h*S.widths.length)];
        // Spines stand pressed together: a run of them, one height, is one solid
        // (thousands of separate 2 cm boxes cost tens of milliseconds).
        const w=S.spines?spine*(4+Math.floor(hash(k,n,seed+11)*6)):spine;
        if(u+w>len/2-G.upright-.01)break;
        if(hash(k,n,seed+7)>.06){ // (the odd gap where something's sold out)
          const hf=S.short?.45+h*.3:S.spines?.7+h*.25:.55+h*.4;
          out.push({u:u+w/2,side,z:z+G.board,w,h:Math.min(gap,gap*hf),d:depth*(S.spines?.75:.85),col:S.cols[Math.floor(hash(k,n,seed+3)*S.cols.length)],k,spine});
        }
        u+=w+(S.spines?.002:.008);k++;
      }
    }
  }
  return out;
}
// Plain boxes in a frame turned by (c,s): face normals from the box face.
const gondolaFlat=(c,s,shade)=>(i,t,L)=>{const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);};
// Pot and jug profiles for a facing: [z above the shelf, radius]
function gondolaTurned(q,form) {
  const r=Math.min(q.w,q.d)/2-.008,h=q.h;
  if(form==='pot'){const ph=Math.min(.12,h*.45);return [[0,0],[0,r*.72],[ph,r],[ph,r*.92],[ph+(h-ph)*.45,r*1.0],[h*.92,r*.6],[h,0]];}
  return [[0,0],[0,r*.6],[h*.08,r*.65],[h*.45,r],[h*.75,r*.45],[h*.9,r*.32],[h*.94,r*.42],[h*.96,r*.38],[h*.96,0]]; // a jug: belly, neck, lip
}
// The stock on a run of facings, pre-built (a gondola holds hundreds); draw()
// moves them to the model's origin and draws them nearest first, so the depth
// buffer turns away those behind (looking down an aisle hundreds overlap).
// vOf(q): a facing's centre across the run in the model frame.
function gondolaGoods(facings,kind,c,s,vOf) {
  const S=GONDOLA_STOCK[kind],flat=shade=>gondolaFlat(c,s,shade);
  const bottle=[[0,0],[0,.032],[.005,.035],[.2,.035],[.25,.014],[.3,.012],[.31,0]];
  const form=q=>S.bottles?'bottle':S.pots?'pot':S.mixed&&hash(q.k,q.z*100|0,q.u*100|0)<.4?'jug':'box';
  const shadeFor=q=>{
    const f=form(q);
    if(f==='pot')return (i,t,L)=>{ // terracotta below, leaves above with blooms in them
      const light=coveLight(HIT.nx,HIT.ny,HIT.nz),pot=HIT.w<q.z+Math.min(.12,q.h*.45)+1e-4;
      if(pot){BG[i]=C(BRICK,2.2+L*.3*light);set(i,' ',0);return true;}
      const an=Math.atan2(HIT.v,HIT.u),bloom=hash(Math.floor(an*3),Math.floor(HIT.w*28),q.k)>.72;
      BG[i]=C(bloom?q.col:GREEN,(bloom?3.2:1.6)+L*.3*light);set(i,' ',0);return true;};
    if(f!=='box')return (i,t,L)=>{BG[i]=C(q.col,(q.col===WHITE?4.2:2.6)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}; // (a turned ray gives its own normals)
    return flat((i,t,L)=>{
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
  };
  const boxes=facings.map(q=>{
    const f=form(q),v=vOf(q),ox=c*q.u-s*v,oy=s*q.u+c*v,shade=shadeFor(q);
    if(f==='box')return {ox,oy,shade,ray:rayBox,box:boxAt(0,0,c,s,q.w/2,q.d/2,q.z,q.z+q.h)};
    const prof=f==='bottle'?bottle:gondolaTurned(q,f),r=Math.max(...prof.map(p=>p[1]));
    return {ox,oy,shade,ray:coveRayLathe,form:f,box:{...boxAt(0,0,1,0,r,r,q.z,q.z+prof[prof.length-1][0]),profile:prof.map(([h,rr])=>[h+q.z,rr])}};
  });
  const order=boxes.map((_,n)=>n);
  return {boxes,draw(vx,vy){
    for(const q of boxes){q.box.x=vx+q.ox;q.box.y=vy+q.oy;q.near=dx*q.box.x+dy*q.box.y;}
    order.sort((a,b)=>boxes[a].near-boxes[b].near);
    for(const n of order){const q=boxes[n];drawBox(q.box,q.shade,q.ray);}
  }};
}
function SHOP_GONDOLA(b,kind,seed) {
  const G=GONDOLA,S=GONDOLA_STOCK[kind],alongX=b.x1-b.x0>=b.y1-b.y0;
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,len=(alongX?b.x1-b.x0:b.y1-b.y0)-.02,half=(alongX?b.y1-b.y0:b.x1-b.x0)/2-.01;
  const c=alongX?1:0,s=alongX?0:1,depth=half-G.spine/2-G.inset;
  const facings=gondolaFacings(len,depth,kind,seed);
  const flat=shade=>gondolaFlat(c,s,shade);
  const steel=flat((i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  const plinth=flat((i,t,L)=>{BG[i]=C(GRAY,.9+L*.06);set(i,' ',0);return true;});
  const peg=flat((i,t,L)=>{const f=t/projX,hole=Math.min(1,coveGroove(HIT.u,.025,.006,f)*coveGroove(HIT.w,.025,.006,f)*4)*coveDetail(t,.3);BG[i]=C(WHITE,3.6+L*.12-hole*1.6);set(i,' ',0);return true;});
  // wine: the front bottle of each row; everything else a solid facing
  const goods=gondolaGoods(facings,kind,c,s,q=>S.bottles?q.side*(G.spine/2+G.inset+depth*.7):q.side*(G.spine/2+G.inset+depth/2+.005));
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    goods.draw(vx,vy);
    for(const z of G.levels){const [sx,sy]=at(0,0);drawBox(boxAt(sx,sy,c,s,len/2-G.upright,half,z,z+G.board),steel);}
    for(const e of [-1,1]){const [ux,uy]=at(e*(len/2-G.upright/2),0);drawBox(boxAt(ux,uy,c,s,G.upright/2,half,0,G.height),steel);} // end uprights
    const [px,py_]=at(0,0);
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,G.spine/2,G.levels[0],G.height),peg);
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,half,G.height-.03,G.height),steel); // the top cap
    drawBox(boxAt(px,py_,c,s,len/2-G.upright,half-.03,0,G.plinth),plinth);
  }),box:boxAt(cx,cy,1,0,(b.x1-b.x0)/2,(b.y1-b.y0)/2,0,G.height),radius:Math.hypot(len,half*2)/2+.1,
    gondola:{block:b,kind,len,half,depth,alongX,facings:facings.length}};
}
// Wall shelving against a wall face, shelves fitted bay by bay between
// full-depth uprights, a back panel and a top cap: the same stock as the
// islands, one face. Shallow enough to keep a clerk's aisle open.
// opts.wall: 'back' (the face at y=1), 'left' (x=1), 'right' (x=W-1, needs
// opts.W) or 'front' (y=H-1, needs opts.H); a0..a1 run along that wall. opts.levels/height: a taller case.
const WALL_SHELF={depth:.2,back:.012,gap:.02,bay:1};
function SHOP_WALL_SHELVES(a0,a1,kind,seed,opts={}) {
  const G=GONDOLA,W=WALL_SHELF,wall=opts.wall||'back',levels=opts.levels||G.levels,height=opts.height||G.height;
  const len=a1-a0,n=Math.max(1,Math.round(len/W.bay)),half=W.depth/2,mid=(a0+a1)/2;
  // the model frame: u along the wall, v out from it into the room
  const [c,s,cx,cy]=wall==='left'?[0,-1,1+half,mid]:wall==='right'?[0,1,opts.W-1-half,mid]:wall==='front'?[-1,0,mid,opts.H-1-half]:[1,0,mid,1+half];
  const v0=-half+W.back,depth=W.depth-W.back-W.gap,facings=[];
  // upright centres, the end ones flush with the unit's ends; a bay is the clear span between two
  const posts=Array.from({length:n+1},(_,b)=>-len/2+G.upright/2+b*(len-G.upright)/n),bay=(len-G.upright)/n-G.upright;
  for(let b=0;b<n;b++)for(const q of gondolaFacings(bay+2*G.upright,depth,kind,seed*7+b,[1],levels,height))facings.push({...q,u:q.u+(posts[b]+posts[b+1])/2,k:q.k+b*100});
  const flat=shade=>gondolaFlat(c,s,shade);
  const frame=opts.timber?flat((i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed)):flat((i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  const back=opts.timber?frame:flat((i,t,L)=>{BG[i]=C(WHITE,3.2+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  const plinth=flat((i,t,L)=>{BG[i]=C(opts.timber?BRICK:GRAY,.8+L*.06);set(i,' ',0);return true;});
  const goods=gondolaGoods(facings,kind,c,s,q=>v0+W.gap+depth/2);
  const inner=half-W.back/2,front=W.back/2; // everything in front of the back panel
  const part=(vx,vy,u,v,hl,hw,z0,z1,shade)=>drawBox(boxAt(vx+c*u-s*v,vy+s*u+c*v,c,s,hl,hw,z0,z1),shade);
  const side=wall==='back'||wall==='front'?[len/2,half]:[half,len/2]; // the collision box, square to the room
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{
    goods.draw(vx,vy);
    for(let b=0;b<n;b++){const m=(posts[b]+posts[b+1])/2;
      for(const z of levels)part(vx,vy,m,front,bay/2,inner,z,z+G.board,frame); // shelves, upright face to upright face
      part(vx,vy,m,front-.015,bay/2,inner-.015,0,levels[0],plinth);} // a plinth under each bay, set back
    for(const e of posts)part(vx,vy,e,front,G.upright/2,inner,0,height-.03,frame); // uprights, up to the cap
    part(vx,vy,0,-half+W.back/2,len/2,W.back/2,0,height,back); // the back panel
    part(vx,vy,0,front,len/2,inner,height-.03,height,frame); // the top cap
  }),box:boxAt(cx,cy,1,0,side[0],side[1],0,height),radius:Math.hypot(len,W.depth)/2+.1,
    wallShelves:{a0,a1,wall,kind,bays:n,bay,posts,depth,levels,height,c,s,facings:facings.length}};
}
// At room build: the 'S' cells become floor with a gondola on each block.
function shopGondolas(r) {
  if(!r.grid.some(row=>row.includes('S')))return [];
  const kind=GONDOLA_STOCK[GONDOLA_FOR[r.kind]]?GONDOLA_FOR[r.kind]:'grocery',blocks=gondolaBlocks(r.grid);
  r.grid=r.grid.map(row=>row.replace(/S/g,'.'));
  return blocks.map((b,k)=>SHOP_GONDOLA(b,kind,k*13+b.x0*7+b.y0));
}
// At room build: a shop whose def asks for shelves gets a wall unit along its
// wall (def.shelves: {kind, wall, from, to, timber, levels, height}, a list of
// them, or a function of the room returning either); a run defaults to the
// whole back wall.
function shopWallShelves(r) {
  const spec=typeof r.def.shelves==='function'?r.def.shelves(r):r.def.shelves;
  if(!spec)return [];
  return [].concat(spec).map((q,k)=>{const side=q.wall&&q.wall!=='back',a0=q.from??1,a1=q.to??(side?r.H-1:r.W-1);
    return SHOP_WALL_SHELVES(a0,a1,q.kind,a0*5+r.W+k*17,{...q,W:r.W,H:r.H});});
}
