'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity(),j=s=>JSON.parse(ev(`JSON.stringify(${s})`));
test('world sound fades to silence, loses treble and retains propagation delay and direction',()=>{
 const samples=[0,10,30,80,150,180,250].map(d=>j(`soundDistanceProfile(${d},0,0,Math.PI/2)`));
 for(let n=1;n<samples.length;n++){assert.ok(samples[n].gain<=samples[n-1].gain);assert.ok(samples[n].cutoff<=samples[n-1].cutoff);assert.ok(samples[n].delay>samples[n-1].delay);}
 assert.equal(samples[0].gain,1);assert.equal(samples.at(-1).gain,0);assert.equal(samples[5].gain,0);assert.ok(samples[3].gain<.04);assert.ok(samples[3].cutoff<1200);
 const left=j('soundDistanceProfile(0,-10,0,0)'),right=j('soundDistanceProfile(0,10,0,0)'),inside=j('soundDistanceProfile(0,10,0,0,180,14,true)');
 assert.ok(left.pan<0&&right.pan>0);assert.ok(inside.gain<right.gain*.2);assert.ok(inside.cutoff<=900);assert.ok(Math.abs(right.delay-10/34)<1e-9);
});
test('islands use the botanical garden nature bed without city sounds by day, night or city fireworks',()=>{
 const base="{mode:'walk',room:null,day:1,night:0,rain:0,fog:0,tod:13,roofH:0,district:'midtown',barCrowd:0,seaDist:3,onBridge:false,elNear:0,speed:0}";
 for(const day of [0,.5,1]) {
  const nature=j(`audioMix({...${base},wilderness:true,day:${day},night:${1-day},fireworks:true,fairNear:1})`);
  const garden=j(`audioMix({...${base},gardens:true,day:${day}})`);
  for(const layer of ['city','night','crowd','pachinko','arcade'])assert.equal(nature[layer],0);
  assert.equal(nature.birds,garden.birds);assert.ok(nature.waves>0);assert.ok(nature.wind>0);
 }
 for(const kind of ['islandshelter','islandhome']) {const mix=j(`audioMix({...${base},mode:'room',room:{kind:'${kind}'}})`);assert.equal(mix.city,0);assert.ok(mix.birds>0&&mix.waves>0);}
});
test('island interiors and nested hotel rooms listen from their outdoor doorway, not local furniture coordinates',()=>{
 assert.deepEqual(j("audioWorldPosition('room',{ret:[626,195,1.2]},12,18)"),[626,195]);
 assert.deepEqual(j("audioWorldPosition('room',{lobby:{ret:[53,64.2,-1.5]}},6,4)"),[53,64.2]);
 assert.deepEqual(j("audioWorldPosition('walk',null,626,195)"),[626,195]);
 assert.deepEqual(j("audioWorldPosition('room',{},12,18)"),[12,18]);
});
test('laundromats have their washers running; nowhere else does',()=>{
 const base="{mode:'room',day:1,night:0,rain:0,fog:0,tod:3,roofH:0,district:'midtown',barCrowd:0,seaDist:9,onBridge:false,elNear:0,speed:0}";
 assert.ok(j(`audioMix({...${base},room:{kind:'laundry'}})`).washers>.5);
 for(const kind of ['store','bar','home'])assert.equal(j(`audioMix({...${base},room:{kind:'${kind}'}})`).washers,0);
 assert.equal(j(`audioMix({...${base},mode:'walk',room:null})`).washers,0);
});
test('stations reached by train, train cars and the lighthouse lamp room also listen from outdoors',()=>{
 ev("stations.push({x:40.5,y:72.25})");const st=j('stations.length-1');
 for(const kind of ['station','train'])assert.deepEqual(j(`audioWorldPosition('room',{kind:'${kind}',st:${st}},23,5)`),[40.5,72.25]);
 assert.deepEqual(j("audioWorldPosition('room',{kind:'lamproom',below:{ret:[300,410,0]}},1.6,4.4)"),[300,410]);
});
