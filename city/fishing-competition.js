// Friday entry is a calendar window; each angler gets a full five minutes of play.
const FISH_OFF_SECONDS = 300, FISH_OFF_PRIZES = [250,125,60];
const fishCompetition = {enteredDay:-1,round:null,wins:0,best:null};
const fishingCompetitionOpen = () => mod(dayNum,7)===4;
const fishingCompetitionActive = () => !!fishCompetition.round && fishCompetition.round.left>0;
let fishingCompetitionFieldCache=null;
function fishingCompetitionField(day) {
  if(fishingCompetitionFieldCache?.day===day)return fishingCompetitionFieldCache.rows;
  const rows=['Mags','Old Len','Jo','Rafi'].map((name,n)=>({name,catches:Array.from({length:4},(_,k)=>{
    const id=['mackerel','seabass','cod','conger'][(n+k)%4],range=ITEMS[id].kg;
    const kg=Math.round((range[0]+(range[1]-range[0])*hash(day,n*4+k,2719)**2*.55)*10)/10;
    return {at:35+k*65+Math.floor(hash(day,n*4+k,2720)*25),id,kg};
  })}));
  fishingCompetitionFieldCache={day,rows};return rows;
}
function fishingCompetitionBoard(r=fishCompetition.round) {
  if(!r)return [];
  const elapsed=FISH_OFF_SECONDS-r.left;
  const rows=fishingCompetitionField(r.day).map(({name,catches})=>{
    let best=null,at=Infinity;
    for(const c of catches)if(c.at<=elapsed&&(!best||c.kg>best.kg)){best=c;at=c.at;}
    return {name,best,at,you:false};
  });
  rows.push({name:'You',best:r.best,at:r.best?r.bestAt:Infinity,you:true});
  return rows.sort((a,b)=>(b.best?.kg||0)-(a.best?.kg||0)||a.at-b.at||Number(a.you)-Number(b.you));
}
function fishingCompetitionPrize(r=fishCompetition.round) {
  if(!r||r.left>0||!r.best)return 0;
  return FISH_OFF_PRIZES[fishingCompetitionBoard(r).findIndex(p=>p.you)]||0;
}
function joinFishingCompetition() {
  if(!fishingCompetitionOpen())return [false,'Entries open all day Friday, midnight to midnight.'];
  if(fishCompetition.round&&(!fishCompetition.round.claimed||fishCompetition.round.left>0))return [false,'Finish your round and collect its results first.'];
  if(fishCompetition.enteredDay>=dayNum)return [false,'One entry each Friday. Come back next week.'];
  if(!inv.some(it=>ITEMS[it.id]?.rod))return [false,'Bring a fishing rod. The tackle counter sells them from 5am to 8pm.'];
  fishCompetition.enteredDay=dayNum;
  fishCompetition.round={day:dayNum,left:FISH_OFF_SECONDS,best:null,bestAt:FISH_OFF_SECONDS,count:0,claimed:false};
  fishing=null; // A fish hooked before signing up cannot become a competition entry.
  return [true,'The whistle goes! Five minutes, biggest fish wins. Fresh catches are weighed automatically; fish anywhere.'];
}
function stepFishingCompetition(dt) {
  if(paused||!fishingCompetitionActive()||!Number.isFinite(dt)||dt<=0)return '';
  const r=fishCompetition.round;r.left=Math.max(0,r.left-dt);
  if(r.left>0)return '';
  const place=fishingCompetitionBoard(r).findIndex(p=>p.you)+1,prize=fishingCompetitionPrize(r);
  return `Time! ${r.best?`${catchName(r.best)}: place ${place} of 5.`:'No fish weighed this round.'} ${prize?`${fmt$(prize)} prize waiting.`:'The regulars tip their hats.'} Collect your results at Bait & Tackle, any time.`;
}
function recordFishingCompetitionCatch(f) {
  const r=fishCompetition.round,c=f.catch;
  if(!fishingCompetitionActive()||f.competitionDay!==r.day||f.competitionScored||!c||ITEMS[c.id]?.kind!=='fish'||!Number.isFinite(c.kg)||c.kg<=0)return '';
  f.competitionScored=true;r.count++;
  if(r.best&&c.kg<=r.best.kg)return '';
  r.best={id:c.id,kg:c.kg};r.bestAt=FISH_OFF_SECONDS-r.left;
  if(!fishCompetition.best||c.kg>fishCompetition.best.kg)fishCompetition.best={...r.best};
  return ' Your new competition best!';
}
function claimFishingCompetition() {
  const r=fishCompetition.round;
  if(!r||r.left>0||r.claimed)return [false,'No results to collect.'];
  const prize=fishingCompetitionPrize(r);r.claimed=true;
  if(prize)earn(prize);
  if(r.best&&fishingCompetitionBoard(r)[0].you)fishCompetition.wins++;
  return [true,prize?`${fmt$(prize)} paid. Your Friday result is in the book.`:'Your Friday result is in the book. There is always next week.'];
}
function fishingCompetitionStatus() {
  const r=fishCompetition.round;
  if(r&&r.left>0){const s=Math.ceil(r.left);return `FISH-OFF ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} | best ${r.best?`${r.best.kg}kg`:'none'} | ${fishingCompetitionBoard(r).findIndex(p=>p.you)+1}/5`;}
  if(r&&!r.claimed)return 'FISH-OFF: results waiting at Bait & Tackle';
  return '';
}
function loadFishingCompetition(data) {
  const fish=c=>c&&ITEMS[c.id]?.kind==='fish'&&Number.isFinite(c.kg)&&c.kg>0&&c.kg<=ITEMS[c.id].kg[1]?{id:c.id,kg:Math.round(c.kg*10)/10}:null;
  fishCompetition.enteredDay=Number.isInteger(data?.enteredDay)&&data.enteredDay>=0&&data.enteredDay<=dayNum&&mod(data.enteredDay,7)===4?data.enteredDay:-1;
  fishCompetition.wins=Number.isInteger(data?.wins)?clamp(data.wins,0,100000):0;fishCompetition.best=fish(data?.best);fishCompetition.round=null;
  const r=data?.round;
  if(!r||!Number.isInteger(r.day)||r.day<0||mod(r.day,7)!==4||r.day>dayNum||!Number.isFinite(r.left)||r.left<0||r.left>FISH_OFF_SECONDS)return;
  const best=fish(r.best);
  fishCompetition.round={day:r.day,left:r.left,best,bestAt:best&&Number.isFinite(r.bestAt)?clamp(r.bestAt,0,FISH_OFF_SECONDS-r.left):FISH_OFF_SECONDS,
    count:Number.isInteger(r.count)?clamp(r.count,0,100000):0,claimed:r.left===0&&r.claimed===true};
  fishCompetition.enteredDay=Math.max(fishCompetition.enteredDay,r.day);
}
