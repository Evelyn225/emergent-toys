'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{loadCity}=require('./helpers/load-city.cjs');
test('a player-owned car keeps its blast countdown; spraying buys time and extinguishing leaves real damage',()=>{
 const {ev}=loadCity();
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  const d=doors[0],c=addCar({kind:'car',body:GRAY,x:d.x,y:d.y,hx:1,hy:0,owned:true});
  const f=createCarIncident(c);stepCarFires(BURN_T-.1);const before=c.fireT;
  coolFireNode(f,f.nodes[0],.5);stepCarFires(.2);const pausedByWater=c.fireT===before;
  for(const n of f.nodes)coolFireNode(f,n,10);stepCarFires(10);
  const extinguished=f.out&&!burning(c)&&!c.wrecked&&c.dmg===DMG_BAD;
  const other=addCar({kind:'car',body:BLUE,x:d.x+1,y:d.y,hx:1,hy:0,owned:true});createCarIncident(other);stepCarFires(BURN_T+.1);
  return {volatile:f.volatile,pausedByWater,extinguished,unattendedExplodes:other.wrecked};
 })())`));assert.ok(result.volatile&&result.pausedByWater&&result.extinguished&&result.unattendedExplodes,JSON.stringify(result));
});
