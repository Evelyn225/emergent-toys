'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;setSeason(3);tod=14;env(0);body.z=body.vz=body.crouch=0;clearWanted();});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
}
test('ocean collision follows the season, preserves boat restrictions and rescues a thawed pedestrian',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const b=fleet[0];px=b.x+.6;py=b.y;const point=[px,py];
    const winter=free(...point);setSeason(0);const spring=free(...point);
    setSeason(3);mode='drive';const car=free(...point);mode='walk';
    iceShore=null;setSeason(0);stepWinterOcean();
    return {winter,spring,car,safe:!isWater(px,py)&&free(px,py),stopped:!body.mx&&!body.my};
  });
  assert.deepEqual(r,{winter:true,spring:false,car:false,safe:true,stopped:true});
}));
test('winter stalls render, open the real shop, sell and equip skates, then disappear in spring',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const shops=winterSkateShops(),shop=shops[0];px=shop.x;py=shop.y-.5;a=Math.PI/2;pitch=0;
    render(0);const blocked=!free(shop.x,shop.y),onIce=shops.every(s=>oceanIceAt(s.x,s.y));
    interact();const opened=shopCtx?.title===shop.name&&shopCtx.stock.includes('iceskates');
    money=200;shopBuy('iceskates');closeShop();held=inv.findIndex(it=>it.id==='iceskates');useHeldItem();held=-1;
    const equipped=iceSkatesOn();setSeason(0);const gone=!winterSkateShops().length&&!nearWinterSkateShop();
    return {blocked,onIce,opened,equipped,gone};
  });
  assert.deepEqual(r,{blocked:true,onIce:true,opened:true,equipped:true,gone:true});
}));
test('frozen ocean paints still ice without waves or wakes and restores moving water in spring',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const b=fleet[0];px=b.x+.7;py=b.y;eye=.17;render(0);
    const row=rows-3,d=eye*projY/(row-hor+.5),sample=time=>{T=time;px=b.x+.7-d;py=b.y;floorBaseCell(0,row,0,1,0);return {colour:BG[0],floor:FL[0],ch:CH[0]};};
    const a=sample(1),b2=sample(4);stepWakes();const noWakes=!wakes.length;
    setSeason(0);const spring=sample(6);
    return {still:a.colour===b2.colour,ice:a.floor===1&&a.ch===' ',noWakes,water:spring.floor===3};
  });
  assert.deepEqual(r,{still:true,ice:true,noWakes:true,water:true});
}));
test('the live movement loop glides faster with skates, coasts after release and sweeps solid stalls',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const b=fleet[0],start=[b.x+10,b.y+4];
    const originalRender=render;render=()=>{};
    const run=skates=>{
      [px,py]=start;a=0;body.mx=body.my=body.z=body.vz=0;body.groundMode=null;body.hop=1;
      fx.iceSkating=skates;K.KeyW=K.ShiftLeft=1;
      for(let k=0;k<240;k++)loop(t0+25);
      const distance=px-start[0],before=px;K.KeyW=K.ShiftLeft=0;
      for(let k=0;k<20;k++)loop(t0+25);
      return {distance,coast:px-before};
    };
    inv.push({id:'iceskates'});const walk=run(false),skate=run(true);render=originalRender;
    const shop=winterSkateShops()[0];px=shop.x-1;py=shop.y;body.z=body.vz=0;body.mx=2.8;body.my=0;
    moveOnIce(.5);const collision=px<shop.x-.3&&px>shop.x-.6&&body.mx===0;
    return {walk,skate,collision};
  });
  assert.ok(r.skate.distance>r.walk.distance*2,JSON.stringify(r));
  assert.ok(r.walk.coast>0&&r.skate.coast>r.walk.coast*2,JSON.stringify(r));
  assert.ok(r.collision,JSON.stringify(r));
}));
test('winter saves restore ice position, skates and rentals, and ferries stay docked until spring',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const b=fleet.find(b=>b.deal==='rent');b.hired=true;
    px=b.x+.6;py=b.y;const at=[px,py];inv.push({id:'iceskates'});fx.iceSkating=true;
    saveGame();const data=JSON.parse(localStorage.getItem(SAVE_KEY));
    fx.iceSkating=false;inv.length=0;px=MARINA.x;py=MARINA.y0;b.hired=false;
    loadGame();
    const restored=px===at[0]&&py===at[1]&&iceSkatesOn()&&b.hired;
    const ship=ferryShip(0,0),later=ferryShip(0,500),stationary=ship.stopped&&ship.x===later.x&&ship.y===later.y;
    const stop=FERRY_STOPS[0];[px,py]=stop.land;const cash=money;useFerry();
    const closed=mode==='walk'&&money===cash&&/winter ice/.test(ferryPrompt());
    setSeason(0);const sailing=[0,50,100,200].some(t=>{const s=ferryShip(0,t);return !s.stopped;});
    return {saved:data.iceSkates&&data.inv.some(it=>it.id==='iceskates'),restored,stationary,closed,sailing};
  });
  assert.deepEqual(r,{saved:true,restored:true,stationary:true,closed:true,sailing:true});
}));
test('the worn skates and inventory picture use solid geometry; blade marks fade, stay bounded and thaw away',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const b=fleet[0];px=b.x+10;py=b.y+4;inv.push({id:'iceskates'});fx.iceSkating=true;a=0;pitch=-1.2;
    render(0);
    BG.fill(BG_UNSET);ZB.fill(1e9);
    const oldBox=drawBox;let parts=0;drawBox=(...args)=>{parts++;return oldBox(...args);};
    try{drawWornIceSkates();}finally{drawBox=oldBox;}
    const pixels=BG.reduce((n,c)=>n+(c!==BG_UNSET),0);
    const picture=itemMenuPicture({id:'iceskates'}),art=DENSE.iceskates()[0].join('');
    body.mx=1;body.my=0;
    for(let k=0;k<140;k++){T+=.05;moveOnIce(.05);}
    const marks=iceTracks.length,bounded=marks>10&&marks<=ICE_TRACK_LIMIT;
    const p=iceTracks.at(-1),x=p.x+p.ex*.5,y=p.y+p.ey*.5,visible=iceBladeMark(x,y,.001);
    T+=ICE_TRACK_LIFE+1;trimIceTracks();const faded=!iceTracks.length&&!iceTrackCells.size;
    T+=.1;moveOnIce(.1);setSeason(0);stepWinterOcean();
    return {parts,pixels,picture:!!picture?.src.startsWith('data:image/png'),solid:art.replace(/[ \u0001]/g,'')==='',bounded,visible,faded,thawed:!iceTracks.length&&!iceTrackCells.size};
  });
  assert.ok(r.parts>=16&&r.pixels>10&&r.picture&&r.solid&&r.bounded&&r.visible>.5&&r.faded&&r.thawed,JSON.stringify(r));
}));
test('gliding and braking use quiet blade scrapes, with no walking steps or footsteps while airborne',()=>fixture(async page=>{
  await page.keyboard.press('n');await page.keyboard.press('n');
  const r=await page.evaluate(()=>{
    const b=fleet[0];px=b.x+10;py=b.y+4;inv.push({id:'iceskates'});fx.iceSkating=true;body.mx=1;body.my=0;
    lastPos=null;audioTick(.05);
    const originalBurst=burst,originalStep=sfxStep;let steps=0;const scrapes=[];
    burst=(at,len,filters,gain,pan)=>{if(len===.22)scrapes.push({gain,pan});};sfxStep=()=>steps++;
    try{
      T+=.2;px+=.05;audioTick(.05);
      K.KeyC=1;T+=.2;px+=.05;audioTick(.05);K.KeyC=0;
      body.z=1;for(let k=0;k<4;k++){T+=.2;px+=.05;audioTick(.05);}
    }finally{burst=originalBurst;sfxStep=originalStep;}
    return {steps,scrapes};
  });
  assert.equal(r.steps,0);assert.equal(r.scrapes.length,2);
  assert.ok(r.scrapes[1].gain>r.scrapes[0].gain&&r.scrapes.every(s=>s.gain<.05),JSON.stringify(r));
}));
