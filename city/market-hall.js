// Supported, prepared stock under framed cloth awnings. Local +v faces the
// customer. The same cached shapes serve the quarter-turned side stalls.
const MARKET_KINDS=['fish','greens','butcher','cheese','flowers','bread'];
function MARKET_STALL(x,y,hl,kind,col,fx,fy) {
  const c=fy,s=-fx,hw=.35,top=.9,K=MARKET_KINDS[kind],seed=kind*17+Math.round(x*3+y*5),items=[],crates=[],frame=[];
  const steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  const add=(u,v,box,shade,ray=rayBox)=>items.push({u,v,box,shade,ray});
  const oval=(u,v,z,a,b,h,shade)=>add(u,v,boxAt(0,0,c,s,a,b,z,z+h),shade,foodRayEllipsoid);
  const turned=(u,v,z,profile,shade)=>add(u,v,homeLampPart('stock',z,profile).box,shade,coveRayLathe);
  const tray=(u,v,a,b,h,shade)=>{const base={...boxAt(0,0,1,0,a,b,top,top+h),...kitchenTopProfile(a,b,top,top+h,.002)};
    add(u,v,c===1&&s===0?base:{...base,c,s,trayShape:base},shade,c===1&&s===0?foodRayTray:grocerTrayRay);};
  const solid=(u,v,a,b,z0,z1,r,shade,list=items)=>list.push({u,v,box:{...boxAt(0,0,c,s,a,b,z0,z1),round:r},shade,ray:r?coveRayRounded:rayBox});
  if(K==='fish'){
    const fins=paintShade(GRAY,2.6,.25);
    const ice=gondolaFlat(c,s,(i,t,L)=>{const g=hash(Math.floor(HIT.u*60),Math.floor(HIT.v*60),seed)*coveDetail(t,.2);BG[i]=C(g>.6?WHITE:CYAN,3.6+g*1.5+L*.15);set(i,' ',0);return true;});
    tray(0,0,hl-.08,hw-.04,.06,steel);solid(0,0,hl-.09,hw-.05,top+.008,top+.045,0,ice);
    for(let k=0;k<Math.floor((hl*2-.2)/.3);k++)for(const v of [-.12,.12]){
      const sh=(i,t,L)=>{const belly=HIT.nz>.6&&Math.abs(HIT.v)<.012,eye=(HIT.u+.075)**2+(HIT.w-top-.08)**2<.004**2&&Math.abs(HIT.v)>.018;BG[i]=C(eye?GRAY:belly?WHITE:GRAY,eye?.5:(belly?4:2.8)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+hash(k*2+(v>0),1,seed)*.6);set(i,' ',0);return true;};
      const u=-hl+.25+k*.3;oval(u,v,top+.045,.13,.035,.045,sh);oval(u+.115,v,top+.06,.035,.05,.009,fins);
    }
  }
  if(K==='greens'){const n=Math.floor(hl*2/.5),pitch=hl*2/n;
    for(let k=0;k<n;k++)crates.push({u:-hl+pitch*(k+.5),q:grocerCrate(GROCER_PRODUCE_KINDS[Math.floor(hash(k,2,seed)*GROCER_PRODUCE_KINDS.length)],pitch/2-.06,hw-.06,top+GROCER_CRATE.depth),shade:grocerSlats()});
  }
  if(K==='butcher'){const n=Math.floor(hl*2/.6),pitch=hl*2/n;
    for(let k=0;k<n;k++){const u=-hl+pitch*(k+.5);tray(u,0,pitch/2-.07,hw-.05,.03,steel);
      for(const du of [-.12,0,.12])for(const v of [-.12,.12]){const id=k*7+Math.round(du*10)+(v>0),sh=(i,t,L)=>{const fat=HIT.nz<.5&&HIT.nz>-.2;BG[i]=C(fat?WHITE:id%3?RED:BRICK,(fat?3.6:2.2)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};oval(u+du,v,top+.008,.055,.08,.03,sh);}
    }
  }
  if(K==='cheese'){const rind=[[0,0],[0,.115],[.01,.12],[.07,.12],[.08,.115],[.08,0]],wheel=(i,t,L)=>{const cut=HIT.face===5;BG[i]=C(cut?YEL:ORANGE,(cut?4.2:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    for(let k=0;k<Math.floor(hl*2/.3);k++){const u=-hl+.15+k*.3,stack=1+Math.floor(hash(k,3,seed)*2);for(let j=0;j<stack;j++)turned(u,-.1,top+j*.08,rind,wheel);
      if(k%2===0)solid(u,.17,.07,.04,top,top+.06,.008,paintShade(YEL,4,.3));}
  }
  if(K==='flowers'){const bucket=[[0,0],[0,.09],[.22,.11],[.22,.1],[.01,.08],[.01,0]],stems=[[0,0],[0,.075],[.24,.07],[.24,0]];
    for(let k=0;k<Math.floor(hl*2/.28);k++){const u=-hl+.14+k*.28,v=k%2?.1:-.1,bloom=[RED,MAG,YEL,WHITE,ORANGE][Math.floor(hash(k,4,seed)*5)],petal=paintShade(bloom,3.4,.35);
      turned(u,v,top,bucket,steel);turned(u,v,top+.01,stems,paintShade(GREEN,1.4,.2));
      for(let j=0;j<5;j++){const a=j*TAU/5+k;oval(u+Math.cos(a)*.05,v+Math.sin(a)*.05,top+.24+(j%2)*.03,.035,.035,.05,petal);}
    }
  }
  if(K==='bread'){const wicker=(i,t,L)=>{const w=coveGroove(HIT.u+HIT.w*2,.02,.004,t/projX)*coveDetail(t,.2);BG[i]=C(WARM,2.4-w+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const n=Math.floor(hl*2/.6),pitch=hl*2/n;
    for(let k=0;k<n;k++){const u=-hl+pitch*(k+.5),bh=pitch/2-.07,r=Math.min(.09,(bh-.008)/3);tray(u,0,bh,hw-.06,.08,wicker);
      for(let j=-1;j<=1;j++)for(const v of [-.1,.1]){const id=k*5+j+(v>0),sh=(i,t,L)=>{const score=HIT.nz>.7&&fract((HIT.u+HIT.v)*12)<.15;BG[i]=C(id%2?BRICK:ORANGE,(score?3.4:2.2)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};oval(u+j*2*r,v,top+.008,r,.05,.07,sh);}
    }
  }
  const canopy=gondolaFlat(c,s,(i,t,L)=>{const stripe=fract((HIT.u+hl)*2.5)<.5;BG[i]=C(stripe?col:WHITE,(stripe?4:5)+L*.2);set(i,' ',0);return true;});
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed);
  for(const e of [-1,1])solid(e*(hl-.03),-.3,.025,.025,top,2.15,.008,wood,frame);
  for(const v of [-.685,-.3,.485])solid(0,v,hl+.1,.015,2.15,2.18,.004,steel,frame);
  for(const e of [-1,1])solid(e*(hl+.085),-.1,.015,.6,2.15,2.18,.004,steel,frame);
  solid(0,-.1,hl+.1,.6,2.18,2.188,0,canopy,frame);
  solid(0,.49,hl+.1,.01,2,2.18,0,canopy,frame);
  const draw=(vx,vy,q)=>drawBox({...q.box,x:vx+c*q.u-s*q.v,y:vy+s*q.u+c*q.v},q.shade,q.ray);
  return [SHOP_COUNTER(x,y,hl,hw,top,c,s,BRICK),{...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const q of items)draw(vx,vy,q);
    for(const q of crates)drawGrocerCrate(vx+c*q.u,vy+s*q.u,q.q,q.shade,c,s);
    for(const q of frame)draw(vx,vy,q);
  }),marketStall:{kind:K,hl,hw,top,c,s,items:items.length+crates.length}}];
}
// The fruit shop's table of melons and pineapples: a table, the fruit lying on it.
function MELON_TABLE(x,y,hl,hw,h) {
  const melon=k=>(i,t,L)=>{const stripe=Math.sin(Math.atan2(HIT.v,HIT.u)*7+k)>.35;BG[i]=C(GREEN,(stripe?1.8:3.4)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const pine=(i,t,L)=>{const d=fract((HIT.w*14)+Math.atan2(HIT.v,HIT.u)*1.6)<.25;BG[i]=C(d?BRICK:YEL,(d?2:3.6)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const crown=(i,t,L)=>{BG[i]=C(GREEN,2.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const fruit=[];for(let k=0;k<Math.floor(hl*2/.3);k++)for(const v of [-.18,.18])fruit.push({u:-hl+.15+k*.3,v,pine:k%2===1});
  const melonShades=fruit.map((_,k)=>melon(k)),crownBox=homeLampPart('crown',h+.19,[[0,0],[0,.05],[.12,.01],[.12,0]]).box;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const [k,f] of fruit.entries()){const px=vx+f.u,py=vy+f.v;
      if(f.pine){foodOval(px,py,h,.07,.07,.2,pine);drawBox({...crownBox,x:px,y:py},crown,coveRayLathe);}
      else foodOval(px,py,h,.13,.1,.19,melonShades[k],1,0);}
    drawFurnitureTable(vx,vy,hl,hw,h);
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),melonTable:{h,fruit}};
}
