// Appearance belongs to the player, across saved games and multiplayer names.
const PLAYER_APPEARANCE_KEY='asciiCity.appearance.v1';
let playerAppearance=null;
try{const saved=JSON.parse(localStorage.getItem(PLAYER_APPEARANCE_KEY));if(saved?.custom===1)playerAppearance=netCheckLook(saved);}catch(e){/* use the original outfit */}
let appearanceEl=null,appearanceView=0,appearanceReturn='pause';
const appearanceOpen=()=>!!appearanceEl&&appearanceEl.style.display==='flex';
function setPlayerAppearance(raw){
 playerAppearance=netCheckLook({...raw,custom:1});
 let saved=true;try{localStorage.setItem(PLAYER_APPEARANCE_KEY,JSON.stringify(playerAppearance));}catch(e){saved=false;}
 skaterLookMemo=null;
 if(net.on){net.look={...playerAppearance};net.tx.send('hello',{name:net.name,ver:netBuildId(),look:net.look});}
 return saved;
}
function appearanceDefault(){
 return netCheckLook({...((net.on&&net.look)||{hat:3,top:2,bot:0}),skin:2,hairStyle:0,hairColour:1,headwear:0,shirtStyle:0,shoes:0,custom:1});
}
function appearancePreview(){
 const canvas=appearanceEl.querySelector('canvas'),ctx=canvas.getContext('2d'),look=figLook(netAppearanceOptions(playerAppearance||appearanceDefault()));
 const spr=figSprite(look,appearanceView,'stand'),scale=7,left=(canvas.width-FIG_W*scale)/2,top=8;
 ctx.fillStyle='#101719';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#34433d';ctx.fillRect(36,canvas.height-12,canvas.width-72,1);
 for(let y=0;y<FIG_H;y++)for(let x=0;x<FIG_W;x++){
  const role=spr[y*FIG_W+x];if(!role)continue;
  ctx.fillStyle=PAL[C(look.base[role],look.lvl[role])];ctx.fillRect(left+x*scale,top+y*scale,scale,scale);
 }
 appearanceEl.querySelector('[data-view-label]').textContent=['Front','Front quarter','Side','Back quarter','Back','Back quarter','Side','Front quarter'][Math.floor(appearanceView/2)%8];
}
function buildAppearance(){
 const colors=['Red','Blue','Green','Orange','Yellow','Purple','Cyan','White','Gray','Rust'];
 const fields=[['skin','Skin tone',PLAYER_STYLE_CHOICES.skin],['hairStyle','Hair',PLAYER_STYLE_CHOICES.hairStyle],['hairColour','Hair color',PLAYER_STYLE_CHOICES.hairColour],['headwear','Headwear',PLAYER_STYLE_CHOICES.headwear],['hat','Hat color',colors],['shirtStyle','Top style',PLAYER_STYLE_CHOICES.shirtStyle],['top','Top color',colors],['bot','Pants',['Blue jeans','Charcoal','Brown']],['shoes','Shoes',PLAYER_STYLE_CHOICES.shoes]];
 const el=menuEl('appearance',540,`<div class="panel" role="dialog" aria-label="Customize character" style="width:min(700px,calc(100vw - 24px))">
 <div class="panel-heading"><h1>Your character</h1><button class="panel-close" data-appearance-back aria-label="Close character customization">×</button></div>
 <p class="sub">Changes save automatically. Wear the same look in every room.</p>
 <div class="appearance-layout"><div class="appearance-preview"><canvas width="232" height="260" role="img" aria-label="Preview of your character"></canvas>
 <div class="appearance-turn"><button data-turn="-2" aria-label="Turn character left">←</button><span data-view-label>Front</span><button data-turn="2" aria-label="Turn character right">→</button></div></div>
 <div class="appearance-fields">${fields.map(([key,label,choices])=>`<label><span>${label}</span><select data-look="${key}" aria-label="${label}">${choices.map((text,i)=>`<option value="${i}">${text}</option>`).join('')}</select></label>`).join('')}</div></div>
 <p class="sub" data-appearance-status role="status">Choose an outfit, then head back into the city.</p>
 <button class="item" data-appearance-random>Shuffle outfit</button><button class="item" data-appearance-back>Done</button></div>`);
 const style=document.createElement('style');style.textContent=`#appearance .appearance-layout{display:grid;grid-template-columns:232px minmax(0,1fr);gap:24px;align-items:start}#appearance .appearance-preview{position:sticky;top:55px;border:1px solid #465452;background:#101719}#appearance canvas{position:static;inset:auto;z-index:auto;display:block;width:100%;height:auto;image-rendering:pixelated}#appearance .appearance-turn{display:flex;align-items:center;justify-content:space-between;padding:8px;color:#bdcdc4}#appearance .appearance-turn button{min-width:44px;min-height:36px;border:1px solid #64756e}#appearance .appearance-fields label{display:grid;grid-template-columns:1fr 1.15fr;align-items:center;gap:12px;min-height:42px;color:#b8c8c0}#appearance select{width:100%;min-width:0;min-height:36px;padding:5px;color:#edf0df;background:#18241f;border:1px solid #64756e;font:inherit}#appearance select:focus-visible{outline:2px solid #b9e7d5}#appearance select:disabled{opacity:.45}@media(max-width:580px){#appearance .appearance-layout{grid-template-columns:1fr;gap:12px}#appearance .appearance-preview{position:static;width:174px;justify-self:center}#appearance .appearance-fields label{min-height:44px}}`;
 document.head.appendChild(style);
 el.addEventListener('change',e=>{const key=e.target.dataset.look;if(!key)return;const look={...(playerAppearance||appearanceDefault()),[key]:Number(e.target.value)};appearanceApply(look);});
 el.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-appearance-back'))closeAppearance();
  if(b.dataset.turn){appearanceView=mod(appearanceView+Number(b.dataset.turn),FIG_VIEWS);appearancePreview();}
  if(b.hasAttribute('data-appearance-random')){
   const look={...(playerAppearance||appearanceDefault())};
   for(const [key,,choices]of fields)if(['headwear','hat','shirtStyle','top','bot','shoes'].includes(key))look[key]=Math.floor(Math.random()*choices.length);
   appearanceApply(look);
  }
 });
 el.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();closeAppearance();}e.stopPropagation();});
 el.addEventListener('keyup',e=>e.stopPropagation());
 return el;
}
function appearanceApply(look){
 const saved=setPlayerAppearance(look);appearanceShow();
 appearanceEl.querySelector('[data-appearance-status]').textContent=saved?'Saved. Your new look is ready.':'Applied for this session.';
}
function appearanceShow(){
 const look=playerAppearance||appearanceDefault();
 for(const select of appearanceEl.querySelectorAll('[data-look]'))select.value=look[select.dataset.look];
 appearanceEl.querySelector('[data-look="hat"]').disabled=look.headwear===2;
 appearanceEl.querySelector('[data-look="hairColour"]').disabled=look.hairStyle===7;
 appearancePreview();
}
function openAppearance(from='pause'){
 if(!paused)openPause();
 appearanceReturn=from;appearanceEl=appearanceEl||buildAppearance();appearanceView=0;
 appearanceEl.style.display='flex';appearanceShow();
 appearanceEl.querySelector('[data-look="skin"]').focus();
}
function closeAppearance(){
 if(!appearanceEl)return;appearanceEl.style.display='none';
 (appearanceReturn==='multiplayer'?netMenuEl?.querySelector('[data-net-act="appearance"]'):pauseEl?.querySelector('[data-act="appearance"]'))?.focus();
}

function playerSkinColour(delta=0,fallback=13){
 if(!playerAppearance)return C(SKIN,fallback);
 const [base,level]=FIG_SKINS[playerAppearance.skin];return C(base,level+delta);
}
