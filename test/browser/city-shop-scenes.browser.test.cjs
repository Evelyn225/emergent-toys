'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('restaurants, cafés, bars, markets, laundromats, barbers, banks and gyms show their own rooms through the window, in colour, in every facade family',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],used={},tried={};
   // count each scene's use while a view renders
   for(const k of Object.keys(SHOP_SCENES)){const st=SHOP_SCENES[k];SHOP_SCENES[k]=new Proxy(st,{get(o,prop){if(prop==='back')used[k]=(used[k]||0)+1;return o[prop];}});}
   // stand on the pavement in front of each kind of shop, at an hour it's open, and look at it
   const looks=[['SUSHI',14],['RAMEN',14],['PIZZA',14],['DINER',14],['CAFE',10],['BAR',21],['LAUNDRY',14],['BARBER',11],['BANK',11],['GYM',14],['GROCERY',14]];
   let chars=0,cells=0;
   for(const [w,td] of looks){tod=td;env(0);let n=0;
    for(let k=0;k<N*N&&n<3;k++){const sh=SHOP[k];if(!sh||sh.word!==w||!openAt(sh,tod))continue;const x=k%N,y=(k/N)|0;
     for(const [dx2,dy2] of [[0,1],[0,-1],[1,0],[-1,0]]){const kk=idx(x+dx2,y+dy2);if(!ROAD[kk]||SHOP[kk])continue;
      n++;tried[w]=(tried[w]||0)+1;px=x+.5+dx2*1.15;py=y+.5+dy2*1.15;a=Math.atan2(-dy2,-dx2);pitch=.08;render(0);
      for(let rr=(rows>>1)-4;rr<(rows>>1)+10;rr++)for(let c=(cols>>1)-15;c<(cols>>1)+15;c++){cells++;const ch=CH[rr*cols+c];if(ch!==' '&&ch!==''&&!/[A-Z0-9#]/.test(ch))chars++;}
      k+=40;break;}}}
   const scenes={SUSHI:'sushi',RAMEN:'noodle',PIZZA:'pizza',DINER:'diner',CAFE:'cafe',BAR:'bar',LAUNDRY:'laundry',BARBER:'barber',BANK:'bank',GYM:'gym',GROCERY:'market'};
   const missing=Object.entries(scenes).filter(([w,s])=>tried[w]&&!used[s]).map(([w])=>w);
   if(missing.length)bad.push(['windows without their room',missing,JSON.stringify(tried),JSON.stringify(used)]);
   if(Object.keys(tried).length<8)bad.push(['too few shop kinds found open',tried]);
   if(chars/cells>.02)bad.push(['characters in the windows',chars,cells]);
   // a shop of goods keeps its display (a bookshop is still a bookshop)
   if(shopSceneFor({word:'BOOKS'})||shopSceneFor({word:'RECORDS'}))bad.push(['goods shops given a room']);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
