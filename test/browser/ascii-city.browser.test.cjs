'use strict';
// ASCII City in a real browser: the bundle loads, every mode renders without throwing, and the canvas isn't blank.
// The node suite (test/city-world.test.cjs) covers the simulation; this covers the DOM half the vm can't run.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium, devices } = require('playwright');

const PAGE = pathToFileURL(path.join(__dirname, '..', '..', 'ascii-city.html')).href;

test('boxes straddling the camera but outside its view skip per-cell rays, while visible boxes still draw', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;render(0);dx=1;dy=0;
    let rays=0,painted=0;
    const intersect=(...args)=>{rays++;return rayBox(...args);};
    const shade=i=>{painted++;set(i,'#',C(WHITE,12));return true;};
    ZB.fill(Infinity);
    drawBox(boxAt(0,5,1,0,1,.1,0,1),shade,intersect);
    const rejected=rays;
    drawBox(boxAt(2,0,1,0,.4,.3,0,.8),shade,intersect);
    return {rejected,rays,painted};
  });
  assert.equal(result.rejected,0,'a near-plane box beyond the side of the view needs no intersections');
  assert.ok(result.rays>0 && result.painted>0,JSON.stringify(result));
}));

test('near-plane balconies outside the vertical view skip rays, and looking up or down reveals them', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;render(0);dx=1;dy=0;eye=.17;hor=rows/2;
    let rays=0,painted=0;
    const intersect=(...args)=>{rays++;return rayBox(...args);};
    const shade=i=>{painted++;set(i,'#',C(WHITE,12));return true;};
    const b=boxAt(.5,0,1,0,.6,.25,2,2.1);
    ZB.fill(Infinity);drawBox(b,shade,intersect);const above=rays;
    const belowBox=boxAt(.5,0,1,0,.6,.25,-2,-1.9);
    drawBox(belowBox,shade,intersect);const below=rays;
    hor=rows/2+3*projY;drawBox(b,shade,intersect);const lookingUp=painted;
    hor=rows/2-3*projY;ZB.fill(Infinity);drawBox(belowBox,shade,intersect);
    return{above,below,lookingUp,lookingDown:painted-lookingUp};
  });
  assert.equal(result.above,0);assert.equal(result.below,0);
  assert.ok(result.lookingUp>0&&result.lookingDown>0,JSON.stringify(result));
}));

test('Midtown housing elevators retain their flat roof landings and real return stairs', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;clearWanted();
    return [16,7,2,0].map(sty=>{
      const b=ARCH_BUILDINGS.find(b=>b.region==='midtown'&&b.sty===sty&&b.sh.kind===SHOP_APTS);
      if(!b)throw Error('Missing apartment '+sty);
      enterRoom('apts',{...b.sh,cell:[mod(b.x0,N),mod(b.y0,N)],ret:[b.x0-.2,b.y0-.2,0]},[4,1.5,-Math.PI/2]);
      interact();render(0);
      const landing={sty,mode,height:roofH,expected:b.h,clear:roofFree(px,py),stairs:roofLot.has(idx(Math.floor(px),Math.floor(py)))};
      interact();return{...landing,returned:mode==='room'&&room.kind==='apts'};
    });
  });
  for(const r of result){assert.equal(r.mode,'roof');assert.equal(r.height,r.expected);assert.ok(r.clear&&r.stairs&&r.returned,JSON.stringify(r));}
}));

test('modern balcony rails and fire escapes have open gaps, fitted glazing, and snow on their exposed slabs', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;tod=12;weather='clear';env(0);render(0);
    const glass=ARCH_DETAILS.find(o=>o.kind==='balcony-rail'&&o.profile.glass), iron=ARCH_DETAILS.find(o=>o.kind==='escape-rail');
    const gaps=o=>{
      let open=0,solid=0;
      for(let n=0;n<40;n++){
        HIT.u=-o.hl+o.hl*2*(n+.5)/40;HIT.v=o.hw;HIT.w=(o.z0+o.z1)/2;HIT.face=3;
        if(residentialDetailShade(o,0,1,10))solid++;else open++;
      }
      return{open,solid};
    };
    const slab=ARCH_DETAILS.find(o=>o.kind==='balcony-slab'&&o.profile.trim!==WHITE);snowCover=0;HIT.u=HIT.v=0;HIT.w=slab.z1;HIT.face=5;
    residentialDetailShade(slab,0,1,10);
    const bare=COL[0]>>4===WHITE||BG[0]>>4===WHITE;
    snowCover=1;residentialDetailShade(slab,0,1,10);
    const snowy=COL[0]>>4===WHITE||BG[0]>>4===WHITE;
    const spine=ARCH_DETAILS.find(o=>o.kind==='service-spine');HIT.u=0;HIT.w=.48+spine.fh*.5;HIT.face=3;
    residentialDetailShade(spine,0,1,10);const glazing=[CYAN,WARM].includes(BG[0]>>4);
    return{glass:gaps(glass),iron:gaps(iron),snow:!bare&&snowy,glazing};
  });
  assert.ok(result.glass.open>15&&result.glass.solid>0,JSON.stringify(result));
  assert.ok(result.iron.open>15&&result.iron.solid>0,JSON.stringify(result));
  assert.ok(result.snow);
  assert.ok(result.glazing);
}));

test('merchant blade signs use block glyphs up close and single readable characters at distance', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;render(0);
    const o=PAVILION_SOLIDS.find(o=>o.kind==='blade'&&o.b.sh.word==='JADE');
    px=o.x-.3;py=o.y;dx=1;dy=0;
    const letterH=Math.min(.075,(o.z1-o.z0-.055)/o.b.sh.word.length),near=[];
    for(let row=0;row<5;row++)for(let col=0;col<4;col++){
      HIT.face=1;HIT.v=((col+.5)/4-.5)*.06;HIT.u=o.hl;HIT.w=o.z1-.0275-(row+.5)/5*letterH;
      pavilionDetailShade(o,0,.3,10);near.push(CH[0]);
    }
    px=o.x-10;HIT.face=1;HIT.v=0;HIT.u=o.hl;HIT.w=o.z1-.0275-letterH*.5;
    pavilionDetailShade(o,0,10,10);
    return {near,far:CH[0],height:o.z1-o.z0};
  });
  assert.ok(result.near.includes('#'),JSON.stringify(result));
  assert.ok(!result.near.includes('J'),'close letters are scaled pixel glyphs');
  assert.equal(result.far,'J');
  assert.ok(result.height<=.55);
}));

test('Unicode graffiti keeps combining marks together without shifting subsequent canvas cells', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true;
    const glyphs = paintGlyphs(TAG_SYMBOLS[5]), calls = [], original = g.fillText;
    CH.fill(' '); COL.fill(C(WHITE,12)); BG.fill(NONE); FOGS.fill(0); FOGB.fill(0);
    [...glyphs,'X','X'].forEach((ch,i)=>CH[i]=ch);
    g.fillText = function(...args){calls.push(args); return original.apply(this,args);};
    present(); g.fillText = original;
    const strokes = [...new Set(TAG_SYMBOLS.flatMap(paintGlyphs))].map(ch=>{
      let count=0;
      for(let y=0;y<48;y++)for(let x=0;x<32;x++)if(paintGlyphOn(ch,(x+.5)/32,(y+.5)/48))count++;
      return {ch,count};
    });
    return {glyphs,calls,cw,strokes,blockEdges:paintGlyphOn('█',.001,.001)&&paintGlyphOn('█',.999,.999),halfBlocks:paintGlyphOn('▀',.5,.25)&&!paintGlyphOn('▀',.5,.75)&&paintGlyphOn('▄',.5,.75)&&!paintGlyphOn('▄',.5,.25)};
  });
  assert.equal(result.glyphs.length,3);
  assert.deepEqual(result.calls.map(c=>c[0]),[...result.glyphs,'XX']);
  for(let i=0;i<4;i++)assert.ok(Math.abs(result.calls[i][1]-i*result.cw)<1e-6);
  assert.ok(result.calls.slice(0,3).every(c=>c[3]===result.cw),'Unicode glyphs fit the width of one cell');
  assert.ok(result.strokes.every(s=>s.count>0),JSON.stringify(result.strokes));
  assert.ok(result.blockEdges && result.halfBlocks,'solid and half-block art has no seams between its glyphs');
}));

test('murals fade over the actual facade and leave its color and masonry intact through transparent edges', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; tod = 12; weather = 'clear'; env(0); render(0);
    let spot=null;
    for(let y=0;y<N&&!spot;y++)for(let x=0;x<N&&!spot;x++){
      const k=idx(x,y),seed=muralSeed(k,x,y,'N');
      if(seed>=0&&map[k]>1.9&&muralPlan(seed,themeAt(x,y)).image?.blocks)spot={x,y,k,seed};
    }
    if(!spot)throw Error('No block-art mural');
    const {x,y,k}=spot;px=x+.5;py=y-.8;
    const testPixel=(lu,lz)=>{
      const wc=x+lu,z=.45+lz*1.45,args=[0,-wc,.012,z,map[k],.8,true,x,y,1,wc];
      baseFacade(...args); const wall=[CH[0],COL[0],BG[0]];
      facade(...args); return wall.some((v,i)=>v!==[CH[0],COL[0],BG[0]][i]);
    };
    const edge=[];
    for(let n=1;n<20;n++)edge.push(testPixel(.001,n/20),testPixel(.999,n/20));
    let changed=0,exposed=0;
    for(let row=3;row<18;row++)for(let col=3;col<18;col++){
      if(testPixel(col/20,row/20))changed++;else exposed++;
    }
    return {edge,changed,exposed};
  });
  assert.ok(result.edge.every(v=>!v),'transparent edges use the underlying facade without recoloring it');
  assert.ok(result.changed>15 && result.exposed>15,JSON.stringify(result));
}));

test('Belle shop signs retain complete scaled lettering on short recessed faces in every direction', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;mode='walk';tod=12;env(0);render(0);
    const errors=[];let letters=0,blocks=0;
    for(let dir=0;dir<4;dir++) {
      const b=BELLE_BUILDINGS.find(b=>!b.access&&b.ivy&&b.faces.some(f=>f.dir===dir&&f.sign&&f.end-f.start<=2));
      if(!b)throw Error('Missing short ivy-covered face '+dir);
      const f=b.faces.find(f=>f.dir===dir&&f.sign&&f.end-f.start<=2),{center,letterW,bandH}=f.sign;
      px=(f.side?center:f.line)+f.nx*.5;py=(f.side?f.line:center)+f.ny*.5;a=Math.atan2(-f.ny,-f.nx);pitch=.25;render(0);
      const mx=Math.floor((f.side?center:f.line)-f.nx*.1),my=Math.floor((f.side?f.line:center)-f.ny*.1);
      for(const copy of [-N,0,N])for(const sign of [-1,1])for(let p=0;p<b.sh.word.length;p++) {
        const wc=center+copy+sign*(p+.5-b.sh.word.length/2)*letterW;
        WH.dn=8;WH.sl=0;WH.wc=wc;
        belleFacade(0,sign*wc,.004,.36,b.h,8,f.side,mx,my,wc,10,0);
        if(CH[0]!==b.sh.word[p])errors.push([dir,sign,p,CH[0],b.sh.word[p]]);
        letters++;
        for(let row=0;row<5;row++)for(let col=0;col<4;col++) {
          const at=center+copy+sign*(p+(col+.5)/4-b.sh.word.length/2)*letterW;
          WH.dn=.3;WH.sl=0;WH.wc=at;
          belleFacade(0,sign*at,.001,.36+bandH*(.5-(row+.5)/5),b.h,.3,f.side,mx,my,at,10,0);
          const expected=glyphOn(b.sh.word[p],col,row)?'#':' ';
          if(CH[0]!==expected)errors.push(['glyph',dir,sign,p,row,col,CH[0],expected]);
          blocks++;
        }
      }
    }
    return{letters,blocks,errors};
  });
  assert.deepEqual(result.errors,[],JSON.stringify(result.errors.slice(0,5)));
  assert.ok(result.letters>20&&result.blocks>400);
}));

test('packed mansard planes retain the original roof intersections and face selection',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;render(0);
    const reference=(ox,oy,oz,rx,ry,rz,b)=>{
      let entry=0,exit=Infinity,face=5;const x=ox-b.x,y=oy-b.y;
      for(let j=0;j<b.planes.length;j++){
        const [nx,ny,nz,limit]=b.planes[j],dist=limit-nx*x-ny*y-nz*oz,vel=nx*rx+ny*ry+nz*rz;
        if(Math.abs(vel)<1e-8){if(dist<0)return{t:-1};continue;}
        const t=dist/vel;
        if(vel<0&&t>entry){entry=t;face=j;}else if(vel>0)exit=Math.min(exit,t);
        if(entry>exit)return{t:-1};
      }
      if(entry<.02||exit<0)return{t:-1};
      return{t:entry,u:x+rx*entry,v:y+ry*entry,w:oz+rz*entry,face};
    };
    let tested=0,errors=0;
    const roofs = [...belleBuildingsB.flat().filter(b=>!b.access).slice(0,12),
      ...LANDMARK_SOLIDS.filter(b=>b.planes).slice(0,3), ...PAVILION_SOLIDS.filter(b=>b.planes).slice(0,3)];
    for(const b of roofs)for(let n=0;n<1000;n++){
      const args=[b.x+hash(n,1)*20-10,b.y+hash(n,2)*20-10,hash(n,3)*(b.h+1),hash(n,4)*2-1,hash(n,5)*2-1,hash(n,6)*2-1,b];
      const expected=reference(...args),t=rayMansard(...args);
      if(t!==expected.t||t>=0&&(HIT.u!==expected.u||HIT.v!==expected.v||HIT.w!==expected.w||HIT.face!==expected.face))errors++;
      tested++;
    }
    return{tested,errors};
  });
  assert.ok(result.tested>12000,'also exercises legacy landmark and pavilion plane arrays');
  assert.equal(result.errors,0,JSON.stringify(result));
}));

test('copper crowns have curved depth, closed undersides, solid occlusion and snow on their upper surface', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; render(0);
    const cap = { ...boxAt(2,0,1,0,.5,.5,.5,.9), invRadius2:4, invHeight2:6.25 };
    const top = rayCopperCap(2,0,2,0,0,-1,cap), underside = rayCopperCap(2,0,0,0,0,1,cap);
    const below = rayCopperCap(0,0,.4,1,0,0,cap);
    const corner = rayCopperCap(0,.49,.85,1,0,0,cap), boxCorner = rayBox(0,.49,.85,1,0,0,cap);
    const drum = boxAt(2,0,1,0,.5,.5,.3,.5);
    const drumTop = rayCopperDrum(2,0,2,0,0,-1,drum), drumMiss = rayCopperDrum(2,.6,2,0,0,-1,drum);
    dx = 1; dy = 0; eye = .8; hor = rows/2;
    const exposed = snowExposed;
    snowExposed = () => true;
    try {
      const picture = (cover, blocked = false) => {
        snowCover = cover; ZB.fill(blocked ? .5 : Infinity); BG.fill(NONE); CH.fill(' ');
        drawCopperDome(2,0,.5,.5,.6);
        const depth = Array.from(ZB).filter((d,i)=>BG[i]!==NONE);
        return { cells:depth.length, depthRange:depth.length ? Math.max(...depth)-Math.min(...depth) : 0,
          snow:Array.from(BG).filter(c=>(c>>4)===WHITE).length };
      };
      const dry = picture(0), snowy = picture(1), blocked = picture(1,true);
      // A crown well above a level camera should make no calls to its cap or drum rays.
      let rays = 0;
      const capRay = rayCopperCap, drumRay = rayCopperDrum;
      rayCopperCap = (...args) => { rays++; return capRay(...args); };
      rayCopperDrum = (...args) => { rays++; return drumRay(...args); };
      try { drawCopperDome(.5,0,4,.2,.3); }
      finally { rayCopperCap = capRay; rayCopperDrum = drumRay; }
      return { top, underside, below, corner, boxCorner, drumTop, drumMiss, dry, snowy, blocked, rays };
    } finally { snowExposed = exposed; }
  });
  assert.ok(Math.abs(result.top-1.1)<1e-12);
  assert.equal(result.underside,.5); assert.equal(result.below,-1);
  assert.ok(result.corner<0 && result.boxCorner>0);
  assert.equal(result.drumTop,1.5); assert.equal(result.drumMiss,-1);
  assert.ok(result.dry.cells>0 && result.dry.depthRange>.1);
  assert.equal(result.dry.snow,0); assert.ok(result.snowy.snow>0);
  assert.equal(result.blocked.cells,0); assert.equal(result.blocked.snow,0); assert.equal(result.rays,0);
}));

test('Belle lamps have rounded solid globes, foreshorten along the curb, and stay hidden behind nearer walls', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;render(0);dx=1;dy=0;eye=.34;hor=rows/2;lampsOn=1;
    const picture=(ax,ay,occluded=false)=>{
      ZB.fill(occluded?.2:Infinity);BG.fill(NONE);CH.fill(' ');
      drawBelleLamp(.8,0,ax,ay);
      const cells=[];for(let i=0;i<BG.length;i++)if((BG[i]>>4)===WHITE)cells.push(i);
      const xs=cells.map(i=>i%cols),depths=cells.map(i=>ZB[i]);
      return {count:cells.length,width:cells.length?Math.max(...xs)-Math.min(...xs)+1:0,depthRange:cells.length?Math.max(...depths)-Math.min(...depths):0};
    };
    const front=picture(1,0),end=picture(0,1),blocked=picture(1,0,true);
    const globe=belleLampParts(1,0,1,0).find(o=>o.kind==='globe'),z=(globe.z0+globe.z1)/2;
    return{front,end,blocked,center:rayBelleGlobe(0,globe.y,z,1,0,0,globe),corner:rayBelleGlobe(0,globe.y+.044,z+.049,1,0,0,globe),boxCorner:rayBox(0,globe.y+.044,z+.049,1,0,0,globe)};
  });
  assert.ok(result.front.count>0&&result.end.count>0,JSON.stringify(result));
  assert.ok(result.front.width>result.end.width*2,JSON.stringify(result));
  assert.ok(result.front.depthRange>.02,'each globe has a curved depth surface');
  assert.equal(result.blocked.count,0);
  assert.ok(result.center>0&&result.corner<0&&result.boxCorner>0,JSON.stringify(result));
}));

