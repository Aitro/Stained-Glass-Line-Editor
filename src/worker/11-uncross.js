// Keep narrow gaps: lines that cross where the drawing has them meet.
// ------------------------------------------------------------------------------------------------
// Where two traced lines cross close to the end of one of them (not at a joint), the drawing almost always has one
// line ending on the other there, as where two lines run into a border through a wedge of ink. The line whose last
// stretch past the crossing wanders off the lines as drawn (checked against the Change width only trace) is the one
// that overshoots: it is cut at the crossing, so it ends on the other line.
function uncross(strokes,drawn,med){
  const mask=new Uint8Array(W*H);
  for(const Q of drawn)for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);if(y>=0&&x>=0&&y<H&&x<W)mask[y*W+x]=1;}}
  const dd=edt(mask);const dev=(y,x)=>{y=Math.round(y);x=Math.round(x);return(y>=0&&x>=0&&y<H&&x<W)?Math.sqrt(dd[y*W+x]):0;};
  const len=(Q,i0,i1)=>{let L=0;for(let k=i0+1;k<=i1;k++)L+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);return L;};
  // (how far a stretch strays from the lines as drawn, on average)
  const stray=(Q,i0,i1)=>{let s=0,n=0;for(let k=i0;k<=i1;k++){s+=dev(Q[k][0],Q[k][1]);n++;}return n?s/n:0;};
  const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<3;
  // (crossings found through a grid of the lines' segments, so long lines don't make it slow)
  const crossings=()=>{const cell=16,G=new Map(),out=[],seen=new Set();
    strokes.forEach((Q,si)=>{for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k];
      for(let cy=Math.floor(Math.min(a[0],b[0])/cell);cy<=Math.floor(Math.max(a[0],b[0])/cell);cy++)for(let cx=Math.floor(Math.min(a[1],b[1])/cell);cx<=Math.floor(Math.max(a[1],b[1])/cell);cx++){
        const key=cy*100000+cx;let L=G.get(key);if(!L)G.set(key,L=[]);L.push(si,k);}}});
    G.forEach(L=>{for(let x=0;x<L.length;x+=2)for(let y=x+2;y<L.length;y+=2){let i=L[x],k=L[x+1],j=L[y],l=L[y+1];if(i===j)continue;if(i>j){[i,j]=[j,i];[k,l]=[l,k];}
      const id=i+','+k+','+j+','+l;if(seen.has(id))continue;seen.add(id);const A=strokes[i],C=strokes[j],p=A[k-1],r=[A[k][0]-p[0],A[k][1]-p[1]],q=C[l-1],s2=[C[l][0]-q[0],C[l][1]-q[1]],den=r[0]*s2[1]-r[1]*s2[0];
      if(Math.abs(den)<1e-9)continue;const t=((q[0]-p[0])*s2[1]-(q[1]-p[1])*s2[0])/den,v=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/den;if(t<=0||t>=1||v<=0||v>=1)continue;
      out.push({i,k,j,l,X:[p[0]+t*r[0],p[1]+t*r[1]]});}});
    return out;};
  for(let pass=0;pass<8;pass++){let cut=false;
    for(const{i,k,j,l,X}of crossings()){const A=strokes[i],C=strokes[j];
      if([A[0],A[A.length-1],C[0],C[C.length-1]].some(e=>near(e,X)))continue;
      // (each line's tail past the crossing, toward its nearer end)
      const tail=(Q,m)=>{const toStart=len(Q,0,m-1)+Math.hypot(X[0]-Q[m-1][0],X[1]-Q[m-1][1]),toEnd=len(Q,m,Q.length-1)+Math.hypot(X[0]-Q[m][0],X[1]-Q[m][1]);
        return toStart<toEnd?{start:true,L:toStart,dev:stray(Q,0,m-1)}:{start:false,L:toEnd,dev:stray(Q,m,Q.length-1)};};
      const cand=[[i,k,tail(A,k)],[j,l,tail(C,l)]].filter(([,,T])=>T.L<=6*med&&T.dev>0.15*med);if(!cand.length)continue;
      cand.sort((x,y)=>y[2].dev-x[2].dev);const[si,m,T]=cand[0];const Q=strokes[si];
      if(T.start)strokes[si]=[X].concat(Q.slice(m));else strokes[si]=Q.slice(0,m).concat([X]);
      cut=true;break;}
    if(!cut)break;}
  return strokes;}
