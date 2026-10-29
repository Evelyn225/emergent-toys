// Large stone panels retain their world coordinates while joints and veins
// filter smoothly at distance, replacing wall glyph fields and the flat title.
function bankWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY),joint=coveGroove(u,1.2,.003,footprint);
  const vein=coveGroove(u+.14*Math.sin(z*3),1.8,.009,footprint)*coveDetail(d);
  BG[i]=C(STONE,4.2+L*.28-10*joint-.7*vein);set(i,' ',0);return true;
}
// Small letters occupy their projected centre cell exactly once. The shared
// wall sampler's biased interval can leave a gap between oblique columns.
// Keep its close block lettering and restore context without changing it.
function bankTitleText(i,u,z,t,letters,color,background) {
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const dn=WH.dn,sl=WH.sl,wc=WH.wc,step=t/(projX*Math.max(1e-6,Math.abs(ry+dx/projX)));
  WH.dn=Math.max(1e-6,Math.abs(ry*t));WH.sl=rx/(Math.abs(ry)||1e-6);WH.wc=u;
  try{
    if(wallTextBig(u,step,t,0,.24,.22,4))return wallText(i,u,step,z,t,'BANK',0,2.69,.24,.22,color,background);
    for(const p of letters)if(p.i===i){BG[i]=background;set(i,p.ch,color);return true;}
    return false;
  }finally{WH.dn=dn;WH.sl=sl;WH.wc=wc;}
}
function BANK_WALL_TITLE(x,y) {
  const parts=[],letters=[... 'BANK'].map(ch=>({ch,i:-1}));
  hotelLobbyRound(parts,'housing',1.2,.03,2.50,2.82,.02,(i,t,L)=>{
    BG[i]=C(STONE,5+L*.25);if(HIT.face===3&&bankTitleText(i,HIT.u,HIT.w,t,letters,C(GRAY,.2),BG[i]))return true;
    set(i,' ',0);return true;
  });
  const surfaces=hotelLobbyDraw(parts),draw=(vx,vy)=>{
    for(let k=0;k<letters.length;k++){
      const xx=vx+(k-1.5)*.24,yy=vy+.03,forward=dx*xx+dy*yy,across=-dy*xx+dx*yy;
      const col=Math.floor(cols/2+projX*across/forward),row=Math.floor(hor-(2.69-eye)*projY/forward);
      letters[k].i=forward>.01&&col>=0&&col<cols&&row>=0&&row<rows?row*cols+col:-1;
    }
    surfaces(vx,vy);
  };
  return {...ROOM_MODEL(x,y,draw),walk:true,radius:1.22,bankWallTitle:{parts}};
}
const BANK_FINISH_PROPS=ROOM_DEFS.bank.props;
ROOM_DEFS.bank.props=r=>{
  const props=[...BANK_FINISH_PROPS(r),BANK_WALL_TITLE(r.W/2,1.03)];
  const layout={...r,grid:r.grid.map(row=>row.replace(/E/g,'D')),
    def:{...r.def,tier:2,height:r.def.height||3,builtSkirting:true,builtCornices:true},
    props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]};
  // The slim base stays below the circular vault's13cm lower edge. The richer
  // ceiling profile is independent, and all native door/header cuts stay fitted.
  const base={...layout,def:{...layout.def,tier:1}};
  const trim=[...homeSkirting(base),...homeCornices(layout)];
  for(const o of trim)for(const[a,b]of [['homeSkirting','bankSkirting'],['homeCornice','bankCornice']])if(o[a]){o[b]=o[a];delete o[a];}
  return [...props,...trim];
};
ROOM_DEFS.bank.sign=false;
ROOM_DEFS.bank.wall=bankWallFinish;
