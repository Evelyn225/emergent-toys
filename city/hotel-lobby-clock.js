// Flat solid disks have an exact near-cap hit. Side/grazing/inside rays and
// any future non-cylindrical clock profiles retain the unchanged shared ray.
function hotelClockDiscRay(ox,oy,oz,rx,ry,rz,b) {
  const p=b.clockShape.profile;
  if(p.length===4&&p[0][1]===0&&p[3][1]===0&&p[1][1]===p[2][1]&&p[0][0]===p[1][0]&&p[2][0]===p[3][0]&&p[0][0]<p[2][0]){
    const x=ox-b.x,y=oy-b.y,c=b.c,s=b.s,u=x*c+y*s,v=-x*s+y*c,w=oz-b.centerZ,du=rx*c+ry*s,dv=-rx*s+ry*c;
    const side=v>p[2][0]?1:v<p[0][0]?-1:0;
    if(side&&dv*side<0){
      const t=((side>0?p[2][0]:p[0][0])-v)/dv,uu=u+du*t,ww=w+rz*t;
      if(t>.01&&Math.hypot(uu,ww)<=p[1][1]+1e-8){
        HIT.u=uu;HIT.v=v+dv*t;HIT.w=b.centerZ+ww;HIT.part=side>0?3:1;
        HIT.nx=-s*side;HIT.ny=c*side;HIT.nz=0;HIT.face=side>0?3:4;return t;
      }
    }
  }
  return homeClockRay(ox,oy,oz,rx,ry,rz,b);
}
// A real clock on a supported timber case/plinth, wholly inside the lobby.
// The existing clock's dial, indices, glass and time-driven hands are unchanged.
function HOTEL_LOBBY_CLOCK(x,y) {
  const parts=[],timber=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,41);
  hotelLobbyRound(parts,'plinth-foot',.42,.42,0,.08,.018,timber);
  hotelLobbyRound(parts,'plinth-body',.35,.35,.08,.42,.010,timber);
  hotelLobbyRound(parts,'plinth-cap',.42,.42,.42,.48,.012,timber);
  hotelLobbyRound(parts,'case-foot',.34,.22,.48,.53,.012,timber);
  hotelLobbyRound(parts,'case-body',.31,.19,.53,1.20,.008,timber);
  hotelLobbyRound(parts,'case-head',.34,.22,1.20,1.25,.012,timber);
  const model={...ROOM_MODEL(x,y,hotelLobbyDraw(parts),[.42,.42,1.25]),radius:.60,hotelClockCase:{parts,height:1.25}};
  const dial=HOME_WALL_CLOCK({id:'f_clock',x,y:y+.23,z:.88,a:0});
  // This is hotel decoration, with the plinth owning walking collision.
  delete dial.box;delete dial.furnishingKey;dial.hotelLobbyDial={centerZ:.88};
  const renderDial=dial.draw,back={box:null,shade:null,ray:null};
  dial.draw=(vx,vy)=>{
    const draw=drawBox;back.box=null;
    drawBox=(box,shade,ray=rayBox)=>{
      if(box.clockRole==='glass'||box.clockRole==='dial'||box.clockRole==='back')ray=hotelClockDiscRay;
      if(box.clockRole==='back'){back.box=box;back.shade=shade;back.ray=ray;}else draw(box,shade,ray);
    };
    try{renderDial(vx,vy);}finally{drawBox=draw;}
    if(back.box)draw(back.box,back.shade,back.ray);
  };
  // Let the fitted clock reject case/backing pixels already hidden by its face.
  return [dial,model];
}
