// Fern's front is west toward the dock. The room's south entrance therefore
// maps through a quarter turn; windows and the world-view camera share it.
const FERN_WINDOWS=[
  {face:'west',center:4.8,half:1.5},{face:'west',center:16.4,half:1.4},
  {face:'north',center:14.5,half:2,bottom:1.13},{face:'east',center:8.2,half:1.3},
  {face:'south',center:4.5,half:1.6},{face:'south',center:18,half:1.6}
].map(w=>({bottom:.95,top:2.85,...w}));
ROOM_DEFS.islandhome.windows=FERN_WINDOWS;
ROOM_DEFS.islandhome.doorWall=true;
function fernExteriorWindow(win) {
  const c=FERN_HOUSE,cx=(c.x0+c.x1)/2,cy=(c.y0+c.y1)/2;
  const west=win.face==='west',east=win.face==='east',north=win.face==='north',south=win.face==='south';
  const x=west?c.x0:east?c.x1:cx+(win.center-12)/10,y=north?c.y0:south?c.y1:cy+(win.center-12)/10;
  return {x:cx-(y-cy),y:cy+(x-cx),c:west||east?-1:0,s:west||east?0:1,
    nx:north?1:south?-1:0,ny:west?-1:east?1:0,half:win.half/10,bottom:win.bottom/10,top:win.top/10};
}
function drawFernDoor(x,y,c,s,scale=1,facing=1) {
  const part=(u,v,hl,hw,z0,z1,mat=coveDoorPaint)=>coveRound(x+(c*u-s*v*facing)*scale,y+(s*u+c*v*facing)*scale,c,s,hl*scale,hw*scale,z0*scale,z1*scale,.0015*scale,mat);
  part(0,.003,.091,.003,.012,.244);
  for(const side of [-1,1])part(side*.082,.009,.009,.004,.017,.239);
  for(const [z0,z1]of [[.017,.033],[.119,.136],[.224,.239]])part(0,.009,.073,.004,z0,z1);
  for(const side of [-1,1])for(const [lo,hi]of [[.04,.112],[.144,.217]])part(side*.0385,.0055,.0305,.0025,lo,hi);
  for(const side of [-1,1])part(side*.103,.008,.009,.014,.005,.246,bathroomPaint);
  part(0,.008,.112,.014,.246,.264,bathroomPaint);part(0,.013,.112,.02,0,.008,bathroomPaint);
  const at=(u,v,z)=>[x+(c*u-s*v*facing)*scale,y+(s*u+c*v*facing)*scale,z*scale];
  bathroomPipe(...at(.066,.017,.118),...at(.066,.023,.118),.003*scale,YEL);
  bathroomPipe(...at(.049,.023,.118),...at(.069,.023,.118),.003*scale,YEL);
  for(const z of [.057,.203])part(-.091,.014,.006,.002,z-.006,z+.006,GRAY);
}
const FERN_INTERIOR_PROPS=ROOM_DEFS.islandhome.props;
ROOM_DEFS.islandhome.props=r=>[
  ...FERN_INTERIOR_PROPS(r),
  {...ROOM_MODEL(12,23,(vx,vy)=>{
    drawFernDoor(vx,vy,1,0,10,-1);
    drawBox(boxAt(vx,vy,1,0,1,.04,2.64,3.4),solid(WHITE));
  }),radius:3},
  ...FERN_WINDOWS.map(w=>{
    const west=w.face==='west',east=w.face==='east',north=w.face==='north';
    const x=west?1.04:east?22.96:w.center,y=north?1.04:w.face==='south'?22.96:w.center,c=west||east?0:1,s=west||east?1:0;
    return {...ROOM_MODEL(x,y,(vx,vy)=>{
      for(const side of [-1,1])coveRound(vx+c*side*w.half,vy+s*side*w.half,c,s,.055,.06,w.bottom-.055,w.top+.055,.012,bathroomPaint);
      for(const z of [w.bottom,w.top])coveRound(vx,vy,c,s,w.half-.055,.06,z-.055,z+.055,.012,bathroomPaint);
      coveRound(vx,vy,c,s,.025,.05,w.bottom+.055,w.top-.055,.012,bathroomPaint);
      coveRound(vx,vy,c,s,w.half-.055,.05,2.085,2.155,.012,bathroomPaint);
    }),radius:w.half+.25};
  })
];
function fernHouseFacade(cabin,i,z,d,side,wc,fog) {
  const wx=side?wc:px<cabin.x0?cabin.x0:cabin.x1,wy=side?py<cabin.y0?cabin.y0:cabin.y1:wc;
  const nx=side?0:px<cabin.x0?-1:1,ny=side?py<cabin.y0?-1:1:0;
  const along=side?wx-cabin.x0:wy-cabin.y0,L=fog*amb*(side?10:13);
  if(nx===-1&&Math.abs(wy-245.5)<.1&&z<.27){BG[i]=C(GREEN,1.8+L*.15);set(i,' ',0);return;}
  for(const w of FERN_WINDOWS){const p=fernExteriorWindow(w),u=(wx-p.x)*p.c+(wy-p.y)*p.s;
    if(p.nx!==nx||p.ny!==ny||Math.abs(u)>p.half||z<p.bottom||z>p.top)continue;
    BG[i]=C(night>.35?WARM:CYAN,night>.35?2+night*2:2+day*2);set(i,' ',0);return;
  }
  if(z<.04){BG[i]=C(GRAY,1.8+L*.15);set(i,' ',0);return;}
  coveTimber(i,along,z,L,d,nx,ny,0,7,.1);
}
function drawFernExterior() {
  if(!worldReady||!inView(540.5-px,245.5-py,2.4))return;
  for(const win of FERN_WINDOWS){const p=fernExteriorWindow(win),x=p.x+p.nx*.004-px,y=p.y+p.ny*.004-py;
    for(const side of [-1,1])coveRound(x+p.c*side*p.half,y+p.s*side*p.half,p.c,p.s,.006,.006,p.bottom-.006,p.top+.006,.0015,bathroomPaint);
    for(const z of [p.bottom,p.top])coveRound(x,y,p.c,p.s,p.half-.006,.006,z-.006,z+.006,.0015,bathroomPaint);
    coveRound(x,y,p.c,p.s,.0025,.005,p.bottom+.006,p.top-.006,.001,bathroomPaint);
    coveRound(x,y,p.c,p.s,p.half-.006,.005,.2085,.2155,.001,bathroomPaint);
  }
  drawFernDoor(FERN_HOUSE.x0-px,245.5-py,0,1);
}
