'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(points){
 const ctx=vm.createContext({points});
 vm.runInContext(`
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,m)=>((v%m)+m)%m,worldCoord=v=>v;
 let px=0,py=0,a=0,T=100;const SK={v:.6,dir:0,spin:0},SKB={},K={},SK_INPUT={right:[0,0],steer:0};
 const body={z:0,vz:0,trick:null},SK_POINTS={},actx=null;let exited=null;
 const skateGround=()=>0,say=()=>{};Math.random=()=>.5;
 const skateAir=()=>body.z>0||body.vz>0,grindPoints=()=>100;
 function endGrind(){exited=SK.grind;SK.grind=null;}
 function skateBail(){throw new Error('unexpected bail');}
 `,ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/skate-paths.js'),'utf8'),ctx);
 const ev=s=>vm.runInContext(s,ctx);
 ev("const path=addGrindPath(points,{kind:'handrail',material:'metal'});startPathGrind(path,0,1);");
 return {ev};
}
test('a kinked rail preserves the grind through its corner and exits with tangent momentum',()=>{
 const {ev}=setup([[0,0,.1],[.3,0,.1],[.6,.2,.1]]);
 ev('let crossed=false;for(let i=0;i<120&&SK.grind;i++){T+=1/60;stepPathGrind(1/60);if(py>0&&SK.grind)crossed=true;}');
 assert.equal(ev('crossed'),true);assert.equal(ev('SK.grind'),null);
 assert.ok(ev('exited.exitVelocity[0]>0&&exited.exitVelocity[1]>0'));
 assert.ok(Math.abs(ev('py')-.2)<1e-9);
});
test('gravity accelerates a downhill handrail and uphill motion loses speed',()=>{
 const down=setup([[0,0,.5],[2,0,.1]]),up=setup([[0,0,.1],[2,0,.5]]);
 down.ev('const initial=SK.grind.speed;for(let i=0;i<30;i++){T+=1/60;stepPathGrind(1/60);}');
 up.ev('const initial=SK.grind.speed;for(let i=0;i<30;i++){T+=1/60;stepPathGrind(1/60);}');
 assert.ok(down.ev('SK.grind.speed>initial'));
 assert.ok(up.ev('SK.grind.speed<initial'));
});
test('nearest path height interpolates in 3D and families follow board and stick angle',()=>{
 const {ev}=setup([[0,0,.5],[2,0,.1]]);
 assert.ok(Math.abs(ev('grindPathNearest(path.segments[0],1,.02).p[2]')-.3)<1e-12);
 for(const [expr,name]of [
  ["grindFamily(0,'handrail',0,0)",'50-50'],["grindFamily(0,'handrail',0,-1)",'nosegrind'],
  ["grindFamily(.7,'handrail',-1,0)",'smith'],["grindFamily(.7,'handrail',1,0)",'feeble'],
  ["grindFamily(.7,'handrail',0,-1)",'overcrook'],["grindFamily(1.5,'handrail',0,0)",'boardslide'],
  ["grindFamily(1.5,'skateledge',0,0)",'lipslide'],["grindFamily(1.5,'handrail',0,1)",'tailslide']
 ])assert.equal(ev(expr),name);
});
