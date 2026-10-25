// Four joined bezel pieces enclose a real recess and back plate. Their front
// bevels stop at joining edges, so there are no cracks between adjacent bars.
function TELEVISION(x,y,r,scale=1,angle=0) {
 const c=Math.cos(angle),s=Math.sin(angle),parts=[],legs=[],q=v=>v*scale;
 const dark=(i,t,L)=>{BG[i]=C(GRAY,.8+L*.18*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
 const rear=(i,t,L)=>{
  let vent=0;if(HIT.face===4&&HIT.w>q(1.3)&&HIT.w<q(1.4))vent=coveGroove(HIT.u,q(.035),q(.005),t/projX);
  BG[i]=C(GRAY,.8+L*.18*coveLight(HIT.nx,HIT.ny,HIT.nz)-vent*.5);set(i,' ',0);return true;
 };
 const panel=(role,u,v,hl,hw,z0,z1,bevel,omit=[],shade=dark)=>{
  const profile=kitchenPanelProfile(q(hl),q(hw),q(z0),q(z1),q(bevel));
  profile.planes=profile.planes.filter(p=>!omit.includes(p[4]));
  parts.push({role,u:q(u),v:q(v),box:boxAt(0,0,c,s,q(hl),q(hw),q(z0),q(z1)),profile,shade});
 };
 // z=0.79..1.47, u=-0.65..0.65 defines both the opening and screen.
 panel('bezel',0,0,.74,.07,.7,.79,.007,[9]);
 panel('bezel',0,0,.74,.07,1.47,1.55,.007,[10]);
 panel('bezel',-.695,0,.045,.07,.79,1.47,.007,[7,9,10]);
 panel('bezel',.695,0,.045,.07,.79,1.47,.007,[8,9,10]);
 panel('back',0,-.034,.65,.036,.79,1.47,0,[],rear);
 panel('power-button',.61,.073,.015,.003,.735,.765,.001);
 for(const side of [-1,1])for(const v of [-.08,.08]){
  panel('foot-pad',side*.49,v,.11,.025,.61,.63,.003);
  const ax=q(side*.49),ay=q(v),az=q(.634),bx=q(side*.42),by=0,bz=q(.72),radius=q(.01);
  legs.push({ax,ay,az,bx,by,bz,r:radius});
 }
 const screenBox=boxAt(0,0,c,s,q(.65),q(.001),q(.79),q(1.47));
 const screenShade=(i,t,L)=>{
  if(!r.tv||HIT.face!==3){BG[i]=C(GRAY,.4+L*.035);set(i,' ',0);return true;}
  const frame=televisionProgramme((HIT.u/q(.65)+1)/2,(q(1.47)-HIT.w)/q(.68),T,(r.tvChannel??Math.floor(T/24))%4);
  BG[i]=C(frame.base,frame.level);set(i,frame.ch,C(frame.ink,12));return true;
 };
 return {...ROOM_MODEL(x,y,(vx,vy)=>{
  const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v], [sx,sy]=at(0,q(.063));
  drawBox({...screenBox,x:sx,y:sy,tvRole:'screen'},screenShade);
  for(const p of parts){const[xx,yy]=at(p.u,p.v);drawBox({...p.box,x:xx,y:yy,...p.profile,tvRole:p.role},p.shade,homeRayWorktop);}
  for(const p of legs){const[ax,ay]=at(p.ax,p.ay),[bx,by]=at(p.bx,p.by),radius=p.r;
   drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+radius,Math.abs(by-ay)/2+radius,Math.min(p.az,p.bz)-radius,Math.max(p.az,p.bz)+radius),ax,ay,az:p.az,bx,by,bz:p.bz,r:radius,tvRole:'leg'},dark,coveRayCapsule);
  }
 }),radius:scale,box:boxAt(x,y,c,s,q(.74),q(.12),q(.61),q(1.55)),television:{scale,angle}};
}
