// The inventory and the held pair use the same lit, solid leather and steel
// treatment as the city's other tools, with recessed cuffs and crossed laces.
let iceSkatePicture = null;
DENSE.iceskates=()=>iceSkatePicture||(iceSkatePicture=sculptSurface(44,28,(x,y)=>{
  for(const side of [-1,1]) {
    const u=x-side*6.3,v=y+(side>0?-1:1),edge=Math.max(0,1-Math.abs(u+1)/5);
    if(v>8.6&&v<9.5&&u>-5.2&&u<5.9)return [' ',C(v<9?WHITE:GRAY,v<9?15:10)];
    if(v>6.4&&v<=8.6&&(Math.abs(u+3)<.5||Math.abs(u-2.9)<.5))return [' ',C(GRAY,12)];
    if(v>5.6&&v<=6.8&&u>-4.8&&u<5.1)return [' ',C(BRICK,5+edge*4)];
    const ankle=u> -4.5&&u<.4&&v> -9&&v<4.8;
    const foot=u> -4.5&&u<3.2&&v>.9&&v<5.7;
    const toe=Math.hypot((u-3)/2.2,(v-3.4)/2.3)<1;
    if(!ankle&&!foot&&!toe)continue;
    if(v< -7.6)return [' ',C(u> -3.7&&u< -.4?GRAY:WHITE,u> -3.7&&u< -.4?3:14)];
    const lace=v<1.8&&u> -1.3&&u<.5&&Math.abs(Math.sin(v*2.2)-u*.5)<.4;
    const seam=Math.abs(u+4.1)<.24||v>5.1;
    return [' ',C(lace||seam?GRAY:WHITE,lace?7:seam?10:9+edge*5-Math.max(0,v-3)*.6)];
  }
  return null;
}));
