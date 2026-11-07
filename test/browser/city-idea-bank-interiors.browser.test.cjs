'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
// how many screen cells a prop paints from where the player stands
const painted=`(o)=>{render(0);const A=BG.slice(),draw=o.draw;o.draw=()=>{};let n=0;try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==A[i])n++;}finally{o.draw=draw;}return n;}`;
test('IDEA: warehouse racking stands clear of the back wall and shows, department signs hang, and the shop counter is still reachable',()=>fixture(async p=>{
 const r=await p.evaluate(src=>{const paint=eval(src);enterRoom('idea',{word:'IDEA',ret:[100,100,0]},[9,12.4,-Math.PI/2]);
  const racks=room.props.filter(o=>o.ideaRacking),signs=room.props.filter(o=>o.ideaSign);px=9;py=12.4;a=-Math.PI/2;pitch=0;
  return{racks:racks.map(o=>({inWall:o.box.y0!==undefined?o.box.y0<1:o.y-.45<1,px:paint(o)})),signs:signs.map(o=>o.ideaSign),route:roomPath(9,12.4,9,3.6).length>0,free:free(9,12.4)};},painted);
 assert.equal(r.racks.length,2);assert.ok(r.racks.every(q=>!q.inWall&&q.px>200),JSON.stringify(r.racks));
 assert.deepEqual(r.signs.sort(),['BEDROOMS','KIDS','LIVING ROOMS','MARKET HALL']);assert.ok(r.route&&r.free);
}));
test('bank: the queue rope reads in red between brass posts, the rates board and cash machine land on the left and front walls, and tellers and vault stay reachable',()=>fixture(async p=>{
 const r=await p.evaluate(src=>{const paint=eval(src);enterRoom('bank',{word:'BANK',ret:[100,100,0]},[7,7.4,-Math.PI/2]);
  const rope=room.props.find(o=>o.bankRope);px=7;py=7.4;a=-Math.PI/2;pitch=0;const ropePx=paint(rope);
  const W=room.def.wall,cell=(u,z,mx,my)=>{CH[0]=' ';BG[0]=0;W(0,u,.001,z,.01,mx,my,8);return BG[0];};
  const board=cell(-4,2,0,4),plain=cell(-1.5,2,0,1),atm=cell(-3.6,1.6,3,8),front=cell(-10,1.6,10,8);
  return{ropePx,board:board===C(GREEN,1.6+.8),boardDiffers:board!==plain,atm:atm!==front,routes:[[7,7.4,7,3.2],[7,7.4,12.3,4.5]].every(q=>roomPath(...q).length>0)};},painted);
 assert.ok(r.ropePx>40,JSON.stringify(r));assert.ok(r.boardDiffers&&r.atm&&r.routes,JSON.stringify(r));
}));
