// Fit the authored market as complete stalls, after native doors and ordinary
// street fixtures are final and before the later kerb fixtures are generated.
// Parts, sellers and interaction points keep their exact relative positions.
const NIGHT_MARKET_PLACEMENT = {moved:0,unfitted:[]};
function fitNightMarket() {
  NIGHT_MARKET_PLACEMENT.moved=0;NIGHT_MARKET_PLACEMENT.unfitted.length=0;
  const allParts=new Set(NIGHT_MARKET_GROUPS.flatMap(g=>g.parts));
  const cellsFor=o=>{
    const cells=[],[ex,ey]=geometryBounds(o);
    for(let y=Math.floor(o.y-ey);y<=Math.floor(o.y+ey);y++)for(let x=Math.floor(o.x-ex);x<=Math.floor(o.x+ex);x++)cells.push(idx(x,y));
    return cells;
  };
  const touched=new Set([...allParts].flatMap(cellsFor));
  const body=(p,dx=0)=>({x:p.x+dx,y:p.y,c:1,s:0,hl:.03,hw:.03,z0:0,z1:.18});
  const groupBoxes=(g,dx=0)=>[...g.parts.map(p=>({...p,x:p.x+dx})),body(g.seller,dx)];
  for(const g of NIGHT_MARKET_GROUPS) {
    const {counter,seller}=g,start=counter.x;
    const clear=dx=>{
      const boxes=groupBoxes(g,dx),x=start+dx,y=counter.y;
      // Remain on this pavement with a real wall behind the seller. Sliding
      // across a corner or into the road is not a fallback for an entrance.
      for(const u of [-NIGHT_STALL.roofHalf,0,NIGHT_STALL.roofHalf])
        if(!ROAD[idx(x+u,y)] || isWater(x+u,y) || !map[idx(x+u,y+.3)])return false;
      if(boxes.some(b=>streetEntranceCollision(b)||streetGeometryCollision(b,true,allParts)))return false;
      if(streetEntranceNeighboursOverlap({x,y},null,boxes))return false;
      for(const other of NIGHT_MARKET_GROUPS)if(other!==g)
        for(const a of boxes)for(const b of groupBoxes(other))if(streetBoxesOverlap(a,b,.015))return false;
      return true;
    };
    let fitted=null;
    for(const dx of [0,...Array.from({length:30},(_,n)=>[(n+1)*-.05,(n+1)*.05]).flat()])if(clear(dx)){fitted=dx;break;}
    if(fitted===null){NIGHT_MARKET_PLACEMENT.unfitted.push(counter.word);continue;}
    if(!fitted)continue;
    for(const p of g.parts)p.x=worldCoord(p.x+fitted);
    seller.x=worldCoord(seller.x+fitted);counter.at[0]=worldCoord(counter.at[0]+fitted);
    NIGHT_MARKET_PLACEMENT.moved++;
  }
  // Only the market's affected geometry cells change. Other architecture and
  // its cached snow shelters remain intact; clear old/new market shelter cells.
  for(const cell of touched) {
    const list=streetGeometryCells[cell];if(list)streetGeometryCells[cell]=list.filter(p=>!allParts.has(p));
  }
  for(const p of allParts)for(const cell of cellsFor(p)) {
    touched.add(cell);(streetGeometryCells[cell]||(streetGeometryCells[cell]=[])).push(p);
  }
  for(const cell of touched)delete groundSnowCells[cell];
  for(const [items,buckets]of [[solids,solidsB],[extras,extrasB]]) {
    for(const b of buckets)b.length=0;
    for(const p of items)buckets[bi(Math.floor(p.x/8),Math.floor(p.y/8))].push(p);
  }
}
fitNightMarket();