test('Belle French doors lead into the real city, with solid railings and both ways back inside', () => withPage(async page => {
  await page.evaluate(() => {
    paused = true; money = 20000; buy('home_belle'); clearWanted(); sleep = null;
    const home = owned.homes[0];
    enterRoom('bellehome',{cell:[home.cell % N,Math.floor(home.cell / N)],ret:[41,73,0]},[18.4,12,0]);
    body.z = body.vz = body.mx = body.my = body.crouch = 0; body.seat = null;
    paused = false;
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => homeBalconyActive());
  await page.evaluate(() => { paused = true; }); await page.keyboard.up('KeyW');
  const result = await page.evaluate(() => {
    const b = room.balconyWorld, position = [px,py], height = roofH;
    const momentum = Math.hypot(body.mx,body.my), before = [px,py];
    const rails = !roofFree(b.x1,b.doorY) && !roofFree(b.x0+.3,b.y0) && !roofFree(b.x0+.3,b.y1);
    for(let k=0;k<30;k++)move(.01,0);
    const bounded = px < b.x1-.035;
    let worldCalls = 0; const original = drawLandmarks;
    drawLandmarks = () => { worldCalls++; original(); }; a = 0; render(0); drawLandmarks = original;
    const cityEye = eye, floor = roofHeightAt(b.x0+.3,b.doorY);
    const exteriorRoom = room;
    px = b.x0+.11; py = b.doorY; a = Math.PI; const prompt = promptText(); interact();
    const back = mode === 'room' && room === exteriorRoom && free(px,py) && homeRecord() === owned.homes[0];
    px = 19.7; py = 12; body.mx = 6; body.my = -2; stepHomeBalcony();
    const scaled = [body.mx,body.my];
    px = b.x0+.09; py = b.doorY; move(-.025,0);
    const walkedBack = mode === 'room' && free(px,py);
    return {position,height,momentum,rails,bounded,worldCalls,cityEye,floor,prompt,back,walkedBack,scaled,roomMomentum:[body.mx,body.my],before};
  });
  assert.ok(result.momentum > 0 && result.momentum < 1,'walking speed changes to outdoor world units');
  assert.ok(result.rails && result.bounded && result.back && result.walkedBack,JSON.stringify(result));
  assert.equal(result.worldCalls,1,'the ordinary city scene renders outdoors');
  assert.ok(Math.abs(result.cityEye-result.height-.17)<1e-6);
  assert.equal(result.floor,result.height);
  assert.match(result.prompt,/French doors/);
  assert.deepEqual(result.scaled,[.6,-.2]);
  assert.deepEqual(result.roomMomentum,[6,-2]);
}));

test('every redesigned cathedral retains its stair entry, open tower views and return to the forecourt', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; clearWanted(); tod = 12; weather = 'clear'; env(0);
    body.z = body.vz = body.crouch = 0; body.seat = null;
    return LANDMARK_BUILDINGS.filter(b=>b.kind==='cathedral').map(b=>{
      mode = 'walk'; room = null; px = b.x+5; py = b.y+3.7; a = Math.PI/2;
      const ret = [px,py]; interact();
      const entered = mode === 'room' && room.kind === 'cathedral';
      [px,py] = CATH_TOWER; interact();
      const tower = [px,py], height = roofH, open = roofFree(px,py);
      const visible = [];
      for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
        a = heading; pitch = 0; render(0);
        const i=(rows>>1)*cols+(cols>>1); visible.push(ZB[i]>.4);
      }
      move(.035,0); move(0,.025);
      const moved = px > tower[0] && py > tower[1];
      // A stale roof lot used to steal the cathedral's return interaction.
      roofLot = new Set(); interact();
      const down = mode === 'room' && room.kind === 'cathedral' && Math.hypot(px-CATH_TOWER[0],py-CATH_TOWER[1])<.01;
      leaveRoom();
      return {name:b.profile.name,entered,height,open,visible,moved,down,outside:mode==='walk' && Math.hypot(px-ret[0],py-ret[1])<.01};
    });
  });
  assert.equal(result.length,5);
  for(const r of result){assert.equal(r.height,8);assert.ok(r.entered && r.open && r.visible.every(Boolean) && r.moved && r.down && r.outside,JSON.stringify(r));}
}));

test('new clock dials render on the solid chambers and show the game time on all four faces', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'roof'; room = null; clearWanted(); people.length = cars.length = 0;
    body.z = body.vz = body.crouch = 0; body.seat = null; weather = 'clear';
    const results = [];
    for(const b of LANDMARK_BUILDINGS.filter(b=>b.kind==='clock')){
      const o=b.solids.find(o=>o.kind==='clock'); roofH=o.z0+.68-.17; pitch=0;
      for(const [nx,ny] of [[1,0],[0,1],[-1,0],[0,-1]]){
        px=o.x+nx*(o.hl+.65); py=o.y+ny*(o.hw+.65); a=Math.atan2(-ny,-nx);
        tod=12;env(0);render(0); const center=(rows>>1)*cols+(cols>>1), depth=ZB[center];
        // Compare the complete dial region: noon and quarter past cannot have identical hands.
        const cells=[];
        for(let row=(rows>>1)-3;row<=(rows>>1)+3;row++)for(let col=(cols>>1)-3;col<=(cols>>1)+3;col++)cells.push(row*cols+col);
        const before=cells.map(i=>CH[i]).join('');tod=12.25;env(0);render(0);
        const handColumn=(cols>>1)+Math.round(Math.min(o.hl,o.hw)*.73*.55*projX/.65);
        const clockwise=[-1,0,1].some(row=>CH[((rows>>1)+row)*cols+handColumn]==='#');
        results.push({name:b.profile.name,depth,white:BG[center]>>4===WHITE,changes:before!==cells.map(i=>CH[i]).join(''),clockwise});
      }
    }
    return results;
  });
  assert.equal(result.length,20);
  assert.ok(result.every(r=>Math.abs(r.depth-.65)<.035 && r.white && r.changes && r.clockwise),JSON.stringify(result));
}));

test('brownstone bays project in front of their walls and their beveled faces retain fitted glass', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'roof'; room = null; me = null; clearWanted();
    body.z = body.vz = body.crouch = 0; body.seat = null; fx.skating = false;
    tod = 12; dayNum = 4; weather = 'clear'; env(0);
    const bay = ARCH_DETAILS.find(o => o.kind === 'bay'), z = 0.45 + bay.fh * 0.4;
    px = mod(bay.x + bay.nx * 0.8, N); py = mod(bay.y + bay.ny * 0.8, N);
    a = Math.atan2(-bay.ny, -bay.nx); pitch = 0; roofH = z - 0.17;
    const draw = drawArchitecture;
    drawArchitecture = () => {}; render(0);
    const cell = (rows >> 1) * cols + (cols >> 1), wallDepth = ZB[cell];
    drawArchitecture = draw; render(0);
    const frontDepth = ZB[cell], faces = [];
    for (const sign of [-1, 1]) {
      const length = Math.hypot(bay.bevelD, bay.bevelW);
      const nu = sign * bay.bevelD / length, nv = bay.outSign * bay.bevelW / length;
      const u = sign * (bay.hl - bay.bevelW / 2), v = bay.outSign * (bay.hw - bay.bevelD / 2);
      const nx = nu * bay.c - nv * bay.s, ny = nu * bay.s + nv * bay.c;
      px = mod(bay.x + u * bay.c - v * bay.s + nx * 0.8, N);
      py = mod(bay.y + u * bay.s + v * bay.c + ny * 0.8, N);
      a = Math.atan2(-ny, -nx); render(0);
      faces.push({ depth: ZB[cell], glass: [CYAN, WARM].includes(BG[cell] >> 4) });
    }
    return { projection: wallDepth - frontDepth, faces };
  });
  assert.ok(result.projection > 0.1, JSON.stringify(result));
  assert.ok(result.faces.every(f => Math.abs(f.depth - 0.8) < 0.03 && f.glass), JSON.stringify(result));
}));

test('walk up a brownstone stoop, then jump off without changing air strafe momentum', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'walk'; room = null; clearWanted(); sleep = null;
    body.z = body.vz = body.crouch = 0; body.seat = null; fx.skating = false;
    const landing = ARCH_STEPS.find(o => o.z1 === 0.12 && free(o.x + o.nx * 0.16, o.y + o.ny * 0.16));
    px = landing.x + landing.nx * 0.16; py = landing.y + landing.ny * 0.16;
    for (let k = 0; k < 40; k++) { move(-landing.nx * 0.005, -landing.ny * 0.005); stepBody(0.02); }
    render(0);
    const ground = architectureGroundHeight(px, py), raisedEye = eye;
    body.mx = 0.25; body.my = -0.4; jump(); stepBody(0.04);
    const height = ground * 10 + body.z;
    px = landing.x + landing.nx * 0.3; py = landing.y + landing.ny * 0.3;
    stepBody(0);
    return { ground, raisedEye, height, airborneHeight: body.z, momentum: [body.mx, body.my], clear: free(px, py) };
  });
  assert.equal(result.ground, 0.12, JSON.stringify(result));
  assert.ok(Math.abs(result.raisedEye - 0.29) < 1e-6);
  assert.ok(Math.abs(result.height - result.airborneHeight) < 1e-6, 'jump height survives the change of ground level');
  assert.deepEqual(result.momentum, [0.25, -0.4]);
  assert.ok(result.clear);
}));

test('downtown apartment elevators still lead to usable flat rooftops', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; clearWanted();
    const b = ARCH_BUILDINGS.find(b => b.region === 'downtown' && b.sh.kind === SHOP_APTS);
    enterRoom('apts', { ...b.sh, cell: [b.x0, b.y0], ret: [b.x0 - 0.2, b.y0 - 0.2, 0] }, [4, 1.5, -Math.PI / 2]);
    const prompt = promptText(); interact(); render(0);
    return { prompt, mode, height: roofH, expected: b.h, clear: roofFree(px, py), stairs: roofLot.has(idx(Math.floor(px), Math.floor(py))) };
  });
  assert.match(result.prompt, /elevator to the roof/);
  assert.equal(result.mode, 'roof');
  assert.equal(result.height, result.expected);
  assert.ok(result.clear && result.stairs, JSON.stringify(result));
}));

test('redesigned storefronts keep their opening hours, glazing and closed shutters', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'walk'; room = null; me = null; clearWanted();
    body.z = body.vz = body.crouch = 0; body.seat = null; fx.skating = false;
    people.length = cars.length = 0; weather = 'clear';
    return ['brownstones', 'downtown', 'midtown'].map(region => {
      const b = ARCH_BUILDINGS.find(b => b.region === region && b.faces.some(f => f.front) &&
        b.sh.kind !== SHOP_APTS && b.sh.kind !== SHOP_SHUT && openAt(b.sh, 12) && !openAt(b.sh, 3));
      const f = b.faces.find(f => f.front), along = region === 'brownstones' ? f.start + f.spacing * 0.74 : (f.start + f.end) / 2 + (region === 'midtown' ? .17 : 0);
      px = (f.side ? along : f.line) + f.nx * 0.7; py = (f.side ? f.line : along) + f.ny * 0.7;
      a = Math.atan2(-f.ny, -f.nx); pitch = 0;
      const pixels = [12, 3].map(hour => {
        tod = hour; env(0); render(0);
        const cell = (rows >> 1) * cols + (cols >> 1);
        return { char: CH[cell], palette: BG[cell] >> 4, depth: ZB[cell] };
      });
      return { region, pixels, glass: [CYAN, WARM], shutter: GRAY };
    });
  });
  for (const r of result) {
    assert.ok(r.glass.includes(r.pixels[0].palette), JSON.stringify(r));
    assert.ok(['=', '-'].includes(r.pixels[1].char) && r.pixels[1].palette === r.shutter, JSON.stringify(r));
    assert.ok(r.pixels.every(p => Math.abs(p.depth - 0.7) < 0.03), 'the storefront is in view');
  }
}));

test('toilet aiming uses the interior height immediately after entering, before the first room frame', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'walk'; room = null; body.z = body.vz = body.crouch = 0; body.seat = null; render(0);
    const oldEye = eye;
    enterRoom('bar', { word: 'BAR', ret: [px, py, a] }, [1.6, 5.3, Math.PI / 2]); needs.bladder = 30;
    startPee(); T += 0.05; stepPee(0.05);
    const aboveBowl = peeDrops.length > 0 && peeDrops.every(p => p.z > LOO_TOP);
    for (let k = 0; k < 140; k++) { T += 0.05; stepPee(0.05); }
    return { oldEye, aboveBowl, flushed: !pee, puddles: puddles.filter(p => p.at === placeKey()).length };
  });
  assert.equal(result.oldEye, 0.17);
  assert.ok(result.aboveBowl && result.flushed, JSON.stringify(result));
  assert.equal(result.puddles, 0);
}));

test('redesigned homes have reachable bathrooms, dining chairs and complete windows and lamps', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true;
    return ['home', 'loft', 'bellehome'].map(kind => {
      const def = ROOM_DEFS[kind]; enterRoom(kind, { ret: [41, 73, 0] }, def.entry);
      const wc = def.wc, targets = [[wc.x0 + 0.5, wc.y1 - 0.5], def.spots.shelf, def.spots.fridge, def.home.dining];
      if (def.balcony) targets.push([21.5, 11.5]);
      return {
        kind, area: room.W * room.H, reachable: targets.map(p => roomPath(...def.entry.slice(0, 2), ...p).length > 0),
        chairs: room.props.filter(p => p.seat).length, benches: room.props.filter(p => p.bench).length,
        lamps: def.lamps.every(([x, y]) => roomAt(x, y) === '.' && x > 1.3 && y > 1.3),
        windows: def.windows.every(w => w.center - w.half > 1 && w.center + w.half < (w.face === 'west' ? room.H : room.W) - 1),
      };
    });
  });
  for (const r of result) {
    assert.ok(r.reachable.every(Boolean), `${r.kind}: room and furniture access ${JSON.stringify(r)}`);
    assert.ok(r.chairs >= 3 && r.benches === 0 && r.lamps && r.windows, `${r.kind}: planned furniture and apertures`);
  }
  assert.ok(result[1].area > result[0].area * 3 && result[2].area > result[1].area);
}));

test('Belle residence survives reload, has an open balcony and district geometry draws from both sides', () => withPage(async page => {
  await page.evaluate(() => { paused = true; money = 20000; buy('home_belle'); saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    paused = true; tod = 12; env(0); const home = owned.homes[0];
    enterRoom(homeRoomKind(home.kind), { cell: [home.cell % N, Math.floor(home.cell / N)], ret: [41, 73, 0] }, [22.8, 11.2, 0]); pitch = 0;
    stepHomeBalcony();
    render(0);
    const balcony = room.def.balcony, openAir = homeBalconyActive() && roofH === homeBalconyHeight(px,py), homeFound = homeRecord(room) === home;
    const bits = belleDetails.filter(b => b.kind === 'slab' || b.kind === 'iron');
    const noMurals = BELLE_BUILDINGS.every(b => muralSeed(idx(b.x0 + 1, b.y0 + 1), b.x0 + 1, b.y0 + 1, 'N') < 0);
    mode = 'walk'; room = null;
    for (const b of BELLE_BUILDINGS.slice(0, 6)) { px = b.x0 - 1; py = b.y0 - 1; a = 0.8; pitch = 0.3; render(0); a += Math.PI; render(0); }
    return { homeFound, openAir, balcony: !!balcony, count: bits.length, noMurals, money };
  });
  assert.deepEqual(result, { homeFound: true, openAir: true, balcony: true, count: result.count, noMurals: true, money: 4000 });
  assert.ok(result.count > 50, 'real slabs and railings across the district');
}));

test('paying a driving fine leaves your car parked beside you and keeps ownership', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; money = 3000; buy('car_sedan'); const car = owned.cars[0];
    car.x = car.ex = 41; car.y = car.ey = 73; car.hx = 1; car.hy = 0; car.player = true; car.parked = false;
    me = car; px = car.x; py = car.y; mode = 'drive'; wanted.stars = 1; wanted.busted = true;
    openBusted(); bustedChoice('fine');
    const same = cars.includes(car) && owned.cars[0] === car;
    for (let k = 0; k < 100; k++) stepTraffic(0.05, T += 0.05, true);
    return { same, parked: car.parked, player: car.player, mode, position: [car.x, car.y], nearby: Math.hypot(rel(px-car.x),rel(py-car.y)) < 0.6, money };
  });
  assert.deepEqual(result, { same: true, parked: true, player: false, mode: 'walk', position: [41, 73], nearby: true, money: 1450 });
}));

test('police physically intercept a driven car and leave quietly after the fine', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;clearWanted();cars.length=0;people.length=0;footCops.length=0;evTimer=1000;
    for(let y=68;y<84;y++)for(let x=34;x<64;x++){map[idx(x,y)]=0;SHOP[idx(x,y)]=null;}
    const car=addCar({x:41,y:73,hx:1,hy:0,player:true,owned:true,parked:false,v:1});
    const cop=addCar({x:42,y:73,hx:-1,hy:0,patrol:true,kind:'police',pursuit:true,v:2,travelA:Math.PI,dest:[41,73],cruise:COP_CAR_SPEED});
    me=car;mode='drive';px=41;py=73;a=0;money=200;wanted.stars=1;wanted.seen=true;
    let overlap=false,clear=true,stopped=false;
    for(let k=0;k<160;k++){
      T+=.05;drive(.05);stepTraffic(.05,T,true);stepCrime(.05);
      overlap ||= !!carContact(cop,car);
      clear &&= carBodyClear(car.x,car.y,car.hx,car.hy)&&carBodyClear(cop.x,cop.y,cop.hx,cop.hy);
      stopped ||= wanted.busted;
    }
    const held=[cop.x,cop.y];
    for(let k=0;k<40;k++){T+=.05;stepTraffic(.05,T,true);}
    const settled=near(cop.x,cop.y,...held)<.01;
    wanted.stars=1;wanted.busted=true;openBusted();bustedChoice('fine');
    const parked=car.parked&&!car.player&&cars.includes(car)&&mode==='walk';
    px=43;py=74;let quiet=true,departed=false;
    for(let k=0;k<800&&cars.includes(cop);k++){
      T+=.05;stepCrime(.05);stepTraffic(.05,T,true);
      quiet &&= !code(cop)&&!lightsOn_(cop);overlap ||= !!carContact(cop,car);
      departed ||= near(cop.x,cop.y,...held)>1;
    }
    render(.05);
    return {overlap,clear,stopped,settled,parked,quiet,departed,money};
  });
  assert.deepEqual(result,{overlap:false,clear:true,stopped:true,settled:true,parked:true,quiet:true,departed:true,money:150});
}));

