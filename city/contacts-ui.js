// Negotiation and a supplier who can visit your building. The cupboard remains a convenient order book.
let drugSaleContext=null, buyerAwayUntil=0, supplierEl=null, supplierVisit=null;
function streetContactLook(profile) {return figLook(profile.look);}
function drawStreetContact(contact,marker,color,pose='fold') {
  const [vx,vy]=R(contact.x,contact.y);if(!inView(vx,vy,.25))return;
  const ground=architectureGroundHeight(contact.x,contact.y), n=Math.hypot(vx,vy)||1;
  drawFigure(vx,vy,ground,.175,-vx/n,-vy/n,contact.look,pose);
  const depth=dx*vx+dy*vy;
  if(depth<.05||depth>vis)return;
  const c=Math.floor(cols/2+(-dy*vx+dx*vy)*projX/depth),r=Math.floor(hor-(ground+.215-eye)*projY/depth);
  if(c<0||c>=cols||r<0||r>=rows)return;
  const i=r*cols+c;
  if(depth<ZB[i]){set(i,marker,C(color,15));ZB[i]=depth;FL[i]=0;}
}
function showDrugNegotiation(line='') {
  const context=drugSaleContext;if(!context)return;
  const {visit}=context,b=drugBuyerProfile(visit.id),r=drugRelationship(b.id),stock=buyerStocks(visit);
  if(!stock.some(s=>s.it===context.it)) {
    context.it=stock[0]?.it;
    if(context.it) {context.count=Math.min(context.it.uses,visit.remaining);context.price=buyerUnitPrice(visit,context.it);}
  }
  const it=context.it, max=it?Math.min(it.uses,visit.remaining):0;
  let familiarity='First meeting';
  if(r.deals>=3)familiarity='Regular customer';
  else if(r.deals)familiarity='Familiar face';
  const fieldStyle='display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:center;margin:8px 0';
  const options=stock.map(({it,index})=>`<option value="${index}" ${context.it===it?'selected':''}>${itemName(it)} · ${it.uses} carried</option>`).join('');
  const counter=visit.counter;
  drugSaleEl ||= panel('drug-sale');
  showPanel(drugSaleEl,`<h1>${b.name}</h1><p class="sub">${b.description}</p><p>${line || (r.deals?b.again:b.hello)}</p>
    <p class="sub">${familiarity} &middot; ${r.deals} completed deals<br>Wants up to ${visit.remaining} ${b.product==='any'?'weed or Neon':ITEMS[b.product].name} packs${b.premium?' · premium only':''}.</p>
    ${it?`<label style="${fieldStyle}"><span>Stock</span><select data-deal-stock aria-label="Stock to offer">${options}</select></label>
    <label style="${fieldStyle}"><span>Packs</span><input data-deal-count aria-label="Packs to offer" type="number" min="1" max="${max}" step="1" value="${context.count}"></label>
    <label style="${fieldStyle}"><span>Each ($)</span><input data-deal-price aria-label="Price per pack" type="number" min="1" max="999" step="1" value="${context.price}"></label>
    <p class="sub">Usual price: ${fmt$(buyerUnitPrice(visit,it))} each. A fair deal builds the relationship.</p>
    <button class="item" data-drug-sell>Offer ${context.count} for ${fmt$(context.count*context.price)}</button>
    ${counter?`<button class="item" data-drug-counter>Accept ${b.name}'s offer &middot; ${fmt$(counter.count*counter.price)}</button>`:''}`:
    '<p class="sub">Bring the right stock from your closet. You can keep the rest.</p>'}
    <button class="item" data-drug-leave>Maybe later</button><p class="hint">1 make offer &middot; E / Esc close. Three unreasonable offers end the visit. Visible deals can be reported.</p>`);
  drugSaleEl.querySelector('.panel').style.width='min(480px, calc(100vw - 32px))';
  for(const el of drugSaleEl.querySelectorAll('input,select')) Object.assign(el.style,{font:'inherit',color:'#ddd',background:'#141418',border:'1px solid #444',padding:'5px',minWidth:'0',width:'100%',boxSizing:'border-box'});
  drugSaleEl.onchange=e=>{
    if(e.target.hasAttribute('data-deal-stock')) {
      context.it=inv[+e.target.value];context.count=Math.min(context.it.uses,visit.remaining);context.price=buyerUnitPrice(visit,context.it);
      visit.counter=null;showDrugNegotiation();
    }
  };
  drugSaleEl.oninput=e=>{
    if(e.target.hasAttribute('data-deal-count')) context.count=+e.target.value;
    if(e.target.hasAttribute('data-deal-price')) context.price=+e.target.value;
    const offer=drugSaleEl.querySelector('[data-drug-sell]');
    if(offer) offer.textContent=`Offer ${context.count} for ${fmt$(context.count*context.price)}`;
  };
  drugSaleEl.onclick=e=>{
    if(e.target.closest('[data-drug-sell]'))completeDrugSale();
    if(e.target.closest('[data-drug-counter]'))settleDrugCounter();
    if(e.target.closest('[data-drug-leave]'))hidePanel(drugSaleEl);
  };
}
function beginDrugNegotiation() {
  const buyer=nearDrugBuyer();if(!buyer)return;
  const b=drugBuyerProfile(buyer.visit.id);
  if(wanted.stars)return say(`${b.name} shakes their head. "Lose the police first."`,3);
  drugSaleContext={buyer,visit:buyer.visit,it:null,count:0,price:0};
  showDrugNegotiation();
}
function endDrugBuyerVisit(delay=20) {
  drugBuyer=null;drugSaleContext=null;buyerAwayUntil=T+delay;
  drugDemand.until=0;drugDemand.next=T+delay;hidePanel(drugSaleEl);
}
function offerDrugSale() {
  const c=drugSaleContext;if(!c||nearDrugBuyer()!==c.buyer||wanted.stars)return;
  const result=negotiateDrugOrder(c.visit,c.it,c.count,c.price);
  if(result.status==='accepted')return settleDrugOrder(c.it,c.count,result.price);
  if(result.status==='leave'){endDrugBuyerVisit(40);say(result.line,4);saveGame();return;}
  showDrugNegotiation(result.line);
}
function settleDrugCounter() {
  const offer=drugSaleContext?.visit.counter;
  if(offer)settleDrugOrder(offer.it,offer.count,offer.price);
}
function settleDrugOrder(it,count,price) {
  const c=drugSaleContext;if(!c||nearDrugBuyer()!==c.buyer||wanted.stars)return;
  const result=tradeDrugOrder(c.visit,it,count,price);
  if(!result[0])return showDrugNegotiation(result[1]);
  const seen=crime('dealing',c.buyer.x,c.buyer.y);
  say(result[1]+(seen==='cop'?' A cop saw the exchange.':seen==='reported'?' Someone noticed the exchange.':''),5);
  endDrugBuyerVisit();saveGame();
}
function callWorkshopSupplier(home=workshopHome()||nearestWorkshopHome()) {
  if(!home){say('Mara delivers to your apartment. Find a realty office on the map to get set up.',5);return false;}
  const door=buyerDoor(home);if(!door)return say('Mara cannot find a clear place outside.',3);
  let point=null;
  const offsets=[.35,.6,1,1.5].flatMap(r=>[[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]]);
  for(const [ox,oy] of offsets) {
    const x=worldCoord(door[0]+ox),y=worldCoord(door[1]+oy);
    if(!map[idx(Math.floor(x),Math.floor(y))]&&!isWater(x,y)&&!architectureBlocked(x,y)&&!landmarkBlocked(x,y)&&!lampAt(x,y,.05)) {point=[x,y];break;}
  }
  if(!point){say('Mara cannot find a clear place by this building.',4);return false;}
  supplierVisit={home:home.cell,x:point[0],y:point[1],until:Infinity,look:streetContactLook(SUPPLIER)};
  hidePanel(workshopEl);
  setMapWaypoint({id:'supplier',name:'Mara · workshop supplier',x:point[0],y:point[1]});
  say('Mara: "I\'m outside. Yellow cap." Waypoint set; M opens the map. She will wait for you.',6);
  return true;
}
function nearWorkshopSupplier() {
  if(supplierVisit && (T>=supplierVisit.until||!owned.homes.some(h=>h.cell===supplierVisit.home)))supplierVisit=null;
  if(!supplierVisit||mode!=='walk')return null;
  const ex=rel(supplierVisit.x-px),ey=rel(supplierVisit.y-py),d=Math.hypot(ex,ey);
  const buyer=nearDrugBuyer();
  if(buyer && Math.hypot(rel(buyer.x-px),rel(buyer.y-py))<d)return null;
  return d<.5&&(d<.12||(ex*Math.cos(a)+ey*Math.sin(a))/d>.4)?supplierVisit:null;
}
function drawWorkshopSupplier() {
  nearWorkshopSupplier();
  if(supplierVisit)drawStreetContact(supplierVisit,'+',YEL,'ease');
}
function openWorkshopSupplier(line='') {
  const contact=nearWorkshopSupplier(),home=contact&&owned.homes.find(h=>h.cell===contact.home);if(!home)return;
  if(wanted.stars)return say('Mara: "Call me when the police are gone."',4);
  const w=workshopState(home),orders=drugContacts.supplierOrders;
  const stock=[['kit','Starter crate',WORKSHOP_KIT_PRICE,w.owned.bench>=3],['refill','Five Neon refills',WORKSHOP_REFILL_PRICE,w.supplies>294],
    ['rack','Grow rack + 3 seed pods',WEED_RACK_PRICE,w.owned.growrack>=3],['seeds','Five seed pods',WEED_SEEDS_PRICE,w.seeds>294],['fan','Cooling fan',WORKSHOP_FAN_PRICE,w.owned.fan>=3],
    ...Object.entries(WORKSHOP_UPGRADES).map(([id,u])=>[id,u.name,u.price,w.upgrades[id]])];
  supplierEl ||= panel('workshop-supplier');
  showPanel(supplierEl,`<h1>Mara</h1><p class="sub">${SUPPLIER.description}</p><p>${line || (orders>=3?'"My regular. What are we running short on?"':'"Mara. Equipment, refills, seed pods. I keep things moving."')}</p>
    <p class="sub">${fmt$(money)} &middot; ${orders} completed orders. Everything goes straight to this apartment's cupboard.</p>
    ${stock.map(([id,name,price,full])=>`<button class="item" data-supplier-order="${id}" ${full||money<price?'disabled':''}><span>${cap(name)}</span><span class="lead"></span><span class="v">${full?'stocked':fmt$(price)}</span></button>`).join('')}
    <button class="item" data-supplier-dismiss>Thanks, see you around</button><p class="hint">E / Esc close. You can also order through Mara's book in your workshop cupboard.</p>`);
  supplierEl.onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.supplierOrder) {
      const result=orderWorkshopSupply(home,b.dataset.supplierOrder);saveGame();openWorkshopSupplier(result[1]);
    }
    if(b.hasAttribute('data-supplier-dismiss')){supplierVisit=null;hidePanel(supplierEl);if(mapWaypoint?.id==='supplier')clearMapWaypoint();}
  };
}
