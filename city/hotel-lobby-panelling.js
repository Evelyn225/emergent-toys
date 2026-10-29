// A temporary layout proxy reuses the fitted home builders without changing
// their implementation or the actual hotel's grid, definition or semantics.
function hotelLobbyPanelling(r) {
  const openings=[];
  for(let y=0;y<r.H;y++)for(let x=0;x<r.W;x++)if('DE'.includes(r.grid[y][x]))
    openings.push({box:boxAt(x+.5,y+.5,1,0,.51,.51,0,2.3)});
  const layout={...r,grid:r.grid.map(row=>row.replace(/E/g,'D')),
    def:{...r.def,tier:0,height:r.def.height||3,builtSkirting:true,builtPanelling:true,builtCornices:true},
    props:[...r.props,...openings]};
  const base=homeSkirting(layout);layout.props.push(...base);
  const panels=homePanelling(layout),cornices=homeCornices(layout);
  // Without window sills the helper's first frieze band has zero height.
  // Remove that empty band from these returned pieces, retaining the joins.
  for(const o of panels)if(o.homeChairRail){
    const m=o.homeChairRail;m.parts.splice(0,m.parts.length,...m.parts.filter(p=>p.box.z1-p.box.z0>1e-8));
    m.profile=m.profile.filter(([a,b])=>b-a>1e-8);
  }
  for(const model of panels)for(const p of model.homePanelling?.parts||[]){
    const [fx,fy]=p.normal;
    p.shade=(i,t,L)=>{
      const detail=smooth(clamp((.035*projX/t-.2)/.8,0,1)),fine=coveDetail(t,.3);
      const grain=fine?Math.sin(HIT.u*80+Math.sin(HIT.w*4)*.2)*.06*fine:0;
      const light=coveLight(HIT.nx*detail+fx*(1-detail),HIT.ny*detail+fy*(1-detail),HIT.nz*detail);
      BG[i]=C(BRICK,2.6+(HIT.panelBack?-.35:.35)*detail+L*.3*light+grain);set(i,' ',0);return true;
    };
  }
  const models=[...base,...panels,...cornices];
  for(const o of models)for(const [from,to]of [['homeSkirting','hotelLobbySkirting'],['homePanelling','hotelLobbyPanelling'],['homeChairRail','hotelLobbyChairRail'],['homeCornice','hotelLobbyCornice']])if(o[from]){o[to]=o[from];delete o[from];}
  return models;
}
function hotelLobbyWallFinish(i,u,uStep,z,d,mx,my,L) {
  BG[i]=C(z<.945?BRICK:STONE,(z<.945?2.6:3.4)+L*.3);set(i,' ',0);return true;
}
ROOM_DEFS.hotel.wall=hotelLobbyWallFinish;
