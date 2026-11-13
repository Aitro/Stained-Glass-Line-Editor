// Change width only: the lines exactly as drawn, just redrawn at one width.
// ------------------------------------------------------------------------------------------------
// The middle of every line is followed pixel by pixel and kept where it is: no curve smoothing beyond taking out
// the pixel staircase, no joints rebuilt, nothing made exactly straight or round, the panel not squared up. Only
// tiny bumps (a branch shorter than about four line widths ending in nothing, which is a speck or a burr on the
// ink, not a line) are left out, and a loose end is carried on to where the ink ended, so short lines keep their
// length at the new width.
function traceAsDrawn(sk,u,dmap,p){
  const N8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const nb=i=>{const y=(i/W)|0,x=i%W,o=[];for(const[dy,dx]of N8){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<H&&xx>=0&&xx<W&&sk[yy*W+xx])o.push(yy*W+xx);}return o;};
  const cnt=new Uint8Array(W*H),node=new Uint8Array(W*H);for(let i=0;i<W*H;i++)if(sk[i]){cnt[i]=nb(i).length;if(cnt[i]!==2)node[i]=1;}
  // (joints: touching joint pixels are one joint, at their middle)
  const lab=new Int32Array(W*H),cent=[null],free=new Set();
  {let nl=0;const st=[];for(let i=0;i<W*H;i++){if(!node[i]||lab[i])continue;nl++;let sy=0,sx=0,n=0,loose=false;st.push(i);lab[i]=nl;
    while(st.length){const k=st.pop();sy+=(k/W)|0;sx+=k%W;n++;if(cnt[k]<=1)loose=true;for(const j of nb(k))if(node[j]&&!lab[j]){lab[j]=nl;st.push(j);}}
    cent.push([sy/n,sx/n]);if(loose)free.add(nl);}}
  // (the lines between joints, and closed loops with none)
  const seen=new Uint8Array(W*H),pt=i=>[(i/W)|0,i%W];let ch=[];const links=new Set();
  for(let p0=0;p0<W*H;p0++){if(!node[p0])continue;const a=lab[p0];
    for(const q of nb(p0)){
      if(node[q]){const b=lab[q];const key=Math.min(a,b)+'-'+Math.max(a,b);if(b!==a&&!links.has(key)){links.add(key);ch.push({P:[cent[a].slice(),cent[b].slice()],a,b});}continue;}
      if(seen[q])continue;const P=[cent[a].slice()];let prev=p0,cur=q,end=null;
      for(;;){seen[cur]=1;P.push(pt(cur));const ns=nb(cur),nodes=ns.filter(n=>node[n]&&n!==prev),nxt=ns.filter(n=>n!==prev&&!seen[n]&&!node[n]);
        if(nodes.length&&(P.length>2||lab[nodes[0]]!==a||!nxt.length)){end=lab[nodes[0]];P.push(cent[end].slice());break;}
        if(!nxt.length)break;prev=cur;cur=nxt[0];}
      ch.push({P,a,b:end});}}
  const loops=[];for(let p0=0;p0<W*H;p0++){if(!sk[p0]||seen[p0]||node[p0])continue;const P=[];let prev=-1,cur=p0;
    for(;;){seen[cur]=1;P.push(pt(cur));const nxt=nb(cur).filter(n=>n!==prev&&!seen[n]);if(!nxt.length)break;prev=cur;cur=nxt[0];}if(P.length>3){P.push(P[0].slice());loops.push(P);}}
  const len=P=>{let L=0;for(let i=1;i<P.length;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return L;};
  // (burrs: short branches ending in nothing; taken off a few times over, as taking one off can leave another)
  for(let pass=0;pass<3;pass++){const deg=new Map();for(const c of ch)for(const k of[c.a,c.b])if(k!=null)deg.set(k,(deg.get(k)||0)+1);
    const before=ch.length;ch=ch.filter(c=>{const looseEnd=c.b==null||(free.has(c.a)&&deg.get(c.a)===1)||(free.has(c.b)&&deg.get(c.b)===1);
      const other=c.b==null?deg.get(c.a):Math.max(deg.get(c.a)||0,deg.get(c.b)||0);return!(looseEnd&&other>1&&len(c.P)<4*u);});
    if(ch.length===before)break;}
  // (two lines meeting at a joint with nothing else there are one line)
  for(let guard=0;guard<ch.length*2;guard++){const deg=new Map();ch.forEach((c,i)=>{for(const k of[c.a,c.b])if(k!=null){if(!deg.has(k))deg.set(k,[]);deg.get(k).push(i);}});
    let done=true;for(const[k,L]of deg){if(L.length!==2||L[0]===L[1])continue;const[i,j]=L,A=ch[i],B=ch[j];
      const a=A.b===k?A.P:A.P.slice().reverse(),b=B.a===k?B.P:B.P.slice().reverse(),ea=A.b===k?A.a:A.b,eb=B.a===k?B.b:B.a;
      ch[i]={P:a.concat(b.slice(1)),a:ea,b:eb};ch.splice(j,1);done=false;break;}
    if(done)break;}
  // (joints: where thick ink meets, the middle of the ink curves in toward the blob's center, which would show
  // as a hook on each line once the lead is thinner. Each line keeps its own direction from outside the blob
  // straight in, and the lines meet at the one point closest to all of them)
  {const rAt0=q=>{let mx=0;const yy=Math.round(q[0]),xx=Math.round(q[1]);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const y=yy+dy,x=xx+dx;if(y>=0&&x>=0&&y<H&&x<W)mx=Math.max(mx,dmap[y*W+x]);}return mx;};
    const deg=new Map();for(const c of ch)for(const k of[c.a,c.b])if(k!=null)deg.set(k,(deg.get(k)||0)+1);
    // (how thick a plain line is here: the middle of the ink's half-widths along all the lines)
    const rs=[];for(const c of ch)for(let i=0;i<c.P.length;i+=4){const q=c.P[i];rs.push(dmap[Math.round(q[0])*W+Math.round(q[1])]||0);}rs.sort((x,y)=>x-y);const rLine=Math.max(1,rs[rs.length>>1]||u);
    // (a line has left the joint's blob once the ink round it is back to a plain line's thickness; where lines
    // meet at a shallow angle they run side by side a long way first)
    // (judged against the line's own thickness, so a thick border is not mistaken for a blob)
    const rOwn=P=>{const v=[];for(let i=0;i<P.length;i+=3){const q=P[i];v.push(dmap[Math.round(q[0])*W+Math.round(q[1])]||0);}v.sort((x,y)=>x-y);return Math.max(1,v[v.length>>1]||rLine);};
    const outOf=(P,C)=>{const r0=rAt0(C),Rmin=Math.max(1.5,1.25*r0),Rmax=Math.max(Rmin,8*r0),rl=rOwn(P);let i=1;
      while(i<P.length-1){const d=Math.hypot(P[i][0]-C[0],P[i][1]-C[1]);if(d>=Rmax)break;if(d>=Rmin&&rAt0(P[i])<=1.2*rl)break;i++;}return i;};
    const ends=new Map(),cut=[];   // (per joint: each line's end — where it leaves the blob and which way it points in)
    ch.forEach((c,ci)=>{cut[ci]={a:0,b:c.P.length-1};
      for(const side of['a','b']){const k=c[side];if(k==null||(deg.get(k)||0)<3)continue;const C=cent[k],R=Math.max(1.5,1.25*rAt0(C));
        const P=side==='a'?c.P:c.P.slice().reverse();const i=outOf(P,C);
        if(i>=P.length-1){continue;}let j=i,L=0;while(j<P.length-1&&L<2*u){L+=Math.hypot(P[j+1][0]-P[j][0],P[j+1][1]-P[j][1]);j++;}
        const t=[P[i][0]-P[j][0],P[i][1]-P[j][1]],tl=Math.hypot(t[0],t[1]);if(tl<1e-6)continue;
        if(!ends.has(k))ends.set(k,[]);ends.get(k).push({q:P[i],t:[t[0]/tl,t[1]/tl]});cut[ci][side]=side==='a'?i:c.P.length-1-i;}});
    const J=new Map();for(const[k,E]of ends){const C=cent[k];if(E.length<2){J.set(k,C);continue;}
      // (least squares: the point with the smallest total squared distance to the lines' straight-on paths)
      // (two lines meeting head on are one line running through: the joint goes on it, so it gets the most say)
      const wt=E.map((e,i)=>E.some((f,j)=>j!==i&&e.t[0]*f.t[0]+e.t[1]*f.t[1]<-0.94)?12:1);
      let a=0,b=0,d=0,e0=0,e1=0;E.forEach(({q,t},i)=>{const w=wt[i],m00=w*(1-t[0]*t[0]),m01=-w*t[0]*t[1],m11=w*(1-t[1]*t[1]);a+=m00;b+=m01;d+=m11;e0+=m00*q[0]+m01*q[1];e1+=m01*q[0]+m11*q[1];});
      const det=a*d-b*b;let p=C;if(Math.abs(det)>1e-3){p=[(d*e0-b*e1)/det,(a*e1-b*e0)/det];}
      const R=Math.max(1.5,1.25*rAt0(C)),far=Math.max(...E.map(({q})=>Math.hypot(q[0]-C[0],q[1]-C[1])));const lim=Math.max(1.5*R,1.1*far),dd=Math.hypot(p[0]-C[0],p[1]-C[1]);
      // (no further out than the farthest place a line leaves the blob: beyond that it is pulled back in, toward the blob)
      if(!isFinite(p[0]))p=C;else if(dd>lim)p=[C[0]+(p[0]-C[0])*lim/dd,C[1]+(p[1]-C[1])*lim/dd];
      // (and never outside the ink: walked back toward the blob's middle until it is well inside the line)
      const inInk=q=>{const y=Math.round(q[0]),x=Math.round(q[1]);return y>=0&&x>=0&&y<H&&x<W&&dmap[y*W+x]>=0.5*rLine;};
      for(let t=1;t<=20&&!inInk(p);t++){const f=1-t/20;p=[C[0]+(p[0]-C[0])*f,C[1]+(p[1]-C[1])*f];}
      J.set(k,p);}
    ch.forEach((c,ci)=>{const{a,b}=cut[ci];if(a===0&&b===c.P.length-1)return;const mid=c.P.slice(a,b+1);
      const A=c.a!=null&&a>0?[(J.get(c.a)||cent[c.a]).slice()]:[],B=c.b!=null&&b<c.P.length-1?[(J.get(c.b)||cent[c.b]).slice()]:[];c.P=A.concat(mid,B);});
    // (a line too short to leave either blob runs straight between its two joints' points)
    ch.forEach(c=>{if(c.a!=null&&c.b!=null&&J.has(c.a)&&J.has(c.b)&&c.P.length<=2)c.P=[J.get(c.a).slice(),J.get(c.b).slice()];
      else{if(c.a!=null&&J.has(c.a))c.P[0]=J.get(c.a).slice();if(c.b!=null&&J.has(c.b))c.P[c.P.length-1]=J.get(c.b).slice();}});}
  // (straight pieces filled in with points a pixel apart, like the rest of the line)
  for(const c of ch){const out=[c.P[0]];for(let i=1;i<c.P.length;i++){const A=c.P[i-1],B=c.P[i],n=Math.floor(Math.hypot(B[0]-A[0],B[1]-A[1]));
      for(let k=1;k<n;k++)out.push([A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n]);out.push(B);}c.P=out;}
  // (the pixel staircase taken out: each point averaged with its near neighbors, the ends held still)
  const ease=P=>{const closed=P.length>3&&Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<0.5;let Q=P.map(q=>q.slice());const n=Q.length,R=2;
    for(let pass=0;pass<2;pass++){const T=Q.map(q=>q.slice());for(let i=0;i<n;i++){if(!closed&&(i===0||i===n-1))continue;let sy=0,sx=0,w=0;
        for(let k=-R;k<=R;k++){let j=i+k;if(closed){j=((j%(n-1))+(n-1))%(n-1);}else if(j<0||j>=n)continue;const ww=R+1-Math.abs(k);sy+=ww*Q[j][0];sx+=ww*Q[j][1];w+=ww;}
        T[i]=[sy/w,sx/w];}if(closed)T[n-1]=T[0].slice();Q=T;}return Q;};
  // (a loose end carried on to where the ink ended, less the new lead's own round end)
  const rNew=Math.max(0.5,+p.newHalf||u),rAt=q=>{let mx=0;const yy=Math.round(q[0]),xx=Math.round(q[1]);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const y=yy+dy,x=xx+dx;if(y>=0&&x>=0&&y<H&&x<W)mx=Math.max(mx,dmap[y*W+x]);}return mx;};
  const reach=(P,atStart)=>{if(P.length<3)return;const e=atStart?0:P.length-1,dir=atStart?1:-1;let k=e,L=0;while(k+dir>=0&&k+dir<P.length&&L<2*u){L+=Math.hypot(P[k+dir][0]-P[k][0],P[k+dir][1]-P[k][1]);k+=dir;}
    const dy=P[e][0]-P[k][0],dx=P[e][1]-P[k][1],dl=Math.hypot(dy,dx);if(dl<1e-6)return;const ext=Math.max(-0.8*dl,rAt(P[e])-rNew);P[e]=[P[e][0]+dy/dl*ext,P[e][1]+dx/dl*ext];};
  const deg=new Map();for(const c of ch)for(const k of[c.a,c.b])if(k!=null)deg.set(k,(deg.get(k)||0)+1);
  const strokes=[];for(const c of ch){const Q=ease(c.P);if(c.b==null||(free.has(c.b)&&deg.get(c.b)===1))reach(Q,false);if(free.has(c.a)&&deg.get(c.a)===1)reach(Q,true);strokes.push(Q);}
  // (two loose ends facing each other across a hairline gap, a break in the scan rather than in the drawing, are
  // joined: lead with a gap in it would let two pieces run together)
  const ends=[];strokes.forEach((Q,s)=>{if(Q.length<3)return;const looseA=free.has(ch[s]&&ch[s].a)&&deg.get(ch[s].a)===1,looseB=ch[s]&&(ch[s].b==null||(free.has(ch[s].b)&&deg.get(ch[s].b)===1));
    for(const[at,ok]of[[0,looseA],[Q.length-1,looseB]]){if(!ok)continue;const dir=at===0?1:-1;let k=at,L=0;while(k+dir>=0&&k+dir<Q.length&&L<2*u){L+=Math.hypot(Q[k+dir][0]-Q[k][0],Q[k+dir][1]-Q[k][1]);k+=dir;}
      const dy=Q[at][0]-Q[k][0],dx=Q[at][1]-Q[k][1],dl=Math.hypot(dy,dx);if(dl>1e-6)ends.push({p:Q[at],out:[dy/dl,dx/dl]});}});
  const used=new Set();
  for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++){if(used.has(a)||used.has(b))continue;const A=ends[a],B=ends[b],v=[B.p[0]-A.p[0],B.p[1]-A.p[1]],dl=Math.hypot(v[0],v[1]);
    if(dl>2.5*u)continue;if(A.out[0]*B.out[0]+A.out[1]*B.out[1]>-Math.cos(35*Math.PI/180))continue;
    if(dl>0.5&&(v[0]*A.out[0]+v[1]*A.out[1])/dl<Math.cos(45*Math.PI/180))continue;
    strokes.push([A.p.slice(),B.p.slice()]);used.add(a);used.add(b);}
  // (a loose end that stops a hairline short of another line, straight ahead of it, is carried on to meet it)
  {const cell=4,G=new Map(),key=(y,x)=>((y/cell)|0)+','+((x/cell)|0);
    strokes.forEach((Q,s)=>Q.forEach((q,k)=>{const kk=key(q[0],q[1]);if(!G.has(kk))G.set(kk,[]);G.get(kk).push([s,k]);}));
    ends.forEach((E,n)=>{if(used.has(n))return;const s=strokes.findIndex(Q=>Q.length&&(Q[0]===E.p||Q[Q.length-1]===E.p));
      for(let t=1;t<=2.5*u;t+=0.5){const y=E.p[0]+E.out[0]*t,x=E.p[1]+E.out[1]*t;let hit=null;
        for(const[t2,k]of G.get(key(y,x))||[]){if(t2===s)continue;const q=strokes[t2][k];if(Math.hypot(q[0]-y,q[1]-x)<1.5){hit=q;break;}}
        if(hit){strokes.push([E.p.slice(),hit.slice()]);break;}}});}
  for(const P of loops)strokes.push(ease(P));
  return{strokes,fillets:[],junctions:[],rot:0};}
