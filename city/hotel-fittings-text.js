// Hotel fittings use local +X lettering on a +Y face, or the reversed X on
// a -Y face (facing=-1). Rebuild
// the wall sampler's ray context for that face instead of using the last room
// wall's context, including the exact adjacent-column spacing at oblique views.
function hotelFittingText(i,u,z,t,text,u0,z0,width,height,color,background,facing=1) {
  const q=(2*(i%cols+.5)/cols-1)*tf,rx=dx-dy*q,ry=dy+dx*q;
  const dn=WH.dn,sl=WH.sl,wc=WH.wc;
  WH.dn=Math.max(1e-6,Math.abs(ry*t));WH.sl=facing*rx/(Math.abs(ry)||1e-6);WH.wc=u;
  try{return wallText(i,u,t/(projX*Math.max(1e-6,Math.abs(ry+dx/projX))),z,t,text,u0,z0,width,height,color,background);}
  finally{WH.dn=dn;WH.sl=sl;WH.wc=wc;}
}
