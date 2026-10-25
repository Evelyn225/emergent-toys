// Shared furniture at the Cabin Cove geometry/material standard. These builders
// preserve each caller's footprint and seat height; rounded edges stay geometric.
function furnitureCloth(base) {
  return (i,t,L)=>{
    const footprint=t/projX,fine=coveDetail(t),weave=Math.sin(HIT.u*190)*Math.sin((HIT.v+HIT.w)*190)*.12*fine;
    const seam=coveGroove(HIT.u,.44,.002,footprint)*.3;
    BG[i]=C(base,2.2+L*.36*coveLight(HIT.nx,HIT.ny,HIT.nz)+weave-seam);set(i,' ',0);return true;
  };
}
function drawFurnitureSofa(vx,vy,hl,fx,fy,col=BRICK,seat=.48) {
  const c=-fy,s=fx,cloth=furnitureCloth(col),at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
  const part=(u,v,hx,hy,z0,z1,rad,mat='wood')=>{const[x,y]=at(u,v);coveRound(x,y,c,s,hx,hy,z0,z1,rad,mat);};
  for(const u of [-hl+.15,hl-.15])for(const v of [-.27,.27])part(u,v,.045,.045,0,.16,.018);
  part(0,0,hl-.04,.37,.12,seat-.18,.035);
  const count=hl>1.3?3:2,inside=hl-.18,width=inside/count;
  for(let k=0;k<count;k++) {
    const u=-inside+width*(2*k+1);
    part(u,.035,width-.012,.335,seat-.18,seat,.065,cloth);
    part(u,-.32,width-.012,.07,seat-.015,.94,.06,cloth);
  }
  // Arm pads join the base and rear bolster rather than ending inside the seat.
  for(const sign of [-1,1])part(sign*(hl-.085),0,.085,.39,seat-.2,.73,.065,cloth);
}
function drawFurnitureChair(vx,vy,fx,fy,col=BRICK) {
  const c=-fy,s=fx,at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
  const part=(u,v,hx,hy,z0,z1,rad,mat='wood')=>{const[x,y]=at(u,v);coveRound(x,y,c,s,hx,hy,z0,z1,rad,mat);};
  for(const u of [-.23,.23])for(const v of [-.23,.23])part(u,v,.035,.035,0,v<0?1.12:.42,.012);
  for(const u of [-.23,.23])part(u,0,.024,.23,.18,.225,.008);
  for(const v of [-.23,.23])part(0,v,.23,.025,.34,.42,.01);
  part(0,0,.3,.3,.42,.5,.035,furnitureCloth(col));
  for(const z of [.79,1.025])part(0,-.255,.265,.035,z-.075,z+.075,.025);
}
function drawFurnitureTable(vx,vy,hl=.6,hw=.4,height=.78) {
  const legX=Math.max(.055,hl-.11),legY=Math.max(.055,hw-.11),under=height-.06;
  for(const x of [-legX,legX])for(const y of [-legY,legY])coveRound(vx+x,vy+y,1,0,.042,.042,0,under,.014,'wood');
  for(const y of [-legY,legY])coveRound(vx,vy+y,1,0,legX,.026,under-.12,under,.01,'wood');
  for(const x of [-legX,legX])coveRound(vx+x,vy,1,0,.026,legY,under-.12,under,.01,'wood');
  coveRound(vx,vy,1,0,hl,hw,under,height,.023,(i,t,L)=>{
    coveTimber(i,HIT.u,HIT.v,L,t,HIT.nx,HIT.ny,HIT.nz,3);
    if(HIT.face===5){const joint=coveGroove(HIT.v+hw,.24,.003,t/projX);BG[i]=C(BRICK,(BG[i]&15)-joint*.7);}
    return true;
  });
}

