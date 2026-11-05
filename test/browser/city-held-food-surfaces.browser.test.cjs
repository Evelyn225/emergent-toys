'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;heldUse=null;T=10;for(const k in fx)fx[k]=0;enterRoom('florist',{word:'FLORIST',ret:[100,100,0]},[5,5.8,-Math.PI/2]);room.props=[];});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('groceries and every cooked meal paint solid colour surfaces while package printing remains complete text',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const ids=[...new Set([...RECIPES.map(r=>r.id),'eggs','bread','butter','rice','pasta','drynoodles','rawchicken','mince','bacon','tofu','cheese','potatoes','onion','tomatoes','garlic','mushrooms','greens','peppers','chilli','lemon'])],bad=[],labels={rice:'RICE',pasta:'PASTA',drynoodles:'NOODLES',butter:'BUTTER',tofu:'TOFU'};let solid=0,printing='';
  const rect=g.fillRect,text=g.fillText,stroke=g.strokeText;try{
   g.fillRect=()=>solid++;g.fillText=ch=>{printing+=ch;if(!/[A-Z]/.test(ch))bad.push(['surface sent to text painter',ch]);};g.strokeText=ch=>{if(!/[A-Z]/.test(ch))bad.push(['surface sent to outline painter',ch]);};
   for(const id of ids)for(const q of ['fine','perfect','burnt'])for(const f of [1,.5,.1]){
    const[art,col]=DENSE[id]({id,q},f),colors=new Set();let cells=0;
    for(let r=0;r<art.length;r++)for(let c=0;c<art[r].length;c++){const ch=art[r][c];if(ch===' ')continue;cells++;if(ch!=='\u0001'&&!labels[id]?.includes(ch))bad.push(['surface glyph',id,q,f,ch]);colors.add(col(ch,r,c));}
    if(cells<15||colors.size<2)bad.push(['empty or unshaded food',id,q,f,cells,colors.size]);
    if(labels[id]&&!art.some(row=>row.includes(labels[id])))bad.push(['broken label',id,art]);
    g.font='12px monospace';artText(art,0,0,12,col);
   }
  }finally{g.fillRect=rect;g.fillText=text;g.strokeText=stroke;}
  for(const id of ['rice','pasta','drynoodles']){const[art,col]=DENSE[id]({id},1),levels=new Set();for(let r=11;r<14;r++)for(let c=10;c<21;c++)levels.add(col(art[r][c],r,c)&15);if(levels.size<2)bad.push(['grain/noodle detail flattened',id]);}
  return {bad:bad.slice(0,10),count:ids.length,solid,printing:printing.includes('RICE')&&printing.includes('NOODLES')};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,44);assert.ok(r.solid>30000&&r.printing,JSON.stringify(r));
}));
test('solid food rectangles fit phone and desktop views and use their full cell height at the grip',()=>fixture(async p=>{
 for(const [width,height]of [[320,568],[390,844],[844,390],[1170,800]]){
  await p.setViewportSize({width,height});const r=await p.evaluate(()=>{
   resize();const bad=[],rect=g.fillRect,measure=g.measureText,hand=drawHand;let inHand=false,draws=0;
   try{drawHand=(...a)=>{inHand=true;try{return hand(...a);}finally{inHand=false;}};
    // A control glyph may have no ink in another font; solid pixels still meet the hand.
    g.measureText=function(ch){return ch==='\u0001'?{width:0,actualBoundingBoxAscent:0,actualBoundingBoxDescent:0}:measure.call(this,ch);};
    g.fillRect=function(x,y,w,h){if(!inHand){const m=g.getTransform();for(const X of [x,x+w])for(const Y of [y,y+h]){const xx=m.a*X+m.c*Y+m.e,yy=m.b*X+m.d*Y+m.f;if(xx<0||xx>cv.width||yy<0||yy>cv.height)bad.push(['clipped food cell',xx,yy]);}draws++;}return rect.call(this,x,y,w,h);};
    for(const id of [...RECIPES.map(r=>r.id),'rice','rawchicken','greens']){
     inv.splice(0,inv.length,{id,uses:ITEMS[id].uses||0,q:'fine'});held=0;heldUse=null;heldPictureCache=null;
     const pic=heldPicture(inv[0]),G=heldFrame(inv[0],pic),top=heldPictureTop(pic,G.s,G.hsz);
     g.font=G.hsz+'px monospace';const edge=-g.measureText('_').actualBoundingBoxAscent;
     let bottom=-Infinity;for(let r=Math.max(0,pic.gripRows-2);r<pic.gripRows;r++)for(let c=Math.floor(pic.width/2)-2;c<=Math.floor(pic.width/2)+2;c++)if(pic.art[r][c]==='\u0001')bottom=Math.max(bottom,top+(r+1)*G.s+.3);
     const gap=edge-bottom;if(!(gap>=-.01&&gap<=1))bad.push(['solid grip cell floats or overlaps',id,gap]);
     g.clearRect(0,0,cv.width,cv.height);g.textBaseline='top';drawHeldBig();
    }
   }finally{g.fillRect=rect;g.measureText=measure;drawHand=hand;}
   return {bad:bad.slice(0,10),draws};
  });assert.deepEqual(r.bad,[],`${width}x${height}: ${JSON.stringify(r)}`);assert.ok(r.draws>1000);
 }
}));
test('real Q reduces the soup surface and bites, while X and E retain portions and quality through dropping and pickup',()=>fixture(async p=>{
 const start=await p.evaluate(()=>{inv.splice(0,inv.length,{id:'tomatosoup',uses:4,q:'perfect'});held=0;needs.food=10;const sample=()=>{const[art,col]=DENSE.tomatosoup(inv[0],usesLeft(inv[0]));let area=0,top=Infinity,sum=0;for(let r=0;r<art.length;r++)for(let c=0;c<art[r].length;c++)if(art[r][c]!==' '&&[RED,GREEN,WARM,ORANGE].includes(col(art[r][c],r,c)>>4)){area++;sum+=c;top=Math.min(top,r);}return {area,top,centre:sum/area};};window.foodArea=sample;return foodArea();});
 await p.keyboard.press('q');const after=await p.evaluate(()=>({uses:inv[0].uses,area:foodArea(),quality:inv[0].q}));assert.equal(after.uses,3);assert.equal(after.quality,'perfect');assert.ok(after.area.area<start.area&&after.area.top>start.top&&Math.abs(after.area.centre-start.centre)<.1,JSON.stringify({start,after}));
 await p.keyboard.press('x');assert.equal(await p.evaluate(()=>inv.length),0);const dropped=await p.evaluate(()=>{const d=droppedHere(),pic=droppedPicture(d);return{uses:d.uses,q:d.q,solid:pic.art.some(l=>l.includes('\u0001'))};});assert.deepEqual(dropped,{uses:3,q:'perfect',solid:true});
 await p.keyboard.press('e');assert.deepEqual(await p.evaluate(()=>[inv[0]?.id,inv[0]?.uses,inv[0]?.q]),['tomatosoup',3,'perfect']);
 const full=await p.evaluate(()=>{inv.splice(0,inv.length,{id:'toast',uses:2,q:'fine'});held=0;heldUse=null;return heldPicture(inv[0]).art.join('').replace(/ /g,'').length;});await p.keyboard.press('q');const bite=await p.evaluate(()=>{T+=.2;return{uses:inv[0].uses,area:heldPicture(inv[0]).art.join('').replace(/ /g,'').length};});assert.equal(bite.uses,1);assert.ok(bite.area<full);
}));
