// The display is raycast in the window's own coordinates, behind its pane.
// Static miniature pieces are cached; only the three short train cars move.
const RAILWAY_MODELS=[], RAILWAY_TRAIN=[], RAILWAY_ENGINE=[], RAILWAY_PIECES=[];
const SCENE_LOOKS = {
  mover:figLook({hair:'short',hat:'cap',top:'jacket',col:{top:[BLUE,8],hat:[YEL,13],skin:[SKIN,12]}}),
  neighbor:figLook({hair:'bun',top:'long',col:{top:[GREEN,8],skin:[BRICK,11]}}),
  artist:figLook({hair:'pony',top:'long',col:{top:[MAG,8],skin:[SKIN,12]}}),
};
FIG_POSES.carry = f => ({...FIG_POSES.walk(f),arms:[[.8,.25,1.5,.2],[.8,.25,1.5,.2]],lean:.08});
function scenePoint(site,u,v) {
  return {x:site.x+site.c*u+site.nx*v,y:site.y+site.s*u+site.ny*v};
}
function sceneFace(b,f,along=(f.start+f.end)/2) {
  return {x:f.side?along:f.line,y:f.side?f.line:along,c:f.side?1:0,s:f.side?0:1,nx:f.nx,ny:f.ny,f,b};
}
function sceneSiteClear(site,width,depth) {
  for(let u=-width;u<=width;u+=.1)for(let v=.04;v<=depth;v+=.08) {
    const p=scenePoint(site,u,v);
    if(map[idx(p.x,p.y)]||isWater(p.x,p.y)||terrainHeight(p.x,p.y)>.005||streetGeometryCollision({x:p.x,y:p.y,c:1,s:0,hl:.025,hw:.025,z0:0,z1:.27}))return false;
    if(lamps.some(l=>near(l.x,l.y,p.x,p.y)<.09)||trees.some(t=>near(t.x,t.y,p.x,p.y)<.13)||machines.some(m=>near(m.x,m.y,p.x,p.y)<.13))return false;
  }
  return true;
}
function buildStreetScenes() {
  // Use a toy shop's actual street window without renaming it or moving its door.
  for(const word of ['TOYS','RECORDS','HARDWARE']) {
    for(const b of ARCH_BUILDINGS.filter(b=>b.sh.word===word&&b.sh.kind!==SHOP_SHUT&&['midtown','downtown'].includes(b.region))) {
      for(const f of b.faces.filter(f=>!f.low&&f.street&&f.end-f.start>=2)) {
        const site=sceneFace(b,f,f.start+(f.end-f.start)*.72);
        if(!sceneSiteClear(site,.43,.35))continue;
        Object.assign(site,{half:.36,z0:.055,z1:.305,depth:.43,name:'Little Loop window railway'});
        STREET_SCENES.railway=site;break;
      }
      if(STREET_SCENES.railway)break;
    }
    if(STREET_SCENES.railway)break;
  }
  for(const b of ARCH_BUILDINGS.filter(b=>b.region==='brownstones'&&b.sh.kind===SHOP_APTS)) {
    const f=b.faces.find(f=>f.front&&f.street&&f.end-f.start>=3);if(!f)continue;
    const site=sceneFace(b,f,f.start+.75);
    if(!sceneSiteClear(site,1,.6))continue;
    STREET_SCENES.moving=site;break;
  }
  for(let by=2;by<NB-2&&!STREET_SCENES.chalk;by++)for(let bx=2;bx<NB-2;bx++) {
    if(blockKind(bx,by)!=='plaza')continue;
    const x=bx*8+3.5,y=by*8+3.6;
    const clear=[[-.7,-.5],[.7,-.5],[-.7,.5],[.7,.5],[0,0]].every(([u,v])=>!map[idx(x+u,y+v)]&&!isWater(x+u,y+v)&&terrainHeight(x+u,y+v)<.005&&!solidAt(x+u,y+v,.05));
    if(clear){STREET_SCENES.chalk={x,y,half:.66,depth:.75,name:'The pavement artist'};break;}
  }
  buildRailwayModels();buildMovingModels();
}
function miniBox(x,y,hl,hw,z0,z1,base,kind='wall') {
  const o={x,y,hl,hw,z0,z1,c:1,s:0,base,kind};
  if(kind==='roof'||kind==='hill'&&z0>.1)o.planeData=roofPlaneData(landmarkPlanes(hl,hw,z0,z1,kind==='roof'?'crossgable':'hip'));
  RAILWAY_MODELS.push(o);return o;
}
function buildRailwayModels() {
  if(!STREET_SCENES.railway)return;
  // A station on the inside of the oval, a little town, and a hillside tunnel.
  miniBox(-.145,.184,.07,.022,.078,.083,STONE,'platform');
  miniBox(-.15,.215,.046,.022,.083,.125,WARM,'station');
  miniBox(-.15,.215,.053,.03,.125,.143,RED,'roof');
  miniBox(-.21,.215,.012,.02,.078,.147,STONE,'clock');
  for(const [x,y,h,base]of [[.13,.25,.05,BRICK],[.21,.25,.07,STONE],[.12,.31,.085,WARM]]) {
    miniBox(x,y,.025,.02,.078,.078+h,base,'house');
    miniBox(x,y,.031,.025,.078+h,.092+h,RED,'roof');
  }
  // A genuinely open tunnel: the train vanishes beneath the hill and emerges
  // through its other portal, instead of being painted on top of the scenery.
  miniBox(0,.32,.067,.057,.122,.169,GREEN,'hill');
  miniBox(0,.278,.067,.013,.078,.122,GREEN,'hill');
  // Portals leave the track through their middle, with a lintel above it.
  for(const x of [-.075,.075]) {
    for(const y of [.302,.359])miniBox(x,y,.008,.008,.078,.127,GRAY,'portal');
    miniBox(x,.33,.008,.036,.117,.133,GRAY,'portal');
  }
  for(const x of [-.05,.05])miniBox(x,.124,.007,.026,.062,.095,BRICK,'pier');
  miniBox(0,.125,.071,.021,.091,.096,STONE,'bridge');
  for(const v of [.104,.146])miniBox(0,v,.075,.003,.096,.11,GRAY,'railing');
  for(const [x,y,h]of [[-.28,.31,.05],[.28,.32,.07],[-.3,.12,.05],[.3,.17,.05],[.02,.24,.055]]) {
    miniBox(x,y,.003,.003,.078,.078+h,BRICK,'trunk');
    miniBox(x,y,.015,.012,.098,.078+h+.012,GREEN,'tree');
  }
  for(let k=0;k<3;k++)RAILWAY_TRAIN.push({x:0,y:0,hl:k?.026:.03,hw:.012,z0:.078,z1:.102,c:1,s:0,base:k?WARM:RED,kind:k?'coach':'engine'});
  for(const [offset,hl,hw,z0,z1,base,kind]of [[-.018,.012,.014,.018,.039,RED,'engine'],[.018,.006,.006,.025,.047,GRAY,'chimney']])
    RAILWAY_ENGINE.push({x:0,y:0,offset,hl,hw,z0,z1,dz0:z0,dz1:z1,c:1,s:0,base,kind});
  RAILWAY_PIECES.push(...RAILWAY_MODELS,...RAILWAY_TRAIN,...RAILWAY_ENGINE);
}
let railwayFrame=-1,railwayRunning=null,railwayDistance=0;
function updateWindowTrain() {
  const running=tod>=8&&tod<22||T<streetSceneState.demoUntil;
  if(railwayFrame===T&&railwayRunning===running)return;
  railwayFrame=T;railwayRunning=running;
  const clock=railwayClock();
  railwayDistance=clock.angle/TAU*RAILWAY_ARC[256]+RAILWAY_ARC[167];
  for(let k=0;k<RAILWAY_TRAIN.length;k++) {
    const p=railwayAtDistance(railwayDistance-k*.063),o=RAILWAY_TRAIN[k],len=Math.hypot(p.c,p.s);
    Object.assign(o,{x:p.x,y:p.y,z0:p.z,z1:p.z+.025,c:p.c/len,s:p.s/len});
  }
  const e=RAILWAY_TRAIN[0];
  for(const o of RAILWAY_ENGINE)Object.assign(o,{x:e.x+e.c*o.offset,y:e.y+e.s*o.offset,c:e.c,s:e.s,z0:e.z0+o.dz0,z1:e.z0+o.dz1});
}
function windowRailwayCell(i,u,uStep,z,h,d,side,mx,my,fog,wc) {
  const site=STREET_SCENES.railway;
  if(!site||SHOP[idx(mx,my)]!==site.b.sh||side!==site.f.side||z<site.z0-.01||z>site.z1+.04)return false;
  const dir=side?(py<my?0:1):(px<mx?2:3);
  if(dir!==site.f.dir||Math.abs(wc-(side?site.x:site.y))>site.half+.012)return false;
  const along=wc-(side?site.x:site.y),edge=site.half-Math.abs(along);
  if(Math.hypot(along-site.half+.022,z-.087)<.009) {
    BG[i]=C(YEL,7);set(i,'o',C(YEL,15));return true;
  }
  if(z>site.z1+.01) {
    const text='LITTLE LOOP / PUSH TO RUN',center=(Math.sign(u*wc)||1)*(side?site.x:site.y);
    if(wallText(i,u,uStep,z,d,text,center,.326,.022,.019,C(YEL,13),C(GREEN,2)))return true;
    return false;
  }
  if(edge<.009||z<site.z0+.01||z>site.z1-.01) {
    BG[i]=C(GREEN,3);set(i,z<site.z0+.01||z>site.z1-.01?'=':'|',C(YEL,10));return true;
  }
  updateWindowTrain();
  const normal=WH.dn,du=(along-((px-site.x)*site.c+(py-site.y)*site.s))/normal,dz=(z-eye)/normal;
  let distance=site.depth,base=BLUE,ch=' ',level=6;
  let hitU=along+du*distance,hitZ=z+dz*distance;
  // Painted dusk backdrop and distant hills stay behind the solid model.
  if(hitZ<.15+.025*Math.cos(hitU*23)){base=BLUE;ch='^';level=8;}
  if(Math.hypot((hitU+.12)/.1,(hitZ-.225)/.012)<1){base=WHITE;ch=' ';level=6;}
  if(Math.abs(du)>1e-8) {
    const wall=(Math.sign(du)*site.half-along)/du;
    if(wall>0&&wall<distance){distance=wall;base=GREEN;ch='|';level=4;}
  }
  const ceiling=(site.z1-.01-z)/dz;
  if(ceiling>0&&ceiling<distance){distance=ceiling;base=WARM;ch='=';level=4;}
  const table=(.078-z)/dz;
  if(table>0&&table<distance&&Math.abs(along+du*table)<site.half) {
    distance=table;const x=along+du*table,y=table;
    const river=Math.abs(x-.015*Math.sin(y*40))<.038;
    base=river?CYAN:GREEN;ch=river?(fract(y*110+T*.3)<.25?'~':' '):'.';level=river?10:5;
    const q=Math.hypot(x/.255,(y-.23)/.105),rail=Math.abs(q-1);
    if(rail<.07){base=rail<.022?YEL:BRICK;ch=rail<.022?'=':'#';level=rail<.022?13:7;}
    // A lighter gravel apron connects the station with the tiny houses.
    if(y>.21&&y<.285&&x>-.08&&x<.09){base=STONE;ch='.';level=7;}
  }
  let nearest=null,face=0,hu=0,hv=0,hz=0;
  for(const o of RAILWAY_PIECES) {
    const t=o.planeData?rayMansard(along,0,z,du,1,dz,o):rayBox(along,0,z,du,1,dz,o);
    if(t>0&&t<distance){distance=t;nearest=o;face=HIT.face;hu=HIT.u;hv=HIT.v;hz=HIT.w;}
  }
  if(nearest) {
    const o=nearest; base=o.base;level=face===5?12:face===3||face===4?9:7;ch=face===5?'_':' ';
    if(o.kind==='roof'){ch=face===5?'=':'/';level=10;}
    else if(o.kind==='tree'||o.kind==='hill'){ch=o.kind==='tree'?'%':':';level=face===5?10:5;}
    else if(o.kind==='portal'){ch=face===5?'_':'|';level=10;}
    else if(o.kind==='railing'){ch='=';level=11;}
    else if(o.kind==='station'||o.kind==='house') {
      if(face!==5&&hz>o.z0+.012&&hz<o.z1-.01&&Math.abs(fract(hu*120)-.5)<.27){base=YEL;ch='#';level=13;}
    } else if(o.kind==='clock'){ch=face===5?'_':hz>.124?'o':'|';level=13;}
    else if(o.kind==='coach'||o.kind==='engine') {
      const top=face===5,window=hz>o.z0+.009&&hz<o.z1-.004;
      if(top){base=GRAY;ch='_';level=10;}
      else if(window&&o.kind==='coach'){base=CYAN;ch=Math.abs(fract(hu*140)-.5)<.32?'#':'|';level=14;}
      else {ch=hz<o.z0+.005?'o':' ';level=12;}
      if(o.kind==='engine'&&face===1){base=YEL;ch='O';level=15;}
    }
  }
  // A restrained pane reflection, leaving the train's silhouette and colours clear.
  if(z>.19&&fract(along*3+z*1.6)<.007&&d<1.2&&!nearest){base=CYAN;ch='/';level=5;}
  BG[i]=C(base,Math.max(2,level*.33));set(i,ch,C(base,level));return true;
}
function movingBox(site,u,v,hl,hw,z0,z1,kind,base,leftover=false) {
  if(['van','cab','wheel','van-door'].includes(kind))u+=.5;
  const p=scenePoint(site,u,v),o={...p,c:site.c,s:site.s,hl,hw,z0,z1,kind,base,leftover};
  STREET_SCENES.boxes.push(o);return o;
}
function buildMovingModels() {
  const s=STREET_SCENES.moving;if(!s)return;
  // Kerb-side van and open cargo doors, with a clear strip of pavement beside it.
  movingBox(s,.05,.4,.29,.08,0,.24,'van',WHITE);
  movingBox(s,-.29,.4,.05,.08,0,.14,'cab',BLUE);
  for(const u of [-.28,.21])for(const v of [.325,.475])movingBox(s,u,v,.038,.009,0,.06,'wheel',GRAY);
  movingBox(s,.345,.325,.055,.007,.025,.23,'van-door',WHITE);
  movingBox(s,.345,.475,.055,.007,.025,.23,'van-door',WHITE);
  for(const [u,v,h]of [[-.43,.07,.09],[-.33,.07,.14],[.45,.07,.07],[.48,.14,.05]])movingBox(s,u,v,.045,.04,0,h,'box',WARM);
  movingBox(s,.03,.08,.135,.055,.02,.055,'sofa',GREEN);
  movingBox(s,.03,.035,.135,.018,.055,.115,'sofa',GREEN);
  for(const u of [-.12,.18])movingBox(s,u,.08,.02,.055,.02,.09,'sofa',GREEN);
  // A discarded lamp remains after the van leaves; it can be kept as a souvenir.
  movingBox(s,.46,.09,.03,.025,0,.012,'lamp-base',GRAY,true);
  movingBox(s,.46,.09,.005,.005,.012,.11,'lamp-stem',YEL,true);
  movingBox(s,.46,.09,.04,.035,.11,.16,'lamp-shade',ORANGE,true);
}
function movingShade(o,i,t,L) {
  const top=HIT.face===5,z=HIT.w;
  let base=o.base,ch=top?'_':' ',light=Math.max(4,L);
  if(o.kind==='wheel'){ch='@';light=3;}
  else if(o.kind==='box'){ch=Math.abs(HIT.u)<.009?'|':Math.abs(z-o.z1*.5)<.005?'-':top?'=':' ';}
  else if(o.kind==='sofa'){ch=top?'_':Math.abs(fract(HIT.u*25)-.5)<.06?'|':' ';}
  else if(o.kind==='van'&&HIT.face===1){base=GRAY;ch=' ';light=1;}
  else if(o.kind==='cab'&&!top&&z>.08){base=CYAN;ch='/';light=8;}
  else if(o.kind==='van'&&!top&&z>.09&&z<.19){base=BLUE;ch=' ';light=8;}
  if(o.kind==='van'&&(HIT.face===3||HIT.face===4)) {
    const along=HIT.face===3?HIT.u:-HIT.u,[vx,vy]=R(o.x,o.y);
    const letter=signLine('TWO TRIPS',along/.041+4.5,(.185-z)/.04,i,.165,midDepth(vx,vy),t,.041,.04,farDepth(vx,vy,o.hl),...faceDir(o.c,o.s));
    if(letter&&letter!==' '){ch=letter;base=WHITE;light=14;}
  }
  else if(o.kind==='lamp-stem')ch='|';
  BG[i]=C(base,light*.32);set(i,ch,C(base,light));
  if(top)paintSettledSnow(i,o.x+HIT.u*o.c-HIT.v*o.s,o.y+HIT.u*o.s+HIT.v*o.c,L,.75,0,z);
  return true;
}
function drawStreetScenes() {
  const m=STREET_SCENES.moving;
  if(m&&near(px,py,m.x,m.y)<vis) {
    for(const o of STREET_SCENES.boxes)if(streetSceneBoxActive(o)) {
      const [x,y]=R(o.x,o.y);drawBox({...o,x,y},(i,t,L)=>movingShade(o,i,t,L));
    }
    if(movingPhase()==='loading') {
      const shift=.34*Math.sin(T*.18),p=scenePoint(m,shift,.22),heading=Math.cos(T*.18)>0?1:-1;
      drawFigure(...R(p.x,p.y),0,.175,m.c*heading,m.s*heading,SCENE_LOOKS.mover,'carry'+(Math.floor(T*4)%8));
      const carried={x:p.x+m.c*heading*.025,y:p.y+m.s*heading*.025,c:m.c,s:m.s,hl:.028,hw:.025,z0:.07,z1:.115,base:WARM,kind:'box'};
      const [vx,vy]=R(carried.x,carried.y);drawBox({...carried,x:vx,y:vy},(i,t,L)=>movingShade(carried,i,t,L));
      const q=scenePoint(m,-.35,.18);
      drawFigure(...R(q.x,q.y),0,.17,m.nx,m.ny,SCENE_LOOKS.neighbor,'fold');
    }
  }
  const c=STREET_SCENES.chalk;
  if(c&&tod>=9&&tod<17&&rain<.2&&snow<.2&&snowCover<.15&&chalkWash()<.65&&near(px,py,c.x,c.y)<vis) {
    const x=c.x+.6,y=c.y+.55;
    drawFigure(...R(x,y),terrainHeight(x,y),.17,-.6,-.8,SCENE_LOOKS.artist,fract(T*.12)<.8?'crouch':'stand');
    drawArt(...R(x+.1,y),.005,.045,.04,[' ___ ','|===|','|___|'],()=>C(MAG,10));
  }
}
// A cached pavement stencil, rather than repeated screen letters stretched over
// the floor. Each brush stroke remembers when the artist adds it to the picture.
const CHALK_W=160,CHALK_H=100,CHALK_INK=new Uint8Array(CHALK_W*CHALK_H),CHALK_ORDER=new Float32Array(CHALK_W*CHALK_H);
function chalkStroke(points,base,order,width=.012) {
  for(let k=1;k<points.length;k++) {
    const [ax,ay]=points[k-1],[bx,by]=points[k],len=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(len*200));
    for(let n=0;n<=steps;n++) {
      const x=ax+(bx-ax)*n/steps,y=ay+(by-ay)*n/steps;
      for(let gy=Math.max(0,Math.floor((y-width)*CHALK_H));gy<=Math.min(CHALK_H-1,Math.ceil((y+width)*CHALK_H));gy++)
        for(let gx=Math.max(0,Math.floor((x-width)*CHALK_W));gx<=Math.min(CHALK_W-1,Math.ceil((x+width)*CHALK_W));gx++)
          if(Math.hypot((gx+.5)/CHALK_W-x,(gy+.5)/CHALK_H-y)<width) {
            const i=gy*CHALK_W+gx;CHALK_INK[i]=base;CHALK_ORDER[i]=order+(k-1+n/steps)/points.length*.09;
          }
    }
  }
}
function buildChalkPicture() {
  chalkStroke([[.69,.41],[.57,.35],[.31,.35],[.16,.4],[.09,.48],[.08,.59],[.14,.7],[.28,.75],[.51,.75],[.64,.69],[.7,.57]],CYAN,.03,.014);
  chalkStroke([[.64,.69],[.76,.72],[.9,.63],[.87,.43],[.8,.54],[.7,.57]],CYAN,.22,.014);
  chalkStroke([[.3,.69],[.34,.82],[.44,.79],[.48,.73]],BLUE,.29,.013);
  chalkStroke([[.57,.48],[.585,.48]],WHITE,.36,.014);
  chalkStroke([[.6,.59],[.56,.63],[.47,.65]],CYAN,.39,.01);
  // Four little towers sit on the whale's broad back.
  for(const [x,h]of [[.25,.1],[.33,.19],[.43,.14],[.52,.23]]) {
    chalkStroke([[x,.35],[x,.35-h],[x+.055,.35-h],[x+.055,.35]],YEL,.45+(x-.25)*.5,.01);
    for(let y=.35-h+.035;y<.33;y+=.045)chalkStroke([[x+.025,y],[x+.031,y]],YEL,.65,.007);
  }
  for(const [x,y]of [[.16,.22],[.65,.15],[.75,.29]]) {
    chalkStroke([[x-.018,y],[x+.018,y]],WHITE,.78,.007);
    chalkStroke([[x,y-.024],[x,y+.024]],WHITE,.78,.007);
  }
  for(const x of [.12,.56,.8])chalkStroke([[x,.83],[x+.025,.815],[x+.05,.83],[x+.075,.815]],BLUE,.83,.008);
  const text='THE CITY SAILS',scale=.025;
  for(let k=0;k<text.length;k++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(glyphOn(text[k],x,y)) {
    const x0=Math.floor((.29+k*scale+x*scale/4)*CHALK_W),y0=Math.floor((.91+y*.009)*CHALK_H);
    for(let gy=y0;gy<=y0+1&&gy<CHALK_H;gy++)for(let gx=x0;gx<=x0+1&&gx<CHALK_W;gx++) {
      const i=gy*CHALK_W+gx;CHALK_INK[i]=MAG;CHALK_ORDER[i]=.9+k*.004;
    }
  }
}
buildChalkPicture();
function streetChalkCell(i,wx,wy,L) {
  const c=STREET_SCENES.chalk;if(!c||snowCover>.15||Math.abs(wx-c.x)>c.half)return false;
  // White footprints mark the artist's intended viewpoint. The long, tapered
  // pavement drawing resolves into the whale and skyline when viewed here.
  if(Math.abs(wy-c.y-1.08)<.045&&Math.min(Math.abs(wx-c.x-.028),Math.abs(wx-c.x+.028))<.013) {
    BG[i]=C(WHITE,3);set(i,':',C(WHITE,Math.max(5,L)));FL[i]=1;return true;
  }
  if(Math.abs(wy-c.y)>c.depth)return false;
  const wash=chalkWash(),progress=chalkProgress();let base=0,count=0;
  const depth=ZB[i],row=Math.floor(i/cols),r=row-hor+.5;
  // Sample the ground footprint of this character, so thin strokes survive a
  // normal standing view instead of falling between rows of the floor texture.
  for(const oy of [-.3,0,.3])for(const ox of [-.3,0,.3]) {
    const ratio=r/(r+oy),xw=px+(wx-px)*ratio-dy*depth/projX*ox,yw=py+(wy-py)*ratio+dx*depth/projX*ox;
    const fromView=c.y+1.1-yw;
    if(fromView<.43||fromView>1.8)continue;
    const x=Math.floor((.5+(xw-c.x)/(fromView*.6))*CHALK_W);
    const y=Math.floor((.17/fromView-.17/1.8)/(.17/.43-.17/1.8)*CHALK_H);
    if(x<0||y<0||x>=CHALK_W||y>=CHALK_H)continue;
    const at=y*CHALK_W+x,ink=CHALK_INK[at];
    if(!ink||CHALK_ORDER[at]>progress||hash(x,y,2011)<wash)continue;
    base=ink;count++;
  }
  if(!count)return false;
  BG[i]=C(base,(2+count*.35)*(1-wash*.7));
  set(i,count>3?':':'.',C(base,Math.max(3,L*(1.4-wash*.8))));FL[i]=1;return true;
}
function streetSceneNear() {
  if(mode!=='walk'||body.z>.15||freecam)return null;
  const r=STREET_SCENES.railway;
  if(r) {
    const p=scenePoint(r,0,.17);
    if(near(px,py,p.x,p.y)<.34)return 'railway';
  }
  const m=STREET_SCENES.moving;
  if(m&&movingPhase()==='loading') {
    const person=scenePoint(m,-.35,.18),vx=person.x-px,vy=person.y-py,distance=Math.hypot(vx,vy);
    if(distance<.24&&(distance<.05||(Math.cos(a)*vx+Math.sin(a)*vy)/distance>.5))return 'moving';
  }
  if(m&&movingPhase()==='leftovers'&&streetSceneState.lampWeek!==movingWeek()) {
    const lamp=scenePoint(m,.46,.09);
    if(near(px,py,lamp.x,lamp.y)<.24)return 'moving';
  }
  const c=STREET_SCENES.chalk;
  if(c&&near(px,py,c.x,c.y)<1.25)return 'chalk';
  return null;
}
function streetScenePrompt() {
  const which=streetSceneNear();
  if(which==='railway')return 'E: press the window railway button';
  if(which==='moving')return movingPhase()==='loading'?'E: talk to the movers':streetSceneState.lampWeek===movingWeek()?'Moving day is over. The pavement is clear.':'E: take the free lamp';
  if(which==='chalk')return 'E: look at the chalk drawing';
  return '';
}
DROPPED_ART.movinglamp=()=>[['   ___   ','  /   \\  ',' /_____\\ ','    |    ','    |    ','  __|__  '],(ch,row)=>C(row<3?ORANGE:GRAY,12)];
function streetSceneUse() {
  const which=streetSceneNear();if(!which)return false;
  if(which==='railway') {
    streetSceneState.demoUntil=T+48;
    say('You press the brass button. The Little Loop starts its demonstration: a red engine, two coaches, a river bridge and the hillside tunnel. A hand-lettered card says: "Built here. Please enjoy the view."',7);
  } else if(which==='moving') {
    if(movingPhase()==='loading')say(fract(T*.05)<.5?'"It fitted through the old door," the mover says. "We measured everything except the new one."':'"Books in the small boxes, pillows in the big ones. Wish we had remembered that this morning."',6);
    else if(streetSceneState.lampWeek!==movingWeek()) {
      if(inv.length>=INV_SIZE){say('Your bag is full. The lamp can wait.');return true;}
      carryItem({id:'movinglamp',uses:0},false);streetSceneState.lampWeek=movingWeek();saveGame();say('FREE TO A GOOD HOME. You take the little amber table lamp. It will fit on your display shelf.',5);
    } else say('The van has gone. Just a rectangle of clean pavement where the boxes stood.',4);
  } else say(snowCover>.15?'Snow covers the artist\'s patch of paving. The chalk box is packed away.':chalkWash()>.65?'Rain has almost erased the whale and its impossible city. A few blue chalk lines linger between the paving stones.':tod<9?'Clean paving. The artist usually starts around nine.':chalkProgress()<.5?'A chalk whale is taking shape. The artist taps a blue stick against the paving. "Come back later. It is taking the whole city for a ride. Stand on the white footprints for the best view."':'THE CITY SAILS. Stand on the white footprints: the stretched chalk lines resolve into a turquoise whale carrying a tiny golden skyline. From the side, the city tumbles back into streaks of chalk.',6);
  return true;
}
buildStreetScenes();
