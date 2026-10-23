// Hotel rooms have fitted plans and real amenities, with clear routes from the door.
function hotelRoomPlan(tier){
 const w=tier===2?18:tier===1?13:10,h=tier===2?14:tier===1?12:10,bath={x0:w-4,x1:w-1,y0:1,y1:6,sign:[w-5,6,w-4.5]},extra={};
 for(let y=1;y<=6;y++)extra[(w-5)+','+y]=tier===0&&(y===4||y===5)?'.':'W';
 for(let x=w-5;x<w-1;x++)if(tier===0||x!==w-3)extra[x+',6']='W';
 if(tier===0)bath.sign=[w-5,3,3.5];
 if(tier===2)for(let y=1;y<10;y++)if(y!==7&&y!==8)extra['8,'+y]='#';
 return {w,h,bath,grid:boxRoom(w,h,extra),entry:[w/2,h-1.6,-Math.PI/2]};
}
function hotelTelevision(x,y,angle=0){return [ROOM_MODEL(x,y,(vx,vy)=>TELEVISION(x,y,room,1.1,angle).draw(vx,vy)),FURNITURE_STORAGE(x,y,.99,.3,.61*1.1,angle)];}
function hotelLandscape(x,y){return BX(x,y,.85,.025,1.45,2.35,(i,t,L)=>{
 const u=HIT.u,z=HIT.w,frame=Math.abs(u)>.76||z<1.53||z>2.27;
 const hill=1.88+.12*Math.sin(u*5)+.05*Math.cos(u*11);
 BG[i]=C(frame?YEL:z<hill?GREEN:BLUE,frame?3:4);return set(i,frame?(Math.abs(u)>.76?'|':'='):z<1.7?'~':' ',C(frame?YEL:z<1.7?CYAN:GREEN,Math.max(5,L*.7))),true;
});}
function hotelDefinition(tier){
 const plan=hotelRoomPlan(tier),{w,h,bath}=plan,tv=[tier===2?11:tier?3.5:2.5,tier?h-5.3:h-1.31],tvAngle=tier?0:Math.PI,sofa=[tv[0],tier?h-2.9:6.4],stove=tier?[w-1.38,h-4+(tier===1?.3:0)]:null;
 return {grid:plan.grid,entry:plan.entry,light:.85+tier*.05,height:tier===2?3.6:3,floor:tier===2?'royal':'wood',ceil:'pendant',wc:bath,hotelAmenities:{tv,tvAngle,tvApproach:[tv[0]-Math.sin(tvAngle)*1.2,tv[1]+Math.cos(tvAngle)*1.2],sofa,stove},tier,
 wall:(...args)=>{if(hotelRoomWall(...args))return true;const [i,u,,z,,,,L]=args;BG[i]=C(z<.8?BRICK:WHITE,z<.8?2+L*.1:4+L*.1);return set(i,z<.12||Math.abs(z-.8)<.025||z>(tier===2?3.6:3)-.16?'=':' ',C(YEL,L*.65)),true;},
 props:r=>{
 const bed=tier===2?[3.9,3.6]:[2.6,3.2],bedWidth=tier===2?1.3:1.14,standWidth=tier===2?.3:.22,standOffset=bedWidth+standWidth+.01;
 const p=[...FURNITURE_BED(...bed,bedWidth,1.05,tier===2?GREEN:BLUE,0,.58,1.3),
 ...[-1,1].flatMap(side=>[FURNITURE_STORAGE(bed[0]+side*standOffset,bed[1]-.65,standWidth,.35,.65),ROOM_MODEL(bed[0]+side*standOffset,bed[1]-.65,(vx,vy)=>{rod(vx,vy,.65,vx,vy,1,.025,YEL);drawBox(boxAt(vx,vy,1,0,.16,.16,.9,1.1),solid(WARM,{bright:5}));})]),
 ...couch(sofa[0],sofa[1],tier===2?1.7:1.05,0,tier?-1:1,tier===2?GREEN:BLUE),...hotelTelevision(...tv,tvAngle),hotelLandscape(bed[0],1.03),
 ...toilet(w-2,1.42,-1,porcelain),washbasin(w-3.65,1.4,0,1),
 ...(tier?[BATHTUB(w-1.5,4.1)]:BATHROOM_SHOWER(w-1.6,5.1,.6)),
 POT_PLANT(tier===2?9.5:tier?1.5:8.5,h-1.5,1.4)];
 if(tier)p.push(FITTED_KITCHEN(...stove,tier===1?1.3:1.7,.38,Math.PI/2,tier===2?WHITE:BRICK),HOME_FRIDGE(w-1.4,h-1.7,{angle:Math.PI/2,height:1.7}),...tableBox(tier===2?13.2:8,h-3.1,tier===2?1.1:.65,.55),...homeChair(tier===2?13.2:8,h-1.9,0,-1));
 if(tier)p.push(ROOM_MODEL(sofa[0],sofa[1]-1.25,(vx,vy)=>{
   for(const side of [-1,1])rod(vx+side*.3,vy,.05,vx+side*.3,vy,.42,.035,YEL);
   drum(vx,vy,.52,.4,.46,solid(tier===2?GREEN:BRICK,{bright:2,top:'~'}));
 },[.52,.52,.46]));
 if(tier===2)for(const side of [-1,1])p.push(BX(w/2+side*2.9,1.06,.19,.05,.12,3.25,(i,t,L)=>{BG[i]=C(GREEN,2+L*.15);return set(i,fract(HIT.u*35)<.15?'|':' ',C(YEL,L*.7)),true;}));
 if(tier===2)p.push(...tableBox(10.9,3.6,1.2,.55),...homeChair(10.9,4.8,0,-1),POT_PLANT(9.7,1.5,1.9),...couch(4,10,1.5,1,0,STONE),...tableBox(6.3,10,.6,.8));
 return p;
 }};
}
ROOM_DEFS.motelRoom=hotelDefinition(0);ROOM_DEFS.hotelroom=hotelDefinition(1);ROOM_DEFS.hotelSuite=hotelDefinition(2);
const GRAND_LOBBY_PROPS=ROOM_DEFS.grandhotel.props;
ROOM_DEFS.grandhotel.grid=boxRoom(24,17);ROOM_DEFS.grandhotel.height=5.2;
ROOM_DEFS.grandhotel.props=r=>[...GRAND_LOBBY_PROPS(r).filter(p=>!(p.box&&p.box.z1===.55&&p.box.z0===0&&p.box.hl===1.1)),
 ...couch(4.2,9,1.55,1,0,BRICK),...couch(19.7,9,1.55,-1,0,GREEN),...tableBox(6.3,9,.6,.9),...tableBox(17.5,9,.6,.9),
 ...[3,20.5].flatMap(x=>[POT_PLANT(x,13.5,2.4),ROOM_MODEL(x,6.6,(vx,vy)=>{drum(vx,vy,.24,0,4.8,solid(STONE,{bright:2}));drawBox(boxAt(vx,vy,1,0,.34,.34,4.6,4.85),solid(YEL));})]),
 ROOM_MODEL(12,8,(vx,vy)=>{for(const side of [-1,1]){rod(vx,vy,5,vx+side*.8,vy,4.2,.025,YEL);dot(vx+side*.8,vy,4.15,.14,solid(WARM,{bright:5}));}rod(vx,vy,5,vx,vy,3.9,.025,YEL);dot(vx,vy,3.85,.19,solid(WARM,{bright:5}));})];
