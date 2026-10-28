// Fitted baseboards follow the native wall faces. Horizontal members own
// corner squares; vertical members butt against them, without overlapping tops.
function homeSkirting(r) {
  if(!r.def.builtSkirting)return [];
  const tier=r.def.tier,height=[.105,.09,.155][tier],depth=[.022,.018,.026][tier],cap=.015;
  const bounds=b=>{const ex=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;return{x0:b.x-ex,x1:b.x+ex,y0:b.y-ey,y1:b.y+ey,z0:b.z0,z1:b.z1};};
  const blockers=[],addBlock=b=>{if(b&&b.z0<height&&b.z1>0)blockers.push(bounds(b));};
  for(const p of r.props){
    if(p.fig)continue;
    addBlock(p.box);
    // The entry has narrower real casings than the native two-cell D wall.
    for(const q of p.homeEntry?.parts||[])addBlock({...q.local,x:p.x+q.local.x,y:p.y+q.local.y});
    if(p.bathroomOpening){
      const draw=drawBox;drawBox=addBlock;try{p.draw(p.x,p.y);}finally{drawBox=draw;}
    }
  }
  const floor=(x,y)=>r.grid[y]?.[x]==='.'&&!inWc(x+.5,y+.5,r.def.wc)&&!(r.def.frenchDoor&&x>=r.def.frenchDoor.wall);
  const groups=new Map();
  for(let y=0;y<r.H;y++)for(let x=0;x<r.W;x++)if(floor(x,y))for(const[nx,ny]of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(!'#WD'.includes(r.grid[y-ny]?.[x-nx]||' '))continue;
    const horizontal=!!ny,line=horizontal?y+(ny<0?1:0):x+(nx<0?1:0),along=horizontal?x:y,key=[nx,ny,line].join(',');
    if(!groups.has(key))groups.set(key,{nx,ny,line,horizontal,cells:[]});groups.get(key).cells.push(along);
  }
  const runs=[];
  for(const g of groups.values()){
    g.cells.sort((a,b)=>a-b);let lo=g.cells[0],hi=lo+1;
    for(const v of g.cells.slice(1)){if(v===hi)hi++;else{runs.push({...g,lo,hi});lo=v;hi=v+1;}}runs.push({...g,lo,hi});
  }
  const parts=[],profile=[[0,height-cap,depth],[height-cap,height,depth+.004]];
  const material=(i,t,L,nx=HIT.nx,ny=HIT.ny,nz=HIT.nz)=>{
    if(tier===0)return coveTimber(i,HIT.u,HIT.w,L,t,nx,ny,nz,16);
    BG[i]=C(tier===2?WHITE:GRAY,(tier===2?3.9:1.2)+L*.30*coveLight(nx,ny,nz));set(i,' ',0);return true;
  };
  for(const[z0,z1,d]of profile){
    const fitted=[];
    for(const horizontal of [true,false])for(const g of runs.filter(q=>q.horizontal===horizontal)){
      const {nx,ny,line}=g,normal=horizontal?ny:nx,cross0=line-.002*normal,cross1=line+d*normal,low=Math.min(cross0,cross1),high=Math.max(cross0,cross1);
      let spans=[[g.lo-(horizontal?d:0),g.hi+(horizontal?d:0)]];
      for(const b of blockers.concat(horizontal?[]:fitted)){
        if(b.z0>=z1-1e-6||b.z1<=z0+1e-6)continue;
        const a=horizontal?b.y0:b.x0,B=horizontal?b.y1:b.x1;if(B<=low+1e-6||a>=high-1e-6)continue;
        const from=horizontal?b.x0:b.y0,to=horizontal?b.x1:b.y1;
        spans=spans.flatMap(([lo,hi])=>to<=lo||from>=hi?[[lo,hi]]:[[lo,Math.min(hi,from)],[Math.max(lo,to),hi]].filter(([a,b])=>b-a>.001));
      }
      for(const[lo,hi]of spans){
        const mid=(lo+hi)/2,cross=(low+high)/2,c=ny,s=-nx;
        const box=boxAt(horizontal?mid:cross,horizontal?cross:mid,c,s,(hi-lo)/2,(high-low)/2,z0,z1),view={...box};
        const shade=(i,t,L)=>{const f=HIT.face,u=f===1?1:f===2?-1:0,v=f===3?1:f===4?-1:0;HIT.nx=c*u-s*v;HIT.ny=s*u+c*v;HIT.nz=f===5?1:f===6?-1:0;
          // An unresolved horizontal lip keeps the front's light instead of
          // alternating bright/dark cells; real cap shading resolves nearby.
          const resolve=f>=5?smooth(clamp(Math.abs(eye-HIT.w)*2*box.hw*projY/(t*t)-.5,0,1)):1;
          return material(i,t,L,HIT.nx*resolve+nx*(1-resolve),HIT.ny*resolve+ny*(1-resolve),HIT.nz*resolve);};
        parts.push({box,view,shade,normal:[nx,ny],wall:line});fitted.push(bounds(box));
      }
    }
  }
  return [{...ROOM_MODEL(0,0,(vx,vy)=>{for(const p of parts){p.view.x=vx+p.box.x;p.view.y=vy+p.box.y;drawBox(p.view,p.shade);}}),walk:true,radius:Math.hypot(r.W,r.H),homeSkirting:{parts,profile,blockers}}];
}
