// Cleanup -> Join pieces drawn apart.
// ------------------------------------------------------------------------------------------------
// Some patterns draw every piece as its own outline, with a narrow white channel between neighbouring pieces (a
// sticker or vinyl design). In glass the neighbours share one lead line. Each narrow channel of the white outside
// the pieces is filled with ink, so the two outlines and the channel between them become one line, traced down its
// middle; the white inside the pieces is never touched, so no piece is lost or changed. How narrow counts as a
// channel is read from the picture: the most common width of the outside white between lines. A shape left on its
// own afterwards (a circle above the rest, say) is joined to the nearest line by a short bar, so the whole design
// holds together as one panel.
function joinPieces(m,dropBits){
  const N=W*H,out=new Uint8Array(N),st=new Int32Array(N);let sp=0;
  // (the white outside every piece: reached from the picture's edge without crossing a line)
  const seed=i=>{if(!m[i]&&!out[i]){out[i]=1;st[sp++]=i;}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)seed(i-1);if(x<W-1)seed(i+1);if(y>0)seed(i-W);if(y<H-1)seed(i+W);}
  // (the channel width: the commonest half-width of that outside white, measured along its middle)
  const din=new Uint8Array(N);for(let i=0;i<N;i++)din[i]=m[i]?1:0;const d=edt(din),hist=new Float64Array(64);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(!out[i])continue;const v=d[i];if(v<1)continue;
    if(v>=d[i-1]&&v>=d[i+1]&&v>=d[i-W]&&v>=d[i+W]){const r=Math.round(Math.sqrt(v));if(r<64)hist[r]++;}}
  let mode=1;for(let r=1;r<40;r++)if(hist[r]>hist[mode])mode=r;
  const R=Math.max(2,Math.min(25,Math.round(1.6*mode))),R2=R*R;
  // (fill the narrow outside white: grow the lines by R, shrink them back by R, and keep what was outside)
  const d1=edt(din);
  const nd=new Uint8Array(N);for(let i=0;i<N;i++)nd[i]=d1[i]<=R2?0:1;   // (1 where the grown lines don't reach)
  const d2=edt(nd);let filled=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(m[i]||!out[i])continue;const edge=Math.min(x+1,y+1,W-x,H-y);
    if(d1[i]<=R2&&d2[i]>R2&&edge*edge>R2){m[i]=1;filled++;}}
  // (the outline round the outside of the design is widened outward by a channel's width, so a line that runs along
  // a gap between two pieces and then on along the outside edge keeps the same place: the middle of the gap is a
  // channel's half-width outside each piece, and so is the middle of the widened outline)
  {const reach=new Uint8Array(N);sp=0;const sd=i=>{if(!m[i]&&!reach[i]){reach[i]=1;st[sp++]=i;}};
    for(let x=0;x<W;x++){sd(x);sd((H-1)*W+x);}for(let y=0;y<H;y++){sd(y*W);sd(y*W+W-1);}
    while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)sd(i-1);if(x<W-1)sd(i+1);if(y>0)sd(i-W);if(y<H-1)sd(i+W);}
    const dd=new Uint8Array(N);for(let i=0;i<N;i++)dd[i]=m[i]?1:0;const d4=edt(dd),gw=(2*mode)*(2*mode);
    for(let i=0;i<N;i++)if(reach[i]&&d4[i]<=gw)m[i]=1;}
  // (where several channels meet, the white between them is wider than a channel and is left as a small pocket, cut off
  // from the outside now; such a pocket was never a piece, so it is filled too: only a small, roundish one, since a
  // longer pocket is a piece of glass drawn open to the outside)
  {const reach=new Uint8Array(N);sp=0;const sd=i=>{if(!m[i]&&!reach[i]){reach[i]=1;st[sp++]=i;}};
    for(let x=0;x<W;x++){sd(x);sd((H-1)*W+x);}for(let y=0;y<H;y++){sd(y*W);sd(y*W+W-1);}
    while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)sd(i-1);if(x<W-1)sd(i+1);if(y>0)sd(i-W);if(y<H-1)sd(i+W);}
    const din2=new Uint8Array(N);for(let i=0;i<N;i++)din2[i]=m[i]?1:0;const d3=edt(din2),seen=new Uint8Array(N),lim=(1.6*R)*(1.6*R),maxArea=Math.PI*(2.5*R)*(2.5*R);
    for(let i=0;i<N;i++){if(m[i]||!out[i]||reach[i]||seen[i])continue;const comp=[i];seen[i]=1;let mx=0;
      for(let h=0;h<comp.length;h++){const j=comp[h],y=(j/W)|0,x=j-y*W;if(d3[j]>mx)mx=d3[j];
        for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&out[k]&&!reach[k]&&!seen[k]){seen[k]=1;comp.push(k);}}
      if(mx<=lim&&comp.length<=maxArea){for(const j of comp)m[j]=1;filled+=comp.length;}}}
  // (and any scrap of white too small to be cut as glass, whether drawn as a piece or left between the lines: a
  // little triangle where a line ends against another, say. Real pieces, even narrow ones, are far bigger)
  {const seen=new Uint8Array(N),maxA=4*R*R;sp=0;
    for(let i=0;i<N;i++){if(m[i]||seen[i])continue;const comp=[i];seen[i]=1;let edge=false;
      for(let h=0;h<comp.length;h++){const j=comp[h],y=(j/W)|0,x=j-y*W;if(x===0||y===0||x===W-1||y===H-1)edge=true;
        for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&!seen[k]){seen[k]=1;comp.push(k);}}
      if(!edge&&comp.length<=maxA){for(const j of comp)m[j]=1;filled+=comp.length;}}}
  // (shapes left on their own: joined to the nearest other line by a bar as wide as a channel)
  const lab=new Int32Array(N).fill(-1),size=[];let nl=0;
  for(let i=0;i<N;i++){if(!m[i]||lab[i]>=0)continue;let n=0;sp=0;st[sp++]=i;lab[i]=nl;
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;n++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=H||X>=W)continue;const k=Y*W+X;if(m[k]&&lab[k]<0){lab[k]=nl;st[sp++]=k;}}}
    size.push(n);nl++;}
  let main=0;for(let c=1;c<nl;c++)if(size[c]>size[main])main=c;
  // (only real shapes: a closed outline round a piece of its own, such as a circle; never a number or a speck)
  const minSize=Math.max(60,40*R);let bars=0;const shape=new Map();
  const isShape=c=>{if(shape.has(c))return shape.get(c);let y0=H,y1=-1,x0=W,x1=-1;
    for(let i=0;i<N;i++)if(lab[i]===c){const y=(i/W)|0,x=i-y*W;if(y<y0)y0=y;if(y>y1)y1=y;if(x<x0)x0=x;if(x>x1)x1=x;}
    let ok=false;if(size[c]>=minSize&&y1-y0>=6*R&&x1-x0>=6*R){
      // (flood the white from the middle of its box, with only this shape as walls: a hole of its own if it never gets out)
      const bw=x1-x0+1,bh=y1-y0+1,seen=new Uint8Array(bw*bh),cy=((y0+y1)/2)|0,cx=((x0+x1)/2)|0;
      if(lab[cy*W+cx]!==c){const q=[(cy-y0)*bw+(cx-x0)];seen[q[0]]=1;let out2=false,n=0;
        for(let h=0;h<q.length&&!out2;h++){const j=q[h],y=(j/bw)|0,x=j-y*bw;n++;
          for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=bh||X>=bw){out2=true;break;}const k=Y*bw+X;if(seen[k]||lab[(Y+y0)*W+X+x0]===c)continue;seen[k]=1;q.push(k);}}
        ok=!out2&&n>=9*R*R;}}
    shape.set(c,ok);return ok;};
  for(let pass=0;pass<nl&&nl>1;pass++){
    // (distance outward from the main shape, with the spot it came from)
    const dist=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1);const q=[];
    for(let i=0;i<N;i++)if(lab[i]===main){dist[i]=0;from[i]=i;q.push(i);}
    let best=-1,bd=Infinity;const lim=12*R;
    for(let h=0;h<q.length;h++){const i=q[h],y=(i/W)|0,x=i-y*W;if(dist[i]>lim)break;
      for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=H||X>=W)continue;const k=Y*W+X;if(dist[k]!==Infinity)continue;
        dist[k]=dist[i]+1;from[k]=from[i];
        if(m[k]&&lab[k]!==main&&size[lab[k]]>=minSize&&isShape(lab[k])){const f=from[k],fy=(f/W)|0,fx=f-fy*W,e=Math.hypot(X-fx,Y-fy);if(e<bd){bd=e;best=k;}}
        if(!m[k])q.push(k);}}
    if(best<0)break;
    const c=lab[best],f=from[best],fy=(f/W)|0,fx=f-fy*W,by=(best/W)|0,bx=best-by*W;
    drawSeg(m,fx,fy,bx,by,R);bars++;
    // (that shape is now part of the main one)
    for(let i=0;i<N;i++)if(lab[i]===c)lab[i]=main;size[main]+=size[c];
    {const x0=Math.max(0,Math.min(fx,bx)-R-1),x1=Math.min(W-1,Math.max(fx,bx)+R+1),y0=Math.max(0,Math.min(fy,by)-R-1),y1=Math.min(H-1,Math.max(fy,by)+R+1);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;if(m[i])lab[i]=main;}}}
  // (numbers and other small marks left on their own inside the pieces: drawn as thin as the old outlines, so the
  // usual text clean-up keeps them; here they stand apart from every line, and are taken out)
  let bits=0;if(dropBits){const box=new Map();for(let i=0;i<N;i++){const c=lab[i];if(c<0||c===main)continue;const y=(i/W)|0,x=i-y*W;let b=box.get(c);if(!b)box.set(c,b=[y,y,x,x]);
      if(y<b[0])b[0]=y;if(y>b[1])b[1]=y;if(x<b[2])b[2]=x;if(x>b[3])b[3]=x;}
    for(const[c,b]of box){if(Math.max(b[1]-b[0],b[3]-b[2])>10*R||isShape(c))continue;for(let y=b[0];y<=b[1];y++)for(let x=b[2];x<=b[3];x++){const i=y*W+x;if(lab[i]===c){m[i]=0;}}bits++;}}
  joinMode=mode;
  return{R,filled,bars,bits,main:size[main]};}

