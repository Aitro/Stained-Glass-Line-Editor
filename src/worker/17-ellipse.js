// ================================================================================================
// Ovals: an exact ellipse for a drawn oval, the way a drawn circle becomes an exact circle.
// An ellipse is {type:'ellipse', c:[centre], a, b (the two half-axes), th (turn of the a axis), dev}.
// Fitted to the points directly (an algebraic fit, then nudged to the least distance from the points),
// and the shared helpers the line building uses: the nearest point on it, where it crosses another
// shape, and points along it.
// ================================================================================================
function ellPoint(e,t){const ct=Math.cos(e.th),st=Math.sin(e.th),x=e.a*Math.cos(t),y=e.b*Math.sin(t);
  return[e.c[0]+x*ct-y*st,e.c[1]+x*st+y*ct];}
function ellTangent(e,t){const ct=Math.cos(e.th),st=Math.sin(e.th),x=-e.a*Math.sin(t),y=e.b*Math.cos(t);return[x*ct-y*st,x*st+y*ct];}
// (where a point sits round the ellipse, and the nearest point on it: a few Newton steps from straight out)
function ellParam(e,p){const ct=Math.cos(e.th),st=Math.sin(e.th),dx=p[0]-e.c[0],dy=p[1]-e.c[1];
  const u=(dx*ct+dy*st)/e.a,v=(-dx*st+dy*ct)/e.b;let t=Math.atan2(v,u);
  for(let it=0;it<8;it++){const q=ellPoint(e,t),d1=ellTangent(e,t),ex=q[0]-p[0],ey=q[1]-p[1];
    const ctt=Math.cos(e.th),stt=Math.sin(e.th),x2=-e.a*Math.cos(t),y2=-e.b*Math.sin(t),d2=[x2*ctt-y2*stt,x2*stt+y2*ctt];
    const f=ex*d1[0]+ey*d1[1],fp=d1[0]*d1[0]+d1[1]*d1[1]+ex*d2[0]+ey*d2[1];if(Math.abs(fp)<1e-9)break;const step=f/fp;t-=step;if(Math.abs(step)<1e-7)break;}
  return t;}
function ellProject(e,p){return ellPoint(e,ellParam(e,p));}
function ellDist(e,p){const q=ellProject(e,p);return Math.hypot(q[0]-p[0],q[1]-p[1]);}
// (signed: inside the ellipse below zero, outside above; about a distance near the curve)
function ellSide(e,p){const ct=Math.cos(e.th),st=Math.sin(e.th),dx=p[0]-e.c[0],dy=p[1]-e.c[1];
  const u=(dx*ct+dy*st)/e.a,v=(-dx*st+dy*ct)/e.b;return(Math.hypot(u,v)-1)*Math.min(e.a,e.b);}
// (the eigenvectors of a 3x3 matrix, for the algebraic fit: roots of its cubic, then each one's null direction)
function eig3(M){const a=-(M[0][0]+M[1][1]+M[2][2]);
  const b=M[0][0]*M[1][1]-M[0][1]*M[1][0]+M[0][0]*M[2][2]-M[0][2]*M[2][0]+M[1][1]*M[2][2]-M[1][2]*M[2][1];
  const c=-(M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]));
  const roots=[];const p=b-a*a/3,q=2*a*a*a/27-a*b/3+c,D=q*q/4+p*p*p/27;
  if(D>1e-12*Math.max(1,Math.abs(q*q))){const s=Math.sqrt(D),u=Math.cbrt(-q/2+s),v=Math.cbrt(-q/2-s);roots.push(u+v-a/3);}
  else{const r=Math.sqrt(Math.max(0,-p/3)),ph=Math.acos(Math.max(-1,Math.min(1,r>1e-12?-q/(2*r*r*r):0)));for(let k=0;k<3;k++)roots.push(2*r*Math.cos((ph+2*Math.PI*k)/3)-a/3);}
  const out=[];for(const L of roots){const A=M.map((row,i)=>row.map((v,j)=>v-(i===j?L:0)));
    const cr=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
    const cs=[cr(A[0],A[1]),cr(A[0],A[2]),cr(A[1],A[2])];let best=cs[0],bn=0;for(const v of cs){const n=Math.hypot(...v);if(n>bn){bn=n;best=v;}}
    if(bn>1e-30)out.push(best.map(v=>v/bn));}
  return out;}
