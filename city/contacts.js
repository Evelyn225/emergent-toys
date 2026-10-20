// Recurring faces, small orders, and a bounded negotiation. Relationships persist; active visits do not.
const DRUG_BUYERS = [
  {id:'kit',name:'Kit',description:'Blue jacket, red backpack. Easygoing, buys either.',product:'any',max:8,rate:1,margin:.22,
    hello:'Got anything going? I can take a few packs.',again:'Good to see you again. Same deal?',look:{hair:'short',top:'jacket',pack:true,col:{top:[BLUE,10],pack:[RED,10],skin:[SKIN,12]}}},
  {id:'juno',name:'Juno',description:'Green jacket, hair in a bun. A little good weed.',product:'weed',max:3,rate:1.15,margin:.22,
    hello:'Just a little weed. Good stuff, if you have it.',again:'That last batch was nice. What have you got?',look:{hair:'bun',top:'jacket',bw:.9,col:{top:[GREEN,10],skin:[BRICK,10],hair:[GRAY,1]}}},
  {id:'dex',name:'Dex',description:'Orange cap, gray hoodie. Quantity over fancy labels.',product:'weed',max:8,rate:.85,margin:.15,
    hello:'I buy a bit more, but I watch the price.',again:'Back for more. Keep it reasonable, yeah?',look:{hair:'buzz',hat:'cap',top:'long',bw:1.1,col:{top:[GRAY,8],hat:[ORANGE,13],skin:[STONE,13]}}},
  {id:'vale',name:'Vale',description:'Violet suit, shades. Premium Neon only.',product:'neon',premium:true,max:4,rate:1.35,margin:.3,
    hello:'Premium Neon. Nothing else, please.',again:'You know what I like. Show me the good batch.',look:{hair:'bob',top:'suit',shades:true,col:{top:[MAG,7],inner:[WHITE,14],skin:[BRICK,8],hair:[GRAY,1]}}}
];
const SUPPLIER = {name:'Mara',description:'Yellow cap, teal jacket, a backpack full of spares.',
  look:{hair:'pony',hat:'cap',top:'jacket',pack:true,col:{top:[CYAN,7],hat:[YEL,13],pack:[BRICK,8],skin:[SKIN,11]}}};