function hotelAmenityPrompt(){
 if(mode!=='room'||room.kind!=='hotelroom')return '';
 const spots=room.def.hotelAmenities;if(!spots)return '';
 if(near(px,py,...spots.tv)<1.65)return room.tv?'E: switch off the TV':'E: watch TV';
 if(spots.stove&&near(px,py,...spots.stove)<1.8)return 'E: cook at the kitchen stove';
 return '';
}
function hotelAmenityUse(){
 if(mode!=='room'||room.kind!=='hotelroom')return false;
 const spots=room.def.hotelAmenities;if(!spots)return false;
 if(near(px,py,...spots.tv)<1.65){room.tv=!room.tv;say(room.tv?'You turn on the television.':'You turn off the television.',2);return true;}
 if(spots.stove&&near(px,py,...spots.stove)<1.8){room.fridge||=[];openCooking('stove',room.fridge);return true;}
 return false;
}
// Warm ceilings and parquet stay quiet at a distance; rugs define the sitting areas.
ROOM_CEILS.hotel=(i,r,x,wx,wy)=>{
 const grand=room.def.tier===2||room.kind==='grandhotel',edge=Math.min(wx-1,wy-1,room.W-1-wx,room.H-1-wy),lamp=Math.hypot(mod(wx,4)-2,mod(wy,4)-2)<.16;
 BG[i]=C(WHITE,grand?5:4);return set(i,lamp?'o':edge<.16?'=':' ',C(lamp?WARM:YEL,lamp?15:8));
};
ROOM_FLOORS.hotel=(i,f,wx,wy,r,x,L)=>{
 const tier=room.def.tier,spot=room.def.hotelAmenities?.tv,sofa=room.def.hotelAmenities?.sofa||[room.W/2,9];
 if(Math.abs(wx-sofa[0])<(tier===2?2.6:1.65)&&wy>sofa[1]-2.1&&wy<sofa[1]+.6){
  const border=Math.abs(wx-sofa[0])>(tier===2?2.4:1.5)||wy<sofa[1]-1.95||wy>sofa[1]+.45;
  BG[i]=C(tier===2?GREEN:BLUE,2+f*2);return set(i,border?'=':hash(Math.floor(wx*4),Math.floor(wy*4),3)>.96?'+':' ',C(WARM,L));
 }
 const u=tier===2?wx+wy:wx,v=tier===2?wx-wy:wy;
 BG[i]=C(BRICK,2+f*2+(Math.floor(v*2)&1)*.5);
 return set(i,fract(v*2)<.04?tier===2?'/':'=':fract(u/1.8+(Math.floor(v*2)&1)*.5)<.025?'|':' ',C(WARM,L*.7));
};
for(const def of [ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite]){def.floor='hotel';def.ceil='hotel';}
ROOM_DEFS.grandhotel.ceil='hotel';
