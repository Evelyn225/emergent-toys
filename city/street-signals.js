// A traffic signal, built: a turned pole on a flanged foot with a push-button
// box for the crossing; a two-faced head (lamps toward both ends of its street)
// on a rounded housing, each face on a backplate with a white border, each lamp
// a lens under a cowl visor; and a pedestrian head facing across the junction:
// the walking figure while walkers may start, the hand flashing as the green
// runs out, the hand steady on red. You see the lamps only from along the
// street (the visors hide them from the cross street, as they're meant to).
const SIG = { hl: 0.012, hw: 0.017, z0: 0.29, z1: 0.376 }, SIG_LAMPS = [['R', 0.36, RED], ['Y', 0.333, YEL], ['G', 0.306, GREEN]];
const SIG_PED = { z0: .205, z1: .245, hw: .016, d: .012, out: .02 }; // the pedestrian head, out from the pole
const SIG_HOUSING = (i, t, L) => { BG[i] = C(GRAY, (0.6 + L * 0.12) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '_' : ' ', C(GRAY, L * 0.5)), true; };
const SIG_POLE = [[0, 0], [0, .02], [.006, .02], [.014, .013], [.024, .0095], [.03, .0088], [SIG.z0 - .004, .0082], [SIG.z0, .0095], [SIG.z0, 0]];
// The pedestrian state at a signal's corner: 'walk', 'flash' or 'stop'.
function pedestrianSignal(s, t) {
  if (walkSig(s.bx, s.by, s.vert, t)) return 'walk';
  return light(s.bx, s.by, s.vert, t) === 'R' ? 'stop' : 'flash';
}
// The walking figure and the raised hand, 5 wide by 7 high.
const SIG_FIGURES = { walk: ['..#..', '.###.', '#.#.#', '..#..', '.#.#.', '#...#', '#...#'], stop: ['#.#.#', '#.#.#', '#####', '#####', '.####', '.###.', '..#..'] };
// Fixed profiles, ray bounds and materials are shared by the four orientations.
// Only the live light/figure state changes between synchronous draws.
const STREET_SIGNAL_MODELS = new Map();
function buildStreetSignalModel(vert, away) {
  const c=vert?0:1, sn=vert?1:0, state={on:'R',ped:'stop',lit:true}, parts=[];
  const add=(role,box,shade,ray=rayBox,coords=false)=>{
    const p={role,box,shade,ray};
    p.moved=(ox,oy,oz,rx,ry,rz,B)=>{
      const x=B.x-box.x,y=B.y-box.y,t=ray(ox-x,oy-y,oz,rx,ry,rz,box);
      if(t>=0&&coords){HIT.u+=x;HIT.v+=y;}return t;
    };
    parts.push(p);return p;
  };
  const tube=(role,A,B,r,shade,physical=false)=>{
    const [ax,ay,az]=A,[bx,by,bz]=B,m=physical?r:r+.01;
    return add(role,{...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+m,Math.abs(by-ay)/2+m,Math.min(az,bz)-m,Math.max(az,bz)+m),ax,ay,az,bx,by,bz,r},shade,physical?coveRayCapsule:rayRod,true);
  };
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const pole=add('pole',{...boxAt(0,0,1,0,.02,.02,0,SIG.z0),profile:SIG_POLE},metal,coveRayLathe);
  const farPole=tube('far-pole',[0,0,0],[0,0,SIG.z0],.009,(i,t,L)=>{
    if(.018*projX/t>1.5)BG[i]=C(GRAY,.8+L*.25);
    return set(i,courierGlyph(HIT.u,HIT.v,HIT.w,0,0,SIG.z0),C(GRAY,L)),true;
  });
  const head=add('head',{...boxAt(0,0,c,sn,SIG.hl,SIG.hw,SIG.z0,SIG.z1),round:.004},(i,t,L)=>{
    BG[i]=C(GRAY,.55+L*.14*coveLight(HIT.nx,HIT.ny,HIT.nz));return set(i,' ',0),true;
  },coveRayRounded);
  const faces=[-1,1].map(e=>{
    const plate=add('backplate',boxAt(c*e*(SIG.hl+.0015),sn*e*(SIG.hl+.0015),c,sn,.0015,SIG.hw+.01,SIG.z0-.008,SIG.z1+.008),(i,t,L)=>{
      const edge=Math.abs(HIT.v)>SIG.hw+.007||HIT.w<SIG.z0-.005||HIT.w>SIG.z1+.005;
      BG[i]=edge?C(WHITE,3+L*.1):C(GRAY,.35);return set(i,' ',0),true;
    });
    const ux=c*e*(SIG.hl+.003),uy=sn*e*(SIG.hl+.003);
    const lamps=SIG_LAMPS.map(([st,z,col])=>{
      const lens=tube('lens',[ux,uy,z],[ux,uy,z-.002],.0095,(i,t,L)=>{
        const lit=st===state.on;BG[i]=C(col,lit?11:2.2);
        return set(i,.019*projX/t>2?' ':lit?'O':'o',C(col,lit?15:4)),true;
      });
      const hx=ux+c*e*.007,hy=uy+sn*e*.007;
      const hood=add('hood',boxAt(hx,hy,c,sn,.007,.012,z+.0095,z+.0115),SIG_HOUSING);
      const cheeks=[-1,1].map(f=>add('cheek',boxAt(hx-sn*f*.011,hy+c*f*.011,c,sn,.007,.001,z-.004,z+.0095),SIG_HOUSING));
      return {st,lens,cowls:[hood,...cheeks]};
    });
    const orders=Object.fromEntries(SIG_LAMPS.map(([st])=>[st,[...lamps.filter(q=>q.st===st),...lamps.filter(q=>q.st!==st)]]));
    return {e,plate,orders};
  });
  const nx=-c*away,ny=-sn*away,px_=nx*SIG_PED.out,py_=ny*SIG_PED.out,z=(SIG_PED.z0+SIG_PED.z1)/2;
  const bracket=tube('bracket',[0,0,z],[px_-nx*SIG_PED.d,py_-ny*SIG_PED.d,z],.003,metal,true);
  const lineBox={...bracket.box,hl:bracket.box.hl+.01,hw:bracket.box.hw+.01,z0:bracket.box.z0-.01,z1:bracket.box.z1+.01};
  const lineBracket=add('bracket-line',lineBox,(i,t,L)=>{
    if(.006*projX/t>1.5)BG[i]=C(GRAY,.8+L*.25*1.1);
    return set(i,courierGlyph(HIT.u,HIT.v,HIT.w,bracket.box.bx,bracket.box.by,0),C(GRAY,L*1.1)),true;
  },rayRod,true);
  const pedestrian=add('pedestrian',boxAt(px_,py_,c,sn,SIG_PED.d,SIG_PED.hw,SIG_PED.z0,SIG_PED.z1),(i,t,L)=>{
    if(HIT.face!==(away<0?1:2))return SIG_HOUSING(i,t,L);
    const q=(HIT.v*(away<0?-1:1)*(vert?-1:1)/SIG_PED.hw+1)/2,zz=(HIT.w-SIG_PED.z0)/(SIG_PED.z1-SIG_PED.z0);
    const col=state.ped==='walk'?WHITE:ORANGE,fig=SIG_FIGURES[state.ped==='walk'?'walk':'stop'],cx=Math.floor(q*7)-1,cz=6-Math.floor(zz*9-1);
    const on=state.lit&&cx>=0&&cx<5&&cz>=0&&cz<7&&fig[cz][cx]==='#',big=SIG_PED.hw*2/7*projX/t>1;
    BG[i]=!state.lit?C(GRAY,.4):big?(on?C(col,12):C(GRAY,.4)):C(col,6);return set(i,' ',0),true;
  });
  const button=add('button',boxAt(-nx*.011,-ny*.011,c,sn,.003,.008,.1,.125),(i,t,L)=>{
    const btn=Math.hypot(HIT.v,HIT.w-.114)<.003;BG[i]=btn?C(GRAY,.3):C(YEL,3+L*.2*coveLight(0,0,1));return set(i,' ',0),true;
  });
  return {parts,state,draw(x,y,near,on,ped,lit){
    state.on=on;state.ped=ped;state.lit=lit;
    const draw=p=>drawBox({...p.box,x:x+p.box.x,y:y+p.box.y},p.shade,x||y?p.moved:p.ray);
    draw(near?pole:farPole);draw(head);
    const k=-(x*c+y*sn)/(Math.hypot(x,y)||1);
    for(const f of faces){
      if(near)draw(f.plate);if(f.e*k<.3)continue;
      for(const lamp of f.orders[on]){draw(lamp.lens);if(near)for(const p of lamp.cowls)draw(p);}
    }
    if(!near)return;
    const depth=Math.max(.02,dx*(x+bracket.box.x)+dy*(y+bracket.box.y));
    draw(.006*projX/depth<1.5?lineBracket:bracket);draw(pedestrian);draw(button);
  }};
}
function streetSignalModel(vert,away){
  const key=Number(vert)+','+away;let model=STREET_SIGNAL_MODELS.get(key);
  if(!model){model=buildStreetSignalModel(vert,away);STREET_SIGNAL_MODELS.set(key,model);}return model;
}
function drawSignal(s) {
  const [vx,vy]=R(s.x,s.y),d=Math.hypot(vx,vy);if(d>vis+1)return;
  const away=Math.sign(s.vert?s.y-(s.by+1):s.x-(s.bx+1))||1,near=d<6,ped=near?pedestrianSignal(s,T):'stop';
  streetSignalModel(s.vert,away).draw(vx,vy,near,light(s.bx,s.by,s.vert,T),ped,ped!=='flash'||fract(T)<.5);
}
