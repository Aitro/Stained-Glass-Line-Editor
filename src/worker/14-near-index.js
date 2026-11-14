// Nearest point on the lines, fast.
// ------------------------------------------------------------------------------------------------
// The finishing steps keep asking "which other line is nearest this point, and where on it". Scanning every line for
// each question was most of their time on a big pattern; the line pieces are filed by where they lie, so only the
// nearby ones are looked at. The answer is the same: the nearest point, ties going to the earlier line and piece.
// A line that is changed is filed again with update(s).
function nearIndex(strokes,cell){
  cell=Math.max(4,Math.round(cell||16));const GW=Math.ceil(W/cell)+1,GH=Math.ceil(H/cell)+1,grid=new Map(),where=[];
  const put=s=>{const S=strokes[s],keys=[];if(S&&S.length>=2)for(let k=1;k<S.length;k++){const a=S[k-1],b=S[k];
      const cx0=Math.max(0,Math.floor(Math.min(a[1],b[1])/cell)),cx1=Math.min(GW-1,Math.floor(Math.max(a[1],b[1])/cell)),cy0=Math.max(0,Math.floor(Math.min(a[0],b[0])/cell)),cy1=Math.min(GH-1,Math.floor(Math.max(a[0],b[0])/cell));
      for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){const key=cy*GW+cx;let L=grid.get(key);if(!L){L=[];grid.set(key,L);}L.push(s,k);keys.push(key);}}
    where[s]=keys;};
  const drop=s=>{const keys=where[s];if(!keys)return;for(const key of new Set(keys)){const L=grid.get(key);if(!L)continue;const M=[];for(let i=0;i<L.length;i+=2)if(L[i]!==s)M.push(L[i],L[i+1]);if(M.length)grid.set(key,M);else grid.delete(key);}where[s]=null;};
  for(let s=0;s<strokes.length;s++)put(s);
  // (skip: a test or a set of line numbers to leave out; lim: farthest distance asked about)
  const near=(p,skip,lim)=>{const bad=typeof skip==='function'?skip:skip?(s=>skip.has?skip.has(s):skip.includes(s)):()=>false;
    lim=lim==null?Infinity:lim;let bd=lim*lim,best=null;const pcx=Math.floor(p[1]/cell),pcy=Math.floor(p[0]/cell),maxR=Math.max(GW,GH);
    for(let r=0;r<=maxR;r++){
      // (cells in ring r are at least (r-1)*cell away; once that passes the best, stop)
      const ring=(r-1)*cell;if(ring>0&&ring*ring>bd)break;if(lim!==Infinity&&ring>lim)break;
      for(let cy=pcy-r;cy<=pcy+r;cy++){if(cy<0||cy>=GH)continue;const edge=(cy===pcy-r||cy===pcy+r);
        for(let cx=pcx-r;cx<=pcx+r;cx+=(edge?1:2*r||1)){if(cx<0||cx>=GW)continue;const L=grid.get(cy*GW+cx);if(!L)continue;
          for(let i=0;i<L.length;i+=2){const s=L[i],k=L[i+1];if(bad(s))continue;const S=strokes[s],a=S[k-1],b=S[k],vy=b[0]-a[0],vx=b[1]-a[1],L2=vy*vy+vx*vx;
            let t=L2>0?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/L2:0;t=Math.max(0,Math.min(1,t));const y=a[0]+vy*t,x=a[1]+vx*t,d=(y-p[0])**2+(x-p[1])**2;
            if(d<bd||(best&&d===bd&&(s<best.s||(s===best.s&&k<best.k)))){bd=d;best={p:[y,x],s,k,t:[vy,vx]};}}}}}
    if(best)best.d=Math.sqrt(bd);return best;};
  return{near,update:s=>{drop(s);put(s);}};}
