// The sushi bar's island is built round its belt rather than four painted
// boxes: a hinoki carcass on a recessed plinth, an eating ledge outside the
// belt and a serving ledge inside it, steel guide rails either side and a
// slatted belt that moves at the plates' own speed. Hot-water taps and tea
// canisters stand on the outer ledge at the seats. Every piece is an
// axis-aligned slab from one set of measurements, so corners meet exactly.
// The 20cm plate rims need clearance from the raised guides, not just foot support.
const SUSHI_ISLAND={fitting:.2,edge:.25,top:.95,slab:.04,belt:.11,rail:.02,railTop:.965,plinth:.1,kick:.05,speed:.18};
const sushiRect=(x0,x1,y0,y1,z0,z1,role)=>({x0,x1,y0,y1,z0,z1,role});
// One side's slabs. Long sides (along x) own the corners; (o) is outward.
function sushiIslandSide(loop,kind,o) {
  const {edge:E,belt:b,rail:r,top,slab,railTop,plinth,kick}=SUSHI_ISLAND,{x0,x1,y0,y1}=loop,z=top-slab,out=[];
  if(kind==='long') {
    const Y=o<0?y0:y1,a=(v0,v1)=>[Math.min(Y+o*v0,Y+o*v1),Math.max(Y+o*v0,Y+o*v1)];
    out.push(sushiRect(x0-E+kick,x1+E-kick,...a(-E+kick,E-kick),0,plinth,'plinth'));
    out.push(sushiRect(x0-E,x1+E,...a(-E,E),plinth,z,'body'));
    out.push(sushiRect(x0-E,x1+E,...a(b+r,E),z,top,'outer-ledge'));
    out.push(sushiRect(x0-b-r,x1+b+r,...a(b,b+r),z,railTop,'outer-rail'));
    out.push(sushiRect(x0-b,x1+b,...a(-b,b),z,top,'belt'));
    out.push(sushiRect(x0+b+r,x1-b-r,...a(-b-r,-b),z,railTop,'inner-rail'));
    out.push(sushiRect(x0+b+r,x1-b-r,...a(-E,-b-r),z,top,'inner-ledge'));
  } else {
    const X=o<0?x0:x1,a=(v0,v1)=>[Math.min(X+o*v0,X+o*v1),Math.max(X+o*v0,X+o*v1)];
    out.push(sushiRect(...a(-E+kick,E-kick),y0+E-kick,y1-E+kick,0,plinth,'plinth'));
    out.push(sushiRect(...a(-E,E),y0+E,y1-E,plinth,z,'body'));
    out.push(sushiRect(...a(b+r,E),y0-b-r,y1+b+r,z,top,'outer-ledge'));
    out.push(sushiRect(...a(b,b+r),y0-b,y1+b,z,railTop,'outer-rail'));
    out.push(sushiRect(...a(-b,b),y0+b,y1-b,z,top,'belt'));
    out.push(sushiRect(...a(-b-r,-b),y0+b,y1-b,z,railTop,'inner-rail'));
    out.push(sushiRect(...a(-E,-b-r),y0+E,y1-E,z,top,'inner-ledge'));
  }
  return out;
}
// Seats along the outer ledge: a tap to one side, a tea canister to the
// other, close enough that the corner seats' fittings stay on the ledge.
function sushiIslandSeats(loop) {
  const {edge:E,belt:b,rail:r}=SUSHI_ISLAND,{x0,x1,y0,y1}=loop,mid=(b+r+E)/2,out=[];
  for(let x=x0;x<=x1+1e-6;x+=1)for(const [Y,o]of [[y0,-1],[y1,1]])out.push({x,y:Y+o*mid,fx:0,fy:o,along:[1,0]});
  for(const [X,o]of [[x0,-1],[x1,1]])out.push({x:X+o*mid,y:(y0+y1)/2,fx:o,fy:0,along:[0,1]});
  return out;
}
function sushiHinoki(i,t,L,nx,ny,nz,u,batten) {
  const light=coveLight(nx,ny,nz),f=t/projX,grain=coveDetail(t,.4)*Math.sin(u*90+Math.sin(u*7)*3)*.18;
  const groove=batten?coveGroove(u,.12,.006,f):0;
  BG[i]=C(STONE,3+L*.3*light+grain-groove*1.4);set(i,' ',0);return true;
}
function SUSHI_ISLAND_SIDE(loop,kind,o) {
  const parts=sushiIslandSide(loop,kind,o),body=parts.find(p=>p.role==='body'),{x0,x1,y0,y1}=loop,P=2*(x1-x0+y1-y0);
  // the belt position s round the loop, as sushiAt measures it
  const along=(x,y)=>kind==='long'?(o<0?x-x0:(x1-x0)+(y1-y0)+(x1-x)):(o>0?(x1-x0)+(y-y0):P-(y-y0));
  const normal=f=>[f===1?1:f===2?-1:0,f===3?1:f===4?-1:0,f===5?1:f===6?-1:0];
  const shades={
    plinth:(i,t,L)=>{BG[i]=C(BRICK,1+L*.08);set(i,' ',0);return true;},
    body:(i,t,L)=>{const [nx,ny,nz]=normal(HIT.face);return sushiHinoki(i,t,L,nx,ny,nz,Math.abs(nx)?HIT.v:HIT.u,nx*o>.5||ny*o>.5);},
    rail:(i,t,L)=>{const [nx,ny,nz]=normal(HIT.face);return coveMetal(i,L,nx,ny,nz);},
    ledge:(i,t,L)=>{const [nx,ny,nz]=normal(HIT.face);return sushiHinoki(i,t,L,nx,ny,nz,Math.abs(nx)?HIT.v:HIT.u,false);},
    belt:(i,t,L)=>{
      if(HIT.face!==5){const [nx,ny,nz]=normal(HIT.face);return coveMetal(i,L,nx,ny,nz);}
      // steel slats sliding round under the plates
      const s=along(HIT.u+bx,HIT.v+by),slat=coveGroove(s-T*SUSHI_ISLAND.speed,.05,.008,t/projX);
      BG[i]=C(GRAY,2.6+L*.22-slat*1.6);set(i,' ',0);return true;
    },
  };
  let bx=0,by=0; // the world point the belt box is centred on, for its slat phase
  const role=p=>p.role.endsWith('rail')?'rail':p.role.endsWith('ledge')?'ledge':p.role;
  const cx=(body.x0+body.x1)/2,cy=(body.y0+body.y1)/2;
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{
    for(const p of parts) {
      const mx=(p.x0+p.x1)/2,my=(p.y0+p.y1)/2;
      if(p.role==='belt'){bx=mx;by=my;}
      drawBox(boxAt(vx+mx-cx,vy+my-cy,1,0,(p.x1-p.x0)/2,(p.y1-p.y0)/2,p.z0,p.z1),shades[role(p)]);
    }
  }),box:boxAt(cx,cy,1,0,(body.x1-body.x0)/2,(body.y1-body.y0)/2,0,SUSHI_ISLAND.top),radius:Math.hypot(body.x1-body.x0,body.y1-body.y0)/2+.05,
    sushiIsland:{kind,o,parts}};
}
function SUSHI_ISLAND_FITTINGS(loop) {
  const seats=sushiIslandSeats(loop),z=SUSHI_ISLAND.top;
  const tin=(i,t,L)=>{BG[i]=C(HIT.w>z+.08?GRAY:GREEN,(HIT.w>z+.08?2:2.2)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const button=(i,t,L)=>{BG[i]=C(RED,3+L*.2);set(i,' ',0);return true;};
  const cx=(loop.x0+loop.x1)/2,cy=(loop.y0+loop.y1)/2;
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{
    for(const q of seats) {
      const [ax,ay]=q.along,f=SUSHI_ISLAND.fitting,tx=vx+q.x-cx+ax*f,ty=vy+q.y-cy+ay*f,gx=vx+q.x-cx-ax*f,gy=vy+q.y-cy-ay*f;
      // the hot-water tap: a steel body, a push button, the spout over the ledge's outer half
      coveLathe(tx,ty,z,[[0,0],[0,.022],[.006,.02],[.075,.018],[.08,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
      coveLathe(tx,ty,z+.08,[[0,0],[0,.01],[.008,.01],[.008,0]],button);
      coveTube(tx,ty,z+.055,tx+q.fx*.045,ty+q.fy*.045,z+.04,.006,GRAY);
      // the tea canister, lidded
      coveLathe(gx,gy,z,[[0,0],[0,.03],[.08,.03],[.08,.032],[.095,.032],[.1,0]],tin);
    }
  }),radius:Math.hypot(loop.x1-loop.x0,loop.y1-loop.y0)/2+.5,sushiFittings:{seats}};
}
function SUSHI_ISLAND_PROPS(loop) {
  return [SUSHI_ISLAND_SIDE(loop,'long',-1),SUSHI_ISLAND_SIDE(loop,'long',1),SUSHI_ISLAND_SIDE(loop,'short',-1),SUSHI_ISLAND_SIDE(loop,'short',1),SUSHI_ISLAND_FITTINGS(loop)];
}
