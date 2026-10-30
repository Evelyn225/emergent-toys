// The surveillance display is a small schematic, not another scene render.
// Cache the actual guard reference and map; only the recessed front emits.
function JAIL_CCTV(x,y,guard) {
  const parts=[],dark=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.16*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade=dark)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  const screen=(i,t,L)=>{
    if(HIT.face!==2)return dark(i,t,L);
    const x=(HIT.v+.145)/.29*JAIL_W,y=(1.145-HIT.w)/.23*JAIL_D;
    const wall=JAIL_GRID[clamp(Math.floor(y),0,JAIL_D-1)][clamp(Math.floor(x),0,JAIL_W-1)]==='#';
    const bar=Math.abs(y-JAIL_BARS_NEAR)<.14||Math.abs(y-JAIL_BARS_FAR)<.14;
    const blip=guard&&Math.hypot((x-guard.x)*.7,y-guard.y)<.5;
    const scan=coveGroove(HIT.w,.005,.001,t/projY)*.3;
    BG[i]=C(GREEN,(blip?13:wall?5:bar?3:1.0)-scan);set(i,' ',0);return true;
  };
  box('foot',0,0,.085,.13,.8,.815,.004);
  box('stem',.01,0,.015,.018,.815,.93,.004);
  box('back',.005,0,.02,.145,.915,1.145,0);
  for(const v of [-.1625,.1625])box('bezel-side',0,v,.025,.0175,.915,1.145,0);
  box('bezel-bottom',0,0,.025,.18,.88,.915,0);
  box('bezel-top',0,0,.025,.18,1.145,1.18,0);
  box('screen',-.0165,0,.0015,.145,.915,1.145,0,screen);
  box('power',-.027,.11,.002,.006,.892,.898,.001,(i,t,L)=>{BG[i]=C(GREEN,9);set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.085,.18,.8,1.18),radius:.21,jailCCTV:{parts,guard}};
}
function JAIL_COFFEE(x,y) {
  const parts=[],glaze=(i,t,L)=>{BG[i]=C(YEL,2.5+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  hotelLobbyTurned(parts,'cup',0,0,[[.8,0],[.8,.042],[.81,.05],[.91,.055],[.92,.052],[.92,.046],[.812,.046],[.812,0]],glaze);
  hotelLobbyTurned(parts,'coffee',0,0,[[.895,0],[.895,.046],[.897,.046],[.897,0]],(i,t,L)=>{BG[i]=C(BRICK,.4+L*.06);set(i,' ',0);return true;});
  bankVaultDisc(parts,'handle',.08,.865,[[-.007,.024],[-.007,.032],[.007,.032],[.007,.024],[-.007,.024]],glaze);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),radius:.13,jailCoffee:{parts}};
}
const JAIL_ACCESSORY_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>{
  const props=JAIL_ACCESSORY_PROPS(r).filter(p=>!(p.box&&p.box.x===19.6&&p.box.y===7.3&&p.box.hl===.18&&p.box.hw===.15)&&!(p.x===19.6&&p.y===8.2&&p.art));
  const guard=props.find(p=>p.fig&&p.tick&&p.y===7.5);
  return [...props,JAIL_CCTV(19.6,7.3,guard),JAIL_COFFEE(19.6,8.2)];
};