// Join pieces drawn apart, after the lines are traced: a stretch of line with no glass beside it goes.
// ------------------------------------------------------------------------------------------------
// Where a piece ends right against a line (the end of a staff resting on a snake's body), the end of the piece and
// the line it rests on can both be traced, a lead's width apart, with nothing but ink between them: a sliver that is
// not glass. Such a stretch, from one joint to the next, is taken out, and the lines that met it at its ends are
// brought on to the line beside it.
function dropDoubles(strokes,dmap,med){
  const D=1.6*med;
  const inkTo=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);
      if(y<0||x<0||y>=H||x>=W||dmap[y*W+x]<0.5)return false;}return true;};
  const turnAt=(S,p)=>{// (the sharpest bend within a couple of widths of p)
    let m=0;const st=Math.max(2,Math.round(0.3*med));for(let i=st;i<S.length-st;i++){if(Math.hypot(S[i][0]-p[0],S[i][1]-p[1])>2*med)continue;const a=S[i-st],b=S[i],c=S[i+st];
      const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]],n1=Math.hypot(...v1),n2=Math.hypot(...v2);if(n1<1e-6||n2<1e-6)continue;m=Math.max(m,Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(n1*n2)))));}return m;};
  // (where other lines end on each line, and the stretches between)
  const attach=(L,NI)=>{const att=L.map(()=>[]);L.forEach((S,t)=>{if(!S||S.length<2)return;for(const e of[S[0],S[S.length-1]]){const b=NI.near(e,u=>u===t,3);if(b)att[b.s].push({k:b.k,t,p:e});}});return att;};
  // (a stretch of line s between two joints with one other line G beside it all along its middle, only ink between)
  const beside=(L,NI,s,k0,k1)=>{const Q=L[s];let len=0;const cl=[0];for(let k=k0+1;k<=k1;k++){len+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);cl.push(len);}
    if(len<0.5*med||len>8*med)return-1;let G=-1,n=0;
    for(let k=k0;k<=k1;k++){const c=cl[k-k0];if(c<0.8*med||len-c<0.8*med)continue;n++;const b=NI.near(Q[k],u=>u===s,D);if(!b||(G>=0&&b.s!==G)||!inkTo(Q[k],b.p))return-1;G=b.s;}
    return n>=3?G:-1;};
  // (take the stretch out, bring the ends that met it on to G; returns the new lines and the sharpest bend this makes)
  const remove=(L0,s,k0,k1,G,att)=>{const L=L0.map(S=>S&&S.map(p=>p.slice()));const Q=L[s],e0=Q[k0].slice(),e1=Q[k1].slice();
    const A=Q.slice(0,k0+1),B=Q.slice(k1);L[s]=A.length>=2?A:null;if(B.length>=2)L.push(B);
    const onG=p=>{let bd=1e18,bp=null;const F=L[G];for(let k=1;k<F.length;k++){const a=F[k-1],c=F[k],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-p[0])**2+(x-p[1])**2;if(d<bd){bd=d;bp=[y,x];}}return bp;};
    let worst=0;const moved=[];
    const moveEnd=(t,p)=>{const S=L[t];if(!S)return;const atStart=Math.hypot(S[0][0]-p[0],S[0][1]-p[1])<=Math.hypot(S[S.length-1][0]-p[0],S[S.length-1][1]-p[1]);
      const R0=atStart?S:S.slice().reverse(),g=onG(R0[0]);if(!g)return;const dv=[g[0]-R0[0][0],g[1]-R0[0][1]];if(Math.hypot(...dv)<1)return;let l=0;const Lr=1.5*med;
      for(let k=0;k<R0.length;k++){if(k)l+=Math.hypot(R0[k][0]-R0[k-1][0],R0[k][1]-R0[k-1][1]);if(l>Lr)break;const t0=Math.min(1,l/Lr),w=1-t0*t0*(3-2*t0);R0[k]=[R0[k][0]+dv[0]*w,R0[k][1]+dv[1]*w];}
      L[t]=atStart?R0:R0.reverse();moved.push([t,g]);};
    for(const a of att[s])if(a.t!==G&&(Math.hypot(a.p[0]-e0[0],a.p[1]-e0[1])<4||Math.hypot(a.p[0]-e1[0],a.p[1]-e1[1])<4))moveEnd(a.t,a.p);
    if(L[s])moveEnd(s,e0);if(B.length>=2)moveEnd(L.length-1,e1);
    for(const[t,g]of moved)if(L[t])worst=Math.max(worst,turnAt(L[t],g));
    return{L,worst};};
  let L=strokes.slice();
  for(let pass=0;pass<6;pass++){const NI=nearIndex(L.map(S=>S||[]),2*med),att=attach(L,NI);let done=false;
    for(let s=0;s<L.length&&!done;s++){const Q=L[s];if(!Q||Q.length<4)continue;const ks=[...new Set([0,Q.length-1].concat(att[s].map(a=>a.k)))].sort((a,b)=>a-b);   // (its own ends count as joints too: they end on other lines)
      for(let i=0;i+1<ks.length&&!done;i++){const k0=ks[i],k1=ks[i+1];if(k1-k0<2)continue;const G=beside(L,NI,s,k0,k1);if(G<0)continue;
        // (the line beside it may have a stretch of its own beside this one: of the two, the one whose going leaves the
        // smoother lines is taken out)
        let best=remove(L,s,k0,k1,G,att);
        const kg=[...new Set([0,L[G].length-1].concat(att[G].map(a=>a.k)))].sort((a,b)=>a-b);
        for(let j=0;j+1<kg.length;j++){if(kg[j+1]-kg[j]<2)continue;if(beside(L,NI,G,kg[j],kg[j+1])!==s)continue;const alt=remove(L,G,kg[j],kg[j+1],s,att);if(alt.worst<best.worst)best=alt;}
        if(best.worst>0.8)continue;   // (a hook either way: left as it is)
        L=best.L;done=true;}}
    L=L.filter(Boolean);if(!done)break;}
  // (and a line whose end runs in alongside another, a sliver apart with only ink between, as two outlines of one
  // edge do, is cut back to where the two part, and its end brought on to the other)
  for(let pass=0;pass<6;pass++){const NI=nearIndex(L,2*med);let done=false;
    for(let s=0;s<L.length&&!done;s++)for(let side=0;side<2&&!done;side++){let Q=L[s];if(!Q||Q.length<6)continue;if(side)Q=Q.slice().reverse();
      // (lines that end where this one ends are not the one it runs beside)
      const sk=new Set([s]);for(let t=0;t<L.length;t++){const S=L[t];if(t===s||!S||S.length<2)continue;if(Math.hypot(S[0][0]-Q[0][0],S[0][1]-Q[0][1])<4||Math.hypot(S[S.length-1][0]-Q[0][0],S[S.length-1][1]-Q[0][1])<4)sk.add(t);}
      let G=-1,len=0,k=0;
      for(;k<Q.length-1;k++){if(k)len+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);const b=G<0?NI.near(Q[k],u=>sk.has(u),0.75*med):NI.near(Q[k],u=>u!==G,0.75*med);   // (once found, it is that line it must stay beside)
        if(!b||!inkTo(Q[k],b.p))break;G=b.s;}
      if(G<0||len<1.5*med||len>8*med||k>=Q.length-3)continue;
      const keep=Q.slice(k),F=L[G];let bd=1e18,bp=null;for(let j=1;j<F.length;j++){const a=F[j-1],c=F[j],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((keep[0][0]-a[0])*vy+(keep[0][1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-keep[0][0])**2+(x-keep[0][1])**2;if(d<bd){bd=d;bp=[y,x];}}
      const dv=[bp[0]-keep[0][0],bp[1]-keep[0][1]];let l=0;const Lr=1.6*med;
      for(let j=0;j<keep.length;j++){if(j)l+=Math.hypot(keep[j][0]-keep[j-1][0],keep[j][1]-keep[j-1][1]);if(l>Lr)break;const t0=Math.min(1,l/Lr),w=1-t0*t0*(3-2*t0);keep[j]=[keep[j][0]+dv[0]*w,keep[j][1]+dv[1]*w];}
      // (lines that ended on the cut-off part go on to the other line too)
      const cut=Q.slice(0,k+1),cNI=nearIndex([cut],med);
      for(let t=0;t<L.length;t++){if(t===s||t===G||!L[t])continue;const S=L[t];for(const e of[0,1]){const p=e?S[S.length-1]:S[0];if(!cNI.near(p,null,3))continue;
          let bd2=1e18,bq=null;for(let j=1;j<F.length;j++){const a=F[j-1],c=F[j],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-p[0])**2+(x-p[1])**2;if(d<bd2){bd2=d;bq=[y,x];}}
          const R0=e?S.slice().reverse():S.slice(),dw=[bq[0]-R0[0][0],bq[1]-R0[0][1]];let l3=0;
          for(let j=0;j<R0.length;j++){if(j)l3+=Math.hypot(R0[j][0]-R0[j-1][0],R0[j][1]-R0[j-1][1]);if(l3>Lr)break;const t0=Math.min(1,l3/Lr),w=1-t0*t0*(3-2*t0);R0[j]=[R0[j][0]+dw[0]*w,R0[j][1]+dw[1]*w];}
          L[t]=e?R0.reverse():R0;}}
      L[s]=side?keep.reverse():keep;done=true;}
    if(!done)break;}
  return L;}

