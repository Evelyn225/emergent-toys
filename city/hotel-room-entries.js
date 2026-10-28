// Hotel rooms get opaque fitted leaves rather than the public glass-exit
// painter. Keep native D collision/interaction and all existing spawn points.
function hotelRoomEntry(r) {
  const slots=[...r.grid[r.H-1]].flatMap((c,x)=>c==='D'?[x+.5]:[]);
  const center=slots.reduce((a,b)=>a+b,0)/slots.length;
  const model=HOME_ENTRY_DOOR({...r,def:{...r.def,entry:[center,...r.def.entry.slice(1)]}});
  model.hotelEntry=model.homeEntry;delete model.homeEntry;
  return model;
}
