// Authored once, after relocating the old city and before buckets/terrain/save loading.
function buildWildIslands() {
  for (const island of WILD_ISLANDS) {
    PIERS.push(island.dock);
    const [lx,ly]=island.landing;
    if(island.id!=='rock')benches.push({x:lx+1.5,y:ly+1.5,fx:-1,fy:0});
    // Sparse woods leave the coastline, landing and marked paths open.
    for(let gy=Math.floor(island.y-island.ry);gy<island.y+island.ry;gy+=2) for(let gx=Math.floor(island.x-island.rx);gx<island.x+island.rx;gx+=2) {
      const x=gx+(hash(gx,gy,1825)-.5)*1.3,y=gy+(hash(gx,gy,1826)-.5)*1.3;
      const density=.07+hash(Math.floor(x/12),Math.floor(y/12),1827)*.18;
      if(wildIslandEdge(x,y,island)<3.5||hash(gx,gy,1821)>density||island.id==='sand'||island.id==='rock')continue;
      if(Math.hypot(x-island.landing[0],y-island.landing[1])<7)continue;
      if(ISLAND_CABINS.some(c=>x>c.x0-1.5&&x<c.x1+1.5&&y>c.y0-1.5&&y<c.y1+2))continue;
      if(islandPathDistance(x,y,island)<1||ISLAND_SIGHTS.some(s=>near(x,y,s.x,s.y)<1.5))continue;
      const clearApproach=x>FERN_STRIP.x0-28&&x<FERN_STRIP.x1+28&&Math.abs(y-FERN_STRIP.y)<3.5;
      if(island.id==='fern'&&(clearApproach||trailDistance(x,y)<1.5||near(x,y,540,245)<6||near(x,y,627,191)<4))continue;
      trees.push({x,y,kind:hash(gx,gy,1822)>.3?'pine':'birch',s:.55+hash(gx,gy,1823)*.95,seed:hash(gx,gy,1824)});
    }
  }
  // A couple of regulars use the existing fishing and conversation systems.
  for(const [x,y,shirt]of [[474,395.94,BLUE],[694,110.94,GREEN]])
    ANGLERS.push({x,y,a:Math.PI/2,cast:.6,seed:ANGLERS.length,shirt});
  // A fixed native place identity lets house contents survive future layout changes.
  const house=FERN_HOUSE,sh={word:'FERN HOUSE',kind:SHOP_APTS,wilderness:true,islandCabin:'fern-house',neon:GREEN,seed:.71,hours:[0,24],glyphs:'[]='};
  const cells=[];
  for(let y=house.y0;y<house.y1;y++)for(let x=house.x0;x<house.x1;x++) {
    const k=idx(x,y);cells.push(k);map[k]=ISLAND_CABINS[0].h;SHOP[k]=sh;STY[k]=9;SEED[k]=.71;
  }
  const place={id:'fern-house',shop:sh,cell:cells[0],cells,legacyCells:[],x0:house.x0,y0:house.y0,x1:house.x1,y1:house.y1};
  CITY_PLACES.set(place.id,place);cityPlaceByShop.set(sh,place);
  // (its stones and logs are island-sights.js's ring; it burns at night, or while you cook over it)
  const fire={x:WILD_ISLANDS[0].landing[0]+4,y:238,on:'fire',nightOnly:true,ring:true};
  GRILLS.push(fire);FIRES.push(fire);solidBox(fire.x,fire.y,true,.07,.07,0,.11,'campfire',0);
  solids[solids.length-1].spot=fire;
  // One unlocked fishing shelter and one private house, each with a real front door.
  for(const cabin of ISLAND_CABINS.slice(1)) {
    const shop={word:cabin.name.toUpperCase(),kind:cabin.room?SHOP_LIT:SHOP_SHUT,islandCabin:cabin.id,wilderness:true,neon:GREEN,hours:[0,24],glyphs:'[]='};
    for(let y=cabin.y0;y<cabin.y1;y++)for(let x=cabin.x0;x<cabin.x1;x++) {
      const k=idx(x,y);map[k]=cabin.h;STY[k]=9;SEED[k]=.6;SHOP[k]=shop;
    }
  }
  for(const cabin of ISLAND_CABINS) {
    if(cabin.id==='cabin-cove'){ISLAND_ROOFS.push(...coveRoofParts(cabin));continue;}
    const hl=(cabin.x1-cabin.x0)/2+.09,hw=(cabin.y1-cabin.y0)/2+.12;
    ISLAND_ROOFS.push({x:(cabin.x0+cabin.x1)/2,y:(cabin.y0+cabin.y1)/2,c:1,s:0,hl,hw,z0:cabin.h-.015,z1:cabin.h+cabin.pitch,
      planes:landmarkPlanes(hl,hw,cabin.h-.015,cabin.h+cabin.pitch,'gable'),cabin});
  }
  ISLAND_ROOFS.push({x:541.25,y:245.1,c:1,s:0,hl:.075,hw:.08,z0:.42,z1:.74,
    planes:landmarkPlanes(.075,.08,.42,.74,null),part:'chimney',cabin:ISLAND_CABINS[0]});
}

