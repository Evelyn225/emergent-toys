'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {skateSim}=require('./helpers/skate-sim.cjs');
const ctx=vm.createContext({});
vm.runInContext('const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rel=v=>v;',ctx);
for(const f of ['skate-transitions.js','skate-pool.js','skate-pool-render.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../city',f),'utf8'),ctx);
const make=vm.runInContext('(pool)=>({x:0,y:0,z0:.0002,profile:skateProfile({radius:.4,height:.32}),pool})',ctx);
const frame=vm.runInContext('skatePoolFrame',ctx),sample=vm.runInContext('skatePoolSample',ctx),mesh=vm.runInContext('buildSkatePoolMesh',ctx);
const design={rx:.5,ry:.81,curve:.22};
test('pool surface normals agree with geometry through all curves and mesh vertices',()=>{
 const o=make(design),p=o.profile;
 for(let i=0;i<80;i++)for(const fraction of [.1,.5,.9]){
  const u=p.flat/2+p.curve*fraction,t=i/80*Math.PI*2,f=frame(o,u,t),du=frame(o,u+1e-6,t),dt=frame(o,u,t+1e-6);
  const dot=g=>(g.x-f.x)*f.n[0]+(g.y-f.y)*f.n[1]+(g.z-f.z)*f.n[2];
  assert.ok(Math.abs(dot(du))<1e-9&&Math.abs(dot(dt))<1e-9);
  const h=sample(o,f.x,f.y);assert.ok(Math.abs(h.h-o.z0-f.z)<1e-9);
 }
 const m=mesh(o);for(const v of m.vertices.slice(0,m.surfaceVertices)){const h=sample(o,v.x*.999999,v.y*.999999);assert.ok(h);if(v.z<o.z0+p.height-.001)assert.ok(Math.abs(v.z-h.h)<.00001);}
});
test('pool simulation carries momentum through changing curves and rolls back from walls',()=>{
 const bowl={radius:.4,height:.32,pool:design};
 // Cross the floor, climb the far wall, stall and return without a bail.
 const run=skateSim([{frames:600}],{bowl,position:[0,0],speed:.5,physics:{concrete:0},dt:1/120});
 assert.ok(run.some(p=>p.contact==='transition'));
 assert.ok(run.some(p=>p.velocity[0]<-.05));
 assert.ok(run.every(p=>!p.bail));
 const initial=.5*.5/2;
 for(const p of run.slice(1)){const energy=p.velocity.reduce((s,v)=>s+v*v/2,0)+.98*(p.worldZ-.0002);assert.ok(energy<=initial*1.03,`${p.t}: ${energy}`);}
});


test('a carve traverses all asymmetric pockets without bailing',()=>{
 const r=.5*(1+.22*.65)+.4*Math.sin(.8);
 const run=skateSim([{frames:1200}],{bowl:{radius:.4,height:.32,pool:design},position:[r,0],yaw:Math.PI/2,speed:.7,dt:1/240});
 assert.ok(run.every(p=>!p.bail));
 assert.ok(run.filter(p=>p.contact==='transition').length>run.length*.7);
 const quadrants=new Set(run.filter(p=>Math.abs(p.x)>.001&&Math.abs(p.y)>.001).map(p=>[Math.sign(p.x),Math.sign(p.y)].join(',')));
 assert.equal(quadrants.size,4);
});

test('rendered triangles follow the analytic pool between vertices',()=>{
 const o=make(design),m=mesh(o),p=o.profile;
 for(let i=0;i<32;i++)for(const f of [.1,.4,.7,.9]){
  const at=frame(o,p.flat/2+p.curve*f,(i+.37)/32*Math.PI*2);
  let height=-Infinity;
  for(const ids of m.triangles){
   const [a,b,c]=ids.map(i=>m.vertices[i]);
   const area=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
   if(Math.abs(area)<1e-12)continue;
   const u=((b.y-c.y)*(at.x-c.x)+(c.x-b.x)*(at.y-c.y))/area;
   const v=((c.y-a.y)*(at.x-c.x)+(a.x-c.x)*(at.y-c.y))/area,w=1-u-v;
   if(u>=0&&v>=0&&w>=0)height=Math.max(height,u*a.z+v*b.z+w*c.z);
  }
  assert.ok(Math.abs(height-o.z0-at.z)<.006,`${i}/${f}: ${height-o.z0-at.z}`);
 }
});


test('a pool coping air stays vertical and re-enters its bank without a false deck bail',()=>{
 // The deepest pocket's radial line is perpendicular to its coping.
 const yaw=4.608590759110083,r=1.1621489136335281;
 const run=skateSim([{frames:1100}],{bowl:{radius:.4,height:.32,pool:design},position:[r*Math.cos(yaw),r*Math.sin(yaw)],yaw,speed:.8,dt:1/240});
 const first=run.findIndex(p=>p.contact==='air');assert.ok(first>0);
 assert.ok(run[first].speed<.001);
 assert.ok(run.slice(first+1).some(p=>p.contact==='transition'));
 assert.ok(run.every(p=>!p.bail));
});
