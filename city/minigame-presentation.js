// A readable interface around the original character-grid games. The playfield
// remains pixel/ASCII art; interface type no longer shrinks with its cells.
let MINIGAME_UI=null;
function hideMinigamePresentation(){if(MINIGAME_UI&&!MINIGAME_UI.el.hidden){MINIGAME_UI.el.hidden=true;MINIGAME_UI.key=null;if(TOUCH&&touchEl)showTouch();}}
function minigameInterfaceText(text,g){
 if(CONTROLLER.active)return text.replace(/HOLD SPACE/g,'HOLD A').replace(/SPACE/g,'A').replace(/UP\/DOWN|LEFT\/RIGHT|ARROWS/g,'D-PAD').replace(/\bUP\b/g,'D-PAD UP / X').replace(/\bDOWN\b/g,'D-PAD DOWN').replace(/E leave/g,'B leave');
 const translated=gameText(text,g);return TOUCH?translated.replace(/\s+E leave\b/g,''):translated;
}
function minigamePresentation(g){
 if(!MINIGAME_UI){
  menuStyle();const style=document.createElement('style');style.textContent=`
   #minigame-hud{position:fixed;inset:0;z-index:350;pointer-events:none;font:16px/1.4 W95,monospace;color:#e6eae0;--game-accent:#a9d9ca;}
   #minigame-hud[hidden],#minigame-hud [hidden]{display:none!important;}
   #minigame-hud header,#minigame-hud footer,#minigame-hud .game-result{position:absolute;box-sizing:border-box;background:#13191b;border:1px solid #465452;padding:12px 16px;}
   #minigame-hud header{border-top:3px solid var(--game-accent);}
   #minigame-hud .game-kind{margin:0 0 3px;font-size:12px;letter-spacing:1px;color:#b9c9c0;}
   #minigame-hud h1{margin:0;font:24px/1.15 W95,monospace;color:#f2f2e7;overflow-wrap:anywhere;}
   #minigame-hud footer{display:flex;gap:16px;align-items:center;}
   #minigame-hud .game-readout{flex:1;min-width:0;}
   #minigame-hud .game-status{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;}
   #minigame-hud .game-summary{margin:0 0 6px;color:#edda94;overflow-wrap:anywhere;}
   #minigame-hud .game-earned{margin:6px 0 0;color:#a6b5ad;font-size:14px;}
   #minigame-hud button{pointer-events:auto;cursor:pointer;font:16px/1.3 W95,monospace;color:#e6eae0;border:1px solid #64756e;background:#1d2925;padding:9px 14px;min-height:44px;min-width:44px;}
   #minigame-hud button:hover,#minigame-hud button:focus-visible{background:#30483e;outline:2px solid #b9e7d5;outline-offset:2px;}
   #minigame-hud .game-result-space{position:absolute;display:flex;align-items:center;justify-content:center;background:#090d10cc;padding:12px;box-sizing:border-box;}
   #minigame-hud .game-result{position:relative;width:min(460px,100%);max-height:100%;overflow:auto;pointer-events:auto;border-top:3px solid var(--game-accent);padding:24px;}
   #minigame-hud .game-result h2{font:28px/1.1 W95,monospace;margin:0 0 12px;color:#f2f2e7;overflow-wrap:anywhere;}
   #minigame-hud .game-result p{margin:8px 0;overflow-wrap:anywhere;}
   #minigame-hud .game-reward{color:#edda94;font-size:20px;}
   #minigame-hud .game-result-space[data-kind=cook] .game-reward,#minigame-hud .game-result-space[data-kind=workshop] .game-reward{font-size:16px;color:#b3c0b7;}
   #minigame-hud .game-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;}
   #minigame-hud .game-actions button{flex:1;white-space:normal;}
   #touch.minigame .pad button{border-radius:0;}
   @media(orientation:portrait){#touch.minigame .pad{left:12px;right:12px;align-items:stretch;}#touch.minigame .pops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}#touch.minigame .pops button{width:100%;min-width:0;white-space:normal;padding:0 6px;}#touch.minigame .row{justify-content:flex-end;}#touch.minigame .main{height:52px;}}
   @media(max-height:500px){#minigame-hud header{padding:8px 12px;}#minigame-hud .game-kind{display:none;}#minigame-hud h1{font-size:20px;}}
   @media(max-width:520px){#minigame-hud header,#minigame-hud footer{padding:10px 12px;}#minigame-hud .game-result{padding:18px;}#minigame-hud h1{font-size:22px;}}
  `;document.head.appendChild(style);
  const el=document.createElement('div');el.id='minigame-hud';el.hidden=true;
  el.innerHTML='<header><p class="game-kind"></p><h1></h1></header><footer><div class="game-readout"><p class="game-summary" hidden></p><p class="game-status"></p><p class="game-earned"></p></div><button data-game-action="leave">Leave</button></footer><div class="game-result-space" hidden><section class="game-result" role="status"><h2></h2><p class="game-outcome"></p><p class="game-reward"></p><div class="game-actions"><button data-game-action="again"></button><button data-game-action="finish">Finish</button></div></section></div>';
  document.body.appendChild(el);
  el.addEventListener('click',e=>{const b=e.target.closest('[data-game-action]');if(!b||!game)return;gameKey({code:b.dataset.gameAction==='again'?'Space':'KeyE',preventDefault(){}});if(game)minigamePresentation(game.g);else hideMinigamePresentation();});
  el.addEventListener('keydown',e=>{if(e.target.closest('button')&&(e.code==='Enter'||e.code==='Space')){e.preventDefault();e.stopPropagation();e.target.click();}});
  MINIGAME_UI={el,header:el.querySelector('header'),footer:el.querySelector('footer'),result:el.querySelector('.game-result-space'),key:null,layout:null};
  document.fonts.ready.then(()=>{if(MINIGAME_UI)MINIGAME_UI.key=null;});
 }
 const ui=MINIGAME_UI;if(TOUCH){const touchState=[g.over,['casino','table'].includes(game.kind)?g.state?.():'',game.kind==='market'?g.lot():''].join('/');if(ui.touchGame!==game||ui.touchState!==touchState){showTouch();ui.touchGame=game;ui.touchState=touchState;}}
 const [right,touchBottom]=gameClear(),controllerHintEl=document.getElementById('controller-hint'),bottom=Math.max(touchBottom,CONTROLLER.active?(controllerHintEl?.offsetHeight||32)+16:0),available=innerWidth-right,width=Math.min(1120,available-24),left=(available-width)/2;
 const result=g.over&&!['crime','show'].includes(game.kind),status=minigameInterfaceText(g.status(),g),summary=g.readout?.()||'';
 const pending=game.kind==='arcade'&&!game.paid&&!g.prize?g.reward():0,earning=game.kind==='shift'&&!game.paid?g.reward():0;
 const earned=game.kind==='arcade'?`TICKETS ${tickets+pending}${pending?` (+${pending} this game)`:''}  ·  ${fmt$(money)}`:game.kind==='shift'?`${fmt$(money+earning)}  ·  ${fmt$(earning)} earned this shift`:game.kind==='crime'?'':game.kind==='casino'?`BALANCE ${fmt$(money)} · BET ${fmt$(g.bet)}`:fmt$(money);
 const lines=result?gameResultLines(g).slice(0,3):[],key=JSON.stringify([innerWidth,innerHeight,right,bottom,width,g.title,game.kind,status,summary,earned,result,lines,TOUCH,CONTROLLER.active]);
 if(ui.key!==key||ui.game!==game){
  ui.el.hidden=false;ui.key=key;ui.game=game;ui.el.style.setProperty('--game-accent',PAL[C(gameFrameColor(g),12)]);
  const setText=(sel,text)=>{const el=ui.el.querySelector(sel);if(el.textContent!==text)el.textContent=text;};
  setText('.game-kind',({arcade:'ARCADE',shift:'WORK SHIFT',table:'MAHJONG',casino:'CASINO',crime:'CRIME',cook:'COOKING',workshop:'WORKSHOP',bout:'BOXING',market:'MARKET',show:'SHOW'}[game.kind]||'ASCII CITY'));
  setText('h1',g.title);setText('.game-summary',summary);ui.el.querySelector('.game-summary').hidden=!summary;setText('.game-status',status);setText('.game-earned',earned);
  ui.footer.hidden=result;ui.result.hidden=!result;ui.result.dataset.kind=game.kind;ui.el.querySelector('footer button').hidden=TOUCH;setText('footer button',({cook:'Stop cooking',workshop:'Stop machine',shift:'Clock off',crime:'Back off',bout:'Towel'}[game.kind]||'Leave')+(CONTROLLER.active?' · B':' · E / Esc'));ui.el.querySelector('.game-actions').hidden=TOUCH;
  for(const el of [ui.header,ui.footer,ui.result]){el.style.left=left+'px';el.style.width=width+'px';}
  ui.footer.style.top='';ui.header.style.top='calc(12px + env(safe-area-inset-top))';ui.footer.style.bottom=(bottom+12)+'px';
  if(result){setText('.game-result h2',lines[0]||'Finished');setText('.game-outcome',lines[1]||'');setText('.game-reward',lines[2]||'');const again=ui.el.querySelector('[data-game-action=again]');again.hidden=!['arcade','table'].includes(game.kind);again.textContent=game.kind==='table'?`Another hand · ${fmt$(MJ_BUYIN)}`:`Play again · ${fmt$(CREDIT)}`;setText('[data-game-action=finish]',game.kind==='arcade'||game.kind==='table'?'Leave':'Finish');}
  const top=ui.header.getBoundingClientRect().bottom+10,foot=result?0:ui.footer.getBoundingClientRect().height+20;
  ui.result.style.top=top+'px';ui.result.style.bottom=(bottom+12)+'px';
  ui.layout={top,foot,bottom,right,width,left};
 }
 return ui.layout;
}

