// The landscape is a matte print in a fitted frame, rather than a frame
// painted on one slab. The existing wall anchor and overall size are retained.
function hotelLandscape(x,y) {
  const parts=[],z=1.9,metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const plain=(base,level)=>(i,t,L)=>{BG[i]=C(base,level+L*.23*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,shade)=>{
    const b=boxAt(u,v,1,0,hl,hw,z0,z1),material=(i,t,L)=>{const f=HIT.face;HIT.nx=f===1?1:f===2?-1:0;HIT.ny=f===3?1:f===4?-1:0;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);};
    parts.push({role,box:b,view:{...b},shade:material,ray:rayBox});
  };
  box('canvas',0,.004,.72,.001,z-.32,z+.32,(i,t,L)=>{
    const u=HIT.u,h=HIT.w,hill=1.88+.12*Math.sin(u*5)+.05*Math.cos(u*11);
    const sun=(u+.35)**2+(h-2.09)**2<.0049,base=sun?YEL:h<1.7?CYAN:h<hill?GREEN:BLUE;
    BG[i]=C(base,2.4+L*.20);set(i,' ',0);return true;
  });
  const rails=[
    [[-.85,.45],[.85,.45],[.77,.37],[-.77,.37]],
    [[.85,.45],[.85,-.45],[.77,-.37],[.77,.37]],
    [[.85,-.45],[-.85,-.45],[-.77,-.37],[.77,-.37]],
    [[-.85,-.45],[-.85,.45],[-.77,.37],[-.77,-.37]]
  ];
  for(const vertices of rails){const p=homeFrameRail(vertices,z),b={...boxAt(p.u,.006,1,0,p.hl,.025,p.z0,p.z1),planes:p.planes,normals:p.normals};parts.push({role:'rail',box:b,view:{...b},shade:metal,ray:homeRayWorktop});}
  box('mat',0,.0015,.775,.0015,z-.375,z+.375,plain(STONE,4.0));
  box('backing',0,-.003,.79,.003,z-.39,z+.39,plain(BRICK,1.6));
  for(const u of [-.80,.80])for(const h of [-.40,.40])box('pad',u,-.024,.018,.006,z+h-.018,z+h+.018,plain(GRAY,.6));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const p of parts){p.view.x=vx+p.box.x;p.view.y=vy+p.box.y;drawBox(p.view,p.shade,p.ray);}}),
    walk:true,box:boxAt(x,y+.0005,1,0,.85,.0305,z-.45,z+.45),radius:.9,hotelWallArt:{parts,wallY:y-.03,centreZ:z}};
}
