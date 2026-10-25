// A bound volume shares its shelf support plane. The covers stand proud of
// the paper; the spine joins both covers and the page block's bound edge.
function homeShelfBook(u,v,z,height,halfDepth,color,index) {
  const cover=.003,halfWidth=.022,paperHalf=halfWidth-cover,spine=.006;
  const parts=[],ink=(i,t,L)=>{
    const band=HIT.face===3&&(Math.abs(HIT.w-z-.018)<.003||Math.abs(HIT.w-z-height+.018)<.003);
    BG[i]=C(band?WARM:color,(band?3.8:2.5)+L*.26*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  };
  const paper=(i,t,L)=>{
    const grain=coveDetail(t,.003)*Math.sin((HIT.w-z)*1700)*.12;
    BG[i]=C(STONE,4.3+L*.24*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain);set(i,' ',0);return true;
  };
  const part=(role,x,y,hl,hw,z0,z1,shade,bevel)=>parts.push({role,x,y,hl,hw,z0,z1,shade,profile:kitchenPanelProfile(hl,hw,z0,z1,bevel)});
  for(const side of [-1,1])part('cover',side*(halfWidth-cover/2),0,cover/2,halfDepth,z,z+height,ink,.0005);
  part('spine',0,halfDepth-spine/2,paperHalf,spine/2,z,z+height,ink,.0005);
  const pageBack=-halfDepth+.005,pageFront=halfDepth-spine;
  part('pages',0,(pageBack+pageFront)/2,paperHalf,(pageFront-pageBack)/2,z+.004,z+height-.004,paper,.00025);
  return {
    bounds:{u,v,hl:halfWidth,hw:halfDepth,z0:z,z1:z+height},
    draw(vx,vy,c,s){
      for(const p of parts){const x=u+p.x,y=v+p.y;
        drawBox({...boxAt(vx+c*x-s*y,vy+s*x+c*y,c,s,p.hl,p.hw,p.z0,p.z1),...p.profile,bookRole:p.role,bookIndex:index},p.shade,homeRayWorktop);
      }
    },
  };
}
