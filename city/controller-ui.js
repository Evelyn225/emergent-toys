// Menus use their real buttons/inputs: purchases, storage and routing keep the
// same handlers and validation as mouse/touch. No parallel menu state machine.
function controllerVisible(el){return !!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';}
function controllerMenuRoot(){
  return [...document.querySelectorAll('.menu,#bigmap')].filter(controllerVisible)
    .sort((a,b)=>(+getComputedStyle(b).zIndex||0)-(+getComputedStyle(a).zIndex||0)).at(0)||null;
}
function controllerControls(root){
  return [...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
    .filter(el=>!el.disabled&&el.tabIndex!==-1&&el.type!=='hidden'&&controllerVisible(el));
}
function controllerFocus(root,index){
  const items=controllerControls(root);if(!items.length)return null;
  CONTROLLER.focus=mod(index,items.length);const el=items[CONTROLLER.focus];
  document.querySelectorAll('.controller-focus').forEach(e=>{if(e!==el)e.classList.remove('controller-focus');});
  if(document.activeElement!==el){el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest'});}
  el.classList.add('controller-focus');return el;
}
function controllerMoveFocus(root,x,y){
  const items=controllerControls(root),current=items.indexOf(document.activeElement);
  if(current<0)return controllerFocus(root,CONTROLLER.focus);
  const el=items[current];
  if(x&&(el.type==='range'||el.tagName==='SELECT')){
    if(el.tagName==='SELECT'){
      const choices=[...el.options].map((v,i)=>!v.disabled?i:-1).filter(i=>i>=0);
      if(!choices.length)return;
      el.selectedIndex=choices[mod(choices.indexOf(el.selectedIndex)+x,choices.length)];
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }else{
      const step=Number(el.step)||1;el.value=clamp(+el.value+x*step,Number(el.min)||0,Number(el.max)||100);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return;
  }
  const r=el.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
  let best=-1,score=Infinity;
  items.forEach((item,i)=>{if(i===current)return;const b=item.getBoundingClientRect(),dx=b.x+b.width/2-cx,dy=b.y+b.height/2-cy;
    const along=dx*x+dy*y,across=Math.abs(dx*y-dy*x),cost=along+across*3;
    if(along>3&&cost<score){best=i;score=cost;}
  });
  controllerFocus(root,best<0?current+(x||y):best);
}
function controllerCloseSheet(){
  const sheet=CONTROLLER.sheet;if(!sheet||sheet.style.display==='none')return;
  sheet.style.display='none';paused=!!CONTROLLER.returnPaused;
}
function controllerActions(){
  if(controllerMenuRoot())return;
  CONTROLLER.returnPaused=paused;controllerReleaseKeys();skateInputReset();
  const entries=[...touchActions(),...SHEET.filter(([, ,when])=>!when||when()).map(([label,key])=>[label,key]),
    ['Inventory','KeyI'],['Map','KeyM'],['Camera','KeyV']];
  if(mode==='walk'&&nearAircraft()&&!nearAircraft().owned)entries.push(['Buy aircraft','KeyU']);
  // These actions already have dedicated buttons, sticks or triggers.
  const bound=new Set(['Space','KeyC','KeyE','KeyQ','KeyV','KeyI','KeyM']);
  if(game)for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])bound.add(key);
  if(mode==='air')for(const key of ['KeyW','KeyS'])bound.add(key);
  const unique=entries.filter(([label,key],i,a)=>!bound.has(key)&&a.findIndex(v=>v[1]===key)===i);
  const sheet=CONTROLLER.sheet||=menuEl('controller-actions',1700,'<div class="panel"><h1>Actions</h1><p class="sub">A choose · B back</p><div data-actions></div></div>');
  const list=sheet.querySelector('[data-actions]');list.replaceChildren();
  for(const [label,key] of unique){const b=document.createElement('button');b.className='item';b.textContent=label;
    b.onclick=()=>{controllerCloseSheet();controllerTap(key);};list.appendChild(b);}
  paused=true;releaseMouse();sheet.style.display='flex';CONTROLLER.focus=0;
}
function controllerKeyboard(input){
  const kb=CONTROLLER.keyboard||=menuEl('controller-keyboard',1900,'<div class="panel" style="width:min(650px,95vw)"><h1>Type</h1><p data-value style="overflow-wrap:anywhere"></p><p class="sub">A type · X erase · Y shift · B done</p><div data-keys style="display:grid;gap:6px"></div></div>');
  CONTROLLER.textInput=input;CONTROLLER.uppercase=false;
  const grid=kb.querySelector('[data-keys]');grid.replaceChildren();
  const numeric=input.type==='number',rows=numeric?['123','456','789','0.-']:['1234567890','qwertyuiop','asdfghjkl','zxcvbnm'," -_.,!?@'"];
  const columns=numeric?6:20;grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;
  const update=()=>{kb.querySelector('[data-value]').textContent=input.type==='password'?'•'.repeat(input.value.length):input.value||' ';};
  rows.forEach((row,r)=>{
    let column=!numeric&&r===2?2:!numeric&&r===3?3:1;
    for(const char of row){
      const b=document.createElement('button'),span=char===' '?4:2;
      b.textContent=char===' '?'space':char;b.dataset.char=char;
      b.style.cssText=`min-height:44px;min-width:0;padding:4px 0;grid-row:${r+1};grid-column:${column}/span ${span}`;column+=span;
      b.onclick=()=>{if(input.maxLength>=0&&input.value.length>=input.maxLength)return;
        input.value+=CONTROLLER.uppercase?char.toUpperCase():char;input.dispatchEvent(new Event('input',{bubbles:true}));update();};grid.appendChild(b);
    }
  });
  for(const [index,[label,fn]]of [['Erase',()=>controllerErase()],['Clear',()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));update();}],['Done',()=>controllerCloseKeyboard()]].entries()){
    const b=document.createElement('button');b.textContent=label;
    const span=numeric?2:index===2?8:6,column=numeric?index*2+1:index*6+1;
    b.style.cssText=`min-height:44px;min-width:0;padding:4px 0;grid-row:${rows.length+1};grid-column:${column}/span ${span}`;b.onclick=fn;grid.appendChild(b);
  }
  update();kb.style.display='flex';CONTROLLER.focus=numeric?0:10;
  controllerFocus(kb,CONTROLLER.focus);

}
function controllerErase(){
  const input=CONTROLLER.textInput;if(!input)return;
  input.value=[...input.value].slice(0,-1).join('');input.dispatchEvent(new Event('input',{bubbles:true}));
  CONTROLLER.keyboard.querySelector('[data-value]').textContent=input.type==='password'?'•'.repeat(input.value.length):input.value||' ';
}
function controllerCloseKeyboard(){
  if(CONTROLLER.keyboard)CONTROLLER.keyboard.style.display='none';
  CONTROLLER.textInput?.dispatchEvent(new Event('change',{bubbles:true}));CONTROLLER.textInput?.focus();
  CONTROLLER.textInput=null;
}
function controllerMenuBack(root){
  if(root===CONTROLLER.keyboard)return controllerCloseKeyboard();
  if(root===CONTROLLER.sheet)return controllerCloseSheet();
  if(bigMapOpen()){if(BIGMAP.selected){BIGMAP.selected=null;mapDirectoryUI();bigMapDraw();return;}return closeBigMap();}
  if(root===appearanceEl)return closeAppearance();
  if(root===pauseEl)return closePause(false);
  controllerTap('Escape');
}
function controllerMenuStep(root,edge,held,left,right,dt){
  if(CONTROLLER.root!==root){CONTROLLER.root=root;if(root!==CONTROLLER.keyboard)CONTROLLER.focus=0;}
  const items=controllerControls(root);if(!items.includes(document.activeElement))controllerFocus(root,CONTROLLER.focus);
  const x=held(15)?1:held(14)?-1:Math.abs(left[0])>.3?Math.sign(left[0]):0;
  const y=held(13)?1:held(12)?-1:Math.abs(left[1])>.3?Math.sign(left[1]):0;
  const direction=x||y?`${x},${y}`:'';
  if(direction!==CONTROLLER.direction){CONTROLLER.direction=direction;CONTROLLER.repeat=.32;if(direction)controllerMoveFocus(root,x,y);}
  else if(direction&&(CONTROLLER.repeat-=dt)<=0){CONTROLLER.repeat=.11;controllerMoveFocus(root,x,y);}
  if(edge(1)){controllerMenuBack(root);return;}
  if(edge(0)){
    const el=controllerFocus(root,items.indexOf(document.activeElement)>=0?items.indexOf(document.activeElement):CONTROLLER.focus);
    if(el&&(el.tagName==='TEXTAREA'||el.tagName==='INPUT'&&['text','search','password','email','number','url'].includes(el.type)))controllerKeyboard(el);
    else if(root===pauseEl&&el?.dataset.act==='resume')closePause(false);
    else if(el?.type==='range')el.dispatchEvent(new Event('input',{bubbles:true}));
    else el?.click();
  }
  if(root===CONTROLLER.keyboard){
    if(edge(2))controllerErase();
    if(edge(3)){CONTROLLER.uppercase=!CONTROLLER.uppercase;root.querySelectorAll('[data-char]').forEach(b=>b.textContent=b.dataset.char===' '?'space':CONTROLLER.uppercase?b.dataset.char.toUpperCase():b.dataset.char);}
  }else if(bigMapOpen()){
    if(edge(4))bigMapZoom(.8);if(edge(5))bigMapZoom(1.25);if(edge(2))bigMapCentre();
    if(edge(3))controllerKeyboard(bigMapEl.querySelector('input'));
    if(Math.hypot(...right)>.1)bigMapPan(-right[0]*dt*650,-right[1]*dt*650);
  }else if(Math.abs(right[1])>.1)(root.querySelector('.panel')||root).scrollBy(0,right[1]*dt*650);
}