// Bedding, carcasses and their blocking footprints are authored together. The
// local v axis runs from the headboard toward the foot; u runs across the bed.
function furnitureModel(x,y,c,s,hl,hw,height,draw) {
  return {...ROOM_MODEL(x,y,draw),radius:Math.hypot(hl,hw),box:boxAt(x,y,c,s,hl,hw,0,height)};
}
function FURNITURE_BED(x,y,halfWidth,halfLength,col=BLUE,angle=0,top=.55,headHeight=1) {
  const c=Math.cos(angle),s=Math.sin(angle),at=(u,v)=>[x+c*u-s*v,y+s*u+c*v];
  const frameTop=top-.2,pillowTop=top+.14;
  const body=furnitureModel(x,y,c,s,halfWidth,halfLength,pillowTop,(vx,vy)=>{
    const part=(u,v,hl,hw,z0,z1,r,material='wood')=>coveRound(vx+c*u-s*v,vy+s*u+c*v,c,s,hl,hw,z0,z1,r,material);
    for(const u of [-halfWidth+.13,halfWidth-.13])for(const v of [-halfLength+.16,halfLength-.16])part(u,v,.055,.055,0,.2,.018);
    part(0,0,halfWidth,halfLength,.15,frameTop,.03);
    part(0,0,halfWidth-.025,halfLength-.025,frameTop,top-.035,.07,furnitureCloth(WHITE));
    // A separate tucked duvet follows the same head/foot direction as the frame.
    const shoulder=-halfLength*.28,foot=halfLength-.03;
    part(0,(shoulder+foot)/2,halfWidth-.02,(foot-shoulder)/2,top-.035,top,.016,furnitureCloth(col));
    part(0,shoulder+.045,halfWidth-.025,.055,top,top+.025,.012,furnitureCloth(col));
    const two=halfWidth>.7,count=two?2:1,pillowWidth=two?halfWidth*.4:halfWidth*.77;
    for(let k=0;k<count;k++)part(two?(k-.5)*halfWidth:.0,-halfLength*.66,pillowWidth,halfLength*.22,top-.01,pillowTop,.065,furnitureCloth(WHITE));
  });
  const [hx,hy]=at(0,-halfLength-.05),head=furnitureModel(hx,hy,c,s,halfWidth+.08,.08,headHeight,(vx,vy)=>{
    const part=(u,hw,z0,z1,r,seed)=>coveRound(vx+c*u,vy+s*u,c,s,hw,.08,z0,z1,r,'wood',seed);
    for(const side of [-1,1])part(side*(halfWidth+.04),.04,.1,headHeight,.025,7);
    part(0,halfWidth,.1,.34,.025,7);part(0,halfWidth,headHeight-.12,headHeight,.025,7);
    // A thinner panel fits between the rails and stiles, recessed on both faces.
    coveRound(vx,vy,c,s,halfWidth,.045,.31,headHeight-.1,.015,'wood',9);
  });
  body.furniture='bed';head.furniture='headboard';return [body,head];
}
function FURNITURE_STORAGE(x,y,hl,hw,height,angle=0,open=false) {
  const c=Math.cos(angle),s=Math.sin(angle),thick=.035,base=.085,cap=height-.045;
  const levels=[base,.37*height,.69*height],books=[];
  if(open)for(let shelf=0;shelf<2;shelf++)for(let k=0;k<3;k++)
    books.push(homeShelfBook((k-1)*.057+(shelf?1:-1)*hl*.43,hw*.1,levels[shelf]+.035,.17+((k+shelf)%3)*.023,Math.min(.07,hw-.04),[BLUE,STONE,BRICK][(k+shelf)%3],shelf*3+k));
  const model=furnitureModel(x,y,c,s,hl,hw,height,(vx,vy)=>{
    const part=(u,v,hx,hy,z0,z1,r=.01,material='wood')=>coveRound(vx+c*u-s*v,vy+s*u+c*v,c,s,hx,hy,z0,z1,r,material);
    // Recessed plinth, joined side walls, back and cap. A shelf's top remains the
    // exact support plane used by home.decor, not a second floating trim board.
    part(0,0,hl-.035,hw-.025,0,base,.012);
    for(const side of [-1,1])part(side*(hl-thick/2),0,thick/2,hw,base,cap);
    part(0,-hw+thick/2,hl-thick,thick/2,base,cap);
    part(0,0,hl,hw,cap,height,.015);
    if(open) {
      for(const z of levels)part(0,0,hl-thick,hw-thick,z,z+.035,.008);
      for(const book of books)book.draw(vx,vy,c,s);
    }else {
      const drawer=height<1.25,doorTop=drawer?height-.27:height-.075,doorBottom=base+.025;
      const half=(hl-.05)/2;
      for(const side of [-1,1]) {
        part(side*half,hw-.038,half-.008,.014,doorBottom,doorTop,.012);
        const u=side*.045,z=drawer?(doorBottom+doorTop)/2:height*.55;
        const ax=vx+c*u-s*(hw-.012),ay=vy+s*u+c*(hw-.012);
        coveTube(ax,ay,z-.065,ax,ay,z+.065,.009,GRAY);
      }
      if(drawer) {
        part(0,hw-.038,hl-.035,.014,height-.245,height-.07,.012);
        const ax=vx-s*(hw-.012),ay=vy+c*(hw-.012),z=height-.155;
        coveTube(ax-c*.095,ay-s*.095,z,ax+c*.095,ay+s*.095,z,.009,GRAY);
      }
    }
  });
  model.furniture=open?'shelf':'cabinet';
  if(open)model.shelfSurfaces=[...levels.map((z,k)=>({level:k,hl:hl-thick-.009,hw:hw-thick-.009,z:z+.035,ceiling:levels[k+1]??cap})),{level:3,hl:hl-.016,hw:hw-.016,z:height,ceiling:Infinity}].map(q=>({...q,x,y,c,s,key:[x,y,hl,hw,height].join(':'),owner:model,books:books.map(b=>b.bounds).filter(b=>Math.abs(b.z0-q.z)<1e-7)}));
  return model;
}

