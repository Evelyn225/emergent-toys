'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;body.z=body.vz=body.crouch=0;enterRoom('train',{st:0,t0:0,opts:[1,2,3,4,5],dest:null,track:0},[2,2.5,0]);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('subway cabin floors, tunnel windows, metal walls and ceiling are colour surfaces; adverts keep their lettering',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],colors=new Set();
  for(const time of [0,14]){tod=time;env(0);for(const distance of [1,18]){
   for(const my of [0,room.H-1,2])for(let n=0;n<30;n++){const u=n*.137,z=.08+n*.085;CH[0]='?';BG[0]=NONE;trainWall(0,u,.02*distance,z,distance,3,my,8);if(CH[0]!==' '&&!(z>2.05&&z<2.4))bad.push(['wall glyph',CH[0],z]);if(BG[0]===NONE)bad.push('wall missing background');colors.add(BG[0]);}
   for(const row of [hor+2,hor+10,rows-2])for(const rx of [.1,.35,.7]){CH[0]='?';BG[0]=NONE;roomFloor(0,row,0,rx,.1);if(CH[0]!==' '||BG[0]===NONE)bad.push('floor glyph or missing colour');}
   for(const row of [1,5,Math.max(1,hor-5)]){CH[0]='?';BG[0]=NONE;roomCeil(0,row,0,.5,.1);if(CH[0]!==' '||BG[0]===NONE)bad.push('ceiling glyph or missing colour');}
  }}
  let ads=0;const old=wallText;try{wallText=(...args)=>{ads++;return old(...args);};trainWall(0,3,.01,2.22,1,3,0,10);}finally{wallText=old;}
  return {bad,ads,colors:colors.size};});assert.deepEqual(r.bad,[]);assert.equal(r.ads,1);assert.ok(r.colors>3);
}));
test('subway seats have rounded cushions on supports, poles have solid mounted shafts and lamps meet the ceiling',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],seats=room.props.filter(p=>p.subwaySeat),backs=room.props.filter(p=>p.subwaySeatBack),poles=room.props.filter(p=>p.subwayPole),lamps=room.props.filter(p=>p.subwayLamp);
  if(seats.length!==8||backs.length!==8||poles.length!==3||lamps.length!==8)return {bad:[['missing fitted cabin',seats.length,backs.length,poles.length,lamps.length]]};
  const capture=prop=>{const parts=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});prop.draw(prop.x,prop.y,prop);}finally{drawBox=old;}return parts;};
  for(const s of seats){const parts=capture(s),pads=parts.filter(p=>p.box.z1===.45),feet=parts.filter(p=>p.box.z0===0);
   if(pads.length!==6||feet.length!==4||parts.some(p=>p.ray!==coveRayRounded))bad.push('seat is a filled block');
   if(s.box.z1!==.45||s.seatRow.h!==s.box.z1||s.seatRow.y!==s.y||s.seatRow.fy!==(s.y<2?1:-1))bad.push('seat no longer matches sitting height/facing');
   for(const f of feet){if(!parts.some(p=>p.box.z0===f.box.z1&&Math.abs(f.box.x-p.box.x)<p.box.hl&&Math.abs(f.box.y-p.box.y)<p.box.hw))bad.push('unsupported seat frame');}
   const hit=coveRayRounded(pads[2].box.x,pads[2].box.y,1,0,0,-1,pads[2].box);if(Math.abs(1-hit-.45)>1e-7)bad.push('native cushion top differs from seat height');
  }
  for(const pole of poles){const parts=capture(pole),shaft=parts.find(p=>p.box.hl===.025);if(parts.length!==3||!shaft||shaft.box.z0!==0||shaft.box.z1!==3||parts.some(p=>p.ray!==rayCopperDrum))bad.push('unmounted or line-glyph pole');
   if(!parts.some(p=>p.box.z0===0&&p.box.hl>.025)||!parts.some(p=>p.box.z1===3&&p.box.hl>.025))bad.push('missing pole collars');
  }
  for(const lamp of lamps){const parts=capture(lamp);if(!lamp.walk||!lamp.overhead||lamp.box.z0<2.9||parts.length!==2||Math.max(...parts.map(p=>p.box.z1))!==3)bad.push('lamp floats or blocks aisle');}
  for(const prop of [...seats,...backs,...poles,...lamps])for(const part of capture(prop))for(const z of [(part.box.z0+part.box.z1)/2,part.box.z1]){Object.assign(HIT,{face:5,u:0,v:0,w:z,nx:0,ny:0,nz:1});CH[0]='?';BG[0]=NONE;part.shade(0,1,10);if(CH[0]!==' '||BG[0]===NONE)bad.push('fixture glyph or missing background');}
  return {bad};});assert.deepEqual(r.bad,[]);
 await p.evaluate(()=>{room.props=room.props.filter(s=>!s.fig);px=3;py=2.2;body.seat=null;});
 await p.keyboard.press('c');assert.deepEqual(await p.evaluate(()=>[!!body.seat,body.seat?.h,py]),[true,.45,1.3]);
 await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>body.seat),null);
}));
