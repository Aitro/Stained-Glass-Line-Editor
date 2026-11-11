// Filled pictures (logos, silhouettes) turned into lead lines, lines drawn by hand, and break lines for hard pieces.
// ------------------------------------------------------------------------------------------------

// A picture of filled shapes rather than lines: most of its dark is far from paper in every direction.
function looksFilled(m,ppi){const f=Math.max(1,Math.round(ppi/75)),w=Math.ceil(W/f),h=Math.ceil(H/f),s=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)s[y*w+x]=m[Math.min(H-1,y*f)*W+Math.min(W-1,x*f)];
  const hr=new Uint16Array(w*h),vr=new Uint16Array(w*h);
  for(let y=0;y<h;y++){let x=0;while(x<w){if(!s[y*w+x]){x++;continue;}let e=x;while(e<w&&s[y*w+e])e++;for(let k=x;k<e;k++)hr[y*w+k]=e-x;x=e;}}
  for(let x=0;x<w;x++){let y=0;while(y<h){if(!s[y*w+x]){y++;continue;}let e=y;while(e<h&&s[e*w+x])e++;for(let k=y;k<e;k++)vr[k*w+x]=e-y;y=e;}}
  let ink=0,thick=0;const T=0.3*ppi/f;for(let i=0;i<w*h;i++)if(s[i]){ink++;if(Math.min(hr[i],vr[i])>T)thick++;}
  return ink>0&&thick>0.4*ink;}

// The edges between dark and light become lines (one lead width, centred on the edge). A dark or light stroke too
// thin to be a piece of glass becomes a single line down its middle instead of two lines either side of it.
function shapesToLines(m,ppi){const minA=Math.round(0.03*ppi*ppi);removeSmall(m,1,minA,true,false);removeSmall(m,0,minA,false,true);
  const lw=Math.max(3,Math.round(0.05*ppi)),r2=(lw/2)*(lw/2),T=0.09*ppi,T2=T*T;
  // (a round picture: its outline becomes an exact circle. Whatever pokes out past it (a bird, a sign, waves) is
  // trimmed off, and the wobbly edge just inside it is filled in up to the circle, so the panel is perfectly round)
  const circle=outerCircle(m);
  if(circle){const{cx,cy,r}=circle,K=circle.spread;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-cx,y-cy)-r;if(d>0)m[y*W+x]=0;else if(d>-K)m[y*W+x]=1;}}
  const paper=new Uint8Array(W*H);for(let i=0;i<W*H;i++)paper[i]=m[i]?0:1;
  const dP=edt(paper),dI=edt(m);   // (squared distance to the nearest paper, and to the nearest dark)
  const out=new Uint8Array(W*H);for(let i=0;i<W*H;i++)out[i]=m[i]?(dP[i]<=r2?1:0):(dI[i]<=r2?1:0);
  // (thin strokes: whatever an opening of radius T removes)
  for(const[side,dist]of[[1,dP],[0,dI]]){const core=new Uint8Array(W*H);let any=0;for(let i=0;i<W*H;i++)if(m[i]===side&&dist[i]>T2){core[i]=1;any=1;}
    const dc=any?edt(core):null;for(let i=0;i<W*H;i++)if(m[i]===side&&(!dc||dc[i]>T2+2*T))out[i]=1;}
  if(circle){const{cx,cy,r}=circle,h=lw/2;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-cx,y-cy)-r;if(d>h)out[y*W+x]=0;else if(d>=-h)out[y*W+x]=1;}}
  return{m:out,lw,circle};}

