// A fitted counter and clear framed screen replace the two painted slabs.
// Prepare every component once; leave common counter/glass/text helpers alone.
function BANK_TELLER_COUNTER(x,y) {
  const parts=[],wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,7);
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const stone=(i,t,L)=>{BG[i]=C(STONE,3.6+L*.27*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.5+L*.1);set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,r,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,r,shade);p.box.x=u;p.box.y=v;return p;};
  box('plinth',0,0,4.44,.30,0,.1,.012,dark);
  box('carcass',0,0,4.46,.32,.1,1.03,.015,wood);
  for(let k=0;k<6;k++)box('front-panel',(k-2.5)*1.5,.334,.65,.014,.22,.93,.008,wood);
  box('worktop',0,0,4.5,.35,1.03,1.1,.02,stone);
  for(const u of [-3,0,3]){
    box('tray-base',u,.23,.17,.10,1.1,1.112,.002,metal);
    for(const e of [-1,1]){
      box('tray-side',u+e*.165,.23,.005,.1,1.112,1.135,.001,metal);
      box('tray-end',u,.23+e*.095,.16,.005,1.112,1.135,.001,metal);
    }
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,4.5,.35,0,1.1),radius:4.52,bankTellerCounter:{parts}};
}
function BANK_TELLER_SCREEN(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const glass=(i,t,L)=>{
    if((HIT.face===3||HIT.face===4)&&coveGroove(HIT.u+HIT.w*.5,1.2,.003,t/projX)*coveDetail(t)<.6)return false;
    BG[i]=C(CYAN,2+L*.14);set(i,' ',0);return true;
  };
  const box=(role,u,v,hl,hw,z0,z1,r,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,r,shade);p.box.x=u;p.box.y=v;return p;};
  for(const u of [-4.475,-1.5,1.5,4.475])box('post',u,0,.025,.035,1.1,1.95,0,metal);
  box('head',0,0,4.5,.035,1.95,1.99,0,metal);
  const bays=[[-4.45,-1.525],[-1.475,1.475],[1.525,4.45]];
  for(let k=0;k<3;k++){
    const[lo,hi]=bays[k],u=(lo+hi)/2,half=(hi-lo)/2,label=String(k+1);
    box('sill',u,0,half,.035,1.26,1.28,0,metal);
    box('glass',u,0,half,.003,1.28,1.95,0,glass);
    box('number',u,.035,.12,.005,1.88,2.06,.002,(i,t,L)=>{
      BG[i]=C(STONE,4+L*.25);if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,label,0,1.97,.085,.12,C(GRAY,.2),BG[i]))return true;
      set(i,' ',0);return true;
    });
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,4.5,.035,1.1,1.99),radius:4.52,shotPermeable:true,bankTellerScreen:{parts,bays}};
}
const BANK_TELLER_PROPS=ROOM_DEFS.bank.props;
ROOM_DEFS.bank.props=r=>{
  const props=BANK_TELLER_PROPS(r).filter(p=>!(p.box&&p.box.x===7&&((p.box.y===2.4&&p.box.z1===1.1)||(p.box.y===2.3&&p.box.z0===1.1))));
  for(const p of props)if(p.fig&&p.y===1.5){if(p.x===3.5)p.x=4;if(p.x===10.5)p.x=10;}
  return [...props,BANK_TELLER_COUNTER(7,2.4),BANK_TELLER_SCREEN(7,2.3)];
};
