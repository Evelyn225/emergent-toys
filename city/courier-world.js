// One authored neighbourhood route. Heights are world units (10m), shared by drawing and traversal.
const COURIER_DEPOT = { x0: 178, y0: 101, x1: 181, y1: 104, h: 1.4, roof: [179.5,102.5], door: [177.72,102.5] };
const COURIER_COMPANY = 'Rooftop Couriers';
{
  const sh = COURIER_DEPOT.sh = { kind: SHOP_LIT, word: 'COURIER', neon: GREEN, glyphs: '>[]', hours: [0,24], courier: true };
  for (let y=101;y<104;y++) for (let x=178;x<181;x++) {
    const k=idx(x,y);map[k]=COURIER_DEPOT.h;STY[k]=8;SEED[k]=.37;SHOP[k]=sh;
  }
}
const COURIER_SURFACES = [], COURIER_STAIRS = [], COURIER_LADDERS = [], COURIER_SCENERY = [];
function courierSurface(x0,y0,x1,y1,h0,h1=h0,axis='x',kind='bridge') {
  const o={x:(x0+x1)/2,y:(y0+y1)/2,hl:(x1-x0)/2,hw:(y1-y0)/2,c:1,s:0,
    z0:Math.min(h0,h1)-.012,z1:Math.max(h0,h1),h0,h1,axis,kind,thickness:.012};
  COURIER_SURFACES.push(o);return o;
}
function courierLadder(id,bottom,top,rail) {
  COURIER_LADDERS.push({id,bottom,top,x:rail[0],y:rail[1],yaw:rail[2]});
}
const courierMapHeight = (x,y) => map[idx(Math.floor(x),Math.floor(y))];
function courierStairs(x0,y0,x1,y1,h0,h1,axis='x') {
  const count=Math.ceil(Math.abs(h1-h0)/.022),flight={x:(x0+x1)/2,y:(y0+y1)/2,
    hl:(x1-x0)/2,hw:(y1-y0)/2,h0,h1,axis,kind:'stairs'};
  COURIER_STAIRS.push(flight);
  for(let i=0;i<count;i++) {
    const lo=i/count,hi=(i+1)/count;
    const h=h0+(h1-h0)*(h1>h0?hi:lo);
    const step=courierSurface(axis==='x'?x0+(x1-x0)*lo:x0,axis==='y'?y0+(y1-y0)*lo:y0,
      axis==='x'?x0+(x1-x0)*hi:x1,axis==='y'?y0+(y1-y0)*hi:y1,h,h,axis,'step');
    // Closed risers meet the preceding tread, so there are no floating strips between steps.
    step.z0=Math.max(Math.min(h0,h1),h-Math.abs(h1-h0)/count-.012);step.thickness=h-step.z0;
  }
  return flight;
}
// Level decks clear the existing cornices, with their approach stairs entirely on the lower roof.
const courierSouthDeck=courierMapHeight(179.5,106.5)+.06;
courierStairs(179.37,102.55,179.63,103.8,COURIER_DEPOT.h,courierSouthDeck,'y');
courierSurface(179.39,103.8,179.61,106.2,courierSouthDeck,courierSouthDeck,'y');
const courierLaundryDeck=courierMapHeight(186.5,107.35)+.06;
// The old maintenance crossing follows the rear service terrace. A direct jump across the lane cuts this dogleg.
courierStairs(183.37,108.25,183.63,108.85,courierMapHeight(183.5,108.2),courierLaundryDeck,'y');
courierSurface(183.37,108.85,183.63,109.61,courierLaundryDeck,courierLaundryDeck,'y','landing');
courierSurface(183.63,109.39,183.8,109.61,courierLaundryDeck,courierLaundryDeck,'x','landing');
courierSurface(183.8,109.39,186.2,109.61,courierLaundryDeck);
const courierNorthDeck=courierMapHeight(191.4,103.5)+.06;
courierStairs(191.27,106.2,191.53,107.2,courierNorthDeck,courierMapHeight(191.4,106.5),'y');
courierSurface(191.29,103.8,191.51,106.2,courierNorthDeck,courierNorthDeck,'y');
// The last bridge ends in a small landing on the lower roof; step or jump down from its open end.
courierSurface(191.8,101.14,194.25,101.36,courierNorthDeck);
// Rise before each taller party wall instead of cutting a ramp through its cornice.
const courierTownhouseDeck=courierMapHeight(190.5,107)+.06;
courierStairs(188.45,106.72,189.85,106.98,courierMapHeight(189.5,107),courierTownhouseDeck);
courierSurface(189.85,106.72,190.2,106.98,courierTownhouseDeck,courierTownhouseDeck,'x','landing');
const courierGardenApproach=courierMapHeight(196.5,102.4)+.06;
// Both approaches meet on one deck: the jump landing used to cut across the first few stair treads.
const courierGardenLanding=courierMapHeight(194.5,102.35)+.06;
const courierGardenEntry=courierStairs(194.25,101.8,194.5,102.27,courierMapHeight(194.5,102.35),courierGardenLanding,'y');
courierGardenEntry.railing=false; // Three shallow steps on the roof need an open approach.
courierSurface(194.25,102.27,194.5,102.53,courierGardenLanding,courierGardenLanding,'x','landing');
courierStairs(194.5,102.27,195.85,102.53,courierGardenLanding,courierGardenApproach);
courierSurface(195.85,102.27,196.2,102.53,courierGardenApproach,courierGardenApproach,'x','landing');
// No descending ramp at x=198: the garden is a straightforward drop from the adjoining roof.
// Two small gaps are optional sprint-jump shortcuts; the walkable service bridges remain available.
courierStairs(183.05,106.4,183.85,106.65,1.5,courierLaundryDeck);
courierSurface(183.85,106.4,184.75,106.65,courierLaundryDeck,courierLaundryDeck,'x','shortcut');
courierSurface(185.1,106.4,186.4,106.65,courierLaundryDeck,courierLaundryDeck,'x','shortcut');
courierSurface(191.8,102.24,192.95,102.46,courierNorthDeck,courierNorthDeck,'x','shortcut');
courierSurface(193.3,102.27,194.5,102.53,courierGardenLanding,courierGardenLanding,'x','shortcut');
// These roofs already have indoor access: depot stairs and apartment elevators. Recovery uses those entrances;
// reserve ladders for future routes on buildings without roof access, away from balconies and cornices.
const COURIER_GARDEN = { x:199,y:102.1,z:courierMapHeight(199,102.1), name:'Mara' };
const COURIER_ROUTES = [{id:'garden',title:'The Green Roof',parcel:'gardening supplies',pay:80,bonus:40,
  quick:42,bonusUntil:90,recipient:COURIER_GARDEN,
  directions:'South over the print-shop bridge. Yellow arrows follow the safe service crossings; cyan arrows mark the faster jumps. Then north to the florist row.'}];
