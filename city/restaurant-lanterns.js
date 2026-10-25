// Paper surrounds real space: the upper frame carries a socket and bulb, with
// a cord seated in the ceiling rose. The dark hoops remain separate from glow.
const PAPER_LANTERN_CURVE=[[0,.55],[.04,.55],[.08,.68],[.16,.86],[.26,.96],[.38,.994],[.5,1],[.62,.994],[.74,.96],[.84,.86],[.92,.68],[.96,.55],[1,.55]];
function PAPER_LANTERN(x,y,{ceiling=3,top=2.35,height=.45,radius=.17}={}) {
  const base=top-height,thickness=.0025,parts=[],ringRadius=radius*.55;
  const outer=PAPER_LANTERN_CURVE.map(([h,r])=>[h*height,r*radius]);
  const shell=[...outer,...outer.map(([h,r])=>[h,r-thickness]).reverse(),outer[0]];
  parts.push(homeLampPart('paper',base,shell));
  for(const [role,z0,z1]of [['lower-hoop',base-.008,base+.016],['upper-hoop',top-.016,top+.008]])
    parts.push(homeLampPart(role,z0,[[0,ringRadius-.004],[0,ringRadius+.007],[z1-z0,ringRadius+.007],[z1-z0,ringRadius-.004],[0,ringRadius-.004]]));
  parts.push(homeLampCylinder('socket',top-.045,top+.003,.012));
  const bulb=HOME_LAMP_BULB.map(([h,r])=>[(.103-h)*.65,r*.65]).reverse(),bulbHeight=bulb.at(-1)[0];
  parts.push(homeLampPart('bulb',top-.045-bulbHeight,bulb));
  parts.push(homeLampCylinder('cord',top+.003,ceiling-.022,.0025));
  parts.push(homeLampPart('mount',ceiling-.022,[[0,0],[0,.018],[.007,.035],[.022,.035],[.022,0]]));
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.6+L*.23*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const paper=(i,t,L)=>{
    const inside=HIT.part>outer.length&&HIT.part<shell.length-1,footprint=t/projY;
    const rib=coveGroove(HIT.w-base,height/12,.005,footprint),fine=coveDetail(t,.035);
    const fibre=fine?Math.sin(HIT.u*640)*Math.sin(HIT.w*710)*fine*.08:0;
    const warmth=1-Math.abs((HIT.w-base)/height-.5)*1.2;
    BG[i]=C(inside?ORANGE:RED,(inside?6:5.6)+Math.max(.3,night)*1.3+warmth*1.2+L*.18*coveLight(HIT.nx,HIT.ny,HIT.nz)-rib*3+fibre);set(i,' ',0);return true;
  };
  const glow=(i,t,L)=>{BG[i]=C(WARM,12+2*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const p of parts)drawBox({...p.box,x:vx,y:vy,lanternRole:p.role},p.role==='paper'?paper:p.role==='bulb'?glow:dark,coveRayLathe);
    for(const [ax,ay,bx,by]of [[-ringRadius+.002,0,ringRadius-.002,0],[0,-ringRadius+.002,0,ringRadius-.002]]){
      const r=.003,z=top+.003;
      drawBox({...boxAt(vx+(ax+bx)/2,vy+(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,z-r,z+r),ax:vx+ax,ay:vy+ay,az:z,bx:vx+bx,by:vy+by,bz:z,r,lanternRole:'crossbar'},dark,coveRayCapsule);
    }
  }),box:boxAt(x,y,1,0,radius,radius,base-.008,ceiling),walk:true,radius:radius+.01,paperLantern:{base,top,height,radius,ceiling,thickness}};
}
