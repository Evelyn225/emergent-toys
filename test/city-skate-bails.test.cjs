'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('bails carry rider and board momentum, bounce the board, and allow quick recovery without teleporting',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(`
 let px=0,py=0,a=0,T=100;const body={z:0,vz:0},K={},SK_INPUT={push:false};
 const SK={v:.6,dir:0,bail:1.2},SKB={v:[.6,.1,0]};
 const skateGround=()=>0,skateAir=()=>false,worldCoord=x=>x,rel=x=>x;
 function move(x,y){px+=x;py+=y;}function skateBoardSync(){}
 `,ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/skate-bails.js'),'utf8'),ctx);
 const ev=s=>vm.runInContext(s,ctx);
 ev('skateBailStart();const original=SK.bailData.board.slice();let minZ=Infinity;for(let i=0;i<24;i++){T+=1/60;stepSkateBail(1/60);minZ=Math.min(minZ,SK.bailData.board[2]);}');
 assert.ok(ev('SK.bailData.board[0]>original[0]+.1'));
 assert.ok(ev('px>0&&py>0'));
 assert.ok(ev('minZ>=.008'));
 assert.ok(ev('SK.bailData.spin<5'));
 ev('const before=px;K.KeyW=1;T+=1/60;stepSkateBail(1/60);');
 assert.equal(ev('SK.bail'),0);assert.equal(ev('SK.bailAt'),null);
 assert.ok(ev('px>=before'), 'getting up keeps the tumble endpoint');
});
