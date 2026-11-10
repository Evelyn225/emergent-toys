// Both directions require an explicit acceptance. Only the travelling player's
// client moves them, and destinations are supplied after the request is accepted.
let netTeleports;
function netTeleportReset(){netTeleports=new Map();}
function netTeleportPeerLeft(id){if(netTeleports)for(const [key,r]of netTeleports)if(r.peer===id)netTeleports.delete(key);}
function netTeleportFrame(now){if(netTeleports)for(const [id,r]of netTeleports)if(r.until<now){netTeleports.delete(id);netLog('A teleport request expired.');netPlayersShow();}}
function netTeleportCanMove(){return ['walk','room','roof','elplat'].includes(mode)&&!sleep&&!game&&!wanted.busted;}
function netTeleportRequest(p,dir){
  if(!net.on||!p.hello||p.mismatch)return;
  if(dir==='to'&&!netTeleportCanMove())return say('Leave your vehicle or activity before teleporting.',3);
  const id=netRandomId();netTeleports.set(id,{peer:p.id,dir,incoming:false,until:netNow()+30});
  net.tx.send('teleport',{op:'request',id,dir},p.id);netLog(`Teleport request sent to ${p.name}. They have 30 seconds to accept.`);
}
function netTeleportShow(el){
  const list=el.querySelector('[data-np="requests"]');if(!list)return;
  const html=[...(netTeleports||[])].filter(([,r])=>r.incoming&&!r.accepted).map(([id,r])=>{
    const p=net.peers.get(r.peer);if(!p)return '';
    return `<p>${netEsc(p.name)} ${r.dir==='to'?'wants to teleport to you':'asks you to teleport to them'}. <button class="opt" data-np-act="tp-yes" data-req="${id}">Accept</button> <button class="opt" data-np-act="tp-no" data-req="${id}">Decline</button></p>`;
  }).join('');
  if(list.dataset.html!==html){list.innerHTML=html;list.dataset.html=html;}
}
const NET_PRIVATE_ROOMS=new Set(['home','loft','bellehome','islandhome']);
function netTeleportRoomData(r,depth=0){
  if(!r||depth>2||NET_PRIVATE_ROOMS.has(r.kind))return null;
  const out={kind:r.kind};
  for(const k of ['word','base','district','suite','grandHotel','st','netBoard','track','dest','rideT','section'])if(['string','number','boolean'].includes(typeof r[k]))out[k]=r[k];
  for(const k of ['cell','ret','tower','opts'])if(Array.isArray(r[k]))out[k]=r[k].slice(0,8);
  for(const k of ['lobby','below'])if(r[k])out[k]=netTeleportRoomData({...r[k],kind:r[k].kind||(k==='below'?'lighthouse':ROOM_FOR[r[k].word]||'hotel')},depth+1);
  return out;
}
function netTeleportCheckRoom(d,depth=0){
  if(!d||depth>2||typeof d.kind!=='string'||!Object.hasOwn(ROOM_DEFS,d.kind)||NET_PRIVATE_ROOMS.has(d.kind))return null;
  const out={kind:d.kind};
  for(const k of ['word','base','district'])if(typeof d[k]==='string')out[k]=netClean(d[k],60);
  for(const k of ['suite','grandHotel'])if(typeof d[k]==='boolean')out[k]=d[k];
  for(const k of ['st','netBoard','track','dest','rideT','section'])if(netNum(d[k]))out[k]=clamp(d[k],0,1e7);
  for(const k of ['cell','ret','tower','opts'])if(Array.isArray(d[k])&&d[k].length<=8&&d[k].every(netNum))out[k]=d[k].slice();
  if(out.dest!==undefined&&(!Number.isInteger(out.dest)||!stations[out.dest]))delete out.dest;
  if(out.opts)out.opts=out.opts.filter(n=>Number.isInteger(n)&&stations[n]);
  if(out.cell&&(out.cell.length!==2||out.cell.some(n=>!Number.isInteger(n)||n<0||n>=N)))return null;
  if(out.ret&&(out.ret.length!==3||out.ret.slice(0,2).some(n=>n<0||n>=N)))return null;
  if(['station','train'].includes(d.kind)&&(!Number.isInteger(out.st)||!stations[out.st]))return null;
  for(const k of ['lobby','below'])if(d[k]){out[k]=netTeleportCheckRoom(d[k],depth+1);if(!out[k])return null;}
  if(['hotelroom','grandhotelheist'].includes(d.kind)&&!out.lobby||d.kind==='lamproom'&&!out.below)return null;
  if(d.kind==='jail')out.until=T;
  out.t0=T-trainPhase({t0:T});return out;
}
function netTeleportPlace(peer){
  const h=netHomeCell()!==null&&!room.guestHome?homeRecord():null;
  if(h){netHomeInvite(peer,h);return {home:{cell:h.cell,kind:h.kind,door:h.door||room.ret?.slice(0,2),rec:JSON.parse(JSON.stringify(h)),name:net.name}};}
  if(mode==='room'&&!room.guestHome){const interior=netTeleportRoomData(room);if(interior)return {interior,spawn:[px,py,a]};}
  const loc=mapPlayerLocation(),land=netLandNear(loc.x,loc.y,3);
  return land?{x:land[0],y:land[1],a,entrance:mode==='room'}:null;
}
function netTeleportAnswer(id,ok){
  const r=netTeleports.get(id),p=r&&net.peers.get(r.peer);if(!p||!r.incoming||r.until<netNow())return;
  if(!ok){net.tx.send('teleport',{op:'decline',id},p.id);netTeleports.delete(id);return;}
  if(r.dir==='here'&&!netTeleportCanMove())return say('Leave your vehicle or activity before teleporting.',3);
  if(r.dir==='to'){
    const place=netTeleportPlace(p);if(!place)return say('There is no safe arrival spot here.',3);
    net.tx.send('teleport',{op:'move',id,place},p.id);netTeleports.delete(id);
  }else{r.accepted=true;net.tx.send('teleport',{op:'accept',id},p.id);}
}
function netTeleportApply(place,from){
  if(!netTeleportCanMove())return say('Teleport cancelled: leave your vehicle or activity first.',3);
  if(!place||typeof place!=='object')return;
  let v=null,land=null,interior=null;
  if(place.interior){
    interior=netTeleportCheckRoom(place.interior);if(!interior||!Array.isArray(place.spawn)||place.spawn.length!==3||!place.spawn.every(netNum))return;
  }else if(place.home){
    const d=place.home;if(!Number.isInteger(d.cell)||!SHOP[d.cell]||ITEMS[d.kind]?.kind!=='home')return;
    v={cell:d.cell,kind:d.kind,door:Array.isArray(d.door)&&d.door.length===2&&d.door.every(netNum)?d.door.map(worldCoord):null,home:netGuestHome(d),from,name:net.peers.get(from).name,until:netNow()+1800};
  }else{
    if(!netNum(place.x)||!netNum(place.y))return;
    land=netLandNear(worldCoord(place.x),worldCoord(place.y),.5);if(!land)return say('The arrival spot is blocked.',3);
  }
  if(mode==='room')leaveRoom();
  fx.skating=false;body.seat=null;body.z=body.vz=body.mx=body.my=body.peak=0;body.buf=-Infinity;body.hop=1;roofH=0;roofLot=null;climbing=null;chute=null;freecam=null;
  for(const k in K)K[k]=0;
  if(interior){const {kind,...extra}=interior;enterRoom(kind,extra,place.spawn);if(!roomOpen(px,py))[px,py]=room.def.spawn||[room.W/2,room.H-1.6];}
  else if(v){net.invites.set(from,v);[px,py]=v.door||[v.cell%N+.5,Math.floor(v.cell/N)+.5];netEnterAsGuest(v);}else{room=null;me=null;mode='walk';[px,py]=land;a=netNum(place.a)?place.a:0;pitch=0;}
  closeNetPlayers();say(place.entrance?'Teleport accepted. You arrive at their building entrance.':'Teleport accepted. You arrive beside your friend.',3);net.sendT=0;
}
function netTeleportMessage(type,d,from,p,now){
  if(type!=='teleport')return false;
  if(!d||typeof d.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(d.id))return true;
  if(d.op==='request'){
    if(!['to','here'].includes(d.dir)||!netAllow(p.teleportBucket||={},now,5,2))return true;
    netTeleports.set(d.id,{peer:from,dir:d.dir,incoming:true,until:now+30});
    netLog(`${p.name} ${d.dir==='to'?'wants to teleport to you':'asks you to teleport to them'}. Hold Tab to accept or decline.`);netPlayersShow();return true;
  }
  const r=netTeleports.get(d.id);if(!r||r.peer!==from||r.until<now)return true;
  if(d.op==='decline'){netTeleports.delete(d.id);netLog(`${p.name} declined the teleport request.`);}
  else if(d.op==='accept'&&!r.incoming&&r.dir==='here'){
    const place=netTeleportPlace(p);netTeleports.delete(d.id);
    net.tx.send('teleport',place?{op:'move',id:d.id,place}:{op:'decline',id:d.id},from);
  }else if(d.op==='move'&&(!r.incoming&&r.dir==='to'||r.incoming&&r.dir==='here'&&r.accepted)){
    netTeleports.delete(d.id);netTeleportApply(d.place,from);
  }
  netPlayersShow();return true;
}
