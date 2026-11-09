// 1-D smoothing filters used on traced lines (Gaussian, Savitzky-Golay).
// ------------------------------------------------------------------------------------------------
function gauss1d(arr,sig,wrap){const n=arr.length;if(sig<0.3||n<3)return arr.slice();
  const r=Math.ceil(3.5*sig);const k=[];let s=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*sig*sig));k.push(v);s+=v;}
  const out=new Float64Array(n);for(let i=0;i<n;i++){let a=0;for(let j=-r;j<=r;j++){let t=i+j;
    if(wrap)t=((t%n)+n)%n;else t=t<0?0:t>=n?n-1:t;a+=arr[t]*k[j+r];}out[i]=a/s;}return out;}
function savgolCoef(m){const h=(m-1)/2;const G=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for(let j=-h;j<=h;j++){const p=[1,j,j*j,j*j*j];for(let a=0;a<4;a++)for(let b=0;b<4;b++)G[a][b]+=p[a]*p[b];}
  const Gi=inv4(G);const c=[];for(let j=-h;j<=h;j++){const p=[1,j,j*j,j*j*j];let v=0;for(let b=0;b<4;b++)v+=Gi[0][b]*p[b];c.push(v);}return c;}
function inv4(M){const n=4;const A=M.map((r,i)=>[...r,...[0,0,0,0].map((_,j)=>i===j?1:0)]);
  for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];
    const d=A[c][c];for(let j=0;j<2*n;j++)A[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const f=A[r][c];for(let j=0;j<2*n;j++)A[r][j]-=f*A[c][j];}}
  return A.map(r=>r.slice(n));}
const sgCache={};
function savgol(arr,m,wrap){const n=arr.length;if(m<7||n<m)return arr;const c=sgCache[m]||(sgCache[m]=savgolCoef(m));const h=(m-1)/2;
  const out=new Float64Array(n);for(let i=0;i<n;i++){let a=0;for(let j=-h;j<=h;j++){let t=i+j;
    if(wrap)t=((t%n)+n)%n;else t=t<0?0:t>=n?n-1:t;a+=arr[t]*c[j+h];}out[i]=a;}return out;}

