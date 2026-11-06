'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;T=10;for(const k in fx)fx[k]=0;body.z=body.vz=body.crouch=0;enterRoom('florist',{word:'FLORIST',ret:[100,100,0]},[5,5.8,0]);room.props=[];});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('revolver surfaces keep a bore, open trigger guard, joined reload crane and six individually loaded chambers',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof revolverPicture!=='function')return{bad:['character revolver']};const bad=[],closed=revolverPicture(false,6,0,0),open=revolverPicture(true,3,0,0),at=(p,c,r)=>[p[0][r][c],p[1](p[0][r][c],r,c)>>4];
 for(const p of [closed,open])for(const row of p[0])for(const ch of row)if(ch!==' '&&ch!=='\u0001')bad.push('surface glyph');
 if(at(closed,0,3)[0]===' '||at(closed,34,8)[0]!==' '||at(closed,34,4)[0]===' '||at(open,32,4)[0]!==' ')bad.push('missing physical bore, guard or open cylinder aperture');
 if(at(open,29,7)[0]===' ')bad.push('floating swung cylinder');
 const points=[[24,8],[26,9],[26,11],[24,12],[22,11],[22,9]];
 for(let n=0;n<=6;n++){const p=revolverPicture(true,n,0,0),loaded=points.filter(([c,r])=>at(p,c,r)[1]===YEL).length;if(loaded!==n)bad.push(['incorrect reload face',n,loaded]);}
 if(itemSize({id:'revolver'})<.28||itemSize({id:'revolver'})>.36)bad.push('wrong dropped gun size');
 return{bad};});assert.deepEqual(r.bad,[],JSON.stringify(r));
}));
test('held rods retain the earlier ASCII shaft, reel and bobber instead of smooth canvas silhouettes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],line=charLine,text=g.fillText,ellipse=g.ellipse,segment=heldToolSegment;let lines=0,arcs=0,segments=0,glyphs=[];
 try{charLine=()=>lines++;g.fillText=(ch,...args)=>{glyphs.push(ch);};g.ellipse=()=>arcs++;heldToolSegment=()=>segments++;
 for(const id of ['rod','carbonrod']){inv.splice(0,inv.length,{id,uses:0});held=0;fishing=null;rodView.ang=.6;rodView.bend=.2;lines=arcs=segments=0;glyphs=[];drawFishingRod(inv[0]);
  if(glyphs.length<80||!glyphs.includes('#')||!glyphs.includes('(')||!glyphs.includes(')')||glyphs.filter(c=>c==='o').length<7||lines!==2||arcs||segments)bad.push({id,glyphs:glyphs.length,lines,arcs,segments});
 }
 }finally{charLine=line;g.fillText=text;g.ellipse=ellipse;heldToolSegment=segment;}
 return bad;});assert.deepEqual(r,[]);
}));
test('ammo, knife, spray and umbrella use solid pictures; open canopy has no surface letters',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],ids=['ammo','pocketknife','spraypaint','umbrella','rod','carbonrod','revolver'];for(const id of ids){const[art,col]=DENSE[id]({id,uses:24},1);for(const row of art)for(const ch of row)if(ch!==' '&&ch!=='\u0001'&&!('.38SPECIAL24ROUNDZAP'.includes(ch)))bad.push(['surface glyph',id,ch]);if(!art.some(l=>l.includes('\u0001')))bad.push(['missing solid picture',id]);}
 const[ammo]=DENSE.ammo({id:'ammo',uses:24},1);if(!ammo.some(l=>l.replace(/\u0001/g,' ').includes('.38 SPECIAL'))||!ammo.some(l=>l.replace(/\u0001/g,' ').includes('24 ROUNDS')))bad.push('ammo printing lost');
 const text=g.fillText;let glyphs=0;try{g.fillText=()=>glyphs++;drawCanopy(cv.width*.84,cv.height*.8,20,0);}finally{g.fillText=text;}if(glyphs)bad.push('canopy uses characters');return{bad};});assert.deepEqual(r.bad,[],JSON.stringify(r));
}));
test('actual Q fire and R reload retain ammo accounting and the solid cylinder animation',()=>fixture(async p=>{
 await p.evaluate(()=>{inv.splice(0,inv.length,{id:'revolver',uses:6},{id:'ammo',uses:24});held=0;clearWanted();gun.cool=0;gun.reload=0;});await p.keyboard.press('q');assert.equal(await p.evaluate(()=>heldGun().uses),5);await p.keyboard.press('r');assert.ok(await p.evaluate(()=>gun.reload>0));const r=await p.evaluate(()=>{let surfaces=0;const rect=g.fillRect;try{g.fillRect=(...a)=>{surfaces++;return rect.apply(g,a);};drawHeldBig();}finally{g.fillRect=rect;}for(let n=0;n<50;n++){T+=.05;stepGun(.05);}return{surfaces,rounds:heldGun().uses,spare:ammoLeft(),reload:gun.reload};});assert.ok(r.surfaces>100);assert.equal(r.rounds,6);assert.equal(r.spare,23);assert.equal(r.reload,0);
}));

test('printed labels occupy exactly one complete row on odd and even pictures, including boundary-aligned lettering',()=>fixture(async p=>{const r=await p.evaluate(()=>{const bad=[];for(const H of [13,14,17,18])for(const cy of [0,.5,2]){const[art]=sculptSurface(30,H,(x,y)=>{const label=dText(x,y,0,cy,'TEST WORD');return label?[label,C(RED,13),true]:[' ',C(WHITE,10)];});const lines=art.map(l=>l.replace(/\u0001/g,' ')).filter(l=>l.trim());if(lines.length!==1||!lines[0].includes('TEST WORD'))bad.push([H,cy,lines]);}return bad;});assert.deepEqual(r,[]);}));
