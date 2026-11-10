'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;T=10;heldUse=null;for(const k in fx)fx[k]=0;enterRoom('florist',{word:'FLORIST',ret:[100,100,0]},[5,5.8,-Math.PI/2]);room.props=[];});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('every bought food and drink paints colour surfaces, retains complete package lettering and visibly depletes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const ids=Object.keys(ITEMS).filter(id=>['food','drink'].includes(ITEMS[id].kind)&&!ITEMS[id].cooked),labels={milk:'MILK',coffee:'CAFE',water:'AQUA',soda:'COLA',energy:'ZAP',popcorn:'POPCORN',fries:'FRIES',chicken:'CHICKEN',chips:'CHIPS',candy:'CANDY',fortunecookie:'LUCK',noodlebox:'NOODLES'},bad=[];let surfaces=0,letters='';
  const signature=([art,col])=>art.map((line,r)=>[...line].map((ch,c)=>ch===' '?' ':ch+':'+col(ch,r,c)).join(',')).join('\n'),rect=g.fillRect,text=g.fillText,stroke=g.strokeText;
  try{g.fillRect=()=>surfaces++;g.fillText=ch=>{letters+=ch;if(!/[A-Z]/.test(ch))bad.push(['surface reached text painter',ch]);};g.strokeText=ch=>{if(!/[A-Z]/.test(ch))bad.push(['surface reached outline painter',ch]);};
   for(const id of ids){const I=ITEMS[id];for(const f of [1,.5,.25,0]){const[art,col]=DENSE[id]({id,uses:Math.ceil(I.uses*f)},f);let cells=0;
    for(const line of art)for(const ch of line)if(ch!==' '){cells++;if(ch!=='\u0001'&&!labels[id]?.includes(ch))bad.push(['surface glyph',id,f,ch]);}
    if(f>0&&cells<2)bad.push(['empty picture',id,f]);if(f>0&&labels[id]&&!art.some(l=>l.includes(labels[id])))bad.push(['broken label',id,f]);
    g.font='12px monospace';artText(art,0,0,12,col);
   }if(I.uses>1&&signature(DENSE[id]({id,uses:I.uses},1))===signature(DENSE[id]({id,uses:1},1/I.uses)))bad.push(['no depletion',id]);}
  }finally{g.fillRect=rect;g.fillText=text;g.strokeText=stroke;}
  return{bad:bad.slice(0,12),count:ids.length,surfaces,letters};
 });assert.deepEqual(r.bad,[],JSON.stringify(r));assert.ok(r.count>=54&&r.surfaces>10000);for(const word of ['MILK','CAFE','AQUA','COLA','CHICKEN','POPCORN','LUCK','NOODLES'])assert.ok(r.letters.includes(word),word);
}));
test('drink levels lower inside solid rims and bases, while the sake cup keeps its whole ceramic silhouette',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],liquids={latte:BRICK,tea:ORANGE,water:CYAN,beer:YEL,whiskey:ORANGE,cocktail:MAG,milkshake:MAG,smoothie:ORANGE,thaitea:ORANGE,herbaltea:GREEN,melonsoda:GREEN,lemonade:YEL,bubbletea:WARM,sake:CYAN};
  const count=(id,f,base)=>{const[art,col]=DENSE[id]({id,uses:Math.ceil(ITEMS[id].uses*f)},f);let n=0;for(let r=0;r<art.length;r++)for(let c=0;c<art[r].length;c++)if(art[r][c]!==' '&&(col(art[r][c],r,c)>>4)===base)n++;return n;};
  for(const[id,base]of Object.entries(liquids)){const full=count(id,1,base),part=count(id,.25,base);if(!(full>part))bad.push(['liquid did not lower',id,full,part]);}
  let cup=null;for(const f of [1,.5,.25,0]){const[art]=DENSE.sake({id:'sake',uses:Math.ceil(2*f)},f),mask=art.map(l=>l.replace(/[^ ]/g,'#')).join('\n');if(cup&&mask!==cup)bad.push('sake cup bitten away');cup=mask;}
  // Inspect the native glass sampler at the same 0.6-wide, one-high cell spacing.
  for(const f of [1,.5,0])for(const y of [-3.5,-2.5,-1.5,-.5,.5,1.5,2.5,3.5]){
   const w=4-(y+4)*.07,cells=[];for(let x=-5.4;x<=5.4;x+=.6)if(Math.abs(x)<=w){const q=dGlass(x,y,-4,4,()=>w,f,[CYAN,null]);cells.push({x,q});}
   for(const q of [cells[0],cells.at(-1)])if(!q?.q)bad.push(['broken glass side',f,y,q?.x]);
  }
  for(const f of [1,0])for(const x of [-3,-1.8,-.6,.6,1.8,3])if(!dGlass(x,-4,-4,4,()=>4,f,[CYAN,null]))bad.push('open rim');
  return{bad};
 });assert.deepEqual(r.bad,[],JSON.stringify(r));
}));
test('real Q sips and bites change the native held picture, preserve its grip and retain state through X and E',()=>fixture(async p=>{
 for(const id of ['sake','beer','coffee','sushi','onigiri','icecream']){
  const before=await p.evaluate(id=>{inv.splice(0,inv.length,{id,uses:ITEMS[id].uses});held=0;heldUse=null;needs.food=needs.drink=10;heldPictureCache=null;const pic=heldPicture(inv[0]),G=heldFrame(inv[0],pic);return{uses:inv[0].uses,picture:JSON.stringify(pic.art.map((l,r)=>[...l].map((ch,c)=>[ch,pic.col(ch,r,c)]))),cx:G.cx,hy:G.hy};},id);
  await p.keyboard.press('q');const after=await p.evaluate(()=>{T+=.2;const pic=heldPicture(inv[0]),G=heldFrame(inv[0],pic);return{uses:inv[0].uses,picture:JSON.stringify(pic.art.map((l,r)=>[...l].map((ch,c)=>[ch,pic.col(ch,r,c)]))),cx:G.cx,hy:G.hy};});
  assert.equal(after.uses,before.uses-1,id);if(id!=='coffee')assert.notEqual(after.picture,before.picture,id);assert.equal(after.cx,before.cx,id);assert.equal(after.hy,before.hy,id);
 }
 await p.keyboard.press('x');assert.equal(await p.evaluate(()=>inv.length),0);await p.keyboard.press('e');assert.deepEqual(await p.evaluate(()=>[inv[0]?.id,inv[0]?.uses]),['icecream',3]);
}));
