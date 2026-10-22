'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();

test('ferry local coordinates follow translation and rotation without drifting',()=>{
 const result=ev(`(()=>{let error=0;for(let n=0;n<100;n++){const yaw=n*.37,ship={x:200+n,y:350-n,c:Math.cos(yaw),s:Math.sin(yaw)};const u=Math.sin(n)*2,v=Math.cos(n)*.5;const [x,y]=ferryPoint(ship,u,v),[a,b]=ferryLocal(ship,x,y);error=Math.max(error,Math.abs(a-u),Math.abs(b-v));}return error;})()`);
 assert.ok(result<1e-12,result);
});

test('ferry has reachable lounge aisles, window seats, café and open deck',()=>{
 const result=ev(`(()=>{
  const step=.025,start=[-1.15,-.5],queue=[start],seen=new Set(),key=(x,y)=>Math.round(x/step)+':'+Math.round(y/step);
  seen.add(key(...start));
  for(let i=0;i<queue.length;i++){const [u,v]=queue[i];for(const [du,dv]of [[step,0],[-step,0],[0,step],[0,-step]]){const x=u+du,y=v+dv,k=key(x,y);if(seen.has(k)||!ferryWalkClear(x,y))continue;seen.add(k);queue.push([x,y]);}}
  const reachable=(u,v)=>queue.some(p=>Math.hypot(p[0]-u,p[1]-v)<.06);
  return {cells:queue.length,door:reachable(-.98,0),cafe:reachable(.65,-.2),bow:reachable(1.4,-.52),deck:reachable(-2,0),seats:FERRY_SEATS.every(s=>reachable(s.u,Math.sign(s.v)*.22)),blocked:FERRY_SOLIDS.every(s=>!ferryWalkClear(s.u,s.v)),rail:!ferryWalkClear(0,.6)&&!ferryWalkClear(2.24,0)};
 })()`);
 assert.ok(result.cells>2000,JSON.stringify(result));
 for(const key of ['door','cafe','bow','deck','seats','blocked','rail'])assert.equal(result[key],true,key+': '+JSON.stringify(result));
});
