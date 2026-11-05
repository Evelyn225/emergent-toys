function drawRoadBridges() {
  if(!worldReady)return;
  drawAirportBridge();
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
          const edge=Math.abs(HIT.u),along=HIT.v+(y0+y1)/2,fp=t/projY,Ld=L*roadDark(),S=ROAD_SURFACE;
          BG[i]=C(GRAY,1+L*.14);
          if(snowCover>.02){paintSettledSnow(i,b.x+HIT.u,along,L,1,edge<.73?.6:.08,HIT.w);if((BG[i]>>4)===WHITE)return true;}
          // an expansion joint across the deck every 6 cells: a steel finger plate, lit
          const joint=roadLine(Math.abs(fract(along/6+.5)-.5)*6,.012,fp);
          if(edge>.76){ // the walkways: precast slabs, their joints filtered
            const j=Math.max(coveGroove(along,S.slab,S.joint,fp),coveGroove(edge,S.slab,S.joint,fp));
            BG[i]=C(GRAY,Ld*(.44-j*.18+joint*.12));return set(i,' ',0),true;
          }
          if(edge>.73){BG[i]=C(GRAY,Ld*.62);return set(i,' ',0),true;} // the kerb
          if(joint>.5){BG[i]=C(GRAY,Ld*.55);return set(i,' ',0),true;}
          const centre=roadLine(edge,S.centreW,fp)*roadBands(along+S.dash/4,S.dash,.5,fp);
          BG[i]=centre>.5?C(YEL,Ld*.55):C(GRAY,Ld*(.3+centre*.2+(hash(Math.floor(HIT.u*15),Math.floor(along*15),61)-.5)*.04*clamp(1-fp/.03,0,1)));
          return set(i,' ',0),true;
        }
        // the girders' faces: a lit fascia under the deck edge, stiffeners down the web, the soffit in shadow
        const fp=t/projY,top=h0+(h1-h0)*clamp((HIT.v+o.hw)/(2*o.hw),0,1)-HIT.w;
        if(HIT.face===6){BG[i]=C(GRAY,.7+L*.1);return set(i,' ',0),true;}
        const st=roadLine(Math.abs(fract(HIT.v*4+.5)-.5)/4,.012,fp);
        BG[i]=C(GRAY,(.8+L*.18)*shadeFace(HIT.face)+(top<.02?.7:st*.5-(top<.035?.4:0)));return set(i,' ',0),true;
      },rayBeveledBay);
      for(const side of [-1,1])for(const up of [.055,.115])drawRod(vx+side*.97,rel(y0-py),h0+up,vx+side*.97,rel(y1-py),h1+up,.007,(i,t,L)=>{BG[i]=C(GRAY,1+L*.4+(up>.1?.5:0));set(i,' ',0);return true;});
    }
    for(let y=b.y0;y<=b.y1;y+=2)for(const side of [-1,1]) {
      const h=roadBridgeHeight(b,y);
      drawBox(boxAt(vx+side*.97,rel(y-py),1,0,.009,.009,h,h+.115),STEEL.cap);
    }
    for(const y of [b.y0+b.ramp+2,b.y1-b.ramp-2]) {
      drawBox(boxAt(vx,rel(y-py),1,0,1.42,.34,b.h-b.thickness-.12,b.h-b.thickness+.015),STEEL.cap);
    }
    for(const y of [b.y0+b.ramp+2,b.y1-b.ramp-2])for(const side of [-1,1]) {
      drawBox(boxAt(vx+side*1.25,rel(y-py),1,0,.14,.32,0,b.h-b.thickness),STEEL.cap);
    }
  }
}

const airportBridgeMeshes=new Map();
function drawAirportBridge(){
  const layout=airportBridgeLayout();if(!layout)return;
  const S=AIRPORT_BRIDGE;
  const metal=(i,t,L)=>{BG[i]=C(GRAY,(1.5+L*.28)*shadeFace(HIT.face));set(i,' ',0);return true;};
  for(const b of layout.sections){
    if(!inView(b.x-px,b.y-py,Math.hypot(b.hl,b.hw)+1))continue;
    let mesh=airportBridgeMeshes.get(b);if(!mesh){mesh={...boxAt(b.x,b.y,1,0,b.hl,b.hw,Math.min(b.h0,b.h1)-S.thickness,Math.max(b.h0,b.h1)),planes:courierSurfacePlanes(b),airportBridgeDeck:b.id};airportBridgeMeshes.set(b,mesh);}
    drawBox({...mesh,x:b.x-px,y:b.y-py},(i,t,L)=>{
      const fp=t/projY,across=b.axis==='x'?HIT.v:HIT.u,along=(b.axis==='x'?HIT.u+b.x:HIT.v+b.y),edge=Math.abs(across),Ld=L*roadDark();
      if(HIT.face===5){
        const turn=b.id==='turn',kerb=edge>.55&&!turn,joint=coveGroove(along,4,.016,fp);
        const line=!turn&&edge<.53?roadLine(edge,.025,fp)*roadBands(along,1,.5,fp):0;
        BG[i]=C(line>.5?YEL:GRAY,line>.5?2+Ld*.5:kerb?2+Ld*.45-joint:1.2+Ld*.27-joint*.5);if(snowCover>.02)paintSettledSnow(i,b.x+HIT.u,b.y+HIT.v,L,1,edge<.53?.6:.08,HIT.w);set(i,' ',0);return true;
      }
      BG[i]=C(GRAY,HIT.face===6?.6+L*.1:(1.2+L*.25)*shadeFace(HIT.face));set(i,' ',0);return true;
    },rayBeveledBay);
  }
  for(const p of layout.piers){
    const top=airportBridgeGround(p.x,p.y)-S.thickness;
    if(!inView(p.x-px,p.y-py,2))continue;
    drawBox(boxAt(p.x-px,p.y-py,1,0,p.hl,p.hw,-.6,top),metal);
    drawBox(boxAt(p.x-px,p.y-py,1,0,S.capX,S.capY,top-S.capDepth,top+.015),metal);
  }
  for(const r of layout.rails){
    const length=Math.hypot(r.x1-r.x0,r.y1-r.y0);if(!inView((r.x0+r.x1)/2-px,(r.y0+r.y1)/2-py,length/2+1))continue;
    for(const up of [.055,S.rail])rod(r.x0-px,r.y0-py,airportBridgeGround(r.x0,r.y0)+up,r.x1-px,r.y1-py,airportBridgeGround(r.x1,r.y1)+up,.006,GRAY,1.2);
    const n=Math.ceil(length/1.8);for(let k=0;k<=n;k++){const q=k/n,x=r.x0+(r.x1-r.x0)*q,y=r.y0+(r.y1-r.y0)*q,h=airportBridgeGround(x,y);drawBox(boxAt(x-px,y-py,1,0,.012,.012,h,h+S.rail),metal);}
  }
}
