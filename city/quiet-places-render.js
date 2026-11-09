// Close detail uses the cabin's analytic rounded solids and vessels. Models
// prepare once; the pump, water and wind cups are the only moving pieces.
function quietPart(s,role,u,v,hl,hw,z0,z1,material='stone',block=false,extra={}){
 const p={role,x:s.x+u,y:s.y+v,c:1,s:0,hl,hw,z0:s.base+z0,z1:s.base+z1,material,block,...extra};
 s.parts.push(p);return p;
}
function quietVessel(s,role,u,v,z,profile,material='clay',block=false){
 const r=Math.max(...profile.map(p=>p[1]));
 return quietPart(s,role,u,v,r,r,z,z+Math.max(...profile.map(p=>p[0])),material,block,{profile:profile.map(([h,r])=>[s.base+z+h,r])});
}
function quietTimber(s,role,u,v,hl,hw,z0,z1,block=false){return quietPart(s,role,u,v,hl,hw,z0,z1,'wood',block,{round:.001});}
function quietBench(s,u,v){
 for(const x of [-.067,.067])for(const y of [-.021,.021])quietPart(s,'bench-leg',u+x,v+y,.004,.004,0,.043,'iron',true);
 for(const y of [-.019,0,.019])quietTimber(s,'bench-slat',u,v+y,.095,.008,.043,.049,true);
 for(const x of [-.075,.075])quietPart(s,'bench-upright',u+x,v+.032,.003,.003,.015,.105,'iron');
 for(const z of [.067,.09])quietTimber(s,'bench-back',u,v+.032,.095,.006,z,z+.014);
}
function quietPlanter(s,u,v,hl=.12,hw=.065,tall=false){
 const top=tall?.07:.045;
 quietPart(s,'planter-soil',u,v,hl-.006,hw-.006,0,top-.008,'soil',true);
 for(const side of [-1,1]){
  quietTimber(s,'planter-board',u,v+side*(hw-.003),hl,.003,0,top,true);
  quietTimber(s,'planter-end',u+side*(hl-.003),v,.003,hw-.006,0,top,true);
 }
 for(let j=0;j<5;j++){
  const x=u+(j-2)*hl*.34,y=v+(j%2-.5)*hw*.7,h=top+.035+(j%3)*.012;
  quietPart(s,'plant-stem',x,y,.001,.001,top-.008,h,'iron');
  for(const side of [-1,1])quietPart(s,'leaves',x+side*.012,y,.022,.019,h-.025,h+.012,'leaf',false,{ellipsoid:true,seed:j});
  if(tall){quietPart(s,'plant-stake',x,y+.01,.0015,.0015,top-.005,top+.12,'wood');
   for(const side of [-1,1])quietPart(s,'fruit',x+side*.012,y-.012,.006,.006,h-.014,h-.002,'fruit',false,{ellipsoid:true});}
 }
}
function quietPlaque(s,u,v,text,width=.14,z=.105){
 quietPart(s,'plaque',u,v,width,.003,z,z+.045,'enamel',false,{text});
}
function quietRoofGarden(s){
 // Two long planting beds flank a clear central path and lift landing.
 for(const v of [-.45,.45])for(const u of [-.58,0,.58])quietPlanter(s,u,v,.23,.09,v<0);
 for(let u=-.85;u<.9;u+=.18)quietPart(s,'path-paver',u,0,.083,.1,0,.003,'paver');
 quietBench(s,.65,.18);
 // Potting bench: open shelf, individually supported slats, pots and compost.
 for(const u of [-.10,.10])for(const v of [-.04,.04])quietTimber(s,'table-leg',-.7+u,.18+v,.004,.004,0,.085,true);
 quietTimber(s,'potting-top',-.7,.18,.125,.06,.085,.092,true);
 quietTimber(s,'potting-shelf',-.7,.18,.11,.05,.027,.033);
 for(const [u,v,z]of [[-.76,.17,.092],[-.64,.19,.092],[-.7,.18,.033]])quietVessel(s,'flowerpot',u,v,z,[[0,.012],[.003,.014],[.027,.019],[.029,.021],[.032,.021],[.032,.016],[.007,.009]],'clay');
 quietVessel(s,'water-barrel',.9,-.08,0,[[0,.035],[.005,.039],[.115,.039],[.12,.042],[.124,.042],[.124,.034],[.014,.034]],'paint',true);
 quietPart(s,'barrel-water',.9,-.08,.033,.033,.104,.106,'water',false,{ellipsoid:true});
 quietPart(s,'barrel-tap',.9,-.125,.004,.012,.028,.035,'brass');
 quietVessel(s,'watering-can',-.59,.17,.092,[[0,.012],[.004,.018],[.024,.018],[.026,.012],[.026,.009],[.009,.009]],'paint');
 const spout=quietPart(s,'can-spout',-.565,.17,.018,.003,.1,.108,'paint');spout.c=Math.cos(.3);spout.s=Math.sin(.3);
 // Trellis lives behind the bed, clear of both roof access and parapet.
 for(const u of [-.8,.8])quietTimber(s,'trellis-post',u,-.58,.004,.004,0,.26,true);
 for(const z of [.11,.18,.25])quietTimber(s,'trellis-rail',0,-.58,.8,.003,z,z+.006);
 for(let u=-.72;u<.8;u+=.12)quietTimber(s,'trellis-spar',u,-.58,.002,.002,.08,.25);
 quietPlaque(s,0,-.572,'PLEASE WATER',.16);
 s.targets.push({u:.36,v:-.16,z0:.03,z1:.18,label:'talk to the gardener',when:quietGardenerHere,text:()=>seasonIdx()===3?'“It looks empty now, but leave the stalks. The finches eat better than we do in January.” She checks the barrel tap once more.':'“The landlord called this wasted space. Now half the building comes up for tomatoes.” She presses a seedling back into its bed. “Take the lift. There is no prize for climbing the drainpipe.”'});
 quietPart(s,'planting-notebook',-.7,.205,.035,.023,.092,.098,'book');
 quietPart(s,'notebook-page',-.7,.205,.032,.02,.098,.0985,'chart');
 quietPart(s,'notebook-glass-weight',-.7,.205,.032,.02,.0985,.1,'glass');
 s.targets.push({u:-.7,v:.255,z0:.092,z1:.105,label:'read the planting notebook',text:()=>seasonIdx()===3?'A notebook under a glass tile: “Leave the seed heads for the birds. Shut the barrel tap before the frost. The first bulbs are under the east bed.”':'A notebook under a glass tile: “Water at the roots, not the leaves. The tomatoes are for everyone upstairs. Leave a few ripe ones for Mrs. Vale on the second floor.”'});
}
function quietCourtyard(s){
 // Walled garden with a dog-leg entrance: the opening is a real gap, not a
 // door texture. The southern approach and middle of the court stay empty.
 for(const u of [-.94,.94])quietPart(s,'garden-wall',u,0,.025,.83,0,.24,'brick',true);
 quietPart(s,'garden-wall',0,-.83,.965,.025,0,.24,'brick',true);
 for(const [u,hl]of [[-.64,.325],[.64,.325]])quietPart(s,'entry-return',u,.83,hl,.025,0,.24,'brick',true);
 for(const u of [-.94,.94])quietPart(s,'wall-coping',u,0,.034,.86,.24,.257,'stone');
 quietPart(s,'wall-coping',0,-.83,.965,.034,.24,.257,'stone');
 for(let u=-.8;u<=.8;u+=.2)for(let v=-.7;v<=.7;v+=.2)quietPart(s,'court-paver',u,v,.096,.096,0,.003,'paver');
 quietBench(s,-.5,-.48);quietBench(s,.5,-.48);
 for(const u of [-.62,.62])quietPlanter(s,u,.23,.15,.1);
 // Open stone trough, recessed water surface, brass outlet and iron pump.
 for(const u of [-.125,.125])quietPart(s,'trough-end',u,-.55,.012,.07,0,.065,'stone',true);
 for(const v of [-.608,-.492])quietPart(s,'trough-side',0,v,.113,.012,0,.065,'stone',true);
 quietPart(s,'trough-bottom',0,-.55,.113,.046,0,.012,'stone',true);
 quietPart(s,'trough-water',0,-.55,.11,.045,.034,.035,'water');
 quietPart(s,'pump-base',0,-.72,.035,.03,0,.018,'iron',true);
 quietPart(s,'pump-body',0,-.72,.014,.014,.018,.17,'paint',true,{round:.004});
 quietPart(s,'pump-head',0,-.72,.025,.02,.15,.176,'paint',false,{round:.005});
 quietPart(s,'pump-spout',0,-.675,.005,.037,.13,.14,'brass');
 quietPart(s,'pump-handle',.033,-.72,.006,.004,.10,.20,'iron',false,{moving:'handle'});
 // Pergola casts an open silhouette; no opaque canopy over the garden.
 for(const u of [-.77,.77])for(const v of [-.68,-.3])quietTimber(s,'pergola-post',u,v,.006,.006,0,.28,true);
 for(const v of [-.68,-.3])quietTimber(s,'pergola-beam',0,v,.8,.009,.265,.28);
 for(let u=-.77;u<=.8;u+=.11)quietTimber(s,'pergola-lath',u,-.49,.005,.28,.28,.288);
 for(let j=0;j<10;j++)quietPart(s,'climber',-.72+j*.16,-.68,.08,.04,.23,.30,'leaf',false,{ellipsoid:true,seed:j});
 quietPlaque(s,.55,.798,'WELL COURT',.18);
 quietPart(s,'lamp-plate',-.55,-.796,.026,.006,.16,.22,'iron');
 quietPart(s,'lamp-globe',-.55,-.779,.018,.015,.17,.21,'lamp',false,{ellipsoid:true});
 quietPart(s,'lamp-cap',-.55,-.779,.023,.02,.21,.217,'iron');
 s.lamp={x:s.x-.55,y:s.y-.779,z:s.base+.19};
 s.targets.push({u:.033,v:-.7,z0:.1,z1:.2,label:'work the hand pump',action:'pump'});
 s.targets.push({u:.55,v:.79,z0:.105,z1:.15,label:'read the little plaque',text:'WELL COURT · 1931. A worn plaque: “Maintained by the residents of the adjoining houses.” Under it, in newer paint: “No bookings. No purchases. Just sit a while.”'});
}
function quietChartRoom(s){
 // A 9 x 11 metre brick room: broken roof bays, a door wide enough to walk
 // through, and an open sea-facing window framed by real reveals.
 for(const u of [-.48,.48])quietPart(s,'station-wall',u,0,.025,.56,0,.31,'brick',true);
 quietPart(s,'station-back',0,-.56,.505,.025,0,.31,'brick',true);
 for(const u of [-.345,.345])quietPart(s,'door-jamb',u,.56,.16,.025,0,.31,'brick',true);
 quietPart(s,'door-head',0,.56,.185,.025,.25,.31,'brick',true);
 // Cut a window through the west wall by replacing the full slab.
 const west=s.parts.find(p=>p.role==='station-wall'&&p.x<s.x);s.parts.splice(s.parts.indexOf(west),1);
 for(const v of [-.415,.415])quietPart(s,'window-pier',-.48,v,.025,.145,0,.31,'brick',true);
 for(const [lo,hi]of [[0,.105],[.23,.31]])quietPart(s,'window-spandrel',-.48,0,.025,.27,lo,hi,'brick',true);
 quietPart(s,'window-sill',-.48,0,.042,.28,.098,.108,'stone');
 for(const v of [-.27,.27])quietTimber(s,'window-frame',-.48,v,.031,.004,.108,.23);
 for(const z of [.112,.226])quietTimber(s,'window-frame',-.48,0,.031,.27,z,z+.005);
 quietTimber(s,'window-mullion',-.48,0,.031,.004,.115,.226);
 quietPart(s,'station-floor',0,0,.45,.53,0,.003,'paver');
 // Surviving roof boards leave a broad skylight into the room. Rafters remain.
 for(const v of [-.45,0,.45])quietTimber(s,'roof-rafter',0,v,.51,.009,.29,.305);
 for(const u of [-.38,-.29,.29,.38])quietTimber(s,'roof-board',u,0,.042,.59,.306,.315);
 for(const v of [-.56,.56])quietPart(s,'roof-fascia',0,v,.53,.006,.303,.325,'wood');
 // Peeling door rests against the inside wall rather than blocking the exit.
 quietTimber(s,'fallen-door',.425,.24,.012,.13,.01,.225,true);
 for(const z of [.04,.18])quietPart(s,'door-hinge',.407,.33,.003,.008,z,z+.01,'iron');
 // Chart desk, shallow map drawer and measuring instruments.
 for(const u of [-.12,.12])for(const v of [-.045,.045])quietTimber(s,'desk-leg',u,-.37+v,.005,.005,0,.082,true);
 quietTimber(s,'desk-top',0,-.37,.16,.07,.082,.091,true);
 quietTimber(s,'desk-drawer',0,-.37,.14,.06,.052,.077,true);
 quietPart(s,'drawer-pull',0,-.3,.018,.004,.061,.065,'brass');
 quietPart(s,'chart',-.02,-.37,.105,.05,.091,.0913,'chart');
 quietPart(s,'desk-ledger',-.115,-.39,.027,.04,.091,.097,'book');
 quietPart(s,'chart-rule',.045,-.37,.002,.045,.0914,.093,'brass');
 quietPart(s,'pencil',-.07,-.34,.023,.001,.0914,.093,'wood');
 quietVessel(s,'mug',.12,-.39,.091,[[0,.007],[.002,.011],[.02,.011],[.021,.009],[.004,.009]],'enamel');
 quietTimber(s,'shelf',.37,-.24,.065,.22,.2,.206);
 for(let j=0;j<4;j++)quietTimber(s,'shelf-bracket',.39,-.4+j*.11,.035,.004,.175,.2);
 for(let j=0;j<5;j++)quietPart(s,'logbook',.37,-.4+j*.06,.045,.015,.206,.24,'book');
 // Fuse box has an empty mounting plate and disconnected conduit, not light.
 quietPart(s,'fusebox',0,-.529,.045,.008,.17,.235,'iron');
 for(const u of [-.02,0,.02])quietPart(s,'fuse-socket',u,-.519,.006,.003,.185,.199,'enamel');
 quietPart(s,'conduit',.08,-.526,.002,.003,.09,.28,'iron');
 quietPart(s,'rust-stain',.08,-.529,.009,.0005,.045,.12,'rust');
 quietPlaque(s,0,.589,'TIDE OFFICE',.16,.262);
 // Weather mast beside the hut, with an operating cup assembly.
 quietPart(s,'mast-base',.8,-.3,.04,.04,0,.018,'stone',true);
 quietPart(s,'weather-mast',.8,-.3,.004,.004,.018,.58,'iron',true);
 quietPart(s,'mast-collar',.8,-.3,.012,.012,.48,.49,'brass');
 for(let j=0;j<3;j++){
  const a=j*TAU/3;
  quietPart(s,'wind-arm',.8+Math.cos(a)*.03,-.3+Math.sin(a)*.03,.032,.002,.54,.544,'iron',false,{moving:'wind',angle:a});
  quietPart(s,'wind-cup',.8+Math.cos(a)*.065,-.3+Math.sin(a)*.065,.012,.012,.531,.55,'brass',false,{ellipsoid:true,moving:'cup',angle:a});
 }
 s.targets.push({u:0,v:-.29,z0:.09,z1:.12,label:'read the last tide ledger',text:'The final ledger entry is dated October 17. “Recorder failed again. Took the six o’clock reading by hand. Key left with the harbour office.” A pencilled line under it: “Back after the storm.” Salt has curled every page after that.'});
}
function quietSiteClear(x,y,hx,hy){
 let lo=Infinity,hi=-Infinity;
 for(let u=-hx;u<=hx+.0001;u+=.16)for(let v=-hy;v<=hy+.0001;v+=.16){
  const xx=x+u,yy=y+v;
  if(map[idx(xx,yy)]||ROAD[idx(xx,yy)]||isWater(xx,yy)||onPier(xx,yy)||architectureBlocked(xx,yy,.06)||landmarkBlocked(xx,yy,.06)||solidAt(xx,yy,.06)||kerbAt(xx,yy,.06))return null;
  const h=roadGroundHeight(xx,yy);lo=Math.min(lo,h);hi=Math.max(hi,h);
 }
 if(hi-lo>.012)return null;
 const nearRect=(o,pad)=>Math.abs(o.x-x)<hx+pad&&Math.abs(o.y-y)<hy+pad;
 if(trees.some(o=>nearRect(o,.3))||benches.some(o=>nearRect(o,.15))||SKATE_PATCHES.some(o=>Math.abs(o.x-x)<hx+o.hl+.3&&Math.abs(o.y-y)<hy+o.hw+.3))return null;
 if(QUIET_PLACES.some(s=>near(s.x,s.y,x,y)<6))return null;
 return hi+.003;
}
function quietSite(type,x,y,base,halfX,halfY,name,description){
 const s={id:'quiet:'+type,type,x,y,base,halfX,halfY,radius:Math.hypot(halfX,halfY)+.15,name,description,parts:[],targets:[],flowUntil:-1};
 QUIET_PLACES.push(s);return s;
}
function buildQuietPlaces(){
 // An existing apartment lift provides real roof access. Do not displace
 // courier routes, roof machinery, tenants, street entrances or vegetation.
 for(const b of ARCH_BUILDINGS){
  if(!b.access||b.sh.kind!==SHOP_APTS||b.sh.wilderness||b.x1-b.x0<3||b.y1-b.y0<3||b.h<.8)continue;
  const door=doors.find(d=>d.sh===b.sh);if(!door)continue;
  const x=b.x0+1.2,y=b.y0+.8;
  if(roofs.some(o=>near(o.x,o.y,x,y)<1.5)||COURIER_SCENERY.some(o=>near(o.x,o.y,x,y)<2)||COURIER_SURFACES.some(o=>near(o.x,o.y,x,y)<2))continue;
  const s=quietSite('roof',x,y,b.h,1.05,.65,'Vale House · rooftop allotment','Raised tomato beds, a potting bench and a rain barrel above the neighbourhood. Enter the apartment lobby and take its existing lift to the roof. A resident tends the beds during the day.');
  s.entry={x:door.x,y:door.y};s.building=b;quietRoofGarden(s);break;
 }
 // An unused yard corner, never a park desire line or a street pavement.
 outer:for(let by=0;by<NB;by++)for(let bx=0;bx<NB;bx++){
  if(blockKind(bx,by)!=='yard')continue;
  for(const [u,v]of [[3.5,6.6],[6.5,3.5],[4,4]]){
   const x=bx*8+u,y=by*8+v,base=quietSiteClear(x,y,1.1,1.12);if(base===null)continue;
   const s=quietSite('court',x,y,base,1,.9,'Well Court','A small brick enclosure tucked into an open yard. An unmarked entrance opens onto worn paving, a vine pergola and a hand pump over a stone trough.');
   s.entry={x,y:y+1.03};quietCourtyard(s);break outer;
  }
 }
 // A dry coastal verge: deliberately away from the marina, piers and traffic.
 const shore=[];
 for(let y=64;y<400;y+=2)for(let x=56;x<480;x+=2){
  if(!naturalCoastAt(x,y)||isWater(x,y)||map[idx(x,y)]||ROAD[idx(x,y)])continue;
  const waterDistance=[[-2,0],[2,0],[0,-2],[0,2],[-3,0],[3,0],[0,-3],[0,3]].some(([u,v])=>isWater(x+u,y+v));
  if(waterDistance)shore.push({x,y});
 }
 for(const {x,y}of shore){
  const base=quietSiteClear(x,y,1.02,1.02);if(base===null)continue;
  const s=quietSite('shore',x,y,base,.52,.61,'Old tide office','An abandoned brick chart room on the shore. Walk through the missing door: salt-curled tide ledgers, an empty fuse box and a draught through the roof. The weather cups outside still turn.');
  s.entry={x,y:y+.73};quietChartRoom(s);
  // Turn the whole room so its open window actually faces the nearest water.
  const [wx,wy]=[[-3,0],[0,-3],[3,0],[0,3]].find(([u,v])=>isWater(x+u,y+v))||[-1,0];
  const turn=Math.atan2(-wy,-wx),c=Math.cos(turn),sn=Math.sin(turn);
  s.turn=turn;
  for(const p of s.parts){const u=p.x-x,v=p.y-y;p.x=x+c*u-sn*v;p.y=y+sn*u+c*v;const pc=p.c;p.c=c*pc-sn*p.s;p.s=sn*pc+c*p.s;}
  for(const t of s.targets){const u=t.u;t.u=c*u-sn*t.v;t.v=sn*u+c*t.v;}
  s.entry={x:x-sn*.73,y:y+c*.73};
  if(Math.abs(sn)>.5)[s.halfX,s.halfY]=[s.halfY,s.halfX];
  break;
 }
 mapPlaceCache=null;
}
function quietMaterial(p,i,t,L){
 const face=HIT.face,top=face===5,fp=t/projY,fine=coveDetail(t,.1);
 let base=STONE,level=2.2+L*.29;
 if(p.material==='lamp'){BG[i]=C(WARM,lampsOn?12:3+L*.3);set(i,' ',0);return true;}
 if(p.material==='wood')return coveTimber(i,HIT.u,HIT.w,L,t,face===1?1:face===2?-1:0,face===3?1:face===4?-1:0,top?1:0,3,.1);
 if(p.material==='iron'||p.material==='brass')return coveMetal(i,L,face===1?1:face===2?-1:0,face===3?1:face===4?-1:0,top?1:0,p.material==='brass'?YEL:GRAY);
 if(p.material==='brick'){
  const z=HIT.w,along=face<3?HIT.v:HIT.u,row=Math.floor(z/.0075);
  const mortar=coveGroove(z,.0075,.0008,fp)+coveGroove(along+(row&1)*.012,.024,.001,fp);
  base=mortar>.5?GRAY:BRICK;level=1.3+L*.22+(hash(Math.floor(along/.024),row,2371)-.5)*fine;
 }else if(p.material==='leaf'){
  const h=(HIT.w-p.z0)/(p.z1-p.z0);base=seasonIdx()===2?ORANGE:GREEN;level=(1.4+L*.27)*(.7+h*.4+leafClump(HIT.u*120,HIT.v*120)*fine*.3);
 }else if(p.material==='soil'){base=BRICK;level=.5+L*.07+Math.sin(HIT.u*430+HIT.v*330)*fine*.12;}
 else if(p.material==='clay'){base=ORANGE;level=2+L*.27-coveGroove(HIT.w,.006,.0008,fp)*.3;}
 else if(p.material==='fruit'){base=seasonIdx()===3?BRICK:RED;level=2+L*.35;}
 else if(p.material==='paint'){base=GREEN;level=1.2+L*.22+(top?.8:0);if(fine>.2&&hash(Math.floor(HIT.u*900),Math.floor(HIT.w*900),2372)>.92)base=BRICK;}
 else if(p.material==='glass'){if(top&&Math.abs(HIT.u)<p.hl-.001&&Math.abs(HIT.v)<p.hw-.001&&snowCover<.2)return false;base=CYAN;level=2+L*.2+(top?1:0);}
 else if(p.material==='water'){base=CYAN;level=2+L*.3+Math.sin((HIT.u+HIT.v)*160+T*2)*.35;}
 else if(p.material==='enamel'){base=WARM;level=2.5+L*.35;}
 else if(p.material==='rust'){base=BRICK;level=1+L*.14;}
 else if(p.material==='book'){base=GREEN;level=1.2+L*.17;}
 else if(p.material==='chart'){
  base=WARM;level=2.5+L*.32;
  // Faded contour and grid lines lie on the paper, not floating text.
  if(top){const grid=Math.min(coveGroove(HIT.u,.025,.0004,fp)+coveGroove(HIT.v,.025,.0004,fp),1);const shore=coveGroove(HIT.u+.02*Math.sin(HIT.v*55),.095,.001,fp);level-=grid*.7+shore*1.6;}
 }else if(p.material==='paver'){
  base=GRAY;level=1.5+L*.27;const seam=coveGroove(HIT.u,.1,.002,fp)+coveGroove(HIT.v,.1,.002,fp);level-=seam*.7;
 }
 BG[i]=C(base,level*shadeFace(face));set(i,' ',0);
 if(p.text&&(face===3||face===4)){
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const normal=-p.s*rx+p.c*ry,tangent=p.c*rx+p.s*ry,sign=face===4?-1:1,saved={...WH};
  WH.dn=Math.max(1e-6,Math.abs(normal*t));WH.sl=sign*tangent/(Math.abs(normal)||1e-6);WH.wc=sign*HIT.u;
  try{wallText(i,sign*HIT.u,t/(projX*Math.max(1e-6,Math.abs(normal+(p.s*dy+p.c*dx)/projX))),HIT.w,t,p.text,0,(p.z0+p.z1)/2,p.hl*1.8,(p.z1-p.z0)*.55,C(GREEN,2+L*.5),BG[i]);}finally{Object.assign(WH,saved);}
 }
 if(top&&p.material!=='water')paintSettledSnow(i,p.x+p.c*HIT.u-p.s*HIT.v,p.y+p.s*HIT.u+p.c*HIT.v,L*.7,1,0,HIT.w);
 return true;
}
function drawQuietPlaces(){
 for(const s of QUIET_PLACES){
  const [vx,vy]=R(s.x,s.y);if(!inView(vx,vy,s.radius)||Math.hypot(vx,vy)>vis+s.radius)continue;
  const distance=Math.hypot(vx,vy);
  for(const p of s.parts){
   if(distance>5*lodScale()&&Math.max(p.hl,p.hw,p.z1-p.z0)<.025)continue;
   let x=p.x-s.x+vx,y=p.y-s.y+vy,c=p.c,sn=p.s;
   if(p.moving==='wind'||p.moving==='cup'){
    const angle=p.angle+T*(.35+storm*.8),radius=p.moving==='cup'?.065:.03;
    const turn=s.turn||0,co=Math.cos(turn),si=Math.sin(turn),u=.8+Math.cos(angle)*radius,v=-.3+Math.sin(angle)*radius;
    x=vx+co*u-si*v;y=vy+si*u+co*v;c=Math.cos(angle+turn);sn=Math.sin(angle+turn);
   }
   let b={...p,x,y,c,s:sn};
   if(p.moving==='handle'){
    const z=s.base+.17+(s.flowUntil>T?Math.sin(T*8)*.03:.018);
    coveTube(vx+.014,vy-.72,s.base+.17,vx+.085,vy-.72,z,.003,GRAY);
    coveRound(vx+.085,vy-.72,1,0,.009,.006,z-.006,z+.006,.003,BRICK);continue;
   }
   const shade=(i,t,L)=>{
    const glow=s.lamp&&lampsOn?Math.max(0,1-Math.hypot(p.x-s.lamp.x,p.y-s.lamp.y,(p.z0+p.z1)/2-s.lamp.z)/.65)*5:0;
    return quietMaterial(p,i,t,Math.max(L,glow));
   };
   if(p.profile)drawBox(b,shade,coveRayLathe);
   else if(p.ellipsoid)drawBox(b,shade,homeRayEllipsoid);
   else if(p.round)drawBox(b,shade,coveRayRounded);
   else drawBox(b,shade);
  }
  if(s.type==='court'&&s.flowUntil>T){
   const p={...boxAt(vx,vy-.64,1,0,.002,.002,s.base+.035,s.base+.131),material:'water'};
   drawBox(p,(i,t,L)=>quietMaterial(p,i,t,L));
  }
  if(s.type==='roof'&&quietGardenerHere()){
   const look=quietGardenerLook||(quietGardenerLook=figLook({hair:'bun',top:'long',col:{top:[GREEN,7],skin:[SKIN,11]}}));
   drawFigure(vx+.36,vy-.16,s.base,.175,0,-1,look,Math.sin(T*.2)>.1?'crouch':'stand');
  }
 }
}
let quietGardenerLook=null;
buildQuietPlaces();
