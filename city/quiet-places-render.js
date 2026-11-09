// Close detail uses the cabin's analytic rounded solids and vessels. Models
// prepare once; the pump, water and wind cups are the only moving pieces.
function quietPart(s,role,u,v,hl,hw,z0,z1,material='stone',block=false,extra={}){
 const p={role,x:s.x+u,y:s.y+v,c:1,s:0,hl,hw,z0:s.base+z0,z1:s.base+z1,textureU:u,textureV:v,textureZ:s.base,material,block,walkSurface:['court-paver','court-subbase','station-floor','path-paver','door-threshold'].includes(role),...extra};
 s.parts.push(p);return p;
}
function quietVessel(s,role,u,v,z,profile,material='clay',block=false){
 const r=Math.max(...profile.map(p=>p[1]));
 return quietPart(s,role,u,v,r,r,z,z+Math.max(...profile.map(p=>p[0])),material,block,{profile:profile.map(([h,r])=>[s.base+z+h,r])});
}
function quietTimber(s,role,u,v,hl,hw,z0,z1,block=false){return quietPart(s,role,u,v,hl,hw,z0,z1,'wood',block,{round:.001});}
function quietStem(s,role,a,b,r){
 const p=quietPart(s,role,(a[0]+b[0])/2,(a[1]+b[1])/2,Math.abs(b[0]-a[0])/2+r,Math.abs(b[1]-a[1])/2+r,Math.min(a[2],b[2])-r,Math.max(a[2],b[2])+r,'stem');
 p.segment={a:[s.x+a[0],s.y+a[1],s.base+a[2]],b:[s.x+b[0],s.y+b[1],s.base+b[2]],r};return p;
}
function quietLeaf(s,role,u,v,z,yaw,length,width){
 const c=Math.cos(yaw),sn=Math.sin(yaw),hl=length/2,hw=width/2,h=s.base+z;
 const p=quietPart(s,role,u+c*hl,v+sn*hl,hl,hw,z-.004,z+.003,'leaf',false,{c,s:sn,leaf:true});
 // A folded, pointed blade with notched edges and a raised central rib.
 const rim=[[-hl,0,h],[-hl*.4,-hw*.65,h],[-hl*.05,-hw,h-.001],[hl*.2,-hw*.5,h-.002],[hl*.6,-hw*.6,h-.003],[hl,0,h-.004],[hl*.6,hw*.6,h-.003],[hl*.2,hw*.5,h-.002],[-hl*.05,hw,h-.001],[-hl*.4,hw*.65,h]];
 const ridge=[0,0,h+.003],sub=(a,b)=>a.map((v,i)=>v-b[i]);
 p.triangles=rim.map((a,j)=>{const b=rim[(j+1)%rim.length],e1=sub(a,ridge),e2=sub(b,ridge),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],len=Math.hypot(...n);return {a:ridge,e1,e2,n:n.map(v=>v/len)};});
 return p;
}
function rayQuietLeaf(ox,oy,oz,rx,ry,rz,b){
 const x=ox-b.x,y=oy-b.y,o=[x*b.c+y*b.s,-x*b.s+y*b.c,oz],d=[rx*b.c+ry*b.s,-rx*b.s+ry*b.c,rz];
 let nearest=Infinity,normal=null;
 for(const t of b.triangles){
  const p=[d[1]*t.e2[2]-d[2]*t.e2[1],d[2]*t.e2[0]-d[0]*t.e2[2],d[0]*t.e2[1]-d[1]*t.e2[0]],det=t.e1[0]*p[0]+t.e1[1]*p[1]+t.e1[2]*p[2];
  if(Math.abs(det)<1e-12)continue;
  const q=o.map((v,i)=>v-t.a[i]),u=(q[0]*p[0]+q[1]*p[1]+q[2]*p[2])/det;if(u<0||u>1)continue;
  const cross=[q[1]*t.e1[2]-q[2]*t.e1[1],q[2]*t.e1[0]-q[0]*t.e1[2],q[0]*t.e1[1]-q[1]*t.e1[0]],v=(d[0]*cross[0]+d[1]*cross[1]+d[2]*cross[2])/det;
  if(v<0||u+v>1)continue;
  const hit=(t.e2[0]*cross[0]+t.e2[1]*cross[1]+t.e2[2]*cross[2])/det;
  if(hit>.01&&hit<nearest){nearest=hit;const sign=t.n[0]*d[0]+t.n[1]*d[1]+t.n[2]*d[2]>0?-1:1;normal=t.n.map(v=>v*sign);}
 }
 if(!normal)return -1;
 HIT.u=o[0]+d[0]*nearest;HIT.v=o[1]+d[1]*nearest;HIT.w=oz+rz*nearest;HIT.face=0;
 HIT.nx=b.c*normal[0]-b.s*normal[1];HIT.ny=b.s*normal[0]+b.c*normal[1];HIT.nz=normal[2];return nearest;
}
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
 for(let j=0;j<4;j++){
  const x=u+(j-1.5)*hl*.42,y=v+(j%2-.5)*hw*.7,h=top+(tall?.105:.055)+(j%3)*.008;
  quietStem(s,'plant-stem',[x,y,top-.008],[x+.004,y,h],.0011);
  for(let n=0;n<3;n++){
   const z=top+.012+n*(h-top-.018)/3,angle=j*1.7+n*2.3;
   const tip=[x+Math.cos(angle)*.014,y+Math.sin(angle)*.014,z+.006];
   quietStem(s,'leaf-stalk',[x,y,z],tip,.0006);
   for(const side of [-1,1])quietLeaf(s,'vegetable-leaf',...tip,angle+side*.6,tall?.036:.026,tall?.017:.02);
  }
  if(tall){
   quietTimber(s,'plant-stake',x-.006,y+.01,.0015,.0015,top-.005,h+.014);
   for(const side of [-1,1])quietPart(s,'tomato',x+side*.009,y-.009,.005,.005,h-.03,h-.02,'fruit',false,{ellipsoid:true});
  }
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
 for(const [u,v,z]of [[-.76,.17,.092],[-.64,.19,.092],[-.7,.18,.033]])quietVessel(s,'flowerpot',u,v,z,[[0,0],[0,.012],[.003,.014],[.027,.019],[.029,.021],[.032,.021],[.032,.016],[.007,.009],[.007,0]],'clay');
 quietVessel(s,'water-barrel',.9,-.08,0,[[0,0],[0,.035],[.005,.039],[.115,.039],[.12,.042],[.124,.042],[.124,.034],[.014,.034],[.014,0]],'paint',true);
 quietVessel(s,'barrel-water',.9,-.08,.104,[[0,0],[0,.033],[.002,.033],[.002,0]],'water');
 quietPart(s,'barrel-tap',.9,-.125,.004,.012,.028,.035,'brass');
 quietVessel(s,'watering-can',-.59,.17,.092,[[0,0],[0,.012],[.004,.018],[.024,.018],[.026,.012],[.026,.009],[.009,.009],[.009,0]],'paint');
 for(const v of [-.012,.012])quietPart(s,'can-handle-stile',-.612,.17+v,.003,.002,.102,.125,'paint',false,{round:.001});
 quietPart(s,'can-handle-grip',-.612,.17,.003,.01,.125,.13,'paint',false,{round:.001});
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
 const ground=Math.min(...[-1,1].flatMap(a=>[-1,1].map(b=>terrainHeight(s.x+a*.965,s.y+b*.855))))-.003;
 quietPart(s,'court-subbase',0,0,.915,.805,ground-s.base,0,'stone');
 quietPart(s,'door-threshold',0,.8255,.315,.0295,ground-s.base,.003,'paver');
 for(const u of [-.94,.94])quietPart(s,'garden-wall',u,0,.025,.805,0,.24,'brick',true);
 quietPart(s,'garden-wall',0,-.83,.965,.025,0,.24,'brick',true);
 for(const [u,hl]of [[-.64,.325],[.64,.325]])quietPart(s,'entry-return',u,.83,hl,.025,0,.24,'brick',true);
 for(const u of [-.94,.94])quietPart(s,'wall-coping',u,0,.034,.796,.24,.257,'stone');
 quietPart(s,'wall-coping',0,-.83,.974,.034,.24,.257,'stone');
 for(const sign of [-1,1])quietPart(s,'entry-coping',sign*.6445,.83,.3295,.034,.24,.257,'stone');
 for(let u=-.8;u<=.8;u+=.2)for(let v=-.7;v<=.7;v+=.2)quietPart(s,'court-paver',u,v,.096,.096,0,.003,'paver');
 quietBench(s,-.5,-.48);quietBench(s,.5,-.48);
 for(const u of [-.62,.62])quietPlanter(s,u,.23,.15,.1);
 // Open stone trough, recessed water surface, brass outlet and iron pump.
 s.pump={x:0,y:-.66,outlet:[0,-.57,.125],waterZ:.035};
 for(const u of [-.125,.125])quietPart(s,'trough-end',u,-.55,.012,.07,0,.065,'stone',true);
 for(const v of [-.608,-.492])quietPart(s,'trough-side',0,v,.113,.012,0,.065,'stone',true);
 quietPart(s,'trough-bottom',0,-.55,.113,.046,0,.012,'stone',true);
 quietPart(s,'trough-water',0,-.55,.11,.045,.034,.035,'water');
 quietPart(s,'pump-base',0,s.pump.y,.035,.03,0,.018,'iron',true);
 quietPart(s,'pump-body',0,s.pump.y,.014,.014,.018,.17,'paint',true,{round:.004});
 quietPart(s,'pump-head',0,s.pump.y,.025,.02,.15,.176,'paint',false,{round:.005});
 const start=s.pump.y+.014,end=s.pump.outlet[1];
 quietPart(s,'pump-spout',0,(start+end)/2,.005,(end-start)/2,.13,.14,'brass');
 quietVessel(s,'outlet-mouth',0,end,.125,[[0,.003],[0,.006],[.015,.006],[.015,.003],[0,.003]],'brass');
 quietPart(s,'pump-handle',.033,s.pump.y,.006,.004,.10,.20,'iron',false,{moving:'handle'});
 // Pergola casts an open silhouette; no opaque canopy over the garden.
 for(const u of [-.77,.77])for(const v of [-.68,-.3])quietTimber(s,'pergola-post',u,v,.006,.006,0,.28,true);
 for(const v of [-.68,-.3])quietTimber(s,'pergola-beam',0,v,.8,.009,.265,.28);
 for(let u=-.77;u<=.8;u+=.11)quietTimber(s,'pergola-lath',u,-.49,.005,.28,.28,.288);
 for(const u of [-.77,.77])quietStem(s,'climbing-vine',[u+.008,-.68,.02],[u+.008,-.68,.288],.0018);
 for(let j=0;j<12;j++){
  const u=-.77+j*.14,z=.29+Math.sin(j*1.5)*.006;
  if(j)quietStem(s,'pergola-vine',[u-.14,-.68,.29+Math.sin((j-1)*1.5)*.006],[u,-.68,z],.0015);
  for(const side of [-1,1])quietLeaf(s,'vine-leaf',u,-.68,z,j*.7+side*1.2,.04,.026);
 }
 quietPlaque(s,.55,.798,'WELL COURT',.18);
 quietPart(s,'lamp-plate',-.55,-.799,.026,.006,.16,.22,'iron');
 quietPart(s,'lamp-globe',-.55,-.779,.018,.015,.17,.21,'lamp',false,{ellipsoid:true});
 quietPart(s,'lamp-cap',-.55,-.779,.023,.02,.21,.217,'iron');
 s.lamp={x:s.x-.55,y:s.y-.779,z:s.base+.19};
 s.targets.push({u:.033,v:-.64,z0:.1,z1:.2,label:'work the hand pump',action:'pump'});
 for(const p of s.parts)if(['garden-wall','entry-return'].includes(p.role))p.z0=Math.min(p.z0,ground);
 s.targets.push({u:.55,v:.79,z0:.105,z1:.15,label:'read the little plaque',text:'WELL COURT · 1931. A worn plaque: “Maintained by the residents of the adjoining houses.” Under it, in newer paint: “No bookings. No purchases. Just sit a while.”'});
}
function quietChartRoom(s){
 // A 9 x 11 metre brick room: broken roof bays, a door wide enough to walk
 // through, and an open sea-facing window framed by real reveals.
 for(const u of [-.48,.48])quietPart(s,'station-wall',u,0,.025,.535,0,.31,'brick',true);
 quietPart(s,'station-back',0,-.56,.505,.025,0,.31,'brick',true);
 for(const u of [-.345,.345])quietPart(s,'door-jamb',u,.56,.16,.025,0,.31,'brick',true);
 quietPart(s,'door-head',0,.56,.185,.025,.25,.31,'brick',true);
 // Cut a window through the west wall by replacing the full slab.
 const west=s.parts.find(p=>p.role==='station-wall'&&p.x<s.x);s.parts.splice(s.parts.indexOf(west),1);
 for(const v of [-.4025,.4025])quietPart(s,'window-pier',-.48,v,.025,.1325,0,.31,'brick',true);
 for(const [lo,hi]of [[0,.105],[.23,.31]])quietPart(s,'window-spandrel',-.48,0,.025,.27,lo,hi,'brick',true);
 quietPart(s,'window-sill',-.48,0,.042,.28,.105,.115,'stone');
 for(const v of [-.266,.266])quietTimber(s,'window-frame',-.48,v,.031,.004,.12,.225);
 for(const z of [.115,.225])quietTimber(s,'window-frame',-.48,0,.031,.27,z,z+.005);
 quietTimber(s,'window-mullion',-.48,0,.031,.004,.12,.225);
 quietPart(s,'station-floor',0,0,.455,.535,0,.003,'paver');
 quietPart(s,'door-threshold',0,.56,.185,.025,0,.003,'paver');
 // Surviving roof boards leave a broad skylight into the room. Rafters remain.
 for(const v of [-.45,0,.45])quietTimber(s,'roof-rafter',0,v,.51,.009,.29,.305);
 for(const u of [-.38,-.29,.29,.38])quietTimber(s,'roof-board',u,0,.042,.59,.305,.315);
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
 quietVessel(s,'mug',.12,-.39,.091,[[0,0],[0,.007],[.002,.011],[.02,.011],[.021,.009],[.004,.009],[.004,0]],'enamel');
 quietTimber(s,'shelf',.39,-.24,.065,.22,.2,.206);
 for(let j=0;j<4;j++)quietTimber(s,'shelf-bracket',.425,-.4+j*.11,.03,.004,.175,.2);
 for(let j=0;j<5;j++)quietPart(s,'logbook',.37,-.4+j*.06,.045,.015,.206,.24,'book');
 // Fuse box has an empty mounting plate and disconnected conduit, not light.
 quietPart(s,'fusebox',0,-.529,.045,.008,.17,.235,'iron');
 for(const u of [-.02,0,.02])quietPart(s,'fuse-socket',u,-.519,.006,.003,.185,.199,'enamel');
 quietPart(s,'conduit',.08,-.526,.002,.003,.09,.28,'iron');
 for(const z of [.11,.25])quietPart(s,'conduit-clamp',.08,-.531,.005,.004,z,z+.005,'iron');
 quietPart(s,'rust-stain',.08,-.5345,.009,.0005,.045,.12,'rust');
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
 // A grassy shore clearing, clear of construction yards, paths and fittings.
 const courts=[];
 for(let y=74;y<400;y+=2)for(let x=58;x<480;x+=2){
  if(!naturalCoastAt(x,y)||isWater(x,y))continue;
  const coast=coastalGround(x,y),kind=blockKind(Math.floor(x/8),Math.floor(y/8));
  if(['yard','construction'].includes(kind)||coast.depth<2.5||coast.depth>6)continue;
  const surface=islandShoreSurface(x,y,coast.depth,coast.beach);
  if(surface.water||surface.background!==GREEN)continue;
  let roadDistance=Infinity;
  for(let yy=Math.ceil(y+1.1);yy<=y+4;yy++)for(let xx=Math.floor(x-3);xx<=x+3;xx++)if(ROAD[idx(xx,yy)])roadDistance=Math.min(roadDistance,Math.hypot(xx+.5-x,yy+.5-y));
  if(roadDistance>4)continue;
  const base=quietSiteClear(x,y,1.1,1.12);if(base===null)continue;
  courts.push({x,y,base,score:coast.depth+roadDistance+hash(x,y,2381)*2});
 }
 courts.sort((a,b)=>a.score-b.score);
 if(courts.length){
  const {x,y,base}=courts[0];
  const s=quietSite('court',x,y,base,1,.9,'Well Court','A small walled garden in the grass beside the shore. Worn paving, a climbing vine pergola and a hand pump over a stone trough.');
  s.entry={x,y:y+1.03};quietCourtyard(s);
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
function quietMaterial(p,i,t,L,lamp=null){
 const face=HIT.face,curved=p.profile||p.ellipsoid||p.round||p.leaf;
 const nu=face===1?1:face===2?-1:0,nv=face===3?1:face===4?-1:0;
 const nx=curved?HIT.nx:p.c*nu-p.s*nv,ny=curved?HIT.ny:p.s*nu+p.c*nv,nz=curved?HIT.nz:face===5?1:face===6?-1:0;
 const top=nz>.7,fp=t/projY,fine=coveDetail(t,.1);
 const wx=p.x+(p.profile?HIT.u:p.c*HIT.u-p.s*HIT.v),wy=p.y+(p.profile?HIT.v:p.s*HIT.u+p.c*HIT.v);
 if(lamp&&lampsOn){
  const lx=lamp.x-wx,ly=lamp.y-wy,lz=lamp.z-HIT.w,d=Math.hypot(lx,ly,lz),facing=(nx*lx+ny*ly+nz*lz)/(d||1);
  if(facing>0)L=Math.max(L,Math.max(0,1-d/.65)*facing*12);
 }
 const snowFinish=()=>{if(top)paintSettledSnow(i,wx,wy,L*.7,1,0,HIT.w);return true;};
 let base=STONE,level=2.2+L*.29;
 if(p.material==='lamp'){BG[i]=C(WARM,lampsOn?12:3+L*.3);set(i,' ',0);return true;}
 if(p.material==='wood'){coveTimber(i,p.hl>p.hw?HIT.v:HIT.u,p.z1-p.z0>Math.max(p.hl,p.hw)*2?HIT.w:p.hl>=p.hw?HIT.u:HIT.v,L,t,nx,ny,nz,3,.1);return snowFinish();}
 if(p.material==='iron'||p.material==='brass'){coveMetal(i,L,nx,ny,nz,p.material==='brass'?YEL:GRAY);return snowFinish();}
 if(p.material==='brick'){
  const z=HIT.w-p.textureZ,along=face<3?p.textureV+HIT.v:p.textureU+HIT.u,row=Math.floor(z/.0075);
  const mortar=coveGroove(z,.0075,.0008,fp)+coveGroove(along+(row&1)*.012,.024,.001,fp);
  base=mortar>.5?GRAY:BRICK;level=1.3+L*.22+(hash(Math.floor(along/.024),row,2371)-.5)*fine;
 }else if(p.material==='leaf'){
  const h=(HIT.w-p.z0)/(p.z1-p.z0);base=seasonIdx()===2?ORANGE:GREEN;level=(1.4+L*.27)*(.7+h*.4+(p.leaf?Math.max(0,1-Math.abs(HIT.v)/Math.max(.0008,fp))*.25:leafClump(HIT.u*120,HIT.v*120)*fine*.3));
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
  base=GRAY;
  const u=p.textureU+HIT.u,v=p.textureV+HIT.v,individual=p.role==='court-paver'||p.role==='path-paver';
  const tu=individual?p.textureU:Math.floor(u/.1),tv=individual?p.textureV:Math.floor(v/.1);
  level=(1.5+L*.27)*(.92+hash(tu*1000|0,tv*1000|0,2373)*.16);
  if(!individual)level-=(coveGroove(u,.1,.002,fp)+coveGroove(v,.1,.002,fp))*.7;
  else level-=Math.max(0,1-Math.min(p.hl-Math.abs(HIT.u),p.hw-Math.abs(HIT.v))/.004)*.45;
  // Broad slab variation stays stable at grazing angles; sub-cell grit
  // otherwise aliases into a striped pattern on the courtyard floor.
 }
 BG[i]=C(base,level*(curved?coveLight(nx,ny,nz):shadeFace(face)));set(i,' ',0);
 if(p.text&&(face===3||face===4)){
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const normal=-p.s*rx+p.c*ry,tangent=p.c*rx+p.s*ry,sign=face===4?-1:1,saved={...WH};
  WH.dn=Math.max(1e-6,Math.abs(normal*t));WH.sl=sign*tangent/(Math.abs(normal)||1e-6);WH.wc=sign*HIT.u;
  try{wallText(i,sign*HIT.u,t/(projX*Math.max(1e-6,Math.abs(normal+(p.s*dy+p.c*dx)/projX))),HIT.w,t,p.text,0,(p.z0+p.z1)/2,p.hl*1.8/p.text.length,(p.z1-p.z0)*.55,C(GREEN,2+L*.5),BG[i]);}finally{Object.assign(WH,saved);}
 }
 if(p.material!=='water')snowFinish();
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
   if(p.segment){
    const {a,b,r}=p.segment,[ax,ay]=R(a[0],a[1]),[bx,by]=R(b[0],b[1]);
    drawRod(ax,ay,a[2],bx,by,b[2],r,(i,t,L)=>{BG[i]=C(GREEN,1.5+L*.3);set(i,' ',0);return true;});continue;
   }
   if(p.moving==='handle'){
    const z=s.base+.17+(s.flowUntil>T?Math.sin(T*8)*.03:.018);
    coveTube(vx+.014,vy+s.pump.y,s.base+.17,vx+.085,vy+s.pump.y,z,.003,GRAY);
    coveRound(vx+.085,vy+s.pump.y,1,0,.009,.006,z-.006,z+.006,.003,BRICK);continue;
   }
   const shade=(i,t,L)=>quietMaterial(p,i,t,L,s.lamp);
   if(p.profile)drawBox(b,shade,coveRayLathe);
   else if(p.leaf)drawBox(b,shade,rayQuietLeaf);
   else if(p.ellipsoid)drawBox(b,shade,homeRayEllipsoid);
   else if(p.round)drawBox(b,shade,coveRayRounded);
   else drawBox(b,shade);
  }
  if(s.type==='court'&&s.flowUntil>T){
   const [u,v,z]=s.pump.outlet,low=s.base+s.pump.waterZ,high=s.base+z;
   const p={...boxAt(vx+u,vy+v,1,0,.002,.002,low,high),material:'water',profile:[[low,0],[low,.002],[high,.002],[high,0]]};
   drawBox(p,(i,t,L)=>quietMaterial(p,i,t,L),coveRayLathe);
  }
  if(s.type==='roof'&&quietGardenerHere()){
   const look=quietGardenerLook||(quietGardenerLook=figLook({hair:'bun',top:'long',col:{top:[GREEN,7],skin:[SKIN,11]}}));
   drawFigure(vx+.36,vy-.16,s.base,.175,0,-1,look,Math.sin(T*.2)>.1?'crouch':'stand');
  }
 }
}
let quietGardenerLook=null;
buildQuietPlaces();
