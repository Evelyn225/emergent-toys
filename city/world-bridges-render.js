function drawRoadBridges() {
  if(!worldReady)return;
  for(const b of ROAD_BRIDGES) {
    const vx=rel(b.x-px),vy=rel((b.y0+b.y1)/2-py);
    if(!inView(vx,vy,(b.y1-b.y0)/2+2))continue;
    const sections=[[b.y0,b.y0+b.ramp,0,b.h],[b.y0+b.ramp,b.y1-b.ramp,b.h,b.h],[b.y1-b.ramp,b.y1,b.h,0]];
    for(const [y0,y1,h0,h1]of sections) {
      const o={hl:b.hw,hw:(y1-y0)/2,h0,h1,axis:'y',thickness:b.thickness};
      const box=boxAt(vx,rel((y0+y1)/2-py),1,0,b.hw,o.hw,Math.min(h0,h1)-b.thickness,Math.max(h0,h1));
      box.planes=courierSurfacePlanes(o);
      drawBox(box,(i,t,L)=>{
        if(HIT.face===5) {
          const edge=Math.abs(HIT.u),along=HIT.v+(y0+y1)/2;
          BG[i]=C(GRAY,1+L*.14);
          if(edge>.73)return set(i,',',C(WHITE,L*.65)),true;
          if(edge<.035&&fract(along*.5)<.55)return set(i,'=',C(YEL,L)),true;
          return set(i,hash(Math.floor(HIT.u*15),Math.floor(along*15),61)>.9?'.':' ',C(GRAY,L*.55)),true;
        }
        BG[i]=C(GRAY,.8+L*.18);return set(i,HIT.face===6?'=':'|',C(GRAY,L*.7)),true;
      },rayBeveledBay);
      for(const side of [-1,1])for(const up of [.055,.115])drawRod(vx+side*.97,rel(y0-py),h0+up,vx+side*.97,rel(y1-py),h1+up,.007,(i,t,L)=>{BG[i]=C(GRAY,1+L*.4);set(i,'=',C(WHITE,L*.8));return true;});
    }
    for(let y=b.y0;y<=b.y1;y+=2)for(const side of [-1,1]) {
      const h=roadBridgeHeight(b,y);
      drawBox(boxAt(vx+side*.97,rel(y-py),1,0,.009,.009,h,h+.115),STEEL.cap);
    }
    for(const y of [b.y0+b.ramp+2,b.y1-b.ramp-2])for(const side of [-1,1]) {
      drawBox(boxAt(vx+side*1.25,rel(y-py),1,0,.14,.32,0,b.h-b.thickness),STEEL.cap);
    }
  }
}