// Join pieces drawn apart: where a filled gap is wider than a channel, the line keeps to the narrower piece.
// ------------------------------------------------------------------------------------------------
// Where two pieces' outlines draw apart (a lens of white between a staff and the curve of a snake), the filled gap is
// wider than a channel and its middle is neither piece's edge. A narrow piece loses its shape there far sooner than a
// wide one, so along such a stretch the line is moved to sit the usual distance from the narrower piece, and the wider
// piece takes up the difference.
function hugNarrow(strokes,m,dmap,med){
  const N=W*H,lab=new Int32Array(N).fill(-1),st=new Int32Array(N);let nl=0;
  for(let i=0;i<N;i++){if(m[i]||lab[i]>=0)continue;let sp=0;st[sp++]=i;lab[i]=nl;
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&lab[k]<0){lab[k]=nl;st[sp++]=k;}}nl++;}
  // (how wide each piece is: the largest circle that fits in it)
  const ia=new Uint8Array(N);for(let i=0;i<N;i++)ia[i]=m[i]?1:0;const dW=edt(ia),rad=new Float32Array(nl);
  for(let i=0;i<N;i++)if(lab[i]>=0){const v=Math.sqrt(dW[i]);if(v>rad[lab[i]])rad[lab[i]]=v;}
  // (the white around the whole pattern: a line along it is the outline, left alone)
  const outer=new Uint8Array(nl);for(let x=0;x<W;x++){if(lab[x]>=0)outer[lab[x]]=1;if(lab[(H-1)*W+x]>=0)outer[lab[(H-1)*W+x]]=1;}for(let y=0;y<H;y++){if(lab[y*W]>=0)outer[lab[y*W]]=1;if(lab[y*W+W-1]>=0)outer[lab[y*W+W-1]]=1;}
  // (the usual distance from a line to the glass beside it)
  const all=[];for(const Q of strokes)for(const q of Q){const y=Math.round(q[0]),x=Math.round(q[1]);if(y>=0&&x>=0&&y<H&&x<W)all.push(dmap[y*W+x]);}
  all.sort((a,b)=>a-b);const t=all[all.length>>1]||1;
  // (the move for one point: to the usual distance from the narrower of the two pieces either side, or none)
  const moveFor=(q,lo)=>{const py=Math.round(q[0]),px=Math.round(q[1]);if(py<0||px<0||py>=H||px>=W)return null;const d0=dmap[py*W+px];if(d0<lo*t)return null;
    const r=Math.ceil(d0+2*t);let b1=null,c1=-1,bd1=1e18;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const y=py+dy,x=px+dx;if(y<0||x<0||y>=H||x>=W)continue;const c=lab[y*W+x];if(c<0)continue;const d=dx*dx+dy*dy;if(d<bd1){bd1=d;b1=[y,x];c1=c;}}
    if(c1<0)return null;let b2=null,c2=-1,bd2=1e18;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const y=py+dy,x=px+dx;if(y<0||x<0||y>=H||x>=W)continue;const c=lab[y*W+x];if(c<0||c===c1)continue;const d=dx*dx+dy*dy;if(d<bd2){bd2=d;b2=[y,x];c2=c;}}
    if(c2<0||outer[c1]||outer[c2])return null;const[wn,rn,rw]=rad[c1]<=rad[c2]?[b1,rad[c1],rad[c2]]:[b2,rad[c2],rad[c1]];if(rn>0.5*rw)return null;
    const vy=q[0]-wn[0],vx=q[1]-wn[1],n=Math.hypot(vy,vx)||1;return[wn[0]+vy/n*t-q[0],wn[1]+vx/n*t-q[1]];};
  // (every line end, so a stretch with another line joining it is left where it is: moving it would leave that joint)
  const endsAll=[];strokes.forEach((S,t)=>{if(S&&S.length>1){endsAll.push([S[0],t]);endsAll.push([S[S.length-1],t]);}});
  const res=strokes.map((Q,qi)=>{
    const cum=[0];for(let k=1;k<Q.length;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));const Lt=cum[cum.length-1];
    // (stretches where the line sits well out in a wide gap (half again the usual distance), next to a much narrower piece; each followed out each way
    // for as long as the gap is still wider than usual)
    const core=Q.map(q=>moveFor(q,1.5));const dv=Q.map(()=>null);
    let k=0;while(k<Q.length){if(!core[k]){k++;continue;}let j=k;while(j+1<Q.length&&core[j+1])j++;
      let joined=false;for(const[e,t]of endsAll){if(t===qi)continue;for(let i=k;i<=j&&!joined;i++)if(Math.hypot(Q[i][0]-e[0],Q[i][1]-e[1])<1.0*med)joined=true;if(joined)break;}
      if(!joined&&cum[j]-cum[k]>=1.5*med&&cum[k]>=1.5*med&&Lt-cum[j]>=1.5*med){   // (a stretch in the open, not the swelling at a joint)
       let a=k,b=j;while(a>0&&moveFor(Q[a-1],1.1))a--;while(b<Q.length-1&&moveFor(Q[b+1],1.1))b++;const mv=[];let mx=0;for(let i=a;i<=b;i++){mv.push(moveFor(Q[i],1.1)||core[i]||[0,0]);mx=Math.max(mx,Math.hypot(mv[mv.length-1][0],mv[mv.length-1][1]));}
       if(mx>=0.35*med)for(let i=a;i<=b;i++)dv[i]=mv[i-a];}   // (only a clear lean away from the narrow piece; a slight one is left as drawn)
      k=j+1;}
    if(!dv.some(Boolean))return Q;
    // (the moves evened out along each stretch, eased to nothing just past its ends and at the line's own ends)
    const Rw=1.5*med,Re=3*med;
    const sm=Q.map((q,k)=>{if(!dv[k])return null;let sy=0,sx=0,sw=0;for(let j=0;j<Q.length;j++){if(!dv[j])continue;const dd=Math.abs(cum[j]-cum[k]);if(dd>Rw)continue;const w=0.5+0.5*Math.cos(Math.PI*dd/Rw);sw+=w;sy+=dv[j][0]*w;sx+=dv[j][1]*w;}return[sy/sw,sx/sw];});
    const out0=Q.map((q,k)=>{let v=sm[k];if(!v){let bd=1e18,bj=-1;for(let j=0;j<Q.length;j++)if(sm[j]){const dd=Math.abs(cum[j]-cum[k]);if(dd<bd){bd=dd;bj=j;}}
        if(bj<0||bd>Re)return q;const f=1-bd/Re,w=f*f*(3-2*f);v=[sm[bj][0]*w,sm[bj][1]*w];}
      const e=Math.min(1,Math.min(cum[k],Lt-cum[k])/(2*med)),te=e*e*(3-2*e);return[q[0]+v[0]*te,q[1]+v[1]*te];});
    // (then the moved part evened out a little along itself, so the eased stretch has no wobble of its own)
    const ch=out0.map((p,k)=>Math.hypot(p[0]-Q[k][0],p[1]-Q[k][1])>0.3);let cur=out0;
    for(let pass=0;pass<4;pass++){cur=cur.map((p,k)=>{if(!ch[k]||k===0||k===Q.length-1)return p;let sy=0,sx=0,sw=0;for(let j=k;j>=0&&cum[k]-cum[j]<=0.8*med;j--){sy+=cur[j][0];sx+=cur[j][1];sw++;}for(let j=k+1;j<Q.length&&cum[j]-cum[k]<=0.8*med;j++){sy+=cur[j][0];sx+=cur[j][1];sw++;}return[sy/sw,sx/sw];});}
    return cur;});
  // (a line ending on a moved stretch moves its end with it, eased back along itself, so the joint stays joined)
  const moved=[];res.forEach((R,t)=>{if(R!==strokes[t])moved.push(t);});if(!moved.length)return res;
  return res.map((R,t)=>{if(!R||R.length<2)return R;let out=R;
    for(const end of[0,1]){const e=strokes[t][end?strokes[t].length-1:0];let v=null,bd=4;
      for(const u of moved){if(u===t)continue;const Q=strokes[u];for(let i=0;i<Q.length;i++){const d=Math.hypot(Q[i][0]-e[0],Q[i][1]-e[1]);if(d<bd){bd=d;v=[res[u][i][0]-Q[i][0],res[u][i][1]-Q[i][1]];}}}
      if(!v||Math.hypot(v[0],v[1])<0.3)continue;if(out===R)out=R.slice();
      const n=out.length;let c=0;for(let s=0;s<n;s++){const k=end?n-1-s:s;if(s>0){const p=end?k+1:k-1;c+=Math.hypot(strokes[t][k][0]-strokes[t][p][0],strokes[t][k][1]-strokes[t][p][1]);}
        if(c>1.5*med)break;const f=1-c/(1.5*med),w=f*f*(3-2*f);out[k]=[out[k][0]+v[0]*w,out[k][1]+v[1]*w];}}
    return out;});}

