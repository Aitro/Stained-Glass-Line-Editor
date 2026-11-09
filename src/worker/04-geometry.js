// Polyline helpers: arc length, resampling, end directions, small solvers, Whittaker smoother.
// ------------------------------------------------------------------------------------------------
function arclen(P){const L=new Float64Array(P.length);for(let i=1;i<P.length;i++)L[i]=L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return L;}
function at(P,d,L){L=L||arclen(P);const n=P.length;if(n===1)return[P[0][0],P[0][1]];d=Math.max(0,Math.min(d,L[n-1]));
  let lo=0,hi=n-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(L[mid]<=d)lo=mid;else hi=mid;}
  const span=L[hi]-L[lo],t=span>0?(d-L[lo])/span:0;return[P[lo][0]+t*(P[hi][0]-P[lo][0]),P[lo][1]+t*(P[hi][1]-P[lo][1])];}
function resample(P,step,w){const L=arclen(P),tot=L[L.length-1];
  if(tot<1e-9)return[[P[0].slice()],[w?w[0]:1]];
  const n=Math.max(2,Math.ceil(tot/step)+1);const Q=[],ws=[];let k=0;
  for(let i=0;i<n;i++){const t=tot*i/(n-1);while(k<P.length-2&&L[k+1]<=t)k++;
    const span=L[k+1]-L[k],f=span>0?Math.min(1,(t-L[k])/span):0;Q.push([P[k][0]+f*(P[k+1][0]-P[k][0]),P[k][1]+f*(P[k+1][1]-P[k][1])]);
    ws.push(w?Math.min(w[k],w[k+1]):1);}
  return[Q,ws];}
function resampleKeep(Q,w){const pins=[0];for(let i=1;i<Q.length-1;i++)if(w[i]>=1e5)pins.push(i);pins.push(Q.length-1);
  let oQ=[],ow=[];for(let p=0;p<pins.length-1;p++){const a=pins[p],b=pins[p+1];
    let [R,rw]=resample(Q.slice(a,b+1),1.0,w.slice(a,b+1));rw[0]=w[a];rw[rw.length-1]=w[b];
    if(oQ.length){R=R.slice(1);rw=rw.slice(1);}oQ=oQ.concat(R);ow=ow.concat(rw);}
  return[oQ,ow];}
function norm2(v){return Math.hypot(v[0],v[1]);}
function endDir(P,side,u,L,clr,bend){L=L||arclen(P);const tot=L[L.length-1];
  const c0=clr==null?2*u:Math.max(2*u,clr);const d1=Math.min(c0,0.4*tot),d2=Math.min(d1+7*u,0.85*tot);
  const n=Math.max(3,Math.floor((d2-d1)/Math.max(u/2,1))+1);const ds=[],pts=[];
  for(let i=0;i<n;i++){const d=d1+(d2-d1)*i/(n-1);ds.push(d-d1);pts.push(at(P,side===1?tot-d:d,L));}
  const anchor=pts[0];let v;
  // quadratic fit; derivative at the anchor (also on short pieces, whose ends may already be curving:
  // the top of a small rounded shape)
  let bent=false;if(bend&&!(d2-d1>3*u)&&d2-d1>1.5*u&&tot<5*u*1.75){const a=pts[0],b=pts[pts.length-1],ab=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(ab[0],ab[1])||1;
    for(const q of pts)if(Math.abs((q[0]-a[0])*ab[1]-(q[1]-a[1])*ab[0])/l>0.12*u*1.75)bent=true;}
  if((d2-d1>3*u||bent)&&n>=5){
    let S0=0,S1=0,S2=0,S3=0,S4=0,Ty0=0,Ty1=0,Ty2=0,Tx0=0,Tx1=0,Tx2=0;
    for(let i=0;i<n;i++){const x=ds[i],x2=x*x;S0++;S1+=x;S2+=x2;S3+=x2*x;S4+=x2*x2;
      Ty0+=pts[i][0];Ty1+=x*pts[i][0];Ty2+=x2*pts[i][0];Tx0+=pts[i][1];Tx1+=x*pts[i][1];Tx2+=x2*pts[i][1];}
    const M=[[S0,S1,S2],[S1,S2,S3],[S2,S3,S4]];const cy=solve3(M,[Ty0,Ty1,Ty2]),cx=solve3(M,[Tx0,Tx1,Tx2]);
    v=[cy[1],cx[1]];
    const nn=norm2(v);const dir=nn>1e-9?[v[0]/nn,v[1]/nn]:[0,0];
    // follow the fitted curve back toward the junction (t = distance from the anchor)
    const curve=t=>[cy[0]-cy[1]*t+cy[2]*t*t,cx[0]-cx[1]*t+cx[2]*t*t];
    return[anchor,dir,curve];}
  else v=[pts[n-1][0]-pts[0][0],pts[n-1][1]-pts[0][1]];
  const nn=norm2(v);return[anchor,nn>1e-9?[v[0]/nn,v[1]/nn]:[0,0]];}
