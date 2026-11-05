// Ramps, deck and clearance share one description. Heights are cells (10 m).
// The north shore road occupies y=168..170. Start beyond its outer kerb so
// the ramp and railings cannot cut across that junction or its house entrances.
const ROAD_BRIDGES = [25,38].map((bx,i)=>({id:i?'harbor':'iron',x:bx*8+1,hw:1,y0:170,y1:216,ramp:12,h:1.65,thickness:.12}));
function roadBridgeAt(x,y) {
  return worldReady ? ROAD_BRIDGES.find(b=>Math.abs(x-b.x)<=b.hw&&y>=b.y0&&y<=b.y1) || null : null;
}
function roadBridgeHeight(b,y) { return b.h * Math.min(1,(y-b.y0)/b.ramp,(b.y1-y)/b.ramp); }
function roadGroundHeight(x,y) { const b=roadBridgeAt(x,y);return Math.max(terrainHeight(x,y),b?roadBridgeHeight(b,y):0,airportBridgeGround(x,y)); }
function roadBridgePierAt(x,y,pad=0) {
  return airportBridgePierAt(x,y,pad)||worldReady && ROAD_BRIDGES.some(b=>[b.y0+b.ramp+2,b.y1-b.ramp-2].some(py=>[-1,1].some(side=>Math.abs(x-b.x-side*1.25)<.14+pad&&Math.abs(y-py)<.32+pad)));
}
function roadBridgeClearance(x,y) { const ab=airportBridgeAt(x,y);if(ab){const cap=airportBridgeCapAt(x,y);return Math.max(0,cap?cap.bottom:airportBridgeTop(ab,x,y)-AIRPORT_BRIDGE.thickness);}const b=roadBridgeAt(x,y);return b?Math.max(0,roadBridgeHeight(b,y)-b.thickness):Infinity; }
function roadBridgeRailAt(x,y,z) {
  if(!worldReady)return false;
  return airportBridgeRailAt(x,y,z)||ROAD_BRIDGES.some(b=>y>=b.y0&&y<=b.y1&&Math.abs(x-b.x)>.94&&Math.abs(x-b.x)<1.02&&z<roadBridgeHeight(b,y)+.115);
}
function roadBridgeBuiltHeight(x,y,z=Infinity) {
  const airport=airportBridgeBuiltHeight(x,y,z);if(airport!==null)return airport;
  if(roadBridgePierAt(x,y))return ROAD_BRIDGES.find(b=>Math.abs(x-b.x)<2).h-.12;
  const b=roadBridgeAt(x,y);
  if(!b)return 0;
  const top=roadBridgeHeight(b,y);
  return z<top-b.thickness-.01?0:top;
}

