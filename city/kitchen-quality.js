// Fitted kitchen units share the same top, opening and appliance measurements.
// Local u runs along the cupboards; +v is the usable front of the counter.
function kitchenTopProfile(hl,hw,bottom,top,bevel=.015) {
  const planes=[[1,0,0,hl,1],[-1,0,0,hl,2],[0,1,0,hw,3],[0,-1,0,hw,4],
    [0,0,1,top,5],[0,0,-1,-bottom,6],
    [1,0,1,hl+top-bevel,7],[-1,0,1,hl+top-bevel,8],
    [0,1,1,hw+top-bevel,9],[0,-1,1,hw+top-bevel,10]];
  const normals=Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]));
  return {planes,normals};
}
function kitchenPanelProfile(hl,hw,bottom,top,bevel=.006) {
  const planes=[[1,0,0,hl,1],[-1,0,0,hl,2],[0,1,0,hw,3],[0,-1,0,hw,4],
    [0,0,1,top,5],[0,0,-1,-bottom,6],[1,1,0,hl+hw-bevel,7],[-1,1,0,hl+hw-bevel,8],
    [0,1,1,hw+top-bevel,9],[0,1,-1,hw-bottom-bevel,10]];
  return {planes,normals:Object.fromEntries(planes.map(p=>[p[4],p.slice(0,3).map(v=>v/Math.hypot(...p.slice(0,3)))]))};
}
function FITTED_KITCHEN(x,y,hl,depth,angle=0,color=BRICK) {
  const c=Math.cos(angle),s=Math.sin(angle),compact=hl<.8,height=.94;
  const sink=compact?-.265:-hl+.37,radius=compact?.18:.235,hob=compact?.25:0;
  const top=kitchenTopProfile(hl,depth,height-.065,height),ovenHalf=compact?.22:.28;
  const count=Math.max(2,Math.round(hl*2/.62)),half=hl/count;
  const doorProfile=kitchenPanelProfile(half-.009,.014,.12,.66),drawerProfile=kitchenPanelProfile(half-.04,.008,.68,.86),
    ovenProfile=kitchenPanelProfile(ovenHalf,.014,.13,.875);
  const model=ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const part=(u,v,hx,hy,z0,z1,shade,bevel=.012)=>{
      const[xx,yy]=at(u,v);coveRound(xx,yy,c,s,hx,hy,z0,z1,bevel,shade);
    };
    const pipe=(u,v,z,uu,vv,zz,r=.012,base=GRAY)=>bathroomPipe(...at(u,v),z,...at(uu,vv),zz,r,base);
    const wood=furnitureTimber(color),flatWood=(i,t,L)=>{
      const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;
      coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,c*nu-s*nv,s*nu+c*nv,f===6?-1:0,3);
      if(color!==BRICK)BG[i]=C(color,BG[i]&15);return true;
    };
    // The recessed plinth meets the floor; the carcass has no hidden top face
    // that could cap the sink. Only the fitted worktop owns that surface.
    part(0,-.035,hl-.035,depth-.075,0,.1,wood);
    drawBox(boxAt(vx,vy,c,s,hl-.025,depth-.025,.09,height-.065),(i,t,L)=>HIT.face===5?false:flatWood(i,t,L));
    for(let k=0;k<count;k++) {
      const u=-hl+half*(2*k+1);
      if(Math.abs(u-hob)<ovenHalf+half*.5)continue;
      const [xx,yy]=at(u,depth-.008),[dx,dy]=at(u,depth+.008);
      drawBox({...boxAt(xx,yy,c,s,half-.009,.014,.12,.66),...doorProfile},wood,homeRayWorktop);
      drawBox({...boxAt(dx,dy,c,s,half-.04,.008,.68,.86),...drawerProfile},wood,homeRayWorktop);
      pipe(u-.075,depth+.025,.77,u+.075,depth+.025,.77,.009);
    }
    drawBox({...boxAt(vx,vy,c,s,hl,depth,height-.065,height),...top},(i,t,L)=>{
      if(HIT.face===5&&Math.hypot(HIT.u-sink,HIT.v)<radius*.96)return false;
      return homeStone(i,t,L);
    },homeRayWorktop);
    // The sink's lip, inner bowl and bottom are one closed revolved profile.
    const [sx,sy]=at(sink,0);
    coveLathe(sx,sy,.74,[[0,0],[0,.04],[.02,radius*.4],[.16,radius*.88],[.205,radius],
      [.211,radius],[.211,radius*.92],[.16,radius*.85],[.04,radius*.34],[.034,0]],
      (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
    coveLathe(sx,sy,.775,[[0,0],[0,.024],[.003,.024],[.003,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
    const [tx,ty]=at(sink,.19-radius-.045);bathroomTap(tx,ty,-s,c,height);

    const active=cookingOn()==='stove',baking=active&&RECIPE[cookCtx?.recipe]?.how==='oven';
    for(const u of compact?[0]:[-.135,.135])for(const v of [-.135,.135]) {
      const [bx,by]=at(hob+u,v),r=compact?.075:.09;
      coveLathe(bx,by,height,[[0,0],[0,r],[.014,r],[.014,0]],(i,t,L)=>{
        BG[i]=C(GRAY,(.65+L*.12)*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
      });
      coveLathe(bx,by,height+.014,[[0,r*.6],[0,r*.78],[.005,r*.78],[.005,r*.6],[0,r*.6]],(i,t,L)=>{
        BG[i]=active&&!baking?C(RED,7+Math.sin(T*4)*.6):C(GRAY,1.4+L*.12);set(i,' ',0);return true;
      });
    }
    // A separate enamel door, recessed dark glass, supported handle and knobs.
    // Heat changes only the elements or oven glass, never the cupboard case.
    const enamel=(i,t,L)=>{BG[i]=C(WHITE,(1.1+L*.28)*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const [ox,oy]=at(hob,depth+.016);
    drawBox({...boxAt(ox,oy,c,s,ovenHalf,.014,.13,.875),...ovenProfile},(i,t,L)=>{
      if(HIT.face===3&&Math.abs(HIT.u)<ovenHalf-.035&&HIT.w>.23&&HIT.w<.62)return false;
      return enamel(i,t,L);
    },homeRayWorktop);
    const [gx,gy]=at(hob,depth+.025);
    drawBox(boxAt(gx,gy,c,s,ovenHalf-.035,.002,.23,.62),(i,t,L)=>{
      const rack=coveGroove(HIT.w-.3,.11,.004,t/projX);
      BG[i]=C(baking?ORANGE:GRAY,baking?3+Math.sin(T*2)*.2:.45+L*.04);
      set(i,' ',0);if(rack>.25)BG[i]=C(GRAY,1+L*.12);return true;
    });
    pipe(hob-ovenHalf+.045,depth+.07,.69,hob+ovenHalf-.045,depth+.07,.69);
    for(const u of compact?[-.055,.055]:[-.165,-.055,.055,.165])pipe(hob+u,depth+.033,.82,hob+u,depth+.065,.82,.023);
  });
  return {...model,radius:hl+.6,box:boxAt(x-s*.0575,y+c*.0575,c,s,hl,depth+.0575,0,height+.02),
    kitchen:{hl,depth,angle,height,sink,radius,hob,compact}};
}
