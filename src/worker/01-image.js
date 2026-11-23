// Reading the picture: threshold (Otsu), small-speck removal, distance map, thinning to a one-pixel skeleton.
// ------------------------------------------------------------------------------------------------

const INF=1e20;
let W=0,H=0,gray=null,otsuT=128,colorIn=false;

function otsu(g){const h=new Float64Array(256);for(let i=0;i<g.length;i++)h[g[i]]++;
  const n=g.length;let sum=0;for(let t=0;t<256;t++)sum+=t*h[t];
  let sB=0,wB=0,best=0,bt=128;for(let t=0;t<256;t++){wB+=h[t];if(!wB)continue;const wF=n-wB;if(!wF)break;
    sB+=t*h[t];const mB=sB/wB,mF=(sum-sB)/wF;const v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;bt=t;}}
  return bt+1;}

function removeSmall(m,val,minA,conn8,keepBorder){
  if(minA<=0)return;const seen=new Uint8Array(W*H);const st=new Int32Array(W*H);const comp=[];
  for(let s=0;s<W*H;s++){if(m[s]!==val||seen[s])continue;
    let sp=0,touch=false;st[sp++]=s;seen[s]=1;comp.length=0;
    while(sp){const i=st[--sp];comp.push(i);const x=i%W,y=(i/W)|0;
      if(x===0||y===0||x===W-1||y===H-1)touch=true;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(!conn8&&dx&&dy)continue;
        const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const j=yy*W+xx;
        if(m[j]===val&&!seen[j]){seen[j]=1;st[sp++]=j;}}}
    if(comp.length<minA&&!(keepBorder&&touch))for(const i of comp)m[i]=1-val;}}

function edt1d(f,n,d,v,z){let k=0;v[0]=0;z[0]=-INF;z[1]=INF;
  for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
    while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
    k++;v[k]=q;z[k]=s;z[k+1]=INF;}
  k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;const dq=q-v[k];d[q]=dq*dq+f[v[k]];}}
function edt(src){const N=Math.max(W,H);const f=new Float64Array(N),d=new Float64Array(N),v=new Int32Array(N),z=new Float64Array(N+1);
  const out=new Float32Array(W*H);
  // (down each column, the distance to the nearest set pixel above or below it: two sweeps over whole rows, top to
  // bottom then back, so memory is read in order; for a yes/no picture this is the same as the column pass of the
  // general method, and much quicker)
  const g=new Int32Array(W*H),BIG=1<<29;
  for(let x=0;x<W;x++)g[x]=src[x]?0:BIG;
  for(let y=1;y<H;y++){const o=y*W,p=o-W;for(let x=0;x<W;x++)g[o+x]=src[o+x]?0:(g[p+x]>=BIG?BIG:g[p+x]+1);}
  for(let y=H-2;y>=0;y--){const o=y*W,n=o+W;for(let x=0;x<W;x++){const b=g[n+x]+1;if(b<g[o+x])g[o+x]=b;}}
  for(let y=0;y<H;y++){const o=y*W;let any=false;for(let x=0;x<W;x++){const t=g[o+x];if(t>=BIG)f[x]=INF;else{f[x]=t*t;any=true;}}
    if(!any){for(let x=0;x<W;x++)out[o+x]=INF;continue;}
    edt1d(f,W,d,v,z);for(let x=0;x<W;x++)out[o+x]=d[x];}
  return out;}

// (every pixel within r of a set pixel: the same as testing the distance map against r, but done by laying a disc's
// rows along each run of set pixels, which is many times quicker for the small radii used in cleaning)
function diskDil(a,r){const N=W*H,o=new Uint8Array(N),R=Math.floor(r),r2=r*r,hw=[];for(let dy=-R;dy<=R;dy++)hw.push(Math.floor(Math.sqrt(Math.max(0,r2-dy*dy))+1e-9));
  for(let y=0;y<H;y++){const row=y*W;let x=0;
    while(x<W){if(!a[row+x]){x++;continue;}let x1=x;while(x1+1<W&&a[row+x1+1])x1++;
      for(let k=0;k<hw.length;k++){const yy=y+k-R;if(yy<0||yy>=H)continue;const w=hw[k],lo=Math.max(0,x-w),hi=Math.min(W-1,x1+w),b=yy*W;o.fill(1,b+lo,b+hi+1);}
      x=x1+1;}}
  return o;}

function thin(img,PW,PH){
  const off=[-PW,-PW+1,1,PW+1,PW,PW-1,-1,-PW-1];
  let list=[];for(let y=1;y<PH-1;y++)for(let x=1;x<PW-1;x++){const i=y*PW+x;if(img[i])list.push(i);}
  const del=new Int32Array(list.length);let changed=true,it=0;
  while(changed){changed=false;it++;
    for(let step=0;step<2;step++){let nd=0;
      for(let a=0;a<list.length;a++){const k=list[a];if(!img[k])continue;
        const p2=img[k+off[0]],p3=img[k+off[1]],p4=img[k+off[2]],p5=img[k+off[3]],p6=img[k+off[4]],p7=img[k+off[5]],p8=img[k+off[6]],p9=img[k+off[7]];
        const B=p2+p3+p4+p5+p6+p7+p8+p9;if(B<2||B>6)continue;
        const A=(!p2&&p3)+(!p3&&p4)+(!p4&&p5)+(!p5&&p6)+(!p6&&p7)+(!p7&&p8)+(!p8&&p9)+(!p9&&p2);if(A!==1)continue;
        if(step===0){if(p2&&p4&&p6)continue;if(p4&&p6&&p8)continue;}else{if(p2&&p4&&p8)continue;if(p2&&p6&&p8)continue;}
        del[nd++]=k;}
      for(let j=0;j<nd;j++)img[del[j]]=0;if(nd)changed=true;}
    if(it%3===0)list=list.filter(k=>img[k]);}}

// ---- curve helpers ----