// (squared distances inside a box, to the set pixels of src (w×h))
function edtBox(src,w,h){const N=Math.max(w,h),f=new Float64Array(N),d=new Float64Array(N),v=new Int32Array(N),z=new Float64Array(N+1),out=new Float32Array(w*h);
  for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=src[y*w+x]?0:INF;edt1d(f,h,d,v,z);for(let y=0;y<h;y++)out[y*w+x]=d[y];}
  for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++)f[x]=out[o+x];edt1d(f,w,d,v,z);for(let x=0;x<w;x++)out[o+x]=d[x];}
  return out;}

// Where a narrow piece (a staff passing behind a loop) sits in a wide patch of ink left by the joining, the glass
// around it is grown into that ink: each wider piece takes the ink nearer to it, up to one lead width from the narrow
// piece and leaving a lead width between itself and the next piece. The line then lands on the narrow piece's own
// edge, and the narrow piece keeps its shape.
let joinMode=0,staffPieces=null;   // (the narrow pieces staffWins worked round, and the lead's half width there, for keepOffStaff)
function staffWins(m,mode){staffPieces=null;
  const N=W*H,lab=new Int32Array(N).fill(-1),st=new Int32Array(N);let nl=0;const box=[];
  for(let i=0;i<N;i++){if(m[i]||lab[i]>=0)continue;let sp=0;st[sp++]=i;lab[i]=nl;const b=[1e9,-1,1e9,-1,0,0];
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;b[4]++;if(y<b[0])b[0]=y;if(y>b[1])b[1]=y;if(x<b[2])b[2]=x;if(x>b[3])b[3]=x;if(x===0||y===0||x===W-1||y===H-1)b[5]=1;
      for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&lab[k]<0){lab[k]=nl;st[sp++]=k;}}
    box.push(b);nl++;}
  const ia=new Uint8Array(N);for(let i=0;i<N;i++)ia[i]=m[i]?1:0;const dI=edt(ia),rad=new Float32Array(nl);
  for(let i=0;i<N;i++)if(lab[i]>=0){const v=dI[i];if(v>rad[lab[i]])rad[lab[i]]=v;}for(let c=0;c<nl;c++)rad[c]=Math.sqrt(rad[c]);
  const L=2*mode;let grown=0;const log=[];
  for(let P=0;P<nl;P++){const b=box[P];if(b[5]||b[4]<(3*L)*(3*L)||rad[P]>2.2*L||Math.max(b[1]-b[0],b[3]-b[2])>8*L)continue;   // (only a short narrow strip standing on its own inside a loop)
    const pad=Math.ceil(4*L),y0=Math.max(0,b[0]-pad),y1=Math.min(H-1,b[1]+pad),x0=Math.max(0,b[2]-pad),x1=Math.min(W-1,b[3]+pad),w=x1-x0+1,h=y1-y0+1;
    const ids=new Map();for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=lab[y*W+x];if(c>=0&&!ids.has(c))ids.set(c,null);}
    let wide=false;for(const c of ids.keys())if(c!==P&&!box[c][5]&&rad[P]<=0.5*rad[c])wide=true;if(!wide)continue;
    for(const c of ids.keys()){const s=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)s[y*w+x]=lab[(y+y0)*W+x+x0]===c?1:0;ids.set(c,edtBox(s,w,h));}
    const dP=ids.get(P),own=new Int32Array(w*h).fill(-1);let cnt=0;
    for(let k=0;k<w*h;k++){const y=((k/w)|0)+y0,x=k%w+x0;if(!m[y*W+x])continue;const p=Math.sqrt(dP[k]);if(p<L||p>3*L)continue;
      let A=-1,dA=1e18,dB=1e18;for(const[c,d]of ids){if(c===P)continue;const v=d[k];if(v<dA){dB=dA;dA=v;A=c;}else if(v<dB)dB=v;}
      if(A<0||box[A][5]||rad[P]>0.5*rad[A])continue;if(Math.sqrt(dB)-Math.sqrt(dA)<L)continue;own[k]=A;cnt++;}
    if(cnt<10*L*L)continue;   // (a real patch of ink, not the swelling where lines meet)
    // (grown out from each piece's own edge through the ink it takes)
    let sp=0;const seen=new Uint8Array(w*h);
    for(let k=0;k<w*h;k++)if(own[k]>=0&&ids.get(own[k])[k]<=2.1){seen[k]=1;st[sp++]=k;}
    let add=0;while(sp){const k=st[--sp];const y=(k/w)|0,x=k-y*w,A=own[k];m[(y+y0)*W+x+x0]=0;lab[(y+y0)*W+x+x0]=A;add++;
      for(const q of[x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(q>=0&&own[q]===A&&!seen[q]){seen[q]=1;st[sp++]=q;}}
    grown+=add;log.push([P,b[2],b[0],b[3],b[1],add]);
    if(!staffPieces)staffPieces={mask:new Uint8Array(N),half:mode};for(let y=b[0];y<=b[1];y++)for(let x=b[2];x<=b[3];x++)if(lab[y*W+x]===P)staffPieces.mask[y*W+x]=1;}
  return grown;}

