// Still, pale ice with filtered fracture seams, cloudy frost and physical blade
// marks. Every mark belongs to its world position, rather than to the camera.
function iceOceanCell(i,x,y,d,f) {
  const grain=noise(x*2,y*2,196),fp=d/projY;
  const seam=Math.min(Math.abs(Math.sin(x*1.7+y*.63)),Math.abs(Math.sin(y*1.31-x*.42)));
  const crack=clamp((.025-seam)/Math.max(.012,fp*2),0,1);
  const mark=d<4&&iceTracks.length?iceBladeMark(x,y,fp):0;
  const base=mark>.2?WHITE:crack>.1?CYAN:grain>.66?WHITE:GRAY;
  BG[i]=C(base,(2+day*10+grain*2-crack*3+mark*2)*f);
  set(i,' ',0);FL[i]=1;
}
function paintSnowIceTracks(i,x,y,d) {
  if(d>4||!iceTracks.length)return;
  const mark=iceBladeMark(x,y,d/projY);
  if(mark>.2)BG[i]=C(GRAY,(2+day*7+mark)*Math.max(0,1-d/vis*1.5));
}
const ICE_SKATE_MATERIALS={
  leather:(i,t,L)=>{BG[i]=C(WHITE,(3+L*.65)*shadeFace(HIT.face));set(i,' ',0);return true;},
  sole:(i,t,L)=>{BG[i]=C(BRICK,(1+L*.35)*shadeFace(HIT.face));set(i,' ',0);return true;},
  steel:(i,t,L)=>{BG[i]=C(HIT.face===5?WHITE:GRAY,(4+L*.65)*shadeFace(HIT.face));set(i,' ',0);return true;},
  lace:(i,t,L)=>{BG[i]=C(GRAY,3+L*.45);set(i,' ',0);return true;}
};
// A shared boot, heel, welt, blade and two stanchions: worn and shop models use
// the same dimensions. Laces resolve only up close, with no extra distant work.
function drawIceSkateModel(x,y,c,s,z,scale=1,detail=true) {
  const part=(u,hl,hw,z0,z1,mat,round=0)=> {
    const box=boxAt(x+c*u*scale,y+s*u*scale,c,s,hl*scale,hw*scale,z+z0*scale,z+z1*scale);
    if(round){box.round=round*scale;drawBox(box,ICE_SKATE_MATERIALS[mat],coveRayRounded);}
    else drawBox(box,ICE_SKATE_MATERIALS[mat]);
  };
  part(.002,.019,.0008,0,.002,'steel');
  for(const u of [-.009,.011])part(u,.002,.0013,.002,.004,'steel');
  part(0,.016,.006,.004,.006,'sole');
  part(.003,.013,.0058,.006,.015,'leather',.002);
  part(-.008,.0055,.006,.013,.031,'leather',.0015);
  if(detail) {
    part(-.008,.0058,.0063,.029,.032,'leather');
    for(const u of [-.003,.001,.005,.009])part(u,.0006,.0045,.015,.0155,'lace');
    part(-.0023,.0004,.002,.016,.028,'lace');
  }
}
function drawWornIceSkates() {
  if(!iceSkatesOn()||body.seat||pitch>-.25)return;
  const speed=Math.hypot(body.mx||0,body.my||0),gliding=oceanIceAt(px,py),moving=!!(K.KeyW||K.KeyS||K.KeyA||K.KeyD);
  const yaw=gliding&&speed>.1?Math.atan2(body.my,body.mx):a,z=walkGround(px,py)+body.z/10;
  for(const side of [-1,1]) {
    const stride=moving&&speed>.1?Math.sin(T*(gliding?5:9)+side*Math.PI/2):0;
    // Like the skateboard view, place the feet slightly ahead of the camera
    // so a downward glance can reach them in the horizon-based renderer.
    const across=side*(.012+Math.max(0,stride)*.006),along=.11+stride*.01;
    const x=px+Math.cos(a)*along-Math.sin(a)*across,y=py+Math.sin(a)*along+Math.cos(a)*across;
    const turn=yaw+side*(K.KeyC?.5:moving?Math.max(0,stride)*.16:.04);
    drawIceSkateModel(rel(x-px),rel(y-py),Math.cos(turn),Math.sin(turn),z);
  }
}
const WINTER_SHOP_LOOKS=new Map();
function drawWinterSkateShops() {
  for(const [index,shop] of winterSkateShops().entries()) {
    const [x,y]=R(shop.x,shop.y),distance=Math.hypot(x,y);
    if(distance>vis+1||!inView(x,y,1))continue;
    const z=outdoorGroundHeight(shop.x,shop.y),accent=index?GREEN:BLUE;
    const part=(u,v,hl,hw,z0,z1,col,wood=false)=>drawBox(boxAt(x+u,y+v,1,0,hl,hw,z+z0,z+z1),(i,t,L)=>{
      const gap=wood?coveGroove(HIT.u+HIT.v,.045,.0015,t/projY):0;
      BG[i]=C(col,(2+L*.5-gap*1.4)*shadeFace(HIT.face));set(i,' ',0);return true;
    });
    // A timber counter with recessed panels, brass edging and sled runners.
    for(const u of [-.23,.23])part(u,0,.018,.18,0,.012,GRAY);
    part(0,0,.3,.16,.012,.09,BRICK,true);
    part(0,-.162,.27,.002,.027,.074,accent);
    for(const u of [-.28,0,.28])part(u,-.166,.005,.003,.02,.083,BRICK);
    part(0,0,.32,.18,.09,.101,BRICK,true);
    part(0,-.181,.32,.002,.093,.101,YEL);
    for(const u of [-.28,.28])part(u,.10,.008,.012,.1,.34,BRICK);
    part(0,.13,.28,.006,.15,.28,BRICK,true); // slatted back and stock shelf
    part(0,.08,.29,.055,.184,.191,BRICK,true);
    part(0,0,.34,.2,.33,.35,accent);
    // Rolled canvas valance, roof seam and a shallow cap of settled snow.
    for(let k=0;k<8;k++)part(-.2975+k*.085,-.202,.0425,.003,.309+(k&1)*.004,.34,k&1?WHITE:accent);
    part(0,0,.345,.205,.35,.357,WHITE);
    part(0,0,.002,.205,.357,.36,GRAY);
    if(distance<7) {
      for(const [u,v,h] of [[-.23,-.08,.101],[-.185,-.08,.101],[.08,-.08,.101],[.125,-.08,.101],[-.12,.07,.191],[-.075,.07,.191],[.15,.07,.191],[.195,.07,.191]])
        drawIceSkateModel(x+u,y+v,1,0,z+h,1.15,distance<3);
      // A thermos, two paper cups and a folded wool scarf at the till.
      part(.25,-.07,.009,.009,.101,.143,GRAY);
      part(.25,-.07,.011,.011,.14,.146,BLACK);
      for(const u of [.205,.23]){part(u,-.115,.007,.007,.101,.119,WHITE);part(u,-.115,.006,.006,.118,.12,BRICK);}
      part(-.02,-.09,.032,.026,.101,.105,accent);
    }
    if(distance<10) {
      if(!WINTER_SHOP_LOOKS.has(index))WINTER_SHOP_LOOKS.set(index,figStreetLook(7910+index,accent,GRAY,3));
      drawFigure(x+.02,y+.07,z,.175,0,-1,WINTER_SHOP_LOOKS.get(index),'fold');
    }
    const word='ICE SKATES $75',hl=.32,z0=z+.235,z1=z+.305,n=word.length+2,far=farDepth(x,y,hl),tc=midDepth(x,y);
    drawBox(boxAt(x,y-.171,1,0,hl,.004,z0,z1),(i,t,L)=>{
      const edge=Math.min(hl-Math.abs(HIT.u),HIT.w-z0,z1-HIT.w)<.004;
      BG[i]=C(edge?YEL:accent,edge?5+L*.5:2+L*.3);
      if(HIT.face!==3&&HIT.face!==4||edge){set(i,' ',0);return true;}
      const ch=signLine(word,faceQ(HIT.u,hl)*n-1,(z1-.008-HIT.w)/.048,i,z1-.032,tc,t,2*hl/n,.048,far,...faceDir(1,0));
      set(i,ch??' ',C(WHITE,14));return true;
    });
  }
}
