'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('bathroom headers continue the native partition finish on both faces and remain closed above the opening',async()=>{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const result=await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;env(0);mode='room';const bad=[];let checked=0;
   for(const kind of Object.keys(ROOM_DEFS).filter(k=>ROOM_DEFS[k].wc)){
    room=makeRoom(kind);const h=room.def.height||3;
    for(const prop of room.props.filter(p=>p.bathroomOpening)){
     const q=prop.bathroomOpening,shapes=[],draw=drawBox;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{prop.draw(prop.x,prop.y);}finally{drawBox=draw;}
     const top=shapes.find(p=>p.box.z0===2.26&&p.box.z1===h);if(!top){bad.push([kind,'open header']);continue;}if(h<2.4)continue;
     const c=q.vertical?0:1,s=q.vertical?1:0;
     for(const sign of [-1,1])for(const distance of [1.2,4])for(const z of [2.35,h-.08]){
      px=prop.x-s*sign*(distance+.5);py=prop.y+c*sign*(distance+.5);
      const t=top.ray(px,py,z,s*sign,-c*sign,0,top.box);if(t<0){bad.push([kind,'missing solid face']);continue;}
      BG[0]=NONE;top.shade(0,t,(1-t/vis)*15*amb);const actual=[BG[0],CH[0],COL[0]];
      const along=q.vertical?prop.y:prop.x,u=sign*along,mx=q.vertical?q.cross:q.start-1,my=q.vertical?q.start-1:q.cross;
      BG[0]=NONE;roomWall(0,u,0,z,h,t,q.vertical?0:1,mx,my,1-t/vis,along);const expected=[BG[0],CH[0],COL[0]];checked++;
      if(actual.some((v,i)=>v!==expected[i]))bad.push([kind,q.vertical?'vertical':'horizontal',sign,z,actual,expected]);
     }
    }
   }return{checked,bad};
  });assert.ok(result.checked>100);assert.deepEqual(result.bad,[]);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
