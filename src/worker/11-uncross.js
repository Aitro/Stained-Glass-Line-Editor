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
  // (how much of a stretch of one line lies within about a line width of some other line)
  const beside=(si,i0,i1)=>{const r=0.8*med,cell=Math.max(4,Math.ceil(r)),G=new Map();
    strokes.forEach((Q,s)=>{if(s===si)return;for(let k=0;k<Q.length;k++){const a=k?Q[k-1]:Q[k],q=Q[k],n=Math.max(1,Math.ceil(Math.hypot(q[0]-a[0],q[1]-a[1])/2));
      for(let t=1;t<=n;t++){const y=a[0]+(q[0]-a[0])*t/n,x=a[1]+(q[1]-a[1])*t/n,kk=((y/cell)|0)*100000+((x/cell)|0);let L=G.get(kk);if(!L)G.set(kk,L=[]);L.push(y,x);}}});
    const Q=strokes[si];let n=0,c=0;for(let k=i0;k<=i1;k++){const q=Q[k];n++;const cy=(q[0]/cell)|0,cx=(q[1]/cell)|0;let hit=false;
      for(let dy=-1;dy<=1&&!hit;dy++)for(let dx=-1;dx<=1&&!hit;dx++){const L=G.get((cy+dy)*100000+cx+dx);if(L)for(let t=0;t<L.length;t+=2)if(Math.hypot(L[t]-q[0],L[t+1]-q[1])<=r){hit=true;break;}}
      if(hit)c++;}return n?c/n:0;};
  for(let pass=0;pass<8;pass++){let cut=false;
    for(const{i,k,j,l,X}of crossings()){const A=strokes[i],C=strokes[j];
      if([A[0],A[A.length-1],C[0],C[C.length-1]].some(e=>near(e,X)))continue;
      // (each line's tail past the crossing, toward its nearer end)
      const tail=(Q,m)=>{const toStart=len(Q,0,m-1)+Math.hypot(X[0]-Q[m-1][0],X[1]-Q[m-1][1]),toEnd=len(Q,m,Q.length-1)+Math.hypot(X[0]-Q[m][0],X[1]-Q[m][1]);
        return toStart<toEnd?{start:true,L:toStart,dev:stray(Q,0,m-1)}:{start:false,L:toEnd,dev:stray(Q,m,Q.length-1)};};
      // (and only a tail that runs alongside other lines, doubling them: a tail that is the only line along its way
      // is a real edge of a piece, such as the bottom of a small window, and is never cut away)
      const cand=[[i,k,tail(A,k)],[j,l,tail(C,l)]].filter(([si,m,T])=>T.L<=6*med&&T.dev>0.15*med&&(T.start?beside(si,0,m-1):beside(si,m,strokes[si].length-1))>=0.7);if(!cand.length)continue;
      cand.sort((x,y)=>y[2].dev-x[2].dev);const[si,m,T]=cand[0];const Q=strokes[si];
      if(T.start)strokes[si]=[X].concat(Q.slice(m));else strokes[si]=Q.slice(0,m).concat([X]);
      cut=true;break;}
    if(!cut)break;}
  return strokes;}

// Keep narrow gaps: a line that stops just short of another line (the drawing leaves a sliver of paper between them)
// is carried on along its own direction until it meets that line, so every piece is closed.
function reachLines(strokes,med){
  const ends=[];strokes.forEach((Q,s)=>{if(Q.length<3)return;const a=Q[0],b=Q[Q.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])<3)return;ends.push([s,0],[s,1]);});
  const touches=(p,s)=>strokes.some((F,t)=>{if(F.length<2)return false;for(let k=0;k<F.length;k++){if(t===s&&(k<4||k>F.length-5))continue;if(Math.hypot(F[k][0]-p[0],F[k][1]-p[1])<3)return true;}return false;});
  for(const[s,e]of ends){const Q=strokes[s],p=e?Q[Q.length-1]:Q[0],q=e?Q[Math.max(0,Q.length-6)]:Q[Math.min(Q.length-1,5)];
    if(touches(p,s))continue;const n=Math.hypot(p[0]-q[0],p[1]-q[1])||1,dir=[(p[0]-q[0])/n,(p[1]-q[1])/n];
    // (the nearest line straight ahead, within about two line widths)
    let best=null;strokes.forEach((F,t)=>{for(let k=1;k<F.length;k++){if(t===s&&Math.min(k,F.length-k)<8)continue;const a=F[k-1],b=F[k],sg=[b[0]-a[0],b[1]-a[1]],den=dir[0]*sg[1]-dir[1]*sg[0];if(Math.abs(den)<1e-9)continue;
      const tt=((a[0]-p[0])*sg[1]-(a[1]-p[1])*sg[0])/den,v=((a[0]-p[0])*dir[1]-(a[1]-p[1])*dir[0])/den;if(tt>0&&tt<=2*med&&v>=0&&v<=1&&(!best||tt<best))best=tt;}});
    if(best==null)continue;const hit=[p[0]+dir[0]*best,p[1]+dir[1]*best],add=[];const m=Math.max(1,Math.ceil(best));for(let i=1;i<=m;i++)add.push([p[0]+dir[0]*best*i/m,p[1]+dir[1]*best*i/m]);void hit;
    strokes[s]=e?Q.concat(add):add.reverse().concat(Q);}
  return strokes;}