// The airport access is one raised L-shaped bridge, with level turning space.
// Section boundaries are shared by the deck rays, walking/driving and boat clearance.
const AIRPORT_BRIDGE={h:1.2,thickness:.12,ramp:14,rail:.115,capX:.64,capY:.3,capDepth:.12};
let airportBridgeCache=null;
function airportBridgeLayout(){
  if(!worldReady)return null;
  if(airportBridgeCache)return airportBridgeCache;
  const {x,hw,y0,y1}=CAUSEWAY,S=AIRPORT_BRIDGE,land=AIRPORT.x1-2,turn=x-hw,crest=turn-3.25;
  const make=(id,x0,y0,x1,y1,h0,h1,axis)=>({id,x:(x0+x1)/2,y:(y0+y1)/2,hl:(x1-x0)/2,hw:(y1-y0)/2,h0,h1,axis,thickness:S.thickness});
  const sections=[make('airport-ramp',land,y0-hw,crest,y0+hw,0,S.h,'x'),make('airport-span',crest,y0-hw,turn,y0+hw,S.h,S.h,'x'),
    make('turn',turn,y0-hw,x+hw,y0+hw,S.h,S.h,'y'),make('bay-span',x-hw,y0+hw,x+hw,y1-S.ramp,S.h,S.h,'y'),make('city-ramp',x-hw,y1-S.ramp,x+hw,y1,S.h,0,'y')];
  const edge=hw-.03,rails=[];
  const add=(x0,y0,x1,y1)=>rails.push({x0,y0,x1,y1});
  for(const ey of [y0-edge,y0+edge]){const end=ey<y0?x+edge:x-edge;for(const [a,b]of [[land,crest],[crest,end]])add(a,ey,b,ey);}
  for(const ex of [x-edge,x+edge]){const start=ex<x?y0+edge:y0-edge;for(const [a,b]of [[start,y0+hw],[y0+hw,y1-S.ramp],[y1-S.ramp,y1]])if(b>a)add(ex,a,ex,b);}
  // The inner corner starts at the horizontal rail, leaving both road ends open.
  const piers=[[x,y0+11],[x,y0+23],[x,y1-S.ramp],[crest,y0],[(land+crest)/2,y0]].map(([x,y])=>({x,y,hl:.23,hw:.23}));
  return airportBridgeCache={sections,rails,piers};
}
function airportBridgeAt(x,y){
  if(!worldReady||x<AIRPORT.x1-2||x>CAUSEWAY.x+CAUSEWAY.hw||y<CAUSEWAY.y0-CAUSEWAY.hw||y>CAUSEWAY.y1)return null;
  return airportBridgeLayout().sections.find(b=>Math.abs(x-b.x)<=b.hl+1e-9&&Math.abs(y-b.y)<=b.hw+1e-9)||null;
}
function airportBridgeTop(b,x,y){const q=b.axis==='x'?(x-b.x+b.hl)/(2*b.hl):(y-b.y+b.hw)/(2*b.hw);return b.h0+(b.h1-b.h0)*clamp(q,0,1);}
function airportBridgeGround(x,y){const b=airportBridgeAt(x,y);return b?airportBridgeTop(b,x,y):0;}
function airportBridgePierAt(x,y,pad=0){return !!(worldReady&&airportBridgeLayout().piers.some(p=>Math.abs(x-p.x)<p.hl+pad&&Math.abs(y-p.y)<p.hw+pad));}
function airportBridgeRailAt(x,y,z){
  if(!airportBridgeAt(x,y))return false;
  const h=airportBridgeGround(x,y);if(z<h-.02||z>h+AIRPORT_BRIDGE.rail)return false;
  return airportBridgeLayout().rails.some(r=>{const dx=r.x1-r.x0,dy=r.y1-r.y0,t=clamp(((x-r.x0)*dx+(y-r.y0)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-r.x0-dx*t,y-r.y0-dy*t)<.025;});
}
function airportBridgeCapAt(x,y){
  if(!airportBridgeAt(x,y))return null;
  const S=AIRPORT_BRIDGE,p=airportBridgeLayout().piers.find(p=>Math.abs(x-p.x)<S.capX&&Math.abs(y-p.y)<S.capY);
  if(!p)return null;const top=airportBridgeGround(p.x,p.y)-S.thickness;return {bottom:top-S.capDepth,top:top+.015};
}
function airportBridgeBuiltHeight(x,y,z){
  const b=airportBridgeAt(x,y);if(!b)return null;
  const top=airportBridgeTop(b,x,y),cap=airportBridgeCapAt(x,y);
  return airportBridgePierAt(x,y)||z>=top-AIRPORT_BRIDGE.thickness-.01||cap&&z>=cap.bottom-.01?top:0;
}
function airportBridgeCarClear(x,y,hx,hy,hl,hw){
  if(!worldReady||x<AIRPORT.x1-3||x>CAUSEWAY.x+2||y<CAUSEWAY.y0-2||y>CAUSEWAY.y1+1)return true;
  const ex=Math.abs(hx)*hl+Math.abs(hy)*hw,ey=Math.abs(hy)*hl+Math.abs(hx)*hw;
  return !airportBridgeLayout().rails.some(r=>{
    const a=Math.abs(r.x1-r.x0)/2+.012,b=Math.abs(r.y1-r.y0)/2+.012,dx=x-(r.x0+r.x1)/2,dy=y-(r.y0+r.y1)/2;
    return Math.abs(dx)<ex+a&&Math.abs(dy)<ey+b&&Math.abs(dx*hx+dy*hy)<hl+Math.abs(hx)*a+Math.abs(hy)*b&&Math.abs(-dx*hy+dy*hx)<hw+Math.abs(hy)*a+Math.abs(hx)*b;
  });
}
