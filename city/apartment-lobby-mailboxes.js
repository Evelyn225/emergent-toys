// A shallow closed steel cabinet, with real recessed posting slots. The twelve
// doors, labels and fittings prepare once; no ink grid substitutes for the model.
function apartmentMailboxRay(ox,oy,oz,rx,ry,rz,b) {
  let t=coveRayRounded(ox,oy,oz,rx,ry,rz,b);HIT.mailSlotBack=false;
  if(t<0||HIT.face!==3||Math.abs(HIT.u)>.14||Math.abs(HIT.w-b.slotZ)>.008)return t;
  const u=HIT.u,v=HIT.v,z=HIT.w,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
  let dt=(b.hw-.012-v)/dv,nu=0,nv=1,nz=0;HIT.mailSlotBack=true;
  if(Math.abs(du)>1e-12){const d=((du>0?.14:-.14)-u)/du;if(d<dt){dt=d;nu=du>0?-1:1;nv=0;HIT.mailSlotBack=false;}}
  if(Math.abs(rz)>1e-12){const d=(b.slotZ+(rz>0?.008:-.008)-z)/rz;if(d<dt){dt=d;nu=nv=0;nz=rz>0?-1:1;HIT.mailSlotBack=false;}}
  HIT.u=u+du*dt;HIT.v=v+dv*dt;HIT.w=z+rz*dt;HIT.face=7;
  HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;return t+dt;
}
// These west-wall labels face +X. Carry the actual local ray and adjacent-column
// spacing to the shared sampler, without changing its code or leaking context.
function apartmentMailboxText(i,t,text,z,color,background) {
  const q=(2*(i%cols+.5)/cols-1)*tf,ru=-(dy+dx*q),rv=dx-dy*q;
  const dn=WH.dn,sl=WH.sl,wc=WH.wc;
  WH.dn=Math.max(1e-6,Math.abs(rv*t));WH.sl=ru/(Math.abs(rv)||1e-6);WH.wc=HIT.u;
  try{return wallText(i,HIT.u,t/(projX*Math.max(1e-6,Math.abs(rv-dy/projX))),HIT.w,t,text,0,z,.065,.075,color,background);}
  finally{WH.dn=dn;WH.sl=sl;WH.wc=wc;}
}
function APARTMENT_MAILBOXES(x,y) {
  const parts=[],doors=[];
  const steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.4+L*.06);set(i,' ',0);return true;};
  const doorShade=(i,t,L)=>HIT.mailSlotBack?dark(i,t,L):steel(i,t,L);
  const add=(role,u,v,hl,hw,z0,z1,round,shade)=>{
    const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);
    Object.assign(p.box,{x:v,y:-u,c:0,s:-1});Object.assign(p.view,p.box);return p;
  };
  add('back',0,.03,1.12,.03,.90,1.85,.004,dark);
  for(const [z0,z1]of [[.90,.925],[1.825,1.85]])add('rail',0,.07,1.12,.07,z0,z1,.004,steel);
  for(const e of [-1,1])add('jamb',e*1.105,.07,.015,.07,.925,1.825,.003,steel);
  for(const u of [-.54,0,.54])add('divider',u,.10,.01,.04,.925,1.825,.002,steel);
  for(const z of [1.22,1.52])add('shelf',0,.10,1.09,.04,z,z+.01,.002,steel);
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const u=(col-1.5)*.54,z=.935+row*.3,label=String(row*4+col+1).padStart(2,'0');
    const door=add('door',u,.085,.25,.025,z,z+.28,.004,doorShade);
    door.box.slotZ=door.view.slotZ=z+.225;door.ray=apartmentMailboxRay;
    const ink=(i,t,L)=>{BG[i]=C(WHITE,3+L*.25);if(HIT.face===3&&apartmentMailboxText(i,t,label,z+.11,C(GRAY,.2),BG[i]))return true;set(i,' ',0);return true;};
    add('label',u-.06,.113,.105,.004,z+.07,z+.15,.002,ink);
    add('lock',u+.18,.114,.012,.004,z+.095,z+.125,.003,(i,t,L)=>{
      if(HIT.face===3&&Math.abs(HIT.u)<.002&&Math.abs(HIT.w-z-.11)<.008)return dark(i,t,L);return steel(i,t,L);
    });
    doors.push({row,col,u,z,label});
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.3,apartmentMailboxes:{parts,doors}};
}
function apartmentLobbyWall(i,u,uStep,z,d,mx,my,L) {
  if(hotelEntranceGlass(i,u,z,mx,my))return true;
  BG[i]=C(WHITE,3.6+L*.25);set(i,' ',0);return true;
}
const APTS_MAILBOX_PROPS=ROOM_DEFS.apts.props;
ROOM_DEFS.apts.props=r=>{
  const props=[...APTS_MAILBOX_PROPS(r),APARTMENT_MAILBOXES(1,3.2)];
  const layout={...r,grid:r.grid.map(row=>row.replace(/E/g,'D')),
    def:{...r.def,tier:1,height:r.def.height||3,builtSkirting:true,builtCornices:true},
    props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)},
      {box:boxAt(r.def.ex,.5,1,0,1,.51,0,2.3)}]};
  const trim=[...homeSkirting(layout),...homeCornices(layout)];
  for(const o of trim)for(const [a,b]of [['homeSkirting','apartmentSkirting'],['homeCornice','apartmentCornice']])if(o[a]){o[b]=o[a];delete o[a];}
  return [...props,...trim];
};
ROOM_DEFS.apts.wall=ROOM_DEFS.apts.liftWall=apartmentLobbyWall;
