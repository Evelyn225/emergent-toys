'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(pitch=0,roll=0){
 const c=vm.createContext({initialPitch:pitch,initialRoll:roll});vm.runInContext(`
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,m)=>(v%m+m)%m,worldCoord=x=>x;
 let a=0,T=100,px=0,py=0;const SK_SPIN=7.5,SK={spin:0,v:.3,dir:0,popT:T},SKB={yaw:0,pitch:initialPitch,roll:initialRoll};
 const body={z:5,vz:0,trick:null},K={},SK_INPUT={steer:0};
 const skateAirRoutePoint=(x,y)=>[x,y],skateGround=()=>0,skateTransitionAt=()=>null;
 const skateSurface=()=>({h:0,n:skateBoardAxes(0,initialPitch,initialRoll).up});`,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/skate-air.js'),'utf8'),c);vm.runInContext('skateAirBegin()',c);
 return {ev:s=>vm.runInContext(s,c)};
}
test('partial analog air spins settle at arbitrary angles rather than half-turn detents',()=>{
 const angles=[];
 for(const steer of [.18,.34,.55,.8]){
  const {ev}=setup();ev(`for(let i=0;i<40;i++){T+=1/120;skateAirSpinStep(1/120,${steer});skateAirPose(1/120);}for(let i=0;i<150;i++){T+=1/120;skateAirSpinStep(1/120,0);skateAirPose(1/120);}`);
  const spin=ev('SK.spin');angles.push(spin);assert.ok(Math.abs(ev('a')-spin)<1e-8);assert.ok(Math.abs(spin-steer*7.5/3)<.01,'rotation remains proportional to stick depth');
  ev('const before=a;for(let i=0;i<60;i++){T+=1/120;skateAirSpinStep(1/120,0);skateAirPose(1/120);}');assert.ok(Math.abs(ev('a-before'))<1e-6,'no drift toward 0 or 180 after release');
 }
 assert.ok(angles.every((a,i)=>i===0||a>angles[i-1]));assert.ok(angles[1]>.5&&angles[1]<1.2,'a partial spin can remain around 49 degrees');
});
test('board and rider frames spin smoothly through the poles of steep takeoff planes',()=>{
 for(const pitch of [0,.8,Math.PI/2-.001])for(const roll of [0,.7]){
  const {ev}=setup(pitch,roll);ev('let previous=SK.airForward.slice(),maxStep=0,error=0;');
  // Keep the launch-plane blend at zero, isolating several complete rotations
  // on the actual steep frame instead of letting it become flat first.
  ev(`for(let i=0;i<400;i++){skateAirSpinStep(1/120,1);skateAirPose(0);
   const actual=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll),expected=skateTrickAxes(0,initialPitch,initialRoll,0,SK.spin);
   maxStep=Math.max(maxStep,Math.acos(clamp(previous.reduce((s,v,j)=>s+v*SK.airForward[j],0),-1,1)));
   error=Math.max(error,Math.hypot(...actual.axis.map((v,j)=>v-expected.axis[j])),Math.hypot(...actual.up.map((v,j)=>v-expected.up[j])));previous=SK.airForward.slice();}`);
  assert.ok(ev('maxStep')<.065,'no visual half-turn as a vertical frame crosses its pole');assert.ok(ev('error')<1e-7);
 }
});
