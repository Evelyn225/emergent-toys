'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(start){
 const c=vm.createContext({start});vm.runInContext(`
 let T=0,pops=0;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),SK={v:1,steer:0,manual:null},SKB={pitch:0,roll:0},K={},actx=null;
 const skateAir=()=>false,skateCanLipPop=()=>false,skatePop=()=>{pops++;},skateBalanceStick=()=>SK_INPUT.mouse;
 `,c);
 for(const file of ['skate-air.js','skate-gestures.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../city',file),'utf8'),c);
 vm.runInContext('skateMouseBegin();skateMouseMove(0,start);skateManualStep(1/120);',c);
 return s=>vm.runInContext(s,c);
}
test('a range of gentle mouse pulls starts balanced, tolerates jitter and holds without moving the mouse',()=>{
 for(const start of [12,21,30,-12,-21,-30]){
  const ev=setup(start);assert.equal(ev('!!SK.manual'),true);
  ev(`for(let i=0;i<360;i++){T+=1/120;if(i%30===0)skateMouseMove(0,(i/30%2?1:-1)*2);skatePollInput(1/120);skateManualStep(1/120);}`);
  assert.equal(ev('!!SK.manual'),true,`gentle ${start}px pull stays usable`);assert.ok(Math.abs(ev('SK.manual.bal'))<.25);assert.equal(ev('pops'),0);
 }
});
test('human-paced fore/aft mouse corrections recover a tilted manual without triggering a flip',()=>{
 for(const start of [21,-21]){
  const ev=setup(start);ev('SK.manual.bal=.6;SK.manual.balV=.2;');
  ev(`for(let i=0;i<480&&SK.manual;i++){T+=1/120;
   if(i%15===0){const m=SK.manual,target=clamp((m.nose?-.35:.35)-m.bal*.32-m.balV*.32,m.nose?-.8:.12,m.nose?-.12:.8);skateMouseMove(0,clamp((target-m.mouseDepth)*180,-8,8));}
   skatePollInput(1/120);skateManualStep(1/120);}`);
  assert.equal(ev('!!SK.manual'),true);assert.ok(Math.abs(ev('SK.manual.bal'))<.3,'recover with corrections every 125 ms');assert.equal(ev('pops'),0);
 }
});
