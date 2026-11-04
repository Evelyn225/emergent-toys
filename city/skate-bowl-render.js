// Cache the revolved faces once. The hot ray loop allocates no roots, vectors
// or closures, and rejects each face by its radial/height interval.
function prepareBowlFaces(p) {
  const faces=[];
  const add=(ra,za,rb,zb,face)=>{
    const vertical=Math.abs(rb-ra)<1e-10,k=vertical?0:(zb-za)/(rb-ra);
    faces.push({lo:Math.min(ra,rb),hi:Math.max(ra,rb),zlo:Math.min(za,zb),zhi:Math.max(za,zb),vertical,k,k2:k*k,b:za-k*ra,face});
  };
  const points=p.radialPoints;
  for(let i=1;i<points.length;i++)add(...points[i-1],...points[i],7);
  add(p.tip+p.deck,0,p.tip+p.deck,p.height,1);
  // The small coping reads as a clean metal bevel rather than a dotted tube.
  add(p.tip-.003,p.height,p.tip,p.height+.003,9);
  add(p.tip,p.height+.003,p.tip+.003,p.height,9);
  return faces;
}
function rayBowlProfile(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,z=oz-b.z0,p=b.profile;
  const faces=p.rayFaces||(p.rayFaces=prepareBowlFaces(p));
  const aa=rx*rx+ry*ry,bb=2*(x*rx+y*ry),cc=x*x+y*y;
  let nearest=Infinity,face=0,nrad=0,nz=1;
  for(let i=0;i<faces.length;i++){
    const f=faces[i];let A,B,C;
    if(f.vertical){A=aa;B=bb;C=cc-f.lo*f.lo;}
    else if(Math.abs(f.k)<1e-12){A=0;B=rz;C=z-f.b;}
    else{const q=z-f.b;A=rz*rz-f.k2*aa;B=2*rz*q-f.k2*bb;C=q*q-f.k2*cc;}
    let t0,t1;
    if(Math.abs(A)<1e-12){if(Math.abs(B)<1e-12)continue;t0=t1=-C/B;}
    else{const disc=B*B-4*A*C;if(disc<0)continue;const root=Math.sqrt(disc);t0=(-B-root)/(2*A);t1=(-B+root)/(2*A);}
    for(let j=0;j<2;j++){
      const t=j?t1:t0;if(t<=.01||t>=nearest)continue;
      const zz=z+rz*t;
      if(zz<f.zlo-1e-8||zz>f.zhi+1e-8)continue;
      const xx=x+rx*t,yy=y+ry*t,r2=xx*xx+yy*yy;
      if(r2<f.lo*f.lo-1e-8||r2>f.hi*f.hi+1e-8)continue;
      const r=Math.sqrt(r2);
      if(!f.vertical&&Math.abs(zz-f.k*r-f.b)>1e-7)continue;
      nearest=t;face=f.face;
      const len=Math.sqrt(1+f.k2);nrad=f.vertical?-1:-f.k/len;nz=f.vertical?0:1/len;
    }
  }
  if(nearest===Infinity)return -1;
  const xx=x+rx*nearest,yy=y+ry*nearest,r=Math.hypot(xx,yy);
  if(face===7&&r<p.tip){const q=Math.max(0,r-p.flat/2)/p.radius;nrad=-q;nz=Math.sqrt(Math.max(0,1-q*q));}
  HIT.face=face;HIT.u=r;HIT.v=0;HIT.w=oz+rz*nearest;
  HIT.nx=xx/(r||1)*nrad;HIT.ny=yy/(r||1)*nrad;HIT.nz=nz;
  return nearest;
}
