'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{loadCity}=require('./helpers/load-city.cjs');
test('a hot pocket travels upward through the flame rather than blinking in place',()=>{
 const {ev}=loadCity();const r=JSON.parse(ev(`JSON.stringify((()=>{const {width:w,height:h}=CITY_FIRE_GRID,f={seed:431,heat:new Float32Array(w*h),next:new Float32Array(w*h),glow:.8};f.heat[12*w+20]=1;stepCityFireField(f,36);let mass=0,x=0,y=0;for(let j=6;j<h;j++)for(let i=0;i<w;i++){const heat=f.heat[j*w+i];mass+=heat;x+=i*heat;y+=j*heat;}return {mass,x:x/mass,y:y/mass,old:f.heat[12*w+20]};})())`));
 assert.ok(r.mass>0&&r.y>13&&r.y<16,JSON.stringify(r));assert.equal(r.old,0);
});
test('heat flow is deterministic across rendering rates and does not consume gameplay randomness',()=>{
 const {ev}=loadCity();const r=JSON.parse(ev(`JSON.stringify((()=>{const before=Math.random;let randomCalls=0;Math.random=()=>{randomCalls++;return .5;};try{const atRate=hz=>{cityFireFields.clear();for(let t=0;t<3.5;t+=1/hz)cityFlameFrame(11,t);return Array.from(cityFlameFrame(11,3.5).heat);};const a=atRate(30),b=atRate(60);const f=cityFlameFrame(11,3.5),same=Array.from(f.heat);cityFlameFrame(11,3.5);return {difference:Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),paused:same.every((v,i)=>v===f.heat[i]),randomCalls,finite:a.every(v=>Number.isFinite(v)&&v>=0&&v<=1.4)};}finally{Math.random=before;}})())`));
 assert.equal(r.difference,0);assert.equal(r.randomCalls,0);assert.ok(r.paused&&r.finite,JSON.stringify(r));
});