function islandCabinAtDoor() {
  if(!worldReady||mode!=='walk')return null;
  return ISLAND_CABINS.find(cabin=>cabin.id!=='fern-house'&&py>=cabin.y1&&near(px,py,...cabin.door)<.5)||null;
}
function nearIslandLogbook() {
  return mode==='room'&&room.kind==='islandshelter'&&Math.hypot(px-4,py-4.3)<1.1;
}
function islandBuildingPrompt() {
  if(nearIslandLogbook())return 'E: read the visitors\' log';
  if(mode!=='walk')return '';
  const sight=ISLAND_SIGHTS.find(s=>near(px,py,s.x,s.y)<.55);
  if(sight)return `E: read ${sight.name}`;
  const cabin=islandCabinAtDoor();
  if(cabin)return cabin.room?'E: enter the fishing shelter':'E: knock on the door';
  const [lx,ly]=WILD_ISLANDS[0].landing;
  if(near(px,py,lx+1,ly+.7)<.45)return 'E: island tackle box';
  if(near(px,py,...FERN_HOUSE.door)<.55||near(px,py,...FERN_HOUSE.terrace)<.8)
    return homeAt(SHOP[cityPlaceCell('fern-house')])?'E: enter Fern House':`E: Fern House for sale (${fmt$(ITEMS.home_island.price)})`;
  return '';
}
let islandKnockT=-9;
function islandBuildingUse() {
  if(nearIslandLogbook()) {
    const page=room.logPage||0;
    say(ISLAND_LOG_ENTRIES[page%ISLAND_LOG_ENTRIES.length],6);room.logPage=page+1;
    return true;
  }
  if(mode!=='walk')return false;
  const sight=ISLAND_SIGHTS.find(s=>near(px,py,s.x,s.y)<.55);
  if(sight){say(sight.text,7);return true;}
  const cabin=islandCabinAtDoor();
  if(cabin) {
    if(cabin.room) {
      // Remember the actual island door even if the player saves immediately after entering.
      streetSpot={x:cabin.door[0],y:cabin.door[1],a:-Math.PI/2};
      enterRoom(cabin.room,{word:cabin.name.toUpperCase(),ret:[...cabin.door,-Math.PI/2],line:''},ROOM_DEFS[cabin.room].entry);
      say('The door is unlocked. Dry benches, old fishing gear and a visitors\' log. Leave it as you found it.',4);
    } else if(T-islandKnockT>=1.2) {
      islandKnockT=T;if(actx)sfxKnock();
      say('You knock on the door. No answer. Just the wind in the trees.',3);
    }
    return true;
  }
  const [lx,ly]=WILD_ISLANDS[0].landing;
  if(near(px,py,lx+1,ly+.7)<.45){openShop('Island tackle box',['rod','carbonrod','water','sandwich']);return true;}
  const atDoor=near(px,py,...FERN_HOUSE.door)<.55,atTerrace=near(px,py,...FERN_HOUSE.terrace)<.8;
  if(!atDoor&&!atTerrace)return false;
  const cell=cityPlaceCell('fern-house'),home=homeAt(SHOP[cell]);
  if(!home) { openShop('Fern House · sea-view retreat',['home_island']);return true; }
  enterRoom('islandhome',{word:'FERN HOUSE',cell:[cell%N,Math.floor(cell/N)],ret:[...FERN_HOUSE.door,-Math.PI/2]},atTerrace?[1.5,16.5,0]:ROOM_DEFS.islandhome.entry);
  say('Fern House. The sea below the windows, the workshop down the hall.',3);
  return true;
}