const drugContacts = {buyers:{},supplierOrders:0,visits:0,last:''};
const drugBuyerProfile = id => DRUG_BUYERS.find(b=>b.id===id) || DRUG_BUYERS[0];
function drugRelationship(id) {
  return drugContacts.buyers[id] ||= {deals:0,trust:0,spent:0};
}
function loadDrugContacts(raw) {
  drugContacts.buyers={};
  for (const b of DRUG_BUYERS) {
    const r=raw?.buyers?.[b.id];
    if(r) drugContacts.buyers[b.id]={deals:clamp(Math.floor(+r.deals||0),0,9999),trust:clamp(Math.floor(+r.trust||0),0,10),spent:clamp(Math.floor(+r.spent||0),0,1e7)};
  }
  drugContacts.supplierOrders=clamp(Math.floor(+raw?.supplierOrders||0),0,9999);
  drugContacts.visits=clamp(Math.floor(+raw?.visits||0),0,1e7);
  drugContacts.last=DRUG_BUYERS.some(b=>b.id===raw?.last)?raw.last:'';
}
function buyerLikesStock(b,it) {
  return ITEMS[it?.id]?.kind==='drug' && it.uses>0 && (b.product==='any'||b.product===it.id) && (!b.premium||it.q==='perfect');
}
function newDrugVisit() {
  const stock=[...inv,...closet], start=drugContacts.visits%DRUG_BUYERS.length;
  let b=DRUG_BUYERS[0];
  for(let n=0;n<DRUG_BUYERS.length;n++) {
    const candidate=DRUG_BUYERS[(start+n)%DRUG_BUYERS.length];
    if(stock.some(it=>buyerLikesStock(candidate,it))) {b=candidate;break;}
  }
  drugContacts.visits=DRUG_BUYERS.indexOf(b)+1;drugContacts.last=b.id;
  return {id:b.id,remaining:b.max,attempts:0,counter:null};
}
function buyerUnitPrice(visit,it) {
  const b=drugBuyerProfile(visit.id), r=drugRelationship(b.id);
  return Math.max(1,Math.round(drugPacketPrice(it)*b.rate*(1+Math.min(.12,r.deals*.02))));
}
function buyerStocks(visit) {
  const b=drugBuyerProfile(visit.id);
  return inv.map((it,index)=>({it,index})).filter(({it})=>buyerLikesStock(b,it));
}
function drugOrderProblem(visit,it,count,price) {
  if (!visit || !inv.includes(it) || !buyerLikesStock(drugBuyerProfile(visit.id),it)) return 'That is not the stock they asked for.';
  if (!Number.isInteger(count)||count<1||count>it.uses||count>visit.remaining) return 'Choose a quantity within the order and your carried stock.';
  if (!Number.isInteger(price)||price<1||price>999) return 'Choose a whole-dollar price per pack.';
  return '';
}
function negotiateDrugOrder(visit,it,count,price) {
  const problem=drugOrderProblem(visit,it,count,price);
  if(problem) return {status:'invalid',line:problem};
  const b=drugBuyerProfile(visit.id), r=drugRelationship(b.id), fair=buyerUnitPrice(visit,it);
  if(price<=fair) return {status:'accepted',price};
  visit.attempts++;visit.counter=null;
  const ceiling=Math.ceil(fair*(1+b.margin+r.trust*.01));
  if(price<=ceiling && visit.attempts<3) {
    const counter=fair+Math.floor((price-fair)*.4);
    visit.counter={it,count,price:counter};
    return {status:'counter',price:counter,line:`"I can do ${fmt$(counter)} a pack. ${count} for ${fmt$(counter*count)}. Deal?"`};
  }
  if(visit.attempts>=3) {
    r.trust=Math.max(0,r.trust-1);
    return {status:'leave',line:'"Forget it. Maybe another time."'};
  }
  return {status:'refused',line:'"Too steep. Give me a sensible price."'};
}
function tradeDrugOrder(visit,it,count,price) {
  const problem=drugOrderProblem(visit,it,count,price);
  if(problem) return [false,problem];
  const b=drugBuyerProfile(visit.id), fair=buyerUnitPrice(visit,it);
  // Only an accepted asking price or this visit's exact counter can settle.
  const counter=visit.counter;
  if(price>fair && !(counter?.it===it && counter.count===count && counter.price===price)) return [false,'Agree a price first.'];
  const total=count*price, r=drugRelationship(b.id), name=ITEMS[it.id].name;
  it.uses-=count;if(!it.uses) removeInventoryAt(inv.indexOf(it));
  earn(total);visit.remaining-=count;visit.counter=null;r.deals++;r.trust=Math.min(10,r.trust+1);r.spent+=total;
  return [true,`${b.name} takes ${count} ${name} packs. ${fmt$(total)} in your pocket.`,total];
}
function orderWorkshopSupply(home,id) {
  let result;
  if(id==='kit') result=buyWorkshopKit(home);
  else if(id==='refill') result=buyWorkshopSupplies(home);
  else if(id==='rack') result=buyWeedEquipment(home);
  else if(id==='seeds') result=buyWeedEquipment(home,false);
  else if(WORKSHOP_UPGRADES[id]) result=buyWorkshopUpgrade(home,id);
  else if(id==='fan') {
    const w=workshopState(home);
    if(w.owned.fan>=3) return [false,'You already have three fans.'];
    if(!pay(WORKSHOP_FAN_PRICE)) return [false,`A fan costs ${fmt$(WORKSHOP_FAN_PRICE)}.`];
    w.owned.fan++;result=[true,'A cooling fan delivered. Place it on a bench.'];
  } else return [false,'That is not on Mara\'s order sheet.'];
  if(result[0]) drugContacts.supplierOrders++;
  return result;
}
