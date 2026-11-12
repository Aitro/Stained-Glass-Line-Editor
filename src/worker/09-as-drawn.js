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
  for(const P of loops)strokes.push(ease(P));
  return{strokes,fillets:[],junctions:[],rot:0};}
