// Fixed kerb parts prepare once per object/detail level. Camera translation
// and the fixture's terrain height are applied when drawing.
const KERB_K=.1,KERB_NEAR=2.5;
const kerbPaint=(col,base=2.2)=>(i,t,L)=>{BG[i]=C(col,base+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
const KERB_HYDRANT=[[0,0],[0,.15],[.04,.15],[.05,.12],[.08,.115],[.5,.105],[.52,.125],[.56,.125],[.58,.11],[.66,.1],[.7,.07],[.72,.035],[.72,0]];
const KERB_NUT=[[0,0],[0,.03],[.05,.026],[.05,0]];
const KERB_BIN=[[0,0],[0,.2],[.03,.22],[.82,.25],[.84,.26],[.88,.26],[.88,.232],[.84,.228],[.64,.218],[.64,0]];
const KERB_BOLLARD=[[0,0],[0,.1],[.74,.1],[.8,.095],[.86,.07],[.9,.03],[.905,0]];
// One closed D-shaped extrusion replaces the intersecting box/full-cylinder
// mailbox. Its front/back caps and curved roof share the same shoulder/radius.
function kerbMailboxRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,u=x*b.c+y*b.s,v=-x*b.s+y*b.c,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c,P=b.mailboxShape;
  let best=Infinity,nu=0,nv=0,nz=0;
  const take=(t,a,d,w)=>{if(t<=.01||t>=best)return;const U=u+du*t,V=v+dv*t,Z=oz+rz*t;
    if(Math.abs(U)>P.r+1e-9||Math.abs(V)>b.hw+1e-9||Z<P.base-1e-9||Z>P.shoulder&&U*U+(Z-P.shoulder)**2>P.r*P.r+1e-10)return;
    best=t;nu=a;nv=d;nz=w;};
  if(Math.abs(dv)>1e-12)for(const e of [-1,1])take((e*b.hw-v)/dv,0,e,0);
  if(Math.abs(du)>1e-12)for(const e of [-1,1]){const t=(e*P.r-u)/du;if(oz+rz*t<=P.shoulder+1e-9)take(t,e,0,0);}
  if(Math.abs(rz)>1e-12)take((P.base-oz)/rz,0,0,-1);
  const w=oz-P.shoulder,A=du*du+rz*rz,B=u*du+w*rz,Cc=u*u+w*w-P.r*P.r,D=B*B-A*Cc;
  if(A>1e-16&&D>=0)for(const e of [-1,1]){const t=(-B+e*Math.sqrt(D))/A,Z=oz+rz*t;if(Z>=P.shoulder-1e-9)take(t,(u+du*t)/P.r,0,(Z-P.shoulder)/P.r);}
  if(!Number.isFinite(best))return -1;
  HIT.u=u+du*best;HIT.v=v+dv*best;HIT.w=oz+rz*best;HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;HIT.face=nv?(nv>0?3:4):nz<-.99?6:Math.abs(nu)>.99?(nu>0?1:2):5;return best;
}
function buildKerbModel(o,near) {
  const k=KERB_K,c=o.c,s=o.s,fs=Math.sign(-s*o.fx+c*o.fy)||1,parts=[],view={x:0,y:0,z:0};
  const paint=kerbPaint(o.col),metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const add=(role,box,shade,ray=rayBox)=>parts.push({role,box,shade,ray});
  const at=(a,v)=>[(c*a-s*v*fs)*k,(s*a+c*v*fs)*k];
  const flat=(role,x,y,a,b,z0,z1,shade,round=0)=>{
    const B={...boxAt(x,y,c,s,a*k,b*k,z0*k,z1*k),round:Math.min(round*k,a*k*.98,b*k*.98,(z1-z0)*k*.49)};
    add(role,B,round?shade:(i,t,L)=>{vmNormal(c,s);return shade(i,t,L);},round?coveRayRounded:rayBox);
  };
  const lathe=(role,x,y,z,profile,shade)=>{const points=profile.map(([h,r])=>[(z+h)*k,r*k]),r=Math.max(...points.map(p=>p[1]));add(role,{...boxAt(x,y,1,0,r,r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points},shade,coveRayLathe);};
  const tube=(role,a,b,r,shade)=>{const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;add(role,{...boxAt(x,y,1,0,Math.abs(a[0]-b[0])/2+r,Math.abs(a[1]-b[1])/2+r,Math.min(a[2],b[2])-r,Math.max(a[2],b[2])+r),handRatio:1,handShape:{ax:a[0]-x,ay:a[1]-y,az:a[2],bx:b[0]-x,by:b[1]-y,bz:b[2],r}},shade,homeClockRayHand);};
  if(o.kind==='hydrant'){
    if(near){
      lathe('nut',0,0,.72,KERB_NUT,metal);
      const outlet=(ux,uy,z,a,b,r,cap)=>{
        const point=t=>[ux*t*k,uy*t*k,z*k];
        tube('outlet',point(a),point(b-.02),r*k,paint);tube('cap',point(b-.02),point(b),cap*k,paint);
      };
      for(const e of [-1,1])outlet(c*e,s*e,.42,.08,.16,.032,.042);
      outlet(o.fx,o.fy,.34,.08,.18,.045,.056);
    }
    lathe('body',0,0,0,KERB_HYDRANT,kerbPaint(o.col,2.3));
  }else if(o.kind==='bin'){
    const body=(i,t,L)=>{
      const w=(HIT.w-view.z)/k,a=Math.atan2(HIT.v,HIT.u);
      if(w>.835){BG[i]=C(GRAY,.8+L*.15);set(i,' ',0);return true;}
      if(w>.63&&w<.66&&HIT.nz>.5){BG[i]=C(GRAY,.6+hash(Math.floor(HIT.u*400),Math.floor(HIT.v*400),1410)*.9);set(i,' ',0);return true;}
      const rib=coveGroove(a*.25/Math.PI*8,1,.18,t/projX/(.25*k)*2)*coveDetail(t,.05);
      BG[i]=C(o.col,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-rib*.7);set(i,' ',0);return true;
    };
    if(near)for(let n=0;n<3;n++){const a=o.seed*20+n*2.1,r=.1*k;add('litter',boxAt(Math.cos(a)*r,Math.sin(a)*r,1,0,.04*k,.03*k,.64*k,.67*k),kerbPaint(n===1?RED:WHITE,2.4),foodRayEllipsoid);}
    lathe('body',0,0,0,KERB_BIN,body);
  }else if(o.kind==='mailbox'){
    // Supports remain in both detail levels; a far mailbox must not float.
    for(const a of [-.19,.19])for(const v of [-.22,.22]){const[x,y]=at(a,v);flat('leg',x,y,.02,.02,0,.23,paint,.006);}
    if(near){
      let[x,y]=at(0,.25);flat('chute',x,y,.16,.01,.78,1,kerbPaint(o.col,2.6),.006);
      for(const a of [-.09,.09]){[x,y]=at(a,.271);flat('handle-mount',x,y,.01,.011,.964,.976,metal,.003);}
      const A=at(-.10,.282),B=at(.10,.282);tube('handle',[...A,.97*k],[...B,.97*k],.005*k,metal);
      [x,y]=at(0,.252);flat('collection',x,y,.1,.004,.6,.7,(i,t,L)=>{BG[i]=C(WHITE,1.5+L*.2);return set(i,worldText('18:00',HIT.u*fs,HIT.w,t,i,view.x+x,view.y+y,view.z+.65*k,c*fs,s*fs,.032*k,.06*k),C(GRAY,1)),true;});
      const [wx,wy]=at(0,.25);flat('label',wx,wy,.2,.001,.38,.52,(i,t,L)=>{BG[i]=C(o.col,2+L*.2);return set(i,worldText('MAIL',HIT.u*fs,HIT.w,t,i,view.x+wx,view.y+wy,view.z+.45*k,c*fs,s*fs,.07*k,.1*k),C(WHITE,3+L*.5)),true;});
    }
    add('body',{...boxAt(0,0,c,s,.22*k,.25*k,.22*k,1.27*k),mailboxShape:{base:.22*k,shoulder:1.05*k,r:.22*k}},paint,kerbMailboxRay);
  }else if(o.kind==='cabinet'){
    const slab=(role,a0,a1,v0,v1,z0,z1,shade,round=0)=>{const[x,y]=at((a0+a1)/2,(v0+v1)/2);flat(role,x,y,(a1-a0)/2,(v1-v0)/2,z0,z1,shade,round);};
    if(near){
      for(const e of [-1,1])slab('door',e>0?.005:-.38,e>0?.38:-.005,.25,.256,.16,1.3,kerbPaint(o.col,2.2));
      for(const zz of [.3,1.1])for(const e of [-1,1])slab('hinge',e*.375-.014,e*.375+.014,.254,.264,zz,zz+.08,metal);
      for(const zz of [.65,.79]){const A=at(.315,.256),B=at(.315,.28);tube('handle-mount',[...A,zz*k],[...B,zz*k],.005*k,metal);}
      const H=at(.315,.28);tube('handle',[...H,.65*k],[...H,.79*k],.005*k,metal);
      const [lx,ly]=at(-.21,.257);
      slab('label',-.3,-.12,.256,.258,1.05,1.17,(i,t,L)=>{BG[i]=C(WHITE,2.5+L*.25);set(i,worldText(o.signal?'POWER':'TEL',HIT.u*fs,HIT.w,t,i,view.x+lx,view.y+ly,view.z+1.11*k,c*fs,s*fs,.027*k,.065*k),C(GRAY,1+L*.1));return true;});
      for(const e of [-1,1])for(let n=0;n<5;n++){const zz=1+n*.055;slab('louvre',e*.4-(e>0?0:.012),e*.4+(e>0?.012:0),-.18,.18,zz,zz+.022,kerbPaint(o.col,1.4));}
    }
    flat('cap',0,0,.43,.28,1.35,1.41,paint,.012);
    flat('body',0,0,.4,.25,.1,1.35,paint,.02);
    flat('plinth',0,0,.42,.27,0,.1,kerbPaint(STONE,2.6));
  }else if(o.kind==='shelter'){
    view.glow=0;
    const glass=(i,t,L)=>{
      const w=(HIT.w-view.z)/k;
      if(w>1&&w<1.12){BG[i]=C(WHITE,2.6+L*.1);set(i,' ',0);return true;}
      const glint=near?coveGroove(HIT.u/k+w,1/.6,.025,t/(projX*k))*coveDetail(t,.025):0;
      if(glint<.65)return false;BG[i]=C(WHITE,2+L*.25);set(i,' ',0);return true;
    };
    const word=(o.word||'DRINK COLA').split(' ')[0];
    const advert=(i,t,L)=>{
      const w=(HIT.w-view.z)/k,face=HIT.face;
      if(face!==1&&face!==2||w<.3||w>2.1){BG[i]=C(GRAY,1.4+L*.2*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}
      BG[i]=C(BLUE,3+view.glow*6);if(!near){set(i,' ',0);return true;}
      const e=face===1?1:-1,[ex,ey]=at(1.45,-.13),tx=-s*fs*e,ty=c*fs*e;
      set(i,worldText(word,HIT.v*e*fs,HIT.w,t,i,view.x+ex,view.y+ey,view.z+1.3*k,tx,ty,.14*k,.22*k),C(WHITE,14));return true;
    };
    for(const q of SHELTER_PARTS){const[x,y]=at(q.a/k,q.v/k);flat(q.role,x,y,q.hl/k,q.hw/k,q.z0/k,q.z1/k,q.material==='metal'?metal:q.material==='glass'?glass:q.material==='advert'?advert:kerbPaint(GRAY,1.6),q.round?q.round/k:0);}
  }else{
    lathe('body',0,0,0,KERB_BOLLARD,(i,t,L)=>{const w=(HIT.w-view.z)/k,band=near&&w>.62&&w<.7;BG[i]=band?C(YEL,4+L*.25):C(GRAY,1.2+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  }
  for(const p of parts){const local={...p.box};p.shiftedRay=(ox,oy,oz,rx,ry,rz,B)=>{const height=B.z0-p.box.z0;local.x=B.x;local.y=B.y;const t=p.ray(ox,oy,oz-height,rx,ry,rz,local);if(t>=0)HIT.w+=height;return t;};}
  return {parts,draw(x,y,z){view.x=x;view.y=y;view.z=z;view.glow=Math.max(night,overcast*.6);for(const p of parts)drawBox({...p.box,x:x+p.box.x,y:y+p.box.y,z0:z+p.box.z0,z1:z+p.box.z1},p.shade,z?p.shiftedRay:p.ray);}};
}
const KERB_MODELS=new WeakMap();
function kerbModel(o,near=true) {let cache=KERB_MODELS.get(o);if(!cache)KERB_MODELS.set(o,cache=[]);const key=near?1:0;return cache[key]||(cache[key]=buildKerbModel(o,near));}
const drawKerbHydrant=(o,x,y,z,near)=>kerbModel(o,near).draw(x,y,z),drawKerbBin=drawKerbHydrant,drawKerbMailbox=drawKerbHydrant,drawKerbBollard=drawKerbHydrant,drawKerbCabinet=drawKerbHydrant,drawKerbShelter=drawKerbHydrant;
const KERB_DRAW={hydrant:drawKerbHydrant,bin:drawKerbBin,mailbox:drawKerbMailbox,bollard:drawKerbBollard,cabinet:drawKerbCabinet,shelter:drawKerbShelter};
function drawKerbFixtures() {forNear(kerbsB,o=>{const[vx,vy]=R(o.x,o.y),d=Math.hypot(vx,vy);if(d>vis||o.h*projY/d<.6||!inView(vx,vy,.05))return;KERB_DRAW[o.kind](o,vx,vy,terrainHeight(o.x,o.y),d<KERB_NEAR);});}