// Lines kept off those narrow pieces: a point closer to one than half a lead (where a line cut across a corner on its
// way to a joint) is pushed straight out to that distance, so the line goes round the corner.
function keepOffStaff(strokes,med){
  if(!staffPieces)return strokes;const{mask,half}=staffPieces,d=edt(mask);
  // (distance to those pieces, read between pixels so the push is smooth)
  const D=(y,x)=>{y=Math.max(0,Math.min(H-1.001,y));x=Math.max(0,Math.min(W-1.001,x));const y0=Math.floor(y),x0=Math.floor(x),fy=y-y0,fx=x-x0,i=y0*W+x0,
    a=Math.sqrt(d[i]),b=Math.sqrt(d[i+1]),c=Math.sqrt(d[i+W]),e=Math.sqrt(d[i+W+1]);return(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+e*fx)*fy;};
  const push=R=>R.map(q=>{let y=q[0],x=q[1];for(let it=0;it<8;it++){const v=D(y,x);if(v>=half-0.2)break;
      const gy=D(y+1.5,x)-D(y-1.5,x),gx=D(y,x+1.5)-D(y,x-1.5),n=Math.hypot(gy,gx);if(n<1e-6)break;y+=gy/n*(half-v);x+=gx/n*(half-v);}return[y,x];});
  const out=strokes.map(Q=>{if(!Q.some(q=>D(q[0],q[1])<half-0.2))return Q;
    const cum=[0];for(let k=1;k<Q.length;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    // (the stretch to work on: the pushed points and a little either side)
    const near=Q.map(q=>D(q[0],q[1])<half+0.6*med);let R=push(Q);
    for(let pass=0;pass<4;pass++){const S=R.map((p,k)=>{if(!near[k]||k===0||k===R.length-1)return p;let sy=0,sx=0,sw=0;
        for(let j=k;j>=0&&cum[k]-cum[j]<=0.4*med;j--){sy+=R[j][0];sx+=R[j][1];sw++;}for(let j=k+1;j<R.length&&cum[j]-cum[k]<=0.4*med;j++){sy+=R[j][0];sx+=R[j][1];sw++;}return[sy/sw,sx/sw];});
      R=push(S);}
    return R;});
  // (a pushed line that set off from a joint now first runs back along the line it joined before turning down the
  // piece's side: that part is dropped, and the line starts where it leaves the other line)
  return out.map((R,t)=>{if(R===strokes[t]||R.length<4)return R;let S=R;
    for(const end of[0,1]){const E=strokes[t][end?strokes[t].length-1:0];if(D(E[0],E[1])>half+0.6*med)continue;const part=[];
      strokes.forEach((Q,u)=>{if(u===t)return;for(const q of Q)if(Math.hypot(q[0]-E[0],q[1]-E[1])<2.5){part.push(out[u]);return;}});
      if(!part.length)continue;const nearOf=p=>{let bd=1e18,bq=null;for(const Q of part)for(let i=1;i<Q.length;i++){const a=Q[i-1],b=Q[i],vy=b[0]-a[0],vx=b[1]-a[1],L2=vy*vy+vx*vx||1;
          let f=((p[0]-a[0])*vy+(p[1]-a[1])*vx)/L2;f=Math.max(0,Math.min(1,f));const y=a[0]+vy*f,x=a[1]+vx*f,dd=Math.hypot(p[0]-y,p[1]-x);if(dd<bd){bd=dd;bq=[y,x];}}return[bd,bq];};
      const n=S.length,idx=k=>end?n-1-k:k;let c=0,K=-1;
      for(let k=0;k<n-2;k++){if(k>0)c+=Math.hypot(S[idx(k)][0]-S[idx(k-1)][0],S[idx(k)][1]-S[idx(k-1)][1]);if(c>2*med)break;if(nearOf(S[idx(k)])[0]<=0.25*med)K=k;}
      if(K<1)continue;const q=nearOf(S[idx(K)])[1];
      S=end?S.slice(0,n-1-K).concat([q]):[q].concat(S.slice(K+1));}
    return S;});}
