// Tableware uses closed revolved profiles: an outside, a lip, and a real inside.
// All dimensions are metres; the fine glaze/grain fades with the pixel footprint.
const KITCHEN_VESSELS={
  plate:[[0,0],[0,.052],[.004,.056],[.006,.09],[.016,.124],[.022,.13],[.026,.127],[.021,.116],[.01,.079],[.009,0]],
  bowl:[[0,0],[0,.043],[.006,.048],[.017,.065],[.067,.103],[.085,.112],[.091,.11],[.087,.103],[.064,.095],[.021,.057],[.012,0]],
  cup:[[0,0],[0,.032],[.006,.039],[.016,.043],[.096,.046],[.105,.044],[.105,.039],[.018,.036],[.012,0]],
  pan:[[0,0],[0,.09],[.006,.103],[.041,.123],[.048,.122],[.048,.115],[.013,.098],[.01,0]]
};
const kitchenScaledProfiles=new Map();
function kitchenProfile(kind,scale=1,wide=scale) {
  const key=kind+':'+scale+':'+wide;
  if(!kitchenScaledProfiles.has(key)) {
    const r=.11*wide,h=.168*scale;
    // A large stockpot gets taller/wider without centimetre-thick steel walls.
    const profile=kind==='pot'?[[0,0],[0,r-.008],[.006,r],[h-.01,r],[h-.004,r+.003],[h,r],
      [h,r-.003],[.012,r-.005],[.008,0]]:KITCHEN_VESSELS[kind].map(([z,r])=>[z*scale,r*wide]);
    kitchenScaledProfiles.set(key,profile);
  }
  return kitchenScaledProfiles.get(key);
}
function kitchenInnerRadius(kind,height,scale=1,wide=scale) {
  const profile=kitchenProfile(kind,scale,wide);let inner=Infinity;
  for(let k=1;k<profile.length;k++) {
    const [za,ra]=profile[k-1],[zb,rb]=profile[k];
    if(zb>=za||height<zb||height>za)continue;
    inner=Math.min(inner,ra+(rb-ra)*(height-za)/(zb-za));
  }
  return inner;
}
const kitchenGlaze=(base=WHITE)=>(i,t,L)=>{
  const fine=coveDetail(t),light=coveLight(HIT.nx,HIT.ny,HIT.nz);
  const glaze=Math.pow(Math.max(0,HIT.nx*.2+HIT.ny*.5+HIT.nz*.84),18)*1.1;
  BG[i]=C(base,2+(3+L*.32)*light+glaze+Math.sin(HIT.w*370)*.1*fine);set(i,' ',0);return true;
};
const kitchenSteel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
function kitchenVessel(x,y,z,kind,col=WHITE,scale=1) {
  const glaze=kitchenGlaze(col);
  coveLathe(x,y,z,kitchenProfile(kind,scale),(i,t,L)=>{
    // A narrow cobalt band belongs to the outside of the dish, not its hollow.
    if((kind==='plate'||kind==='bowl')&&HIT.part<=6&&HIT.w-z>(kind==='plate'?.015:.069)*scale) {
      BG[i]=C(BLUE,2+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    }
    return glaze(i,t,L);
  });
}
// A handle's ends enter the vessel at the same radii as its shell. Its centre
// stays open, including close/side views; it is never a filled rectangular tab.
function kitchenHandle(x,y,z,c,s,radius,thickness,col=GRAY,side=1) {
  for(let k=0;k<8;k++) {
    const a=-Math.PI/2+k*Math.PI/8,b=a+Math.PI/8;
    coveTube(x+c*side*Math.cos(a)*radius,y+s*side*Math.cos(a)*radius,z+Math.sin(a)*radius,
      x+c*side*Math.cos(b)*radius,y+s*side*Math.cos(b)*radius,z+Math.sin(b)*radius,thickness,col);
  }
}
function kitchenCup(x,y,z,angle=0,col=WHITE,tea=false) {
  const c=Math.cos(angle),s=Math.sin(angle),scale=tea?.8:1;
  kitchenVessel(x,y,z,'cup',col,scale);
  kitchenHandle(x+c*.04*scale,y+s*.04*scale,z+.057*scale,c,s,.032*scale,.006,col);
  // The drink sits below the lip and in front of the vessel's recessed floor.
  const drink=kitchenInnerRadius('cup',.084*scale,scale);
  coveLathe(x,y,z+.084*scale,[[0,0],[0,drink],[.001,drink],[.001,0]],(i,t,L)=>{
    BG[i]=C(BRICK,(tea?2.1:.8)+L*.06);set(i,' ',0);return true;
  });
}
function kitchenFoodShade(base) {
  return (i,t,L)=>{
    const fine=coveDetail(t),grain=Math.sin(HIT.u*530+Math.sin(HIT.v*290)*2)*fine*.3;
    BG[i]=C(base,2.4+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain);set(i,' ',0);return true;
  };
}
function kitchenMeal(x,y,z,kind='rice') {
  if(kind==='soup') {
    kitchenVessel(x,y,z,'bowl');
    const broth=kitchenInnerRadius('bowl',.065);
    coveLathe(x,y,z+.065,[[0,0],[0,broth],[.001,broth],[.001,0]],kitchenFoodShade(ORANGE));
    for(const [u,v]of [[-.035,.018],[.03,-.025],[.023,.032]])
      coveLathe(x+u,y+v,z+.066,[[0,0],[0,.014],[.002,.014],[.002,0]],kitchenFoodShade(GREEN));
    return;
  }
  kitchenVessel(x,y,z,'plate');
  if(kind==='burger') {
    for(const [bottom,profile,col]of [
      [.009,[[0,0],[0,.045],[.006,.057],[.02,.056],[.022,0]],ORANGE],
      [.031,[[0,0],[0,.056],[.009,.061],[.012,0]],GREEN],
      [.043,[[0,0],[0,.057],[.014,.055],[.017,0]],BRICK],
      [.06,[[0,0],[0,.059],[.004,.059],[.004,0]],YEL],
      [.064,[[0,0],[0,.056],[.014,.056],[.032,.046],[.045,.025],[.049,0]],ORANGE]
    ])coveLathe(x,y,z+bottom,profile,kitchenFoodShade(col));
    return;
  }
  if(kind==='pizza') {
    coveLathe(x,y,z+.009,[[0,0],[0,.087],[.01,.092],[.018,.089],[.018,.078],[.011,.075],[.011,0]],kitchenFoodShade(ORANGE));
    coveLathe(x,y,z+.02,[[0,0],[0,.075],[.003,.075],[.003,0]],kitchenFoodShade(YEL));
    for(const [u,v]of [[-.028,.027],[.03,.032],[.018,-.033]])
      coveLathe(x+u,y+v,z+.023,[[0,0],[0,.013],[.002,.013],[.002,0]],kitchenFoodShade(RED));
    return;
  }
  if(kind==='dumplings') {
    for(const [u,v]of [[-.04,-.024],[.036,-.024],[0,.043]])
      coveLathe(x+u,y+v,z+.009,[[0,0],[0,.024],[.011,.032],[.028,.024],[.038,.01],[.04,0]],(i,t,L)=>{
        const fine=coveDetail(t),pleat=Math.cos(Math.atan2(HIT.v,HIT.u)*8)*fine*.45;
        BG[i]=C(WHITE,2.5+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+pleat);set(i,' ',0);return true;
      });
    return;
  }
  coveLathe(x-.025,y,z+.009,[[0,0],[0,.05],[.009,.057],[.026,.046],[.042,.02],[.044,0]],kitchenFoodShade(WHITE));
  coveLathe(x+.057,y-.02,z+.012,[[0,0],[0,.03],[.012,.035],[.024,.026],[.03,0]],kitchenFoodShade(GREEN));
  coveLathe(x+.05,y+.044,z+.012,[[0,0],[0,.024],[.013,.028],[.025,.019],[.03,0]],kitchenFoodShade(ORANGE));
}
function KITCHEN_SETTING(x,y,z,{fx=0,fy=-1,meal='rice'}={}) {
  const rx=-fy,ry=fx,angle=Math.atan2(ry,rx);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    if(meal==='coffee') {kitchenVessel(vx,vy,z,'plate',WHITE,.55);kitchenCup(vx,vy,z+.005,angle);}
    else {kitchenMeal(vx,vy,z,meal);kitchenCup(vx-rx*.18+fx*.015,vy-ry*.18+fy*.015,z,angle,WHITE,true);}
    if(meal==='burger'||meal==='pizza')for(const side of [-1,1]) {
      const xx=vx+rx*.15*side,yy=vy+ry*.15*side;
      coveTube(xx-fx*.09,yy-fy*.09,z+.003,xx+fx*.04,yy+fy*.04,z+.003,.003,GRAY);
      if(side<0)for(const tine of [-1,0,1])
        coveTube(xx+rx*tine*.005+fx*.04,yy+ry*tine*.005+fy*.04,z+.003,
          xx+rx*tine*.005+fx*.09,yy+ry*tine*.005+fy*.09,z+.003,.0015,GRAY);
      else coveRound(xx+fx*.06,yy+fy*.06,fx,fy,.04,.007,z,z+.006,.002,GRAY);
    }
    // Paired chopsticks rest beside rice and soup bowls.
    else if(meal!=='coffee')for(const offset of [-.004,.004]) {
      const u=.15+offset;
      coveRound(vx+rx*u,vy+ry*u,fx,fy,.108,.0025,z,z+.005,.002,'wood');
    }
  }),radius:.35,tableware:{kind:'setting',support:z,meal,fx,fy}};
}
function kitchenSushi(x,y,z,k) {
  kitchenVessel(x,y,z,'plate',[RED,BLUE,YEL,GREEN][k&3],.77);
  for(const side of [-1,1]) {
    const u=x+side*.034,bottom=z+.009*.77;
    coveRound(u,y,1,0,.027,.046,bottom,bottom+.027,.012,kitchenFoodShade(WHITE));
    coveRound(u,y,1,0,.03,.05,bottom+.027,bottom+.039,.005,(i,t,L)=>{
      const fine=coveDetail(t),stripe=coveGroove(HIT.v+HIT.u*.45,.016,.002,t/projX)*fine;
      BG[i]=C(k%3?ORANGE:RED,3+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+stripe*.8);set(i,' ',0);return true;
    });
  }
}
function kitchenCookware(x,y,z,c=1,s=0,{kind='pan',scale=1,wide=scale,filled=false,liquid=null}={}) {
  const profile=kitchenProfile(kind,scale,wide);
  coveLathe(x,y,z,profile,kitchenSteel);
  if(kind==='pan') {
    // The ferrule and wooden grip join the side, leaving the bowl open.
    coveTube(x+c*.105*scale,y+s*.105*scale,z+.034*scale,x+c*.17*scale,y+s*.17*scale,z+.034*scale,.012*scale,GRAY);
    coveRound(x+c*.225*scale,y+s*.225*scale,c,s,.075*scale,.018*scale,z+.021*scale,z+.049*scale,.009*scale,'wood');
  } else for(const side of [-1,1])
    kitchenHandle(x+c*.106*wide*side,y+s*.106*wide*side,z+.115*scale,c,s,.031*wide,.007*wide,GRAY,side);
  if(filled) {
    const fill=(kind==='pot'?.127:.017)*scale,r=kitchenInnerRadius(kind,fill,scale,wide);
    coveLathe(x,y,z+fill,[[0,0],[0,r],[.001,r],[.001,0]],(i,t,L)=>{
      const fine=coveDetail(t),ripple=Math.sin(Math.hypot(HIT.u,HIT.v)*190-T*3)*fine*.25;
      BG[i]=C(liquid??(kind==='pot'?ORANGE:YEL),2+L*.18+ripple);set(i,' ',0);return true;
    });
  }
}
function kitchenHobware(x,y,height,c,s,hob,compact=false) {
  const active=cookingOn()==='stove',how=active?RECIPE[cookCtx?.recipe]?.how:null;
  const u=hob+(compact?0:.135),v=.135,kind=how==='pot'?'pot':'pan';
  kitchenCookware(x+c*u-s*v,y+s*u+c*v,height+.019,c,s,{kind,scale:compact?.9:1,filled:!!how&&how!=='oven'});
}