// The outline of the whole picture, if it is mostly a circle: the edge of the light outside, fitted with a circle
// (tried on many triples of edge points, keeping the one most of the edge lies on, then fitted to those points).
function outerCircle(m){const outside=new Uint8Array(W*H),st=[];for(let x=0;x<W;x++)st.push(x,(H-1)*W+x);for(let y=0;y<H;y++)st.push(y*W,y*W+W-1);
  while(st.length){const i=st.pop();if(outside[i]||m[i])continue;outside[i]=1;const x=i%W,y=(i/W)|0;if(x>0)st.push(i-1);if(x<W-1)st.push(i+1);if(y>0)st.push(i-W);if(y<H-1)st.push(i+W);}
  const E=[];for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(outside[i]&&(!outside[i-1]||!outside[i+1]||!outside[i-W]||!outside[i+W]))E.push(x,y);}
  let n=E.length/2;if(n<50)return null;const step=Math.max(1,Math.floor(n/4000)),P=[];for(let k=0;k<n;k+=step)P.push([E[2*k],E[2*k+1]]);n=P.length;
  let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  const thru=(a,b,c)=>{const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-9)return null;
    const A=a[0]*a[0]+a[1]*a[1],B=b[0]*b[0]+b[1]*b[1],C=c[0]*c[0]+c[1]*c[1];const cx=(A*(b[1]-c[1])+B*(c[1]-a[1])+C*(a[1]-b[1]))/d,cy=(A*(c[0]-b[0])+B*(a[0]-c[0])+C*(b[0]-a[0]))/d;
    return{cx,cy,r:Math.hypot(a[0]-cx,a[1]-cy)};};
  const tolOf=c=>Math.max(3,0.012*c.r),onIt=c=>{const t=tolOf(c);let k=0;for(const p of P)if(Math.abs(Math.hypot(p[0]-c.cx,p[1]-c.cy)-c.r)<=t)k++;return k;};
  let best=null,bk=0;for(let it=0;it<500;it++){const c=thru(P[(rnd()*n)|0],P[(rnd()*n)|0],P[(rnd()*n)|0]);if(!c||c.r<0.15*Math.min(W,H)||c.r>0.75*Math.max(W,H))continue;const k=onIt(c);if(k>bk){bk=k;best=c;}}
  if(!best)return null;
  // (least squares on the points lying on it)
  for(let pass=0;pass<2;pass++){const t=tolOf(best),Q=P.filter(p=>Math.abs(Math.hypot(p[0]-best.cx,p[1]-best.cy)-best.r)<=t);if(Q.length<20)return null;
    let sx=0,sy=0,sxx=0,syy=0,sxy=0,sz=0,sxz=0,syz=0;for(const[x,y]of Q){const z=x*x+y*y;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sz+=z;sxz+=x*z;syz+=y*z;}
    const N=Q.length,M=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,N]],v=[sxz,syz,sz];const det=a=>a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
    const D=det(M);if(Math.abs(D)<1e-9)break;const col=j=>M.map((r,i)=>r.map((e,k)=>k===j?v[i]:e));const A=det(col(0))/D,B=det(col(1))/D,C=det(col(2))/D;
    best={cx:A/2,cy:B/2,r:Math.sqrt(C+A*A/4+B*B/4)};}
  // (the outline runs along the circle for most of the way round; shapes breaking it may make up much of the rest)
  const t=tolOf(best),bins=new Uint8Array(72);let k=0;for(const p of P){if(Math.abs(Math.hypot(p[0]-best.cx,p[1]-best.cy)-best.r)>t)continue;k++;bins[Math.floor((Math.atan2(p[1]-best.cy,p[0]-best.cx)+Math.PI)/(2*Math.PI)*72)%72]=1;}
  let cov=0;for(const b of bins)cov+=b;if(cov<0.6*72||k*step<0.5*2*Math.PI*best.r)return null;
  // (how far the picture's own edge wanders either side of the circle, along the stretches that follow it)
  const res=[];for(const p of P){const d=Math.abs(Math.hypot(p[0]-best.cx,p[1]-best.cy)-best.r);if(d<=t)res.push(d);}res.sort((a,b)=>a-b);
  best.spread=Math.max(3,(res[Math.floor(0.95*res.length)]||0)+2);
  return best;}

// A straight lead line of radius r from a to b, drawn into the mask.
function drawSeg(m,ax,ay,bx,by,r){const x0=Math.max(0,Math.floor(Math.min(ax,bx)-r-1)),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx)+r+1)),
    y0=Math.max(0,Math.floor(Math.min(ay,by)-r-1)),y1=Math.min(H-1,Math.ceil(Math.max(ay,by)+r+1)),dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy||1e-9,r2=r*r;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){let t=((x-ax)*dx+(y-ay)*dy)/L2;t=t<0?0:t>1?1:t;const ex=ax+t*dx-x,ey=ay+t*dy-y;if(ex*ex+ey*ey<=r2)m[y*W+x]=1;}}

// The typical width of the lines, in pixels (the middle run of dark across a line).
function inkWidth(m){const r=[];for(let y=1;y<H-1;y+=3)for(let x=1;x<W-1;x+=3){const i=y*W+x;if(m[i]&&!m[i-1])for(let k=1;k<200;k++){if(x+k>=W||!m[i+k]){r.push(k);break;}}}
  r.sort((a,b)=>a-b);return r.length?Math.max(2,r[r.length>>1]):4;}

