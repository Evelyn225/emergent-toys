// Ramps, deck and clearance share one description. Heights are cells (10 m).
// The north shore road occupies y=168..170. Start beyond its outer kerb so
// the ramp and railings cannot cut across that junction or its house entrances.
const ROAD_BRIDGES = [25,38].map((bx,i)=>({id:i?'harbor':'iron',x:bx*8+1,hw:1,y0:170,y1:216,ramp:12,h:1.65,thickness:.12}));
function roadBridgeAt(x,y) {
  return worldReady ? ROAD_BRIDGES.find(b=>Math.abs(x-b.x)<=b.hw&&y>=b.y0&&y<=b.y1) || null : null;
}
function roadBridgeHeight(b,y) { return b.h * Math.min(1,(y-b.y0)/b.ramp,(b.y1-y)/b.ramp); }
function roadGroundHeight(x,y) { const b=roadBridgeAt(x,y);return Math.max(terrainHeight(x,y),b?roadBridgeHeight(b,y):0); }
function roadBridgePierAt(x,y,pad=0) {
  return worldReady && ROAD_BRIDGES.some(b=>[b.y0+b.ramp+2,b.y1-b.ramp-2].some(py=>[-1,1].some(side=>Math.abs(x-b.x-side*1.25)<.14+pad&&Math.abs(y-py)<.32+pad)));
}
function roadBridgeClearance(x,y) { const b=roadBridgeAt(x,y);return b?Math.max(0,roadBridgeHeight(b,y)-b.thickness):Infinity; }
function roadBridgeRailAt(x,y,z) {
  if(!worldReady)return false;
  return ROAD_BRIDGES.some(b=>y>=b.y0&&y<=b.y1&&Math.abs(x-b.x)>.94&&Math.abs(x-b.x)<1.02&&z<roadBridgeHeight(b,y)+.115);
}
function roadBridgeBuiltHeight(x,y,z=Infinity) {
  if(roadBridgePierAt(x,y))return ROAD_BRIDGES.find(b=>Math.abs(x-b.x)<2).h-.12;
  const b=roadBridgeAt(x,y);
  if(!b)return 0;
  const top=roadBridgeHeight(b,y);
  return z<top-b.thickness-.01?0:top;
}
