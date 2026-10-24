// Thin closed iron bowls, their supporting rings and the food share heights.
// The small flames light themselves; the range and wall retain ordinary light.
const WOK={top:.84,base:.91,fill:.98,centers:[-.37,.37],y:-.01};
const WOK_PROFILE=[[0,0],[0,.08],[.015,.125],[.05,.185],[.095,.225],[.13,.24],
  [.135,.24],[.135,.235],[.095,.220],[.05,.180],[.015,.118],[.006,.078],[.006,0]];
const WOK_SUPPORT=[[0,0],[0,.11],[.015,.11],[.015,.09],[.065,.095],[.07,.095],
  [.07,.06],[.015,.055],[.015,0]];
const WOK_LIQUID=[kitchenProfileInnerRadius(WOK_PROFILE,WOK.fill-WOK.base),kitchenProfileInnerRadius(WOK_PROFILE,WOK.fill+.001-WOK.base)];
function kitchenWok(x,y) {
  coveLathe(x,y,WOK.top,WOK_SUPPORT,kitchenIron);
  for(let k=0;k<6;k++){
    const a=k*Math.PI/3,r=.10;
    coveLathe(x+Math.cos(a)*r,y+Math.sin(a)*r,.855,[[0,0],[0,.008],[.046,.002],[.046,0]],(i,t,L)=>{
      BG[i]=C(BLUE,7+Math.sin(T*9+k)*.5);set(i,' ',0);return true;
    });
  }
  coveLathe(x,y,WOK.base,WOK_PROFILE,kitchenIron);
  coveTube(x,y+.223,1.019,x,y+.325,1.05,.008,GRAY);
  coveRound(x,y+.40,0,1,.09,.017,1.035,1.065,.014,'wood',17);
  coveLathe(x,y,WOK.fill,[[0,0],[0,WOK_LIQUID[0]],[.001,WOK_LIQUID[1]],[.001,0]],kitchenFoodShade(BRICK));
  // Joined short curves lie on the food surface, rather than floating over it.
  for(let n=0;n<5;n++)for(let k=0;k<3;k++){
    const at=q=>[-.11+q*.22,(n-2)*.03+Math.sin(q*Math.PI+n*.4)*.015];
    const a=at(k/3),b=at((k+1)/3);
    coveTube(x+a[0],y+a[1],WOK.fill+.004,x+b[0],y+b[1],WOK.fill+.004,.003,YEL);
  }
  for(let k=0;k<6;k++){
    const a=k*Math.PI/3,r=.12;
    foodOval(x+Math.cos(a)*r,y+Math.sin(a)*r,WOK.fill+.001,.022,.014,.018,kitchenFoodShade(k%2?GREEN:RED));
  }
}
function KITCHEN_WOK_RANGE(x=7.2,y=1.4) {
  const cabinet=KITCHEN_SERVICE_COUNTER(0,0,.8,.35,WOK.top,GRAY,GRAY);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    cabinet.draw(vx,vy);
    coveRound(vx,vy-.33,1,0,.8,.02,WOK.top,1.08,.008,kitchenSteel);
    for(const u of WOK.centers)kitchenWok(vx+u,vy+WOK.y);
    for(const u of [-.37,.37])foodOval(vx+u,vy+.351,.67,.028,.012,.055,kitchenGlaze(BRICK));
  }),box:boxAt(x,y+.07,1,0,.8,.42,0,1.08),radius:1,kitchenWok:true,
    tick:s=>kitchenSteamerSteam(s,WOK.fill+.025,WOK.centers[mod(Math.floor(T/1.1),2)],WOK.y)};
}
