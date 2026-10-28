// Slim ceiling profiles finish all three home families, including the solid
// heads over otherwise open passages. The existing moulding fitter owns joins.
function homeCornices(r) {
  if(!r.def.builtCornices)return [];
  const h=r.def.height,tier=r.def.tier;
  const profile=tier===2?[[h-.16,h-.105,.024],[h-.105,h-.035,.048],[h-.035,h,.075]]:
    tier===1?[[h-.045,h-.015,.012],[h-.015,h,.025]]:
    [[h-.075,h-.045,.012],[h-.045,h-.018,.026],[h-.018,h,.04]];
  return homeWallMoulding(r,profile,true);
}
