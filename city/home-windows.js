// Native apartment windows share the wall painter's opening measurements.
// Closed fitted pieces sit on the inner wall face; the existing exterior ray
// still supplies the view through the four clear panes. Fern uses its own set.
function HOME_WINDOW_CASING(win,W,H,tier) {
  const bottom=win.bottom??.85,top=win.top??(tier?2.95:2.5),half=win.half;
  const face=win.face,c=face==='north'?1:face==='south'?-1:0,s=face==='west'?-1:face==='east'?1:0;
  const x=face==='west'?1:face==='east'?W-1:win.center,y=face==='north'?1:face==='south'?H-1:win.center;
  const shade=(i,t,L)=>{
    if(tier===0)return coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,16);
    const light=coveLight(HIT.nx,HIT.ny,HIT.nz);
    BG[i]=C(tier===2?WHITE:GRAY,(tier===2?3.9:1.2)+L*(tier===2?.36:.24)*light);
    set(i,' ',0);return true;
  };
  const pieces=[],add=(u,v,hl,hw,z0,z1,round=0)=>{
    const box=boxAt(c*u-s*v,s*u+c*v,c,s,hl,hw,z0,z1);
    const material=round?shade:(i,t,L)=>{const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;
      HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return shade(i,t,L);};
    pieces.push({local:box,view:{...box,...(round?{round}:null)},shade:material,ray:round?coveRayRounded:rayBox});
  };
  // The horizontal rails own the corners; the jambs meet their end planes.
  for(const z of [bottom,top-.10])add(0,.045,half,.045,z,z+.10);
  for(const e of [-1,1])add(e*(half-.045),.045,.045,.045,bottom+.10,top-.10);
  // Recessed glazing bars meet the inner faces, with one owner at the cross.
  const cross=clamp(2.12,bottom+.20,top-.20);
  add(0,.027,half-.09,.027,cross-.035,cross+.035);
  add(0,.027,.035,.027,bottom+.10,cross-.035);
  add(0,.027,.035,.027,cross+.035,top-.10);
  // A deep sill seats the bottom rail; its rear face is on the wall plane.
  add(0,.08,half+.055,.08,bottom-.045,bottom,.008);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const p of pieces){const b=p.view;b.x=vx+p.local.x;b.y=vy+p.local.y;
      drawBox(b,p.shade,p.ray);}
  }),radius:half+.2,windowCasing:{face,bottom,top,half,cross}};
}
function homeWindowCasings(r) {
  return r.def.windows.map(win=>HOME_WINDOW_CASING(win,r.W,r.H,r.def.tier));
}