function solve3(M,b){const A=M.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];
    const d=A[c][c]||1e-12;for(let j=c;j<4;j++)A[c][j]/=d;for(let r=0;r<3;r++)if(r!==c){const f=A[r][c];for(let j=c;j<4;j++)A[r][j]-=f*A[c][j];}}
  return[A[0][3],A[1][3],A[2][3]];}
function lsqPoint(anchors,dirs,c,reg){reg=reg==null?0.05:reg;let a=reg,b=0,d=reg,bx=reg*c[0],by=reg*c[1];
  for(let i=0;i<anchors.length;i++){const p=anchors[i],q=dirs[i];const m11=1-q[0]*q[0],m12=-q[0]*q[1],m22=1-q[1]*q[1];
    a+=m11;b+=m12;d+=m22;bx+=m11*p[0]+m12*p[1];by+=m12*p[0]+m22*p[1];}
  const det=a*d-b*b;return[(d*bx-b*by)/det,(a*by-b*bx)/det];}
function angDeg(p,q){return Math.acos(Math.max(-1,Math.min(1,p[0]*q[0]+p[1]*q[1])))*180/Math.PI;}

// minimise sum w(z-y)^2 + lam*sum(second difference of z)^2  (pentadiagonal LDL^T solve)
function whittaker(Y,w,lam){const n=Y.length;if(n<5)return Y.map(q=>q.slice());
  const a0=new Float64Array(n),a1=new Float64Array(n),D=new Float64Array(n),L1=new Float64Array(n),L2=new Float64Array(n);
  for(let i=0;i<n;i++){const d0=(i===0||i===n-1)?1:(i===1||i===n-2)?5:6;a0[i]=w[i]+lam*d0;}
  for(let i=0;i<n-1;i++)a1[i]=lam*((i===0||i===n-2)?-2:-4);
  for(let i=0;i<n;i++){
    if(i>=2)L2[i]=lam/D[i-2];
    if(i>=1)L1[i]=(a1[i-1]-(i>=2?L2[i]*L1[i-1]*D[i-2]:0))/D[i-1];
    D[i]=a0[i]-(i>=1?L1[i]*L1[i]*D[i-1]:0)-(i>=2?L2[i]*L2[i]*D[i-2]:0);}
  const out=Y.map(()=>[0,0]);const z=new Float64Array(n);
  for(let c=0;c<2;c++){
    for(let i=0;i<n;i++)z[i]=w[i]*Y[i][c]-(i>=1?L1[i]*z[i-1]:0)-(i>=2?L2[i]*z[i-2]:0);
    for(let i=0;i<n;i++)z[i]/=D[i];
    for(let i=n-1;i>=0;i--)z[i]=z[i]-(i+1<n?L1[i+1]*z[i+1]:0)-(i+2<n?L2[i+2]*z[i+2]:0);
    for(let i=0;i<n;i++)out[i][c]=z[i];}
  return out;}
const refl=(i,n)=>{while(i<0||i>=n){if(i<0)i=-i-1;if(i>=n)i=2*n-i-1;}return i;};
function maxFilter(a,size){const n=a.length,h=size>>1,o=new Float64Array(n);for(let i=0;i<n;i++){let m=-Infinity;for(let j=-h;j<=h;j++)m=Math.max(m,a[refl(i+j,n)]);o[i]=m;}return o;}
function gaussFilter(a,sig){const n=a.length,r=Math.ceil(4*sig),k=[];let s=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*sig*sig));k.push(v);s+=v;}
  const o=new Float64Array(n);for(let i=0;i<n;i++){let t=0;for(let j=-r;j<=r;j++)t+=a[refl(i+j,n)]*k[j+r];o[i]=t/s;}return o;}