test('cruisers remember a northbound driver after losing sight at a street corner', () => withPage(async page => {
  const result=await page.evaluate(()=>{
    paused=true;clearWanted();cars.length=0;people.length=0;footCops.length=0;evTimer=1000;
    const tiles=[];
    for(let y=69;y<87;y++)for(let x=36;x<55;x++){
      const cell=idx(x,y);tiles.push([cell,map[cell],SHOP[cell]]);
      map[idx(x,y)]=(y>=72&&y<74||x>=46&&x<49)?0:3;SHOP[idx(x,y)]=null;
    }
    const car=addCar({x:47,y:73,hx:0,hy:1,player:true,v:1,travelA:Math.PI/2});
    const cop=addCar({x:42,y:73,hx:1,hy:0,patrol:true,pursuit:true,kind:'police',dest:[47,73],cruise:COP_CAR_SPEED});
    me=car;mode='drive';px=car.x;py=car.y;a=Math.PI/2;wanted.stars=1;wanted.seen=true;stepCrime(.05);
    let blind=false,ahead=false,clear=true,remembered=false;
    for(let k=0;k<150;k++){
      car.v=1;T+=.05;drive(.05);stepTraffic(.05,T,true);stepCrime(.05);
      if(!wanted.seen){blind=true;ahead ||= cop.dest[1]>wanted.lastY+.5;remembered ||= wanted.lastVY>.9;}
      clear &&= carBodyClear(cop.x,cop.y,cop.hx,cop.hy)&&!carContact(cop,car);
    }
    const result={blind,ahead,remembered,clear,followed:cop.x>46&&cop.y>74,stars:wanted.stars};
    for(const [cell,height,shop] of tiles){map[cell]=height;SHOP[cell]=shop;}
    px=41;py=73;a=0;render(.05);
    return result;
  });
  assert.deepEqual(result,{blind:true,ahead:true,remembered:true,clear:true,followed:true,stars:1});
}));

test('drift collision protects the rear bumper and chase camera stops before intervening walls', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'drive'; people.length = 0; cars.length = 0;
    for (let y = 70; y < 76; y++) for (let x = 38; x < 47; x++) map[idx(x,y)] = 0;
    map[idx(42,72)] = 3;
    const car = addCar({x:42.4,y:73.245,hx:0,hy:1,player:true,v:2}); me = car; a = Math.PI/2; px=car.x; py=car.y; car.travelA=-Math.PI/2;
    K.Space = K.KeyD = true; drive(0.05); K.Space = K.KeyD = false;
    const rear = carBodyClear(car.x,car.y,car.hx,car.hy) && car.v === 0 && car.y === 73.245;
    car.x=42.25;car.y=73.27;car.hx=Math.cos(1);car.hy=Math.sin(1);camYaw=a=1;look=0;
    const [x,y] = chaseCam(0.05);
    return { rear, cameraClear: !map[idx(Math.floor(x),Math.floor(y))], near: Math.hypot(x-car.x,y-car.y) < 0.4, y };
  });
  assert.ok(result.rear && result.cameraClear && result.near && result.y > 73, JSON.stringify(result));
}));

test('the longer Saturday fireworks show continues through midnight and finishes at 2am', () => withPage(async page => {
  const schedule = await page.evaluate(() => {
    paused=true; weather='clear'; mode='walk'; dayNum=5;
    const out=[]; for (const hour of [20.9,21,23.9]) { tod=hour; out.push(eventNow('fireworks')); }
    dayNum=6; for (const hour of [0,1.8,2]) { tod=hour; out.push(eventNow('fireworks')); }
    return out;
  });
  assert.deepEqual(schedule, [false,true,true,true,true,false]);
}));

test('officers keep chasing a circling player indoors and follow the apartment stairs onto the roof', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused=true; clearWanted(); mode='room'; room={kind:'fixture',W:10,H:10,grid:boxRoom(10,10),def:{},props:[],ret:[41,73,0]};
    px=6;py=5;wanted.stars=1;wanted.seen=true;wanted.lastX=41;wanted.lastY=73;
    let captured=false;
    for (let k=0;k<500;k++) { T+=0.02; px=5+Math.cos(T*1.8)*1.4;py=5+Math.sin(T*1.8)*1.4; if(stepCrime(0.02)==='busted'){captured=true;break;} }
    clearWanted(); roomCops.length=0; roofCops.length=0;
    const cell=Array.from(map).findIndex((h,i)=>h>1&&SHOP[i]?.kind===SHOP_APTS);
    enterRoom('apts',{cell:[cell%N,Math.floor(cell/N)],ret:[41,73,0]},[4,1.6,-Math.PI/2]);
    wanted.stars=1;wanted.seen=true;wanted.lastX=41;wanted.lastY=73;
    interact(); const entered=mode==='roof';
    T+=3.2; stepCrime(0.05);
    return {captured,entered,following:roofCops.length>0};
  });
  assert.deepEqual(result,{captured:true,entered:true,following:true});
}));

