// Specialist ovens use the same measured shell for their openings and trim.
const PIZZA_DOME={radius:.74,height:.74,innerRadius:.65,innerHeight:.66};
const PIZZA_MOUTH={half:.29,height:.38,front:.42};
function pizzaDomeRadius(z) {
  return PIZZA_DOME.radius*Math.sqrt(Math.max(0,1-(z/PIZZA_DOME.height)**2));
}
const PIZZA_ARCH=Array.from({length:17},(_,k)=>{
  const a=k*Math.PI/16,u=PIZZA_MOUTH.half*Math.cos(a),z=PIZZA_MOUTH.height*Math.sin(a),r=pizzaDomeRadius(z);
  return [u,Math.sqrt(Math.max(0,r*r-u*u)),z];
});
function kitchenRayPizzaOven(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,z=oz-b.ovenFloor;let best=Infinity,nx=0,ny=0,nz=0,inside=false;
  // Four analytic roots replace repeated walks through a many-segment profile.
  // The same ellipse defines the shell, the arch attachment and its normals.
  for(const inner of [false,true]) {
    const radius=inner?PIZZA_DOME.innerRadius:PIZZA_DOME.radius,height=inner?PIZZA_DOME.innerHeight:PIZZA_DOME.height;
    const rr=radius*radius,hh=height*height,A=(rx*rx+ry*ry)/rr+rz*rz/hh;
    const B=(x*rx+y*ry)/rr+z*rz/hh,D=B*B-A*((x*x+y*y)/rr+z*z/hh-1);
    if(D<0)continue;
    for(const sign of [-1,1]) {
      const t=(-B+sign*Math.sqrt(D))/A;if(t<=.01||t>=best)continue;
      const u=x+rx*t,v=y+ry*t,w=z+rz*t;if(w<0)continue;
      if(v>PIZZA_MOUTH.front&&(u/PIZZA_MOUTH.half)**2+(w/PIZZA_MOUTH.height)**2<1)continue;
      const normal=Math.hypot(u/rr,v/rr,w/hh),side=inner?-1:1;
      best=t;nx=side*u/rr/normal;ny=side*v/rr/normal;nz=side*w/hh/normal;inside=inner;
    }
  }
  if(Math.abs(rz)>1e-10) {
    const t=-z/rz,u=x+rx*t,v=y+ry*t,r=Math.hypot(u,v);
    if(t>.01&&t<best&&r>=PIZZA_DOME.innerRadius&&r<=PIZZA_DOME.radius){best=t;nx=ny=0;nz=-1;inside=false;}
  }
  if(!Number.isFinite(best))return -1;
  HIT.u=x+rx*best;HIT.v=y+ry*best;HIT.w=oz+rz*best;
  HIT.nx=nx;HIT.ny=ny;HIT.nz=nz;HIT.part=inside?1:0;HIT.face=nz>.9?5:nz<-.9?6:0;return best;
}
function KITCHEN_PIZZA_OVEN(x,y) {
  const floor=.95;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const brick=(i,t,L)=>{
      const soot=HIT.part===1;
      const footprint=t/projX,row=Math.floor((HIT.w-floor)/.095);
      const grout=Math.max(coveGroove(HIT.w-floor,.095,.008,footprint),
        coveGroove(Math.atan2(HIT.v,HIT.u)*.7+(row&1)*.1,.20,.008,footprint));
      BG[i]=C(soot?GRAY:BRICK,(soot?.65:2.2)+L*(soot?.09:.28)*coveLight(HIT.nx,HIT.ny,HIT.nz)-grout*.7);
      set(i,' ',0);return true;
    };
    coveRound(vx,vy,1,0,.85,.75,0,.91,.025,(i,t,L)=>{
      const row=Math.floor(HIT.w/.095),u=Math.abs(HIT.nx)>.5?HIT.v:HIT.u,footprint=t/projX;
      const grout=Math.max(coveGroove(HIT.w,.095,.008,footprint),coveGroove(u+(row&1)*.1,.20,.008,footprint));
      BG[i]=C(BRICK,2.2+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz)-grout*.8);set(i,' ',0);return true;
    });
    drawBox({...boxAt(vx,vy,1,0,.85,.75,.91,floor),...kitchenTopProfile(.85,.75,.91,floor)},homeStone,homeRayWorktop);
    drawBox({...boxAt(vx,vy-.05,1,0,.74,.74,floor,floor+.74),ovenFloor:floor},brick,kitchenRayPizzaOven);
    for(let k=1;k<PIZZA_ARCH.length;k++) {
      const a=PIZZA_ARCH[k-1],b=PIZZA_ARCH[k];
      coveTube(vx+a[0],vy-.05+a[1],floor+a[2],vx+b[0],vy-.05+b[1],floor+b[2],.022,STONE);
    }
    for(const u of [-.11,.11])drawBox({...boxAt(vx+u,vy-.01,1,0,.022,.132,floor,floor+.044),
      ax:vx+u,ay:vy-.12,az:floor+.022,bx:vx+u,by:vy+.10,bz:floor+.022,r:.022},(i,t,L)=>{
      BG[i]=C(GRAY,.6+L*.08*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
    },coveRayCapsule);
    drawShape(vx,vy+.03,floor+.02,.27,.27,(i,u,z,du,dz,L)=>{
      const n=noise(u*23,z*17-T*3,1981),width=.12*(1-z/.27)*(0.6+n*.4);
      if(Math.abs(u)>width)return false;
      BG[i]=C(Math.abs(u)<width*.45?YEL:ORANGE,7+n*5);set(i,' ',0);return true;
    });
    coveLathe(vx,vy-.05,1.66,[[0,0],[0,.09],[1.42,.09],[1.42,0]],kitchenSteel);
    coveTube(vx+.73,vy+.55,.04,vx+.92,vy+.40,1.92,.014,BRICK);
    const paddle={...boxAt(vx+.92,vy+.40,.6,.8,.12,.012,1.9,2.15),...kitchenPanelProfile(.12,.012,1.9,2.15,.004)};
    drawBox(paddle,kitchenSteel,homeRayWorktop);
  },[.95,.85,1.69]),radius:1.2,kitchenAppliance:{kind:'pizza-oven',floor}};
}
function KITCHEN_DECK_OVEN(x,y) {
  const shade=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,.72,.43,0,2.1,.025,(i,t,L)=>{
      // Three separate windows belong only to the front door faces.
      const k=Math.floor((HIT.w-.22)/.58),lo=.22+k*.58;
      if(HIT.ny>.9&&Math.abs(HIT.u)<.49&&k>=0&&k<3&&HIT.w>lo+.10&&HIT.w<lo+.34)return false;
      return shade(i,t,L);
    });
    for(let k=0;k<3;k++) {
      const lo=.22+k*.58;
      drawBox(boxAt(vx,vy+.407,1,0,.49,.003,lo+.10,lo+.34),(i,t,L)=>{
        BG[i]=C(ORANGE,1.5+Math.max(0,Math.sin(T*.8+k))*.5);
        const tray=coveGroove(HIT.w-lo-.13,.13,.005,t/projX);
        if(tray>.5)BG[i]=C(GRAY,2.2);set(i,' ',0);return true;
      });
      coveTube(vx-.44,vy+.47,lo+.38,vx+.44,vy+.47,lo+.38,.014,GRAY);
      for(const side of [-1,1])coveTube(vx+side*.44,vy+.405,lo+.38,vx+side*.44,vy+.47,lo+.38,.012,GRAY);
      foodOval(vx+.60,vy+.437,lo+.175,.025,.018,.05,shade);
    }
  }),box:boxAt(x,y+.027,1,0,.72,.457,0,2.1),radius:1.0,kitchenAppliance:{kind:'deck-oven'}};
}
function KITCHEN_BREAD_RACK(x,y,hl=3.1) {
  const levels=[1.15,1.70,2.25],step=hl*2/10;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const side of [-1,1])coveRound(vx+side*hl,vy-.055,1,0,.025,.035,.9,2.47,.008,'wood');
    for(const [row,z]of levels.entries()) {
      drawBox({...boxAt(vx,vy,1,0,hl,.13,z-.025,z),...kitchenTopProfile(hl,.13,z-.025,z,.005)},furnitureTimber(BRICK),homeRayWorktop);
      for(let k=0;k<10;k++) {
        const xx=vx-hl+step*(k+.5),seed=hash(k,row,1982);
        foodOval(xx,vy,z,.13,.079,.115,(i,t,L)=>{
          const cut=HIT.nz>.4?coveGroove(HIT.u+HIT.v*.5,.055,.006,t/projX)*coveDetail(t):0;
          BG[i]=C(seed>.6?WARM:ORANGE,2.8+L*.32*coveLight(HIT.nx,HIT.ny,HIT.nz)+cut*.9);set(i,' ',0);return true;
        });
      }
    }
  }),box:boxAt(x,y,1,0,hl+.025,.13,.9,2.47),radius:hl+.3,kitchenAppliance:{kind:'bread-rack'}};
}
