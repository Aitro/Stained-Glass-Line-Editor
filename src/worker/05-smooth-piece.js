// Smoothing one traced stretch of line while holding it close to the original.
// ------------------------------------------------------------------------------------------------
function smoothPiece(Q,w,u,strength,closed,own){
  let Qx,wx,m=0;
  if(closed){m=Math.min(Q.length-1,Math.floor(40*u));
    Qx=[...Q.slice(Q.length-m-1,Q.length-1),...Q,...Q.slice(1,m+1)];wx=[...w.slice(w.length-m-1,w.length-1),...w,...w.slice(1,m+1)];}
  else{Qx=Q;wx=w.slice();}
  // (a very short open piece, like the top of a small rounded shape, is smoothed over a third of its
  // own length at most, so its curve is not flattened into a straight chord)
  let sl=28*u*strength/(2*Math.PI),tol=0.35*u;if(!closed&&own&&Q.length<7*u){sl=Math.min(sl,Q.length/3.5);tol=Math.min(tol,Math.max(1,Q.length/28));}
  const lam=Math.pow(sl,4);
  const real=wx.map(v=>v>0.5&&v<1e5);let wc=wx.slice();let Z=Qx;
  const fs=Math.max(3,Math.floor(4*u))|1;
  for(let it=0;it<10;it++){Z=whittaker(Qx,wc,lam);
    const over=new Float64Array(Qx.length);let mx=0;
    for(let i=0;i<Qx.length;i++){if(!real[i])continue;const d=Math.hypot(Z[i][0]-Qx[i][0],Z[i][1]-Qx[i][1])/tol;over[i]=d;if(d>mx)mx=d;}
    if(mx<=1)break;
    const g=gaussFilter(maxFilter(over,fs),2*u);
    wc=wc.map((v,i)=>real[i]?v*(1+2*Math.pow(Math.max(0,g[i]-0.7),2)):v);}
  return closed?Z.slice(m,m+Q.length):Z;}

