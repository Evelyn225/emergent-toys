'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
async function fixture(run){const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;T=100;sleep=null;third=false;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=false;
  px=SKATEPARK.bx*8+5.5;py=SKATEPARK.by*8+3.8;a=0;body.z=body.vz=0;
  window.testPad={index:0,id:'Standard test controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))};window.padPolls=0;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{padPolls++;return testPad?[testPad]:[];}});
  let clock=performance.now();window.padFrame=(count=1)=>{for(let i=0;i<count;i++){clock+=1000/60;loop(clock);}};
  window.padButton=(index,down)=>{testPad.buttons[index].value=down?1:0;padFrame();};
  window.padTap=index=>{padButton(index,true);padButton(index,false);};padFrame();
 });await run(page);assert.deepEqual(errors,[]);}finally{await browser.close();}}

test('Y actions omit dedicated controller bindings and retain a working drop action',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  clearInventory();carryItem({id:'water',uses:3});held=0;padFrame();padTap(3);
  const root=CONTROLLER.sheet,labels=[...root.querySelectorAll('[data-actions] button')].map(b=>b.textContent);
  const duplicate=labels.filter(s=>/^(Jump|Ollie|Air out|Crouch|Sit|Stand|Use|Drink|Inventory|Map|Camera)$/.test(s));
  const drop=[...root.querySelectorAll('button')].find(b=>b.textContent==='Drop item');
  if(!drop)return{duplicate,missingDrop:true};
  controllerFocus(root,controllerControls(root).indexOf(drop));const before=dropped.length;padTap(0);
  return {duplicate,dropped:dropped.length===before+1,empty:inv.length===0,resumed:!paused};
 });assert.deepEqual(r,{duplicate:[],dropped:true,empty:true,resumed:true});
}));

test('controller typing has staggered QWERTY rows, numbers and punctuation; real buttons type, shift, erase and finish',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  padTap(8);padTap(3);padFrame();const kb=CONTROLLER.keyboard,grid=kb.querySelector('[data-keys]');
  const rows=new Map();for(const b of grid.querySelectorAll('[data-char]')){const y=b.getBoundingClientRect().top;if(!rows.has(y))rows.set(y,[]);rows.get(y).push(b.dataset.char);}
  const layout=[...rows.values()].map(r=>r.join(''));
  const q=grid.querySelector('[data-char="q"]').getBoundingClientRect(),a=grid.querySelector('[data-char="a"]').getBoundingClientRect(),z=grid.querySelector('[data-char="z"]').getBoundingClientRect();
  padTap(0);padTap(15);padTap(0);padTap(2);padTap(3);padTap(15);padTap(0);
  const text=BIGMAP.query,space=grid.querySelector('[data-char=" "]').textContent;
  const done=[...grid.querySelectorAll('button')].find(b=>b.textContent==='Done');controllerFocus(kb,controllerControls(kb).indexOf(done));padTap(0);
  return{layout,stagger:q.x<a.x&&a.x<z.x,text,space,closed:kb.style.display==='none'&&bigMapOpen()};
 });assert.deepEqual(r.layout,['1234567890','qwertyuiop','asdfghjkl','zxcvbnm'," -_.,!?@'"]);assert.ok(r.stagger);assert.equal(r.text,'qE');assert.equal(r.space,'space');assert.ok(r.closed);
}));

test('L3 steps off a moving board once, releases skate state and does not become sprint or an aerial grab',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  fx.skating=true;SK.lastT=T;SK.v=.4;SK.dir=a;padFrame();const bad=[];
  if(!/L3 step off/.test(CONTROLLER.hint||document.getElementById('controller-hint')?.textContent||''))bad.push('missing dismount tip');
  padButton(10,true);padFrame(5);if(fx.skating||skatingNow()||heldItem()?.id!=='skateboard')bad.push('did not step off holding board');
  if(K.ShiftLeft||CONTROLLER.sprint)bad.push('dismount leaked sprint');padButton(10,false);padFrame();
  padButton(7,true);padButton(7,false);padFrame();if(!fx.skating)bad.push('cannot remount with RT');
  jump();padFrame();if(!skateAir())bad.push('fixture did not jump');padTap(10);if(!fx.skating)bad.push('airborne click dismounted');
  return bad;
 });assert.deepEqual(r,[]);
}));
