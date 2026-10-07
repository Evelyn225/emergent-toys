// One authored neighbourhood route. Heights are world units (10m), shared by drawing and traversal.
const COURIER_DEPOT = { x0: 178, y0: 101, x1: 181, y1: 104, h: 1.4, roof: [179.5,102.5], door: [177.72,102.5] };
const COURIER_COMPANY = 'Rooftop Couriers';
{
  const sh = COURIER_DEPOT.sh = { kind: SHOP_LIT, word: 'COURIER', neon: GREEN, glyphs: '>[]', hours: [0,24], courier: true };
  for (let y=101;y<104;y++) for (let x=178;x<181;x++) {
    const k=idx(x,y);map[k]=COURIER_DEPOT.h;STY[k]=8;SEED[k]=.37;SHOP[k]=sh;
  }
}
const COURIER_SURFACES = [], COURIER_LADDERS = [], COURIER_SCENERY = [];
function courierSurface(x0,y0,x1,y1,h0,h1=h0,axis='x',kind='bridge') {
  const o={x:(x0+x1)/2,y:(y0+y1)/2,hl:(x1-x0)/2,hw:(y1-y0)/2,c:1,s:0,
    z0:Math.min(h0,h1)-.035,z1:Math.max(h0,h1),h0,h1,axis,kind};
  COURIER_SURFACES.push(o);return o;
}
function courierLadder(id,bottom,top,rail) {
  COURIER_LADDERS.push({id,bottom,top,x:rail[0],y:rail[1],yaw:rail[2]});
}
const courierMapHeight = (x,y) => map[idx(Math.floor(x),Math.floor(y))];
// The lower depot roof leads over the lane to a laundry terrace, then across a service catwalk.
courierSurface(179.35,103.8,179.65,106.2,COURIER_DEPOT.h,courierMapHeight(179.5,106.5),'y');
courierSurface(183.8,107.2,186.2,107.5,courierMapHeight(183.5,107.35),courierMapHeight(186.5,107.35));
// A second crossing turns back toward the row with the florist and its roof garden.
courierSurface(191.25,103.8,191.55,106.2,courierMapHeight(191.4,103.5),courierMapHeight(191.4,106.5),'y');
courierSurface(191.8,102.2,194.2,102.5,courierMapHeight(191.5,102.35),courierMapHeight(194.5,102.35));
// Raised maintenance platforms form the easier path over the taller middle townhouse.
courierSurface(189.55,106.55,190.15,107.15,courierMapHeight(189.5,107),courierMapHeight(190.5,107));
courierSurface(195.65,102.15,196.15,102.65,courierMapHeight(195.5,102.4),courierMapHeight(196.5,102.4));
courierSurface(197.75,102.15,198.25,102.65,courierMapHeight(197.5,102.4),courierMapHeight(198.5,102.4));
// Two small gaps are optional sprint-jump shortcuts; the walkable service bridges remain available.
courierSurface(183.6,108.4,184.75,108.65,1.5,1.6,'x','shortcut');
courierSurface(185.1,108.4,186.4,108.65,1.6,1.6,'x','shortcut');
courierSurface(192,101.15,192.95,101.4,1.7,1.7,'x','shortcut');
courierSurface(193.3,101.15,194.5,101.4,1.4,1.4,'x','shortcut');
courierLadder('depot',[177.75,103.45,0],[178.35,103.45,COURIER_DEPOT.h],[177.97,103.45,0]);
courierLadder('laundry',[183.4,105.75,0],[183.4,106.35,courierMapHeight(183.4,106.35)],[183.4,105.97,Math.PI/2]);
courierLadder('garden',[198.5,104.25,0],[198.5,103.65,courierMapHeight(198.5,103.65)],[198.5,104.03,-Math.PI/2]);
const COURIER_GARDEN = { x:199,y:102.1,z:courierMapHeight(199,102.1), name:'Mara' };
const COURIER_ROUTES = [{id:'garden',title:'The Green Roof',parcel:'gardening supplies',pay:80,bonus:40,
  quick:70,bonusUntil:150,recipient:COURIER_GARDEN,
  directions:'South over the print-shop bridge, east past the laundry and water tank, then north to the florist row.'}];
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
