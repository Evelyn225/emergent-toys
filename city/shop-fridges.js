// Reach-in fridge runs along shop walls, built as glass-door coolers (the
// pass 3 drinks cooler) instead of painted onto the wall. Each run stands on
// its wall face, shallow enough to keep the aisle in front walkable.
const SHOP_FRIDGE_DEPTH=.18;
// A run along a wall from a to b (both on the wall face), facing (fx, fy).
function shopFridgeRun(ax,ay,bx,by,fx,fy,opts) {
  const d=SHOP_FRIDGE_DEPTH,half=Math.hypot(bx-ax,by-ay)/2;
  return KITCHEN_DRINKS_COOLER((ax+bx)/2+fx*d,(ay+by)/2+fy*d,half,d,fx,fy,opts);
}
const SHOP_FRIDGES={
  // the left wall's dairy run, and the drinks along the back up to the first aisle; the back run owns the corner
  // (the dairy stops short of the stack of baskets by the door)
  grocer:()=>[shopFridgeRun(1,1+2*SHOP_FRIDGE_DEPTH,1,8.25,1,0,{label:'DAIRY',stock:'dairy'}),shopFridgeRun(1,1,6,1,0,1,{label:'COLD DRINKS'})],
  deli:()=>[shopFridgeRun(1,1,1,8,1,0,{label:'COLD DRINKS'})],
  // the beer fridges down the left wall under their sign, and the cave's back wall
  liquor:()=>[shopFridgeRun(1,4,1,8,1,0,{label:'BEER',stock:'beer'}),shopFridgeRun(1,1,4,1,0,1,{label:'BEER',stock:'beer'})],
  store:()=>[shopFridgeRun(9,1,9,7,-1,0,{label:'COLD DRINKS'})],
  gas:()=>[shopFridgeRun(1.65,1,9,1,0,1,{label:'COLD DRINKS'})], // (from the end of the coffee counter)
};