function furnitureTimber(base=BRICK,unit=1) {
  return (i,t,L)=>{
    coveTimber(i,HIT.u/unit,(HIT.v+HIT.w)/unit,L,t/unit,HIT.nx,HIT.ny,HIT.nz,3);
    if(base!==BRICK)BG[i]=C(base,BG[i]&15);
    return true;
  };
}
function drawFurnitureBench(vx,vy,hl,fx,fy,col=BRICK,back=false,unit=1,base=0) {
  const c=-fy,s=fx,wood=furnitureTimber(col,unit);
  const part=(u,v,hx,hy,z0,z1,r,mat=wood)=>coveRound(vx+(c*u+fx*v)*unit,vy+(s*u+fy*v)*unit,c,s,hx*unit,hy*unit,base+z0*unit,base+z1*unit,r*unit,mat);
  // Two seat boards, four feet, joined side bearers and a low stretcher.
  for(const v of [-.102,.102])part(0,v,hl,.098,.39,.45,.018);
  for(const u of [-hl+.12,hl-.12]) {
    for(const v of [-.145,.145])part(u,v,.035,.035,0,.39,.012,back?GRAY:wood);
    part(u,0,.045,.19,.32,.39,.012,back?GRAY:wood);
  }
  part(0,0,hl-.12,.025,.16,.205,.009,back?GRAY:wood);
  if(back) {
    for(const u of [-hl+.12,hl-.12])part(u,-.19,.03,.03,.18,.85,.012,GRAY);
    for(const z of [.55,.69,.83])part(0,-.19,hl,.035,z-.045,z+.02,.018);
  }
}
function FURNITURE_BENCH(x,y,hl,fx,fy,col=BRICK,back=false) {
  return furnitureModel(x,y,-fy,fx,hl,back?.23:.2,back?.85:.45,
    (vx,vy)=>drawFurnitureBench(vx,vy,hl,fx,fy,col,back));
}
function FURNITURE_STOOL(x,y,col=RED,seatZ=.62,low=false,fx=0,fy=1) {
  const model=furnitureModel(x,y,1,0,low?.16:.2,low?.16:.2,seatZ,(vx,vy)=>{
    if(low) {
      const mat=(i,t,L)=>{BG[i]=C(col,2.7+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
      const part=(u,v,hx,hy,z0,z1,r)=>coveRound(vx+u,vy+v,1,0,hx,hy,z0,z1,r,mat);
      for(const u of [-.12,.12])for(const v of [-.12,.12])part(u,v,.025,.025,0,seatZ-.045,.009);
      for(const u of [-.12,.12])part(u,0,.022,.12,.15,.19,.008);
      part(0,0,.16,.16,seatZ-.055,seatZ,.023);
    }else {
      const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
      coveLathe(vx,vy,0,[[0,0],[0,.175],[.008,.2],[.025,.2],[.04,.16],[.055,.045],[seatZ-.075,.025],[seatZ-.06,0]],metal);
      const ring=.26;
      const profile=Array.from({length:17},(_,k)=>{const a=k*Math.PI/8-Math.PI/2;return [ring+Math.sin(a)*.012,.15+Math.cos(a)*.012];});
      coveLathe(vx,vy,0,profile,metal);
      for(let k=0;k<3;k++) {
        const a=k*Math.PI*2/3;
        coveRound(vx+Math.cos(a)*.075,vy+Math.sin(a)*.075,Math.cos(a),Math.sin(a),.075,.008,ring-.008,ring+.008,.006,GRAY);
      }
      const cloth=furnitureCloth(col);
      coveLathe(vx,vy,seatZ-.08,[[0,0],[0,.16],[.015,.185],[.045,.19],[.065,.18],[.08,.145],[.08,0]],cloth);
    }
  });
  return {...model,seat:true,fx:low?fx:undefined,fy:low?fy:undefined,h:seatZ};
}
function FURNITURE_COUNTER(x,y,half,height=1.05) {
  const model=furnitureModel(x,y,1,0,half,.3,height,(vx,vy)=>{
    coveRound(vx,vy,1,0,half-.05,.255,0,.12,.012,'wood');
    coveRound(vx,vy,1,0,half-.035,.265,.1,height-.065,.018,'wood');
    const count=Math.ceil(half*2/.9),panel=half/count;
    for(let k=0;k<count;k++)coveRound(vx-half+panel*(2*k+1),vy+.277,1,0,panel-.04,.013,.2,height-.15,.01,'wood',k+2);
    coveRound(vx,vy,1,0,half,.3,height-.065,height,.025,(i,t,L)=>{
      BG[i]=C(STONE,4+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    });
  });
  model.furniture='counter';return model;
}
function FURNITURE_REGISTER(x,y,height) {
  return {...furnitureModel(x,y,1,0,.18,.15,height+.25,(vx,vy)=>{
    // Shared counters put their keeper on -Y: keys and display face the keeper.
    coveRound(vx,vy,1,0,.18,.15,height,height+.045,.015,GRAY);
    coveRound(vx,vy+.055,1,0,.15,.07,height+.04,height+.24,.015,GRAY);
    const dark=C(GRAY,.3);
    drawBox(boxAt(vx,vy-.016,-1,0,.13,.002,height+.115,height+.215),(i,t,L)=>{
      BG[i]=dark;
      if(HIT.face!==3||!wallText(i,HIT.u,t/projX,HIT.w,t,'0.00',0,height+.165,.043,.07,C(GREEN,11),dark))set(i,' ',0);
      return true;
    });
    for(let row=0;row<3;row++)for(let k=0;k<4;k++)coveRound(vx-(k-1.5)*.055,vy-.048-row*.033,1,0,.021,.012,height+.045,height+.055,.004,k===3?GREEN:STONE);
  }),box:boxAt(x,y,1,0,.18,.15,height,height+.25)};
}

function drawFurniturePedestal(vx,vy,height,radius=.22) {
  coveLathe(vx,vy,0,[[0,0],[0,radius-.018],[.012,radius],[.035,radius],[.055,.07],[height-.09,.045],[height-.05,.12],[height-.045,0]],
    (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
}
function FURNITURE_EAT_TABLE(x,y,hl,hw,shade,height=.76) {
  return furnitureModel(x,y,1,0,hl,hw,height,(vx,vy)=>{
    drawFurniturePedestal(vx,vy,height,Math.min(.22,hl*.65,hw*.65));
    coveRound(vx,vy,1,0,hl,hw,height-.05,height,.018,shade);
  });
}
function FURNITURE_ROUND_TABLE(x,y,r,height,col,susan=false) {
  return furnitureModel(x,y,1,0,r*.8,r*.8,height,(vx,vy)=>{
    drawFurniturePedestal(vx,vy,height,Math.min(.24,r*.55));
    coveLathe(vx,vy,height-.05,[[0,0],[0,r-.02],[.012,r],[.035,r],[.05,r-.018],[.05,0]],furnitureCloth(col));
    if(susan) {
      const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
      coveLathe(vx,vy,height,[[0,0],[0,r*.18],[.012,r*.18],[.012,r*.43],[.025,r*.45],[.035,r*.43],[.035,0]],metal);
      for(let k=0;k<3;k++) {
        const a=k*Math.PI*2/3+T*.08,rr=r*.14;
        coveLathe(vx+Math.cos(a)*r*.24,vy+Math.sin(a)*r*.24,height+.035,
          [[0,0],[0,rr*.45],[.008,rr*.9],[.015,rr],[.02,rr*.9],[.012,rr*.3],[.012,0]],
          (i,t,L)=>{BG[i]=C(WHITE,4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
      }
    }
  });
}
function FURNITURE_BOOTH_SEAT(x,y,hl,depth,fy,col) {
  const cloth=furnitureCloth(col),count=Math.max(2,Math.ceil(hl/.65)),width=hl/count;
  const seat=furnitureModel(x,y,1,0,hl,depth/2,.46,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl-.04,depth/2-.03,0,.15,.025,'wood');
    coveRound(vx,vy,1,0,hl,depth/2,.13,.32,.03,'wood');
    for(let k=0;k<count;k++)coveRound(vx-hl+width*(2*k+1),vy,1,0,width-.006,depth/2,.31,.46,.06,cloth);
  });
  const by=y-fy*(depth/2-.06),back={...furnitureModel(x,by,1,0,hl,.07,1.25,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,.07,.33,1.25,.045,'wood');
    for(let k=0;k<count;k++)coveRound(vx-hl+width*(2*k+1),vy+fy*.018,1,0,width-.007,.052,.46,1.23,.045,cloth);
  }),box:boxAt(x,by,1,0,hl,.07,.33,1.25)};
  return [seat,back];
}
function FURNITURE_SHELL_CHAIR(x,y,fx,fy,col) {
  const c=-fy,s=fx,plastic=(i,t,L)=>{BG[i]=C(col,3+L*.31*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const seat={...furnitureModel(x,y,1,0,.22,.22,.47,(vx,vy)=>{
    for(const u of [-.17,.17])for(const v of [-.17,.17])coveRound(vx+u,vy+v,1,0,.015,.015,0,.425,.006,GRAY);
    coveRound(vx,vy,1,0,.22,.22,.415,.47,.025,plastic);
  }),seat:true,fx,fy,h:.47};
  const bx=x-fx*.1825,by=y-fy*.1825,back={...furnitureModel(bx,by,c,s,.22,.0575,.86,(vx,vy)=>{
    // One shallow curve, swept across the back. Adjacent ribs overlap at their
    // ends; the shell stays within the existing rear edge of the chair.
    for(let k=0;k<6;k++) {
      const u0=-.21+k*.07,u1=u0+.07,v0=-.0275+.055*(u0/.22)**2,v1=-.0275+.055*(u1/.22)**2;
      const du=u1-u0,dv=v1-v0,len=Math.hypot(du,dv),u=(u0+u1)/2,v=(v0+v1)/2;
      coveRound(vx+c*u+fx*v,vy+s*u+fy*v,(c*du+fx*dv)/len,(s*du+fy*dv)/len,len/2+.004,.022,.45,.86,.018,plastic);
    }
  }),box:boxAt(bx,by,c,s,.22,.0575,.45,.86)};
  return [seat,back];
}
function FURNITURE_POUF(x,y,col,fx,fy,height=.4) {
  return {...furnitureModel(x,y,1,0,.24,.24,height,(vx,vy)=>{
    coveLathe(vx,vy,0,[[0,0],[0,.2],[.035,.22],[height*.35,.24],[height-.055,.235],[height-.02,.22],[height,.18],[height,0]],furnitureCloth(col));
  }),seat:true,fx,fy,h:height};
}
