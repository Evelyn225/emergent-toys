'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/controller-core.js'),'utf8'),ctx);
const stick=vm.runInContext('controllerStick',ctx),ease=vm.runInContext('controllerEase',ctx),button=vm.runInContext('controllerButton',ctx);
test('controller curve rejects drift, preserves diagonals and reaches full travel',()=>{
 assert.deepEqual(Array.from(stick(.1,.1)),[0,0]);assert.deepEqual(Array.from(stick(NaN,.7)),[0,0]);
 const v=stick(.3,.4);assert.ok(Math.abs(v[1]/v[0]-4/3)<1e-10);
 assert.ok(v[0]<(.3/Math.hypot(.3,.4))*(.5-.15)/.85,'soft centre');
 assert.ok(Math.abs(Math.hypot(...stick(.95,0))-1)<1e-10);
 assert.ok(Math.hypot(...stick(2,2))<=1.0000001);
});
test('steering attack is frame-rate independent; release and reversal are quicker',()=>{
 const run=(hz,target=1,start=0)=>{let v=start;for(let i=0;i<hz/5;i++)v=ease(v,target,1/hz);return v;};
 assert.ok(Math.abs(run(30)-run(120))<1e-10);
 assert.ok(ease(0,1,1/60)>0&&ease(0,1,1/60)<.3);
 assert.ok(1-ease(1,0,1/60)>ease(0,1,1/60));
 assert.ok(ease(1,-1,1/60)<ease(1,0,1/60));
});
test('triggers retain analog depth and malformed readings cannot latch a control',()=>{
 assert.equal(button({buttons:[{value:.37}]},0),.37);assert.equal(button({buttons:[{pressed:true}]},0),1);
 assert.equal(button({buttons:[{value:NaN}]},0),0);assert.equal(button(null,7),0);
 assert.equal(button({buttons:[{value:3}]},0),1);
});

test('optional contact vibration scales with impact, stops cleanly and tolerates unsupported devices',async()=>{
 const calls=[];ctx.rumblePad={vibrationActuator:{playEffect:(kind,values)=>{calls.push({kind,...values});return Promise.resolve();},reset:()=>{calls.push({reset:true});return Promise.resolve();}}};
 vm.runInContext('CONTROLLER.active=true;CONTROLLER.pad=rumblePad;',ctx);
 const rumble=vm.runInContext('controllerRumble',ctx),stop=vm.runInContext('controllerStopRumble',ctx);
 await rumble('pop');await rumble('land',2);await rumble('land',8);await rumble('bail',1);
 assert.ok(calls[2].strongMagnitude>calls[1].strongMagnitude);
 assert.ok(calls[3].strongMagnitude>calls[0].strongMagnitude);
 assert.ok(calls.every(v=>v.duration<=150&&v.strongMagnitude<=1));
 stop();assert.equal(calls.at(-1).reset,true);
 vm.runInContext('var settings={controllerVibration:false};',ctx);const before=calls.length;await rumble('pop');assert.equal(calls.length,before);
 vm.runInContext('settings.controllerVibration=true;CONTROLLER.pad={};',ctx);await rumble('pop');
 ctx.rumblePad={vibrationActuator:{playEffect:()=>Promise.reject(new Error('unsupported'))}};vm.runInContext('CONTROLLER.pad=rumblePad;',ctx);await rumble('land',4);
});
