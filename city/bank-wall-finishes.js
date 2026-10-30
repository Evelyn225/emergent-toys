// Large stone panels retain their world coordinates while joints and veins
// filter smoothly at distance, replacing wall glyph fields and the flat title.
function bankWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY),joint=coveGroove(u,1.2,.003,footprint);
  const vein=coveGroove(u+.14*Math.sin(z*3),1.8,.009,footprint)*coveDetail(d);
  BG[i]=C(STONE,4.2+L*.28-10*joint-.7*vein);set(i,' ',0);return true;
}
// The name fills its mounted board.
function BANK_WALL_TITLE(x,y) {
  const parts=[];
  hotelLobbyRound(parts,'housing',1.2,.03,2.42,2.83,.02,(i,t,L)=>{
    BG[i]=C(STONE,5+L*.25);if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,'BANK',0,2.625,.56,.38,C(GRAY,.2),BG[i]))return true;
    set(i,' ',0);return true;
  });
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.22,bankWallTitle:{parts}};
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
