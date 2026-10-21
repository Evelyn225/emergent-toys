// The notice and results remain accessible when the tackle counter is shuttered.
let fishingCompetitionEl=null;
function openFishingCompetition() {
  if(shopEl?.style.display==='flex')hidePanel(shopEl);
  const r=fishCompetition.round,active=fishingCompetitionActive(),pending=r&&!r.claimed,entered=fishCompetition.enteredDay>=dayNum;
  const ready=fishingCompetitionOpen()&&!active&&!pending&&!entered,rod=inv.some(it=>ITEMS[it.id]?.rod);
  const board=r?fishingCompetitionBoard(r).map((p,n)=>`<tr${p.you?' style="color:#ffe28b"':''}><td style="padding:5px">${n+1}. ${p.name}</td><td style="padding:5px;text-align:right">${p.best?`${p.best.kg}kg ${ITEMS[p.best.id].name}`:'No catch yet'}</td></tr>`).join(''):'';
  const status=active?`${fishingCompetitionStatus()} · the clock is paused here.`:pending?'The round is over. Your final standings:':fishingCompetitionOpen()?(entered?'You have entered this Friday. Next entry: next Friday.':'Entries open until midnight. Your clock starts when you join.'):'Entries open all day Friday, midnight to midnight.';
  fishingCompetitionEl ||= panel('fishing-competition');
  showPanel(fishingCompetitionEl,`<h1>Friday Fish-off</h1><p class="sub">Sunset Pier angling club · free entry</p>
    <p>${status}</p><p class="sub">Five minutes of active play. Biggest single fish wins; ties go to the earlier catch. Fish anywhere, on foot or from a boat. Only fish landed from a new cast during your round count. Fresh catches are weighed automatically, even with a full bag. You can keep or sell them.</p>
    <p class="sub">1st ${fmt$(FISH_OFF_PRIZES[0])} · 2nd ${fmt$(FISH_OFF_PRIZES[1])} · 3rd ${fmt$(FISH_OFF_PRIZES[2])}. One round per Friday. Menus pause the clock; saving keeps your remaining time. A late entry gets the full round, even past midnight.</p>
    ${board?`<h2>${active?'Live standings':'Last round'}</h2><table style="width:100%;font:inherit">${board}</table>`:''}
    <p class="sub">Club wins: ${fishCompetition.wins}${fishCompetition.best?` · your competition record: ${catchName(fishCompetition.best)}`:''}</p>
    ${ready?`<button class="item" data-fish-join ${rod?'':'disabled'}><span class="k">1</span><span>Join · start my five minutes</span></button>${rod?'':'<p class="sub">Bring a rod. The tackle counter sells them from 5am to 8pm.</p>'}`:''}
    ${pending&&!active?`<button class="item" data-fish-claim><span class="k">1</span><span>Collect results${fishingCompetitionPrize()?` · ${fmt$(fishingCompetitionPrize())}`:''}</span></button>`:''}
    ${hutOpen()?'<button class="item" data-fish-shop>Buy rods / sell catches</button>':'<p class="sub">Tackle counter closed · opens 5am to 8pm. Competition entry and results stay open.</p>'}
    <button class="item" data-fish-close>${active?'Resume fishing':'Close'}</button><p class="hint">1: join / collect · E / Esc: close</p>`);
  fishingCompetitionEl.onclick=e=>{
    if(e.target.closest('[data-fish-join]'))return fishingCompetitionAction('join');
    if(e.target.closest('[data-fish-claim]'))return fishingCompetitionAction('claim');
    if(e.target.closest('[data-fish-shop]')){hidePanel(fishingCompetitionEl);return useHut();}
    if(e.target.closest('[data-fish-close]'))hidePanel(fishingCompetitionEl);
  };
}
function fishingCompetitionAction(action) {
  const result=action==='join'?joinFishingCompetition():claimFishingCompetition();
  if(result[0])saveGame();say(result[1],5);
  if(result[0]&&action==='join'){hidePanel(fishingCompetitionEl);return;}
  openFishingCompetition();
}
function fishingCompetitionPanelKey(e) {
  if(fishingCompetitionEl?.style.display==='flex'){
    if(e.code==='Escape'||e.code==='KeyE')hidePanel(fishingCompetitionEl);
    if(e.code==='Digit1'){
      if(fishingCompetitionEl.querySelector('[data-fish-join]:not(:disabled)'))fishingCompetitionAction('join');
      else if(fishingCompetitionEl.querySelector('[data-fish-claim]'))fishingCompetitionAction('claim');
    }
    return true;
  }
  if(shopEl?.style.display==='flex'&&shopCtx?.title==='BAIT & TACKLE'&&e.code==='KeyF'){openFishingCompetition();return true;}
  return false;
}
function addFishingCompetitionShop() {
  const row=document.createElement('button');row.className='item';row.dataset.fishCompetition='';
  row.innerHTML='<span class="k">F</span><span>Friday Fish-off · entry / standings / results</span>';
  row.onclick=openFishingCompetition;shopEl.querySelector('.panel').append(row);
}
