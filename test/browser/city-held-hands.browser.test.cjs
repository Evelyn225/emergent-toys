'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;T=10;heldUse=null;for(const k in fx)fx[k]=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('held fingers are filled skin surfaces and the item mask follows their curved silhouette at several scales and rotations',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const hand=drawHand,text=g.fillText,bad=[];let glyphs=0,covered=0,exposed=0;g.fillText=(...a)=>{glyphs++;return text.apply(g,a);};try{for(const size of [12,24,48])for(const angle of [0,.7]){
  const paint=fn=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);g.save();g.translate(400,220);g.rotate(angle);fn();g.restore();return g.getImageData(0,0,cv.width,cv.height).data;};
  const skin=paint(()=>hand(0,0,size));drawHand=()=>{};
  const item=paint(()=>drawBehindHand(0,0,size,()=>{g.fillStyle='#ee2222';g.fillRect(-400,-400,1600,1200);}));drawHand=hand;
  let wrong=0,lost=0;
  for(let y=210;y<Math.min(cv.height,600);y++)for(let x=200;x<Math.min(cv.width,900);x++){const k=(y*cv.width+x)*4;if(skin[k+3]>253){covered++;if(item[k+3]>3)wrong++;}else if(skin[k+3]===0){exposed++;if(item[k+3]<250)lost++;}}
  if(wrong>20||lost>20)bad.push({size,angle,wrong,lost});
 }
 return{bad,glyphs,covered,exposed};}finally{drawHand=hand;g.fillText=text;g.setTransform(1,0,0,1,0,0);}});
 assert.deepEqual(r.bad,[]);assert.equal(r.glyphs,0,'hands must not be outline characters');assert.ok(r.covered>20000&&r.exposed>20000,JSON.stringify(r));
}));
test('the reload support hand has solid fingers and still leaves the cylinder and individual rounds visible',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{inv.splice(0,inv.length,{id:'revolver',uses:2},{id:'ammo',uses:12});held=0;gun.reload=RELOAD_T*.5;gun.kick=0;const art=artText;let skin=0,skinGlyph=0;artText=(lines,x,y,size,col)=>{for(let r=0;r<lines.length;r++)for(let c=0;c<lines[r].length;c++){const ch=lines[r][c];if(ch!==' '&&(col(ch,r,c)>>4)===SKIN){if(ch==='\u0001')skin++;else skinGlyph++;}}return art(lines,x,y,size,col);};try{g.clearRect(0,0,cv.width,cv.height);drawRevolver(inv[0]);const[open]=revolverPicture(true,4),pixels=g.getImageData(0,cv.height-10,Math.floor(cv.width*.65),1).data;let wrist=0;for(let k=0;k<pixels.length;k+=4)if(pixels[k]>100&&pixels[k]>pixels[k+2]*1.4&&pixels[k+3]>250)wrist++;return{skin,skinGlyph,wrist,open:open.some(l=>l.includes('\u0001'))};}finally{artText=art;}});
 assert.ok(r.skin>=20&&r.wrist>=20,JSON.stringify(r));assert.equal(r.skinGlyph,0);assert.equal(r.open,true);
}));
