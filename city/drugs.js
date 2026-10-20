// Temporary, deliberately fantastical screen effects. Timers use simulation seconds, never wall-clock time.
const DRUG_EFFECTS = {
  weed: { duration: 80, label: 'green haze', line: 'You use a little weed. The city takes a long, warm breath.', sound: 'drag' },
  neon: { duration: 65, label: 'Neon vision', line: 'You take a Neon packet. The edges of the city start remembering where they were.', sound: 'sip' }
};
const drugEffects = { weed: 0, neon: 0, weedIn: 0, neonIn: 0, cooldown: 0 };
ITEMS.joint = {name:'joint',price:0,kind:'smoke',uses:1,weed:true};
function addDrugEffect(id,quality,amount=1) {
  const potency={perfect:1.15,fine:1,burnt:.8}[quality] || 1;
  if(!drugEffects[id])drugEffects[id+'In']=0;
  drugEffects[id]=Math.min(120,drugEffects[id]+DRUG_EFFECTS[id].duration*potency*amount);
}
function prepareJoint(it) {
  if(it.uses>1&&inv.length>=INV_SIZE)return ['Make room in your bag for the joint.',null];
  const joint={id:'joint',uses:1,...(it.q?{q:it.q}:{})};
  animateHeldUse(it);
  if(it.uses===1) {inv[inv.indexOf(it)]=joint;held=inv.indexOf(joint);}
  else {it.uses--;carryItem(joint);}
  return ['You take out a joint. Q / left click to light it, then take drags with empty hands.','page'];
}
function takeSmokeDrag() {
  if(fx.smokeKind==='joint') {
    if(drugEffects.cooldown>0)return ['Give it a moment.',null];
    addDrugEffect('weed',fx.smokeQuality,.15);drugEffects.cooldown=1.2;
  }
  cigTip=1;
  return [fx.smokeKind==='joint'?'You take a drag of the joint. The city breathes with you.':'You take a drag.','drag'];
}
function lightJoint(it) {
  if(fx.smoke>0)return takeSmokeDrag();
  if(drugEffects.cooldown>0)return ['Give it a moment.',null];
  addDrugEffect('weed',it.q,.75);drugEffects.cooldown=1.2;
  fx.smoke=55;fx.pipe=false;fx.smokeKind='joint';fx.smokeQuality=it.q;cigTip=1;
  removeInventoryAt(inv.indexOf(it));held=-1;
  return ['You light the joint. Q / left click with empty hands takes a drag.','light'];
}
function consumeDrug(it) {
  const effect=DRUG_EFFECTS[it?.id];
  if (!effect || !inv.includes(it) || it.uses<=0) return ['Nothing left in that pack.',null];
  if(it.id==='weed')return prepareJoint(it);
  if (drugEffects.cooldown>0) return ['Give it a moment.',null];
  addDrugEffect(it.id,it.q);
  drugEffects.cooldown=1.2;
  animateHeldUse(it);it.uses--;
  if (!it.uses) removeInventoryAt(inv.indexOf(it));
  return [effect.line,effect.sound];
}
function stepDrugEffects(dt) {
  drugEffects.cooldown=Math.max(0,drugEffects.cooldown-dt);
  for (const id of Object.keys(DRUG_EFFECTS)) {
    drugEffects[id]=Math.max(0,drugEffects[id]-dt);
    drugEffects[id+'In']=drugEffects[id]?Math.min(3,drugEffects[id+'In']+dt):0;
  }
}
function clearDrugEffects(amount=Infinity) {
  for (const id of Object.keys(DRUG_EFFECTS)) {
    drugEffects[id]=Math.max(0,drugEffects[id]-amount);
    if (!drugEffects[id]) drugEffects[id+'In']=0;
  }
}
function drugVisualStrength(id) {
  const start=clamp(drugEffects[id+'In']/3,0,1), end=clamp(drugEffects[id]/12,0,1);
  return start*start*(3-2*start)*end;
}
function drugEffectTags() {
  return Object.entries(DRUG_EFFECTS).filter(([id])=>drugEffects[id]>0)
    .map(([id,effect])=>`${effect.label} ${Math.ceil(drugEffects[id])}s`);
}
