// Two wall-mounted boards carry distinct sealed sake bottles. Board tops set
// every bottle foot and guard height; brackets derive from the same underside.
const SAKE_SHELF={half:2.6,depth:.115,thickness:.035,levels:[1.15,1.75],brackets:[-2.2,0,2.2]};
const SAKE_BOTTLES=[
 [[0,0],[0,.051],[.008,.061],[.03,.064],[.29,.064],[.32,.061],[.36,.032],[.39,.024],[.432,.024],[.432,.028],[.46,.028],[.46,0]],
 [[0,0],[0,.051],[.01,.064],[.29,.064],[.33,.056],[.37,.024],[.41,.024],[.41,.028],[.435,.028],[.435,0]],
 [[0,0],[0,.05],[.012,.064],[.23,.064],[.28,.057],[.33,.027],[.38,.027],[.38,.031],[.405,.031],[.405,0]],
 [[0,0],[0,.051],[.015,.066],[.17,.066],[.24,.055],[.285,.025],[.33,.022],[.33,.027],[.355,.027],[.355,0]],
];
function sakeBottleShade(kind,base) {
 const glass=[GREEN,BRICK,BLUE,STONE][kind],height=SAKE_BOTTLES[kind].at(-1)[0];
 return (i,t,L)=>{
  const z=HIT.w-base,cap=z>height-.028,label=z>.10&&z<.29&&HIT.nz<.7,light=coveLight(HIT.nx,HIT.ny,HIT.nz);
  let colour=cap?GRAY:label?WHITE:glass,level=cap?3:label?5:2.2;
  // The label's seal and short printed rules filter out before sub-cell size.
  if(label&&coveDetail(t,.32)>.2){
   if(z>.12&&z<.16&&HIT.ny>.6){colour=RED;level=3.8;}
   else if(z>.19&&z<.26&&Math.abs(HIT.nx)<.4&&coveGroove(z-.19,.026,.008,t/projY)>.45){colour=GRAY;level=2;}
  }
  BG[i]=C(colour,level+L*.28*light);set(i,' ',0);return true;
 };
}
function IZAKAYA_SAKE_SHELVES(x=5.3,y=1.115) {
 const q=SAKE_SHELF,parts=[],bottles=[],rods=[],wood=furnitureTimber(BRICK);
 const panel=(role,u,v,hl,hw,z0,z1)=>parts.push({role,u,v,box:boxAt(0,0,1,0,hl,hw,z0,z1),profile:kitchenPanelProfile(hl,hw,z0,z1,.003)});
 const rod=(role,u,v,z,uu,vv,zz,r=.004)=>rods.push({role,ax:u,ay:v,az:z,bx:uu,by:vv,bz:zz,r});
 const metal=(i,t,L)=>{BG[i]=C(GRAY,1.7+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
 for(const [row,z]of q.levels.entries()){
  const top=z+q.thickness;panel('board',0,0,q.half,q.depth,z,top);
  for(const u of q.brackets){
   panel('wall-plate',u,-q.depth+.006,.025,.006,z-.18,z);
   rod('bracket-wall',u,-.101,z-.16,u,-.101,z-.006,.006);
   rod('bracket-arm',u,-.101,z-.006,u,.09,z-.006,.006);
   rod('bracket-brace',u,-.101,z-.14,u,.09,z-.006);
  }
  for(const u of [-2.53,0,2.53])rod('guard-post',u,.105,top,u,.105,top+.065);
  rod('guard',-2.53,.105,top+.065,2.53,.105,top+.065);
  for(let k=0;k<21;k++){
   const kind=(k+row*3)%4,u=(k-10)*.24,profile=SAKE_BOTTLES[kind],p=homeLampPart('bottle',top,profile);
   bottles.push({...p,u,v:.005,kind,shade:sakeBottleShade(kind,top)});
  }
 }
 return {...ROOM_MODEL(x,y,(vx,vy)=>{
  for(const p of bottles)drawBox({...p.box,x:vx+p.u,y:vy+p.v,sakeRole:'bottle',sakeKind:p.kind},p.shade,backBarRayBottle);
  for(const p of rods){const ax=vx+p.ax,ay=vy+p.ay,bx=vx+p.bx,by=vy+p.by,r=p.r;
   drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(p.az,p.bz)-r,Math.max(p.az,p.bz)+r),ax,ay,az:p.az,bx,by,bz:p.bz,r,sakeRole:p.role},metal,coveRayCapsule);
  }
  for(const p of parts)drawBox({...p.box,x:vx+p.u,y:vy+p.v,...p.profile,sakeRole:p.role},p.role==='board'?wood:metal,homeRayWorktop);
 }),box:boxAt(x,y,1,0,q.half,q.depth,.97,2.25),radius:q.half+.01,sakeShelves:true};
}
