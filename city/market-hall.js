// The market hall's stalls, built, and the fruit shop's melon table. A stall
// is a timber counter, its customers on (fx,fy), with its goods laid out on a
// display on top, two posts on the stallholder's edge holding up a striped
// awning with a valance along the front.
const MARKET_KINDS=['fish','greens','butcher','cheese','flowers','bread'];
function MARKET_STALL(x,y,hl,kind,col,fx,fy) {
  const c=fy,s=-fx,hw=.35,top=.9,K=MARKET_KINDS[kind],seed=kind*17+Math.round(x*3+y*5);
  const at=(vx,vy,u,v)=>[vx+c*u-s*v,vy+s*u+c*v],turned=Math.abs(s)>.5;
  const steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),items=[];
  // the goods, as [u, v, draw(x, y)] relative to the stall
  if(K==='fish'){
    const ice=(i,t,L)=>{const g=hash(Math.floor(HIT.u*60),Math.floor(HIT.v*60),seed)*coveDetail(t,.2);BG[i]=C(g>.6?WHITE:CYAN,3.6+g*1.5+L*.15);set(i,' ',0);return true;};
    const fish=k=>(i,t,L)=>{const belly=HIT.nz>.6&&Math.abs(HIT.v)<.012;BG[i]=C(belly?WHITE:GRAY,(belly?4:2.8)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+hash(k,1,seed)*.6);set(i,' ',0);return true;};
    items.push([0,0,(px,py)=>{foodTray(px,py,top,turned?hw-.04:hl-.04,turned?hl-.04:hw-.04,.06,steel);drawBox(boxAt(px,py,c,s,hl-.05,hw-.05,top+.008,top+.045),gondolaFlat(c,s,ice));}]);
    for(let k=0;k<Math.floor((hl*2-.2)/.3);k++)for(const v of [-.12,.12]){const u=-hl+.25+k*.3,sh=fish(k*2+(v>0));items.push([u,v,(px,py)=>foodOval(px,py,top+.04,.13,.035,.045,sh,c,s)]);}
  }
  if(K==='greens'){const n=Math.floor(hl*2/.5),pitch=hl*2/n;
    for(let k=0;k<n;k++){const q=grocerCrate(GROCER_PRODUCE_KINDS[Math.floor(hash(k,2,seed)*GROCER_PRODUCE_KINDS.length)],pitch/2-.015,hw-.06,top+GROCER_CRATE.depth),sl=grocerSlats();
      items.push([-hl+pitch*(k+.5),0,(px,py)=>drawGrocerCrate(px,py,q,sl,c,s)]);}}
  if(K==='butcher'){const meat=k=>(i,t,L)=>{const fat=HIT.nz<.5&&HIT.nz>-.2;BG[i]=C(fat?WHITE:k%3?RED:BRICK,(fat?3.6:2.2)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const n=Math.floor(hl*2/.6),pitch=hl*2/n;
    for(let k=0;k<n;k++){const u=-hl+pitch*(k+.5);items.push([u,0,(px,py)=>foodTray(px,py,top,turned?hw-.05:pitch/2-.03,turned?pitch/2-.03:hw-.05,.03,steel)]);
      for(const du of [-.12,0,.12])for(const v of [-.12,.12]){const sh=meat(k*7+Math.round(du*10)+(v>0));items.push([u+du,v,(px,py)=>foodOval(px,py,top+.008,.055,.08,.03,sh,c,s)]);}}}
  if(K==='cheese'){const rind=[[0,0],[0,.115],[.01,.12],[.07,.12],[.08,.115],[.08,0]],wheel=(i,t,L)=>{const cut=HIT.face===5;BG[i]=C(cut?YEL:ORANGE,(cut?4.2:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const n=Math.floor(hl*2/.3);
    for(let k=0;k<n;k++){const u=-hl+.15+k*.3,stack=1+Math.floor(hash(k,3,seed)*2);for(let j=0;j<stack;j++)items.push([u,-.1,(px,py)=>coveLathe(px,py,top+j*.08,rind,wheel)]);
      if(k%2===0)items.push([u,.17,(px,py)=>{const [a,b]=[.07,.04];coveRound(px,py,c,s,a,b,top,top+.06,.008,(i,t,L)=>{BG[i]=C(YEL,4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});}]);}}
  if(K==='flowers'){const bucket=[[0,0],[0,.09],[.22,.11],[.22,.1],[.01,.08],[.01,0]],zinc=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
    const n=Math.floor(hl*2/.28);
    for(let k=0;k<n;k++){const u=-hl+.14+k*.28,v=k%2?.1:-.1,bloom=[RED,MAG,YEL,WHITE,ORANGE][Math.floor(hash(k,4,seed)*5)];
      items.push([u,v,(px,py)=>{coveLathe(px,py,top,bucket,zinc);
        coveLathe(px,py,top+.012,[[0,0],[0,.075],[.24,.07],[.24,0]],(i,t,L)=>{BG[i]=C(GREEN,1.4+L*.2);set(i,' ',0);return true;}); // the stems, packed in
        for(let j=0;j<5;j++){const a=j*TAU/5+k;foodOval(px+Math.cos(a)*.05,py+Math.sin(a)*.05,top+.24+(j%2)*.03,.035,.035,.05,(i,t,L)=>{BG[i]=C(bloom,3.4+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});}
      }]);}}
  if(K==='bread'){const wicker=(i,t,L)=>{const w=coveGroove(HIT.u+HIT.w*2,.02,.004,t/projX)*coveDetail(t,.2);BG[i]=C(WARM,2.4-w+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const crust=k=>(i,t,L)=>{const score=HIT.nz>.7&&fract((HIT.u+HIT.v)*12)<.15;BG[i]=C(k%2?BRICK:ORANGE,(score?3.4:2.2)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    const n=Math.floor(hl*2/.6),pitch=hl*2/n;
    for(let k=0;k<n;k++){const u=-hl+pitch*(k+.5),bh=pitch/2-.04;items.push([u,0,(px,py)=>foodTray(px,py,top,turned?hw-.06:bh,turned?bh:hw-.06,.08,wicker)]);
      for(let j=-1;j<=1;j++)for(const v of [-.1,.1]){const sh=crust(k*5+j+(v>0));items.push([u+j*bh*.6,v,(px,py)=>foodOval(px,py,top+.012,.09,.05,.07,sh,c,s)]);}}}
  const canopy=(i,t,L)=>{const stripe=fract((HIT.u+hl)*2.5)<.5;BG[i]=C(stripe?col:WHITE,(stripe?4:5)+L*.2);return set(i,(HIT.face===3||HIT.face===4)&&HIT.w<2.1?'v':' ',C(GRAY,4)),true;};
  return [SHOP_COUNTER(x,y,hl,hw,top,c,s,BRICK),{...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const [u,v,draw] of items){const [px,py]=at(vx,vy,u,v);draw(px,py);}
    const part=GAS_PART(vx,vy,c,s);
    for(const e of [-1,1])part(e*(hl-.03),-.3,.025,.025,top,2.15,'wood',.008); // the posts, on the stallholder's edge
    part(0,-.1,hl+.1,.6,2.15,2.2,canopy); // the awning
    part(0,.49,hl+.1,.01,2.0,2.15,canopy); // its valance along the front
  }),marketStall:{kind:K,hl,hw,top,c,s,items:items.length}}];
}
// The fruit shop's table of melons and pineapples: a table, the fruit lying on it.
function MELON_TABLE(x,y,hl,hw,h) {
  const melon=k=>(i,t,L)=>{const stripe=Math.sin(Math.atan2(HIT.v,HIT.u)*7+k)>.35;BG[i]=C(GREEN,(stripe?1.8:3.4)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const pine=(i,t,L)=>{const d=fract((HIT.w*14)+Math.atan2(HIT.v,HIT.u)*1.6)<.25;BG[i]=C(d?BRICK:YEL,(d?2:3.6)+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const crown=(i,t,L)=>{BG[i]=C(GREEN,2.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const fruit=[];for(let k=0;k<Math.floor(hl*2/.3);k++)for(const v of [-.18,.18])fruit.push({u:-hl+.15+k*.3,v,pine:k%2===1});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const [k,f] of fruit.entries()){const px=vx+f.u,py=vy+f.v;
      if(f.pine){foodOval(px,py,h,.07,.07,.2,pine);coveLathe(px,py,h+.19,[[0,0],[0,.05],[.12,.01],[.12,0]],crown);}
      else foodOval(px,py,h,.13,.1,.19,melon(k),1,0);}
    drawFurnitureTable(vx,vy,hl,hw,h);
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),melonTable:{h,fruit}};
}