const ISLAND_LOG_ENTRIES=[
  'VISITORS\' LOG: "Shelter is open to anyone caught in the weather. Please shut the door and take your rubbish home."',
  'A pencilled note: "Good fishing off the western jetty. Leave your boat alongside; the benches are for everyone."',
  'The last page: "Went over to Fern. The waterfall trail was worth the crossing. Left before sunset. -- M."',
];
ROOM_DEFS.islandshelter={
  grid:boxRoom(12,10),entry:[6,8.3,-Math.PI/2],height:2.7,light:.75,floor:'islandwood',ceil:'islandwood',wall:islandShelterWall,doorWall:true,
  props:()=>[
    BENCHP(1.7,6,1,0),BENCHP(10.2,6,-1,0),
    ...tableBox(4,3.4,1.15,.55),
    BX(4,3.4,.28,.2,.78,.81,(i,t,L)=>{
      let mark='=';
      if(HIT.face===5) {
        mark=' ';
        if(Math.abs(HIT.u)<.015)mark='|';
        else if(fract(HIT.v*28)<.2)mark='-';
      }
      BG[i]=C(WHITE,3+L*.25);set(i,mark,C(BRICK,L));return true;
    }),
    ROOM_MODEL(8.6,1.6,(vx,vy)=>{
      drawBox(boxAt(vx,vy,1,0,1,.22,.1,.3),solid(BRICK,{top:'='}));
      for(let n=0;n<4;n++) {
        const x=vx-.72+n*.48;
        rod(x,vy,.3,x+.12,vy-.12,2.25,.013,GRAY,1.2);
        drum(x,vy+.025,.055,.48,.58,CHROME);
      }
      drawBox(boxAt(vx,vy,1,0,1,.08,1.1,1.18),solid(BRICK));
    },[1,.3,2.25]),
    ROPE_COIL(2,1.7),
    BX(9.8,3.4,.42,.3,0,.46,solid(GREEN,{panel:.3,top:'='})),
    BX(6,5,.015,.015,2.3,2.7,solid(GRAY)),
    BX(6,5,.18,.18,2.1,2.3,(i,t,L)=>{BG[i]=C(WARM,7);set(i,'=',C(YEL,15));return true;}),
  ],
};
ROOM_FLOORS.islandwood=(i,f,wx,wy,r,x,L)=>{
  const row=Math.floor(wy*3),seam=fract(wy*3)<.065||fract(wx/2+(row&1)*.5)<.025;
  BG[i]=C(BRICK,1.8+f*1.7+(row&1)*.2);
  set(i,seam?'=':' ',C(WARM,L*.7));
};
ROOM_CEILS.islandwood=(i,r,x,wx,wy)=>{
  const beam=fract(wy/2)<.07;
  BG[i]=C(BRICK,beam?1.4:2.6);
  let mark=' ';
  if(beam)mark='=';
  else if(fract(wx*3)<.035)mark='|';
  set(i,mark,C(WARM,beam?3:2));
};
function islandShelterWall(i,u,uStep,z,d,mx,my,L) {
  if(room.grid[my]?.[mx]==='D') {
    BG[i]=C(GREEN,1.5+L*.2);
    if(wallText(i,u,uStep,z,d,'EXIT',6,2.2,.13,.2,C(STONE,L)))return true;
    set(i,fract(u)<.055?'|':Math.abs(z-1)<.04?'=':' ',C(STONE,L*.75));return true;
  }
  const side=mx===0||mx===room.W-1,window=side&&Math.abs(Math.abs(u)-4.5)<1.25&&z>1&&z<2.1;
  if(window) {
    const frame=Math.abs(Math.abs(u)-4.5)>1.18||z<1.07||z>2.03||Math.abs(Math.abs(u)-4.5)<.035;
    BG[i]=C(frame?STONE:CYAN,frame?2+L*.2:1.5+day*2.5);
    set(i,frame?'|':' ',C(STONE,L));return true;
  }
  BG[i]=C(BRICK,2.4+L*.25);
  let mark=' ';
  if(fract(u*4)<.045)mark='|';
  else if(z<.12||Math.abs(z-2.5)<.035)mark='=';
  set(i,mark,C(WARM,L*.65));return true;
}

