// The reception's sixteen hooks and occupied-room pattern retain their old
// layout. Real hanging rings, key shafts/teeth and numbered tags replace ink.
function MOTEL_KEY_RACK(x,y) {
  const parts=[],keys=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,12);
  const board=hotelLobbyRound(parts,'board',1.2,.024,1.25,2,.012,wood);board.box.y=.024;
  const ringShape={x:0,y:0,profile:[[-.004,.015],[-.004,.023],[.004,.023],[.004,.015],[-.004,.015]]};
  for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const k=row*8+col,u=-1.05+col*.3,z=1.25+row*.375,occupied=hash(k,3,137)<.25;
    hotelLobbyTube(parts,'hook',u,.048,z+.31,u,.108,z+.31,.004,metal);parts.at(-1).key=k;
    hotelLobbyTube(parts,'hook-tip',u,.108,z+.31,u,.108,z+.29,.004,metal);parts.at(-1).key=k;
    keys.push({k,u,z,occupied});if(occupied)continue;
    const box={...boxAt(u,.111,1,0,.023,.004,z+.28-.023,z+.28+.023),centerZ:z+.28,clockShape:ringShape};
    parts.push({role:'ring',key:k,box,view:{...box},shade:metal,ray:homeClockRay});
    hotelLobbyTube(parts,'shaft',u,.111,z+.265,u,.111,z+.155,.006,metal);parts.at(-1).key=k;
    const tooth=hotelLobbyRound(parts,'tooth',.016,.006,z+.16,z+.18,.002,metal);tooth.box.x=u+.010;tooth.box.y=.111;tooth.key=k;
    const label=String(k+1).padStart(2,'0'),color=[RED,BLUE,GREEN][k%3];
    const tag=(i,t,L)=>{BG[i]=C(HIT.w>z+.13?color:STONE,6+L*.13*coveLight(HIT.nx,HIT.ny,HIT.nz));if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,label,0,z+.095,.03,.05,C(GRAY,.2),BG[i]))return true;set(i,' ',0);return true;};
    const p=hotelLobbyRound(parts,'tag',.05,.006,z+.035,z+.155,.003,tag);p.box.x=u;p.box.y=.111;p.key=k;
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.23,motelKeyRack:{parts,keys}};
}
const MOTEL_KEY_PROPS=ROOM_DEFS.motel.props,MOTEL_KEY_WALL=ROOM_DEFS.motel.wall;
ROOM_DEFS.motel.props=r=>[...MOTEL_KEY_PROPS(r),MOTEL_KEY_RACK(3,1)];
ROOM_DEFS.motel.wall=(i,u,uStep,z,d,mx,my,L)=>{
  if(my===0&&u>1.8&&u<4.2&&z>1.25&&z<2){BG[i]=C(YEL,3.6+L*.15);set(i,' ',0);return true;}
  return MOTEL_KEY_WALL(i,u,uStep,z,d,mx,my,L);
};
