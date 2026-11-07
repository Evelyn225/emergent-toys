// Static menu pictures reuse the game's item samples. They never run held
// animations or add controls; the adjacent item name remains the readable label.
const ITEM_MENU_PICTURES=new Map(),ITEM_MENU_PICTURE_LIMIT=192;
function itemMenuPicture(it){
 const def=ITEMS[it.id];if(!def||['car','home','look','tattoo'].includes(def.kind))return null;
 const key=JSON.stringify([it,Math.floor(tod*60)]);let picture=ITEM_MENU_PICTURES.get(key);if(picture)return picture;
 const [art,col]=(DENSE[it.id]||droppedArt)(it,usesLeft(it)),cells=[];
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(let r=0;r<art.length;r++)for(let c=0;c<art[r].length;c++){const ch=art[r][c];if(ch===' ')continue;const ink=col(ch,r,c);if(!ink)continue;cells.push([c,r,ch,ink]);x0=Math.min(x0,c);y0=Math.min(y0,r);x1=Math.max(x1,c);y1=Math.max(y1,r);}
 if(!cells.length)return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),aspect=DENSE[it.id]?D_ASPECT:.5,scale=Math.min(120/((x1-x0+1)*aspect),120/(y1-y0+1)),w=scale*aspect;
 const left=(128-(x1-x0+1)*w)/2,top=(128-(y1-y0+1)*scale)/2;
 ctx.font=scale+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const[c,r,ch,ink]of cells){const x=left+(c-x0)*w,y=top+(r-y0)*scale;ctx.fillStyle=PAL[ink];if(ch==='\u0001')ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(x+w)-Math.round(x)),Math.max(1,Math.round(y+scale)-Math.round(y)));else ctx.fillText(ch,x+w/2,y+scale/2,w);}
 picture={src:canvas.toDataURL(),width:x1-x0+1,height:y1-y0+1};
 if(ITEM_MENU_PICTURES.size>=ITEM_MENU_PICTURE_LIMIT)ITEM_MENU_PICTURES.delete(ITEM_MENU_PICTURES.keys().next().value);
 ITEM_MENU_PICTURES.set(key,picture);return picture;
}
function populateItemMenuPreviews(el){
 for(const cell of el.querySelectorAll('[data-preview-id],[data-preview-slot]')){
  const id=cell.dataset.previewId,it=id?{id,uses:ITEMS[id].uses||0}:inv[+cell.dataset.previewSlot],picture=it&&itemMenuPicture(it);
  if(!picture){cell.remove();continue;}
  const img=document.createElement('img');img.src=picture.src;img.alt='';img.width=img.height=48;img.draggable=false;cell.className='item-picture';cell.setAttribute('aria-hidden','true');cell.replaceChildren(img);
 }
}
{
 const style=document.createElement('style');style.textContent='#inventory .panel{width:min(620px,calc(100vw - 32px))}#shop .panel{width:min(520px,calc(100vw - 32px))}.menu .item:has(.item-picture){align-items:center;gap:8px}.menu .item-picture{display:inline-flex;align-items:center;justify-content:center;flex:0 0 48px;width:48px;height:48px;margin:2px 2px 2px 0;pointer-events:none}.menu .item-picture img{display:block;width:48px;height:48px;object-fit:contain;image-rendering:pixelated}.menu .item:has(.item-picture)>span:not(.k):not(.lead):not(.v):not(.item-picture){min-width:0;overflow-wrap:anywhere;text-align:left}';document.head.appendChild(style);
}
