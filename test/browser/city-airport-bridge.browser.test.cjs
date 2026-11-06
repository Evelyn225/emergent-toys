'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=null;body.z=body.vz=body.crouch=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('airport access has joined raised bridge decks, navigable water underneath and matching walking/driving heights',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof airportBridgeLayout!=='function')return {bad:['flat airport causeway']};
  const bad=[],S=AIRPORT_BRIDGE,C=CAUSEWAY,layout=airportBridgeLayout();px=AIRPORT.x1-4;py=C.y0;dx=1;dy=0;tf=1000;vis=200;
  const parts=[],old=drawBox;try{drawBox=(b,shade,ray=rayBox)=>parts.push({box:{...b,x:b.x+px,y:b.y+py},shade,ray});drawAirportBridge();}finally{drawBox=old;}
  const decks=parts.filter(p=>p.box.airportBridgeDeck);if(decks.length!==5)bad.push(['missing bridge spans',decks.length]);
  for(const b of layout.sections){const p=decks.find(p=>p.box.airportBridgeDeck===b.id);if(!p)continue;
   for(const q of [.001,.5,.999]){const x=b.x+(b.axis==='x'?(2*q-1)*b.hl:0),y=b.y+(b.axis==='y'?(2*q-1)*b.hw:0),top=airportBridgeTop(b,x,y),t=p.ray(x,y,5,0,0,-1,p.box);
    if(Math.abs(5-t-top)>1e-7||Math.abs(walkGround(x,y)-top)>1e-7||Math.abs(roadGroundHeight(x,y)-top)>1e-7)bad.push(['deck/ground mismatch',b.id,q,top,5-t,walkGround(x,y)]);
    const frame=vehicleGroundFrame([.24,.11],x,y,b.axis==='x'?1:0,b.axis==='y'?1:0);if(!frame.f.every(Number.isFinite)||!Number.isFinite(frame.z))bad.push('invalid vehicle frame');if(q===.5){const slope=(b.h1-b.h0)/(2*(b.axis==='x'?b.hl:b.hw));if(Math.abs(frame.z-top)>1e-7||Math.abs(frame.f[2]-slope/Math.hypot(1,slope))>1e-7)bad.push('vehicle does not follow deck slope');}
    for(const snow of [0,1])for(const td of [0,14]){snowCover=snow;tod=td;env(0);p.ray(x,y,5,0,0,-1,p.box);CH[0]='?';p.shade(0,t,10);if(CH[0]!==' ')bad.push('deck glyph');}
   }
  }
  snowCover=0;
  for(const [x,y]of [[C.x,C.y1],[AIRPORT.x1-2,C.y0]])if(Math.abs(walkGround(x,y))>1e-7)bad.push('raised lip at road join');
  const route=[[C.x,C.y1],[C.x,C.y0],[AIRPORT.x1-3,C.y0]];let last=null;
  for(let k=1;k<route.length;k++){const [x0,y0]=route[k-1],[x1,y1]=route[k],n=Math.ceil(Math.hypot(x1-x0,y1-y0)/.05);for(let j=0;j<=n;j++){const x=x0+(x1-x0)*j/n,y=y0+(y1-y0)*j/n,h=walkGround(x,y);px=x;py=y;if(!free(x,y)||!carBodyClear(x,y,k===1?0:-1,k===1?-1:0))bad.push(['blocked route',x,y]);if(last!==null&&Math.abs(h-last)>.006)bad.push('height discontinuity');last=h;}}
  const y=C.y0+17,h=airportBridgeGround(C.x,y),deck=decks.find(p=>p.box.airportBridgeDeck==='bay-span'),under=deck.ray(C.x,y,.2,0,0,1,deck.box);
  if(Math.abs(.2+under-(h-S.thickness))>1e-7||roadBridgeClearance(C.x,y)<1||!navigable(C.x,y)||roadBridgeBuiltHeight(C.x,y,.2)!==0)bad.push('water below deck is blocked');
  let aligned=0;for(let x=AIRPORT.x1-4;x<AIRPORT.x1-2;x+=.07)if(airportFloor(0,0,0,x,C.y0,10,.1)?.[0]===YEL)aligned++;if(!aligned)bad.push('airport road marking misses bridge centre');
  const pier=layout.piers[0];if(Math.abs(roadBridgeBuiltHeight(pier.x,pier.y,5)-walkGround(pier.x,pier.y))>1e-7)bad.push('pier hides bridge deck from landing collision');if(roadBridgeClearance(pier.x+.5,pier.y)>=1.05)bad.push('pier cap clearance missing');if(!roadBridgePierAt(pier.x,pier.y)||navigable(pier.x,pier.y))bad.push('pier collision missing');
  if(!roadBridgeRailAt(C.x+C.hw-.03,y,h)||carBodyClear(C.x+C.hw-.08,y,0,1)||!carBodyClear(C.x,y,0,1))bad.push('guardrail collision mismatch');
  // The native floor painter must render sea below the elevated span, rather than a second road at sea level.
  px=C.x-eye*projY/(10.5);py=y;let sea=0;const orig=seaCell;try{seaCell=(...args)=>{sea++;orig(...args);};floorBaseCell(0,hor+10,0,1,0);}finally{seaCell=orig;}if(sea!==1||FL[0]!==3)bad.push('sea-level road left under bridge');
  return {bad};});assert.deepEqual(r.bad,[]);
}));
test('dev tools Airport jump lands on the terminal forecourt facing the main door, and E enters it',()=>fixture(async p=>{
 await p.evaluate(()=>{openDev();devTab='places';devFilter='Airport';renderDev();});await p.locator('#dev button.item').filter({hasText:/^Airport$/}).click();
 const r=await p.evaluate(()=>({x:px,y:py,tx:TERMINAL.x,wall:TERMINAL.y-TERMINAL.hw,road:AIRPORT.y0+1.6,angle:a,door:terminalDoor(px,py),free:free(px,py),open:devOpen()}));
 assert.ok(Math.abs(r.x-r.tx)<.01&&r.y>r.road&&r.y<r.wall,'in front of terminal, clear of the road: '+JSON.stringify(r));assert.equal(r.door,0);assert.ok(r.free&&!r.open);assert.ok(Math.abs(r.angle-Math.PI/2)<1e-8);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>room?.kind),'terminal');
}));

test('keys from the previously focused developer control reach gameplay after the panel closes',()=>fixture(async p=>{
 await p.evaluate(()=>{openDev();devTab='places';devFilter='Airport';renderDev();});
 const button=p.locator('#dev button.item').filter({hasText:/^Airport$/});await button.evaluate(el=>window.previousDevControl=el);await button.click();
 assert.equal(await p.evaluate(()=>devOpen()),false);
 // Native key dispatch can already be queued against the old focused control
 // when its click hides the panel; it must bubble to the game's key handler.
 await p.evaluate(()=>previousDevControl.dispatchEvent(new KeyboardEvent('keydown',{key:'e',code:'KeyE',bubbles:true})));
 assert.equal(await p.evaluate(()=>room?.kind),'terminal');
}));