// An independently drawn L-shaped plan: bedroom, kitchen/dining, workshop wing.
const FERN_ROOM_GRID=boxRoom(24,24,Object.fromEntries([
  ...Array.from({length:10},(_,y)=>[`9,${y+1}`,'#']),
  ...Array.from({length:22},(_,x)=>[`${x+1},10`,'#']),
  ['5,10','.'],['6,10','.'],['15,10','.'],['16,10','.'],
  ...Array.from({length:10},(_,y)=>[`13,${y+12}`,'#']),
  ...Array.from({length:4},(_,y)=>[`19,${y+1}`,'W']),
  ...Array.from({length:4},(_,x)=>[`${x+19},4`,'W']),['20,4','.'],
  ['13,16','.'],['13,17','.'],['0,16','D'],
]),true);
ROOM_DEFS.islandhome={
  grid:FERN_ROOM_GRID,entry:[12,22.3,-Math.PI/2],height:3.4,light:.9,floor:'wood',ceil:'home',wall:fernRoomWall,tier:1,
  wc:{x0:20,y0:1,x1:23,y1:4,sign:[19,3,3.5]},
  home:{shelf:[2,13],pet:[2,20],bed:[4,4],closet:[7,3],sofa:[5,17],tv:[5,14],fridge:[17.5,2],dining:[16,6]},
  spots:{bed:[4,5.3],closet:[7,3],shelf:[2,14],pet:[2,20],fridge:[16.5,2],stove:[19,5.5],workshop:[17,13],tv:[5,15],terrace:[1.4,16.5]},
  windows:[{face:'west',center:5,half:2},{face:'west',center:13.7,half:1.4},{face:'east',center:5,half:2},{face:'north',center:15,half:3}],
  lamps:[[4,5],[16,6],[5,17],[18,17]],
  props:r=>[
    BX(4,3.8,1.3,1,0,.55,solid(GREEN,{top:'~'})),BX(4,2.8,1.4,.08,0,1.2,solid(BRICK)),
    BX(7,2.1,.8,.3,0,2.2,solid(BRICK,{panel:.5})),BX(2,13,.7,.2,0,1.05,solid(BRICK,{top:'='})),
    BX(17.5,2,.4,.4,0,1.7,solid(WHITE)),BX(20,5.5,1.2,.4,0,.94,stoveShade(1,.55),0,1),
    ...toilet(21.5,2,1,porcelain),washbasin(20.6,1.5,0,1),
    ...tableBox(15,6,1.4,.65),...homeChair(15,7.2,0,-1,GREEN),...homeChair(15,4.8,0,1,GREEN),
    ...couch(5,17,1.8,0,-1,GREEN),...tableBox(5,15.4,.9,.4),
    BX(5,13.5,.8,.2,0,.6,solid(BRICK)),TELEVISION(5,13.5,r),
    BX(17,12,.5,.3,0,1.1,solid(BRICK,{panel:.3,top:'='})),
    POT_PLANT(10.8,12,1.5),POT_PLANT(21,8,1.4),
    ...[[4,5],[16,6],[5,17],[18,17]].map(([x,y])=>BX(x,y,.22,.22,2.8,2.95,(i,t,L)=>{BG[i]=C(WARM,7);set(i,'=',C(YEL,15));return true;})),
  ],
};

function fernRoomWall(i,u,uStep,z,d,mx,my,L) {
  homeWall(i,u,uStep,z,d,mx,my,L);
  if(roomAt(mx,my)==='W')return true;
  if(z<.8){BG[i]=C(BRICK,1.6+L*.2);set(i,Math.abs(z-.76)<.035?'=':fract(u*3)<.045?'|':' ',C(WARM,L*.6));}
  return true;
}
