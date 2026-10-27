// Paving coordinates are metres from the balcony's west/north corner. Both
// the native floor and city slab use them; small joints filter into the stone.
const HOME_BALCONY_PAVING={tile:.5,grout:.008,depth:.25};
function homeBalconyPaving(i,u,v,L,footprint){
  const p=HOME_BALCONY_PAVING,joint=Math.max(coveGroove(u,p.tile,p.grout,footprint),coveGroove(v,p.tile,p.grout,footprint));
  BG[i]=C(STONE,2.8+L*.22-joint*2.2);set(i,' ',0);return true;
}
function homeBalconyPavingFootprint(t,height,unit=1){
  // Row-to-row floor spacing grows faster at grazing angles than distance
  // alone. Account for both screen axes before filtering the metre joints.
  return Math.max(t/projX,t*t/(Math.max(.001/unit,Math.abs(height))*projY))*unit;
}
const homeBalconyDeckModels=new WeakMap();
function homeBalconyDeckModel(home,b){
  let m=homeBalconyDeckModels.get(home),q=m?.bounds;
  if(!q||q.x0!==b.x0||q.x1!==b.x1||q.y0!==b.y0||q.y1!==b.y1||q.z!==b.z){
    const bounds={x0:b.x0,x1:b.x1,y0:b.y0,y1:b.y1,z:b.z},x=(b.x0+b.x1)/2,y=(b.y0+b.y1)/2,hl=(b.x1-b.x0)/2,hw=(b.y1-b.y0)/2;
    const local=boxAt(0,0,1,0,hl,hw,b.z-HOME_BALCONY_PAVING.depth/10,b.z);
    m={bounds,x,y,local,view:{...local}};
    m.shade=(i,t,L)=>{
      const f=HIT.face;
      if(f===5){
        homeBalconyPaving(i,(HIT.u+hl)*10,(HIT.v+hw)*10,L,homeBalconyPavingFootprint(t,eye-bounds.z,10));
        paintSettledSnow(i,x+HIT.u,y+HIT.v,L,1,0,HIT.w);
      }else{BG[i]=C(STONE,f===6?1.5+L*.1:2+L*.16);set(i,' ',0);}
      return true;
    };
    homeBalconyDeckModels.set(home,m);
  }
  return m;
}
function drawHomeBalconyDeck(home,b){
  const m=homeBalconyDeckModel(home,b);m.view.x=rel(m.x-px);m.view.y=rel(m.y-py);drawBox(m.view,m.shade);
}
