// Bamboo profiles share their supporting rim with the next basket and lid.
const STEAMER={radius:.17,step:.09,lid:.042};
const STEAMER_BASKET=[[0,0],[0,.166],[.012,.17],[.020,.17],[.023,.166],
  [.068,.166],[.071,.17],[.09,.17],[.09,.162],[.016,.158],[.012,0]];
const STEAMER_LID=[[0,0],[0,.172],[.012,.174],[.018,.169],[.035,.12],[.042,.025],[.042,0]];
function kitchenBamboo(z,radius=.17) {
  return (i,t,L)=>{
    const footprint=t/projX,fine=coveDetail(t),top=Math.abs(HIT.nz)>.7;
    const u=top?HIT.u:Math.atan2(HIT.v,HIT.u)*radius;
    const weave=coveGroove(u,.014,.0018,footprint)+coveGroove(top?HIT.v:HIT.w-z,.018,.0016,footprint)*.4;
    const grain=Math.sin(u*380+HIT.w*21)*fine*.08;
    BG[i]=C(STONE,3.2+(3.4+L*.30)*coveLight(HIT.nx,HIT.ny,HIT.nz)-weave*.6+grain);set(i,' ',0);return true;
  };
}
function kitchenBasket(x,y,z,scale=1,closed=false) {
  const profile=STEAMER_BASKET.map(([w,r])=>[w*scale,r*scale]);
  coveLathe(x,y,z,profile,kitchenBamboo(z,STEAMER.radius*scale));
  if(closed)return;
  // Open baskets on the trolley show actual food resting on their woven base.
  for(const [u,v]of [[-.053,-.024],[.048,-.028],[0,.047]]) {
    foodOval(x+u*scale,y+v*scale,z+.012*scale,.035*scale,.025*scale,.047*scale,(i,t,L)=>{
      const crease=coveGroove(HIT.u,.012*scale,.0012*scale,t/projX);
      BG[i]=C(WHITE,3.5+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)-crease*.65);set(i,' ',0);return true;
    });
  }
}
function kitchenBasketLid(x,y,z) {
  coveLathe(x,y,z,STEAMER_LID,kitchenBamboo(z));
  for(let k=0;k<6;k++) {
    const a=k*Math.PI/6,b=(k+1)*Math.PI/6;
    coveTube(x+Math.cos(a)*.025,y,z+.039+Math.sin(a)*.025,
      x+Math.cos(b)*.025,y,z+.039+Math.sin(b)*.025,.006,BRICK);
  }
}
function kitchenSteamerSteam(s,z) {
  if(mode!=='room'||!room||Math.hypot(s.x-px,s.y-py)>12||T<(s.steamDue??-1))return;
  s.steamDue=T+1.1;
  haze.push({at:placeKey(),kind:'steam',s:1,x:s.x,y:s.y,z,r:.018,rMax:.06,
    vx:.004,vy:.002,vz:.09,life:1,fade:1/1.6,seed:s.x*13+s.y*7+T});
  while(haze.length>140)haze.shift();
}
function KITCHEN_STEAMER_STACK(x,y,n) {
  const top=1+n*STEAMER.step;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=0;k<n;k++)kitchenBasket(vx,vy,1+k*STEAMER.step,1,true);
    kitchenBasketLid(vx,vy,top);
  }),box:boxAt(x,y,1,0,.174,.174,1,top+.07),radius:.3,
    kitchenSteamer:{count:n,top},tick:s=>kitchenSteamerSteam(s,top+.065)};
}
const DIMSUM_CART={half:.32,halfWidth:.22,shelf:.80,bottomShelf:.24};
function KITCHEN_DIMSUM_CART(k) {
  const facing={c:1,s:0},q=DIMSUM_CART;
  return {...ROOM_MODEL(7.4,6.3,(vx,vy)=>{
    const {c,s}=facing,point=(u,v)=>[vx+u*c-v*s,vy+u*s+v*c];
    for(const [u,v]of [[-.25,-.18],[-.25,.18],[.25,-.18],[.25,.18]]) {
      const [x,y]=point(u,v);
      foodOval(x,y,0,.075,.020,.15,kitchenFoodShade(GRAY),c,s);
      coveTube(x,y,.08,x,y,.25,.014,GRAY);
      coveTube(x,y,.25,x,y,q.shelf+.025,.012,GRAY);
    }
    for(const z of [q.bottomShelf,q.shelf]) {
      // One closed bevelled sheet, turned with the cart, supports each load.
      drawBox({...boxAt(vx,vy,c,s,q.half,q.halfWidth,z-.025,z),
        ...kitchenTopProfile(q.half,q.halfWidth,z-.025,z,.005)},kitchenSteel,homeRayWorktop);
      for(const side of [-1,1]) {
        const a=point(-q.half+.01,side*(q.halfWidth-.01)),b=point(q.half-.01,side*(q.halfWidth-.01));
        coveTube(...a,z+.01,...b,z+.01,.01,GRAY);
      }
    }
    // An open handle is joined to the rear frame, where the server pushes.
    for(const side of [-1,1]) {
      const a=point(-.25,side*.18),b=point(-.36,side*.18);
      coveTube(...a,.68,...b,.90,.012,GRAY);
    }
    const left=point(-.36,-.18),right=point(-.36,.18);
    coveTube(...left,.90,...right,.90,.014,GRAY);
    for(const [u,v]of [[-.15,-.10],[-.15,.10],[.15,-.10],[.15,.10]]) {
      const [x,y]=point(u,v);kitchenBasket(x,y,q.shelf,.48);
    }
    const [x,y]=point(.12,0);
    const plate=KITCHEN_VESSELS.plate,inner=plate[plate.length-2],floor=plate[plate.length-1],scale=1.05;
    // The flat foot touches the shallow inner slope at its outer radius.
    const nesting=(floor[0]+(inner[0]-floor[0])*plate[1][1]/inner[1])*scale;
    for(let j=0;j<3;j++)kitchenVessel(x,y,q.bottomShelf+j*nesting,'plate',WHITE,scale);
  }),radius:.6,kitchenCart:{shelf:q.shelf},tick:s=>{
    [s.x,s.y]=DIMSUM_LOOP(T,k);
    const a=T*.15+k*Math.PI,vx=-1.7*Math.sin(a),vy=Math.cos(a),len=Math.hypot(vx,vy);
    facing.c=vx/len;facing.s=vy/len;kitchenSteamerSteam(s,q.shelf+.065);
  }};
}