function gameResultLines(g){
 const r=g.reward(),res=g.result;return game.kind === 'table'
      ? [res && res.winner === 0 ? 'MAHJONG!' : 'HAND OVER', !res ? 'You left the table.' : res.winner === 0 ? `You win ${res.how}` : res.winner < 0 ? 'The wall ran out' : `${MJ_NAMES[res.winner]} wins ${res.how}`,
         r > MJ_BUYIN ? `+${fmt$(r)}` : r ? 'Stakes returned' : `-${fmt$(MJ_BUYIN)}`, ...TOUCH ? [] : ['', `SPACE another hand (${fmt$(MJ_BUYIN)})   E leave`]]
      : game.kind === 'bout'
      ? [res.win ? 'YOU WIN' : 'YOU LOSE', `${{ KO: 'KNOCKOUT', TKO: 'STOPPAGE', decision: 'ON POINTS', towel: 'THE TOWEL' }[res.how] || ''}  vs  ${g.name.toUpperCase()}`,
         res.win ? `PURSE ${fmt$(g.purse)}` : 'NO PURSE', ...TOUCH ? [] : ['', 'E or SPACE to leave']]
      : game.kind === 'cook'
      ? [{ perfect: 'PERFECT', fine: 'NOT BAD', burnt: 'BURNT' }[res] || 'DONE', g.title.toLowerCase(), res === 'perfect' ? 'Fills you right up. Well fed: hungry slower a while' : res === 'burnt' ? 'Less in it than there should be' : 'A decent meal', ...TOUCH ? [] : ['', 'E / ESC to finish']]
      : game.kind === 'workshop'
      ? ['BATCH SEALED', `${DRUG_QUALITY[res]} Neon`, 'A buyer waits outside with cash', ...TOUCH ? [] : ['', 'E or SPACE to finish']]
      : game.kind === 'arcade'
      ? ['GAME OVER', `${g.status().split('   ')[0]}`, `+${r} TICKETS`, ...TOUCH ? [] : ['', `SPACE play again (${fmt$(CREDIT)})   E leave`]]
      : ['SHIFT OVER', g.status().split('   ').slice(0, 2).join('   '), `PAID ${fmt$(r)}`, ...TOUCH ? [] : ['', 'E or SPACE to finish']];
}

// In portrait the status belongs beside the playfield, leaving the lower gap for thumbs.
function placeMinigameFooter(top){if(!TOUCH||innerWidth>innerHeight||game.g.over)return;const footer=MINIGAME_UI.footer,value=top+'px';if(footer.style.top!==value){footer.style.top=value;footer.style.bottom='auto';}}
