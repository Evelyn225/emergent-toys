// Self storage. Every exposed face of a locker cell is one whole shutter on a
// 1m bay, so the old 1.2m bays no longer cut doors in half at block corners. The
// corrugation filters with distance; handles and padlocks are real and cached.
const STORAGE_LOCK={z:.22,handle:.14,proud:.03};
function storageShutterFaces(r) {
  const faces=[];
  for(let y=0;y<r.H;y++)for(let x=0;x<r.W;x++)if(r.grid[y][x]==='L')for(const [fx,fy]of [[1,0],[-1,0],[0,1],[0,-1]])
    if(r.grid[y+fy]?.[x+fx]==='.')faces.push({x:x+.5+fx*.5,y:y+.5+fy*.5,fx,fy});
  return faces;
}
function STORAGE_DOOR_LOCK(q) {
  const parts=[],{z,handle,proud}=STORAGE_LOCK,{x,y,fx,fy}=q,steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY),across=[-fy,fx];
  const end=(s,o)=>[across[0]*s*handle+fx*o,across[1]*s*handle+fy*o];
  for(const s of [-1,1]){const [a,b]=end(s,0),[c,d]=end(s,proud);hotelLobbyTube(parts,'handle-post',a,b,z,c,d,z,.006,steel);}
  const [a,b]=end(-1,proud),[c,d]=end(1,proud);hotelLobbyTube(parts,'handle',a,b,z,c,d,z,.008,steel);
  const lock=hotelLobbyRound(parts,'padlock',fy?.022:.008,fy?.008:.022,z-.075,z-.03,.003,(i,t,L)=>{BG[i]=C(YEL,3+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  lock.box.x=across[0]*.16+fx*.012;lock.box.y=across[1]*.16+fy*.012;
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.2,storageLock:{parts,face:q}};
}
function storageFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,4,.008,footprint),coveGroove(wy,4,.008,footprint));
  BG[i]=C(GRAY,1.9+L*.22-6*joint);set(i,' ',0);return true;
}
ROOM_FLOORS.storageConcrete=(i,f,wx,wy,r,x,L)=>storageFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
function storageWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY);set(i,' ',0);
  if(roomAt(mx+.5,my+.5)!=='L') { // the outer walls: painted block
    const course=coveGroove(z,.2,.003,footprint);
    BG[i]=z<1?C(GRAY,2.4+L*.2-4*course):C(WHITE,2.8+L*.26-4*course);return true;
  }
  const bay=u-Math.floor(u),post=coveGroove(bay,1,.05,footprint);
  if(post>.5){BG[i]=C(GRAY,1.4+L*.2);return true;}
  if(z>2.05) { // the unit number
    const n=String(100+(hash(Math.floor(u),mx*31+my,5)*800|0));
    BG[i]=C(GRAY,2);
    return wallText(i,u,uStep,z,d,n,Math.floor(u)+.5,2.2,.12,.16,C(WHITE,13),C(GRAY,2))||(set(i,' ',0),true);
  }
  // The ribs are wide and go early: any finer and they beat against the character rows.
  const rib=d/projY>.05?0:coveGroove(z,.2,.025,d/projY);
  BG[i]=C(ORANGE,2.3+L*.2-2.5*rib);return true;
}
const STORAGE_SHELL_PROPS=ROOM_DEFS.storage.props;
ROOM_DEFS.storage.props=r=>{
  r.hotelEntranceExterior=wordEntranceExterior(r,'STORAGE');
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1);entry.storageEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  const props=[...STORAGE_SHELL_PROPS(r),entry,wallTitleBoard(r.W/2,1.025,1.4,r.word||'STORAGE','ONE UNIT EVERY BRANCH',C(ORANGE,14),2.2,'storageWallBoard'),...storageShutterFaces(r).map(STORAGE_DOOR_LOCK)];
  const height=r.def.height||3;
  for(const x of [3,7,11])for(const y of [1.5,4.5,7.8]){const o=CEILING_BATTEN(x,y,1.8,height);o.storageCeilingLight=o.ceilingBatten;delete o.ceilingBatten;props.push(o);}
  const base=homeSkirting({...r,def:{...r.def,tier:1,height,builtSkirting:true},props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]});
  for(const o of base){o.storageSkirting=o.homeSkirting;delete o.homeSkirting;}
  return [...props,...base];
};
ROOM_DEFS.storage.doorWall=true;
ROOM_DEFS.storage.wall=(i,u,uStep,z,d,mx,my,L)=>hotelEntranceGlass(i,u,z,mx,my)||storageWallFinish(i,u,uStep,z,d,mx,my,L);
ROOM_DEFS.storage.floor='storageConcrete';
ROOM_DEFS.storage.ceil='civicPlaster';