// A former press-room skylight makes the depot's roof step up on its quiet north side.
const courierHut=courierSurface(178.3,101.2,180.3,101.8,1.65,1.65,'x','hut');
courierHut.z0=COURIER_DEPOT.h;
function courierSurfacePlanes(o) {
  const sx=o.axis==='x'?(o.h1-o.h0)/(2*o.hl):0,sy=o.axis==='y'?(o.h1-o.h0)/(2*o.hw):0,mid=(o.h0+o.h1)/2;
  return [[1,0,0,o.hl,1],[-1,0,0,o.hl,2],[0,1,0,o.hw,3],[0,-1,0,o.hw,4],[-sx,-sy,1,mid,5],
    ...(o.kind==='hut'?[[0,0,-1,-o.z0,6]]:[[sx,sy,-1,-mid+(o.thickness??.035),6]])];
}
for(const o of COURIER_SURFACES)o.planes=courierSurfacePlanes(o);
const courierSurfaceCells = new Array(N*N);
for (const o of COURIER_SURFACES) {
  for(let y=Math.floor(o.y-o.hw);y<=Math.floor(o.y+o.hw);y++)for(let x=Math.floor(o.x-o.hl);x<=Math.floor(o.x+o.hl);x++) {
    const k=idx(x,y);(courierSurfaceCells[k] || (courierSurfaceCells[k]=[])).push(o);
  }
}
function courierContains(o,x,y,pad=0) {
  return Math.abs(rel(x-o.x))<=o.hl+pad+1e-10 && Math.abs(rel(y-o.y))<=o.hw+pad+1e-10;
}
function courierSurfaceTop(o,x,y) {
  const u=o.axis==='y'?(rel(y-o.y)+o.hw)/(2*o.hw):(rel(x-o.x)+o.hl)/(2*o.hl);
  return o.h0+(o.h1-o.h0)*clamp(u,0,1);
}
function courierRoofHeight(x,y) {
  let h=0;
  for(const o of courierSurfaceCells[idx(Math.floor(x),Math.floor(y))] || [])
    if(courierContains(o,x,y))h=Math.max(h,courierSurfaceTop(o,x,y));
  return h;
}
