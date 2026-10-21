'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run) {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=body.crouch=0;body.seat=null;T=24;tod=12;env(0);});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

test('corner shops label every street frontage without labeling upper setbacks or apartment side walls',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const errors=[],families={},directions=new Set();let sides=0;
    for(const [family,buildings] of [['architecture',ARCH_BUILDINGS],['merchant',MERCHANT_BUILDINGS]]) {
      families[family]=0;
      for(const b of buildings)for(const f of b.faces) {
        if(f.low&&architectureSignedFace(f,b.sh))errors.push('upper setback');
        if(!f.front&&b.sh.kind===SHOP_APTS&&architectureSignedFace(f,b.sh))errors.push('apartment side');
        if(b.sh.kind===SHOP_APTS||f.low||f.front)continue;
        const road=Array.from({length:f.end-f.start},(_,k)=>{
          const along=f.start+k+.5;
          return ROAD[idx(Math.floor((f.side?along:f.line)+f.nx*.1),Math.floor((f.side?f.line:along)+f.ny*.1))];
        }).some(Boolean);
        if(road) {
          sides++;families[family]++;directions.add(f.dir);
          if(!architectureSignedFace(f,b.sh))errors.push([family,b.sh.word,f.dir]);
        }
      }
    }
    return {errors,sides,families,directions:[...directions]};
  });
  assert.deepEqual(result.errors,[]);assert.ok(result.sides>1000,JSON.stringify(result));
  assert.ok(Object.values(result.families).every(n=>n>100));assert.ok(result.directions.length>=3);
}));

test('formerly blank street sides actually draw visible lettering in each facade family',()=>fixture(async page=>{
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:720});
    const result=await page.evaluate(()=>{
      const results=[];
      for(const family of ['midtown','downtown','brownstones','residential','chinatown','shotengai']) {
        const buildings=['chinatown','shotengai'].includes(family)?MERCHANT_BUILDINGS:ARCH_BUILDINGS;
        const b=buildings.find(b=>(family==='residential'?!!b.profile:b.region===family)&&b.sh.kind!==SHOP_APTS&&b.sh.kind!==SHOP_SHUT&&
          b.faces.some(f=>!f.front&&!f.low&&f.street&&f.end-f.start>=2));
        const f=b.faces.find(f=>!f.front&&!f.low&&f.street&&f.end-f.start>=2),mid=(f.start+f.end)/2;
        for(const distance of [.8,1.2,1.8]) {
          px=(f.side?mid:f.line)+f.nx*distance;py=(f.side?f.line:mid)+f.ny*distance;a=Math.atan2(-f.ny,-f.nx);pitch=.08;
          for(const hour of [12,23]) {
            tod=hour;env(0);const cells=[],original=wallText;
            wallText=(i,u,us,z,d,text,...args)=>{
              const drawn=original(i,u,us,z,d,text,...args);
              if(drawn&&text===b.sh.word&&Math.abs(d-distance)<.001&&CH[i]!==' ')cells.push({i,ch:CH[i],d});
              return drawn;
            };
            try {render(0);}finally{wallText=original;}
            const visible=cells.filter(p=>CH[p.i]===p.ch&&Math.abs(ZB[p.i]-p.d)<.001).length;
            const occluded=cells.filter(p=>ZB[p.i]<p.d-.001).length;
            results.push({family,hour,distance,word:b.sh.word,visible,occluded,painted:cells.length});
          }
        }
      }
      return results;
    });
    // At the opposite kerb the camera can stand behind a lamp or canopy support.
    // Lettering must still be painted, with any lost cells owned by a nearer solid.
    assert.equal(result.length,36);
    assert.ok(result.every(r=>r.painted>=3&&r.visible+r.occluded>=3&&(r.distance===1.8||r.visible>=3)),JSON.stringify({width,result}));
  }
}));

test('merchant signboards remain readable above their awnings from pavement height and oblique views',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const results=[];
    for(const region of ['chinatown','shotengai']) {
      const b=MERCHANT_BUILDINGS.find(b=>b.region===region&&b.sh.kind!==SHOP_APTS&&b.sh.kind!==SHOP_SHUT);
      const f=b.faces.find(f=>f.front),board=PAVILION_SOLIDS.find(o=>o.b===b&&o.kind==='shopboard'),mid=(f.start+f.end)/2;
      for(const distance of [.75,1.2,2.2])for(const angle of [-.18,0,.18]) {
        px=(f.side?mid:f.line)+f.nx*distance;py=(f.side?f.line:mid)+f.ny*distance;
        a=Math.atan2(-f.ny,-f.nx)+angle;pitch=.09;tod=12;env(0);
        const cells=[],original=pavilionDetailShade;
        pavilionDetailShade=(o,i,t,L)=>{
          const drawn=original(o,i,t,L);
          if(o===board&&(HIT.face===3||HIT.face===4)&&CH[i]!==' ')cells.push({i,ch:CH[i],t});
          return drawn;
        };
        try{render(0);}finally{pavilionDetailShade=original;}
        results.push({region,distance,angle,visible:cells.filter(p=>CH[p.i]===p.ch&&Math.abs(ZB[p.i]-p.t)<.001).length});
      }
    }
    return results;
  });
  assert.equal(result.length,18);assert.ok(result.every(r=>r.visible>=3),JSON.stringify(result));
}));

test('sub-cell wall lettering keeps exactly one readable row through screen-row phases',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    render(0);const out=[];WH.dn=2;WH.sl=0;WH.wc=10;
    for(let phase=0;phase<1;phase+=.025) {
      const d=2,z0=.38,bandH=.02,zc=z0+phase*d/projY,c=cols>>1;let count=0;
      for(let r=0;r<rows;r++) {
        const i=r*cols+c;CH[i]=' ';
        wallText(i,10,.1,zc+(30-r)*d/projY,d,'SHOP',10.05,z0,.1,bandH,15);
        if(CH[i]==='H')count++;
      }
      out.push(count);
    }
    return out;
  });
  assert.ok(result.every(n=>n===1),JSON.stringify(result));
}));
