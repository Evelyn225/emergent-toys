// Shop display cases are built: a panelled cabinet, a chrome frame round clear
// glass, and the goods as small solid objects laid out on a velvet bed, rather
// than glyphs painted onto the glass. `caseGoods` names what a case holds;
// each kind has its own few shapes. Local u runs along the case, +v is the
// customers' side (face 3 of the old painted case).
const DISPLAY_CASE={glass:.42,bed:.03,frame:.01};
// What each glyph set used to stand for, as kinds of goods.
const CASE_GOODS_KINDS={
  jewellery:['ring','gem','ring','pendant'],watches:['watch','ring','watch'],skate:['wheel','wheel','truck','bearing'],
  tobacco:['pipe','lighter','tin','pipe'],herbs:['root','bundle','dish'],trinkets:['watch','ring','figure','box','gem'],
  piercing:['stud','ring','barbell','stud'],pastry:['bun','roll','bun'],
};
// Spacing along a row: wider than the widest piece of that kind turned any way.
const CASE_GOODS_PITCH={jewellery:.1,watches:.11,skate:.13,tobacco:.14,herbs:.1,trinkets:.11,piercing:.1,pastry:.1};
// caseGoods(kind, colours, glint, seed): what a case holds and in which colours.
const caseGoods = (kind, cols, glint = false, seed = 0) => ({kind, cols, glint, seed});
function caseGoodsLayout(hl,hw,goods) {
  const shapes=CASE_GOODS_KINDS[goods.kind],pitch=CASE_GOODS_PITCH[goods.kind],out=[];
  const n=Math.max(1,Math.floor((hl*2-.12)/pitch));
  for(const row of [-1,1])for(let k=0;k<n;k++){
    const h=hash(k,row+3,goods.seed*7+1);if(h<.12)continue; // (one sold)
    out.push({u:-hl+.06+pitch*(k+.5)+(hash(k,row,goods.seed)-.5)*.02,v:row*hw*.42,shape:shapes[Math.floor(h*97)%shapes.length],
      col:goods.cols[Math.floor(hash(k,row,goods.seed+5)*goods.cols.length)],turn:hash(k,row,goods.seed+9)*Math.PI});
  }
  return out;
}
function caseGoodsShade(col,glint) {
  return (i,t,L)=>{
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz),spark=glint&&Math.pow(Math.max(0,HIT.nx*.3+HIT.ny*.6+HIT.nz*.74),18)>.4;
    BG[i]=C(col,(col===WHITE||col===YEL?3.4:2.6)+L*.3*light+(spark?4:0));set(i,' ',0);return true;
  };
}
// One item standing on the bed at z, its own small shapes.
function caseGoodsItem(x,y,z,q,c,s,shade) {
  const at=(u,v)=>[x+c*u-s*v,y+s*u+c*v],dark=(i,t,L)=>{BG[i]=C(GRAY,.8+L*.1);set(i,' ',0);return true;};
  switch(q.shape) {
    case 'ring':coveLathe(x,y,z,[[0,.012],[0,.018],[.006,.018],[.006,.012],[0,.012]],shade);coveLathe(x,y,z+.006,[[0,0],[0,.005],[.006,.003],[.006,0]],shade);break;
    case 'gem':coveLathe(x,y,z,[[0,0],[0,.004],[.008,.014],[.012,.009],[.014,0]],shade);break;
    case 'pendant':coveLathe(x,y,z,[[0,0],[0,.016],[.006,.016],[.006,0]],shade);coveLathe(x,y,z,[[0,.03],[0,.033],[.002,.033],[.002,.03],[0,.03]],shade);break;
    case 'watch':{drawBox({...boxAt(x,y,c,s,.011,.05,z,z+.004),...kitchenPanelProfile(.011,.05,z,z+.004,.001)},dark,homeRayWorktop);
      coveLathe(x,y,z+.004,[[0,0],[0,.017],[.008,.016],[.009,0]],shade);coveLathe(x,y,z+.012,[[0,0],[0,.013],[.001,.013],[.001,0]],(i,t,L)=>{BG[i]=C(WHITE,7);set(i,' ',0);return true;});break;}
    case 'wheel':coveLathe(x,y,z,[[0,0],[0,.026],[.004,.028],[.028,.028],[.032,.026],[.032,.012],[.026,.008],[.026,0]],shade);break;
    case 'bearing':coveLathe(x,y,z,[[0,.004],[0,.011],[.007,.011],[.007,.004],[0,.004]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));break;
    case 'truck':{const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);drawBox({...boxAt(x,y,c,s,.03,.012,z,z+.008),...kitchenPanelProfile(.03,.012,z,z+.008,.002)},metal,homeRayWorktop);
      const [a,b]=at(-.055,0),[e,f]=at(.055,0);coveTube(a,b,z+.016,e,f,z+.016,.004,GRAY);coveLathe(x,y,z+.008,[[0,0],[0,.008],[.014,.006],[.014,0]],metal);break;}
    case 'pipe':{const [a,b]=at(-.012,0),[e,f]=at(.06,0);coveLathe(a,b,z,[[0,0],[0,.014],[.03,.016],[.03,.011],[.008,.009],[.008,0]],shade);coveTube(a,b,z+.01,e,f,z+.006,.004,GRAY);break;}
    case 'lighter':drawBox({...boxAt(x,y,c,s,.012,.008,z,z+.045),...kitchenPanelProfile(.012,.008,z,z+.045,.002)},shade,homeRayWorktop);break;
    case 'tin':coveLathe(x,y,z,[[0,0],[0,.03],[.014,.03],[.016,.028],[.016,0]],shade);break;
    case 'root':drawBox(boxAt(x,y,c,s,.04,.012,z,z+.016),shade,homeRayEllipsoid);break;
    case 'bundle':{for(const e of [-.01,0,.01]){const [a,b]=at(-.04,e),[f,g]=at(.04,e*1.6);coveTube(a,b,z+.006,f,g,z+.008,.005,GREEN);}
      const [a,b]=at(-.01,0);coveLathe(a,b,z,[[0,.012],[0,.016],[.012,.016],[.012,.012],[0,.012]],(i,t,L)=>{BG[i]=C(RED,3);set(i,' ',0);return true;});break;}
    case 'dish':coveLathe(x,y,z,[[0,0],[0,.026],[.012,.034],[.014,.034],[.004,.026],[.004,0]],(i,t,L)=>{BG[i]=C(WHITE,5+L*.2*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
      coveLathe(x,y,z+.004,[[0,0],[0,.024],[.006,.02],[.008,0]],shade);break;
    case 'figure':coveLathe(x,y,z,[[0,0],[0,.018],[.006,.016],[.03,.012],[.04,.009],[.05,.012],[.062,.008],[.065,0]],shade);break;
    case 'box':drawBox({...boxAt(x,y,c,s,.022,.016,z,z+.022),...kitchenTopProfile(.022,.016,z,z+.022,.003)},shade,homeRayWorktop);break;
    case 'stud':coveLathe(x,y,z,[[0,0],[0,.004],[.006,.004],[.008,.006],[.012,0]],shade);break;
    case 'barbell':{const [a,b]=at(-.012,0),[e,f]=at(.012,0);coveTube(a,b,z+.004,e,f,z+.004,.0015,GRAY);for(const [p,r]of [[a,b],[e,f]])coveLathe(p,r,z,[[0,0],[0,.004],[.008,.004],[.008,0]],shade);break;}
    case 'bun':foodOval(x,y,z,.03,.026,.03,kitchenFoodShade(ORANGE),c,s);break;
    case 'roll':foodOval(x,y,z,.045,.02,.025,kitchenFoodShade(YEL),c,s);break;
  }
}
function SHOP_DISPLAY_CASE(x,y,hl,hw,h,goods,base=BRICK,ca=1,sa=0) {
  const D=DISPLAY_CASE,g=h-D.glass,c=ca,s=sa,items=caseGoodsLayout(hl-.03,hw-.03,goods),bed=g+D.bed;
  const shades=items.map(q=>caseGoodsShade(q.col,goods.glint));
  const wood=base===GRAY?kitchenSteel:furnitureTimber(base),chrome=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  const velvet=(i,t,L)=>{BG[i]=C(goods.kind==='pastry'?WHITE:goods.kind==='skate'?GRAY:BLUE,goods.kind==='pastry'?5:1.2+L*.08);set(i,' ',0);return true;};
  const glass=(i,t,L)=>{ // clear: only narrow reflected streaks, so the goods behind stay visible from every side
    const f=HIT.face,u=f<=2?HIT.v:HIT.u,v=f===5?HIT.v:HIT.w,glint=coveGroove(u+v*.55,1.3,.003,t/projX)*coveDetail(t);
    if(glint<.5)return false;BG[i]=C(CYAN,2+L*.2);set(i,' ',0);return true;
  };
  const count=Math.max(1,Math.ceil(hl*2/.8)),half=hl/count;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    items.forEach((q,n)=>{const [ix,iy]=at(q.u,q.v);caseGoodsItem(ix,iy,bed,q,Math.cos(q.turn)*c-Math.sin(q.turn)*s,Math.sin(q.turn)*c+Math.cos(q.turn)*s,shades[n]);});
    drawBox(boxAt(vx,vy,c,s,hl-D.frame,hw-D.frame,g,h-D.frame),glass);
    // the chrome frame: four uprights and the top rails, joined at the corners
    for(const eu of [-1,1])for(const ev of [-1,1]){const [px_,py_]=at(eu*(hl-D.frame),ev*(hw-D.frame));coveTube(px_,py_,g,px_,py_,h-D.frame,D.frame,GRAY);}
    for(const ev of [-1,1]){const [a,b]=at(-hl+D.frame,ev*(hw-D.frame)),[e,f]=at(hl-D.frame,ev*(hw-D.frame));coveTube(a,b,h-D.frame,e,f,h-D.frame,D.frame,GRAY);}
    for(const eu of [-1,1]){const [a,b]=at(eu*(hl-D.frame),-hw+D.frame),[e,f]=at(eu*(hl-D.frame),hw-D.frame);coveTube(a,b,h-D.frame,e,f,h-D.frame,D.frame,GRAY);}
    // The velvet bed on the cabinet's top, then the cabinet: big plain slabs,
    // so plain boxes the renderer clips column by column (bevelled plane
    // sets cost several milliseconds once a case fills the view).
    const flat=shade=>(i,t,L)=>{const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);};
    drawBox(boxAt(vx,vy,c,s,hl-.02,hw-.02,g,bed),flat(velvet));
    drawBox(boxAt(vx,vy,c,s,hl,hw,g-.025,g),flat(chrome));
    for(let k=0;k<count;k++){const [dx_,dy_]=at(-hl+half*(2*k+1),-hw-.006);drawBox(boxAt(dx_,dy_,c,s,half-.012,.006,.14,g-.08),flat(wood));}
    drawBox(boxAt(vx,vy,c,s,hl,hw,.08,g-.025),flat(wood));
    drawBox(boxAt(vx,vy,c,s,hl-.03,hw-.03,0,.08),(i,t,L)=>{BG[i]=C(GRAY,.6);set(i,' ',0);return true;});
  }),box:boxAt(x,y,c,s,hl,hw,0,h),radius:Math.hypot(hl,hw)+.05,
    displayCase:{x,y,hl,hw,h,glassBottom:g,bed,c,s,goods,items:items.map(q=>({...q}))}};
}
// The old call: a case is now one built model.
function glassCase(x, y, hl, hw, h, goods, base = BRICK, ca = 1, sa = 0) {
  return [SHOP_DISPLAY_CASE(x, y, hl, hw, h, goods, base, ca, sa)];
}
