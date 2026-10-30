// The museum's shell. Each wing keeps its character without glyph fields: carved
// sandstone bands, gold-framed canvases, red velvet and marble. After dark it all
// sits at the same low level and only the guards' torches bring it back.
const museumLit=()=>room.burgled?.35:1;
const MUSEUM_GLYPHS=['.#.#.|#####|.#.#.','..#..|#####|..#..','#.#.#|.#.#.|#.#.#','##.##|..#..|##.##','#####|#...#|#####','.###.|#.#.#|.###.','#...#|.#.#.|..#..','.#.#.|.#.#.|#.#.#'].map(s=>s.split('|'));
function museumEgyptWall(i,u,z,d,L,lit) {
  const footprint=d/projY,fz=fract(z*2.5),band=Math.floor(z*2.5);
  BG[i]=C(WARM,(2+L*.15)*lit);
  if(z<=.6||z>=3.2)return true;
  BG[i]=C(WARM,(2+L*.15-3*coveGroove(z,.4,.012,footprint))*lit);
  if(fz<=.3||fz>=.7)return true;
  // A carved row: flat tint from afar, the signs themselves within a few metres.
  const col=band&1?BRICK:BLUE,cell=u*2.2,gx=Math.floor(cell);
  if(footprint>.03){BG[i]=C(WARM,(1.7+L*.13)*lit);return true;}
  const g=MUSEUM_GLYPHS[(gx*5+band*3)&7],row=Math.floor((fz-.3)/.4*3),bit=Math.floor(fract(cell)*5);
  if(g[2-row]?.[bit]==='#')BG[i]=C(col,(2+L*.2)*lit);
  return true;
}
const MUSEUM_CANVAS={w:2.2,z0:.9,z1:2.6,inset:.4,pitch:3};
// The painter and the frames both come from this: a canvas exists only where its
// whole span lies on one gallery wall, so nothing is cut by a corner or an opening.
function museumPaintings(r) {
  const out=[],{w,inset,pitch}=MUSEUM_CANVAS,open=(x,y)=>r.grid[y]?.[x]==='.';
  const faces=new Map();
  for(let y=1;y<r.H-1;y++)for(let x=1;x<r.W-1;x++)if(open(x,y)&&museumWing(x+.5,y+.5)==='gallery')for(const [fx,fy]of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if(r.grid[y-fy]?.[x-fx]!=='#')continue;
    const line=fx?x+(fx<0?1:0):y+(fy<0?1:0),key=[fx,fy,line].join(),along=fx?y:x;
    if(!faces.has(key))faces.set(key,{fx,fy,line,cells:new Set()});faces.get(key).cells.add(along);
  }
  for(const q of faces.values())for(let k=0;k<20;k++) {
    const lo=k*pitch+inset,hi=lo+w;let whole=true;
    for(let c=Math.floor(lo);c<Math.ceil(hi);c++)if(!q.cells.has(c))whole=false;
    if(whole)out.push({...q,k,mid:lo+w/2,x:q.fx?q.line:lo+w/2,y:q.fx?lo+w/2:q.line});
  }
  return out;
}
function MUSEUM_PAINTING_FRAME(q) {
  const parts=[],{w,z0,z1}=MUSEUM_CANVAS,depth=.02,bar=.04;
  const gold=(i,t,L)=>{BG[i]=C(YEL,(2.4+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz))*museumLit());set(i,' ',0);return true;};
  const card=(i,t,L)=>{BG[i]=C(WHITE,(3.4+L*.25)*museumLit());set(i,' ',0);return true;};
  const add=(role,along,a,zlo,zhi,shade)=>{
    const p=q.fx?hotelLobbyRound(parts,role,depth,a,zlo,zhi,.004,shade):hotelLobbyRound(parts,role,a,depth,zlo,zhi,.004,shade);
    p.box.x=q.fx?q.fx*depth:along;p.box.y=q.fx?along:q.fy*depth;
  };
  add('frame',0,w/2+bar,z0-bar,z0+bar,gold);add('frame',0,w/2+bar,z1-bar,z1+bar,gold);
  for(const e of [-1,1])add('frame',e*w/2,bar,z0+bar,z1-bar,gold);
  add('plaque',0,.15,z0-.2,z0-.12,card);
  return {...ROOM_MODEL(q.x,q.y,hotelLobbyDraw(parts)),walk:true,radius:w/2+.1,museumFrame:{parts,face:q}};
}
// Seeded by its own wall line and bay. The old seed used the wall cell, which
// changed part way across a canvas and left a vertical seam in the picture.
function museumCanvas(i,u,z,k,line,lit) {
  const {inset}=MUSEUM_CANVAS,fu=u-k*MUSEUM_CANVAS.pitch-inset,seed=k*13+line*7;
  const n=noise(fu*(1+(seed&3)),z*(2+(seed>>2&3)),seed),n2=noise(fu*3+9,z*3,seed+1);
  const pal=[[BLUE,CYAN,WHITE],[RED,ORANGE,YEL],[GREEN,YEL,BRICK],[MAG,BLUE,CYAN],[BRICK,WARM,ORANGE]][seed%5];
  BG[i]=C(pal[Math.floor(n*2.99)],(2+n2*4)*lit);set(i,' ',0);return true;
}
function museumShellWall(i,su,uStep,z,d,mx,my,L) {
  // Choose the wing on the visible side of this wall, rather than the player's current section.
  const screenX=2*(i%cols+.5)/cols-1,rx=dx-dy*tf*screenX,ry=dy+dx*tf*screenX;
  const hx=px+rx*(d-.01),hy=py+ry*(d-.01),u=Math.abs(su),wing=museumWing(hx,hy),lit=museumLit();
  set(i,' ',0);
  if(wing==='egypt')return museumEgyptWall(i,u,z,d,L,lit);
  if(wing==='gallery'&&z>MUSEUM_CANVAS.z0&&z<MUSEUM_CANVAS.z1) {
    const k=Math.floor(u/MUSEUM_CANVAS.pitch),fu=u-k*MUSEUM_CANVAS.pitch-MUSEUM_CANVAS.inset;
    const line=Math.abs(fract(hx+.5)-.5)<Math.abs(fract(hy+.5)-.5)?Math.round(hx):-1-Math.round(hy);
    if(fu>0&&fu<MUSEUM_CANVAS.w&&room.museumCanvases?.has([line,k].join()))return museumCanvas(i,u,z,k,line,lit);
  }
  if(wing==='gems'){BG[i]=C(RED,(1.2+L*.1)*lit);return true;}
  if(my===9&&z>2.6&&z<3.1&&wallText(i,su,uStep,z,d,'THE GEM ROOM',13*Math.sign(su),2.85,.28,.4,C(YEL,13),C(GRAY,1)))return true;
  set(i,' ',0);
  BG[i]=C(WHITE,(2.8+L*.2-3*coveGroove(z,1,.02,d/projY)*(z<1.5?1:0))*lit);return true;
}
ROOM_FLOORS.museum=(i,f,wx,wy,r,x,L)=>{
  set(i,' ',0);
  if(room.burgled) {
    const beam=torchAt(wx,wy,0);
    BG[i]=beam>0?C(YEL,1.5+beam*6):C(GRAY,.25);return true;
  }
  const footprint=homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye),wing=museumWing(wx,wy);
  if(wing==='gallery')return homeFloorWood(i,wx,wy,L,footprint,2),true;
  if(wing==='gems'){BG[i]=C(RED,1+f*1.2);return true;}
  if(wing==='egypt'){BG[i]=C(WARM,1.7+L*.2-5*Math.max(coveGroove(wx,1.2,.008,footprint),coveGroove(wy,1.2,.008,footprint)));return true;}
  const joint=Math.max(coveGroove(wx,1,.004,footprint),coveGroove(wy,1,.004,footprint));
  // Chequers go to their average once a pixel covers most of a square.
  if(footprint>.6){BG[i]=C(GRAY,2+L*.2);return true;}
  BG[i]=(Math.floor(wx)+Math.floor(wy))&1?C(WHITE,2.6+L*.25-4*joint):C(GRAY,1.1+L*.1);return true;
};
ROOM_CEILS.museumPlaster=i=>{BG[i]=C(WHITE,3.2*museumLit());set(i,' ',0);};
const MUSEUM_BATTENS=[[3.5,3],[3.5,8],[3.5,13],[21.5,3],[21.5,8],[21.5,13],[9,12],[16,12],[9,16],[16,16],[10,4],[15,4]];
const MUSEUM_SHELL_PROPS=ROOM_DEFS.museum.props;
ROOM_DEFS.museum.props=r=>{
  r.hotelEntranceExterior=wordEntranceExterior(r,'MUSEUM');
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1);entry.museumEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  const paintings=museumPaintings(r);
  r.museumCanvases=new Set(paintings.map(q=>[q.fx?q.line:-1-q.line,q.k].join()));
  const props=[...MUSEUM_SHELL_PROPS(r),entry,...paintings.map(MUSEUM_PAINTING_FRAME)];
  // The room goes dark at night: lit fittings and pale trim would give the guards' rounds away.
  if(r.burgled)return props;
  const height=r.def.height||3;
  for(const [x,y]of MUSEUM_BATTENS){const o=CEILING_BATTEN(x,y,1.8,height);o.museumCeilingLight=o.ceilingBatten;delete o.ceilingBatten;props.push(o);}
  const layout={...r,def:{...r.def,tier:2,height,builtSkirting:true,builtCornices:true},props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]};
  const trim=[...homeSkirting({...layout,def:{...layout.def,tier:1}}),...homeCornices(layout)];
  for(const o of trim)for(const [a,b]of [['homeSkirting','museumSkirting'],['homeCornice','museumCornice']])if(o[a]){o[b]=o[a];delete o[a];}
  return [...props,...trim];
};
ROOM_DEFS.museum.doorWall=true;
ROOM_DEFS.museum.wall=(i,u,uStep,z,d,mx,my,L)=>hotelEntranceGlass(i,u,z,mx,my)||museumShellWall(i,u,uStep,z,d,mx,my,L);
ROOM_DEFS.museum.ceil='museumPlaster';
