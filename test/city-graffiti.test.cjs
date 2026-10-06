'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadCity } = require('./helpers/load-city.cjs');

function loadPaint() {
  const city = loadCity();
  vm.runInContext(`const GLYPH5={}; const glyphOn=()=>false;
    const oneCell=(off,step)=>Math.abs(off)<step/2;
    const CH=['wall'],COL=new Uint8Array(1),BG=new Uint8Array(1);
    const set=(i,ch,col)=>{CH[i]=ch;COL[i]=col;};`,city.ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/graffiti.js'),'utf8'),city.ctx,{filename:'city/graffiti.js'});
  return city;
}

test('new tag symbols preserve graphemes and the numeric IDs of every older saved design', () => {
  const { ev } = loadPaint();
  assert.equal(ev('SYMBOL_DESIGN_START'),21);
  assert.equal(ev('TAG_WORDS[9-TAG_ART.length]'),'ACE','saved design 9 remains the ACE lettering');
  assert.equal(ev('TAG_WORDS[20-TAG_ART.length]'),'ART','saved design 20 remains ART');
  assert.equal(ev('designCount'),28);
  assert.equal(ev('paintGlyphs(TAG_SYMBOLS[5]).length'),3,'butterfly marks stay attached to their three base characters');
  assert.equal(ev('paintGlyphs(TAG_SYMBOLS[1]).join("")'),'¯\\_(ツ)_/¯');
  assert.equal(ev('TAG_SYMBOLS.map(s=>paintGlyphs(s).join("")).join("|")'),'><>|¯\\_(ツ)_/¯|(^.^)|<*_*>|ʕ•ᴥ•ʔ|Ƹ̵̡Ӝ̵̨̄Ʒ|<3');
});

test('street marks include all seven symbols and fit complete text inside exposed wall corners', () => {
  const { ev } = loadPaint();
  const result = ev(`(()=>{
    const symbols=new Set(),names=new Set();let clipped=0,flourishes=0;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)for(const face of ['N','S','E','W']){
      for(const tag of streetTags(idx(x,y),x,y,face)||[]){
        (TAG_SYMBOLS.includes(tag.word)?symbols:names).add(tag.word);
        if(tag.at-tag.half<.044 || tag.at+tag.half>.956)clipped++;
        if('fl' in tag)flourishes++;
      }
    }
    return [symbols.size,names.size,clipped,flourishes];
  })()`);
  assert.equal(result[0],7); assert.ok(result[1]>=14);
  assert.equal(result[2],0); assert.equal(result[3],0);
});

test('wide and tall mural pictures retain their proportions on both short and tall walls', () => {
  const { ev } = loadPaint();
  const layouts = ev(`['bear','coffee','dinosaur','island','boombox'].flatMap(name=>[.5,1.45].map(span=>{
    const th={art:[name],words:['ART'],styles:[0],pals:[[RED,BLUE,WHITE]]};
    const plan=muralPlan(.25,th,span);
    return [plan.width/(plan.height*span),plan.image.width/(plan.image.height*1.85),plan.width,plan.height];
  }))`);
  assert.equal(layouts.length,10);
  for (const [ratio,expected,width,height] of layouts) {
    assert.ok(Math.abs(ratio-expected)<1e-9);
    assert.ok(width<=.82 && height<=.72);
  }
  assert.ok(ev('Object.values(MURAL_IMAGES).every(image=>image.rows.every(row=>row.every(ch=>paintGlyphs(ch).length===1)))'));
});

test('faded mural edges are transparent and leave the existing wall character and color intact', () => {
  const { ev } = loadPaint();
  const result = ev(`(()=>{
    const th={art:['bear'],words:['ART'],styles:[0],pals:[[RED,BLUE,WHITE]]},plan=muralPlan(.25,th);
    BG[0]=C(BRICK,5);COL[0]=C(STONE,7);CH[0]='_';
    const before=[BG[0],COL[0],CH[0]],painted=muralCell(0,0,.52,.25,12,th,.03,.05);
    return {before,after:[BG[0],COL[0],CH[0]],painted,center:muralOpacity(.5,.52,.25,plan),edge:muralOpacity(0,.52,.25,plan)};
  })()`);
  assert.equal(result.painted,false);
  assert.deepEqual(Array.from(result.after),Array.from(result.before));
  assert.equal(result.edge,0); assert.ok(result.center>.95);
});
