// ================================================================================================
// The outside outline evened out: a hand-drawn border wobbles a little where the pen did, and the
// usual smoothing keeps close to the drawn line. Along the pattern's outside edge only, each stretch
// between corners is smoothed over a longer reach, so the border runs as one even curve. Lines that
// end on the border move their ends with it, so every joint stays joined. Straight lines, exact
// circles and clean curves come out as they went in; only wobble is taken out.
// ================================================================================================
function smoothOutline(strokes,m,med,junctions){
  // (the paper outside the pattern: white reached from the image's edge)
  // (taken from the new lines themselves, so a gap in the drawn border can't let the paper in)
  const N=W*H,out=new Uint8Array(N),st=new Int32Array(N),wall=new Uint8Array(N);let sp=0;
  const rr=Math.max(1.5,0.3*med);
  for(const S of strokes)for(let k=0;k<S.length;k++){const a=S[k],b=S[Math.min(S.length-1,k+1)],L=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=L;t++){const y=a[0]+(b[0]-a[0])*t/L,x=a[1]+(b[1]-a[1])*t/L;
      for(let dy=-Math.ceil(rr);dy<=Math.ceil(rr);dy++)for(let dx=-Math.ceil(rr);dx<=Math.ceil(rr);dx++){if(dy*dy+dx*dx>rr*rr)continue;const yy=Math.round(y)+dy,xx=Math.round(x)+dx;if(yy>=0&&xx>=0&&yy<H&&xx<W)wall[yy*W+xx]=1;}}}
  const seed=i=>{if(!wall[i]&&!out[i]){out[i]=1;st[sp++]=i;}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;if(x>0)seed(j-1);if(x<W-1)seed(j+1);if(y>0)seed(j-W);if(y<H-1)seed(j+W);}
  const isOut=(y,x)=>{y=Math.round(y);x=Math.round(x);return y<0||x<0||y>=H||x>=W||out[y*W+x]===1;};
  const K=25;   // (K: the shortest wobble taken out, in lead widths)
  // (what lies just off a line on one side: step out across its own width and look at the first open pixel, so a
  // narrow wedge beside the line is seen as the wedge and not as whatever lies past the next line)
  const side=(q,dy,dx)=>{for(let t=1;t<=2*med;t++){const y=Math.round(q[0]+dy*t),x=Math.round(q[1]+dx*t);if(y<0||x<0||y>=H||x>=W)return true;const i=y*W+x;if(!wall[i])return out[i]===1;}return false;};
  // (every line end with the direction the line leaves it in, to find lines meeting the border at a slant)
  const endDir=[];for(const S of strokes){if(S.length<3)continue;for(const end of[0,1]){const e=end?S[S.length-1]:S[0];let j=end?S.length-1:0,c=0;
      while(c<med&&(end?j>0:j<S.length-1)){const k=end?j-1:j+1;c+=Math.hypot(S[k][0]-S[j][0],S[k][1]-S[j][1]);j=k;}
      const L=Math.hypot(S[j][0]-e[0],S[j][1]-e[1])||1;endDir.push([e,[(S[j][0]-e[0])/L,(S[j][1]-e[1])/L],S]);}}
  const res=strokes.map(Q=>{const n=Q.length;if(n<8)return Q;
    const cum=[0];for(let k=1;k<n;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    const at=(k,dl)=>{let j=k;if(dl<0)while(j>0&&cum[k]-cum[j]<-dl)j--;else while(j<n-1&&cum[j]-cum[k]<dl)j++;return j;};
    // (points with the outside paper on one side of them)
    const edge=Q.map((q,k)=>{const a=Q[at(k,-0.5*med)],b=Q[at(k,0.5*med)];let ty=b[0]-a[0],tx=b[1]-a[1];const L=Math.hypot(ty,tx);if(L<1e-6)return false;ty/=L;tx/=L;
      return side(q,-tx,ty)!==side(q,tx,-ty);});
    if(!edge.some(v=>v))return Q;
    // (corners stay put: a clear turn within a short reach)
    const corner=Q.map((q,k)=>{const a=Q[at(k,-med)],b=Q[at(k,med)];if(a===q||b===q)return false;const v1=[q[0]-a[0],q[1]-a[1]],v2=[b[0]-q[0],b[1]-q[1]];
      const c=(v1[0]*v2[0]+v1[1]*v2[1])/((Math.hypot(...v1)*Math.hypot(...v2))||1);return c<Math.cos(12*Math.PI/180);});
    // (the weight a point is held by: 0 free, 1 fixed; the stroke's own ends (and a lead width in from them, where a
    // corner there can't be seen), corners and non-border points are held,
    // and the hold eases off over a short reach so nothing kinks where the smoothing starts)
    const hold=new Float64Array(n);for(let k=0;k<n;k++)hold[k]=(cum[k]<med||cum[n-1]-cum[k]<med||corner[k]||!edge[k])?1:0;
    // (and where another line meets the border at a slant, in a narrow wedge, the border stays as traced: there the
    // two lines were placed together and moving one would open or close the wedge)
    for(const[e,d,S]of endDir){if(S===Q)continue;let bi=-1,bd=2.5;for(let k=0;k<n;k++){const v=Math.hypot(Q[k][0]-e[0],Q[k][1]-e[1]);if(v<bd){bd=v;bi=k;}}if(bi<0)continue;
      const a=Q[at(bi,-0.5*med)],b=Q[at(bi,0.5*med)],tl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,cs=Math.abs(((b[0]-a[0])*d[0]+(b[1]-a[1])*d[1])/tl);
      if(cs>Math.cos(45*Math.PI/180))for(let k=0;k<n;k++)if(Math.abs(cum[k]-cum[bi])<2.5*med)hold[k]=1;}   // (the whole wedge, a couple of leads along)
    // (a smoothing spline along each free stretch of border between corners, as even as it can be while keeping
    // within a third of a lead width of the traced line; where the spline would stray further it is pulled back)
    const ds=cum[n-1]/(n-1)||1,sl=(K*med/ds)/(2*Math.PI),lam=Math.pow(sl,4),tol=0.22*med;
    // (every joint on this line breaks the smoothing too: a line can run on through a joint at a slight turn, from the
    // border into the pattern, and that turn is kept)
    const jn=new Uint8Array(n);for(const[e,d,S]of endDir){if(S===Q)continue;let bi=-1,bd=2.5;for(let k=0;k<n;k++){const v=Math.hypot(Q[k][0]-e[0],Q[k][1]-e[1]);if(v<bd){bd=v;bi=k;}}if(bi>=0)jn[bi]=1;}
    const brk=k=>cum[k]<med||cum[n-1]-cum[k]<med||corner[k]||!edge[k]||jn[k];const Z=Q.map(q=>q.slice());
    for(let a=0;a<n;){if(brk(a)){a++;continue;}let b=a;while(b+1<n&&!brk(b+1))b++;
      if(cum[b]-cum[a]>=3*med){const Y=Q.slice(a,b+1),m=Y.length;let wc=new Array(m).fill(1),F=Y;
        for(let it=0;it<12;it++){F=whittaker(Y,wc,lam);const over=new Float64Array(m);let mx=0;
          for(let k=0;k<m;k++){const d=Math.hypot(F[k][0]-Y[k][0],F[k][1]-Y[k][1])/tol;over[k]=d;if(d>mx)mx=d;}
          if(mx<=1)break;const g=gaussFilter(maxFilter(over,Math.max(3,Math.floor(med/ds))|1),med/ds);
          wc=wc.map((v,k)=>v*(1+2*Math.pow(Math.max(0,g[k]-0.7),2)));}
        for(let k=0;k<m;k++)Z[a+k]=F[k];}
      a=b+1;}
    // (the move eases off over a short reach towards every held point, so the border meets them without a kink)
    // (and a line coming into a joint is left as traced for a couple of lead widths: the tracing may have drawn it
    // towards a joint set a little off the line, and evening that out would spread the bend along the border)
    const ease=1.2*med,h2=new Float64Array(n);
    for(let k=0;k<n;k++){if(!jn[k])continue;for(let j=0;j<n;j++)if(Math.abs(cum[j]-cum[k])<2*med)h2[j]=1;}
    for(let k=0;k<n;k++){if(!hold[k]&&!brk(k))continue;for(let j=k;j>=0&&cum[k]-cum[j]<ease;j--){const f=1-(cum[k]-cum[j])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}
      for(let j=k;j<n&&cum[j]-cum[k]<ease;j++){const f=1-(cum[j]-cum[k])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}}
    const R=Q.map((q,k)=>{const t=1-h2[k];return t>0?[q[0]+(Z[k][0]-q[0])*t,q[1]+(Z[k][1]-q[1])*t]:q;});
    return R;});
  // (a line ending on a moved stretch of border moves its end with it, eased back along itself)
  const moved=[];res.forEach((R,t)=>{if(R!==strokes[t])moved.push(t);});if(!moved.length)return strokes;
  const shiftAt=(p,skip)=>{let bd=2.5,v=null;for(const u of moved){if(u===skip)continue;const Q=strokes[u];for(let i=0;i<Q.length;i++){const d=Math.hypot(Q[i][0]-p[0],Q[i][1]-p[1]);if(d<bd){bd=d;v=[res[u][i][0]-Q[i][0],res[u][i][1]-Q[i][1]];}}}return v;};
  const fin=res.map((R,t)=>{if(R.length<2)return R;let o=R;
    for(const end of[0,1]){const e=strokes[t][end?strokes[t].length-1:0],v=shiftAt(e,t);if(!v||Math.hypot(v[0],v[1])<0.05)continue;if(o===R)o=R.slice();
      const n=o.length;let c=0;for(let s=0;s<n;s++){const k=end?n-1-s:s;if(s>0){const p=end?k+1:k-1;c+=Math.hypot(strokes[t][k][0]-strokes[t][p][0],strokes[t][k][1]-strokes[t][p][1]);}
        if(c>1.5*med)break;const f=1-c/(1.5*med),w=f*f*(3-2*f);o[k]=[o[k][0]+v[0]*w,o[k][1]+v[1]*w];}}
    return o;});
  if(junctions)for(const J of junctions){const v=shiftAt(J.p,-1);if(v)J.p=[J.p[0]+v[0],J.p[1]+v[1]];}
  return fin;}
