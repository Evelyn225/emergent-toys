// Invited homes share their equipment and TV through the homeowner. Guests keep
// their own bags; the owner's game reserves workshop supplies and awards output.
let netHomeGuests, netHomeViews, netHomeJobs, netHomePending, netHomeActivity, netHomeTimer;
const netHomeCell = () => mode === 'room' && room?.cell && homeRecord(room) ? idx(...room.cell.map(Math.floor)) : null;
const netHomeViewKey = (owner, cell) => owner + ':' + cell;
function netHomeReset() {
  netHomeGuests = new Map(); netHomeViews = new Map(); netHomeJobs = new Map(); netHomePending = new Map(); netHomeActivity = new Map(); netHomeTimer = 0;
}
function netHomeInvite(p, home) { netHomeGuests.set(p.id, { cell: home.cell, until: netNow() + 1800 }); }
function netHomeEntered(home){const v=netHomeViews?.get(netHomeViewKey(room.guestOf||net.selfId,home.cell));if(v)room.tv=!!v.tv;}
function netHomePeerLeft(id) {
  if(!netHomeGuests)return;
  netHomeGuests.delete(id); netHomeActivity.delete(id);
  const before=netHomeJobs.size;
  for(const [key,j] of netHomeJobs)if(j.by===id){const h=owned.homes.find(h=>h.cell===j.cell);if(h)workshopState(h).supplies++;netHomeJobs.delete(key);}
  if(netHomeJobs.size!==before)saveGame();
  for(const [key,q]of netHomePending)if(q.owner===id){netHomePending.delete(key);q.done?.({ok:false,text:'The homeowner disconnected.'});}
}
function netHomeLeave(){if(netHomeGuests)for(const id of [...netHomeGuests.keys()])netHomePeerLeft(id);}
function netHomeView(){const cell=netHomeCell();return cell===null||!netHomeViews?null:netHomeViews.get(netHomeViewKey(room.guestOf||net.selfId,cell));}
function netHomeBenchBusy(home,bench){return !!(net.on&&home&&bench&&netHomeJobs?.has(home.cell+':'+bench.key));}
function netWorkshopRunning(home,key){return !!(net.on&&netHomeCell()===home.cell&&netHomeView()?.running?.includes(key));}
function netHomeCooking(){return !!(net.on&&netHomeView()?.cooking);}
function netHomeState(home) {
  const cell=home.cell,local=netHomeCell()===cell&&!room.guestHome;
  const key=netHomeViewKey(net.selfId,cell),v=netHomeViews.get(key)||{tv:false};
  if(local)v.tv=!!room.tv;
  const running=[...netHomeJobs.values()].filter(j=>j.cell===cell).map(j=>j.bench);
  if(local&&game?.kind==='workshop'&&workshopRun?.home===home)running.push(workshopRun.bench.key);
  const cooking=!!(local&&game?.g.id==='cook')||[...netHomeActivity.values()].some(v=>v.cell===cell&&v.cooking&&netNow()-v.t<3);
  Object.assign(v,{tv:!!v.tv,cooking,running});netHomeViews.set(key,v);
  return {cell,workshop:home.workshop||null,tv:v.tv,cooking,running};
}
function netHomeBroadcast(home) {
  if(!net.on)return;
  const state=netHomeState(home);
  for(const [id,g]of netHomeGuests)if(g.cell===home.cell&&g.until>netNow()&&net.peers.has(id))net.tx.send('homeState',state,id);
}
function netHomeApply(data,from) {
  const invite=net.invites.get(from);if(!invite||invite.cell!==data?.cell)return;
  const h=invite.home,restored=restoreWorkshop(data.workshop?{...data.workshop,parts:Array.isArray(data.workshop.parts)?data.workshop.parts.slice(0,20):[]}:null,h.kind),w=h.workshop||=restored;
  // Preserve part identities: draw closures and a running minigame may hold them.
  const old=w.parts||[],parts=restored.parts.map(p=>{const same=old.find(q=>q.key===p.key&&q.id===p.id);if(!same)return p;if(!p.crop)delete same.crop;return Object.assign(same,p);});
  const changed=old.length!==parts.length||old.some((p,i)=>p!==parts[i]);Object.assign(w,restored,{parts});
  const view={tv:!!data.tv,cooking:!!data.cooking,running:Array.isArray(data.running)?data.running.filter(Number.isInteger).slice(0,4):[]};
  netHomeViews.set(netHomeViewKey(from,data.cell),view);
  if(room?.guestOf===from&&netHomeCell()===data.cell){room.tv=view.tv;if(changed)refreshWorkshopRoom();}
}
function netHomeRequest(op,extra={},done=null) {
  if(!net.on||!room?.guestHome)return false;
  const owner=room.guestOf;if(!net.peers.has(owner)){say('The homeowner is not connected.',3);return true;}
  const id=netRandomId(),cell=netHomeCell();netHomePending.set(id,{owner,cell,done,t:netNow()});
  net.tx.send('homeAction',{id,cell,op,...extra},owner);return true;
}
function netHomeTVToggle(){
  if(!net.on||netHomeCell()===null)return false;
  if(room.guestHome)return netHomeRequest('tv');
  room.tv=!room.tv;netHomeBroadcast(homeRecord());say(room.tv?'The telly flickers on.':'You switch the telly off.',3);return true;
}
function netHomeFrame(dt,now,fromTimer=false) {
  if(!netHomePending)return;
  for(const [id,q]of netHomePending)if(now-q.t>10){netHomePending.delete(id);q.done?.({ok:false,text:'No reply from the homeowner.'});say('No reply from the homeowner.',3);}
  for(const [key,j]of netHomeJobs)if(now>j.until){const h=owned.homes.find(h=>h.cell===j.cell);if(h)workshopState(h).supplies++;netHomeJobs.delete(key);}
  if((netHomeTimer-=dt)>0)return;netHomeTimer=.5;
  const cell=netHomeCell();
  if(cell!==null&&room.guestHome)net.tx.send('homeActivity',{cell,cooking:game?.g.id==='cook',bench:game?.kind==='workshop'?workshopRun?.bench.key:null},room.guestOf);
  for(const h of owned.homes)if([...netHomeGuests.values()].some(g=>g.cell===h.cell))netHomeBroadcast(h);
}
function netHomeMessage(type,d,from,p,now) {
  if(!['homeAction','homeState','homeReply','homeActivity'].includes(type))return false;
  if(!d||typeof d!=='object')return true;
  if(type==='homeState'){netHomeApply(d,from);return true;}
  if(type==='homeReply'){
    const q=netHomePending.get(d.id);if(!q||q.owner!==from)return true;netHomePending.delete(d.id);
    if(d.state)netHomeApply(d.state,from);if(d.text)say(d.text,4);q.done?.(d);return true;
  }
  const permission=netHomeGuests.get(from),h=owned.homes.find(h=>h.cell===d.cell),s=netViewOf(p);
  if(!permission||permission.cell!==d.cell||permission.until<now||!h)return true;
  if(type==='homeActivity'){
    if(s?.rk!==netRoomKey('room',{kind:homeRoomKind(h.kind),cell:[h.cell%N,Math.floor(h.cell/N)],guestOf:net.selfId}))return true;
    permission.until=now+1800;
    netHomeActivity.set(from,{cell:d.cell,cooking:!!d.cooking,t:now});
    const j=netHomeJobs.get(d.cell+':'+d.bench);if(j?.by===from)j.until=now+90;return true;
  }
  if(typeof d.id!=='string'||d.id.length>40||!netAllow(p.homeBucket||={},now,.1,10))return true;
  p.homeReplies||=new Map();if(p.homeReplies.has(d.id)){net.tx.send('homeReply',p.homeReplies.get(d.id),from);return true;}
  const w=workshopState(h),b=w.parts.find(b=>b.key===d.bench),key=d.cell+':'+d.bench;
  let ok=true,text='',start=null;
  if(d.op==='tv'){
    const v=netHomeViews.get(netHomeViewKey(net.selfId,d.cell))||{tv:false};v.tv=!v.tv;netHomeViews.set(netHomeViewKey(net.selfId,d.cell),v);
    if(netHomeCell()===d.cell&&!room.guestHome)room.tv=v.tv;
  }else if(d.op==='power')w.powered=!w.powered;
  else if(d.op==='plant'){[ok,text]=plantWeed(h,b);}
  else if(d.op==='tend'){[ok,text]=tendWeed(b);}
  else if(d.op==='harvest'){
    if(!b||b.id!=='growrack'||!b.crop||b.crop.left>0){ok=false;text='The plant is still growing.';}
    else{netSendGift(p,{item:{id:'weed',uses:4+(w.upgrades.lamp?2:0),q:b.crop.tended?'perfect':'fine'}});delete b.crop;text='Harvest sent to your bag.';}
  }else if(d.op==='batchStart'){
    if(!b||b.id!=='bench'||!workshopBenchReady(w,b)||!w.powered||!w.supplies||netHomeJobs.has(key)||(netHomeCell()===h.cell&&game?.kind==='workshop'&&workshopRun?.bench.key===b.key)){ok=false;text='That bench is busy or needs power and supplies.';}
    else{w.supplies--;netHomeJobs.set(key,{cell:h.cell,bench:b.key,by:from,until:now+90});start={fan:w.parts.some(p=>p.id==='fan'&&p.bench===b.key),controller:!!w.upgrades.controller};}
  }else if(d.op==='batchFinish'){
    const j=netHomeJobs.get(key);
    if(!j||j.by!==from){ok=false;text='This batch is no longer reserved.';}
    else{netHomeJobs.delete(key);if(DRUG_QUALITY[d.quality]){netSendGift(p,{item:{id:'neon',uses:({perfect:6,fine:4,burnt:2}[d.quality])+(w.upgrades.press?2:0),q:d.quality}});text='Your batch is ready.';}else{w.supplies++;text='Batch cancelled; supplies returned.';}}
  }else{ok=false;text='Unknown workshop action.';}
  const reply={id:d.id,ok,text,start,state:netHomeState(h)};p.homeReplies.set(d.id,reply);if(p.homeReplies.size>80)p.homeReplies.delete(p.homeReplies.keys().next().value);
  net.tx.send('homeReply',reply,from);netHomeBroadcast(h);saveGame();return true;
}
function openGuestWorkshop(){
  workshopEl||=panel('workshop');const h=homeRecord(),w=workshopState(h),btn=(op,key,label)=>`<button class="item" data-guest-op="${op}" data-bench="${key}">${label}</button>`;
  showPanel(workshopEl,`<h1>${netEsc(room.guestName||'Shared')} workshop</h1><p class="sub">${w.supplies} batches of supplies · ${w.powered?'Power on':'Power off'}. Finished batches go in your bag.</p>${btn('power',0,w.powered?'Switch power off':'Switch power on')}${w.parts.filter(p=>p.id==='bench'||p.id==='growrack').map(p=>p.id==='bench'?btn('run',p.key,'Run a Neon batch'):btn(p.crop?p.crop.left===0?'harvest':'tend':'plant',p.key,p.crop?p.crop.left===0?'Harvest weed':`Tend plant · ${Math.ceil(p.crop.left)}s left`:'Plant seed pod')).join('')}`);
  workshopEl.onclick=e=>{const b=e.target.closest('[data-guest-op]');if(!b)return;const bench=w.parts.find(p=>p.key===+b.dataset.bench);if(b.dataset.guestOp==='run')return startGuestWorkshopBatch(bench);netHomeRequest(b.dataset.guestOp,{bench:bench?.key},()=>{if(room?.guestHome&&workshopEl.style.display==='flex')openGuestWorkshop();});};
}
function startGuestWorkshopBatch(bench){
  if(!bench||inv.length>=INV_SIZE)return say('Make room in your bag first.',3);
  hidePanel(workshopEl);netHomeRequest('batchStart',{bench:bench.key},reply=>{
    if(!reply.ok||!room?.guestHome)return;
    workshopRun={home:homeRecord(),bench};startGame('workshop','workshop','',reply.start);
    game.onDone=quality=>netHomeRequest('batchFinish',{bench:bench.key,quality});
  });
}
