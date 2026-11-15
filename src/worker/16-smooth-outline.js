// ================================================================================================
// The outside outline evened out: a hand-drawn border wobbles a little where the pen did, and the
// usual smoothing keeps close to the drawn line. Along the pattern's outside edge only, each stretch
// between corners is smoothed over a longer reach, so the border runs as one even curve. Lines that
// end on the border move their ends with it, so every joint stays joined. Straight lines, exact
// circles and clean curves come out as they went in; only wobble is taken out.
// ================================================================================================
function smoothOutline(strokes,m,med,junctions){
  // (the paper outside the pattern: white reached from the image's edge)
  const N=W*H,out=new Uint8Array(N),st=new Int32Array(N);let sp=0;
  const seed=i=>{if(!m[i]&&!out[i]){out[i]=1;st[sp++]=i;}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;if(x>0)seed(j-1);if(x<W-1)seed(j+1);if(y>0)seed(j-W);if(y<H-1)seed(j+W);}
  const isOut=(y,x)=>{y=Math.round(y);x=Math.round(x);return y<0||x<0||y>=H||x>=W||out[y*W+x]===1;};
  const reach=0.6*med+2,sig=5*med;
  // (every line end with the direction the line leaves it in, to find lines meeting the border at a slant)
  const endDir=[];for(const S of strokes){if(S.length<3)continue;for(const end of[0,1]){const e=end?S[S.length-1]:S[0];let j=end?S.length-1:0,c=0;
      while(c<med&&(end?j>0:j<S.length-1)){const k=end?j-1:j+1;c+=Math.hypot(S[k][0]-S[j][0],S[k][1]-S[j][1]);j=k;}
      const L=Math.hypot(S[j][0]-e[0],S[j][1]-e[1])||1;endDir.push([e,[(S[j][0]-e[0])/L,(S[j][1]-e[1])/L],S]);}}
  const res=strokes.map(Q=>{const n=Q.length;if(n<8)return Q;
    const cum=[0];for(let k=1;k<n;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    const at=(k,dl)=>{let j=k;if(dl<0)while(j>0&&cum[k]-cum[j]<-dl)j--;else while(j<n-1&&cum[j]-cum[k]<dl)j++;return j;};
    // (points with the outside paper on one side of them)
    const edge=Q.map((q,k)=>{const a=Q[at(k,-0.5*med)],b=Q[at(k,0.5*med)];let ty=b[0]-a[0],tx=b[1]-a[1];const L=Math.hypot(ty,tx);if(L<1e-6)return false;ty/=L;tx/=L;
      return isOut(q[0]-tx*reach,q[1]+ty*reach)!==isOut(q[0]+tx*reach,q[1]-ty*reach);});
    if(!edge.some(v=>v))return Q;
    // (corners stay put: a clear turn within a short reach)
    const corner=Q.map((q,k)=>{const a=Q[at(k,-med)],b=Q[at(k,med)];if(a===q||b===q)return false;const v1=[q[0]-a[0],q[1]-a[1]],v2=[b[0]-q[0],b[1]-q[1]];
      const c=(v1[0]*v2[0]+v1[1]*v2[1])/((Math.hypot(...v1)*Math.hypot(...v2))||1);return c<Math.cos(30*Math.PI/180);});
    // (the weight a point is held by: 0 free, 1 fixed; the stroke's own ends, corners and non-border points are held,
    // and the hold eases off over a short reach so nothing kinks where the smoothing starts)
    const hold=new Float64Array(n);for(let k=0;k<n;k++)hold[k]=(k===0||k===n-1||corner[k]||!edge[k])?1:0;
    // (and where another line meets the border at a slant, in a narrow wedge, the border stays as traced: there the
    // two lines were placed together and moving one would open or close the wedge)
    for(const[e,d,S]of endDir){if(S===Q)continue;let bi=-1,bd=2.5;for(let k=0;k<n;k++){const v=Math.hypot(Q[k][0]-e[0],Q[k][1]-e[1]);if(v<bd){bd=v;bi=k;}}if(bi<0)continue;
      const a=Q[at(bi,-0.5*med)],b=Q[at(bi,0.5*med)],tl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,cs=Math.abs(((b[0]-a[0])*d[0]+(b[1]-a[1])*d[1])/tl);
      if(cs>Math.cos(45*Math.PI/180))hold[bi]=1;}
    const ease=1.2*med,h2=new Float64Array(n);
    for(let k=0;k<n;k++){if(!hold[k])continue;for(let j=k;j>=0&&cum[k]-cum[j]<ease;j--){const f=1-(cum[k]-cum[j])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}
      for(let j=k;j<n&&cum[j]-cum[k]<ease;j++){const f=1-(cum[j]-cum[k])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}}
    // (gaussian along the line, over the free stretch only: never across a corner, a held point or the end of the border)
    // (a local quadratic fit along the line, gaussian weighted, so a true curve keeps its bend and only the wobble
    // goes; the fit stops at held points, where it simply leans on the side it has)
    const R=Q.map((q,k)=>{if(h2[k]>=1)return q;const M=[0,0,0,0,0],By=[0,0,0],Bx=[0,0,0];
      const add=j=>{const d=cum[j]-cum[k],w=Math.exp(-d*d/(2*sig*sig)),d2=d*d;M[0]+=w;M[1]+=w*d;M[2]+=w*d2;M[3]+=w*d2*d;M[4]+=w*d2*d2;
        By[0]+=w*Q[j][0];By[1]+=w*d*Q[j][0];By[2]+=w*d2*Q[j][0];Bx[0]+=w*Q[j][1];Bx[1]+=w*d*Q[j][1];Bx[2]+=w*d2*Q[j][1];};
      for(let j=k;j>=0&&cum[k]-cum[j]<=3*sig;j--){if(j!==k&&hold[j]&&h2[j]>=1&&(corner[j]||j===0))break;add(j);}
      for(let j=k+1;j<n&&cum[j]-cum[k]<=3*sig;j++){if(hold[j]&&(corner[j]||j===n-1))break;add(j);}
      // (value at d=0 of the fitted quadratic: solve the 3×3 normal equations)
      const a=[[M[0],M[1],M[2]],[M[1],M[2],M[3]],[M[2],M[3],M[4]]];
      const det3=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
      const D=det3(a);if(!(Math.abs(D)>1e-9))return q;const c0=B=>det3([[B[0],a[0][1],a[0][2]],[B[1],a[1][1],a[1][2]],[B[2],a[2][1],a[2][2]]])/D;
      const fy=c0(By),fx=c0(Bx);if(!isFinite(fy)||!isFinite(fx)||Math.hypot(fy-q[0],fx-q[1])>0.8*med)return q;
      const t=h2[k];return[t*q[0]+(1-t)*fy,t*q[1]+(1-t)*fx];});
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