test('every mode renders without errors', async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyX'); // starts the audio engine, so every scene below runs it too
    assert.ok(await page.evaluate(() => !!actx), 'audio started on a key press');
    const scenes = {
      street: "mode = 'walk'; px = 9 * 8 + 1; py = 10 * 8 + 4; tod = 21",
      fog: "weather = 'fog'; fogAmt = 1; tod = 12",
      rain: "weather = 'rain'; fogAmt = 0; rain = 1; wet = 1",
      shore: "weather = 'clear'; rain = 0; wet = 0; px = 8 * 8 + 1; py = SHORE_S * 8 + 2.4; a = Math.PI / 2",
      bridge: 'px = BRIDGE_X[0] * 8 + 1; py = SHORE_S * 8 + 20; a = Math.PI / 2',
      underEl: 'px = EL_STATIONS[0].x; py = EL_Y + 1.88; a = 0; pitch = 0.3',
      platform: 'elUp({ s: EL_STATIONS[0], tr: 1 })',
      riding: "const t = elTrains(T)[0]; ride = { tr: t.tr, k: t.k, off: 0 }; mode = 'el'",
      siren: "mode = 'walk'; plat = ride = null; px = 9 * 8 + 1; py = 10 * 8 + 4; spawnEmergency()",
      talk: "const p = people.find(p => !p.hidden); talkTo(p)",
      taxi: "me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; setDest(5)",
      room: "leaveCar(); enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2])",
      roof: "leaveRoom(); mode = 'roof'; roofH = 5; px = 2 * 8 + 3.5; py = 2 * 8 + 3.5",
      cafe: "mode = 'walk'; enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a] }, [5, 6.3, -Math.PI / 2])",
      books: "enterRoom('books', { word: 'BOOKS', neon: GREEN, ret: [px, py, a] }, [4.5, 5, -Math.PI / 2])",
      noodle: "enterRoom('noodle', { word: 'RAMEN', neon: RED, ret: [px, py, a] }, [6, 5, -Math.PI / 2])",
      garage: "enterRoom('garage', { word: 'TIRES', neon: RED, ret: [px, py, a] }, [10.5, 8, -2.4])",
      tea: "enterRoom('tea', { word: 'MAHJONG', neon: RED, ret: [px, py, a] }, [6, 7.5, -Math.PI / 2])",
      station: "enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0])",
      sea: "leaveRoom(); mode = 'walk'; boardBoat(fleet.find(b => b.kind === 'sailboat')); sea.v = 0.5; third = true",
      helm: 'third = false; tod = 22',
      marina: "third = true; sea.v = 0; mode = 'walk'; sea = null; px = MARINA.x; py = MARINA.y0 + 1; a = Math.PI / 2; tod = 12",
    };
    for (const [name, js] of Object.entries(scenes)) {
      await page.evaluate(js);
      await page.waitForTimeout(250);
      // some text actually reached the canvas
      const lit = await page.evaluate(() => {
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
        return n;
      });
      assert.ok(lit > 50, `${name}: canvas looks blank`);
      assert.deepStrictEqual(errors, [], `${name}: ${errors.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
});

test('a night at the hotel: pay, sleep, wake at 7 in a room to a clear morning', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    const early = await page.evaluate(() => {
      enterRoom('hotel', { word: 'HOTEL', neon: MAG, ret: [px, py, a], line: 'Welcome!' }, [3.2, 3.2, -Math.PI / 2]);
      tod = 14; bookRoom(); return [money, msgText];
    });
    assert.deepStrictEqual(early, [100, '"Sorry, check-in begins at 6pm."']);
    await page.evaluate(() => { tod = 21; weather = 'rain'; rain = 1; bookRoom(); });
    await page.waitForTimeout(3600);
    const r = await page.evaluate(() => ({ money, kind: room.kind, hour: Math.floor(tod), weather, rain, sleeping: !!sleep }));
    assert.deepStrictEqual(r, { money: 60, kind: 'hotelroom', hour: 7, weather: 'clear', rain: 0, sleeping: true });
    await page.waitForTimeout(2000);
    assert.strictEqual(await page.evaluate(() => [!!sleep, fade].join()), 'false,0', 'awake, and the screen faded back in');
    assert.strictEqual(await page.evaluate(() => { leaveRoom(); return room.kind; }), 'hotel', 'the room door leads back to the lobby');
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('the pause menu stops the game and keeps its settings', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), true);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('home')).display), 'block', 'the home button, only now');
    const t0 = await page.evaluate(() => T);
    await page.waitForTimeout(400);
    assert.strictEqual(await page.evaluate(() => T), t0, 'time stands still');
    await page.click('#pause [data-detail="low"]');
    assert.strictEqual(await page.evaluate(() => FS), 15);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), false);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('home')).display), 'none', 'and gone again');
    await page.reload(); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => [settings.detail, FS].join()), 'low,15', 'remembered after a reload');
  } finally {
    await browser.close();
  }
});

test('shops: E at the counter opens the menu, number keys buy; E only leaves at the door', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.evaluate(() => enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a], line: 'Hi!' }, [5, 4.5, -Math.PI / 2]));
    await page.keyboard.press('KeyE'); // middle of the room: nothing to do, and no leaving
    assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'cafe']);
    await page.evaluate(() => { px = 4.6; py = 2.4; });
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('shop')).display), 'flex');
    await page.keyboard.press('Digit1'); // a coffee
    assert.deepStrictEqual(await page.evaluate(() => [money, inv.map(i => i.id)]), [97, ['coffee']]);
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => paused), false, 'menu closed, game running');
    await page.evaluate(() => { px = 5; py = 6.2; }); // by the door
    await page.keyboard.press('KeyE');
    assert.strictEqual(await page.evaluate(() => mode), 'walk');
    await page.waitForTimeout(200);
    assert.deepStrictEqual(await page.evaluate(() => handDrawn && handDrawn.id), 'coffee', 'the cup is in your hand');
    assert.ok(await page.evaluate(() => { // and something hand-coloured really is on screen down there (any shade of skin)
      const skin = [9, 10, 11, 12, 13, 14].map(l => PALRGB[C(SKIN, l)]), d = g.getImageData(cv.width * 0.5, cv.height * 0.6, cv.width * 0.45, cv.height * 0.4).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (skin.some(([sr, sg, sb]) => Math.abs(d[i] - sr) < 6 && Math.abs(d[i + 1] - sg) < 6 && Math.abs(d[i + 2] - sb) < 6)) n++;
      return n; }) > 50, 'the hand drawn on the canvas');
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});

// open the page, run fn(page), fail on any page error
async function withPage(fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await fn(page);
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
}

test('the arcade: a credit plays a cabinet, the game takes the screen, tickets buy prizes at the counter', () => withPage(async page => {
  await page.evaluate(() => enterRoom('arcade', { word: 'ARCADE', neon: MAG, ret: [px, py, a], line: 'Hi' }, [6, 7.6, -Math.PI / 2]));
  const cab = await page.evaluate(() => { const c = room.props.find(s => s.game && !s.busy); px = c.cx; py = c.cy + 0.8; return c.game; });
  assert.ok(cab, 'a free cabinet');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), [cab, 99]);
  for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space'); await page.waitForTimeout(50); }
  await page.keyboard.press('KeyE'); // walk away from the cabinet
  assert.deepStrictEqual(await page.evaluate(() => [game, paused]), [null, false], 'back in the arcade, no pause menu');
  await page.evaluate(() => { tickets = 25; px = room.def.keeper[0]; py = room.def.keeper[1] + 1.4; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('prizes')).display), 'flex');
  await page.keyboard.press('Digit2'); // the rubber duck, 20 tickets
  assert.deepStrictEqual(await page.evaluate(() => [tickets, heldItem().id]), [5, 'duck']);
}));

test('a work shift from the counter pays for how you did', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', neon: RED, ret: [px, py, a], line: 'Hi!' }, [6, 3, -Math.PI / 2]); px = 6; py = 2.4; });
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyJ');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'serve');
  await page.evaluate(() => { game.g.score = 10; });
  await page.keyboard.press('Escape'); // clock off early: still paid for those ten
  assert.ok(await page.evaluate(() => money) > 100);
  assert.deepStrictEqual(await page.evaluate(() => [game, room.worked, mode, paused]), [null, true, 'room', false]);
}));

test('the taxi job: J drives a taxi; a fare hails, gets in, and pays at their stop', () => withPage(async page => {
  await page.evaluate(() => { const c = cars.find(c => c.body === TAXI && !c.rider && !c.ev); c.v = 0; px = c.x + c.hy * 0.3; py = c.y - c.hx * 0.3; });
  await page.keyboard.press('KeyJ');
  assert.deepStrictEqual(await page.evaluate(() => [mode, !!job]), ['drive', true]);
  await page.evaluate(() => { const p = people.find(p => !p.hidden); p.x = me.x; p.y = me.y; job.hail = p; p.hailing = true; me.v = 0; });
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => job.ride && job.ride.p.hidden), 'picked up');
  await page.evaluate(() => { me.x = job.ride.dest[0]; me.y = job.ride.dest[1]; me.v = 0; job.ride.odo = 20; job.ride.took = 30; });
  await page.waitForTimeout(200);
  assert.deepStrictEqual(await page.evaluate(() => [job.trips, job.ride, money > 100]), [1, null, true]);
  await page.keyboard.press('KeyE'); // stopped: end the shift
  assert.deepStrictEqual(await page.evaluate(() => [mode, job]), ['walk', null]);
}));

test('vending machines sell from arm\'s reach, at an angle, even with a car at the kerb', () => withPage(async page => {
  await page.evaluate(() => { const m = machines[0], fx = -m.s * m.fs, fy = m.c * m.fs; px = m.x + fx * 0.25 + m.c * 0.08; py = m.y + fy * 0.25 + m.s * 0.08; a = Math.atan2(m.y - py, m.x - px) + 0.3; });
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Digit1');
  assert.strictEqual(await page.evaluate(() => inv.length), 1);
  // at night, a machine by a closed shop's door still says it's there (on a phone the E button comes from that line)
  const night = await page.evaluate(() => {
    closeShop(); tod = 23;
    for (const m of machines) {
      const fx = -m.s * m.fs, fy = m.c * m.fs; devAt(m.x + fx * 0.15, m.y + fy * 0.15, Math.atan2(-fy, -fx)); render(); // (a frame, for what you're looking at)
      if (lockTarget()) return [promptText(), touchActions().some(b => b[1] === 'KeyE'), touchActions().some(b => b[1] === 'KeyL')];
    }
  });
  assert.match(night[0], /^E: \w+ machine {3}.+: closed {3}L: pick the lock$/);
  assert.deepStrictEqual(night.slice(1), [true, true]);
}));

test('busted: no fine money means a cell; a minute later the guard lets you out by the police station', () => withPage(async page => {
  await page.evaluate(() => { money = 20; buy('coffee'); const c = footCops[0]; px = c.x + 0.1; py = c.y; mode = 'walk'; addWanted('hit', px, py, true); c.chase = true; });
  await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('busted')).display), 'flex', 'busted');
  await page.keyboard.press('Digit1'); // can't afford the fine: nothing happens
  assert.strictEqual(await page.evaluate(() => mode), 'walk');
  await page.keyboard.press('Digit2');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, inv.length, money, wanted.stars]), ['room', 'jail', 0, 17, 0]);
  await page.keyboard.press('KeyE'); // the one try at breaking out: back off from it
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'jailbreak');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [room && room.kind, !!game]), ['jail', false], 'still locked in, no second try');
  await page.evaluate(() => { room.until = T; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, Math.min(...SERVICES.filter(b => b.kind === 'police').map(b => Math.hypot(rel(b.x - px), rel(b.y - py)))) < 1.5]), ['walk', true], 'out, by the station');
}));

test('jailbreak: grab your things from the evidence locker on the way out and you leave with them', () => withPage(async page => {
  await page.evaluate(() => { money = 20; buy('coffee'); const c = footCops[0]; px = c.x + 0.1; py = c.y; mode = 'walk'; addWanted('hit', px, py, true); c.chase = true; });
  await page.waitForTimeout(400);
  await page.keyboard.press('Digit2');
  assert.deepStrictEqual(await page.evaluate(() => [room && room.kind, inv.length, seized.map(it => it.id)]), ['jail', 0, ['coffee']], 'taken off you and locked up');
  await page.keyboard.press('KeyE');
  // past the locker and out of the door (picking it up in the game itself: see the unit test)
  await page.evaluate(() => { game.g.hasItems = true; game.g.success = true; finishGame(); });
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'out');
  assert.deepStrictEqual(await page.evaluate(() => [inv.map(it => it.id), /your things/.test(msgText)]), [['coffee'], true]);
}));

test('stealing a car drags the driver out onto the sidewalk; the car stays where you leave it', () => withPage(async page => {
  await page.evaluate(() => { const c = cars.find(c => c.body !== TAXI && !c.ev && !c.patrol && ROAD[idx(Math.floor(c.x), Math.floor(c.y))]); c.v = 0; px = c.x + c.hy * 0.3; py = c.y - c.hx * 0.3; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'drive');
  assert.ok(await page.evaluate(() => people.some(p => !p.hidden && p.talk > 0 && Math.hypot(rel(p.x - me.x), rel(p.y - me.y)) < 1.5)), 'the driver, out and shouting');
  const at = await page.evaluate(() => { const c = me; leaveCar(); window.parked = c; return [c.x, c.y]; });
  await page.waitForTimeout(1500);
  assert.deepStrictEqual(await page.evaluate(() => [parked.x, parked.y, parked.parked]), [...at, true], 'nobody drives it away');
}));

test('on a phone: the stick walks, a drag looks round, the buttons work the menus', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }), page = await ctx.newPage();
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display), 'block');
    const cdp = await ctx.newCDPSession(page), at = (x, y) => [{ x, y, id: 1 }];
    const p0 = await page.evaluate(() => [px, py]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(120, 300) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(120, 250) });
    await page.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await page.evaluate(([x, y]) => Math.hypot(px - x, py - y), p0) > 0.1, 'walked');
    assert.strictEqual(await page.evaluate(() => K.KeyW), 0, 'and stopped on letting go');
    const a0 = await page.evaluate(() => a);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(600, 200) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(660, 200) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await page.evaluate(() => a) > a0, 'looked right');
    await page.tap('#touch button:text-is("Bag")');
    assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the bag');
    await page.tap('#touch .main:text-is("Close")');
    assert.strictEqual(await page.evaluate(() => panelOpen()), false, 'Close shuts it');
    await page.tap('#touch [data-more]');
    assert.ok(await page.isVisible('#touch .sheet button:text-is("Sound on/off")'), 'the More sheet');
    assert.ok(!(await page.isVisible('#touch .sheet button:text-is("Weather")')), 'no Weather or Fast-forward: those are Q on the globe and the watch');
    const s0 = await page.evaluate(() => soundOn);
    await page.tap('#touch .sheet button:text-is("Sound on/off")');
    assert.notStrictEqual(await page.evaluate(() => soundOn), s0, 'the button works');
    assert.ok(!(await page.isVisible('#touch .sheet')), 'and the sheet goes away');
    await page.tap('#touch [data-key="Escape"]');
    assert.strictEqual(await page.evaluate(() => paused), true);
    await page.tap('#pause [data-act="resume"]');
    assert.strictEqual(await page.evaluate(() => paused), false);
  } finally { await browser.close(); }
});

test('on a phone the buttons say what they do and only show when they apply', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    await page.goto(PAGE); await page.waitForTimeout(300);
    const pad = () => page.waitForTimeout(250).then(() => page.$$eval('#touch .pad button', bs => bs.map(b => b.textContent)));
    await page.evaluate(() => {
      // Keep the cab away from station drop-offs so it cannot arrive before the stop-button assertion.
      me = cars.find(c => c.kind === 'taxi' && stations.every(s => near(c.x,c.y,s.x,s.y-mod(s.y,8)+1)>5));
      me.rider = true; me.fare = 0; mode = 'taxi';
    });
    assert.deepStrictEqual(await pad(), ['Park', 'Across town', 'Anywhere', 'Waterfront', 'Subway', 'Camera', 'Get out']);
    await page.tap('#touch .pad button:text-is("Subway")');
    assert.ok(await page.evaluate(() => /station$/.test(me.destName)), 'a stop button picks the stop');
    assert.ok((await pad()).includes('Tip $20.00'), 'then you can tip');
    await page.evaluate(() => { leaveCar(); enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2]); });
    const inBar = await pad();
    assert.ok(inBar.includes('Jump') && !inBar.includes('Camera'), inBar.join());
  } finally { await browser.close(); }
});

test('on a phone held upright: long HUD lines wrap, and a minigame shrinks to fit then puts the text size back', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => wrapText('WASD move | mouse or arrows look | R/F up/down | shift run | space jump | C crouch / sit | E use / talk', cv.width - 24)
      .every(l => g.measureText(l).width <= cv.width - 24)), 'every line fits');
    const fs0 = await page.evaluate(() => FS);
    await page.evaluate(() => startGame('serve', 'shift', 'DINER'));
    await page.waitForTimeout(300);
    const fit = await page.evaluate(() => [cols >= 2 * game.g.W + 6, rows * FS <= innerHeight, FS]);
    assert.deepStrictEqual(fit.slice(0, 2), [true, true], `the cabinet fits across (text ${fit[2]}px)`);
    assert.ok(fit[2] < fs0, 'by making the text smaller');
    await page.evaluate(() => { game = null; });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => FS), fs0, 'and back afterwards');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('on your feet: Space jumps, a trick on the board lands with its name, C sits you on a cinema seat and walking gets you up', () => withPage(async page => {
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => body.z) > 0, 'up in the air');
  await page.waitForTimeout(800);
  assert.strictEqual(await page.evaluate(() => body.z), 0, 'and down again');
  await page.evaluate(() => { fx.skating = true; });
  await page.keyboard.down('KeyA'); await page.keyboard.press('Space'); await page.keyboard.up('KeyA');
  assert.strictEqual(await page.evaluate(() => body.trick && body.trick.name), 'kickflip');
  await page.waitForTimeout(900);
  assert.strictEqual(await page.evaluate(() => msgText), 'KICKFLIP!');
  await page.evaluate(() => { fx.skating = false; enterRoom('cinema', { word: 'CINEMA', ret: [px, py, a] }, [7, 10.5, -Math.PI / 2]); px = 4.2; py = 9.0; });
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => !!body.seat && Math.abs(py - 9.5) < 0.01), 'in the seat');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(100); await page.keyboard.up('KeyS');
  assert.strictEqual(await page.evaluate(() => body.seat), null, 'up again');
}));

test('the subway: C sits you on a bench (not on top of anybody), and you get off the train on your feet', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('train', { st: 0, opts: [1, 2, 3, 4, 5], dest: null, track: 0 }, [2, 2.5, 0.25]); });
  const r = await page.evaluate(() => {
    room.props = room.props.filter(o => o.art !== ART.sitter); // an empty car, then one rider on the bench by the door
    room.props.push(SP(3, 1.33, 0.55, 1.2, ART.sitter, () => 0, 0.3));
    px = 3.1; py = 2.2; const ok = sitDown();
    return [ok, !!body.seat, Math.abs(py - 1.3) < 0.01, Math.abs(px - 3) > 0.54, Math.abs(a - Math.PI / 2) < 0.01];
  });
  assert.deepStrictEqual(r, [true, true, true, true, true], 'next to the rider, facing across the car');
  await page.evaluate(() => { arriveAt(2); });
  assert.deepStrictEqual(await page.evaluate(() => [room.kind, body.seat]), ['station', null], 'off at the platform, standing');
}));

test('the yo-yo follows a circular mouse target with momentum and settles at the held target', () => withPage(async page => {
  const loops = await page.evaluate(async () => {
    inv.push({ id: 'yoyo', uses: 0 }); held = inv.length - 1; useHeld();
    yoyo.aimX = 0.6; yoyo.aimY = 0; // start on the circle, centered on the hand
    let n = 0, prev = yoyo.ang, t = 0;
    for (let f = 0; f < 360; f++) { // 6s of small circles, about one a second, fed in frame by frame
      const w = 2 * Math.PI * 1.2, R = 120;
      yoyoSwing(R * (Math.cos(w * (t + 1 / 60)) - Math.cos(w * t)), R * (Math.sin(w * (t + 1 / 60)) - Math.sin(w * t)));
      stepYoyo(1 / 60); t += 1 / 60;
      if (Math.abs(yoyo.ang - prev) > 3) n++; prev = yoyo.ang;
    }
    return n;
  });
  assert.ok(loops >= 2, `over the top ${loops} times`);
  const carried = await page.evaluate(() => {
    const before = yoyo.ang, speed = yoyo.angV;
    yoyo.aimX = Math.sin(before) * 0.8; yoyo.aimY = Math.cos(before) * 0.8;
    stepYoyo(1 / 60);
    return Math.abs(speed) > 0.1 && Math.abs(yoyo.ang - before) > 0.001;
  });
  assert.ok(carried, 'holding the target still retains the yo-yo momentum');
  const still = await page.evaluate(() => {
    yoyo.aimX = 0.3; yoyo.aimY = 0.7;
    for (let f = 0; f < 600; f++) stepYoyo(1 / 60);
    return [Math.abs(mod(yoyo.ang - Math.atan2(0.3, 0.7) + Math.PI, Math.PI * 2) - Math.PI), Math.abs(yoyo.len - Math.hypot(0.3, 0.7))];
  });
  assert.ok(still[0] < 0.01 && still[1] < 0.01, 'settles at the held mouse target');
}));

test('the board shows under you on a big desktop screen too; the wheels go quiet in the air', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    await page.evaluate(() => { mode = 'walk'; fx.skating = true; pitch = -1; }); // look down at the board under your feet
    await page.waitForTimeout(200);
    const cells = await page.evaluate(() => { let n = 0; for (let i = 0; i < cols * rows; i++) if (boardZ[i] < 1e9) n++; return [cols * rows > 1 << 14, n]; });
    assert.ok(cells[0] && cells[1] > 50, `more cells than the old buffer held, and the board drawn in them (${cells})`);
    const rolling = await page.evaluate(() => { K.KeyW = 1; const ground = wheelsRolling(); body.vz = 3; body.z = 0.2; const air = wheelsRolling(); body.vz = body.z = 0; K.KeyW = 0; return [ground, air]; });
    assert.deepStrictEqual(rolling, [true, false]);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('skateboard tricks by flick: each way picks its trick, and on a phone a swipe off the Ollie button pops it', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE); await page.waitForTimeout(300);
    assert.deepStrictEqual(await page.evaluate(() => [[-60, 0], [60, 0], [0, 60], [-50, 50], [50, 50], [0, -60], [3, 2]].map(([x, y]) => trickName(flickTrick(x, y)))),
      ['kickflip', 'heelflip', 'pop shuvit', '360 flip', 'varial heelflip', 'ollie', 'ollie']);
    await page.evaluate(() => { mode = 'walk'; fx.skating = true; });
    await page.waitForTimeout(300); // the pad relabels
    const swipe = (dx, dy) => page.evaluate(([dx, dy]) => {
      const b = [...document.querySelectorAll('#touch .pad button')].find(x => x.textContent === 'Ollie'), r = b.getBoundingClientRect();
      const at = (x, y) => new Touch({ identifier: 7, target: b, clientX: x, clientY: y });
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      b.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [at(x0, y0)], touches: [at(x0, y0)], bubbles: true, cancelable: true }));
      const mid = body.vz; // nothing yet: it pops when you let go
      b.dispatchEvent(new TouchEvent('touchmove', { changedTouches: [at(x0 + dx, y0 + dy)], touches: [at(x0 + dx, y0 + dy)], bubbles: true, cancelable: true }));
      b.dispatchEvent(new TouchEvent('touchend', { changedTouches: [at(x0 + dx, y0 + dy)], touches: [], bubbles: true, cancelable: true }));
      return [mid, body.trick && body.trick.name];
    }, [dx, dy]);
    assert.deepStrictEqual(await swipe(70, 0), [0, 'heelflip']);
    await page.waitForTimeout(1000);
    assert.deepStrictEqual(await swipe(0, 0), [0, 'ollie'], 'a tap is an ollie');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('roofs: step across onto the roof next door, walk off the edge and land hard; a sprinting jump is only a jump', () => withPage(async page => {
  // a roof whose neighbour to the east is about level (but not the same); one whose east side drops to the street;
  // and one across a two-cell street from a roof 4-8m lower
  const spots = await page.evaluate(() => {
    let across = null, edge = null, leap = null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = map[idx(x, y)], e = map[idx(x + 1, y)];
      if (!h || roofHeightAt(x + 0.5, y + 0.5) !== h || map[idx(x - 1, y)] !== h || map[idx(x, y - 1)] !== h || map[idx(x, y + 1)] !== h) continue;
      if (!across && e && e !== h && Math.abs(e - h) <= ROOF_STEP) across = [x, y, h, e];
      if (!edge && !e && h >= 1.4 && h <= 1.8 && ROAD[idx(x + 1, y)]) edge = [x, y, h];
      const far = map[idx(x + 3, y)];
      if (!leap && !e && !map[idx(x + 2, y)] && far && map[idx(x + 4, y)] === far && (h - far) * 10 >= 4 && (h - far) * 10 <= 8) leap = [x, y, h, far];
    }
    return { across, edge, leap };
  });
  assert.ok(spots.across && spots.edge && spots.leap, JSON.stringify(spots));
  const [x, y, h, e] = spots.across;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; room = { kind: 'store', def: { ex: 2 } }; roofLot = roofCells(x, y); px = x + 0.3; py = y + 0.5; a = 0; pitch = 0; }, [x, y, h]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  assert.deepStrictEqual(await page.evaluate(() => [mode, roofH, onRoofLot()]), ['roof', e, false], 'over on the next roof, away from the stairs');
  // to the edge, facing the street, and keep walking: there's no wall, you go over
  const [ex, ey, eh] = spots.edge;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; roofLot = roofCells(x, y); px = x + 0.6; py = y + 0.5; a = 0; refillNeeds(); }, [ex, ey, eh]);
  assert.match(await page.evaluate(() => promptText()), /edge: \d+m drop/);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'over the edge');
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => [body.z, needs.health]);
  assert.ok(r[0] === 0 && r[1] < 100 && r[1] > 0, `down, hurt but standing (${r})`);
  // A sprinting jump keeps its momentum, but falls into this two-cell street before reaching the opposite roof.
  const [lx, ly, lh] = spots.leap;
  await page.evaluate(([x, y, h]) => { mode = 'roof'; roofH = h; room = null; roofLot = roofCells(x, y); px = x + 0.85; py = y + 0.5; a = 0; refillNeeds(); body.z = body.vz = body.mx = body.my = 0; }, [lx, ly, lh]);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await page.waitForFunction(() => body.mx > 0.7 && !body.z); // establish the sprint before popping into the air
  await page.keyboard.press('Space');
  await page.waitForTimeout(250); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(2500);
  const fell = await page.evaluate(x => [mode, body.z, rel(px-x)<3 && !!ROAD[idx(Math.floor(px),Math.floor(py))]], lx);
  assert.deepStrictEqual(fell, ['walk', 0, true], 'down in the street, not across it');
  // no stairs on the roof next door: the fire escape takes you down to the sidewalk beside it
  await page.evaluate(([x, y, h, e]) => { mode = 'roof'; roofH = e; room = null; roofLot = roofCells(x, y); px = x + 1.5; py = y + 0.5; a = 0; refillNeeds(); body.z = body.vz = 0; }, spots.across);
  assert.match(await page.evaluate(() => promptText()), /E: fire escape down/);
  const up = await page.evaluate(() => [px, py]);
  await page.keyboard.press('KeyE');
  const down = await page.evaluate(([x, y]) => [mode, map[idx(Math.floor(px), Math.floor(py))], free(px, py), Math.hypot(rel(px - x), rel(py - y)) < 4], up);
  assert.deepStrictEqual(down, ['walk', 0, true, true], 'on the street beside the building, somewhere you can stand');
}));

test('camera-relative air strafing works through the real movement loop without erasing forward momentum',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;clearWanted();cars.length=0;people.length=0;footCops.length=0;refillNeeds();
    for(let y=70;y<77;y++)for(let x=38;x<46;x++)map[idx(x,y)]=0;
    const raf=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;
    const run=(yaw,forward,side)=>{
      mode='walk';room=null;me=null;px=41;py=73;a=yaw;fx.skating=false;
      Object.assign(body,{z:.05,vz:JUMP_V,mx:.8,my:0,hop:1,seat:null,ground:0,groundMode:'walk',trick:null,buf:-9});
      K.KeyW=forward;K.KeyD=side;paused=false;
      for(let n=0;n<15;n++)loop(t0+1000/60);
      paused=true;K.KeyW=K.KeyD=false;
      return {vx:body.mx,vy:body.my,x:rel(px-41),y:rel(py-73)};
    };
    try{return {side:run(0,false,true),look:run(Math.PI/2,true,false),idle:run(0,false,false)};}
    finally{paused=true;window.requestAnimationFrame=raf;}
  });
  for(const r of [result.side,result.look])assert.ok(r.vx>.79&&r.vy>.34&&r.y>.06,JSON.stringify(result));
  assert.ok(Math.abs(result.side.y-result.look.y)<.0001,'turning the camera rotates the forward wish direction');
  assert.ok(Math.abs(result.idle.vx-.8)<.0001&&result.idle.vy===0,'release the keys and keep coasting');
}));

test('bunny hops accept slightly early and late presses while held Space still requires a fresh jump',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;mode='walk';px=41;py=73;refillNeeds();fx.skating=false;body.seat=null;
    Object.assign(body,{z:.002,vz:-.5,peak:.6,mx:.5,my:0,hop:1,buf:T-.18,lx:px-.01,ly:py,trick:null,ground:0,groundMode:'walk'});
    stepBody(.01);const early=body.vz===JUMP_V&&body.hop>1;
    body.z=body.vz=0;body.hop=1;body.landedAt=T-.14;jump();const late=body.hop>1;
    body.z=body.vz=0;body.hop=1;body.landedAt=T-.18;jump();const expired=body.hop===1;
    body.z=.002;body.vz=-.5;body.buf=-9;body.peak=.6;K.Space=true;stepBody(.01);K.Space=false;
    return {early,late,expired,held:body.vz===0};
  });
  assert.deepEqual(result,{early:true,late:true,expired:true,held:true});
}));

test('indexed winter branches preserve their silhouettes, crossings and snow from close up to distant views',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;render(0);snowCover=.7;
    const reference=(u,z,du,dz,t)=>{
      const height=TREE_SIZE[t.kind][1],pixel=Math.max(du*.42,dz*.4),warp=.92+t.seed*.16;
      let slope=null;
      for(const [ax,z0,bx,z1,thickness] of TREE_WINTER_BRANCHES[t.kind]) {
        const x0=ax*warp,x1=bx*warp,width=Math.max(.0045*thickness,pixel);
        if(z<z0-width||z>z1+width||u<Math.min(x0,x1)-width||u>Math.max(x0,x1)+width)continue;
        const dx=x1-x0,dy=z1-z0,along=clamp(((u-x0)*dx+(z-z0)*dy)/(dx*dx+dy*dy),0,1);
        if((u-x0-dx*along)**2+(z-z0-dy*along)**2<width*width){slope=dy/(dx||.0001);break;}
      }
      if(slope===null)return null;
      const snowy=z>height*.55&&Math.abs(slope)<1.8&&hash(Math.floor(u*90+t.seed*99),Math.floor(z*90),816)>.68;
      const ch=snowy?'-':Math.abs(slope)>1.8?'|':Math.abs(slope)<.28?'-':slope>0?'/':'\\';
      const col=C(snowy?WHITE:t.kind==='birch'?WHITE:BRICK,snowy?12:clamp(6+10*.45,6,13));
      return [ch,col];
    };
    let tested=0,errors=0;
    for(const kind of Object.keys(TREE_WINTER_BRANCHES))for(const seed of [.05,.8])for(const du of [.003,.059,.12]) {
      const t={kind,seed},[half,height]=TREE_SIZE[kind];
      for(let row=0;row<=WINTER_BRANCH_ROWS;row++)for(const offset of [-1e-8,0,1e-8])for(let col=0;col<90;col++){
        const u=-half-.03+(half*2+.06)*(col+.5)/90,z=row*height/WINTER_BRANCH_ROWS+offset;
        const expected=reference(u,z,du,du*.6,t),drawn=winterTreeCell(0,u,z,du,du*.6,10,t);
        if(drawn!==!!expected||expected&&(CH[0]!==expected[0]||COL[0]!==expected[1]))errors++;
        tested++;
      }
    }
    return {tested,errors};
  });
  assert.ok(result.tested>50000);
  assert.equal(result.errors,0,JSON.stringify(result));
}));

test('snow rendering skips lamp-pool work by daylight but retains it at night',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;mode='walk';render(0);snowCover=1;const saved=glow;let calls=0;
    glow=()=>{calls++;return .8;};
    try {
      lampsOn=0;paintSettledSnow(0,41,73,10);const daylight=calls;
      lampsOn=1;paintSettledSnow(0,41,73,10);return{daylight,night:calls-daylight};
    }finally{glow=saved;}
  });
  assert.equal(result.daylight,0);
  assert.equal(result.night,1);
}));

test('covered streets stay free of snow and the Shotengai glass has no yellow roof lamps',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    paused=true;tod=12;weather='clear';mode='walk';env(0);render(0);
    const sample=(wx,wy)=>{
      const row=hor+10,d=eye*projY/(row-hor+.5);
      floorCell(0,row,0,(wx-px)/d,(wy-py)/d);
      return [CH[0],BG[0],COL[0]];
    };
    const el=[41,EL_Y+1];snowCover=0;const bare=sample(...el);snowCover=1;const covered=sample(...el);
    const road=Array.from(ROAD).findIndex((r,k)=>r===1&&districtAt(k%N,Math.floor(k/N))==='shotengai');
    const bx=Math.floor((road%N)/8)*8,wy=Math.floor(road/N)+.54;
    const roof=arcadeRoofPart(bx+.5,wy);
    const lamp=lamps.find(l=>arcadeAt(l.x,l.y)),B=drawBox;let high=0;
    try{drawBox=b=>{high=Math.max(high,b.z1);};drawLamp3D(2,0,lamp.ax,lamp.ay,lamp.top);}finally{drawBox=B;}
    const balcony=ARCH_DETAILS.find(o=>o.kind==='balcony-slab'&&!snowExposed(o.x,o.y,o.z1));
    return {bare,covered,roof,lampFits:high<ARCADE_Z,balconySheltered:!snowExposed(balcony.x,balcony.y,balcony.z1),deckExposed:snowExposed(...el,EL_TOP+.05)};
  });
  assert.deepEqual(result.covered,result.bare,'the elevated deck leaves its ground shading and characters untouched by snow');
  assert.equal(result.roof,null,'former yellow lamp locations are clear glass');
  assert.ok(result.lampFits&&result.balconySheltered&&result.deckExposed,JSON.stringify(result));
}));

test('bunny hopping: land and go straight back up and each hop is faster; stop and it is gone', () => withPage(async page => {
  const r = await page.evaluate(() => {
    refillNeeds();
    // Frame by frame: keep moving and press jump just before landing, with or without air strafing.
    const go = (frames, { space = 1, strafe = 0 } = {}) => { K.KeyW = 1; K.Space = space; K.KeyD = strafe ? 1 : 0;
      for (let i = 0; i < frames; i++) {
        T += 1 / 60; if (strafe) a += 0.02; px += 0.01;
        if (space && (!body.z || body.vz < 0 && body.z < 0.2)) jump();
        stepBody(1 / 60);
      }
      K.KeyW = K.Space = K.KeyD = 0; return body.hop; };
    body.hop = 1; body.z = body.vz = 0;
    const hopped = go(180), capped = go(1200);
    go(60, { space: 0 }); const after = [body.z, body.hop];
    body.hop = 1; const plain = go(180); body.z = body.vz = 0; body.hop = 1; const strafed = go(180, { strafe: 1 });
    return { hopped, capped, after, plain, strafed };
  });
  assert.ok(r.hopped > 1.1, `faster for every hop (${r.hopped})`);
  assert.strictEqual(r.capped, 1.9, 'up to a cap');
  assert.deepStrictEqual(r.after, [0, 1], 'on the ground a moment and it bleeds away');
  assert.ok(r.strafed > r.plain, `strafing into the turn builds it quicker (${r.plain} vs ${r.strafed})`);
}));

test('parked cars are solid on foot; you can still get in', () => withPage(async page => {
  const r = await page.evaluate(() => {
    let l = null; // a lane with room to walk up to it from the road side
    for (let i = 0; i < 400 && !l; i++) { const q = laneNear(8 + (i % 20) * 8 + 4.5, 8 + Math.floor(i / 20) * 8 + 4.5);
      if ([0, 0.3, -0.3].every(k => free(q.x + q.hy * k, q.y - q.hx * k)) && [0.3, -0.3].some(k => free(q.x + q.hy * 0.3 + q.hx * k, q.y - q.hx * 0.3 + q.hy * k))) l = q; }
    spawnOwnedCar('sedan' in CAR_MODELS ? 'sedan' : Object.keys(CAR_MODELS)[0], l.x, l.y, l.hx, l.hy, true);
    const c = cars.find(c => c.owned);
    const into = free(c.ex, c.ey), sd = [1, -1].find(k => free(c.ex + c.hy * 0.3 * k, c.ey - c.hx * 0.3 * k)), side = !!sd; // (the road side of it)
    px = c.ex + c.hy * 0.3 * sd; py = c.ey - c.hx * 0.3 * sd;
    for (let i = 0; i < 60; i++) move(-c.hy * 0.02 * sd, c.hx * 0.02 * sd); // walk straight at it
    const d = Math.hypot(rel(px - c.ex), rel(py - c.ey));
    interact();
    return [into, side, d > 0.1, mode];
  });
  assert.deepStrictEqual(r, [false, true, true, 'drive'], 'blocked by the car, beside it is fine, and E still gets you in');
}));

test('a fetch favour: buy what they asked for and handing it over takes it out of your bag', () => withPage(async page => {
  const r = await page.evaluate(() => {
    money = 100; inv.length = 0;
    const p = people.find(p => !p.hidden), v = vendors[0];
    task = { kind: 'fetch', who: p, type: v.type, want: VENDOR_STOCK[v.type.name][0], until: T + 240, ask: '' };
    const before = fetchHave();
    inv.push({ id: VENDOR_STOCK[v.type.name][0], uses: 1 }, { id: 'yoyo', uses: 0 }); held = 1;
    const has = fetchHave(), m0 = money;
    talkTo(p);
    return [before, has, task, inv.map(it => it.id), held, money > m0];
  });
  assert.deepStrictEqual(r, [false, true, null, ['yoyo'], 0, true], 'gone from your bag, still holding the yo-yo, and paid');
}));

test('a car comes with its keys: Q with them in hand brings it round to the kerb by you', () => withPage(async page => {
  const r = await page.evaluate(() => {
    money = 5000; inv.length = 0; held = -1;
    const [ok, line] = buy('car_sedan');
    const c = owned.cars[owned.cars.length - 1], k = inv.findIndex(it => it.id === 'key_car_sedan');
    // off a few blocks: somewhere on foot on a street
    let spot = null;
    for (let i = 0; i < 400 && !spot; i++) { const x = mod(c.x + 24 + (i % 20) * 8 + 0.15, N), y = mod(c.y + 24 + Math.floor(i / 20) * 8 + 4.5, N); if (free(x, y)) spot = [x, y]; }
    [px, py] = spot; held = k;
    const far = Math.hypot(rel(c.x - px), rel(c.y - py));
    useHeldItem();
    const near = Math.hypot(rel(c.x - px), rel(c.y - py));
    return { ok, keys: /keys/.test(line), k, far: far > 10, near: near < 2, parked: c.parked, line: msgText, sell: sellPrice(inv[k], 0.4) };
  });
  assert.deepStrictEqual(r, { ok: true, keys: true, k: 0, far: true, near: true, parked: true, line: r.line, sell: 0 }, JSON.stringify(r));
  assert.match(r.line, /rolls up at the kerb/);
  // indoors it can't hear you
  const inside = await page.evaluate(() => { enterRoom('cinema', { word: 'CINEMA', ret: [px, py, a] }, [7, 10.5, -Math.PI / 2]); useHeldItem(); return msgText; });
  assert.match(inside, /No signal in here/);
}));

test('the crowd at the pier fair wanders about, and you can talk to them', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const f = fairFolk.find(f => !f.queue), x0 = f.x, y0 = f.y;
    px = FAIR.cx; py = FAIR.y0 + 0.5; // (on the pier, so they're stepped)
    f.wait = 0; for (let i = 0; i < 600; i++) stepFairFolk(1 / 30);
    const moved = Math.hypot(f.x - x0, f.y - y0) > 0.1, clear = fairFolk.every(q => q.queue || !fairBlocked(q.x, q.y, 0.05));
    // stand just in front of one, facing them
    mode = 'walk'; px = f.x - 0.3; py = f.y; a = 0; fx.stink = 0;
    const prompt = promptText(), who = nearPerson(); interact(); // (whoever's nearest in front: another of them may have wandered in)
    return { moved, clear, prompt, said: msgText, stopped: !!who && who.fair && who.talk > 0 };
  });
  assert.ok(r.moved && r.clear, `off for a wander, never through the stalls (${JSON.stringify(r)})`);
  assert.match(r.prompt, /E: talk/);
  assert.ok(r.said.startsWith('"') && r.stopped, `they answer and stop to chat (${r.said})`);
}));

test('run dry and you pass out: the hospital, a bill, and the nurse patches you up; dev tools fill you up', () => withPage(async page => {
  await page.evaluate(() => { money = 500; needs.food = 0; needs.drink = 0; needs.health = 0.05; });
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [mode, room && room.kind, money, needs.health]), ['room', 'hospital', 420, 100]);
  assert.match(await page.evaluate(() => msgText), /hospital bed.*Dehydration.*\$80/);
  await page.evaluate(() => { needs.health = 40; const [kx, ky] = room.def.keeper; px = kx; py = ky + 1.2; a = -Math.PI / 2; });
  assert.match(await page.evaluate(() => promptText()), /patched up/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [needs.health, money]), [100, 395]);
  await page.evaluate(() => { needs.food = 5; needs.drink = 5; });
  await page.keyboard.press('F2'); await page.click('#dev [data-tab="other"]');
  await page.evaluate(() => [...document.querySelectorAll('#dev [data-dev]')].find(b => b.textContent.startsWith('Fill food')).click());
  assert.deepStrictEqual(await page.evaluate(() => [needs.food, needs.drink, needs.health]), [100, 100, 100]);
}));

test('P to pee, any time: aimed where you look (your view stays put), falls under gravity, a yellow puddle that dries up; Esc still pauses', () => withPage(async page => {
  await page.evaluate(() => { needs.bladder = 2; people.forEach(m => m.hidden = true); });
  await page.keyboard.press('KeyP'); // nothing in you: a short one all the same
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, paused]), [true, false]);
  await page.waitForTimeout(2500);
  assert.strictEqual(await page.evaluate(() => !!pee), false, 'over quickly');
  await page.evaluate(() => { needs.bladder = 90; for (const q of puddles) q.life = 0; pitch = 0; });
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => [!!pee, peeDrops.length > 5, puddles.length > 0, pitch, needs.bladder < 90]);
  assert.deepStrictEqual(r, [true, true, true, 0, true], 'peeing: drops in the air, a puddle, and the view left alone');
  // look down, then up: it goes further when you aim higher, and comes back down to the ground either way
  const reach = () => page.evaluate(() => Math.max(...peeDrops.filter(p => !p.splash).map(p => Math.hypot(rel(p.x - px), rel(p.y - py)))));
  await page.evaluate(() => { pitch = -0.4; }); await page.waitForTimeout(900);
  const low = await reach();
  await page.evaluate(() => { pitch = 0.4; for (const q of puddles) q.life = 0; stepPee(0); }); await page.waitForTimeout(1200);
  const high = await reach();
  assert.ok(high > low * 1.2, `further aimed up (${low.toFixed(3)} -> ${high.toFixed(3)})`);
  assert.deepStrictEqual(await page.evaluate(() => [puddles.length > 0, puddles.every(q => q.z === 0)]), [true, true], 'and it still lands');
  await page.keyboard.press('KeyP'); // cut it off
  await page.waitForTimeout(2000); // (what's still in the air comes down)
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, peeDrops.length]), [false, 0]);
  await page.evaluate(() => { for (const q of puddles) q.life = 0.01; stepPee(5); });
  assert.strictEqual(await page.evaluate(() => puddles.length), 0, 'dried up');
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.evaluate(() => paused), true);
}));

test('toilets: in a bar it goes in the bowl and you flush; on a diner floor you are thrown out; a cop who sees you in the street nicks you', () => withPage(async page => {
  await page.evaluate(() => { tod = 20; needs.bladder = 30; enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [1.6, 5.3, Math.PI / 2]); });
  await page.keyboard.press('KeyP');
  assert.deepStrictEqual(await page.evaluate(() => [!!(pee && pee.loo), msgText]), [true, 'You use the toilet.']);
  await page.waitForFunction(() => !pee, null, { timeout: 30000 }); // (game time: slower than the clock on a busy machine)
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, puddles.filter(q => q.at === placeKey()).length, msgText]), [false, 0, 'You flush. Very civilised.']);
  // walked in some way other than the front door (no greeting set): the barman still has a line, never "undefined"
  assert.ok(await page.evaluate(() => { px = 6; py = 2.4; a = -Math.PI / 2; return typeof room.line === 'string' && !promptText().includes('undefined'); }));
  // the bathroom's its own room, walls round it: miss the bowl in there and that's your business
  assert.deepStrictEqual(await page.evaluate(() => [ROOMW.cell(3, 5) > 0, ROOMW.cell(2, 4), inWc(1.6, 6.4), inWc(6, 3)]), [true, 0, true, false], 'a wall, a doorway, the toilet inside, the bar outside');
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', ret: [px, py, a] }, [2.5, 2.6, 0]); needs.bladder = 60; });
  await page.keyboard.press('KeyP');
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, !!(pee && pee.loo), msgText]), [true, false, 'Not quite the toilet, but close enough.']);
  await page.waitForFunction(() => !pee, null, { timeout: 30000 });
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'diner'], 'still in the diner');
  // the diner, out in the middle of the floor
  await page.evaluate(() => { enterRoom('diner', { word: 'DINER', ret: [px, py, a] }, [8.5, 5, Math.PI / 2]); needs.bladder = 50; });
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => mode === 'walk', null, { timeout: 15000 }); // (game time: slower than the clock on a busy machine)
  assert.deepStrictEqual(await page.evaluate(() => [mode, !!pee]), ['walk', false]);
  assert.match(await page.evaluate(() => msgText), /thrown out/);
  // the street: nobody about, nothing happens; a cop right there, you're wanted
  await page.evaluate(() => { for (const c of cars) if (c.patrol) c.x = mod(px + 80, N); for (const c of footCops) c.x = mod(px + 80, N); people.forEach(m => m.hidden = true); needs.bladder = 50; });
  await page.keyboard.press('KeyP'); await page.waitForTimeout(1500);
  assert.deepStrictEqual(await page.evaluate(() => [!!pee, wanted.stars]), [true, 0]);
  await page.keyboard.press('KeyP');
  await page.evaluate(() => { footCops[0].x = px + 0.3; footCops[0].y = py; footCops[0].chase = false; });
  await page.keyboard.press('KeyP'); await page.waitForFunction(() => wanted.stars > 0, null, { timeout: 15000 });
  assert.deepStrictEqual(await page.evaluate(() => [wanted.stars, wanted.crime]), [1, 'public urination']);
}));

test('a portapotty on a building site: E at its door, P in the bowl, E back out the door', () => withPage(async page => {
  await page.evaluate(() => { const o = potties[0]; px = o.x - o.hl - 0.06; py = o.y; a = 0; needs.bladder = 40; });
  await page.waitForTimeout(100);
  assert.deepStrictEqual(await page.evaluate(() => [blockKind(Math.floor(px / 8), Math.floor(py / 8)), promptText()]), ['construction', 'E: use the portapotty']);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, promptText()]), ['room', 'potty', 'P: use the toilet']);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => !!(pee && pee.loo)));
  await page.keyboard.press('KeyP');
  await page.evaluate(() => { py = 2.85; a = Math.PI / 2; });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk');
}));

test('the pause menu on a narrow phone: scrolls down, never sideways', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
    await page.goto(PAGE); await page.waitForTimeout(300);
    await page.evaluate(() => togglePause()); await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const pn = document.querySelector('#pause .panel');
      return [pn.scrollWidth <= pn.clientWidth, pn.scrollHeight > pn.clientHeight, [...pn.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).length];
    });
    assert.deepStrictEqual(r, [true, true, 0]);
  } finally { await browser.close(); }
});

test('the Botanical Gardens at night: the dev jump lands you outside the locked gate and you can walk away; the gate still keeps you out', () => withPage(async page => {
  await page.evaluate(() => { tod = 23; devPlaces().find(([g, l]) => l === 'Botanical Gardens')[2](); });
  const at = await page.evaluate(() => [px, py]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW'); // toward the gate
  assert.deepStrictEqual(await page.evaluate(() => [inGardens(px, py), promptText()]), [false, 'The gates are locked. The Gardens open at 8.']);
  await page.evaluate(() => { a = -Math.PI / 2; }); // and back the way you came
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(([x, y]) => py < y - 0.1, at), 'walked away');
}));

test('the duck pond on the pier: $1 at the booth, hook a duck, its tickets count', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; money = 10; const b = BOOTHS.find(o => o.word === 'DUCK POND'); devAt(b.at[0], b.at[1], Math.PI); });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: play DUCK POND ($1.00 a go)');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['ducks', 9]);
  const want = await page.evaluate(() => { const g = game.g; for (let k = 0; k < 2000 && !g.under(); k++) g.step(1 / 60, {}); const w = g.under().worth; g.step(1 / 60, { actP: 1 }); return w; }); // (dipped the moment one's under it)
  await page.waitForFunction(() => game.g.score > 0, null, { timeout: 10000 });
  assert.strictEqual(await page.evaluate(() => game.g.score), want);
}));

test('balloon darts on the pier: $1 at the booth, a dart on a balloon pops it', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; money = 10; const b = BOOTHS.find(o => o.word === 'DARTS'); devAt(b.at[0], b.at[1], 0); });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: play BALLOON DARTS ($1.00 a go)');
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['darts', 9]);
  await page.evaluate(() => { const g = game.g; for (let k = 0; k < 3000 && !g.hitAt(...g.aim().map(Math.round)); k++) g.step(1 / 60, {}); g.step(1 / 60, { actP: 1 }); }); // (thrown the moment it's on one: the reticle won't wait)
  await page.waitForFunction(() => game.g.score > 0 || game.g.balloons.some(b => b.popped), null, { timeout: 10000 });
  assert.ok(await page.evaluate(() => game.g.balloons.filter(b => b.popped).length === 1 && game.g.score >= 3));
}));

test('the night market: tarped by day, a stall to buy from at night; Q on the globe turns the sky, Q held on the watch hurries time', () => withPage(async page => {
  await page.evaluate(() => { tod = 13; money = 500; inv.length = 0; cars.length = 0; const s = STALLS[2]; devAt(s.at[0], s.at[1], Math.PI / 2); }); // random traffic must not take the stall's interaction prompt
  assert.match(await page.evaluate(() => promptText()), /under a tarp/);
  const w = await page.evaluate(() => weather);
  await page.keyboard.down('KeyT'); await page.keyboard.press('KeyY');
  await page.waitForTimeout(500); await page.keyboard.up('KeyT');
  assert.ok(await page.evaluate(() => tod < 13.2) && await page.evaluate(() => weather) === w, 'T and Y do nothing now');
  await page.evaluate(() => { tod = 21; });
  assert.strictEqual(await page.evaluate(() => promptText()), 'E: CURIOS stall');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Digit4'); // the snow globe
  assert.deepStrictEqual(await page.evaluate(() => [inv.some(it => it.id === 'cityglobe'), money]), [true, 150]);
  await page.keyboard.press('Escape');
  const w0 = await page.evaluate(() => { held = inv.findIndex(it => it.id === 'cityglobe'); return weather; });
  await page.keyboard.press('KeyQ');
  assert.notStrictEqual(await page.evaluate(() => weather), w0, 'the globe changes the sky');
  await page.evaluate(() => { inv.push({ id: 'pocketwatch', uses: 0 }); held = inv.length - 1; tod = 12; });
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => tod > 12.5, null, { timeout: 15000 }); // (game time: without the watch this would take 10s of play)
  await page.keyboard.up('KeyQ');
  assert.ok(await page.evaluate(() => tod > 12.5), 'the watch hurries the hours');
}));

test('the museum by day: $10 in, plaques to read, the gift shop; by night a heist: a guard\'s torch catches you, or you crack a case and the silent alarm runs out', () => withPage(async page => {
  const day = await page.evaluate(() => {
    tod = 14; money = 100;
    const sh = MUSEUM.sh; lookHit = { d: 0.2, mx: MUSEUM.bx * 8 + 4, my: MUSEUM.by * 8 + 2 }; px = MUSEUM.bx * 8 + 4.5; py = MUSEUM.by * 8 + 1.7; a = Math.PI / 2;
    interact();
    const inside = [mode, room.kind, money];
    px = 12.5; py = 13.3; const dino = promptText();
    px = CASES[1].x; py = CASES[1].y + 1; const orrery = promptText(); interact(); const plaque = msgText;
    return [...inside, dino, orrery, plaque, stockFor('museum', 'MUSEUM')];
  });
  assert.deepStrictEqual(day.slice(0, 3), ['room', 'museum', 90]);
  assert.strictEqual(day[3], 'E: read the plaque'); assert.strictEqual(day[4], 'E: read the plaque');
  assert.match(day[5], /EQUINOX ORRERY/); assert.deepStrictEqual(day[6], ['postcard', 'dinotoy', 'replicastar']);
  // by night: in the gem room, stood in a guard's beam: spotted, alarm, three stars
  const caught = await page.evaluate(() => {
    leaveRoom(); clearWanted(); tod = 23;
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 10.5, -Math.PI / 2]);
    const g = room.props.find(q => q.guard && q.tick); g.tick(g); px = g.x + Math.cos(g.dir) * 1.5; py = g.y + Math.sin(g.dir) * 1.5;
    const lit = inBeam(g, px, py) > 0;
    for (const q of room.props) if (q.tick) q.tick = null; // (hold everyone still)
    for (let k = 0; k < 90; k++) stepMuseum(1 / 60);
    return [lit, room.alarm, wanted.stars];
  });
  assert.deepStrictEqual(caught, [true, true, 3]);
  // the beam lights the wall it reaches, not one too far off, and you cast a shadow on it standing in the way
  const walls = await page.evaluate(() => {
    leaveRoom(); clearWanted();
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 16, -Math.PI / 2]);
    const [g, g2] = room.props.filter(q => q.guard); g.tick = g2.tick = null; Object.assign(g, { x: 21.5, y: 12.5, dir: 0 }); Object.assign(g2, { x: 3.5, y: 2, dir: Math.PI });
    const near = torchAt(25, 12.5, 0.6), high = torchAt(25, 12.5, 3.5);
    g.x = 19.5; const far = torchAt(25, 12.5, 0.6); g.x = 21.5;
    px = 23; py = 12.5; const shaded = torchAt(25, 12.5, 0.6), beside = torchAt(25, 13.4, 0.6);
    return [near > 0.3, high, far, shaded, beside > 0];
  });
  assert.deepStrictEqual(walls, [true, 0, 0, 0, true]);
  // again, out of sight: crack the orrery's case, take it, the silent alarm counts down
  const heist = await page.evaluate(() => {
    leaveRoom(); clearWanted(); museumStolen = {}; inv.length = 0;
    enterRoom('museum', { ...MUSEUM.sh, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [12.5, 10.5, -Math.PI / 2]);
    for (const q of room.props) if (q.guard) { q.tick = null; q.x = 3.5; q.y = 15; q.dir = Math.PI; } // (both guards off in the far corner, facing away)
    px = CASES[1].x; py = CASES[1].y + 1;
    const prompt = promptText(); interact(); const g = game && game.g.id; game.onDone(true); game = null;
    const got = [inv.some(it => it.id === 'orrery'), museumStolen.orrery, !!room.alarm];
    T = room.silent + 1; stepMuseum(0.016);
    return [prompt, g, ...got, room.alarm, wanted.stars];
  });
  assert.deepStrictEqual(heist, ['E: crack the case (Equinox Orrery)', 'lockpick', true, true, false, true, 3]);
}));

test('the night market\'s fortune teller and goldfish tub: five stalls, a reading for $5, a net for $2', () => withPage(async page => {
  await page.evaluate(() => {
    tod = 22; money = 20; cars.length = 0; // passing traffic must not replace the stall interaction
    const s = STALLS[3]; devAt(s.at[0], s.at[1], Math.PI / 2);
  });
  assert.match(await page.evaluate(() => promptText()), /fortune told/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [money, /She turns/.test(msgText)]), [15, true]);
  await page.evaluate(() => { const s = STALLS[4]; devAt(s.at[0], s.at[1], Math.PI / 2); });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, money]), ['goldfish', 13]);
}));

test('the Velvet Rope: cocktail tables and chairs, punters in them, and you can talk to one', () => withPage(async page => {
  await page.evaluate(() => { tod = 23; enterRoom('stripclub', { ...CLUB.sh, ret: [px, py, a], line: '' }, [9, 12.4, -Math.PI / 2]); });
  const r = await page.evaluate(() => {
    const seated = room.props.filter(s => s.art === ART.sitterBack), tables = room.props.filter(s => s.box && s.box.z0 > 0.6 && s.box.z1 < 0.8);
    const p = seated[0]; px = p.x; py = p.y + 0.9; a = -Math.PI / 2; // behind them, facing the stage
    return [seated.length, tables.length, promptText()];
  });
  assert.ok(r[0] >= 1 && r[1] === 5, `punters and tables (${r})`); // (how many come in is random)
  assert.strictEqual(r[2], 'E: talk');
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => ROOM_TALK.stripclub.some(l => msgText === `"${l}"`) || /^"/.test(msgText)), 'they say something');
}));

test('where you were is saved: you come back to the same spot on the street, and inside a shop to its door', () => withPage(async page => {
  const spot = await page.evaluate(() => { gotoShop('BAKERY'); saveGame(); return [px, py, a]; });
  await page.reload(); await page.waitForTimeout(300);
  const back = await page.evaluate(() => [px, py, a, mode]);
  assert.deepStrictEqual(back.map(v => typeof v === 'number' ? +v.toFixed(3) : v), [...spot.map(v => +v.toFixed(3)), 'walk']);
  await page.evaluate(() => { enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2]); saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [+px.toFixed(3), +py.toFixed(3), mode]), [+spot[0].toFixed(3), +spot[1].toFixed(3), 'walk']);
}));

test('buy a car and a home: both are still yours after a reload, and the building door takes you home to your own bed', () => withPage(async page => {
  await page.evaluate(() => { money = 5000; buy('car_sedan'); buy('home_studio'); saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [owned.cars.length, owned.homes.length, money]), [1, 1, 1000]);
  // stand on the sidewalk in front of the building, facing it, and press E
  const ok = await page.evaluate(() => {
    const sh = SHOP[owned.homes[0].cell];
    for (let i = 0; i < N * N; i++) {
      if (SHOP[i] !== sh || !map[i]) continue;
      const x = i % N, y = Math.floor(i / N);
      for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!map[idx(x + ox, y + oy)]) {
        px = x + 0.5 + ox * 0.75; py = y + 0.5 + oy * 0.75; a = Math.atan2(-oy, -ox); mode = 'walk';
        for (const p of people) { p.x = mod(px + 60, N); p.path = []; } for (const c of cars) if (!c.owned) { c.x = mod(px + 60, N); c.ex = c.x; } return true; // (nobody to talk to, no car to take instead)
      }
    }
    return false;
  });
  assert.ok(ok, 'found the door');
  await page.waitForTimeout(100);
  const pr = await page.evaluate(() => promptText() + ' | ' + (lookHit && lookHit.d) + ' | ' + msgText);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => room && room.kind), 'home', pr);
  await page.evaluate(() => { [px, py] = room.def.spots.bed; py += 1; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2000);
  assert.deepStrictEqual(await page.evaluate(() => [room.kind, Math.floor(tod)]), ['home', 7], 'woke at home at 7');
}));

test('the Sunset Pier: once round the Ferris wheel and back to the platform, a horse on the carousel, a go at ring toss', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; px = WHEEL_BOARD.x; py = WHEEL_BOARD.y; a = Math.PI / 2; });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /ride the Ferris wheel/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, money]), ['fair', 95]);
  await page.evaluate(() => { T = fairRide.end - WHEEL.rev / 2; });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => fairEye > WHEEL.hub + WHEEL.R * 0.9), 'at the top');
  await page.evaluate(() => { T = fairRide.end - 0.05; });
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => [mode, Math.hypot(px - WHEEL_BOARD.x, py - WHEEL_BOARD.y) < 0.3]), ['walk', true], 'off at the bottom');
  await page.evaluate(() => { px = CAROUSEL.x; py = CAROUSEL.y - CAROUSEL.r - 0.2; });
  await page.keyboard.press('KeyE');
  const p0 = await page.evaluate(() => [px, py]);
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(([x, y]) => mode === 'fair' && Math.hypot(px - x, py - y) > 0.05, p0), 'going round');
  await page.evaluate(() => { T = fairRide.end; });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => mode === 'walk' && !fairBlocked(px, py)), 'off, beside it');
  await page.evaluate(() => { px = BOOTHS[0].at[0]; py = BOOTHS[0].at[1]; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'ringtoss');
  await page.evaluate(() => { tod = 4; game = null; px = WHEEL_BOARD.x; py = WHEEL_BOARD.y; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'the rides are shut at 4am');
}));

test('the laundromat: a load at the back wall, done in its time; clean clothes lose the police if they cannot see you', () => withPage(async page => {
  await page.evaluate(() => { tod = 3; enterRoom('laundry', { word: 'LAUNDRY', neon: CYAN, ret: [px, py, a], cell: [10, 10] }, [4, 1.6, -Math.PI / 2]); });
  assert.match(await page.evaluate(() => promptText()), /run a wash/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [!!wash, money]), [true, 97]);
  await page.keyboard.press('KeyE');
  assert.match(await page.evaluate(() => msgText), /Still spinning/);
  const cleaned = await page.evaluate(() => {
    T = wash.done + 0.1; wanted.stars = 2; wanted.seen = false;
    interact(); // collect while unseen, before an unrelated frame can start a police search
    return [wash, wanted.stars, fx.fresh > 0];
  });
  assert.deepStrictEqual(cleaned, [null, 0, true]);
}));

test('the aquarium: admission at the door, fish in every kind of tank, a touch pool, a gift shop; fish in the windows outside', () => withPage(async page => {
  const glyphs = () => page.evaluate(() => CH.join(''));
  await page.evaluate(() => { tod = 12; weather = 'clear'; cars.length = 0; px = AQUARIUM.doorU + 0.3; py = AQUARIUM.by * 8 + 9.2; a = -Math.PI / 2; pitch = 0; }); // admission without a random car taking the interaction prompt
  await page.waitForTimeout(300);
  assert.match(await glyphs(), /><|<>|=o>|<o=/, 'fish in the windows');
  await page.evaluate(() => { px = AQUARIUM.doorU; py = AQUARIUM.by * 8 + 8.25; });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /enter AQUARIUM \(\$8\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money]), ['room', 'aquarium', 92]);
  for (const [name, at] of [['ocean', [12, 3.6, -Math.PI / 2]], ['reef', [20.4, 7.5, 0]], ['jelly', [3.4, 7.5, Math.PI]], ['kelp', [18.5, 5.5, -Math.PI / 2]], ['seahorses', [2.6, 12.5, Math.PI]]]) {
    await page.evaluate(([x, y, ang]) => { px = x; py = y; a = ang; pitch = 0; }, at);
    await page.waitForTimeout(250);
    const s = await glyphs();
    assert.ok(/[<>"]/.test(s) || /[()|]{3}/.test(s), `${name}: something swimming`);
  }
  assert.ok(await page.evaluate(() => { px = 12; py = 9; a = -Math.PI / 2; pitch = 0.5; return !ROOMW.cell(12, 9); }), 'the tunnel floor is walkable');
  await page.evaluate(() => { px = 5.5; py = 14.2; });
  assert.match(await page.evaluate(() => promptText()), /touch pool/);
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => TOUCH_LINES.includes(msgText)));
  await page.evaluate(() => { px = 20.5; py = 14.6; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the gift shop');
  assert.ok(await page.evaluate(() => shopCtx.stock.includes('sharkplush')));
}));

test('the cathedral: in through the great doors, a seat in a pew, a candle lit, up the bell tower and back down, out again', () => withPage(async page => {
  await page.evaluate(() => { tod = 15; for (const [k, v] of landmarkOf) if (v === 'cathedral') { px = (k % NB) * 8 + 5; py = Math.floor(k / NB) * 8 + 3.7; a = Math.PI / 2; break; } });
  await page.waitForTimeout(100);
  assert.match(await page.evaluate(() => promptText()), /go into the cathedral/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, room.def.height]), ['room', 'cathedral', 16]);
  await page.evaluate(() => { px = 9; py = 15.6; });
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => !!body.seat), 'sitting in a pew');
  await page.evaluate(() => { body.seat = null; px = 19; py = 35.3; });
  const lit = await page.evaluate(() => room.candles);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [room.candles, money]), [lit + 1, 99]);
  await page.evaluate(() => { px = CATH_TOWER[0]; py = CATH_TOWER[1] - 0.2; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, roofH]), ['roof', 8], 'up the tower, 80m');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind]), ['room', 'cathedral'], 'back down');
  await page.evaluate(() => { px = 11; py = 38.3; a = Math.PI / 2; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'out the doors');
  await page.evaluate(() => { tod = 23; for (const [k, v] of landmarkOf) if (v === 'cathedral') { px = (k % NB) * 8 + 5; py = Math.floor(k / NB) * 8 + 3.7; break; } });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'walk', 'locked at night');
}));

test('the cell block: you stay in your cell, the bars are see-through and there is a whole block beyond them', () => withPage(async page => {
  await page.evaluate(() => enterRoom('jail', { word: 'JAIL', ret: [px, py, a], until: T + 60 }, [11, 3.2, Math.PI / 2]));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(() => py < JAIL_BARS_NEAR - 0.2), 'stopped at the bars');
  // looking through them: something is drawn far past the bars (the cells across the corridor)
  const far = await page.evaluate(() => { let n = 0; for (let i = 0; i < ZB.length; i++) if (ZB[i] > JAIL_BARS_FAR - py && ZB[i] < 50) n++; return n; });
  assert.ok(far > 200, `the far side of the corridor is in view (${far} cells)`);
  const g0 = await page.evaluate(() => room.props.find(s => s.tick && s.y === 7.5).x);
  await page.waitForTimeout(500);
  assert.notStrictEqual(await page.evaluate(() => room.props.find(s => s.tick && s.y === 7.5).x), g0, 'the guard is walking');
}));

test('your home: things put in the closet are still there after a reload; a taxi takes you to your nearest home', () => withPage(async page => {
  await page.evaluate(() => { money = 5000; buy('home_studio'); carryItem({ id: 'book', uses: 0 }); carryItem({ id: 'umbrella', uses: 0 });
    const cell = owned.homes[0].cell;
    enterRoom('home', { word: 'HOME', ret: [px, py, a], cell: [cell % N, Math.floor(cell / N)] }, [ROOM_DEFS.home.grid[0].length / 2, 3, -Math.PI / 2]); [px, py] = room.def.spots.closet; py += 0.6; });
  assert.match(await page.evaluate(() => promptText()), /your closet/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => panelOpen()), true, 'the closet opens');
  await page.keyboard.press('Digit1');
  assert.deepStrictEqual(await page.evaluate(() => [closet.map(it => it.id), inv.map(it => it.id)]), [['book'], ['umbrella']]);
  await page.keyboard.press('KeyE');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => closet.map(it => it.id)), ['book'], 'kept');
  const d = await page.evaluate(() => {
    leaveRoom && room && leaveRoom(); mode = 'walk';
    me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; return 0; });
  await page.keyboard.press('Digit6');
  const r = await page.evaluate(() => { const h = owned.homes[0], x = h.cell % N, y = Math.floor(h.cell / N);
    return [me.destName.startsWith('home'), ROAD[idx(Math.floor(me.dest[0]), Math.floor(me.dest[1]))] > 0, Math.hypot(rel(me.dest[0] - x), rel(me.dest[1] - y)) < 7]; });
  assert.deepStrictEqual(r, [true, true, true], 'to the street outside home');
}));

test('the calendar: midnight turns the day over; Saturday night there are fireworks over the bay, and not on a Tuesday', () => withPage(async page => {
  await page.evaluate(() => { dayNum = 4; tod = 23.99; });
  await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => weekday()), 'Sat', 'Friday became Saturday at midnight');
  await page.evaluate(() => { tod = 21.2; weather = 'clear'; px = FAIR.cx; py = SHORE_S * 8 + 2.4; a = Math.PI / 2; pitch = 0.45; });
  await page.waitForTimeout(4000);
  assert.ok(await page.evaluate(() => shells.length) > 0, 'shells in the air');
  assert.match(await page.evaluate(() => CH.join('')), /[*@+]/, 'and on screen');
  await page.evaluate(() => { dayNum = 1; shells.length = 0; });
  await page.waitForTimeout(2000);
  assert.strictEqual(await page.evaluate(() => shells.length), 0, 'nothing on a Tuesday');
}));

test('graffiti: murals on some walls; spray paint from the hardware store tags a wall, the tag is kept, and a cop seeing it means trouble', () => withPage(async page => {
  assert.ok(await page.evaluate(() => { let n = 0; for (let y = 8; y < 190; y++) for (let x = 0; x < N; x++) if (map[idx(x, y)] && muralSeed(idx(x, y), x, y, 'S') >= 0) n++; return n; }) > 30, 'murals round town');
  assert.ok(await page.evaluate(() => stockFor('', 'HARDWARE').includes('spraypaint')));
  const spot = await page.evaluate(() => { for (let y = 8; y < 190; y++) for (let x = 0; x < N; x++) if (map[idx(x, y)] > 0.5 && STY[idx(x, y)] < 3 && !map[idx(x, y + 1)] && ROAD[idx(x, y + 1)] === 2) return [x, y]; });
  await page.evaluate(([x, y]) => { px = x + 0.5; py = y + 1.12; a = -Math.PI / 2; pitch = 0; inv.push({ id: 'spraypaint', uses: 6 }); held = inv.length - 1;
    for (const c of cars) if (c.patrol) { c.x = mod(px + 80, N); c.ex = c.x; } for (const c of footCops) c.x = mod(px + 80, N); }, spot);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyQ');
  assert.deepStrictEqual(await page.evaluate(() => [tags.length, inv[held].uses, wanted.stars]), [1, 5, 0], 'tagged, nobody official watching');
  await page.evaluate(() => { saveGame(); });
  await page.reload(); await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => tags.length), 1, 'still there after a reload');
  await page.evaluate(([x, y]) => { px = x + 1.5; py = y + 1.12; a = -Math.PI / 2; inv.push({ id: 'spraypaint', uses: 6 }); held = inv.length - 1;
    footCops[0].x = px + 0.5; footCops[0].y = py + 0.3; }, spot);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyQ');
  assert.ok(await page.evaluate(() => wanted.stars >= 1 && wanted.crime === 'vandalism'), 'wanted for vandalism');
}));

test('the Shotengai: a roof over its streets, dry in the rain; pachinko pays tickets, the crane can win you a plush, a capsule for the night', () => withPage(async page => {
  const st = await page.evaluate(() => { for (let by = 17; by <= 20; by++) for (let bx = 11; bx <= 15; bx++) if (vseg(bx, by) && vseg(bx, by + 1) && blockKind(bx, by) === '' && blockKind(bx - 1, by) === '') return [bx * 8 + 1.35, by * 8 + 7.5]; });
  assert.ok(st, 'a covered street');
  await page.evaluate(([x, y]) => { tod = 13; weather = 'rain'; rain = 1; px = x; py = y; a = -Math.PI / 2; pitch = 0.9; }, st);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => districtAt(px, py)), 'shotengai');
  assert.ok(await page.evaluate(() => { let roof = 0; for (let i = 0; i < cols * 6; i++) if (ZB[i] > 0 && ZB[i] < 40) roof++; return roof > cols * 3; }), 'the roof overhead, not sky');
  assert.ok(!(await page.evaluate(() => CH.join(''))).includes('!'), 'no rain falling under it');
  await page.evaluate(() => enterRoom('pachinko', { word: 'PACHINKO', neon: MAG, ret: [px, py, a] }, [7, 9.4, -Math.PI / 2]));
  await page.evaluate(() => { const m = room.props.find(s => s.pachi && !s.busy); px = m.cx; py = m.cy + m.fy * 0.75; });
  assert.match(await page.evaluate(() => promptText()), /pachinko/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'pachinko');
  await page.evaluate(() => { game.g.score = 80; });
  await page.keyboard.press('KeyE'); // cash out
  assert.strictEqual(await page.evaluate(() => tickets), 5, '80 balls: 40 up on the tray, 5 tickets');
  await page.evaluate(() => { game = null; enterRoom('cranes', { word: 'CRANE GAME', neon: MAG, ret: [px, py, a] }, [5.5, 6.4, -Math.PI / 2]); px = 4.8; py = 2.4; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'crane');
  await page.evaluate(() => { game.g.prize = 'plushcat'; game.g.over = true; });
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => inv.some(it => it.id === 'plushcat')), 'won a lucky cat');
  await page.evaluate(() => { game = null; enterRoom('capsule', { word: 'CAPSULE', neon: CYAN, ret: [px, py, a] }, [3.5, 10.4, -Math.PI / 2]); py = 9.9; tod = 15; });
  await page.keyboard.press('KeyE');
  assert.ok(await page.evaluate(() => !!sleep), 'asleep in a pod');
}));

test('mahjong at the tea house: the buy-in goes in the pot, walking away loses it, a win pays the pot', () => withPage(async page => {
  await page.evaluate(() => enterRoom('tea', { word: 'MAHJONG', neon: RED, ret: [px, py, a], line: 'Hi' }, [3, 5.2, -Math.PI / 2]));
  assert.match(await page.evaluate(() => promptText()), /mahjong/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [game && game.g.id, game.kind, money, game.g.hands[0].length]), ['mahjong', 'table', 95, 14]);
  await page.keyboard.press('Space'); // throw a tile
  await page.waitForTimeout(150); // (the game takes the key on its next frame)
  assert.strictEqual(await page.evaluate(() => game.g.hands[0].length), 13);
  await page.keyboard.press('KeyE'); // get up mid-hand
  assert.deepStrictEqual(await page.evaluate(() => [game, money]), [null, 95], 'the stake stays in the pot');
  await page.keyboard.press('KeyE');
  await page.evaluate(() => { game.g.hands[0].splice(0, 14, 0, 0, 0, 1, 2, 3, 9, 10, 11, 20, 20, 20, 26, 26); });
  await page.keyboard.press('ArrowUp'); // MAHJONG!
  await page.waitForTimeout(150);
  assert.deepStrictEqual(await page.evaluate(() => [game.g.result.winner, money]), [0, 110], 'won the pot: $20');
}));

test('snow covers garden beds and roof rims without covering open water or reflecting as a puddle', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'walk'; tod = 12; env(0); render(0);
    const sample = (wx, wy) => {
      const row = hor + 10, d = eye * projY / (row - hor + 0.5);
      floorCell(0, row, 0, (wx - px) / d, (wy - py) / d);
      return [BG[0] >> 4, FL[0]];
    };
    const bed = GARDEN_BEDS[0], bx = GARDEN.x0 + bed[0], by = GARDEN.y0 + bed[1];
    snowCover = 0; const bare = sample(bx, by);
    snowCover = 1; const snowy = sample(bx, by);
    const water = sample(GARDEN.x0 + LAKE.x, GARDEN.y0 + LAKE.y);
    const at = Array.from(map).findIndex((h, i) => h > 2 && STY[i] === 0);
    const mx = at % N, my = Math.floor(at / N);
    roofTop(0, mx + 0.5, my + 0.5, map[at], 1);
    const roof = BG[0] >> 4;
    roofTop(0, mx + 0.01, my + 0.5, map[at], 1);
    const rim = CH[0];
    BG[0] = C(BLUE, 2); FL[0] = 2;
    paintSettledSnow(0, bx, by, 6);
    return { bare, snowy, water, roof, rim, matte: FL[0] };
  });
  assert.notStrictEqual(result.bare[0], result.snowy[0], 'the flower bed receives snow');
  assert.strictEqual(result.snowy[0], 4, 'full snow cover is white');
  assert.strictEqual(result.water[1], 3, 'open water keeps its water surface');
  assert.strictEqual(result.roof, 4, 'the roof receives snow too');
  assert.strictEqual(result.rim, '#', 'snow preserves the parapet outline');
  assert.strictEqual(result.matte, 1, 'snow-covered puddles stop reflecting');
}));

test('the conservatory waterfall runs to the floor and joins the pond through continuous blocked water', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true;
    enterRoom('conservatory', { word: 'CONSERVATORY', ret: [px, py, a] }, [6.5, 7, -Math.PI / 2]);
    let connected = true;
    for (let y = CONS_FALL.y + 0.01; y <= CONS_POOL.y; y += 0.05) {
      for (const x of [CONS_FALL.x - 0.4, CONS_FALL.x, CONS_FALL.x + 0.4]) {
        FL[0] = 0;
        conservatoryFloor(0, 1, x, y);
        connected &&= inConsPool(x, y) && room.def.block(x, y) && FL[0] === 3;
      }
    }
    conservatoryWall(0, CONS_FALL.x, 0.01, 0.1, 5, 6, 0, 10);
    return { connected, foot: BG[0] >> 4, cyan: CYAN, boardwalk: free(6.5, 6) };
  });
  assert.ok(result.connected, 'no strip of dry floor separates the waterfall from the pond');
  assert.strictEqual(result.foot, result.cyan, 'the waterfall continues through the brick plinth');
  assert.ok(result.boardwalk, 'the approach remains walkable');
}));

test('conservatory displays keep the same artwork from both sides and at oblique viewing angles', () => withPage(async page => {
  const result = await page.evaluate(() => {
    paused = true;
    enterRoom('conservatory', { word: 'CONSERVATORY', ret: [px, py, a] }, [10, 4, 0]);
    const sample = (viewerX, slope, sign, y) => {
      px = viewerX; WH.sl = slope; WH.dn = Math.abs(px - 13); eye = 1.7;
      const pixels = [];
      for (let u = y; u < y + 0.8; u += 0.1) for (let z = 0.2; z < 3; z += 0.1) {
        WH.wc = u; BG[0] = NONE;
        conservatoryWall(0, u * sign, 0.01, z, 4, 13, Math.floor(y), 8);
        pixels.push([CH[0], COL[0], BG[0]]);
      }
      return JSON.stringify(pixels);
    };
    return [4.1, 11.1].map(y => {
      const front = sample(10, 0, 1, y);
      return front === sample(17, -3, -1, y) && front === sample(12.5, 6, 1, y);
    });
  });
  assert.deepStrictEqual(result, [true, true], 'both botanical panels stay attached to the wall');
}));

test('the Botanical Gardens: gates locked at night, a swan boat on the lake, ducks to feed, the conservatory and the aviary, a gardener\'s shift, a seat on the grass', () => withPage(async page => {
  const at = (gx, gy, ang = 0) => page.evaluate(([x, y, an]) => { mode = 'walk'; px = GARDEN.x0 + x; py = GARDEN.y0 + y; a = an; pitch = 0; }, [gx, gy, ang]);
  const prompt = () => page.evaluate(() => promptText());
  await page.evaluate(() => { tod = 12; weather = 'clear'; money = 100; });
  await at(11, -0.5, Math.PI / 2); // outside the north gate
  assert.ok(await page.evaluate(() => free(GARDEN.x0 + 11, GARDEN.y0 + 0.2)), 'open by day');
  await page.evaluate(() => { tod = 22; });
  assert.ok(await page.evaluate(() => !free(GARDEN.x0 + 11, GARDEN.y0)), 'locked at night'); // (the gate itself)
  assert.match(await prompt(), /gates are locked/);
  await at(11, 1, -Math.PI / 2);
  assert.ok(await page.evaluate(() => free(GARDEN.x0 + 11, GARDEN.y0 - 0.3)), 'you can always let yourself out');
  await page.evaluate(() => { tod = 12; });
  // the boats
  await page.evaluate(() => { window.JF = [JETTY.gx0 + 0.25, JETTY.gy]; window.SHED = [GARDEN_SHED.gx, GARDEN_SHED.gy - 0.45]; });
  await at(...await page.evaluate(() => JF));
  assert.match(await prompt(), /rent a swan boat \(\$4\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, money]), ['boat', 96]);
  const before = await page.evaluate(() => [px, py]);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(([x, y]) => Math.hypot(px - x, py - y) > 0.05, before, { timeout: 10000 });
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => [px, py, gardenLake(px, py)]);
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.05 && after[2], 'paddled out, still on the water');
  await page.evaluate(() => { boat.gx = LAKE.x + 1; boat.gy = LAKE.y; });
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => mode), 'boat', 'only out at the jetty');
  await page.evaluate(() => { boat.gx = JETTY.gx1 + 0.3; boat.gy = JETTY.gy; });
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, onJetty(...gardenLocal(px, py))]), ['walk', true]);
  // the ducks
  const shore = await page.evaluate(() => { for (let k = 0; k < 360; k++) { const th = k * Math.PI / 180, gx = LAKE.x + Math.cos(th) * (LAKE.rx + 0.45), gy = LAKE.y + Math.sin(th) * (LAKE.ry + 0.45);
    if (gardenLakeEdge(gx, gy) < -0.25 && gardenLakeEdge(gx, gy) > -0.4 && !onJetty(gx, gy) && Math.abs(gy - JETTY.gy) > 1) return [gx, gy, th + Math.PI]; } });
  await at(...shore);
  await page.evaluate(() => { inv.push({ id: 'bagel', uses: 3 }); held = inv.length - 1; });
  assert.match(await prompt(), /feed the ducks/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [!!duckFeed, heldItem().uses]), [true, 2]);
  // a seat on the grass
  const lawn = await page.evaluate(() => { for (let gy = 1; gy < GARDEN.h; gy += 0.5) for (let gx = 1; gx < GARDEN.w; gx += 0.5) if (gardenLawn(GARDEN.x0 + gx, GARDEN.y0 + gy) && !benchesB.flat().some(b => Math.hypot(b.x - GARDEN.x0 - gx, b.y - GARDEN.y0 - gy) < 0.3)) return [gx, gy]; });
  await at(...lawn);
  await page.keyboard.press('KeyC');
  assert.ok(await page.evaluate(() => body.seat && body.seat.grass), 'sat down on the grass');
  await page.keyboard.press('KeyC');
  // the conservatory: $5, in by the boardwalk, not stuck in a wall
  const cons = await page.evaluate(() => GLASSHOUSES[0].door);
  await at(cons[0], cons[1] + 0.2, -Math.PI / 2);
  await page.waitForTimeout(150);
  assert.match(await prompt(), /enter CONSERVATORY \(\$5\.00\)/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money, free(px, py)]), ['room', 'conservatory', 91, true]);
  await page.evaluate(() => { px = 18; py = 9; a = 0; });
  await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => CH.join('')), /[|]{2}/, 'cacti in the desert house');
  await page.evaluate(() => leaveRoom());
  // the aviary: free; a cup of seed from the keeper
  const av = await page.evaluate(() => GLASSHOUSES[1].door);
  await at(av[0], av[1] - 0.2, Math.PI / 2);
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [mode, room.kind, money]), ['room', 'aviary', 91]);
  await page.evaluate(() => { px = 11.5; py = 8.4; });
  assert.match(await prompt(), /cup of seed/);
  await page.keyboard.press('KeyE');
  assert.deepStrictEqual(await page.evaluate(() => [money, T - seedT < 1]), [90, true]);
  await page.evaluate(() => leaveRoom());
  // the gardeners' shed
  await at(...await page.evaluate(() => SHED));
  assert.match(await prompt(), /work a shift with the gardeners/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'garden');
}));

test('shut-down shops say so; each district paints its own walls', () => withPage(async page => {
  await page.evaluate(() => { tod = 13; weather = 'clear'; mode = 'walk'; for (const p of people) p.hidden = true; cars.length = 0; flocks.length = 0; }); // (nobody passing to talk to, no car to take: just the shop)
  const shut = await page.evaluate(() => { for (let k = 0; k < N * N; k++) { const sh = SHOP[k], x = k % N, y = k / N | 0; if (sh && sh.kind === SHOP_SHUT && !map[idx(x, y + 1)] && ROAD[idx(x, y + 1)]) return [x, y]; } });
  await page.evaluate(([x, y]) => { px = x + 0.5; py = y + 1.25; a = -Math.PI / 2; pitch = 0; }, shut);
  await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => promptText()), /closed down for good/);
  const themes = await page.evaluate(() => [MURAL_THEMES.chinatown.art.includes('dragon'), MURAL_THEMES.industrial.chance > MURAL_THEMES.downtown.chance * 4]);
  assert.deepStrictEqual(themes, [true, true]);
}));

test('every food and drink shows itself being used up (a level going down, steam going, or bites out of it), in both dropped and held art', () => withPage(async page => {
  const same = await page.evaluate(() => {
    const out = [];
    for (const id in ITEMS) {
      const I = ITEMS[id];
      if (!(I.kind === 'food' || I.kind === 'drink') || !(I.uses > 1)) continue;
      for (const [name, art] of [['dropped:', DROPPED_ART[id]], ['held:', DENSE[id]]]) {
        if (!art) continue;
        if (JSON.stringify(art({ id, uses: I.uses }, 1)[0]) === JSON.stringify(art({ id, uses: 1 }, 1 / I.uses)[0])) out.push(name + id);
      }
    }
    return out;
  });
  assert.deepStrictEqual(same, []);
}));

test('a shop you\'ve broken into: E means the till only at the counter, the way out only by the door', () => withPage(async page => {
  await page.evaluate(() => { enterRoom('store', { word: 'DELI', neon: RED, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]); });
  const at = (x, y) => page.evaluate(([x, y]) => { px = x; py = y; return [promptText(), eLabel(promptText())]; }, [x, y]);
  const keeper = await page.evaluate(() => room.def.keeper);
  assert.deepStrictEqual(await at(keeper[0], keeper[1] + 0.5), ['G: take something   E: the till', 'Till']);
  const door = await page.evaluate(() => [room.W / 2, room.H - 1.6]);
  assert.deepStrictEqual(await at(door[0], door[1]), ['G: take something   E: leave', 'Exit']);
  await page.evaluate(() => { px = 1.6; py = room.H / 2; });
  if (await page.evaluate(() => !nearKeeper() && !nearExit())) assert.strictEqual(await page.evaluate(() => promptText()), 'G: take something');
}));

test('smoke hangs in the air: a drag leaves puffs in front of you, gone in seconds outside and lingering indoors', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 15; mode = 'walk'; haze.length = 0;
    cigTip = 1; stepHaze(0.05); for (let k = 0; k < 20; k++) stepHaze(0.05); // breathe it out
    const out = haze.length, ahead = haze.every(p => Math.cos(a) * rel(p.x - px) + Math.sin(a) * rel(p.y - py) > 0);
    for (let k = 0; k < 200; k++) stepHaze(0.05); // ten seconds
    const outLater = haze.length;
    enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a], line: '' }, [6, 6, -Math.PI / 2]);
    cigTip = 0; stepHaze(0.05); cigTip = 1; for (let k = 0; k < 21; k++) stepHaze(0.05);
    const inside = haze.length; for (let k = 0; k < 200; k++) stepHaze(0.05);
    return [out > 0, ahead, outLater, inside > 0, haze.length === inside];
  });
  assert.deepStrictEqual(r, [true, true, 0, true, true]);
}));

test('street life: manholes in the road (some steaming), and pigeons that take off when you walk up to them', () => withPage(async page => {
  const r = await page.evaluate(() => {
    let holes = 0, steaming = 0;
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) { const m = manholeAt(x + 0.5, y + 0.5); if (m && Math.floor(m[0]) === x && Math.floor(m[1]) === y) { holes++; if (m[2]) steaming++; } }
    tod = 11; mode = 'walk'; haze.length = 0;
    const m = (() => { for (let y = 60; y < 200; y++) for (let x = 60; x < 200; x++) { const mm = manholeAt(x + 0.5, y + 0.5); if (mm && mm[2]) return mm; } })();
    px = m[0]; py = m[1] + 0.4; steamT = 0; stepSteam(0.05);
    const steam = haze.some(p => p.kind === 'steam');
    px = 12 * 8 + 0.15; py = 10 * 8 + 4; flocks.length = 0;
    flocks.push({ x: px, y: py + 0.6, birds: [0, 1, 2, 3].map(k => ({ dx: k * 0.02, dy: 0, ph: k, dir: 1, z: 0 })), scared: 0 });
    stepPigeons(0.05); const calm = !flocks[0].scared;
    py += 0.4; stepPigeons(0.05); for (let k = 0; k < 20; k++) stepPigeons(0.05);
    return [holes > 40, steaming > 10, steam, calm, !!flocks[0].scared, flocks[0].birds.every(b => b.z > 0)];
  });
  assert.deepStrictEqual(r, [true, true, true, true, true, true]);
}));

test('the casino: blackjack, roulette and slots take your stake and pay out; jade helps', () => withPage(async page => {
  await page.evaluate(() => { money = 500; enterRoom('casino', { word: 'CASINO', neon: YEL, ret: [px, py, a], line: '' }, [11, 14, -Math.PI / 2]); });
  for (const [id, x, y] of [['blackjack', 5, 7.4], ['roulette', 11, 10.4], ['slots', 2.2, 4.5]]) {
    await page.evaluate(([x, y]) => { px = x; py = y; }, [x, y]);
    assert.match(await page.evaluate(() => promptText()), new RegExp(`play ${id === 'slots' ? 'the slots' : id}`));
    await page.keyboard.press('KeyE');
    assert.deepStrictEqual(await page.evaluate(() => [game.kind, game.g.id]), ['casino', id]);
    const before = await page.evaluate(() => money);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(b => money !== b || game.g.state() !== 'bet', before), `${id}: the stake goes down`);
    await page.waitForTimeout(id === 'roulette' ? 4500 : 1500);
    if (id === 'blackjack' && await page.evaluate(() => game.g.state() === 'play')) { await page.keyboard.press('Space'); await page.waitForTimeout(3000); }
    assert.strictEqual(await page.evaluate(() => game.g.state()), 'done', `${id}: a round finishes`);
    await page.keyboard.press('KeyE');
  }
  // the house edge, and jade tipping it: the same slots, many pulls, with and without luck
  const rtp = await page.evaluate(() => {
    const run = lucky => { inv.length = 0; if (lucky) inv.push({ id: 'jadebangle', uses: 0 }, { id: 'jadedragon', uses: 0 }); let q = 99; const rnd = () => { q = q * 16807 % 2147483647; return q / 2147483647; };
      let back = 0; for (let k = 0; k < 20000; k++) { let r = slotPull(rnd); if (!slotPays(r) && rnd() < luck() * 1.5) r = slotPull(rnd); back += slotPays(r); } return back / 20000; };
    return [run(false), run(true)];
  });
  assert.ok(rtp[0] > 0.75 && rtp[0] < 0.97, `the slots keep a bit: ${rtp[0]}`);
  assert.ok(rtp[1] > rtp[0], `jade helps: ${rtp[1]} vs ${rtp[0]}`);
}));

test('breaking in at night: the till pays well but sets off the alarm, the police come at once; a bank\'s vault pays a fortune and brings everyone', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 23; money = 0;
    enterRoom('store', { word: 'DELI', neon: RED, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = room.def.keeper[0]; py = room.def.keeper[1] + 0.5; interact();
    const shop = [money, wanted.stars, room.alarm, /ALARM/.test(promptText())];
    leaveRoom(); clearWanted(); money = 0;
    enterRoom('bank', { word: 'BANK', neon: BLUE, ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = room.W - 2; py = room.H / 2;
    const vaultPrompt = /crack the vault/.test(promptText());
    interact(); // the safecracking game comes up
    const g = game && game.g.id;
    game.onDone(true); game = null;
    return [shop, vaultPrompt, g, money >= 1000, wanted.stars];
  });
  assert.ok(r[0][0] >= 120 && r[0][1] >= 2 && r[0][2] && r[0][3], `the shop till: ${JSON.stringify(r[0])}`);
  assert.deepStrictEqual(r.slice(1), [true, 'lockpick', true, 3]);
}));

test('dog walkers: out with their dogs in the morning, at lunch and before dinner, never at night; you can pet the dog', () => withPage(async page => {
  const counts = await page.evaluate(() => {
    const dogsAt = t => people.filter(p => p.role === 'dogwalker' && activity(p, t) === 'wander' && t >= 7 && t < 20).length;
    return { walkers: people.filter(p => p.role === 'dogwalker').length, morning: dogsAt(8.3), lunch: dogsAt(13.3), evening: dogsAt(18.5), night: dogsAt(23), early: dogsAt(5) };
  });
  assert.ok(counts.walkers > 30, JSON.stringify(counts));
  assert.ok(counts.morning > 10 && counts.lunch > 10 && counts.evening > 10, JSON.stringify(counts));
  assert.strictEqual(counts.night + counts.early, 0);
  const pet = await page.evaluate(() => {
    tod = 8.3; mode = 'walk';
    const m = people.find(p => p.role === 'dogwalker'); m.hidden = false; m.act = 'wander';
    const d = dogOf(m); px = d.x; py = d.y + 0.05;
    const prompt = promptText(); interact();
    return [walkingDog(m), /pet the dog/.test(prompt) || /pick their pocket|talk/.test(prompt), msgText.length > 0];
  });
  assert.deepStrictEqual(pet, [true, true, true]);
}));

test('the stock exchange: trade with the broker while the market is open; your shares are still yours after a reload', () => withPage(async page => {
  await page.evaluate(() => { dayNum = 1; tod = 11; money = 500; enterRoom('exchange', { word: 'EXCHANGE', neon: GREEN, ret: [px, py, a], line: '' }, [10, 5.6, -Math.PI / 2]); });
  assert.match(await page.evaluate(() => promptText()), /trade \(market open\)/);
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game && game.g.id), 'market');
  await page.keyboard.press('Space'); // lot of 10
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight'); // buy 10 DUMP
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => [shares.DUMP && shares.DUMP.n, money < 500]);
  assert.deepStrictEqual(after, [10, true]);
  await page.keyboard.press('KeyE');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => shares.DUMP && shares.DUMP.n), 10, 'kept in the save');
  await page.evaluate(() => newGame && localStorage.removeItem('ascii-city-save'));
}));

test('an animation timestamp before the clock baseline cannot run the simulation backwards', () => withPage(async page => {
  const times = await page.evaluate(() => {
    T = 0;
    loop(t0 - 16); // the first RAF timestamp can precede performance.now() during startup
    const earlier = T;
    loop(t0 + 16);
    const next = T;
    loop(t0 + 1000);
    paused = true;
    return [earlier, next, T];
  });
  assert.strictEqual(times[0], 0, 'an earlier timestamp leaves game time unchanged');
  assert.strictEqual(times[1], 0.016, 'the next frame advances normally');
  assert.strictEqual(times[2], 0.066, 'long frames retain the 50ms cap');
}));

test('the Velvet Rope renders its neon and stage dancers even with negative animation time', () => withPage(async page => {
  const valid = await page.evaluate(() => {
    paused = true;
    const props = ROOM_DEFS.stripclub.props({});
    const dancers = props.filter(p => p.tick);
    for (const time of [-0.016, -0.7, -3, 0, 0.7, 3]) {
      T = time;
      // A pixel on the end-wall dancer, away from the pole.
      clubSide(0, 0, 0.01, 1.2, 1, false, 1.7, 4, 1, 0, 1, 1, true);
      for (const dancer of dancers) {
        dancer.tick(dancer);
        if (!DANCER_FRAMES.includes(dancer.art)) return false;
      }
    }
    return dancers.length === 3;
  });
  assert.ok(valid, 'each stage dancer always has a valid frame');
}));

test('the Velvet Rope: $20 at the door (not with the cops after you), tip the dancers, $40 for a private dance', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 22; money = 200; mode = 'walk';
    const sh = CLUB.sh, open = openAt(sh, 22) && !openAt(sh, 12);
    wanted.stars = 1; lookHit = { d: 0.2, mx: CLUB.bx * 8 + 5, my: CLUB.by * 8 + 2 }; interact();
    const refused = mode === 'walk' && /Not with the cops/.test(msgText);
    wanted.stars = 0; interact();
    const inside = [mode, room && room.kind, money];
    px = 9; py = 4.6; const stagePrompt = promptText(); interact();
    px = 13.4; py = 10.8; const vipPrompt = promptText(); interact();
    return { open, refused, inside, stagePrompt, money, vipPrompt, game: game && game.g.id };
  });
  assert.ok(r.open && r.refused, JSON.stringify(r));
  assert.deepStrictEqual(r.inside, ['room', 'stripclub', 180]);
  assert.match(r.stagePrompt, /tip the dancer/);
  assert.match(r.vipPrompt, /private dance/);
  assert.deepStrictEqual([r.money, r.game], [135, 'lapdance']);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => money === 134 && game.g.tips === 1), 'a dollar tip');
  await page.keyboard.press('KeyE');
  assert.strictEqual(await page.evaluate(() => game), null);
}));

test('the Velvet Rope\'s private dancer is six characters in every frame (the joke has to be accurate); a cigarette machine by the bar', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const counts = LAP_FRAMES.map(f => f.join('').replace(/ /g, '').length);
    enterRoom('stripclub', { word: 'VELVET', neon: MAG, ret: [px, py, a], line: '' }, [9, 11, -Math.PI / 2]);
    px = 1.6; py = 9.8; const prompt = promptText(); interact();
    return [counts, LAP_LINES.some(l => /six characters/.test(l)), prompt, panelOpen()];
  });
  assert.deepStrictEqual(r, [[6, 6, 6, 6, 6, 6, 6, 6], true, 'E: cigarette machine', true]);
}));

test('the marina: buy a boat, take her out (chase camera and at the helm), tie up somewhere else; she is still there after a reload', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 12; money = 9000; mode = 'walk';
    const b = fleet.find(o => o.deal === 'sale' && o.kind === 'cruiser'), s = SLOTS[b.slot], fy = MARINA.fingers[Math.floor(b.slot / 4)];
    px = s.x; py = fy; a = Math.atan2(s.y - fy, 0);
    const prompt = promptText(); interact(); const bought = [b.deal, money];
    interact(); return { prompt, bought, mode, name: b.name };
  });
  assert.match(r.prompt, /E: buy the cabin cruiser/);
  assert.deepStrictEqual([r.bought, r.mode], [['mine', 3000], 'sea']);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyV'); await page.waitForTimeout(300); // at the helm
  await page.keyboard.press('KeyV'); await page.waitForTimeout(200);
  const moved = await page.evaluate(() => { const at = [sea.x, sea.y]; sea.v = 0; sea.x = MARINA.x + 0.9; sea.y = MARINA.fingers[1] + 0.38; sea.hx = 1; sea.hy = 0; a = 0;
    const p = promptText(); interact(); return { at, p, mode, x: fleet.find(o => o.deal === 'mine').x }; });
  assert.match(moved.p, /E: tie up/);
  assert.strictEqual(moved.mode, 'walk');
  await page.evaluate(() => saveGame());
  await page.reload(); await page.waitForTimeout(400);
  const kept = await page.evaluate(() => fleet.filter(o => o.deal === 'mine').map(o => [o.kind, o.name, Math.round(o.x * 10) / 10]));
  assert.deepStrictEqual(kept, [['cruiser', r.name, Math.round(moved.x * 10) / 10]]);
  await page.evaluate(() => localStorage.removeItem('ascii-city-save'));
}));

test('talking to people indoors: walk up to someone in a cafe or a station and they chat (the counter still serves you)', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 14; mode = 'walk';
    enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a], line: 'What can I get you?' }, [5, 6.3, -Math.PI / 2]);
    const arts = [ART.keeper, ART.sitter, ART.sitterBack], k = room.def.keeper;
    const s = room.props.find(o => arts.includes(o.art) && Math.hypot(o.x - k[0], o.y - k[1]) > 2);
    px = s.x; py = s.y + 0.9; a = -Math.PI / 2;
    const prompt = promptText(); interact();
    const cafeLine = msgText;
    px = k[0]; py = k[1] + 1; a = -Math.PI / 2; const counter = promptText();
    leaveRoom(); enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0]);
    let sprompt = ''; // (someone the train isn't standing beside: boarding it rightly comes first)
    for (const p2 of room.props.filter(o => arts.includes(o.art))) { px = p2.x + 0.8; py = p2.y; a = Math.PI; sprompt = promptText(); if (sprompt === 'E: talk') break; }
    interact();
    return { prompt, cafeLine, counter, sprompt, stationLine: msgText };
  });
  assert.strictEqual(r.prompt, 'E: talk');
  assert.ok(await page.evaluate(l => ROOM_TALK.cafe.some(x => l.includes(x)) || l.includes('coffee') || l.startsWith('"'), r.cafeLine), r.cafeLine);
  assert.match(r.counter, /E: shop/);
  assert.strictEqual(r.sprompt, 'E: talk');
  assert.match(r.stationLine, /^".+"$/);
}));

test('the capsule hotel: in through the door and up the aisle without the front desk in the way; the desk still books a pod', () => withPage(async page => {
  const r = await page.evaluate(() => {
    tod = 22; mode = 'walk';
    enterRoom('capsule', { word: 'CAPSULE', neon: CYAN, ret: [px, py, a], line: 'Welcome.' }, [3, 10.4, -Math.PI / 2]);
    const blocked = []; for (let y = 10.6; y > 2; y -= 0.2) for (const x of [2.6, 3, 3.4]) if (!free(x, y)) blocked.push([x, +y.toFixed(1)]);
    px = 5.2; py = 10.5; a = -Math.PI / 2;
    return { blocked, desk: promptText() };
  });
  assert.deepStrictEqual(r.blocked, []);
  assert.match(r.desk, /a pod for the night/);
}));

test('breaking into the casino: shut from 2am, so the lock can be picked before dawn; inside, the cashier\'s cage is the vault', () => withPage(async page => {
  const r = await page.evaluate(() => {
    const sh = CASINO.sh, shut3 = !openAt(sh, 3), open22 = openAt(sh, 22);
    tod = 3; mode = 'walk';
    enterRoom('casino', { ...sh, cell: [CASINO.bx * 8 + 4, CASINO.by * 8 + 5], ret: [px, py, a], line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = 11; py = 3.4; a = -Math.PI / 2;
    return { shut3, open22, prompt: promptText(), noTables: casinoSpot() === null };
  });
  assert.deepStrictEqual([r.shut3, r.open22, r.noTables], [true, true, true]);
  assert.match(r.prompt, /crack the vault/);
}));

test('arrested along with your cab driver: a cell together, and he is not happy about it', () => withPage(async page => {
  const r = await page.evaluate(() => {
    me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; setDest(5); me.rush = true;
    addWanted('steal', px, py, false);
    jailWithCabbie();
    const cab = room.props.find(s => s.cabbie);
    px = cab.x; py = cab.y + 0.9; a = -Math.PI / 2;
    const prompt = promptText(); interact();
    return { kind: room.kind, me, cab: !!cab, prompt, said: msgText, stars: wanted.stars };
  });
  assert.deepStrictEqual([r.kind, r.me, r.cab, r.stars], ['jail', null, true, 0]);
  assert.match(r.prompt, /talk to your cab driver/);
  assert.match(r.said, /^Your cab driver: "/);
}));

test('the big map: opened from the pause menu, dragged and zoomed, Esc back to the pause menu', () => withPage(async page => {
  await page.evaluate(() => openPause());
  await page.click('[data-act="map"]');
  const start = await page.evaluate(() => [bigMapOpen(), BIGMAP.cx, BIGMAP.cy, BIGMAP.z, px, py]);
  assert.ok(start[0] && Math.abs(start[1] - start[4]) < 0.01 && Math.abs(start[2] - start[5]) < 0.01, 'opens on you');
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(440, 300, { steps: 4 }); await page.mouse.up();
  const moved = await page.evaluate(() => [rel(BIGMAP.cx - px) * BIGMAP.z, rel(BIGMAP.cy - py) * BIGMAP.z]);
  assert.ok(Math.abs(moved[0] - 200) < 2 && Math.abs(moved[1] - 100) < 2, 'the map follows the drag ' + moved);
  await page.mouse.wheel(0, -500); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(z => BIGMAP.z > z, start[3]), 'the wheel zooms in');
  for (let k = 0; k < 20; k++) await page.mouse.wheel(0, 800);
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => Math.abs(BIGMAP.z * N - Math.max(innerWidth, innerHeight)) < 1), 'zoomed out, the whole city just fills the screen');
  await page.keyboard.press('Escape');
  assert.deepStrictEqual(await page.evaluate(() => [bigMapOpen(), paused, pauseEl.style.display]), [false, true, 'flex']);
}));

test('dev tools (F2): search and jump to a place, spawn an item, give money, set the day, time and weather', () => withPage(async page => {
  await page.keyboard.press('F2');
  assert.ok(await page.evaluate(() => devOpen() && paused));
  await page.keyboard.type('marina'); await page.keyboard.press('Enter'); // the first match
  assert.deepStrictEqual(await page.evaluate(() => [devOpen(), paused, inMarina(px, py)]), [false, false, true]);
  await page.keyboard.press('F2');
  await page.click('#dev [data-tab="items"]'); await page.keyboard.type('soccer'); await page.click('#dev [data-dev="0"]');
  await page.click('#dev [data-tab="money"]'); await page.click('#dev [data-dev="1"]'); // +$1,000
  await page.click('#dev [data-tab="time"]');
  for (const label of ['Noon', 'Sun', 'fog']) await page.evaluate(l => [...document.querySelectorAll('#dev [data-dev]')].find(x => x.textContent === l).click(), label); // (the menu redraws after each)
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => [inv.map(i => i.id), money, Math.floor(tod), weekday(), weather, devOpen()]); // (the clock's running again)
  assert.deepStrictEqual(r, [['ball'], 1100, 12, 'Sun', 'fog', false]);
}));