// Break lines: a glass piece with a hole in it, a deep inside curve, or one too big to handle gets a straight line
// across it, the way a pattern maker would add one: from the bottom of the inside curve to the nearest line beyond it,
// from a hole to the nearest outside edge, or the shortest line across a big piece that splits it fairly evenly.
// Worked out on a coarse grid (about 50 squares to the inch), drawn into the full picture.
// ("only where needed" uses the rule Check pieces uses for a deep inside curve, a little tighter: it is measured more coarsely here)
const BREAK={min:{depth:0.27,ratio:0.55,deep:1.5},more:{depth:0.22,ratio:0.4,deep:1.0}};
function addBreaks(m,ppi,lw,p){const f=Math.max(1,Math.round(ppi/50)),gw=Math.ceil(W/f),gh=Math.ceil(H/f),gp=ppi/f,N=gw*gh;
  const G=new Uint8Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(m[y*W+x])G[((y/f)|0)*gw+((x/f)|0)]=1;
  const lvl=BREAK[p.breakLevel==='more'?'more':'min'],maxArea=+p.breakMax||0,skips=(p.noBreaks||[]).map(q=>[q[0]/f,q[1]/f]),skipR=0.45*gp;
  const skipped=(x,y)=>skips.some(q=>Math.hypot(q[0]-x,q[1]-y)<skipR);
  const toFull=v=>(v+0.5)*f,out=[],lab=new Int32Array(N),st=new Int32Array(N);
  const draw=(a,b,why,key)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,e=1.5;
    const A=[a[0]-ux*e,a[1]-uy*e],B=[b[0]+ux*e,b[1]+uy*e];
    drawSeg(m,toFull(A[0]),toFull(A[1]),toFull(B[0]),toFull(B[1]),lw/2);
    // (on the grid too, so the next round sees the two new pieces)
    const n=Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])*2)+1;for(let k=0;k<=n;k++){const x=Math.round(A[0]+(B[0]-A[0])*k/n),y=Math.round(A[1]+(B[1]-A[1])*k/n);
      for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<gw&&Y<gh&&(i===0||j===0))G[Y*gw+X]=1;}}
    out.push({ax:toFull(a[0])-0.5,ay:toFull(a[1])-0.5,bx:toFull(b[0])-0.5,by:toFull(b[1])-0.5,kx:toFull(key[0])-0.5,ky:toFull(key[1])-0.5,why});};
  // (from p along direction (ux,uy) through piece l: how far until the piece ends, or -1 if it runs off the picture)
  const ray=(l,px,py,ux,uy,max)=>{for(let t=0.5;t<max;t+=0.5){const x=Math.round(px+ux*t),y=Math.round(py+uy*t);if(x<0||y<0||x>=gw||y>=gh)return-1;if(lab[y*gw+x]!==l)return G[y*gw+x]?t:-1;}return-1;};
  for(let round=0;round<20;round++){
    // the pieces: everything between lines; those touching the picture's edge are outside the panel
    lab.fill(-1);const pieces=[];
    for(let s=0;s<N;s++){if(G[s]||lab[s]>=0)continue;const l=pieces.length,cells=[];let sp=0,edge=false,x0=gw,y0=gh,x1=0,y1=0;st[sp++]=s;lab[s]=l;
      while(sp){const i=st[--sp];cells.push(i);const x=i%gw,y=(i/gw)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(!x||!y||x===gw-1||y===gh-1)edge=true;
        if(x>0&&!G[i-1]&&lab[i-1]<0){lab[i-1]=l;st[sp++]=i-1;}if(x<gw-1&&!G[i+1]&&lab[i+1]<0){lab[i+1]=l;st[sp++]=i+1;}
        if(y>0&&!G[i-gw]&&lab[i-gw]<0){lab[i-gw]=l;st[sp++]=i-gw;}if(y<gh-1&&!G[i+gw]&&lab[i+gw]<0){lab[i+gw]=l;st[sp++]=i+gw;}}
      pieces.push({cells,edge,box:[x0,y0,x1,y1]});}
    let made=0;
    for(let l=0;l<pieces.length;l++){const P=pieces[l];if(P.edge||P.cells.length<0.3*gp*gp)continue;
      const cut=holeCut(l,P)||pocketCut(l,P)||bigCut(l,P);if(cut){draw(cut.a,cut.b,cut.why,cut.key);made++;}}
    if(!made)break;}
  return out;

  // A hole (another piece, or a shape, inside this one): the shortest way across from it to the outside edge.
  function holeCut(l,P){const[x0,y0,x1,y1]=P.box,bw=x1-x0+3,bh=y1-y0+3,o=new Uint8Array(bw*bh),q=[];
    const at=(x,y)=>{const X=x+x0-1,Y=y+y0-1;return X>=0&&Y>=0&&X<gw&&Y<gh&&lab[Y*gw+X]===l;};
    for(let x=0;x<bw;x++){q.push(x,0,x,bh-1);}for(let y=0;y<bh;y++){q.push(0,y,bw-1,y);}
    while(q.length){const y=q.pop(),x=q.pop();if(x<0||y<0||x>=bw||y>=bh||o[y*bw+x]||at(x,y))continue;o[y*bw+x]=1;q.push(x+1,y,x-1,y,x,y+1,x,y-1);}
    // (cells of the piece next to a hole, and next to the outside)
    const nearHole=[],nearOut=new Uint8Array(bw*bh);let any=false;
    for(let y=1;y<bh-1;y++)for(let x=1;x<bw-1;x++){if(!at(x,y))continue;let h=false,ou=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(at(X,Y))continue;if(o[Y*bw+X])ou=true;else h=true;}
      if(h){nearHole.push(x,y);any=true;}if(ou)nearOut[y*bw+x]=1;}
    if(!any)return null;
    // (spread out from the hole's edge until the outside edge is reached)
    const dist=new Int32Array(bw*bh).fill(-1),from=new Int32Array(bw*bh);let fr=[];for(let k=0;k<nearHole.length;k+=2){const i=nearHole[k+1]*bw+nearHole[k];dist[i]=0;from[i]=i;fr.push(i);}
    let hit=-1;while(fr.length&&hit<0){const nx=[];for(const i of fr){if(nearOut[i]){hit=i;break;}const x=i%bw,y=(i/bw)|0;
        for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=bw||Y>=bh||!at(X,Y))continue;const j=Y*bw+X;if(dist[j]>=0)continue;dist[j]=dist[i]+1;from[j]=from[i];nx.push(j);}}fr=nx;}
    if(hit<0)return null;const g=i=>[i%bw+x0-1,((i/bw)|0)+y0-1],a=g(from[hit]),b=g(hit);if(skipped(...a)||skipped(...b))return null;
    // (each end pushed out to the line it meets)
    const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,ta=ray(l,a[0],a[1],-ux,-uy,4*gp),tb=ray(l,b[0],b[1],ux,uy,4*gp);
    return{a:[a[0]-ux*Math.max(0,ta),a[1]-uy*Math.max(0,ta)],b:[b[0]+ux*Math.max(0,tb),b[1]+uy*Math.max(0,tb)],why:'ring',key:a};}

  // The deepest inside curve that is too deep for glass: a line from its bottom straight on through the piece.
  function pocketCut(l,P){const C=traceOutline(l,P);if(C.length<16)return null;const R=resample(C,Math.max(1,0.05*gp)),n=R.length;if(n<12)return null;
    const Hh=hull(R);let best=null;
    for(let k=0;k<Hh.length;k++){const i0=Hh[k],i1=Hh[(k+1)%Hh.length],A=R[i0],B=R[i1],mouth=Math.hypot(B[0]-A[0],B[1]-A[1]);if(mouth<0.1*gp)continue;
      let dep=0,bi=-1;for(let j=(i0+1)%n;j!==i1;j=(j+1)%n){const Q=R[j],d=((B[0]-A[0])*(A[1]-Q[1])-(A[0]-Q[0])*(B[1]-A[1]))/mouth;if(Math.abs(d)>dep){dep=Math.abs(d);bi=j;}}
      if(bi<0)continue;const di=dep/gp,mi=mouth/gp;if(di<lvl.depth||!(di>=lvl.ratio*mi||di>=lvl.deep))continue;if(skipped(...R[bi]))continue;
      if(!best||dep>best.dep)best={dep,P:R[bi],A,B};}
    if(!best)return null;
    // (into the glass: away from the opening, tried a little either way; the shortest way through wins)
    const{A,B}=best,Pp=best.P,mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2;let nx=Pp[0]-mx,ny=Pp[1]-my;{const tx=B[0]-A[0],ty=B[1]-A[1],tl=Math.hypot(tx,ty);const nn=[-ty/tl,tx/tl];const s=nn[0]*nx+nn[1]*ny;nx=nn[0]*Math.sign(s||1);ny=nn[1]*Math.sign(s||1);}
    // (start from the line itself, just behind the outline point)
    let sx=Pp[0],sy=Pp[1];for(let t=0;t<3;t+=0.5){const x=Math.round(Pp[0]-nx*t),y=Math.round(Pp[1]-ny*t);if(x<0||y<0||x>=gw||y>=gh||lab[y*gw+x]!==l)break;sx=Pp[0]-nx*t;sy=Pp[1]-ny*t;}
    let bc=null;for(let th=-70;th<=70;th+=5){const a=th*Math.PI/180,ux=nx*Math.cos(a)-ny*Math.sin(a),uy=nx*Math.sin(a)+ny*Math.cos(a);
      const t=ray(l,sx,sy,ux,uy,Math.max(gw,gh));if(t<0.15*gp)continue;const sc=t*(1+0.004*Math.abs(th));if(!bc||sc<bc.sc)bc={sc,b:[sx+ux*t,sy+uy*t]};}
    if(!bc)return null;return{a:[sx,sy],b:bc.b,why:'inside curve',key:Pp};}

  // A piece bigger than the largest wanted: the shortest straight line across it that leaves at least a quarter each side.
  function bigCut(l,P){if(!maxArea||P.cells.length<maxArea*gp*gp)return null;const step=Math.max(2,Math.round(0.4*gp)),cand=[];
    for(const i of P.cells){const x=i%gw,y=(i/gw)|0;if(x%step||y%step)continue;
      for(let th=0;th<180;th+=12){const a=th*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),t1=ray(l,x,y,ux,uy,gw+gh),t2=ray(l,x,y,-ux,-uy,gw+gh);if(t1<0||t2<0)continue;
        cand.push({L:t1+t2,a:[x-ux*t2,y-uy*t2],b:[x+ux*t1,y+uy*t1],c:[x,y]});}}
    cand.sort((p,q)=>p.L-q.L);let best=null;const tot=P.cells.length;
    for(const c of cand.slice(0,40)){if(skipped(...c.c))continue;
      // (how the piece would split: the cells on each side, reached without crossing the new line)
      const dx=c.b[0]-c.a[0],dy=c.b[1]-c.a[1],LL=Math.hypot(dx,dy)||1,on=new Set();const nS=Math.ceil(LL*2)+1;
      for(let k=0;k<=nS;k++){const x=Math.round(c.a[0]+dx*k/nS),y=Math.round(c.a[1]+dy*k/nS);on.add(y*gw+x);on.add(y*gw+x+1);on.add((y+1)*gw+x);}
      const seen=new Set(on);let s0=-1;for(const i of P.cells)if(!seen.has(i)){s0=i;break;}if(s0<0)continue;const q=[s0];seen.add(s0);let cnt=0;
      while(q.length){const i=q.pop();cnt++;const x=i%gw;for(const j of[x>0?i-1:-1,x<gw-1?i+1:-1,i-gw,i+gw])if(j>=0&&j<N&&lab[j]===l&&!seen.has(j)){seen.add(j);q.push(j);}}
      const fr=Math.min(cnt,tot-cnt-on.size)/tot;if(fr<0.25)continue;const sc=c.L/Math.sqrt(fr);if(!best||sc<best.sc)best={sc,c};}
    if(!best)return null;return{a:best.c.a,b:best.c.b,why:'large piece',key:best.c.c};}

  // The piece's outer outline, in order (following its edge cells round, keeping the piece on one side).
  function traceOutline(l,P){let s=P.cells[0];for(const i of P.cells)if(i<s)s=i;const inP=(x,y)=>x>=0&&y>=0&&x<gw&&y<gh&&lab[y*gw+x]===l;
    const D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];let x=s%gw,y=(s/gw)|0,d=7;const pts=[[x,y]];const sx=x,sy=y;
    for(let it=0;it<8*P.cells.length+16;it++){let found=false;for(let k=0;k<8;k++){const dd=(d+6+k)%8,X=x+D[dd][0],Y=y+D[dd][1];if(inP(X,Y)){x=X;y=Y;d=dd;found=true;break;}}
      if(!found||(x===sx&&y===sy))break;pts.push([x,y]);}
    return pts;}
  function resample(L,step){const out=[];let carry=0;for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length],d=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=carry;
      while(t<d){out.push([a[0]+(b[0]-a[0])*t/d,a[1]+(b[1]-a[1])*t/d]);t+=step;}carry=t-d;}return out;}
  function hull(Pt){const idx=Pt.map((_,i)=>i).sort((a,b)=>Pt[a][0]-Pt[b][0]||Pt[a][1]-Pt[b][1]);const cr=(o,a,b)=>(Pt[a][0]-Pt[o][0])*(Pt[b][1]-Pt[o][1])-(Pt[a][1]-Pt[o][1])*(Pt[b][0]-Pt[o][0]);
    const lo=[],up=[];for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i);}
    for(let k=idx.length-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i);}
    return[...new Set([...lo.slice(0,-1),...up.slice(0,-1)])].sort((a,b)=>a-b);}}
