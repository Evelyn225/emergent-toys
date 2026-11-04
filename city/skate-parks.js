// Reserve clear south-east corners of separate public parks, away from the
// pond, central paths and benches. Trees inside the new concrete are removed.
function buildExtraSkateparks() {
  const used = new Set(SKATEPARK ? [SKATEPARK.bx+','+SKATEPARK.by] : []);
  for (const type of ['bowl', 'flow']) {
    let site = null;
    for (const [bx,by] of parks) {
      if (used.has(bx+','+by)) continue;
      const x=bx*8+6.65,y=by*8+(type==='bowl'?6.25:6.65),hx=1.1,hy=type==='bowl'?1.48:1.1,half=Math.max(hx,hy);
      if (SKATE_PATCHES.some(p=>Math.abs(p.x-x)<hx+p.hl&&Math.abs(p.y-y)<hy+p.hw)) continue;
      if (benches.some(o=>Math.abs(o.x-x)<hx+.1&&Math.abs(o.y-y)<hy+.1)) continue;
      if (solids.some(o=>Math.abs(o.x-x)<hx+Math.max(o.hl,o.hw)&&Math.abs(o.y-y)<hy+Math.max(o.hl,o.hw))) continue;
      if (ARCH_BLOCKERS.some(o=>Math.abs(o.x-x)<hx+Math.max(o.hl,o.hw)&&Math.abs(o.y-y)<hy+Math.max(o.hl,o.hw))) continue;
      if (LANDMARK_SOLIDS.some(o=>Math.abs(o.x-x)<hx+Math.max(o.hl||0,o.hw||0)&&Math.abs(o.y-y)<hy+Math.max(o.hl||0,o.hw||0))) continue;
      let wet=false;
      for(const dx of [-hx,0,hx])for(const dy of [-hy,0,hy])if(isWater(x+dx,y+dy)||map[idx(Math.floor(x+dx),Math.floor(y+dy))])wet=true;
      if(wet)continue;
      site={x,y,bx,by,half,hx,hy};break;
    }
    if(!site)continue;
    const {x,y,bx,by,half,hx,hy}=site;used.add(bx+','+by);
    for(let i=trees.length-1;i>=0;i--)if(Math.abs(trees[i].x-x)<hx+.1&&Math.abs(trees[i].y-y)<hy+.1)trees.splice(i,1);
    SKATE_PATCHES.push({x,y,hl:hx,hw:hy});
    if(type==='bowl'){
      const bowl=addSkatePool(x,y,{radius:.4,height:.32,deck:.08},{rx:.5,ry:.81,curve:.22});
      bowl.spot=bowl.spotPark=true;
      SKATE_SPOTS.push({id:'skatepark-big-bowl',name:'Big Bowl Skatepark',x:x-bowl.hl-bowl.profile.height*2-.08,y,line:{x,y},
        description:'A dedicated bowl park: a long, asymmetric pool with broad lobes, tighter curved pockets and 3.2-metre walls, with continuous steel coping. Walk up the access stairs, then face inward on the deck and push to drop in; pump and carve around the walls.'});
    }else{
      const mini=addSkateTransition(x,y-.45,{flat:.5,radius:.22,height:.14,width:.55});
      mini.spot=mini.spotPark=true;
      skateSpotBox(x-.8,y+.45,.25,.004,.025,'skaterail','metal');
      skateSpotBox(x-.05,y+.45,.3,.1,.02,'manualpad','concrete');
      skateSpotBox(x+.75,y+.45,.25,.035,.035,'skateledge','concrete');
      SKATE_SPOTS.push({id:'skatepark-flow-yard',name:'Flow Yard Skatepark',x:x-half+.1,y,line:{x,y},
        description:'A relaxed park with a wide mini ramp, low flat bar, six-metre manual pad and concrete ledge. Build lines across the open concrete, or practise pumping and rock to fakie.'});
    }
  }
}
