// Older room saves can lack their building cell. Infer the nearest real bank
// once at entry, without mutating the saved room or inventing a neighbourhood.
function bankEntranceExterior(r) {
  if(r.cell&&SHOP[idx(...r.cell)]?.word==='BANK'&&map[idx(...r.cell)]>1)return hotelEntranceExterior(r);
  const ret=r.ret||[px,py];let cell=null,best=Infinity;
  for(let k=0;k<SHOP.length;k++)if(SHOP[k]?.word==='BANK'&&map[k]>1){
    const x=k%N,y=k/N|0,d=near(ret[0],ret[1],x+.5,y+.5);
    if(d<best){best=d;cell=[x,y];}
  }
  return hotelEntranceExterior(cell?{...r,cell}:r);
}
const BANK_ENTRY_PROPS=ROOM_DEFS.bank.props,BANK_ENTRY_WALL=ROOM_DEFS.bank.wall;
ROOM_DEFS.bank.props=r=>{
  r.hotelEntranceExterior=bankEntranceExterior(r);
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1,YEL);
  entry.bankEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  return [...BANK_ENTRY_PROPS(r),entry];
};
ROOM_DEFS.bank.doorWall=true;
ROOM_DEFS.bank.wall=(...args)=>hotelEntranceGlass(args[0],args[1],args[3],args[5],args[6])||BANK_ENTRY_WALL(...args);
