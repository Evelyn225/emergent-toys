// Build once, then rasterise visible triangles. Work scales with covered screen
// cells rather than testing every curved wall against every camera ray.
function buildSkatePoolMesh(o) {
  const vertices=[],triangles=[],N=128,layers=20,p=o.profile;
  const vertex=(x,y,z,n,metal=false)=>{vertices.push({x,y,z:o.z0+z,light:metal?5.5:2.8+1.6*n[2]+1.8*n[0]-1.2*n[1]});return vertices.length-1;};
  const centre=vertex(0,0,0,[0,0,1]);
  for(let j=0;j<=layers+4;j++)for(let i=0;i<N;i++){
    const t=i/N*Math.PI*2,f=skatePoolFrame(o,p.flat/2+p.curve*Math.min(j,layers)/layers,t);
    let r=f.r,z=f.z,n=f.n,metal=false;
    if(j===layers+1){r+=.003;z+=.003;metal=true;}
    if(j===layers+2){r+=.006;metal=true;}
    if(j===layers+3){r+=p.deck;n=[0,0,1];}
    if(j===layers+4){r+=p.deck;z=0;n=[Math.cos(t),Math.sin(t),0];}
    vertex(r*Math.cos(t),r*Math.sin(t),z,n,metal);
    if(j===0)triangles.push([centre,1+i,1+(i+1)%N]);
    else{const a=1+(j-1)*N+i,b=1+(j-1)*N+(i+1)%N,c=1+j*N+i,d=1+j*N+(i+1)%N;triangles.push([a,b,c],[b,d,c]);}
  }
  return {vertices,triangles,surfaceVertices:1+N*(layers+1)};
}
function drawSkatePool(o) {
  const [ox,oy]=R(o.x,o.y),mesh=o.poolMesh;
  const points=mesh.vertices.map(v=>{const x=ox+v.x,y=oy+v.y;return [dx*x+dy*y,-dy*x+dx*y,v.z-eye,v.light];});
  for(const ids of mesh.triangles){
    let poly=ids.map(i=>points[i]);
    if(poly.every(v=>v[0]>.02))skatePoolTriangle(...poly);
    else{
      if(poly.every(v=>v[0]<=.02))continue;
      const clipped=[];
      for(let i=0;i<3;i++){
        const a=poly[i],b=poly[(i+1)%3],inside=a[0]>.02;
        if(inside)clipped.push(a);
        if(inside!==(b[0]>.02)){const t=(.02-a[0])/(b[0]-a[0]);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}
      }
      for(let i=1;i<clipped.length-1;i++)skatePoolTriangle(clipped[0],clipped[i],clipped[i+1]);
    }
  }
}
function skatePoolTriangle(a,b,c) {
  if(Math.min(a[0],b[0],c[0])>vis)return;
  const ax=cols/2+a[1]*projX/a[0],ay=hor-a[2]*projY/a[0];
  const bx=cols/2+b[1]*projX/b[0],by=hor-b[2]*projY/b[0];
  const cx=cols/2+c[1]*projX/c[0],cy=hor-c[2]*projY/c[0];
  const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(area)<1e-9)return;
  const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(cols-1,Math.floor(Math.max(ax,bx,cx)-.5));
  const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(rows-1,Math.floor(Math.max(ay,by,cy)-.5));
  const ua=(by-cy)/area,va=(cx-bx)/area,ub=(cy-ay)/area,vb=(ax-cx)/area;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const w0=ua*(x+.5-cx)+va*(y+.5-cy),w1=ub*(x+.5-cx)+vb*(y+.5-cy),w2=1-w0-w1;
    if(w0< -1e-8||w1< -1e-8||w2< -1e-8)continue;
    const depth=1/(w0/a[0]+w1/b[0]+w2/c[0]),i=y*cols+x;
    if(depth>=ZB[i]||depth>vis)continue;
    const light=depth*(w0*a[3]/a[0]+w1*b[3]/b[0]+w2*c[3]/c[0]);
    BG[i]=C(GRAY,light+(1-depth/vis)*15*amb*.25);set(i,' ',0);ZB[i]=ZBG[i]=depth;FL[i]=0;
  }
}
