// The bedroom/study cuts share measurements with homePlan. Fill above the
// opening, line its depth and finish BOTH wall faces; the centre stays open.
// Each solid carries only its own rendered bounds, never the whole doorway.
function homePassageSurrounds(r) {
  const props=[],tier=r.def.tier;
  const plaster=(i,t,L,b)=>{
    // Continue the native wall paint and its floor/ceiling bands, including
    // live lamp changes. These are interior cuts, away from exterior panes.
    const face=HIT.face,u=face===1||face===2?b.y+HIT.v:b.x+HIT.u;
    const light=Math.max(0,1-t/vis)*(face===3||face===4?10:14)*r.def.light;
    return homeWall(i,u,t/projX,HIT.w,t,Math.floor(b.x),Math.floor(b.y),light);
  };
  const paint=(i,t,L)=>{
    BG[i]=C(tier===2?WHITE:GRAY,(tier===2?4.4:3.4)+L*.30*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  for(const [index,p]of (r.def.homePassages||[]).entries()){
    const mid=(p.start+p.end)/2,half=(p.end-p.start)/2,y=p.cross+.5,top=2.4;
    const add=(role,u,v,hl,hw,z0,z1,material)=>{
      const box=boxAt(mid+u,y+v,1,0,hl,hw,z0,z1),view={...box};
      const shade=(i,t,L)=>{
        const f=HIT.face;
        // The infill's end caps are buried in native wall cells. Let those
        // walls own the joint instead of flashing side-lit seam pixels.
        if(role==='infill'&&(f===1||f===2))return false;
        HIT.nx=f===1?1:f===2?-1:0;HIT.ny=f===3?1:f===4?-1:0;HIT.nz=f===5?1:f===6?-1:0;
        return material(i,t,L,box);
      };
      props.push({...ROOM_MODEL(box.x,box.y,(vx,vy)=>{view.x=vx;view.y=vy;drawBox(view,shade);}),
        box,radius:Math.hypot(hl,hw)+.05,homePassage:{index,role,source:p}});
    };
    add('infill',0,0,half,.5,top,r.def.height,plaster);
    for(const e of [-1,1])add('reveal',e*(half-.025),0,.025,.5,0,top,plaster);
    for(const face of [-1,1]){
      for(const e of [-1,1])add('casing-jamb',e*(half+.02),face*.535,.07,.035,0,top,paint);
      add('casing-head',0,face*.535,half+.09,.035,top,top+.09,paint);
    }
  }
  return props;
}
