// One measured ironwork model for the room (metres) and its real city balcony
// (one tenth scale). Foot flanges stay inside the deck; the east run owns both
// corner posts, and side runs finish on wall plates and those same corners.
const HOME_BALCONY_IRON={height:1.1,inset:.06,pitch:.24,postStep:1.4};
const HOME_BALCONY_POST=[[0,0],[0,.06],[.015,.06],[.035,.045],[.06,.027],[.99,.022],[1.035,.035],[1.065,.035],[1.085,.022],[1.095,.012],[1.1,.012],[1.1,0]];
function HOME_BALCONY_RAIL(x,y,c,s,length,endPosts,wallEnd=-1){
  const half=length/2,spans=Math.ceil(length/HOME_BALCONY_IRON.postStep),postUs=[],skeleton=[],variants=new Map();
  for(let j=endPosts?0:1;j<=(endPosts?spans:spans-1);j++)postUs.push(-half+j*length/spans);
  const xy=(u,v)=>[c*u-s*v,s*u+c*v];
  const tube=(role,A,B,r)=>{const[u,v,az]=A,[uu,vv,bz]=B,[ax,ay]=xy(u,v),[bx,by]=xy(uu,vv);skeleton.push({role,kind:'tube',ax,ay,az,bx,by,bz,r});};
  for(const u of postUs){const[x,y]=xy(u,0);skeleton.push({role:'post',kind:'post',x,y});}
  // The side runs extend a short way into their wall plates.
  const from=-half+(!endPosts&&wallEnd<0?.02:0),to=half-(!endPosts&&wallEnd>0?.02:0);
  tube('handrail',[from,0,1.045],[to,0,1.045],.028);
  tube('lower-rail',[from,0,.14],[to,0,.14],.018);
  const count=Math.ceil(length/HOME_BALCONY_IRON.pitch),pitch=length/count;
  for(let j=1;j<count;j++){
    const u=-half+j*pitch;if(postUs.some(p=>Math.abs(p-u)<.075))continue;
    // A gentle outward bow has connected rounded segments at either knee.
    const points=[[u,0,.14],[u,-.035,.43],[u,-.03,.74],[u,0,1.045]];
    for(let k=1;k<points.length;k++)tube('baluster',points[k-1],points[k],.011);
  }
  if(!endPosts)for(const z of [.14,1.045]){
    const[px,py]=xy(wallEnd*(half-.01),0);skeleton.push({role:'wall-plate',kind:'plate',x:px,y:py,z});
  }
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  function prepare(scale,base){
    const parts=[];
    for(const p of skeleton){let b,ray;
      if(p.kind==='post'){
        const profile=HOME_BALCONY_POST.map(([z,r])=>[base+z*scale,r*scale]);
        b={...boxAt(p.x*scale,p.y*scale,1,0,.06*scale,.06*scale,base,base+HOME_BALCONY_IRON.height*scale),profile};ray=coveRayLathe;
      }else if(p.kind==='tube'){
        const ax=p.ax*scale,ay=p.ay*scale,az=base+p.az*scale,bx=p.bx*scale,by=p.by*scale,bz=base+p.bz*scale,r=p.r*scale;
        b={...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r};ray=coveRayCapsule;
      }else{
        b=boxAt(p.x*scale,p.y*scale,c,s,.01*scale,.04*scale,base+(p.z-.05)*scale,base+(p.z+.05)*scale);ray=rayBox;
      }
      const shade=ray===rayBox?(i,t,L)=>{
        const f=HIT.face,nu=f===1?1:f===2?-1:0,nv=f===3?1:f===4?-1:0;
        HIT.nx=c*nu-s*nv;HIT.ny=s*nu+c*nv;HIT.nz=f===5?1:f===6?-1:0;return metal(i,t,L);
      }:metal;
      const lineShade=p.kind==='tube'?(i,t,L)=>{
        // Subcell metal keeps joined coverage instead of sparkling into
        // isolated hits. The analytic rounded surface returns up close.
        BG[i]=C(GRAY,2.5+L*.12);return set(i,' ',0),true;
      }:null;
      parts.push({role:p.role,local:b,view:{...b},ray,shade,lineShade,tube:p.kind==='tube'});
    }
    return parts;
  }
  function variant(scale,base){
    const key=scale+':'+base;let v=variants.get(key);
    if(!v){if(variants.size>=2)variants.clear();v={parts:null,far:boxAt(0,0,c,s,(half+.06)*scale,.06*scale,base,base+HOME_BALCONY_IRON.height*scale)};v.view={...v.far};
      v.shade=(i,t,L)=>{
        const u=HIT.u/scale,z=(HIT.w-base)/scale,du=t/projX/scale,dz=t/projY/scale;
        const top=Math.abs(z-1.045)<Math.max(.028,dz*.45),bottom=Math.abs(z-.14)<Math.max(.018,dz*.25);
        let post=false;const pr=Math.max(z<.06?.06:z>1.03?.035:.025,du*.25);
        for(const p of postUs)if(Math.abs(u-p)<pr){post=true;break;}
        const bars=pitch/du>1.2&&coveGroove(u+half,pitch,.022,du)>.35;
        if(!top&&!bottom&&!post&&!bars)return false;
        BG[i]=C(GRAY,1+L*.24);set(i,top||bottom?'=':'|',C(GRAY,L));return true;
      };variants.set(key,v);
    }return v;
  }
  function draw(vx,vy,scale=1,base=0){
    const v=variant(scale,base),near=Math.max(.05,dx*vx+dy*vy-Math.abs(dx*c+dy*s)*half*scale);
    if(pitch*scale*projX/near<2){const b=v.view;b.x=vx;b.y=vy;drawBox(b,v.shade);return;}
    v.parts||=prepare(scale,base);
    for(const p of v.parts){const b=p.view,q=p.local;b.x=vx+q.x;b.y=vy+q.y;
      if(p.tube){b.ax=vx+q.ax;b.ay=vy+q.ay;b.bx=vx+q.bx;b.by=vy+q.by;}
      // Character cells are taller than they are wide. A horizontal tube can
      // cover a column yet fall wholly between rows; use the smaller axis.
      const thin=p.tube&&b.r*2*Math.min(projX,projY)/Math.max(.05,dx*b.x+dy*b.y)<1.5;
      drawBox(b,thin?p.lineShade:p.shade,thin?rayRod:p.ray);
    }
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>draw(vx,vy)),drawScaled:draw,
    box:boxAt(x,y,c,s,half+.06,.06,0,HOME_BALCONY_IRON.height),radius:half+.15,
    homeBalconyRail:{c,s,length,half,pitch,postUs,skeleton,variants,endPosts,wallEnd}};
}
function homeBalconyRails(r){
  const b=r.def.balcony;if(!b||!r.def.builtBalconyRails)return[];
  const inset=HOME_BALCONY_IRON.inset,east=b.x1-inset,north=b.y0+inset,south=b.y1-inset,wall=b.x0-1;
  return [HOME_BALCONY_RAIL(east,(north+south)/2,0,1,south-north,true),
    HOME_BALCONY_RAIL((wall+east)/2,north,1,0,east-wall,false),
    HOME_BALCONY_RAIL((wall+east)/2,south,-1,0,east-wall,false,1)];
}
