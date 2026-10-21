'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run) {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=0;T=24;tod=12;env(0);});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

test('small cabin foundations meet a broad clearing instead of a pit, with navigable graded approach paths',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    let raised=0,grade=0;const walks=[];
    for(const c of ISLAND_CABINS.slice(1))for(let y=c.y0-.7;y<=c.y1+.7;y+=.2)for(let x=c.x0-.7;x<=c.x1+.7;x+=.2)
      raised=Math.max(raised,terrainHeight(x,y));
    for(const id of ['cabin','wood','rock','sand'])for(const path of ISLAND_PATHS[id]) {
      [px,py]=path[0];body.z=body.vz=0;let okay=true;
      for(const [x,y]of path.slice(1)) {
        for(let n=0;n<2000&&near(px,py,x,y)>.02;n++) {
          const distance=near(px,py,x,y),step=Math.min(.025,distance),old=terrainHeight(px,py);
          const ox=px,oy=py;move((x-px)/distance*step,(y-py)/distance*step);
          if(near(ox,oy,px,py)<1e-6){okay=false;break;}
          grade=Math.max(grade,Math.abs(terrainHeight(px,py)-old)/step);
        }
        if(near(px,py,x,y)>.04)okay=false;
      }
      walks.push({id,okay});
    }
    return {raised,grade,walks};
  });
  assert.ok(result.raised<1e-6,JSON.stringify(result));
  assert.ok(result.grade<=.28001,JSON.stringify(result));
  assert.ok(result.walks.every(w=>w.okay),JSON.stringify(result));
}));

test('new sights are reachable on foot, readable, searchable, and preserve local/offshore route guidance',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const places=mapDirectory(),errors=[];
    for(const sight of ISLAND_SIGHTS) {
      const island=WILD_ISLANDS.find(i=>i.id===sight.island);
      const path=findMapRoute({x:island.landing[0],y:island.landing[1]},sight,MAP_WORLD);
      if(!path){errors.push([sight.id,'no route']);continue;}
      [px,py]=island.landing;
      for(const target of path.concat([sight])) {
        for(let n=0;n<1200&&near(px,py,target.x,target.y)>.025;n++) {
          const dist=near(px,py,target.x,target.y),step=Math.min(.025,dist),x=px,y=py;
          move((target.x-px)/dist*step,(target.y-py)/dist*step);
          if(near(px,py,x,y)<1e-7)break;
        }
      }
      if(near(px,py,sight.x,sight.y)>.08)errors.push([sight.id,'walk']);
      if(!free(sight.x,sight.y)||isWater(sight.x,sight.y))errors.push([sight.id,'blocked']);
      if(!islandBuildingPrompt().includes(sight.name))errors.push([sight.id,'prompt']);
      islandBuildingUse();if(msgText!==sight.text)errors.push([sight.id,'read']);
      if(!places.some(p=>p.id===sight.id&&p.description===sight.text))errors.push([sight.id,'directory']);
    }
    const lookout=places.find(p=>p.id==='fern-lookout');
    [px,py]=WILD_ISLANDS[0].landing;setMapWaypoint(lookout);updateMapNavigation();const local=!!MAP_NAV.path;
    px=MARINA.x;py=MARINA.y0;MAP_NAV.routeFrom=null;MAP_NAV.lastT=-99;updateMapNavigation();
    return {count:ISLAND_SIGHTS.length,errors,local,offshore:!MAP_NAV.path};
  });
  assert.equal(result.count,6);assert.deepEqual(result.errors,[]);
  assert.equal(result.local,true);assert.equal(result.offshore,true);
}));

test('large island scenery has shared walking, aircraft and shot collision geometry and fitted bases',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const errors=[];
    for(const o of ISLAND_OBSTACLES) {
      const ground=terrainHeight(o.x,o.y),top=landmarkSurfaceHeight(o,o.x,o.y);
      const supported=o.z0<=ground+.001||ISLAND_OBSTACLES.some(other=>other!==o&&other.z1<=o.z0+.001&&Math.abs(landmarkSurfaceHeight(other,o.x,o.y)-o.z0)<.001);
      if(!supported||o.z1<ground)errors.push(['base',o.kind]);
      px=o.x-o.hl-.2;py=o.y;body.z=0;
      const visibleTop=Math.max(ground,...ISLAND_OBSTACLES.map(other=>landmarkSurfaceHeight(other,o.x,o.y)));
      if(free(o.x,o.y)||Math.abs(builtHeight(o.x,o.y)-visibleTop)>1e-6)errors.push(['collision',o.kind]);
      const z=ground+Math.min(.1,(top-ground)/2),hit=traceShot(o.x-o.hl-.2,o.y,z,1,0,0);
      if(hit.what!=='wall'||hit.x>o.x+o.hl)errors.push(['shot',o.kind,hit.what]);
    }
    const strip=[];for(let x=FERN_STRIP.x0-20;x<FERN_STRIP.x1+20;x+=.4)for(const y of [FERN_STRIP.y-1,FERN_STRIP.y,FERN_STRIP.y+1])
      if(islandSightBlocked(x,y,0)||terrainHeight(x,y)>.001)strip.push([x,y]);
    return {count:ISLAND_OBSTACLES.length,errors,strip};
  });
  assert.ok(result.count>=3);assert.deepEqual(result.errors,[]);assert.deepEqual(result.strip,[]);
}));

