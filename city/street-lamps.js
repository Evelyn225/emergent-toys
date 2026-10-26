// The street lamp up close, turned rather than boxed: a flared cast base, a
// fluted pole tapering to its finial with a collar part way up, the swan neck
// as one smooth curve of tube, the drop rod, and the lantern itself: a ribbed
// glass body between a domed cap and a finial, glowing after dark. Further off
// the billboard (lampCell) stands in for it at a fraction of the cost.
const LAMP_NECK_BITS = 10;
const LAMP_BASE = [[0, 0], [0, .028], [.008, .028], [.012, .025], [.03, .019], [.05, .015], [.058, .0125], [.062, .0115], [.062, 0]];
const LAMP_LANTERN = [[0, 0], [0, .004], [.012, .008], [.02, .014], [.026, .02], [.03, .02], [.09, .024], [.092, .031], [.098, .031], [.108, .018], [.116, .008], [.12, 0]]; // from its finial up to the cap
const lampSteel = (i, t, L) => {
  const flute = coveGroove(Math.atan2(HIT.v, HIT.u) * 12 / TAU, 1, .3, t / projX * 80) * coveDetail(t, .02); // the pole's flutes, gone far off
  BG[i] = C(GRAY, .9 + L * .28 * coveLight(HIT.nx, HIT.ny, HIT.nz) - flute * .35); return set(i, ' ', 0), true;
};
const STREET_LAMP_MODELS=new Map();
const lampMetal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
function buildStreetLampModel(ax,ay,top){
  const parts=[];
  const add=(role,box,shade,ray,kind='lathe')=>{const p={role,box,shade,ray,kind};parts.push(p);return p;};
  const lathe=(role,x,y,z,profile,shade)=>{
    const points=profile.map(([h,r])=>[h+z,r]),r=Math.max(...points.map(p=>p[1]));
    add(role,{...boxAt(x,y,1,0,r,r,points[0][0],Math.max(...points.map(p=>p[0]))),profile:points},shade,coveRayLathe);
  };
  const tube=(role,A,B,r,fallback=true)=>{
    const[ax,ay,az]=A,[bx,by,bz]=B,box={...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r};
    const p=add(role,box,lampMetal,coveRayCapsule,'tube');p.fallback=fallback;
    p.lineBox={...box,hl:box.hl+.01,hw:box.hw+.01,z0:box.z0-.01,z1:box.z1+.01};
    p.lineShade=(i,t,L)=>{if(r*2*projX/t>1.5)BG[i]=C(GRAY,.8+L*.25*1.1);set(i,courierGlyph(HIT.u,HIT.v,HIT.w,bx-ax,by-ay,bz-az),C(GRAY,L*1.1));return true;};
  };
  lathe('base',0,0,0,LAMP_BASE,lampMetal);
  lathe('pole',0,0,.062,[[0,0],[0,.0105],[top-.062,.0078],[top-.062,0]],lampSteel);
  lathe('collar',0,0,.41,[[0,0],[0,.014],[.006,.0165],[.014,.0165],[.02,.014],[.02,0]],lampMetal);
  lathe('finial',0,0,top-.004,[[0,0],[0,.0095],[.008,.011],[.016,.007],[.024,0]],lampMetal);
  for(let k=0;k<LAMP_NECK_BITS;k++){
    const t0=Math.PI*(1-k/LAMP_NECK_BITS),t1=Math.PI*(1-(k+1)/LAMP_NECK_BITS),u0=NECK+NECK*Math.cos(t0),u1=NECK+NECK*Math.cos(t1);
    tube('neck',[ax*u0,ay*u0,top+NECK*Math.sin(t0)],[ax*u1,ay*u1,top+NECK*Math.sin(t1)],.0075);
  }
  const hx=ax*2*NECK,hy=ay*2*NECK,base=top-.15;
  tube('drop',[hx,hy,top],[hx,hy,base+.116],.003);
  lathe('lantern',hx,hy,base,LAMP_LANTERN,(i,t,L)=>{
    const w=HIT.w-base,glass=w>.03&&w<.09;if(!glass)return lampMetal(i,t,L);
    BG[i]=lampsOn>.3?C(WARM,6+lampsOn*6):C(CYAN,1+L*.12);set(i,' ',0);return true;
  });
  for(let n=0;n<6;n++){
    const a=n*TAU/6,c=Math.cos(a),s=Math.sin(a);
    tube('rib',[hx+c*.0205,hy+s*.0205,base+.03],[hx+c*.0245,hy+s*.0245,base+.09],.0015,false);
  }
  for(const p of parts){
    const moved=ray=>(ox,oy,oz,rx,ry,rz,B)=>{
      const x=B.x-p.box.x,y=B.y-p.box.y,t=ray(ox-x,oy-y,oz,rx,ry,rz,p.box);
      if(t>=0&&p.kind==='tube'){HIT.u+=x;HIT.v+=y;}return t;
    };
    p.moved=moved(p.ray);if(p.kind==='tube')p.lineMoved=moved(rayRod);
  }
  return {parts,draw(x,y){
    for(const p of parts){const line=p.kind==='tube'&&p.fallback&&p.box.r*2*projX/Math.max(.02,dx*(x+p.box.x)+dy*(y+p.box.y))<1.5,B=line?p.lineBox:p.box;
      drawBox({...B,x:x+B.x,y:y+B.y},line?p.lineShade:p.shade,x||y?(line?p.lineMoved:p.moved):(line?rayRod:p.ray));
    }
  }};
}
function streetLampModel(ax,ay,top=LAMP_TOP){const key=ax+','+ay+','+top;let model=STREET_LAMP_MODELS.get(key);if(!model){model=buildStreetLampModel(ax,ay,top);STREET_LAMP_MODELS.set(key,model);}return model;}
const streetLampHalo=(i,u,z)=>{const halo=Math.hypot(u/.075,(z-.065)/.065);if(halo>=1)return false;BG[i]=C(WARM,1+lampsOn*2*(1-halo));set(i,' ',0);return true;};
function drawLamp3D(vx,vy,ax,ay,top=LAMP_TOP){
  streetLampModel(ax,ay,top).draw(vx,vy);
  if(lampsOn>.3)drawShape(vx+ax*2*NECK,vy+ay*2*NECK,top-.16,.075,.13,streetLampHalo);
}
