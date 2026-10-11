// One authored neighbourhood route. Heights are world units (10m), shared by drawing and traversal.
const COURIER_DEPOT = { x0: 178, y0: 101, x1: 181, y1: 104, h: 1.4, roof: [179.5,102.5], door: [177.72,102.5] };
const COURIER_COMPANY = 'Rooftop Couriers';
{
  const sh = COURIER_DEPOT.sh = { kind: SHOP_LIT, word: 'COURIER', neon: GREEN, glyphs: '>[]', hours: [0,24], courier: true };
  for (let y=101;y<104;y++) for (let x=178;x<181;x++) {
    const k=idx(x,y);map[k]=COURIER_DEPOT.h;STY[k]=8;SEED[k]=.37;SHOP[k]=sh;
  }
}
// A recipient's whole block is shops. Roofs within a block connect, so any apartment elevator there would be a ride
// straight to the delivery; the parcel has to come over the route. Converted before props and architecture run.
for (const [x,y,word,kind] of [[198,101,'GROCERY',SHOP_PRODUCE],[196,101,'CAFE'],[194,101,'BARBER'],[194,99,'PET SHOP'],
  [186,114,'HARDWARE'],[188,114,'LAUNDRY'],[188,117,'PIZZA'],[190,117,'THRIFT'],
  [180,122,'BAR',SHOP_NEON],[182,122,'TATTOO',SHOP_NEON],[182,125,'NOODLES']]) {
  const k=idx(x,y);
  Object.assign(SHOP[k],{kind:kind??SHOP_LIT,word,neon:NEON[(SEED[k]*1000|0)%4],glyphs:GLYPHS[word]||'o#=@',hours:hoursOf(word)});
}
const COURIER_SURFACES = [], COURIER_STAIRS = [], COURIER_LADDERS = [], COURIER_SCENERY = [];
function courierSurface(x0,y0,x1,y1,h0,h1=h0,axis='x',kind='bridge') {
  const o={x:(x0+x1)/2,y:(y0+y1)/2,hl:(x1-x0)/2,hw:(y1-y0)/2,c:1,s:0,
    z0:Math.min(h0,h1)-.012,z1:Math.max(h0,h1),h0,h1,axis,kind,thickness:.012};
  COURIER_SURFACES.push(o);return o;
}
function courierLadder(route,bottom,top,rail) {
  COURIER_LADDERS.push({route,bottom,top,x:rail[0],y:rail[1],yaw:rail[2]});
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

// ---- Topping Out: a steel frame replaces the brownstone south of the staging roof. Converting the lot here, before
// props and architecture run, means no stoop, bay or cornice is ever generated for it.
const COURIER_SITE = { x0:182, y0:114, x1:185, y1:117, h:2 };
for (let y=COURIER_SITE.y0;y<COURIER_SITE.y1;y++) for (let x=COURIER_SITE.x0;x<COURIER_SITE.x1;x++) {
  const k=idx(x,y);map[k]=COURIER_SITE.h;STY[k]=6;SHOP[k]=null;
}
// Lot 10 rises to the staging roof over its party-wall cornice, like the townhouse steps on the first route.
const courierStagingDeck=courierMapHeight(182.5,110.5)+.06;
courierStairs(180.95,110.38,181.85,110.62,courierMapHeight(181,110.5),courierStagingDeck);
courierSurface(181.85,110.38,182.2,110.62,courierStagingDeck,courierStagingDeck,'x','landing');
// Two work platforms hang from the crane's lifting frame, level with the staging roof. Each gap is a walking jump.
const courierHang=courierMapHeight(182.5,111.5);
const COURIER_PLATFORMS=[courierSurface(182.33,112.32,182.77,112.86,courierHang,courierHang,'y','platform'),
  courierSurface(182.33,113.1,182.77,113.52,courierHang,courierHang,'y','platform')];
// Bracket scaffold on the frame's street face: nothing stands on the sidewalk. It runs on past the frame's corner
// above the neighbouring cornice, so the apartments' roof next door is a way back on after a fall.
const courierScaffold=courierSurface(181.75,113.74,185,113.98,courierHang,courierHang,'x','scaffold');
// Its end board laps onto that roof over the cornice, so there's no sliver of open air at the step.
courierSurface(181.75,113.98,181.99,114.08,courierHang,courierHang,'x','scaffold');
// The hoist bay juts out over the street, railed so you can only leave it heading east: the office roof is
// south of that line, so the jump has to curve in the air.
const courierHoistBay=courierSurface(184.55,113.52,185.45,113.74,courierHang,courierHang,'x','bay');
courierLadder('site',[183.55,113.86,courierHang],[183.55,114.12,COURIER_SITE.h],[183.55,113.985,Math.PI/2]);
// The crew's crossing to the site office: a narrow walkway at deck level, a landing, then stairs down the roof.
const courierOfficeRoof=courierMapHeight(186.5,115.5);
const courierPlank=courierSurface(185,116.39,186.18,116.51,COURIER_SITE.h,COURIER_SITE.h,'x','plank');
const courierOfficeLanding=courierSurface(186.18,116.27,186.48,116.57,COURIER_SITE.h,COURIER_SITE.h,'y','landing');
courierStairs(186.18,114.7,186.48,116.27,courierOfficeRoof,COURIER_SITE.h,'y');
const COURIER_FOREMAN = { x:186.85,y:114.75,z:courierOfficeRoof,name:'Teo' };

// ---- Last Set, the night run: down the brownstone backs above the neon strip (the avenue at x=176-177) to the bar at
// its south end, where Nico waits on the roof for his guitar.
const courierBacks=courierMapHeight(178.5,110.5);
// The side street's sign gantry: a truss from roof to roof, its arched LATE NITE sign hung beneath, and the sign
// crew's catwalk on top. The truss clears both cornices; the catwalk runs on over No.851's roof as a raised walkway.
const courierArchDeck=courierMapHeight(178.5,114.5)+.152;
const COURIER_ARCH={x:178.5,y0:111.85,y1:114.15,z0:courierArchDeck-.112,z1:courierArchDeck-.012};
courierStairs(178.39,110.7,178.61,COURIER_ARCH.y0,courierBacks,courierArchDeck,'y');
const courierArchWalk=courierSurface(178.39,COURIER_ARCH.y0,178.61,115.9,courierArchDeck,courierArchDeck,'y','catwalk');
// Rise before No.425's taller party wall, then a landing over its cornice.
const courierBackDeck=courierMapHeight(178.5,118)+.06;
courierStairs(178.39,115.9,178.61,116.9,courierArchDeck,courierBackDeck,'y');
courierSurface(178.39,116.9,178.61,117.2,courierBackDeck,courierBackDeck,'y','landing');
// The ARCADE's rooftop sign faces up the side street. Its electricians cross from No.425 on a footbridge that passes
// the sign's west end, then work from the catwalk behind its letters; stairs at the far end come down to the roof.
const COURIER_ARCADE_SIGN={x0:178.6,x1:179.95,y:122.33,z0:courierBackDeck,z1:courierBackDeck+.38};
courierSurface(178.19,119.8,178.41,122.4,courierBackDeck,courierBackDeck,'y');
const courierSignWalk=courierSurface(178.19,122.4,179.95,122.62,courierBackDeck,courierBackDeck,'x','catwalk');
const courierArcadeRoof=courierMapHeight(179.5,123.5);
courierStairs(179.62,122.62,179.84,123.8,courierBackDeck,courierArcadeRoof,'y');
const COURIER_NICO = { x:180.75,y:123.3,z:courierMapHeight(180.5,123.5),name:'Nico' };
// No.299's condenser stands at its south edge, a step up from the roof. Hop down the walkway to build speed, and
// off its top you can clear the side street onto the bar roof, five metres down.
const courierCondenser=courierSurface(180.25,119.45,180.85,119.92,courierMapHeight(180.5,118.5)+.15,courierMapHeight(180.5,118.5)+.15,'x','condenser');
courierCondenser.z0=courierMapHeight(180.5,118.5);
// After dark the signs light the roofs round them: [x, y, reach, colour]. The bar roof has its own string of bulbs.
const COURIER_NEON=[[178.5,111.95,.75,MAG],[178.5,114.05,.75,MAG],[179.3,122.15,1.1,CYAN],[181,123,.85,WARM]];
function courierNeonSpill(x,y) {
  if(night<.25)return null;
  let best=0,col=0;
  for(const [sx,sy,reach,c] of COURIER_NEON) {
    const f=1-Math.hypot(rel(x-sx),rel(y-sy))/reach;
    if(f>best){best=f;col=c;}
  }
  return best>0?[best*best*night,col]:null;
}

const COURIER_ROUTES = [{id:'garden',title:'The Green Roof',parcel:'gardening supplies',pay:80,bonus:40,
  quick:42,bonusUntil:90,recipient:COURIER_GARDEN,label:'ROOF GARDEN',
  offer:`Gardening supplies for ${COURIER_GARDEN.name}. Eighty dollars, plus a speed bonus. Stairs are on your left.`,
  thanks:`"Perfect! The tomatoes were getting impatient." ${COURIER_GARDEN.name} takes the supplies.`,
  chat:'"The roof gets the best sun. Want a tomato?"',
  directions:'South over the print-shop bridge. Yellow arrows follow the safe service crossings; cyan arrows mark the faster jumps. Then north to the florist row.'},
 {id:'site',title:'Topping Out',parcel:'stamped drawings',pay:100,bonus:50,
  quick:28,bonusUntil:60,recipient:COURIER_FOREMAN,label:'SITE OFFICE',unlock:'garden',
  offer:`Stamped drawings for ${COURIER_FOREMAN.name}, the foreman on the Pell Street job. The pour can't start without them. A hundred, and fifty more if you're quick.`,
  thanks:`"Stamped and signed. Pour's back on!" ${COURIER_FOREMAN.name} pops the tube open on the cabin step.`,
  chat:'"Six floors of steel and every one of them late."',
  directions:'South over the bridge, up the steps to the staging roof, then jump the crane platforms to the scaffold. Ladder up, cross the deck and the walkway to the site office. Cyan arrows: off the end of the hoist bay, let go of forward and strafe right onto the office roof.'},
 {id:'night',title:'Last Set',parcel:'repaired guitar',pay:120,bonus:60,
  quick:30,bonusUntil:60,recipient:COURIER_NICO,label:'BAR ROOF',unlock:'site',hours:[20,4],
  offer:`Nico's guitar, back from the repair shop. He plays the bar on the strip at midnight and he's waiting on its roof. A hundred and twenty, sixty more if he gets to tune up.`,
  thanks:`"Oh, you beauty." ${COURIER_NICO.name} has the case open before you've let go of it, and starts to play.`,
  chat:'"Midnight set. Plenty of time now."',
  directions:"South over the bridge, then down the backs of the brownstones beside the strip. Cross the side street on the LATE NITE sign's catwalk, follow the walkway up, and take the footbridge to the ARCADE sign. Nico's on the bar roof next door. Cyan arrows: bunny-hop the walkway up to speed, then leap the side street off No.299's condenser onto the bar roof. Miss and it's a long way down."}];
// A former press-room skylight makes the depot's roof step up on its quiet north side.
const courierHut=courierSurface(178.3,101.2,180.3,101.8,1.65,1.65,'x','hut');
courierHut.z0=COURIER_DEPOT.h;
function courierSurfacePlanes(o) {
  const sx=o.axis==='x'?(o.h1-o.h0)/(2*o.hl):0,sy=o.axis==='y'?(o.h1-o.h0)/(2*o.hw):0,mid=(o.h0+o.h1)/2;
  return [[1,0,0,o.hl,1],[-1,0,0,o.hl,2],[0,1,0,o.hw,3],[0,-1,0,o.hw,4],[-sx,-sy,1,mid,5],
    ...(o.kind==='hut'||o.kind==='condenser'?[[0,0,-1,-o.z0,6]]:[[sx,sy,-1,-mid+(o.thickness??.035),6]])];
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
