// Searchable places are data; the map, list, contacts and waypoints share the same records.
const MAP_CATEGORIES={all:'All',contacts:'Contacts',homes:'Homes',food:'Food',transport:'Transport',essentials:'Services',activities:'Things to do',shops:'Shops'};
const MAP_COLORS={contacts:'#ffd575',homes:'#ffe960',food:'#f9a67b',transport:'#8ecbff',essentials:'#9bdfbb',activities:'#d9b6ff',shops:'#c8cbd4',area:'#b2b9c7'};
const MAP_NAV={path:null,next:0,lastT:-99,routeFrom:null,nearby:false};
let mapPlaceCache=null;
function mapPlayerLocation() {
  if(mode==='room') {
    if(room?.ret?.length>=2)return {x:room.ret[0],y:room.ret[1]};
    if(streetSpot)return {x:streetSpot.x,y:streetSpot.y};
  }
  return {x:px,y:py};
}
const mapMetres = distance => distance>=1000?`${(distance/1000).toFixed(1)} km`:`${Math.round(distance/10)*10} m`;
const mapEscape = text => String(text).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
function nearestWorkshopHome() {
  const p=mapPlayerLocation();
  return owned.homes.reduce((best,h)=>!best||mapDistance(p,{x:h.cell%N,y:Math.floor(h.cell/N)})<mapDistance(p,{x:best.cell%N,y:Math.floor(best.cell/N)})?h:best,null);
}
function mapShopCategory(sh) {
  if(sh.word==='REALTY')return 'homes';
  if(/^(PHARMACY|DRUGSTORE|HOSPITAL|POLICE|BANK|LAUNDRY|STORAGE|AUTO REPAIR)$/.test(sh.word))return 'essentials';
  if(/^(GAS|CARS)$/.test(sh.word))return 'transport';
  if(/^(ARCADE|GYM|CINEMA|KARAOKE|PACHINKO|CRANE GAME|GACHA|CASINO|MUSEUM|AQUARIUM|VELVET|MAHJONG)$/.test(sh.word))return 'activities';
  if(stockFor('',sh.word).some(id=>['food','drink'].includes(ITEMS[id]?.kind)))return 'food';
  return 'shops';
}
function mapDirectory() {
  const out=[],seen=new Set(),add=p=>{out.push({...p,color:MAP_COLORS[p.category]||'#ccc'});};
  for(const [x,y,name,color,kind] of bigMapLabels()) {
    if(kind==='shop'||worldReady&&WILD_ISLANDS.some(i=>i.name===name))continue;
    let category=kind==='area'?'area':'activities';
    if(stations.some(s=>s.name===name)||EL_STATIONS.some(s=>s.name===name)||name==='Airport'||name==='Fern airstrip'||name==='Fern boat landing')category='transport';
    if(name==='Fern House')category='homes';
    if(['Police','Fire station','Hospital'].includes(name))category='essentials';
    add({id:`place:${name}:${x}:${y}`,name,x,y,category,kind,description:name==='Fern House'?`A secluded house with sea-view terrace, workshop and storage. For sale: ${fmt$(ITEMS.home_island.price)}. Visit the front door to view the listing.`:name==='Fern airstrip'?'Rough 660 m strip, east-west. Light planes only; clear approaches at both ends. Boat landing on the west coast.':name==='Fern boat landing'?'Long timber landing on the west coast. Tie up alongside; your rental waits for the return trip.':name==='Fern Falls'?'A small waterfall and woodland trail. Follow the path east from Fern House.':category==='transport'?'Station or transport connection.':'City landmark.',color});
  }
  for(let k=0;k<SHOP.length;k++) {
    const sh=SHOP[k];if(!sh?.word||sh.kind===SHOP_APTS||sh.kind===SHOP_SHUT||seen.has(sh))continue;
    seen.add(sh);const x=k%N+.5,y=Math.floor(k/N)+.5;
    if(sh.islandCabin) {
      const cabin=ISLAND_CABINS.find(c=>c.id===sh.islandCabin);
      if(cabin?.room)add({id:cabin.id,name:cabin.name,x:cabin.door[0],y:cabin.door[1],category:'activities',kind:'shelter',
        description:'An unlocked public fishing shelter. Sit on a bench, look through the old tackle and read the visitors\' log.',status:'Open shelter'});
      continue;
    }
    const stock=stockFor('',sh.word).slice(0,6).map(id=>ITEMS[id]?.name).filter(Boolean);
    add({id:cityPlaceAtCell(k)?.id||`shop:${k}`,name:sh.word,x,y,category:mapShopCategory(sh),kind:'shop',shop:sh,
      description:stock.length?`Sells ${stock.join(', ')}.`:'Visit the counter to see what is available.',
      status:openAt(sh,tod)?'Open now':'Closed now',hours:sh.hours,fee:sh.fee||0});
  }
  if(worldReady)for(const island of WILD_ISLANDS)add({id:`island:${island.id}`,name:island.name,x:island.landing[0],y:island.landing[1],category:'activities',kind:'island',description:island.note,status:'Boat landing on west shore'});
  for(const h of owned.homes) {
    const point=h.door||buyerDoor(h)||[h.cell%N+.5,Math.floor(h.cell/N)+.5];
    add({id:cityHomeId(h),name:`Your ${ITEMS[h.kind].name}`,x:point[0],y:point[1],category:'homes',kind:'home',home:h,
      description:h.kind==='home_island'?'Your island house: workshop, sea-view terrace, bed and shared 120-item closet.':'Your apartment: workshop, bed and a shared 120-item closet.',status:'Owned'});
  }
  const fernListing=out.find(p=>p.name==='Fern House');
  if(fernListing&&owned.homes.some(h=>h.kind==='home_island')) {
    fernListing.description='Your secluded island house. Workshop, storage and a sea-view terrace.';
    fernListing.status='Owned';
  }
  const home=nearestWorkshopHome(),meeting=home&&(home.door||buyerDoor(home));
  add({id:'supplier',name:'Mara · workshop supplier',x:supplierVisit?.x??meeting?.[0]??null,y:supplierVisit?.y??meeting?.[1]??null,
    category:'contacts',kind:'supplier',virtual:!supplierVisit,description:'Yellow cap, teal jacket. Equipment, seed pods, refills and upgrades. Call her to your apartment from here.',
    status:supplierVisit?'Waiting outside your apartment':home?'Available to call':'Buy an apartment to set up a workshop'});
  if(drugBuyer) {
    const b=drugBuyerProfile(drugBuyer.visit.id);
    add({id:`buyer:${b.id}`,name:`${b.name} · buyer`,x:drugBuyer.x,y:drugBuyer.y,category:'contacts',kind:'buyer',description:b.description,status:'Waiting outside your apartment'});
  }
  for(const [index,c] of owned.cars.entries())add({id:`car:${index}`,name:`Your ${CAR_MODELS[c.model]?.name||'car'}`,x:c.x,y:c.y,category:'transport',kind:'car',description:'Your parked vehicle.',status:c.wrecked?'Wrecked':'Owned'});
  for(const b of fleet)if(b.deal==='mine'||b.hired)add({id:`boat:${b.id}`,name:`${b.hired?'Your rental':'Your boat'} · ${b.name}`,x:b.x,y:b.y,category:'transport',kind:'boat',description:b.hired?'Waiting for your return trip. Bring it back to the marina to end the rental.':'Your boat stays where you tie it up.',status:b.hired?'Hired':'Owned'});
  for(const [index,v] of vendors.entries())add({id:`vendor:${index}`,name:v.type.name,x:v.x,y:v.y,category:'food',kind:'vendor',description:`Street vendor: ${v.type.item}.`});
  const task=taskTarget(),job=jobTarget(),delivery=courierRoute();
  for(const [id,p,name] of [['task',task,'Current favour'],['job',job,'Current job'],['courier',delivery?.recipient,'Courier delivery']]) {
    if(p)add({id,name,x:p.x,y:p.y,category:'activities',kind:'objective',description:id==='courier'?'Rooftop destination. The route marks a street approach; use the stairs or roof route.':'Your current objective.'});
  }
  return out;
}
function mapFilteredPlaces() {
  const q=BIGMAP.query.trim().toLowerCase(),origin=mapPlayerLocation();
  const key=`${q}|${BIGMAP.category}|${origin.x}|${origin.y}`;
  if(mapPlaceCache?.places===BIGMAP.places&&mapPlaceCache.key===key)return mapPlaceCache.results;
  const results=BIGMAP.places.filter(p=>(BIGMAP.category==='all'?(p.category!=='area'||q):p.category===BIGMAP.category)&&
    (!q||`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)))
    .sort((a,b)=>{
      if(!q&&a.id==='supplier')return -1;if(!q&&b.id==='supplier')return 1;
      if(a.x===null)return -1;if(b.x===null)return 1;
      return mapDistance(origin,a)-mapDistance(origin,b)||a.name.localeCompare(b.name);
    });
  mapPlaceCache={places:BIGMAP.places,key,results};return results;
}
function mapPlaceDistance(p) {return p.virtual?'On call':p.x===null?'Contact':mapMetres(mapDistance(mapPlayerLocation(),p)*10);}
function mapPlaceStreet(p) {
  if(p.x===null||p.virtual)return '';
  const island=wildIslandAt(p.x,p.y,12);if(island)return island.name;
  const street=streetName(p.x,p.y);if(street)return street;
  for(let r=1;r<=8;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++) {
    if(Math.abs(ox)!==r&&Math.abs(oy)!==r)continue;
    const x=mapCoordinate(Math.floor(p.x)+ox,MAP_WORLD.width),y=mapCoordinate(Math.floor(p.y)+oy,MAP_WORLD.height);
    if(ROAD[idx(x,y)]){const name=streetName(x+.5,y+.5);if(name)return name;}
  }
  return '';
}
function mapRouteLabel() {
  if(MAP_NAV.path)return 'walking route';
  if(!mapWaypoint)return 'direction only';
  const p=mapPlayerLocation(),island=wildIslandAt(mapWaypoint.x,mapWaypoint.y,12)||wildIslandAt(p.x,p.y,12);
  if(!island)return 'direction only';
  return island.id==='fern'?'boat / light aircraft access':'boat access';
}
function mapDirectoryUI() {
  const list=bigMapEl.querySelector('.places'),details=bigMapEl.querySelector('.place-detail'),hits=mapFilteredPlaces();
  const route=bigMapEl.querySelector('.route-status');route.hidden=!mapWaypoint;
  if(mapWaypoint)route.innerHTML=`<span>${mapEscape(mapWaypoint.name)}<br>${mapMetres(mapRouteDistance())} · ${mapRouteLabel()}</span><button data-map="clear-route">Clear</button>`;
  const selected=BIGMAP.places.find(p=>p.id===BIGMAP.selected);
  bigMapEl.querySelector('.directory').classList.toggle('has-selection',!!selected);
  bigMapEl.querySelector('.results-count').textContent=`${hits.length} places · nearest first`;
  list.innerHTML=hits.slice(0,BIGMAP.limit).map(p=>`<button class="place-row ${BIGMAP.selected===p.id?'selected':''}" data-place="${mapEscape(p.id)}"><span><b style="color:${p.color}">${mapEscape(p.name)}</b><small>${mapEscape([p.status||MAP_CATEGORIES[p.category]||'District',mapPlaceStreet(p)].filter(Boolean).join(' · '))}</small></span><span class="distance">${mapPlaceDistance(p)}</span></button>`).join('')||'<p class="empty">No places match. Try another name or category.</p>';
  if(hits.length>BIGMAP.limit)list.innerHTML+='<button class="more-places" data-map="more">Show more places</button>';
  for(const b of bigMapEl.querySelectorAll('[data-category]'))b.setAttribute('aria-pressed',String(b.dataset.category===BIGMAP.category));
  details.hidden=!selected;
  if(!selected)return;
  const p=selected,hours=p.hours?`${String(p.hours[0]).padStart(2,'0')}:00–${String(p.hours[1]).padStart(2,'0')}:00`:'';
  const address=p.x===null?'':[mapPlaceStreet(p),DISTRICT_TITLE[districtAt(p.x,p.y)]].filter(Boolean).join(' · ');
  const supplierWaiting=p.kind==='supplier'&&supplierVisit&&supplierVisit.home===nearestWorkshopHome()?.cell;
  const actions=[];
  const island=wildIslandAt(p.x,p.y,12),origin=mapPlayerLocation();
  if(island&&!wildIslandAt(origin.x,origin.y,12)) {
    actions.push('<button data-map="island-marina">Find a boat at the marina</button>');
    if(island.id==='fern')actions.push('<button data-map="island-airport">Find a light plane at the airport</button>');
  }
  if(p.kind==='supplier'&&!supplierWaiting)actions.push(`<button data-map="call-supplier" ${owned.homes.length?'':'disabled'}>${supplierVisit?'Call Mara to nearest home':'Call Mara to my apartment'}</button>`);
  if(p.x!==null&&!p.virtual) {
    if(mapWaypoint?.id===p.id)actions.push('<button data-map="go">Follow waypoint</button>');
    else actions.push('<button data-map="waypoint">Set waypoint</button>');
  }
  if(p.kind==='supplier'&&!owned.homes.length)actions.push('<button data-map="find-housing">Find a realty office</button>');
  details.innerHTML=`<div class="detail-head"><small>${mapEscape(MAP_CATEGORIES[p.category]||'District')} · ${mapPlaceDistance(p)}</small><button data-map="unselect" aria-label="Close place details">×</button></div><h2>${mapEscape(p.name)}</h2><p>${mapEscape(p.description)}</p>
    <p>${mapEscape(address)}</p><p class="place-status">${mapEscape([p.status,hours,p.fee?`Entry ${fmt$(p.fee)}`:''].filter(Boolean).join(' · '))}</p>
    <div class="detail-actions">${actions.join('')}</div>`;
}
function selectMapPlace(id,centre=true) {
  const p=BIGMAP.places.find(p=>p.id===id);if(!p)return;
  BIGMAP.selected=id;
  bigMapEl.querySelector('.directory').hidden=false;
  if(centre&&p.x!==null) {BIGMAP.cx=p.x;BIGMAP.cy=p.y;BIGMAP.z=Math.max(BIGMAP.z,12);}
  BIGMAP.found=p.x!==null?{x:p.x,y:p.y,t:performance.now()/1000}:null;
  mapDirectoryUI();bigMapDraw();
}
function setMapWaypoint(p) {
  if(!p||p.x===null||p.virtual)return;
  mapWaypoint={id:p.id,name:p.name,x:p.x,y:p.y};MAP_NAV.path=null;MAP_NAV.routeFrom=null;MAP_NAV.next=0;
  updateMapNavigation(true);showMap=true;saveGame();
  if(bigMapOpen()){mapDirectoryUI();bigMapDraw();}
  say(`${wildIslandAt(p.x,p.y,12)?'Boat / aircraft destination':'Walking waypoint'}: ${p.name}. M opens the map.`,4);
}
function clearMapWaypoint() {
  mapWaypoint=null;MAP_NAV.path=null;MAP_NAV.routeFrom=null;MAP_NAV.next=0;
  saveGame();if(bigMapOpen()){mapDirectoryUI();bigMapDraw();}
}
function updateMapNavigation(force=false) {
  if(!mapWaypoint)return;
  if(mapWaypoint.id==='supplier'&&!supplierVisit){mapWaypoint=null;MAP_NAV.path=null;return;}
  if(mapWaypoint.id.startsWith('buyer:')&&!drugBuyer){mapWaypoint=null;MAP_NAV.path=null;return;}
  if(!force&&T-MAP_NAV.lastT<.3)return;MAP_NAV.lastT=T;
  const p=mapPlayerLocation(),path=MAP_NAV.path;
  let nearest=Infinity,index=MAP_NAV.next;
  if(path)for(let n=MAP_NAV.next;n<path.length;n++){const d=mapDistance(p,path[n]);if(d<nearest){nearest=d;index=n;}}
  MAP_NAV.next=index;
  if(force||!MAP_NAV.routeFrom||nearest>1.6&&mapDistance(p,MAP_NAV.routeFrom)>1) {
    const destination=wildIslandAt(mapWaypoint.x,mapWaypoint.y,12),origin=wildIslandAt(p.x,p.y,12);
    MAP_NAV.path=destination!==origin&&(destination||origin)?null:findMapRoute(p,mapWaypoint);MAP_NAV.next=0;MAP_NAV.routeFrom={...p};
  }
  const end=MAP_NAV.path?.at(-1);MAP_NAV.nearby=!!end&&mapDistance(p,end)<.65;
}
function mapRouteDistance() {
  const path=MAP_NAV.path,p=mapPlayerLocation();
  return path?Math.max(0,path.length-1-MAP_NAV.next)*10+mapDistance(p,path[MAP_NAV.next])*10:mapDistance(p,mapWaypoint)*10;
}
function drawMapNavigation() {
  if(!mapWaypoint)return;
  const p=mapPlayerLocation(),next=MAP_NAV.path?.[Math.min(MAP_NAV.next+1,MAP_NAV.path.length-1)]||mapWaypoint;
  const yaw=Math.atan2(mapDifference(next.y-p.y,MAP_WORLD.height),mapDifference(next.x-p.x,MAP_WORLD.width));
  const turn=mod(yaw-a+Math.PI,Math.PI*2)-Math.PI;
  let direction='AHEAD';if(turn>.5)direction='RIGHT';else if(turn<-.5)direction='LEFT';if(Math.abs(turn)>2.5)direction='BEHIND';
  const text=`${MAP_NAV.nearby?'NEARBY':direction} > ${mapWaypoint.name} · ${mapMetres(mapRouteDistance())}${MAP_NAV.path?'':` · ${mapRouteLabel()}`}`;
  let max=cv.width-24-(TOUCH?TOUCH_PAD_W:0);
  if(showMap&&!TOUCH&&cv.width>700)max=Math.min(max,cv.width-360);
  const lines=wrapText(text,Math.max(100,max));
  let y=hudBottom+6;g.font=FS+'px monospace';
  for(const line of lines){g.fillStyle='rgba(0,0,0,.8)';g.fillRect(6,y,g.measureText(line).width+12,FS+5);g.fillStyle='#8de5df';g.fillText(line,12,y+2);y+=FS+5;}
  hudBottom=y+4;
}