function fitEllipse(P){const n=P.length;if(n<8)return null;
  // (centred and scaled first, so the sums stay well sized)
  let mx=0,my=0;for(const p of P){mx+=p[0];my+=p[1];}mx/=n;my/=n;let sc=0;for(const p of P)sc+=Math.hypot(p[0]-mx,p[1]-my);sc=sc/n||1;
  const S1=[[0,0,0],[0,0,0],[0,0,0]],S2=[[0,0,0],[0,0,0],[0,0,0]],S3=[[0,0,0],[0,0,0],[0,0,0]];
  for(const p of P){const x=(p[0]-mx)/sc,y=(p[1]-my)/sc,d1=[x*x,x*y,y*y],d2=[x,y,1];
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){S1[i][j]+=d1[i]*d1[j];S2[i][j]+=d1[i]*d2[j];S3[i][j]+=d2[i]*d2[j];}}
  const inv3=A=>{const[a,b,c]=A[0],[d,e,f]=A[1],[g,h,i]=A[2];const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-18)return null;
    return[[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det],[(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det],[(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]];};
  const mul=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
  const tr=A=>[0,1,2].map(i=>[A[0][i],A[1][i],A[2][i]]);
  const S3i=inv3(S3);if(!S3i)return null;const T=mul(S3i,tr(S2)).map(r=>r.map(v=>-v));
  const Mr=S1.map((r,i)=>r.map((v,j)=>v+mul(S2,T)[i][j]));
  const M=[Mr[2].map(v=>v/2),Mr[1].map(v=>-v),Mr[0].map(v=>v/2)];
  let a1=null;for(const v of eig3(M)){if(4*v[0]*v[2]-v[1]*v[1]>0){a1=v;break;}}if(!a1)return null;
  const a2=[0,1,2].map(i=>T[i][0]*a1[0]+T[i][1]*a1[1]+T[i][2]*a1[2]);
  const[A,B,C]=a1,[D,E,F]=a2;const den=B*B-4*A*C;if(den>=0)return null;
  const x0=(2*C*D-B*E)/den,y0=(2*A*E-B*D)/den;const k=A*x0*x0+B*x0*y0+C*y0*y0+D*x0+E*y0+F;
  const th=0.5*Math.atan2(B,A-C),cth=Math.cos(th),sth=Math.sin(th);
  const Ap=A*cth*cth+B*cth*sth+C*sth*sth,Cp=A*sth*sth-B*cth*sth+C*cth*cth;
  if(-k/Ap<=0||-k/Cp<=0)return null;
  let e={type:'ellipse',c:[mx+sc*x0,my+sc*y0],a:sc*Math.sqrt(-k/Ap),b:sc*Math.sqrt(-k/Cp),th};
  if(!isFinite(e.a)||!isFinite(e.b)||!isFinite(e.c[0]))return null;
  // (then nudged to the least squared distance from the points: a few Gauss-Newton steps on centre, axes and turn)
  const Ps=P.length>600?P.filter((_,i)=>i%Math.ceil(P.length/600)===0):P;
  const res=f=>Ps.map(p=>ellSide(f,p));
  for(let it=0;it<6;it++){const r0=res(e),par=[e.c[0],e.c[1],e.a,e.b,e.th],J=[];
    for(let k2=0;k2<5;k2++){const h=k2===4?1e-4:Math.max(1e-3,1e-4*e.a);const q=par.slice();q[k2]+=h;
      const f={type:'ellipse',c:[q[0],q[1]],a:q[2],b:q[3],th:q[4]};J.push(res(f).map((v,i)=>(v-r0[i])/h));}
    const N=[...Array(5)].map(()=>Array(5).fill(0)),g=Array(5).fill(0);
    for(let i=0;i<r0.length;i++)for(let p1=0;p1<5;p1++){g[p1]+=J[p1][i]*r0[i];for(let p2=0;p2<5;p2++)N[p1][p2]+=J[p1][i]*J[p2][i];}
    for(let p1=0;p1<5;p1++)N[p1][p1]*=1.0001;
    // (5x5 solve by elimination)
    const Aug=N.map((r,i)=>[...r,g[i]]);let ok=true;
    for(let c=0;c<5;c++){let pv=c;for(let r=c+1;r<5;r++)if(Math.abs(Aug[r][c])>Math.abs(Aug[pv][c]))pv=r;if(Math.abs(Aug[pv][c])<1e-14){ok=false;break;}
      [Aug[c],Aug[pv]]=[Aug[pv],Aug[c]];for(let r=0;r<5;r++){if(r===c)continue;const f=Aug[r][c]/Aug[c][c];for(let k3=c;k3<6;k3++)Aug[r][k3]-=f*Aug[c][k3];}}
    if(!ok)break;const st=Aug.map((r,i)=>r[5]/r[i]);if(!st.every(isFinite))break;
    const f={type:'ellipse',c:[par[0]-st[0],par[1]-st[1]],a:par[2]-st[2],b:par[3]-st[3],th:par[4]-st[4]};
    if(!(f.a>0&&f.b>0))break;const s0=r0.reduce((s,v)=>s+v*v,0),s1=res(f).reduce((s,v)=>s+v*v,0);if(s1>s0)break;e=f;}
  let dev=0,ss=0;for(const p of P){const d=ellDist(e,p);dev=Math.max(dev,d);ss+=d*d;}e.dev=dev;e.rms=Math.sqrt(ss/P.length);
  return e;}
// (how far round the ellipse a set of points reaches, in degrees: the largest gap left uncovered taken off a full turn)
function ellCover(e,P){const ts=P.map(p=>{let t=ellParam(e,p)%(2*Math.PI);if(t<0)t+=2*Math.PI;return t;}).sort((x,y)=>x-y);if(ts.length<2)return 0;
  let gap=ts[0]+2*Math.PI-ts[ts.length-1];for(let i=1;i<ts.length;i++)gap=Math.max(gap,ts[i]-ts[i-1]);return 360-gap*180/Math.PI;}
// (where an ellipse crosses another shape: walk round it and look for the other shape's side changing)
function shapeSide(pr,p){if(pr.type==='line')return(p[0]-pr.c[0])*pr.n[0]+(p[1]-pr.c[1])*pr.n[1];
  if(pr.type==='circle')return Math.hypot(p[0]-pr.c[0],p[1]-pr.c[1])-pr.r;return ellSide(pr,p);}
function ellCross(E,O){const out=[],n=1440,f=t=>shapeSide(O,ellPoint(E,t));let t0=0,f0=f(0);
  for(let i=1;i<=n;i++){const t1=2*Math.PI*i/n,f1=f(t1);if(f0===0)out.push(ellPoint(E,t0));else if(f0*f1<0){let lo=t0,hi=t1,flo=f0;
      for(let k=0;k<40;k++){const m=(lo+hi)/2,fm=f(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}out.push(ellPoint(E,(lo+hi)/2));}
    t0=t1;f0=f1;}
  return out;}