test('birds animate and take off from actual terrain or rock perches, while freecam leaves them undisturbed',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const ground=ISLAND_BIRDS.filter(b=>b.kind==='gull'),roost=ISLAND_BIRDS.filter(b=>b.kind==='cormorant'&&b.z>terrainHeight(b.x,b.y)+.2);
    const errors=[];
    for(const b of ISLAND_BIRDS) {
      const start=islandBirdPose({...b,seed:0,scaredAt:10},10),middle=islandBirdPose({...b,seed:0,scaredAt:10},13.5),end=islandBirdPose({...b,seed:0,scaredAt:10},17);
      if(Math.abs(start.z-b.z)>1e-6||middle.z<=start.z+.3||Math.abs(end.z-b.z)>1e-6)errors.push('flight arc');
    }
    const b=ground[0];px=b.x-.1;py=b.y;a=0;freecam={z:.5};const before=b.scaredAt;render(0);const frozen=b.scaredAt===before;
    freecam=null;render(0);const startled=b.scaredAt===T;
    return {gulls:ground.length,roost:roost.length,errors,frozen,startled};
  });
  assert.ok(result.gulls>=9);assert.equal(result.roost,2);
  assert.deepEqual(result.errors,[]);assert.equal(result.frozen,true);assert.equal(result.startled,true);
}));

test('native anglers cast into actual water and remain reachable for the normal fishing conversations',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const visitors=ANGLERS.filter(o=>o.x>465);
    return visitors.map(o=>{px=o.x-.15;py=o.y;return {dry:!isWater(o.x,o.y),level:terrainHeight(o.x,o.y),water:!!waterKind(o.x+Math.cos(o.a)*o.cast,o.y+Math.sin(o.a)*o.cast),talk:nearAngler()===o};});
  });
  assert.equal(result.length,2);
  assert.ok(result.every(v=>v.dry&&v.level===0&&v.water&&v.talk),JSON.stringify(result));
}));

test('winter removes flowering plants while day/night island scenes render without losing terrain support',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const shade=islandCoverShade;let flowers=0;
    islandCoverShade=(model,...args)=>{if(model.cover==='flower')flowers++;return shade(model,...args);};
    px=785.8;py=243.4;a=-Math.PI/2;pitch=0;
    setSeason(1);weather='clear';tod=12;env(0);render(0);const summer=flowers;
    flowers=0;setSeason(3);weather='snow';snowCover=.65;env(0);render(0);const winter=flowers;
    tod=21;env(0);T+=.2;render(0);
    islandCoverShade=shade;
    return {summer,winter,finite:Array.from(ZB).every(z=>Number.isFinite(z)||z===Infinity)};
  });
  assert.ok(result.summer>0,JSON.stringify(result));assert.equal(result.winter,0);assert.equal(result.finite,true);
}));

test('hillside triangles leave the entire narrow lighthouse deck level and its boards visible',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    let height=0;
    for(let y=FOOTBRIDGE.y0+.1;y<FOOTBRIDGE.y1;y+=.2)for(const off of [-.15,-.08,0,.08,.15])height=Math.max(height,terrainHeight(FOOTBRIDGE.x+off,y));
    px=FOOTBRIDGE.x;py=FOOTBRIDGE.y1-2;a=Math.PI/2;pitch=-.05;render(0);
    let deck=0,grass=0;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
      const i=r*cols+c,t=ZB[i];if(FL[i]!==1||!Number.isFinite(t)||t<=0)continue;
      const cx=2*c/cols-1,x=px+(dx-dy*tf*cx)*t,y=py+(dy+dx*tf*cx)*t;
      if(onFootbridge(x,y)){deck++;if(COL[i]>>4===GREEN)grass++;}
    }
    return {height,deck,grass};
  });
  assert.equal(result.height,0);assert.ok(result.deck>20,JSON.stringify(result));assert.equal(result.grass,0);
}));
