'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {skateSim}=require('./helpers/skate-sim.cjs');
const ctx=vm.createContext({});
vm.runInContext('const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));',ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/skate-air.js'),'utf8'),ctx);
const axes=vm.runInContext('skateBoardAxes',ctx),quality=vm.runInContext('skateLandingQuality',ctx);
const rad=d=>d*Math.PI/180;

test('touchdown orientation grid classifies clean, sloppy and bail against the surface',()=>{
 for(const pitch of [0,15,35,60,90])for(const roll of [0,15,35,60,180])for(const yaw of [0,15,25,45,90,180]){
  const orientation=axes(rad(yaw),rad(pitch),rad(roll));
  const tilt=Math.acos(Math.cos(rad(pitch))*Math.cos(rad(roll)))*180/Math.PI;
  const line=Math.min(yaw,180-yaw);
  const expected=tilt<=25&&line<=20?'clean':tilt<=40&&line<=32?'sloppy':'bail';
  assert.equal(quality({...orientation,normal:[0,0,1],velocity:[1,0,0]}),expected,`${pitch}/${roll}/${yaw}`);
 }
});

test('catch timing and unreleased grabs affect touchdown; steep normals are valid',()=>{
 const flat={...axes(0,0,0),normal:[0,0,1],velocity:[1,0,0]};
 assert.equal(quality({...flat,catchLead:.1}),'clean');
 assert.equal(quality({...flat,catchLead:.07}),'sloppy');
 assert.equal(quality({...flat,catchLead:.02}),'bail');
 assert.equal(quality({...flat,grab:true}),'bail');
 const bank=axes(0,rad(70),0);
 assert.equal(quality({...bank,normal:bank.up,velocity:bank.axis}),'clean');
});

test('manual across more than six metres links two pops into the same combo',()=>{
 const t=skateSim([
  {frames:10,keys:{Space:1}},{frames:50},
  {frames:100,sticks:{right:[0,.4475]}},
  {frames:10,keys:{Space:1}},{frames:60}
 ],{speed:.6});
 const manual=t.filter(p=>p.manual);
 assert.ok(manual.length>90);
 assert.ok(manual.at(-1).x-manual[0].x>.6);
 assert.deepEqual(t.at(-1).comboNames,['OLLIE','MANUAL','OLLIE']);
 assert.equal(t.at(-1).bail,0);
});

test('grabs must be released before landing; releasing earns points',()=>{
 const jump=[{frames:10,keys:{Space:1}},{frames:15}];
 const held=skateSim([...jump,{frames:40,buttons:{grabR:true}}],{speed:.6});
 assert.ok(held.some(p=>p.bail>0));
 const released=skateSim([...jump,{frames:12,buttons:{grabR:true}},{frames:40}],{speed:.6});
 assert.equal(released.at(-1).bail,0);
 assert.match(released.at(-1).comboNames[0],/INDY/);
 assert.ok(released.at(-1).combo>100);
});

test('nose manuals balance, and a powerslide just after landing extends a combo',()=>{
 const nose=skateSim([{frames:90,sticks:{right:[0,-.4475]}}],{speed:.6});
 assert.ok(nose.at(-1).manual);assert.equal(nose.at(-1).bail,0);
 const probe=skateSim([{frames:10,keys:{Space:1}},{frames:80}],{speed:.6});
 const landed=probe.findIndex((p,i)=>i>10&&p.z===0&&probe[i-1].z>0);
 const revert=skateSim([{frames:10,keys:{Space:1}},{frames:landed-10},{keys:{KeyS:1,KeyD:1}}],{speed:.6});
 assert.deepEqual(revert.at(-1).comboNames,['OLLIE','REVERT']);
});

test('excess tail pressure scrapes and slows; excess nose pressure bails',()=>{
 const tail=skateSim([{frames:240,sticks:{right:[0,.58]}}],{speed:.6});
 const nose=skateSim([{frames:240,sticks:{right:[0,-.58]}}],{speed:.6});
 assert.ok(tail.every(p=>p.bail<=0));assert.ok(tail.at(-1).speed<.3);
 assert.ok(nose.some(p=>p.bail>0));
});


test('shuvits and completed flips retain the takeoff bank plane',()=>{
 const frame=vm.runInContext('skateTrickAxes',ctx);
 for(const pitch of [0,.4,1])for(const roll of [-1,.7])for(const turn of [0,Math.PI,Math.PI*2]){
  const up=axes(.3,pitch,roll).up;
  for(const flip of [0,Math.PI*2]){
   const next=frame(.3,pitch,roll,flip,turn);
   assert.ok(Math.hypot(...up.map((v,i)=>v-next.up[i]))<1e-9);
   assert.ok(Math.abs(next.axis.reduce((s,v,i)=>s+v*next.up[i],0))<1e-9);
  }
 }
});
