// The gym's shell: rubber mats on the native floor, plain plaster overhead with
// fitted battens, and framed mirrors in place of the painted glyph fields. The
// glass is a calm tinted surface, it doesn't reflect the room. The fixtures own
// their joints, so the wall painter and the mirror frames share one layout.
const GYM_MIRROR={y0:1.3,y1:9.7,panels:6,z0:.35,z1:2.15},GYM_BAND={z0:2.22,z1:2.30};
const gymMirrorPitch=()=>(GYM_MIRROR.y1-GYM_MIRROR.y0)/GYM_MIRROR.panels;
function gymFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,1,.005,footprint),coveGroove(wy,1,.005,footprint));
  BG[i]=C(GRAY,1.5+L*.14-5*joint);set(i,' ',0);return true;
}
ROOM_FLOORS.gymRubber=(i,f,wx,wy,r,x,L)=>gymFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
ROOM_CEILS.civicPlaster=i=>{BG[i]=C(WHITE,3+room.def.light*.4);set(i,' ',0);};
function gymWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY);
  if((mx===0||mx===room.W-1)&&my>0&&my<room.H-1&&z>GYM_MIRROR.z0&&z<GYM_MIRROR.z1) {
    const y=Math.abs(u);
    if(y>GYM_MIRROR.y0&&y<GYM_MIRROR.y1){BG[i]=C(CYAN,1.8+L*.05);set(i,' ',0);return true;}
  }
  const band=clamp((Math.min(z+footprint/2,GYM_BAND.z1)-Math.max(z-footprint/2,GYM_BAND.z0))/Math.max(footprint,.001),0,1);
  if(band>.5)BG[i]=C(ORANGE,2.2+L*.3);else BG[i]=C(WHITE,3+L*.28);
  set(i,' ',0);return true;
}
// Aluminium rails along the top and bottom of each mirror run, and a flat bar
// over every panel joint, ending in the rails.
function GYM_MIRROR_FRAME(x,normal) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY),{y0,y1,panels,z0,z1}=GYM_MIRROR,mid=(y0+y1)/2;
  const add=(role,y,hw,a,b)=>{const p=hotelLobbyRound(parts,role,.012,hw,a,b,.004,metal);p.box.x=normal*.012;p.box.y=y;};
  for(const [a,b]of [[z0-.03,z0],[z1,z1+.03]])add('rail',0,(y1-y0)/2+.03,a,b);
  for(const e of [0,panels])add('end',y0+e*gymMirrorPitch()-mid,.03,z0,z1);
  for(let k=1;k<panels;k++)add('joint',y0+k*gymMirrorPitch()-mid,.012,z0,z1);
  return {...ROOM_MODEL(x,mid,hotelLobbyDraw(parts)),walk:true,radius:(y1-y0)/2+.05,gymMirrorFrame:{parts,normal}};
}
// A mounted board, so a room's name and line stop painting straight on its wall.
function wallTitleBoard(x,y,hl,title,subtitle,ink,z0,marker) {
  // Each line as wide as the board allows, as tall as a letter that wide can usefully be.
  const width=2*hl*.94,fit=(text,band)=>Math.min(width/text.length,band*1.5),titleBand=.36,subBand=.24;
  const parts=[],board=(i,t,L)=>{
    BG[i]=C(GRAY,.7+L*.07);
    if(HIT.face===3&&(hotelFittingText(i,HIT.u,HIT.w,t,title,0,z0+.47,fit(title,titleBand),titleBand,ink,BG[i])||hotelFittingText(i,HIT.u,HIT.w,t,subtitle,0,z0+.15,fit(subtitle,subBand),subBand,C(WHITE,12),BG[i])))return true;
    set(i,' ',0);return true;
  };
  hotelLobbyRound(parts,'board',hl,.025,z0,z0+.68,.012,board);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:hl+.02,[marker]:{parts}};
}
// Rooms can lack their building's cell in old saves: use the nearest one by name.
function wordEntranceExterior(r,word) {
  if(r.cell&&SHOP[idx(...r.cell)]?.word===word&&map[idx(...r.cell)]>1)return hotelEntranceExterior(r);
  const ret=r.ret||[px,py];let cell=null,best=Infinity;
  for(let k=0;k<SHOP.length;k++)if(SHOP[k]?.word===word&&map[k]>1){const d=near(ret[0],ret[1],k%N+.5,(k/N|0)+.5);if(d<best){best=d;cell=[k%N,k/N|0];}}
  return hotelEntranceExterior(cell?{...r,cell}:r);
}
const GYM_SHELL_PROPS=ROOM_DEFS.gym.props;
ROOM_DEFS.gym.props=r=>{
  r.hotelEntranceExterior=wordEntranceExterior(r,'GYM');
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1);entry.gymEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  const props=[...GYM_SHELL_PROPS(r),entry,GYM_MIRROR_FRAME(1,1),GYM_MIRROR_FRAME(r.W-1,-1),wallTitleBoard(r.W/2,1.025,1.5,'GYM','NO PAIN NO GAIN',C(ORANGE,14),2.26,'gymWallBoard')];
  const height=r.def.height||3;
  for(const x of [3,8,13])for(const y of [2.8,7.6]){
    const o=CEILING_BATTEN(x,y,1.8,height);o.gymCeilingLight=o.ceilingBatten;delete o.ceilingBatten;props.push(o);
  }
  const base=homeSkirting({...r,grid:r.grid,def:{...r.def,tier:1,height,builtSkirting:true},props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]});
  for(const o of base){o.gymSkirting=o.homeSkirting;delete o.homeSkirting;}
  return [...props,...base];
};
ROOM_DEFS.gym.sign=false;
ROOM_DEFS.gym.doorWall=true;
ROOM_DEFS.gym.wall=(i,u,uStep,z,d,mx,my,L)=>hotelEntranceGlass(i,u,z,mx,my)||gymWallFinish(i,u,uStep,z,d,mx,my,L);
ROOM_DEFS.gym.footstepFloor=ROOM_DEFS.gym.floor;
ROOM_DEFS.gym.floor='gymRubber';
ROOM_DEFS.gym.ceil='civicPlaster';
