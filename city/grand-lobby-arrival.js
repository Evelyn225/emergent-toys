// A quiet arrival group in the Grand's otherwise empty lower lobby. Profiles,
// draw bounds and contact heights prepare once per room, not per frame.
const GRAND_ARRIVAL={x:12,y:10.6,radius:.85,top:.88,trolleyX:17.8,trolleyY:13.4};
function grandArrivalMaterial(base,lift=2.5){return(i,t,L)=>{BG[i]=C(base,lift+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};}
function GRAND_ARRIVAL_TABLE(){
 const S=GRAND_ARRIVAL,parts=[],stone=grandArrivalMaterial(STONE),green=grandArrivalMaterial(GREEN,1.8),brass=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
 hotelLobbyTurned(parts,'plinth',0,0,[[0,0],[0,.37],[.045,.37],[.09,.33],[.12,.26],[.12,0]],green);
 hotelLobbyTurned(parts,'pedestal',0,0,[[.12,0],[.12,.26],[.18,.19],[.65,.14],[.76,.25],[.80,.32],[.80,0]],stone);
 hotelLobbyTurned(parts,'rim',0,0,[[.80,0],[.80,.82],[.82,S.radius],[S.top,S.radius],[S.top,.79],[.86,.79],[.86,0]],brass);
 hotelLobbyTurned(parts,'inset',0,0,[[.86,0],[.86,.789],[S.top,.789],[S.top,0]],stone);
 const ceramic=grandArrivalMaterial(GREEN,2.3);
 hotelLobbyTurned(parts,'vase',0,0,[[S.top,0],[S.top,.14],[.91,.17],[1.08,.23],[1.22,.15],[1.28,.15],[1.30,.14],[1.30,.115],[1.20,.115],[1.08,.19],[.94,.13],[.94,0]],ceramic);
 const leaf=grandArrivalMaterial(GREEN,2),cream=grandArrivalMaterial(WHITE,4),pink=grandArrivalMaterial(MAG,3.5);
 for(let k=0;k<9;k++){
  const angle=k*TAU/9,c=Math.cos(angle),s=Math.sin(angle),spread=k===8?.02:.27+(k%2)*.12,z=1.68+(k%3)*.12;
  const x=c*spread,y=s*spread;
  hotelLobbyTube(parts,'stem',c*.035,s*.035,1.08,x,y,z,.008,leaf);
  const b=boxAt(c*spread*.52,s*spread*.52,c,s,.13,.035,1.34,1.45),p={role:'leaf',box:b,view:{...b},shade:leaf,ray:homeRayEllipsoid};parts.push(p);
  for(let j=0;j<3;j++){
   const a=angle+j*TAU/3,b=boxAt(x+Math.cos(a)*.045,y+Math.sin(a)*.045,Math.cos(a),Math.sin(a),.105,.07,z-.035,z+.105);
   parts.push({role:'bloom',box:b,view:{...b},shade:k%3===0?pink:cream,ray:homeRayEllipsoid});
  }
 }
 return {...ROOM_MODEL(S.x,S.y,hotelLobbyDraw(parts)),walk:true,radius:1.2,grandArrival:{kind:'table',parts}};
}
function GRAND_LUGGAGE_TROLLEY(){
 const S=GRAND_ARRIVAL,parts=[],brass=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL),rubber=grandArrivalMaterial(GRAY,.5),carpet=grandArrivalMaterial(BRICK,1.5);
 const box=(role,x,y,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=x;p.box.y=y;};
 box('deck',0,0,.66,.40,.22,.28,.025,brass);box('carpet',0,0,.63,.37,.28,.295,.008,carpet);
 for(const x of [-.56,.56])for(const y of [-.29,.29]){
  hotelLobbyTube(parts,'wheel',x-.035,y,.09,x+.035,y,.09,.09,rubber);
  box('castor',x,y,.035,.035,.10,.22,.006,brass);
 }
 for(const x of [-.59,.59])hotelLobbyTube(parts,'upright',x,.30,.28,x,.30,1.72,.022,brass);
 hotelLobbyTube(parts,'handle',-.59,.30,1.72,.59,.30,1.72,.022,brass);
 for(const y of [-.36,.36])hotelLobbyTube(parts,'edge',-.61,y,.32,.61,y,.32,.014,brass);
 const leather=base=>(i,t,L)=>{const seam=Math.max(coveGroove(HIT.u,.18,.003,t/projY),coveGroove(HIT.w,.22,.003,t/projY));BG[i]=C(base,2.3+L*.30*coveLight(HIT.nx,HIT.ny,HIT.nz)-seam*.5);set(i,' ',0);return true;};
 for(const [x,y,hl,hw,top,col]of [[-.27,-.03,.27,.24,.91,BRICK],[.32,-.02,.23,.27,.65,GREEN]]){
  box('case',x,y,hl,hw,.295,top,.035,leather(col));
  for(const side of [-1,1])box('strap',x+side*hl*.62,y,.014,hw+.002,.33,top-.025,.002,brass);
  const z=top+.07;for(const u of [-.09,.09])hotelLobbyTube(parts,'case-handle-post',x+u,y,top-.004,x+u,y,z,.009,brass);
  hotelLobbyTube(parts,'case-handle',x-.09,y,z,x+.09,y,z,.009,brass);
 }
 return {...ROOM_MODEL(S.trolleyX,S.trolleyY,hotelLobbyDraw(parts),[.69,.40,1.75]),radius:.84,grandArrival:{kind:'trolley',parts}};
}
function grandArrivalInlay(i,x,y,L,fp){
 const S=GRAND_ARRIVAL,u=Math.abs(x-S.x),v=Math.abs(y-S.y),r=Math.hypot(u,v);if(r>2.55+fp)return false;
 const ring=roadLine(Math.abs(r-2.43),.14,fp),trim=roadLine(Math.abs(r-2.28),.035,fp),edge=clamp(.5+(2.5-r)/Math.max(fp,.001),0,1);
 const star=Math.min((u+v-1.48)*Math.SQRT1_2,Math.max(u,v)-1.03),fill=clamp(.5-star/Math.max(fp,.001),0,1);
 let base=STONE,level=2.7+L*.40;
 if(ring>.5||fill>.5){base=GREEN;level=1.5+L*.25;}
 else if(trim>.5){base=WARM;level=3+L*.4;}
 else level-=(ring+trim)*1.2;
 if(edge<.5)return false;
 BG[i]=C(base,level);set(i,' ',0);return true;
}
const GRAND_ARRIVAL_PROPS=ROOM_DEFS.grandhotel.props,GRAND_ARRIVAL_BLOCK=ROOM_DEFS.grandhotel.block,GRAND_ARRIVAL_FLOOR=ROOM_FLOORS.hotelLobby;
ROOM_DEFS.grandhotel.props=r=>[...GRAND_ARRIVAL_PROPS(r),GRAND_ARRIVAL_TABLE(),GRAND_LUGGAGE_TROLLEY()];
// The table is round: use its drawn radius, with the same 20cm player clearance
// as the native box furniture, rather than blocking an invisible square.
ROOM_DEFS.grandhotel.block=(x,y)=>!!GRAND_ARRIVAL_BLOCK?.(x,y)||Math.hypot(x-GRAND_ARRIVAL.x,y-GRAND_ARRIVAL.y)<GRAND_ARRIVAL.radius+.2;
ROOM_FLOORS.hotelLobby=(i,f,x,y,r,column,L)=>{
 if(room.kind==='grandhotel'&&grandArrivalInlay(i,x,y,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye)))return;
 return GRAND_ARRIVAL_FLOOR(i,f,x,y,r,column,L);
};
