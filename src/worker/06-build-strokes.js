// The heart of the program: turn the skeleton into lines and junctions, decide which lines carry on
// through each junction and which land on another line, fit exact straight lines and circles, and
// draw every line as a smooth stroke. Sections inside are marked with comments.
// ------------------------------------------------------------------------------------------------
function buildStrokes(sk,u,med,dmap,strength,say,opt){opt=opt||{exact:true,square:true};
  // the user's own fixes: [{y,x,mode,arms}] in working pixels; mode is 'corner', 'round', 'pair' or 'apart'
  const FIX=Array.isArray(opt.fixes)?opt.fixes.filter(f=>f&&isFinite(f.y)&&isFinite(f.x)):[];let frame=0;
  // ---- trace graph
  const N8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const nb=i=>{const y=(i/W)|0,x=i%W,o=[];for(const[dy,dx]of N8){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<H&&xx>=0&&xx<W&&sk[yy*W+xx])o.push(yy*W+xx);}return o;};
  const cnt=new Uint8Array(W*H),node=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)if(sk[i]){cnt[i]=nb(i).length;if(cnt[i]!==2)node[i]=1;}
  const lab=new Int32Array(W*H);const cent=[null];const freeL=new Set();
  {let nl=0;const st=[];for(let i=0;i<W*H;i++){if(!node[i]||lab[i])continue;nl++;let sy=0,sx=0,n=0;st.push(i);lab[i]=nl;
    while(st.length){const k=st.pop();sy+=(k/W)|0;sx+=k%W;n++;if(cnt[k]<=1)freeL.add(nl);for(const j of nb(k))if(node[j]&&!lab[j]){lab[j]=nl;st.push(j);}}
    cent.push([sy/n,sx/n]);}}
  const seen=new Uint8Array(W*H);let edges=[];const links=new Set();
  const pt=i=>[(i/W)|0,i%W];
  for(let p=0;p<W*H;p++){if(!node[p])continue;const a=lab[p];
    for(const q of nb(p)){
      if(node[q]){const b=lab[q];const key=Math.min(a,b)+'-'+Math.max(a,b);if(b!==a&&!links.has(key)){links.add(key);edges.push({P:[cent[a].slice(),cent[b].slice()],a,e:b,closed:false});}continue;}
      if(seen[q])continue;
      const pts=[cent[a].slice()];let prev=p,cur=q,end=null;
      while(true){seen[cur]=1;pts.push(pt(cur));const ns=nb(cur);
        const nodes=ns.filter(n=>node[n]&&n!==prev),nxt=ns.filter(n=>n!==prev&&!seen[n]&&!node[n]);
        if(nodes.length&&(pts.length>2||lab[nodes[0]]!==a||!nxt.length)){end=lab[nodes[0]];pts.push(cent[end].slice());break;}
        if(!nxt.length)break;prev=cur;cur=nxt[0];}
      edges.push({P:pts,a,e:end,closed:false});}}
  for(let p=0;p<W*H;p++){if(!sk[p]||seen[p]||node[p])continue;const pts=[];let prev=-1,cur=p;
    while(true){seen[cur]=1;pts.push(pt(cur));const nxt=nb(cur).filter(n=>n!==prev&&!seen[n]);if(!nxt.length)break;prev=cur;cur=nxt[0];}
    if(pts.length>3)edges.push({P:pts,a:null,e:null,closed:true});}

  say('Rebuilding junctions…');
  const Dt=2*u,GAP=0.02,PIN=1e6;
  const clearFrom=(P,L,side)=>{const tot=L[L.length-1];let best=-1;
    for(let i=0;i<P.length;i++){const yy=Math.min(H-1,Math.max(0,Math.round(P[i][0]))),xx=Math.min(W-1,Math.max(0,Math.round(P[i][1])));
      const th=2*dmap[yy*W+xx]-1,dist=side===0?L[i]:tot-L[i];if(th>1.3*med&&dist<0.4*tot&&dist>best)best=dist;}
    return best>=0?best+u:0;};
  for(const E of edges){E.L=arclen(E.P);E.clr=[clearFrom(E.P,E.L,0),clearFrom(E.P,E.L,1)];}
  const isFreeLab=k=>freeL.has(k);
  // a short branch with a free end is scan noise (a bump or speck on a line); real dead-end
  // lines in a pattern are much longer than ~3 line widths
  edges=edges.filter(E=>E.closed||!((isFreeLab(E.a)||isFreeLab(E.e)||E.e==null)&&E.L[E.L.length-1]<5*u));
  const parent=new Map();cent.forEach((c,k)=>{if(k)parent.set(k,k);});
  const find=k=>{while(parent.get(k)!==k){parent.set(k,parent.get(parent.get(k)));k=parent.get(k);}return k;};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
  // (except the rung of an H: two lines running past each other that touch, the short link running straight across
  // both of them; they stay two lines that touch, rather than becoming one crossing)
  const isRung=(()=>{const at0=new Map();edges.forEach((E,i)=>{if(E.closed)return;[[0,E.a],[1,E.e]].forEach(([s,k])=>{if(k!=null){if(!at0.has(k))at0.set(k,[]);at0.get(k).push([i,s]);}});});
    return E=>{const i=edges.indexOf(E),la=(at0.get(E.a)||[]).filter(([j])=>j!==i),lb=(at0.get(E.e)||[]).filter(([j])=>j!==i);if(la.length!==2||lb.length!==2)return false;
      const P=E.P,lk=[P[P.length-1][0]-P[0][0],P[P.length-1][1]-P[0][1]],ln=Math.hypot(lk[0],lk[1]);if(ln<0.5*med)return false;const k=[lk[0]/ln,lk[1]/ln];
      const ok=L=>{const d=L.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]);if(angDeg(d[0],d[1])<140)return false;
        return d.every(v=>Math.abs(v[0]*k[0]+v[1]*k[1])<Math.cos(55*Math.PI/180));};
      return ok(la)&&ok(lb);};})();
  edges=edges.filter(E=>{if(!E.closed&&E.a!=null&&E.e!=null&&E.a!==E.e&&E.L[E.L.length-1]<2.5*u&&!isFreeLab(E.a)&&!isFreeLab(E.e)&&!isRung(E)){union(E.a,E.e);return false;}return true;});
  const incident=()=>{const inc=new Map();edges.forEach((E,i)=>{if(E.closed)return;[[0,E.a],[1,E.e]].forEach(([s,k])=>{if(k!=null){const r=find(k);if(!inc.has(r))inc.set(r,[]);inc.get(r).push([i,s]);}});});return inc;};
  // shallow crossings
  let changed=true;
  while(changed){changed=false;const inc=incident();
    for(let i=0;i<edges.length;i++){const E=edges[i];if(E.closed||E.a==null||E.e==null)continue;
      const A=find(E.a),B=find(E.e);if(A===B||E.L[E.L.length-1]>14*u||(inc.get(A)||[]).length!==3||(inc.get(B)||[]).length!==3)continue;
      const oa=inc.get(A).filter(([j])=>j!==i),ob=inc.get(B).filter(([j])=>j!==i);if(oa.length!==2||ob.length!==2)continue;
      const da=oa.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]),db=ob.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]);
      const neg=v=>[-v[0],-v[1]];
      // the better of the two ways to pair the ends up into two through-lines
      let best=Infinity,bp=0;for(const p of[0,1]){const v=angDeg(neg(da[0]),db[p])+angDeg(neg(da[1]),db[1-p]);if(v<best){best=v;bp=p;}}
      const spread=angDeg(da[0],da[1]);
      // in a real shallow crossing the short shared stretch runs along both lines; a short
      // connector between two separate lines runs across them
      let link=[E.P[E.P.length-1][0]-E.P[0][0],E.P[E.P.length-1][1]-E.P[0][1]];const ln=norm2(link)||1;link=[link[0]/ln,link[1]/ln];
      if(E.a!==undefined&&find(E.a)!==A)link=[-link[0],-link[1]];
      const along=Math.max(angDeg(neg(da[0]),link),angDeg(neg(da[1]),link),angDeg(link,db[bp]),angDeg(link,db[1-bp]));
      // and the ink along that stretch is doubled up (two lines overlapping side by side); if it is
      // only one line wide, the two lines run together there (shared lead) and stay two joints
      const thk=E.P.map(q=>{const yy=Math.round(q[0]),xx=Math.round(q[1]);return(yy>=0&&xx>=0&&yy<H&&xx<W)?(2*dmap[yy*W+xx]-1)/med:0;});
      const mid=thk.slice(Math.floor(thk.length*.2),Math.ceil(thk.length*.8)).sort((p,q)=>p-q);
      const doubled=mid.length>0&&mid[0]>=1.2&&mid[mid.length>>1]>=1.3;
      const pairDev=Math.max(angDeg(neg(da[0]),db[bp]),angDeg(neg(da[1]),db[1-bp]));   // both lines must run straight through
      if(best<60&&pairDev<=20&&spread>8&&along<60&&doubled){union(A,B);edges.splice(i,1);changed=true;break;}}}
  // a V whose tip sits on another line through a very short stub (the two sides of a petal meeting
  // right at the line): the sides meet the line itself, at one point
  {const inc0=incident();
    for(let i=edges.length-1;i>=0;i--){const E=edges[i];if(E.closed||E.a==null||E.e==null)continue;const tot=E.L[E.L.length-1];if(tot>3.5*med)continue;
      const A=find(E.a),B=find(E.e);if(A===B)continue;const la=inc0.get(A)||[],lb=inc0.get(B)||[];if(la.length!==3||lb.length!==3)continue;
      const test=(lv,sv,lt,st)=>{const ov=lv.filter(([j])=>j!==i),ot=lt.filter(([j])=>j!==i);if(ov.length!==2||ot.length!==2)return false;
        const dv=ov.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]),dt=ot.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]);
        const dl=endDir(E.P,sv,u,E.L)[1];
        return angDeg(dv[0],dv[1])<70&&dv.every(d=>angDeg(d,dl)>=110)&&angDeg(dt[0],dt[1])>=160;};
      // only where the stub is the two sides' ink run together (wider than one line all along), not a
      // real short line of its own
      const thk=E.P.map(q=>{const yy=Math.round(q[0]),xx=Math.round(q[1]);return(yy>=0&&xx>=0&&yy<H&&xx<W)?(2*dmap[yy*W+xx]-1)/med:0;});
      const midT=thk.slice(Math.floor(thk.length*.2),Math.ceil(thk.length*.8));if(!midT.length||Math.min(...midT)<1.25)continue;
      if(test(lb,1,la,0)||test(la,0,lb,1)){union(A,B);edges.splice(i,1);}}}
  // two loose ends that face each other across a small gap (a break in the ink, such as a scan that lost
  // a bit of the border) are one line: join them
  {const inc0=incident();const fr=[];inc0.forEach((lst,k)=>{if(lst.length===1&&[...freeL].some(l=>find(l)===k)){const[j,s]=lst[0];const E=edges[j];if(E.closed)return;
      const d=endDir(E.P,s,u,E.L)[1];fr.push({k,p:s===0?E.P[0]:E.P[E.P.length-1],out:[-d[0],-d[1]],j});}});
    const used=new Set();
    for(let a=0;a<fr.length;a++)for(let b=a+1;b<fr.length;b++){const A=fr[a],B=fr[b];if(used.has(A.k)||used.has(B.k))continue;
      const v=[B.p[0]-A.p[0],B.p[1]-A.p[1]],dl=Math.hypot(v[0],v[1]);if(dl<1||dl>2*med)continue;const vn=[v[0]/dl,v[1]/dl];
      // (they run toward each other, and sit no more than a line width apart sideways)
      if(angDeg(A.out,[-B.out[0],-B.out[1]])>30)continue;const along=v[0]*A.out[0]+v[1]*A.out[1],side=Math.abs(v[0]*A.out[1]-v[1]*A.out[0]);
      if(along<-0.5*med||side>1.0*med)continue;
      used.add(A.k);used.add(B.k);for(const l of[...freeL])if(find(l)===A.k||find(l)===B.k)freeL.delete(l);union(A.k,B.k);}}
  // two junctions joined by a tiny thick link, where a long straight line runs in at one and carries on
  // straight out of the other (a wedge of ink where lines branch off a straight line), are one junction
  {const fitL=(j,s)=>{const E=edges[j],tot=E.L[E.L.length-1];if(E.closed||tot<16*med)return null;const t1=Math.min(tot-2*med,30*med),pts=[];
      for(let t=8*med;t<=t1;t+=Math.max(1,u))pts.push(at(E.P,s===0?t:tot-t,E.L));const A=pts[0],B=pts[pts.length-1],ab=[B[0]-A[0],B[1]-A[1]],l=Math.hypot(ab[0],ab[1]);
      if(l<4*med||!pts.every(q=>Math.abs((q[0]-A[0])*ab[1]-(q[1]-A[1])*ab[0])/l<0.3*med))return null;return{A,d:[ab[0]/l,ab[1]/l],pts};};
    const inc0=incident();
    for(let i=edges.length-1;i>=0;i--){const E=edges[i];if(E.closed||E.a==null||E.e==null)continue;const tot=E.L[E.L.length-1];if(tot>2*med)continue;
      const A=find(E.a),B=find(E.e);if(A===B)continue;const la=(inc0.get(A)||[]).filter(([j])=>j!==i),lb=(inc0.get(B)||[]).filter(([j])=>j!==i);if(la.length<2||lb.length<2)continue;
      const thk=E.P.map(q=>{const yy=Math.round(q[0]),xx=Math.round(q[1]);return(yy>=0&&xx>=0&&yy<H&&xx<W)?(2*dmap[yy*W+xx]-1)/med:0;});
      if(!thk.length||Math.min(...thk)<1.2)continue;
      // (the straight line may run in and out at one of the two, with the lines branching off at the other)
      const col=(ja,sa,jb,sb)=>{const fa=fitL(ja,sa),fb=fitL(jb,sb);if(!fa||!fb)return false;if(-(fa.d[0]*fb.d[0]+fa.d[1]*fb.d[1])<Math.cos(12*Math.PI/180))return false;
        let s2=0;for(const q of fb.pts)s2+=Math.abs((q[0]-fa.A[0])*fa.d[1]-(q[1]-fa.A[1])*fa.d[0]);return s2/fb.pts.length<0.3*med;};
      let ok=false;for(const L of[la,lb])for(let x=0;x<L.length;x++)for(let y=x+1;y<L.length;y++)if(col(L[x][0],L[x][1],L[y][0],L[y][1]))ok=true;
      for(const[ja,sa]of la){const fa=fitL(ja,sa);if(!fa)continue;for(const[jb,sb]of lb){const fb=fitL(jb,sb);if(!fb)continue;
          if(-(fa.d[0]*fb.d[0]+fa.d[1]*fb.d[1])<Math.cos(12*Math.PI/180))continue;let s2=0;for(const q of fb.pts)s2+=Math.abs((q[0]-fa.A[0])*fa.d[1]-(q[1]-fa.A[1])*fa.d[0]);
          if(s2/fb.pts.length<0.3*med)ok=true;}}
      if(ok){union(A,B);edges.splice(i,1);}}}
  const inc=incident();
  const nodePos=new Map();{const acc=new Map();cent.forEach((c,k)=>{if(!k)return;const r=find(k);if(!acc.has(r))acc.set(r,[0,0,0]);const t=acc.get(r);t[0]+=c[0];t[1]+=c[1];t[2]++;});
    acc.forEach((t,r)=>nodePos.set(r,[t[0]/t[2],t[1]/t[2]]));}
  const isFree=new Set([...freeL].map(find));
  // pairing, with overlap-aware directions
  for(const E of edges)E.clr2=[2*u,2*u];
  inc.forEach(lst=>{const d0=lst.map(([j,s])=>endDir(edges[j].P,s,u,edges[j].L)[1]);
    lst.forEach(([j,s],x)=>{let mn=Infinity;lst.forEach((_,y)=>{if(y!==x)mn=Math.min(mn,Math.acos(Math.max(-1,Math.min(1,d0[x][0]*d0[y][0]+d0[x][1]*d0[y][1]))));});
      if(mn<Infinity){const t=Math.max(mn,8*Math.PI/180);edges[j].clr2[s]=Math.max(2*u,Math.min(8*u,0.5*med/Math.sin(t/2)+u));}});});
  const ends=new Map(),partner=new Map();const key=(j,s)=>j*2+s;const wedgeEnds=new Set();
  inc.forEach((lst,k)=>{const info=lst.map(([j,s])=>{const[a,d,cv]=endDir(edges[j].P,s,u,edges[j].L,edges[j].clr2[s]);const db=endDir(edges[j].P,s,u,edges[j].L,edges[j].clr2[s],true)[1];ends.set(key(j,s),{node:k,anchor:a,dir:d,dirBent:(db[0]!==d[0]||db[1]!==d[1])?db:null,curve:cv,reach:edges[j].clr2[s],len:edges[j].L[edges[j].L.length-1]});return[j,s,a,d];});
    // (and of two lines there that run on parallel, a long straight line carries on into the one that lies
    // on its own extension, not the one beside it)
    const forced=[];
    if(lst.length>=3){
      // (a long border line cut short by another junction just beyond, where a third line branches off it, is
      // followed on through up to three junctions into each piece that roughly carries on: which of them really
      // continues it is settled below, by which lines up with the line on the other side)
      const dir=(Q,LQ,a,b)=>{const p=at(Q,a,LQ),q=at(Q,b,LQ),n=Math.hypot(q[0]-p[0],q[1]-p[1])||1;return[(q[0]-p[0])/n,(q[1]-p[1])/n];};
      const paths=it=>{const E=edges[it[0]];let P=E.P.map(q=>q.slice());if(it[1]===1)P.reverse();const L=arclen(P),tot0=L[L.length-1];
        if(tot0>=16*med||E.closed)return[{P,L}];const out=[];
        const go=(Z0,fk,from,hops,seen)=>{const LZ0=arclen(Z0),tz=LZ0[LZ0.length-1];
          if(tz>=30*med||hops>=3||fk==null||seen.has(fk)){if(hops&&tz>=40*med)out.push({P:Z0,L:LZ0,from:tot0,hops});return;}
          const dIn=dir(Z0,LZ0,Math.max(0,tz-12*med),tz);let any=false;
          for(const[jj,ss]of inc.get(fk)||[]){if(jj===from)continue;const F=edges[jj];if(F.closed)continue;let R=F.P.map(q=>q.slice());if(ss===1)R.reverse();const LR=arclen(R),tr=LR[LR.length-1];
            if(tr<3*med)continue;const dOut=dir(R,LR,Math.min(tr,1.5*med),Math.min(tr,6*med));if(dIn[0]*dOut[0]+dIn[1]*dOut[1]<Math.cos(15*Math.PI/180))continue;
            any=true;go([...Z0,...R.slice(1)],find(ss===0?F.e:F.a),jj,hops+1,new Set([...seen,fk]));}
          if(!any&&hops&&tz>=40*med)out.push({P:Z0,L:LZ0,from:tot0,hops});};
        go(P,find(it[1]===0?E.e:E.a),it[0],0,new Set([find(k)]));return out.length?out:[{P,L}];};
      const fitL=({P:EP,L:EL,from,hops})=>{const tot=EL[EL.length-1];if(tot<16*med)return null;
        // (followed on through a junction: measured beyond the short piece, which may bend where it starts)
        const t0=from!=null?Math.max(8*med,from+4*med):8*med,t1=Math.min(tot-2*med,t0+22*med),pts=[];
        for(let t=t0;t<=t1;t+=Math.max(1,u))pts.push(at(EP,t,EL));if(pts.length<2)return null;const A=pts[0],B=pts[pts.length-1],ab=[B[0]-A[0],B[1]-A[1]],l=Math.hypot(ab[0],ab[1]);
        if(l<4*med)return null;{const dv=pts.map(q=>Math.abs((q[0]-A[0])*ab[1]-(q[1]-A[1])*ab[0])/l);
          // (followed on through two or more junctions, a ruler-straight line may have a short bulge of ink where another
          // line joins partway)
          const ok=!(hops>=2)?dv.every(e=>e<0.3*med):(Math.max(...dv)<0.8*med&&dv.filter(e=>e>=0.3*med).length<=0.15*dv.length&&dv.filter(e=>e>=0.1*med).length<=0.2*dv.length);if(!ok)return null;}
        return{A,d:[ab[0]/l,ab[1]/l],pts,short:tot<40*med,ext:from!=null,tot};};
      const fl=info.map(it=>paths(it).map(fitL).filter(Boolean));
      for(let x=0;x<info.length;x++){if(!fl[x].length)continue;const sc=[];let short=false;
        for(let y=0;y<info.length;y++){if(y===x||!fl[y].length)continue;let bs=Infinity,bsh=false;
          for(const fx of fl[x])for(const fy of fl[y]){if(-(fx.d[0]*fy.d[0]+fx.d[1]*fy.d[1])<Math.cos(12*Math.PI/180))continue;
            // (a line followed on through a junction only carries on into another long line)
            if((fx.ext&&fy.tot<40*med)||(fy.ext&&fx.tot<40*med))continue;
            let s2=0;for(const q of fy.pts)s2+=Math.abs((q[0]-fx.A[0])*fx.d[1]-(q[1]-fx.A[1])*fx.d[0]);s2/=fy.pts.length;if(s2<bs){bs=s2;bsh=fx.short;}}
          if(bs<Infinity)sc.push([bs,y,bsh]);}
        sc.sort((p,q)=>p[0]-q[0]);
        // (measured from a shorter piece the fit is rougher: allow it a little more)
        const lim=sc.length&&sc[0][2]?0.9*med:0.5*med;if(sc.length&&sc[0][0]<lim&&(sc.length<2||sc[1][0]>Math.max(1.0*med,2*lim)))forced.push([x,sc[0][1],sc.length>=2||sc[0][0]<0.3*med]);}}
    if(lst.length===2){const ang=angDeg(info[0][3],info[1][3]);const corner=ang<145;
      partner.set(key(info[0][0],info[0][1]),[info[1][0],info[1][1],corner]);partner.set(key(info[1][0],info[1][1]),[info[0][0],info[0][1],corner]);return;}
    const allp=[];for(let x=0;x<info.length;x++)for(let y=x+1;y<info.length;y++)allp.push([angDeg(info[x][3],info[y][3]),x,y]);
    allp.sort((p,q)=>q[0]-p[0]);const pairs=[];
    // (a clear widest pair that still bends well short of straight, like the side point of a diamond border
    // where a bar ends, is one line with a corner there)
    allp.forEach((pp,r)=>{if(pp[0]>150)pairs.push(pp);else if(r===0&&info.length===3&&pp[0]>=115&&pp[0]-allp[1][0]>=25)pairs.push([pp[0],pp[1],pp[2],pp[0]<145]);});
    // a Y whose two arms run into each other in a rounded bottom (a U with a stem under it): the arms
    // are one curve and the stem lands on it. Seen as the arms opening out toward each other right at
    // the junction, compared with farther out.
    if(!pairs.length&&info.length===3){const np_=nodePos.get(find(k))||cent[k];
      const dirAt=([j,s],m)=>{const E=edges[j],tot=E.L[E.L.length-1];const q=at(E.P,s===0?Math.min(tot,m*med):Math.max(0,tot-m*med),E.L);const v=[q[0]-np_[0],q[1]-np_[1]],n=Math.hypot(v[0],v[1])||1;return[v[0]/n,v[1]/n];};
      for(const[x,y,z]of[[0,1,2],[0,2,1],[1,2,0]]){const prof=[1.5,2,3,4,6].map(m=>angDeg(dirAt(lst[x],m),dirAt(lst[y],m)));
        const steady=prof.every((v,i)=>i===0||v<=prof[i-1]+3);
        const sym=Math.abs(angDeg(info[z][3],info[x][3])-angDeg(info[z][3],info[y][3]));
        if(steady&&prof[0]>=125&&prof[0]-prof[4]>=25&&sym<=12){pairs.push([prof[0],x,y]);break;}}}
    // a junction where a short connecting piece (the top of a small rounded shape, running between two
    // junctions close together) meets a line that bends there a little: that line carries on through
    // and the short piece lands on it
    if(!pairs.length&&info.length===3){for(const[x,y,z]of[[0,1,2],[0,2,1],[1,2,0]]){const Ez=edges[info[z][0]];if(Ez.closed||Ez.a==null||Ez.e==null||find(Ez.a)===find(Ez.e))continue;
        if(Ez.L[Ez.L.length-1]>4*med)continue;const a=angDeg(info[x][3],info[y][3]);if(a>=135&&Math.min(...[x,y].map(q=>edges[info[q][0]].L[edges[info[q][0]].L.length-1]))>Ez.L[Ez.L.length-1]){pairs.push([a,x,y]);break;}}}
    // (it must be a clear choice from at least one side, and agreed by both)
    for(const[x,y,clear]of forced)if(x<y&&forced.some(([a,b,c2])=>a===y&&b===x&&(clear||c2))){for(let r=pairs.length-1;r>=0;r--)if(pairs[r][1]===x||pairs[r][2]===x||pairs[r][1]===y||pairs[r][2]===y)pairs.splice(r,1);pairs.push([200,Math.min(x,y),Math.max(x,y)]);wedgeEnds.add(key(info[x][0],info[x][1]));wedgeEnds.add(key(info[y][0],info[y][1]));}
    const used=new Set();pairs.sort((p,q)=>q[0]-p[0]);
    // (where one line already runs straight through a crossing, a bar that starts there square to it and
    // a line that lands there at a slant are two separate lines, unless they make a clearly straight run)
    let thru=null;
    for(const[pa_,x,y,cn]of pairs){if(used.has(x)||used.has(y))continue;
      if(thru&&pa_<160){const perp=q=>Math.abs(90-angDeg(info[q][3],info[thru][3]));const px=perp(x),py=perp(y);if(Math.min(px,py)<=8&&Math.max(px,py)>=15)continue;}
      if(!thru)thru=x;used.add(x);used.add(y);
      partner.set(key(info[x][0],info[x][1]),[info[y][0],info[y][1],!!cn]);partner.set(key(info[y][0],info[y][1]),[info[x][0],info[x][1],!!cn]);}});
  // Two lines that run into each other at a shallow angle and then share a short stretch of ink:
  // which of them carries on past that stretch? The one whose bend continues smoothly into the
  // line on the far side (so a curving edge stays one even curve, without a bump where the
  // other line joins it).
  {const rmsCircle=P=>{const M=[[0,0,0],[0,0,0],[0,0,0]],v=[0,0,0];
      for(const p of P){const r=[p[0],p[1],1],z=p[0]*p[0]+p[1]*p[1];for(let i=0;i<3;i++){v[i]+=r[i]*z;for(let j=0;j<3;j++)M[i][j]+=r[i]*r[j];}}
      const[A,B,C0]=solve3(M,v);const c=[A/2,B/2],r=Math.sqrt(Math.max(0,C0+c[0]*c[0]+c[1]*c[1]));if(!isFinite(r)||r<=0)return Infinity;
      let e=0;for(const p of P){const d=Math.hypot(p[0]-c[0],p[1]-c[1])-r;e+=d*d;}return Math.sqrt(e/P.length);};
    const samp=(j,s,len)=>{const E=edges[j],tot=E.L[E.L.length-1],out=[];for(let t=0;t<=Math.min(len,tot);t+=2)out.push(at(E.P,s===0?t:tot-t,E.L));return out;};
    inc.forEach((lst)=>{if(lst.length!==3)return;
      for(const[j,s]of lst){const E=edges[j];const tot=E.L[E.L.length-1];if(tot>8*med)continue;
        const cur=partner.get(key(j,s)),far=partner.get(key(j,1-s));if(!cur||!far||cur[2]||far[2])continue;
        const others=lst.filter(([jj,ss])=>!(jj===j&&ss===s));if(others.some(([jj])=>jj===j))continue;
        const dA=others.map(([jj,ss])=>ends.get(key(jj,ss)).dir),dl=ends.get(key(j,s)).dir;
        if(angDeg(dA[0],dA[1])>35||dA.some(d=>angDeg(d,dl)<140))continue;
        const link=samp(j,s,tot),ahead=samp(far[0],far[1],6*med);
        const score=others.map(([jj,ss])=>rmsCircle([...samp(jj,ss,6*med).reverse(),...link,...ahead]));
        const bi=score[0]<=score[1]?0:1,[cj,cs]=others[bi],[oj,os]=others[1-bi];
        if(cur[0]===cj&&cur[1]===cs)continue;
        if(score[bi]>0.7*score[1-bi])continue;                       // only when clearly the smoother one
        partner.delete(key(oj,os));partner.set(key(j,s),[cj,cs,false]);partner.set(key(cj,cs),[j,s,false]);}});
    // Where two long lines arrive side by side at a junction (a narrow wedge between them) and a third leaves
    // on the other side, the one of the two that makes a clearly smoother curve with the third is the one
    // that carries on; the other ends on it at the tip of the wedge
    inc.forEach(lst=>{if(lst.length!==3)return;
      for(const[j,s]of lst){const cur=partner.get(key(j,s));if(!cur||cur[2])continue;const others=lst.filter(([jj,ss])=>!(jj===j&&ss===s));
        if(others.some(([jj])=>jj===j))continue;const dA=others.map(([jj,ss])=>ends.get(key(jj,ss)).dir),dl=ends.get(key(j,s)).dir;
        if(angDeg(dA[0],dA[1])>35||dA.some(d=>angDeg(d,dl)<140))continue;
        const minO=Math.min(...others.map(([jj])=>edges[jj].L[edges[jj].L.length-1]));if(minO<15*med||edges[j].L[edges[j].L.length-1]<2*med)continue;
        // (the line on this side may be cut short by another junction just beyond: follow it on through)
        const tj=edges[j].L[edges[j].L.length-1];let link=samp(j,s,15*med);const farP=partner.get(key(j,1-s));
        if(tj<15*med&&farP&&!farP[2])link=[...link,...samp(farP[0],farP[1],15*med-tj)];
        {const thr=tj+(farP&&!farP[2]?edges[farP[0]].L[edges[farP[0]].L.length-1]:0);if(thr<6*med)continue;
          // (both lines it could carry on into are long, or the line coming in is itself long and clear)
          if(minO<40*med&&thr<20*med)continue;}const score=others.map(([jj,ss])=>rmsCircle([...samp(jj,ss,15*med).reverse(),...link]));
        const bi=score[0]<=score[1]?0:1,[cj,cs]=others[bi],[oj,os]=others[1-bi];if(cur[0]===cj&&cur[1]===cs)continue;
        if(score[bi]>0.75*score[1-bi])continue;
        // (and it must also line up better with the third line overall, end to end)
        {const ch=(jj,ss,L)=>{const p=samp(jj,ss,L);const a=p[0],b=p[p.length-1],v=[b[0]-a[0],b[1]-a[1]],n=Math.hypot(v[0],v[1])||1;return[v[0]/n,v[1]/n];};
          const c3=(()=>{const a=link[0],b=link[link.length-1],v=[b[0]-a[0],b[1]-a[1]],n=Math.hypot(v[0],v[1])||1;return[v[0]/n,v[1]/n];})(),dev=([jj,ss])=>angDeg(ch(jj,ss,15*med),[-c3[0],-c3[1]]);if(dev(others[bi])>=dev(others[1-bi]))continue;}
        partner.delete(key(oj,os));partner.set(key(j,s),[cj,cs,false]);partner.set(key(cj,cs),[j,s,false]);}});
    // Two lines that arrive side by side at a junction where a third leaves, and either makes an equally
    // smooth curve with the third: the straight one of the two stays straight and ends on the other, which
    // carries on (a straight stem landing on a curving leaf where they run together)
    {const chainPts=(j,s,L)=>{let out=[],jj=j,ss=s,left=L,guard=0;while(left>0&&guard++<6){out=out.concat(samp(jj,ss,left));left-=edges[jj].L[edges[jj].L.length-1];const nx=partner.get(key(jj,1-ss));if(!nx||nx[2])break;jj=nx[0];ss=nx[1];}return out;};
      const lineDev=P=>{let m0=0,m1=0;for(const p of P){m0+=p[0];m1+=p[1];}m0/=P.length;m1/=P.length;let s00=0,s01=0,s11=0;for(const p of P){const x=p[0]-m0,y=p[1]-m1;s00+=x*x;s01+=x*y;s11+=y*y;}
        const th=0.5*Math.atan2(2*s01,s00-s11),nn=[-Math.sin(th),Math.cos(th)];let dv=0;for(const p of P)dv=Math.max(dv,Math.abs((p[0]-m0)*nn[0]+(p[1]-m1)*nn[1]));return dv;};
      inc.forEach(lst=>{if(lst.length!==3)return;
        for(const[a,sa]of lst){const pc=partner.get(key(a,sa));if(!pc||pc[2])continue;const[c,sc]=pc;const rest=lst.filter(([j,s])=>!(j===a&&s===sa)&&!(j===c&&s===sc));if(rest.length!==1)continue;
          const[b,sb]=rest[0];if(partner.has(key(b,sb))||b===a||b===c)continue;
          const da=ends.get(key(a,sa)).dir,db=ends.get(key(b,sb)).dir,dc=ends.get(key(c,sc)).dir;if(angDeg(da,db)>25||angDeg(db,[-dc[0],-dc[1]])>25)continue;
          const PA=chainPts(a,sa,25*med),PB=chainPts(b,sb,25*med);if(PA.length<20||PB.length<20)continue;
          // (not a long main line, which carries on as it is)
          if(edges[a].L[edges[a].L.length-1]>40*med||edges[b].L[edges[b].L.length-1]>40*med)continue;
          const la=lineDev(PA),lb=lineDev(PB);if(la>0.5*med||lb<1.5*la)continue;
          const PC=chainPts(c,sc,20*med),sA=rmsCircle([...chainPts(a,sa,20*med).reverse(),...PC]),sB=rmsCircle([...chainPts(b,sb,20*med).reverse(),...PC]);
          if(sB>1.1*sA||sB<0.85*sA)continue;   // (only where the two really are equally smooth)
          partner.delete(key(a,sa));partner.set(key(b,sb),[c,sc,false]);partner.set(key(c,sc),[b,sb,false]);break;}});}
    // A short piece of line between two junctions (the rounded bottom of a petal, split by the lines
    // that land on it) that carries on through at one end but not the other: it carries on into
    // whichever line there makes one smooth curve with it, when one clearly does.
    edges.forEach((E,j)=>{if(E.closed||E.a==null||E.e==null)return;const tot=E.L[E.L.length-1];if(tot>3*med)return;
      const A=find(E.a),B=find(E.e);if(A===B)return;
      for(const[s0,N]of[[0,A],[1,B]]){if(partner.has(key(j,s0)))continue;const far=partner.get(key(j,1-s0));if(!far||far[2])continue;
        const cand=(inc.get(N)||[]).filter(([jj])=>jj!==j);if(cand.length!==2)continue;
        // (the two other lines there may have been joined to each other at a wide bend; that gives way
        // if one of them makes a clearly smoother curve with this piece)
        const pc0=partner.get(key(cand[0][0],cand[0][1])),pc1=partner.get(key(cand[1][0],cand[1][1]));
        const joinedEach=pc0&&pc1&&pc0[0]===cand[1][0]&&pc0[1]===cand[1][1]&&!pc0[2];
        if((pc0||pc1)&&!joinedEach)continue;
        const link=samp(j,s0,tot);
        const sc=cand.map(([jj,ss])=>rmsCircle([...samp(jj,ss,2.5*med).reverse(),...link,...samp(far[0],far[1],2.5*med)]));
        const bi=sc[0]<=sc[1]?0:1;if(sc[bi]>0.15*med||sc[1-bi]<2*sc[bi])continue;
        const[cj,cs]=cand[bi];if(joinedEach){partner.delete(key(cand[0][0],cand[0][1]));partner.delete(key(cand[1][0],cand[1][1]));}
        partner.set(key(j,s0),[cj,cs,false]);partner.set(key(cj,cs),[j,s0,false]);}});
    // ...and one that carries on at neither end: if one route through it (a line at one end, the
    // piece, a line at the other end) is a clearly smoother curve than any other, that is the line it
    // belongs to, and the lines it took over from now end on it instead.
    edges.forEach((E,j)=>{if(E.closed||E.a==null||E.e==null)return;const tot=E.L[E.L.length-1];if(tot>3*med)return;
      const A=find(E.a),B=find(E.e);if(A===B||partner.has(key(j,0))||partner.has(key(j,1)))return;
      const la=(inc.get(A)||[]).filter(([jj])=>jj!==j),lb=(inc.get(B)||[]).filter(([jj])=>jj!==j);if(la.length!==2||lb.length!==2)return;
      const link=samp(j,0,tot);const opts=[];
      for(const a of la)for(const b of lb)opts.push([rmsCircle([...samp(a[0],a[1],2.5*med).reverse(),...link,...samp(b[0],b[1],2.5*med)]),a,b]);
      opts.sort((p,q)=>p[0]-q[0]);if(opts[0][0]>0.12*med||opts[0][0]>0.4*opts[1][0])return;
      const[,a,b]=opts[0];for(const[x,y]of[a,b]){const pp=partner.get(key(x,y));if(pp&&pp[2])return;}
      for(const[x,y]of[a,b]){const pp=partner.get(key(x,y));if(pp){partner.delete(key(pp[0],pp[1]));partner.delete(key(x,y));}}
      partner.set(key(j,0),[a[0],a[1],false]);partner.set(key(a[0],a[1]),[j,0,false]);
      partner.set(key(j,1),[b[0],b[1],false]);partner.set(key(b[0],b[1]),[j,1,false]);});}
  // ---------------- the user's fixes at junctions ----------------
  // Each arm of a junction is named by its direction (degrees, measured a few line widths out), so a fix
  // still finds the right lines when the pattern is re-run at another size.
  const armAng=(k,j,s_)=>{const E=edges[j],tot=E.L[E.L.length-1],np_=nodePos.get(k)||cent[k];const q=at(E.P,s_===0?Math.min(tot,3*med):Math.max(0,tot-3*med),E.L);
    return Math.atan2(q[0]-np_[0],q[1]-np_[1])*180/Math.PI;};
  const angGap=(a,b)=>{let d=Math.abs(a-b)%360;return d>180?360-d:d;};
  const fixNode=f=>{let best=null,bd=3*med;inc.forEach((lst,k)=>{if(lst.length<2)return;const p=nodePos.get(k)||cent[k];if(!p)return;const d=Math.hypot(p[0]-f.y,p[1]-f.x);if(d<bd){bd=d;best=k;}});return best;};
  const fixedNodes=new Map(),cornerAt=[];
  for(const f of FIX){const k=fixNode(f);if(k==null)continue;const lst=inc.get(k);fixedNodes.set(k,f.mode);
    const unpair=([j,s_])=>{const p=partner.get(key(j,s_));if(p){partner.delete(key(p[0],p[1]));partner.delete(key(j,s_));}};
    if(f.mode==='apart'){lst.forEach(unpair);continue;}
    if(f.mode==='pair'&&Array.isArray(f.arms)&&f.arms.length===2){
      const pick=a=>{let b=null,bd=40;for(const e of lst){const g=angGap(armAng(k,e[0],e[1]),a);if(g<bd){bd=g;b=e;}}return b;};
      const A=pick(f.arms[0]),B=pick(f.arms[1]);if(!A||!B||(A[0]===B[0]&&A[1]===B[1]))continue;
      unpair(A);unpair(B);const corner=angGap(armAng(k,A[0],A[1]),armAng(k,B[0],B[1]))<145&&lst.length===2;
      partner.set(key(A[0],A[1]),[B[0],B[1],!!f.sharp||corner]);partner.set(key(B[0],B[1]),[A[0],A[1],!!f.sharp||corner]);continue;}
    // (at a junction of two lines, a corner or a smooth bend is set right here; where more lines meet, the
    // line running through gets its corner, or loses one, when its shape is fitted)
    if(f.mode==='corner'&&lst.length>2)cornerAt.push({k,f});
    if((f.mode==='corner'||f.mode==='round')&&lst.length===2){for(const[j,s_]of lst){const p=partner.get(key(j,s_));if(p){p[2]=f.mode==='corner';}}}}
  // (a piece that carries on into nothing at either end is a line of its own)
  edges.forEach((E,j)=>{if(E.closed||partner.has(key(j,0))||partner.has(key(j,1)))return;for(const s_ of[0,1]){const e=ends.get(key(j,s_));if(e)e.own=true;}});
  // chains
  const visited=new Set(),chains=[];
  const walk=(j,sIn)=>{const seq=[],joins=[];let cur=j,side=sIn;
    while(true){visited.add(cur);const rev=side===1;seq.push([cur,rev]);const out=rev?0:1;const nx=partner.get(key(cur,out));
      if(!nx)return{seq,joins,last:[cur,out]};const[j2,s2,corner]=nx;if(visited.has(j2))return{seq,joins,last:[cur,out]};
      joins.push(corner);cur=j2;side=s2;}};
  edges.forEach((E,i)=>{if(visited.has(i)||E.closed)return;const starts=[0,1].filter(s=>!partner.has(key(i,s)));if(!starts.length)return;
    const r=walk(i,starts[0]);chains.push({seq:r.seq,joins:r.joins,start:[i,starts[0]],end:r.last,closed:false});});
  edges.forEach((E,i)=>{if(visited.has(i))return;if(E.closed){visited.add(i);chains.push({seq:[[i,false]],joins:[],start:null,end:null,closed:true});return;}
    const r=walk(i,0);chains.push({seq:r.seq,joins:r.joins,start:[i,0],end:r.last,closed:true});});
  // raw geometry
  const touches=(j,s)=>{const k=s===0?edges[j].a:edges[j].e;return k!=null&&!isFree.has(find(k));};
  for(const C of chains){
    if(C.seq.length===1&&edges[C.seq[0][0]].closed){const P=edges[C.seq[0][0]].P;C.raw=[...P,P[0].slice()];C.w=new Array(P.length+1).fill(1);continue;}
    const pieces=[],weights=[];
    C.seq.forEach(([j,rev],t)=>{let P=edges[j].P,L=edges[j].L;const tot=L[L.length-1];
      if(rev){P=P.slice().reverse();const L2=new Float64Array(L.length);for(let i=0;i<L.length;i++)L2[i]=tot-L[L.length-1-i];L=L2;}
      const sFirst=rev?1:0,sLast=rev?0:1;
      const fr=tot<4*med&&C.seq.length===1?0.15:0.35;let lo=touches(j,sFirst)?Math.min(Dt,fr*tot):0,hi=touches(j,sLast)?Math.max(tot-Dt,(1-fr)*tot):tot;
      // (a straight line carried on through a wedge of ink: leave out the bent stretch inside the wedge)
      if(wedgeEnds.has(key(j,sFirst)))lo=Math.max(lo,Math.min(8*med,0.3*tot));if(wedgeEnds.has(key(j,sLast)))hi=Math.min(hi,tot-Math.min(8*med,0.3*tot));
      const Q=[at(P,lo,L)];for(let i=0;i<P.length;i++)if(L[i]>lo&&L[i]<hi)Q.push(P[i]);Q.push(at(P,hi,L));
      const wq=new Array(Q.length).fill(1);
      if(t>0){const lw=weights[weights.length-1];lw[lw.length-1]=Math.min(lw[lw.length-1],GAP);wq[0]=GAP;
        if(C.joins[t-1]){const[pj,prevRev]=C.seq[t-1];const pe=ends.get(key(pj,prevRev?0:1)),ce=ends.get(key(j,sFirst));
          const np=nodePos.get(ce.node);let cp=lsqPoint([pe.anchor,ce.anchor],[pe.dir,ce.dir],np);if(Math.hypot(cp[0]-np[0],cp[1]-np[1])>3*u)cp=np.slice();
          // (a corner between two short pieces, whose directions can't be read well, stays near the junction)
          {const sh=Math.min(edges[pj].L[edges[pj].L.length-1],edges[j].L[edges[j].L.length-1]);const dc=Math.hypot(cp[0]-np[0],cp[1]-np[1]);
            if(sh<6*med&&dc>0.4*med){const k=0.4*med/dc;cp=[np[0]+(cp[0]-np[0])*k,np[1]+(cp[1]-np[1])*k];}}
          pieces.push([cp]);weights.push([PIN]);}}
      pieces.push(Q);weights.push(wq);});
    if(C.closed){const GC=GAP*1.5;
      // (a closed line made of several pieces closes at a junction; where its two ends meet there at a clear angle,
      // like the tip of a diamond border, that point is pinned like a corner, so it stays sharp rather than cut flat)
      const[lj,lRev]=C.seq[C.seq.length-1],[fj,fRev]=C.seq[0],pe=C.seq.length>1?ends.get(key(lj,lRev?0:1)):null,ce=C.seq.length>1?ends.get(key(fj,fRev?1:0)):null;
      const np=ce&&nodePos.get(ce.node);
      const turn=pe&&ce&&pe.dir&&ce.dir?Math.abs(pe.dir[0]*ce.dir[1]-pe.dir[1]*ce.dir[0]):0;   // (sine of the angle between the two ends' lines)
      if(pe&&ce&&np&&pe.anchor&&ce.anchor&&turn>Math.sin(30*Math.PI/180)){let cp=lsqPoint([pe.anchor,ce.anchor],[pe.dir,ce.dir],np);if(Math.hypot(cp[0]-np[0],cp[1]-np[1])>3*u)cp=np.slice();
        pieces.unshift([cp]);weights.unshift([PIN]);pieces.push([cp.slice()]);weights.push([PIN]);}
      else{/* (where a closed line starts and ends: low trust, but not a junction) */weights[weights.length-1][weights[weights.length-1].length-1]=GC;weights[0][0]=GC;pieces.push([pieces[0][0].slice()]);weights.push([GC]);}}
    C.raw=[].concat(...pieces);C.w=[].concat(...weights);}
  // corners inside traced lines
  const K=Math.max(4,Math.round(1.8*u));
  const findCorners=(Q,closed)=>{const n=Q.length;if(n<2*K+3)return[];const idx=[],ang=[],tips=new Set();
    for(let i=closed?0:K;i<(closed?n:n-K);i++){const a=Q[closed?(i-K+n)%n:i-K],b=Q[closed?(i+K)%n:i+K];
      const v1=[Q[i][0]-a[0],Q[i][1]-a[1]],v2=[b[0]-Q[i][0],b[1]-Q[i][1]];
      ang.push(Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(norm2(v1)*norm2(v2)+1e-9)))));idx.push(i);}
    const out=[];for(let jj=0;jj<idx.length;jj++){if(ang[jj]<=40*Math.PI/180)continue;let mx=0;for(let t=Math.max(0,jj-K);t<=Math.min(ang.length-1,jj+K);t++)mx=Math.max(mx,ang[t]);
      if(ang[jj]!==mx||(out.length&&idx[jj]-out[out.length-1]<=K))continue;
      // a real corner turns all at once: over half the distance the turn is nearly as big. A tight
      // round (the end of a small teardrop, with lines thick next to it) turns gradually, half as much.
      const i=idx[jj],h=Math.max(2,K>>1),a=Q[closed?(i-h+n)%n:Math.max(0,i-h)],b=Q[closed?(i+h)%n:Math.min(n-1,i+h)];
      const v1=[Q[i][0]-a[0],Q[i][1]-a[1]],v2=[b[0]-Q[i][0],b[1]-Q[i][1]];
      const ah=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(norm2(v1)*norm2(v2)+1e-9))));
      // (a corner between two long straight runs, such as the corner of a border, is a corner even if
      // the scan rounded its tip a little)
      const straightSide=dir=>{const m=10*K;if(!closed&&(dir<0?i-m<0:i+m>n-1))return false;const g=t=>Q[closed?((i+dir*t)%n+n)%n:i+dir*t];
        const A=g(Math.round(0.5*K)),B=g(m),dx=B[0]-A[0],dy=B[1]-A[1],dl=Math.hypot(dx,dy)||1;let dv=0;
        for(let t=Math.round(0.5*K);t<=m;t++){const q=g(t);dv=Math.max(dv,Math.abs((q[0]-A[0])*dy-(q[1]-A[1])*dx)/dl);}const ax=Math.min(Math.abs(dx),Math.abs(dy))/dl;return dv<0.6*u&&dl>8*K&&ax<0.09;};
      // (the same for two long, very straight runs at a slant that meet at a clear angle, like the points
      // of a diamond border, where the scan rounded the tip)
      const longSide=dir=>{const m=20*K;if(!closed&&(dir<0?i-m<0:i+m>n-1))return null;const g=t=>Q[closed?((i+dir*t)%n+n)%n:i+dir*t];
        // (a line joining partway along makes a small bulge of ink: a short stretch may stray a little)
        const A=g(Math.round(1.5*K)),B=g(m),dx=B[0]-A[0],dy=B[1]-A[1],dl=Math.hypot(dx,dy)||1;let dv=0,off=0,cnt=0;
        for(let t=Math.round(1.5*K);t<=m;t++){const q=g(t),e=Math.abs((q[0]-A[0])*dy-(q[1]-A[1])*dx)/dl;dv=Math.max(dv,e);cnt++;if(e>0.3*u)off++;}
        return dv<0.8*u&&off<=0.15*cnt&&dl>16*K?[dx/dl,dy/dl]:null;};
      let tip=false;if(ah>=0.4*ang[jj]){const s1=longSide(-1),s2=longSide(1);if(s1&&s2){const c=-(s1[0]*s2[0]+s1[1]*s2[1]);tip=Math.acos(Math.max(-1,Math.min(1,c)))>60*Math.PI/180;}}
      if(ah<0.7*ang[jj]&&!(ah>=0.55*ang[jj]&&straightSide(-1)&&straightSide(1))&&!tip)continue;
      // (a small round cap, like the top of a teardrop, keeps turning past the tip: over twice the
      // distance it turns far more; a real corner's sides run on straight-ish, so it turns about the same)
      if(!tip){const k2=2*K;if(closed||(i-k2>=0&&i+k2<n)){const a2=Q[closed?(i-k2+n)%n:i-k2],b2=Q[closed?(i+k2)%n:i+k2];
        const w1=[Q[i][0]-a2[0],Q[i][1]-a2[1]],w2=[b2[0]-Q[i][0],b2[1]-Q[i][1]];
        const a2g=Math.acos(Math.max(-1,Math.min(1,(w1[0]*w2[0]+w1[1]*w2[1])/(norm2(w1)*norm2(w2)+1e-9))));
        if(ah<0.8*ang[jj]&&a2g>1.3*ang[jj])continue;}}
      if(tip)tips.add(i);out.push(i);}
    out.tips=tips;return out;};
  const land=new Map(),landTrim=new Map(),landOn=new Map(),landAng=new Map();
  const isFreeEnd=k2=>{const[j,s]=k2;const k=s===0?edges[j].a:edges[j].e;return k==null||isFree.has(find(k));};
  const prepChain=C=>{let raw=C.raw.map(q=>q.slice()),w0=C.w.slice();
    if(!C.closed){for(const[k2,pos]of[[C.start,0],[C.end,-1]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(!landTrim.has(kk))continue;
        const L_=arclen(raw),tot=L_[L_.length-1];const keep=[];for(let i=0;i<raw.length;i++){const dist=pos===0?L_[i]:tot-L_[i];if(dist>=landTrim.get(kk))keep.push(i);}
        if(keep.length>4){raw=keep.map(i=>raw[i]);w0=keep.map(i=>w0[i]);}}
      for(const[k2,pos]of[[C.start,0],[C.end,-1]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(!land.has(kk))continue;
        const L_=arclen(raw),tot=L_[L_.length-1];const z=Math.min(Math.max(0,edges[k2[0]].clr2[k2[1]]-Dt),0.12*tot);/* never let the low-trust zone eat a short line's own shape */
        for(let i=0;i<raw.length;i++){const dist=pos===0?L_[i]:tot-L_[i];if(dist<z&&w0[i]<1e5)w0[i]=GAP;}
        if(pos===0){w0[0]=GAP;raw.unshift(land.get(kk).slice());w0.unshift(PIN);}else{w0[w0.length-1]=GAP;raw.push(land.get(kk).slice());w0.push(PIN);}}}
    let[Q,w]=resampleKeep(raw,w0);const pins=[];w.forEach((v,i)=>{if(v>=1e5)pins.push(i);});
    const base=C.closed?Q.slice(0,-1):Q;
    // (the user's fixes: no corner where they asked for a rounded line, a corner where they asked for one)
    let cands=C.noCorners?[]:findCorners(base,C.closed);const forced=new Set(),tipAt=cands.tips||new Set();
    if(FIX.length){cands=cands.filter(i=>!FIX.some(f=>f.mode==='round'&&Math.hypot(base[i][0]-f.y,base[i][1]-f.x)<2.5*med));
      for(const f of FIX){if(f.mode!=='corner')continue;let bi=-1,bd=1.5*med;base.forEach((q,i)=>{const d=Math.hypot(q[0]-f.y,q[1]-f.x);if(d<bd){bd=d;bi=i;}});
        if(bi>=0){cands=cands.filter(i=>Math.abs(i-bi)>2*K);cands.push(bi);forced.add(bi);}}
      cands.sort((a,b)=>a-b);}
    for(const i of cands){const frc=forced.has(i);
      if(pins.some(p=>Math.abs(i-p)<(frc?2:3*K))||(!C.closed&&(i<(frc?2:3*K)||i>Q.length-1-(frc?2:3*K))))continue;
      // a bend inside a solid dot on the line (a bird's eye drawn as a filled spot) is not a corner: the
      // ink there is far thicker than a line, and the line just runs through the spot
      {const dAt=q=>{const yy=Math.round(q[0]),xx=Math.round(q[1]);return(yy>=0&&xx>=0&&yy<H&&xx<W)?dmap[yy*W+xx]:0;};
        const n2=Q.length,off=Math.round(3*K),nb=[];for(const o of[-off,-off+2,off-2,off]){const t=C.closed?(i+o+n2)%n2:i+o;if(t>=0&&t<n2)nb.push(dAt(Q[t]));}
        nb.sort((p,q)=>p-q);const ref=nb.length?nb[nb.length>>1]:0.5*med;if(!frc&&dAt(Q[i])>Math.max(1.0*med,2.2*ref))continue;}
      // a junction this line was found to pass smoothly through is not a corner of it
      // (unless it is the point between two long straight runs, like the side point of a diamond border where
      // a line ends: that is a corner whatever lands on it)
      {let soft=false;for(let t=Math.max(0,i-K);t<=Math.min(w.length-1,i+K);t++)if(w[t]<=GAP*1.01){soft=true;break;}if(soft&&!frc&&!tipAt.has(i))continue;}
      const L=arclen(Q),d0=L[i];const ia=at(Q,d0-2*u,L),ib=at(Q,d0-6*u,L),ja=at(Q,d0+2*u,L),jb=at(Q,d0+6*u,L);
      const nrm=v=>{const n=norm2(v)+1e-9;return[v[0]/n,v[1]/n];};
      let cp=lsqPoint([ia,ja],[nrm([ib[0]-ia[0],ib[1]-ia[1]]),nrm([jb[0]-ja[0],jb[1]-ja[1]])],Q[i]);
      if(Math.hypot(cp[0]-Q[i][0],cp[1]-Q[i][1])>3*u)cp=Q[i].slice();
      for(let t=0;t<Q.length;t++)if(Math.abs(L[t]-d0)<2*u)w[t]=GAP;Q[i]=cp;w[i]=PIN;pins.push(i);}
    if(C.closed&&!pins.length)return{Q:Q.slice(0,-1),w:w.slice(0,-1),loop:true};
    if(C.closed){const r=Math.min(...pins);Q=[...Q.slice(r,-1),...Q.slice(0,r+1)];w=[...w.slice(r,-1),...w.slice(0,r+1)];}
    const cuts=[0,Q.length-1];w.forEach((v,i)=>{if(v>=1e5)cuts.push(i);});const cs=[...new Set(cuts)].sort((a,b)=>a-b);
    // which ends are points where this line ends on another line (fixed points for straightening)
    let landS=false,landE=false;const shallow=k2=>{if(!k2)return false;const a=landAng.get(key(k2[0],k2[1]));return a!=null&&a<45;};if(!C.closed){landS=shallow(C.start);landE=shallow(C.end);}
    const landed=k2=>!!k2&&land.has(key(k2[0],k2[1]));
    return{Q,w,cs,loop:false,closed:C.closed,landS,landE,ownShort:!C.closed&&C.seq.length===1&&arclen(Q)[Q.length-1]<4*med,onS:!C.closed&&landed(C.start),onE:!C.closed&&landed(C.end)};};

  // ---------------- straight lines and circles ----------------
  // Stretches that are straight (or circular) within a small tolerance are replaced by an exact
  // straight line (or circular arc); stretches of the same line or circle in different chains are
  // fitted together; corners become exact intersections. Freeform curves are left as they are.
  const realPts=(Q,w,a,b)=>{const o=[];for(let i=a;i<=b;i++)if(w[i]>0.5&&w[i]<1e5)o.push(Q[i]);return o;};
  const fitLine=P=>{const n=P.length;let m0=0,m1=0;for(const p of P){m0+=p[0];m1+=p[1];}m0/=n;m1/=n;
    let s00=0,s01=0,s11=0;for(const p of P){const a=p[0]-m0,b=p[1]-m1;s00+=a*a;s01+=a*b;s11+=b*b;}
    const th=0.5*Math.atan2(2*s01,s00-s11);const d=[Math.cos(th),Math.sin(th)],nn=[-d[1],d[0]];
    let dev=0;for(const p of P)dev=Math.max(dev,Math.abs((p[0]-m0)*nn[0]+(p[1]-m1)*nn[1]));
    return{type:'line',c:[m0,m1],d,n:nn,dev};};
  const fitCircle=P=>{const n=P.length;let M=[[0,0,0],[0,0,0],[0,0,0]],v=[0,0,0];
    for(const p of P){const r=[p[0],p[1],1],z=p[0]*p[0]+p[1]*p[1];for(let i=0;i<3;i++){v[i]+=r[i]*z;for(let j=0;j<3;j++)M[i][j]+=r[i]*r[j];}}
    let[A,B,C0]=solve3(M,v);let c=[A/2,B/2],r=Math.sqrt(Math.max(0,C0+c[0]*c[0]+c[1]*c[1]));
    if(!isFinite(r)||r<=0)return null;
    for(let it=0;it<6;it++){const N=[[0,0,0],[0,0,0],[0,0,0]],g=[0,0,0];
      for(const p of P){const dx=p[0]-c[0],dy=p[1]-c[1],dd=Math.hypot(dx,dy)||1e-9;const res=dd-r,J=[-dx/dd,-dy/dd,-1];
        for(let i=0;i<3;i++){g[i]+=J[i]*res;for(let j=0;j<3;j++)N[i][j]+=J[i]*J[j];}}
      const st=solve3(N,g);if(!st.every(isFinite))break;c=[c[0]-st[0],c[1]-st[1]];r=r-st[2];}
    let dev=0;for(const p of P)dev=Math.max(dev,Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-r));
    let prev=Math.atan2(P[0][1]-c[1],P[0][0]-c[0]),tot=0;
    for(const p of P){const an=Math.atan2(p[1]-c[1],p[0]-c[0]);let da=an-prev;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;tot+=da;prev=an;}
    return{type:'circle',c,r,dev,sweep:Math.abs(tot)*180/Math.PI};};
  const fitLineThrough=(P,A)=>{if(!A.length)return fitLine(P);let d;
    if(A.length>=2){d=[A[1][0]-A[0][0],A[1][1]-A[0][1]];}
    else{let s00=0,s01=0,s11=0;for(const p of P){const a=p[0]-A[0][0],b=p[1]-A[0][1];s00+=a*a;s01+=a*b;s11+=b*b;}const th=0.5*Math.atan2(2*s01,s00-s11);d=[Math.cos(th),Math.sin(th)];}
    const dn=norm2(d);if(dn<1e-9)return fitLine(P);d=[d[0]/dn,d[1]/dn];const nn=[-d[1],d[0]],c=A[0];
    let dev=0;for(const p of P)dev=Math.max(dev,Math.abs((p[0]-c[0])*nn[0]+(p[1]-c[1])*nn[1]));
    return{type:'line',c:c.slice(),d,n:nn,dev,anch:A.length};};
  const fitCircleThrough=(P,A)=>{const base=fitCircle(P);if(!base||!A.length)return base;
    // centre parameterised so the circle passes through the anchors exactly
    let par,toC;
    if(A.length>=2){const m=[(A[0][0]+A[1][0])/2,(A[0][1]+A[1][1])/2];let pd=[-(A[1][1]-A[0][1]),A[1][0]-A[0][0]];const l=norm2(pd)||1;pd=[pd[0]/l,pd[1]/l];
      toC=t=>[m[0]+t[0]*pd[0],m[1]+t[0]*pd[1]];par=[(base.c[0]-m[0])*pd[0]+(base.c[1]-m[1])*pd[1]];}
    else{toC=t=>[t[0],t[1]];par=base.c.slice();}
    const cost=t=>{const c=toC(t),r=Math.hypot(A[0][0]-c[0],A[0][1]-c[1]);let s=0;for(const p of P){const e=Math.hypot(p[0]-c[0],p[1]-c[1])-r;s+=e*e;}return s;};
    let step=Math.max(1,base.r*0.05);
    for(let it=0;it<200&&step>1e-3;it++){let improved=false;
      for(let k=0;k<par.length;k++)for(const sg of[1,-1]){const t=par.slice();t[k]+=sg*step;if(cost(t)<cost(par)){par=t;improved=true;}}
      if(!improved)step/=2;}
    const c=toC(par),r=Math.hypot(A[0][0]-c[0],A[0][1]-c[1]);
    let dev=0;for(const p of P)dev=Math.max(dev,Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-r));
    return{type:'circle',c,r,dev,sweep:base.sweep,anch:A.length};};
  // straight: bow within 0.4% of the length (hand-drawn straight lines bow ~0.3%; drawn curves far more)
  const tolLine=L=>Math.max(2,0.2*med,0.004*L),tolCirc=L=>Math.max(2,0.2*med,0.0012*L);
  const classify=(P,L,A)=>{A=A||[];if(P.length<10)return null;const ln=fitLineThrough(P,A),ci=fitCircleThrough(P,A);
    const lineOk=ln.dev<=tolLine(L)&&!(ci&&ci.dev<=0.3*ln.dev&&ci.sweep>=5);
    if(lineOk)return ln;
    if(ci&&ci.dev<=tolCirc(L)&&ci.sweep>=20&&L>=12*med&&ci.r<3*Math.max(W,H))return ci;
    return null;};
  const project=(pr,p)=>{if(pr.type==='line'){const t=(p[0]-pr.c[0])*pr.d[0]+(p[1]-pr.c[1])*pr.d[1];return[pr.c[0]+t*pr.d[0],pr.c[1]+t*pr.d[1]];}
    const dx=p[0]-pr.c[0],dy=p[1]-pr.c[1],dd=Math.hypot(dx,dy)||1e-9;return[pr.c[0]+dx/dd*pr.r,pr.c[1]+dy/dd*pr.r];};
  const intersect=(A,B,ref)=>{let cands=[];
    const lineAsPts=l=>l;
    if(A.type==='line'&&B.type==='line'){const det=A.d[0]*(-B.d[1])+B.d[0]*A.d[1];if(Math.abs(det)<1e-6)return null;
      const rx=B.c[0]-A.c[0],ry=B.c[1]-A.c[1];const t=(rx*(-B.d[1])+B.d[0]*ry)/det;cands=[[A.c[0]+t*A.d[0],A.c[1]+t*A.d[1]]];}
    else if(A.type==='circle'&&B.type==='circle'){const dx=B.c[0]-A.c[0],dy=B.c[1]-A.c[1],D=Math.hypot(dx,dy);
      if(D<1e-9||D>A.r+B.r||D<Math.abs(A.r-B.r))return null;const aa=(A.r*A.r-B.r*B.r+D*D)/(2*D),h=Math.sqrt(Math.max(0,A.r*A.r-aa*aa));
      const m=[A.c[0]+aa*dx/D,A.c[1]+aa*dy/D];cands=[[m[0]+h*dy/D,m[1]-h*dx/D],[m[0]-h*dy/D,m[1]+h*dx/D]];}
    else{const L_=A.type==='line'?A:B,Cc=A.type==='line'?B:A;const fx=L_.c[0]-Cc.c[0],fy=L_.c[1]-Cc.c[1];
      const bq=2*(fx*L_.d[0]+fy*L_.d[1]),cq=fx*fx+fy*fy-Cc.r*Cc.r,disc=bq*bq-4*cq;if(disc<0)return null;
      for(const sg of[-1,1]){const t=(-bq+sg*Math.sqrt(disc))/2;cands.push([L_.c[0]+t*L_.d[0],L_.c[1]+t*L_.d[1]]);}}
    let best=null,bd=Infinity;for(const p of cands){const d=Math.hypot(p[0]-ref[0],p[1]-ref[1]);if(d<bd){bd=d;best=p;}}
    return bd<=3*u?best:null;};
  const sampleRun=(pr,p0,p1,ref)=>{const out=[p0];
    if(pr.type==='line'){const L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),n=Math.max(1,Math.ceil(L));for(let i=1;i<=n;i++){const t=i/n;out.push([p0[0]+t*(p1[0]-p0[0]),p0[1]+t*(p1[1]-p0[1])]);}return out;}
    const a0=Math.atan2(p0[1]-pr.c[1],p0[0]-pr.c[0]),a1=Math.atan2(p1[1]-pr.c[1],p1[0]-pr.c[0]);
    // go round the same way the original line does (decided by a point in the middle of the run)
    const am=Math.atan2(ref[1]-pr.c[1],ref[0]-pr.c[0]);const norm=x=>{while(x<0)x+=2*Math.PI;while(x>=2*Math.PI)x-=2*Math.PI;return x;};
    let span=norm(a1-a0);if(norm(am-a0)>span)span=span-2*Math.PI;
    const n=Math.max(2,Math.ceil(Math.abs(span)*pr.r));for(let i=1;i<=n;i++){const an=a0+span*i/n;out.push([pr.c[0]+pr.r*Math.cos(an),pr.c[1]+pr.r*Math.sin(an)]);}
    out[out.length-1]=p1.slice();return out;};
  const analyze=pc=>{const{Q,w}=pc;pc.runs=[];
    if(pc.loop){const P=realPts(Q,w,0,Q.length-1);const L=Q.length;const ci=P.length>=10?fitCircle(P):null;
      if(ci&&ci.dev<=tolCirc(L)&&ci.r<3*Math.max(W,H)){pc.full=ci;pc.runs=[{a:0,b:Q.length-1,pr:ci,pts:P,L}];return;}
      // not a whole circle: open the loop at a junction crossing and treat it like an open chain
      let st=0;for(let i=0;i<Q.length;i++)if(w[i]<0.5){st=i;break;}
      pc.Q=[...Q.slice(st),...Q.slice(0,st+1)];pc.w=[...w.slice(st),...w.slice(0,st+1)];pc.cs=[0,pc.Q.length-1];pc.loopOpened=true;}
    const Qq=pc.Q,ww=pc.w;
    for(let c=0;c<pc.cs.length-1;c++){const a=pc.cs[c],b=pc.cs[c+1];if(b-a<1)continue;
      // (a bridge that runs right up to the end of the chain, where it lands on another line, is the
      // end of this stretch, not a break in it)
      const bounds=[a];for(let i=a+1;i<b;i++){if(ww[i]<0.5){let j=i;while(j+1<b&&ww[j+1]<0.5)j++;
          const endBridge=(j+1===b&&b===Qq.length-1&&pc.landE)||(i===a+1&&a===0&&pc.landS);if(!endBridge)bounds.push(Math.round((i+j)/2));i=j;}}bounds.push(b);
      let i=0;const nseg=bounds.length-1;
      while(i<nseg){let took=false;
        for(let j=nseg-1;j>=i;j--){const ra=bounds[i],rb=bounds[j+1];const P=realPts(Qq,ww,ra,rb);
          const A=[];if(ra===0&&pc.landS)A.push(Qq[ra]);if(rb===Qq.length-1&&pc.landE)A.push(Qq[rb]);
          let pr=classify(P,rb-ra,A);
          // (where lines branch off partway along, the ink at those junctions bulges a little; a line that is
          // straight everywhere else is still a straight line)
          if(!pr&&j>i&&rb-ra>=15*med){const mid=bounds.slice(i+1,j+1),P2=[],out=[];
            for(let q=ra;q<=rb;q++){if(!(ww[q]>0.5&&ww[q]<1e5))continue;(mid.some(m=>Math.abs(q-m)<4*med)?out:P2).push(Qq[q]);}
            if(P2.length>=10&&out.length<=0.3*(P2.length+out.length)){const l2=fitLineThrough(P2,A);
              if(l2.dev<=tolLine(rb-ra)){const nn=[-l2.d[1],l2.d[0]];const mo=Math.max(...out.map(p=>Math.abs((p[0]-l2.c[0])*nn[0]+(p[1]-l2.c[1])*nn[1])));const c2=fitCircleThrough(P2,A);
                if(mo<=0.8*med&&mo>=0.3*med&&!(c2&&c2.dev<=0.3*l2.dev&&c2.sweep>=5))pr=l2;}}}
          if(pr){pc.runs.push({a:ra,b:rb,pr,pts:P,L:rb-ra,anchors:A});i=j+1;took=true;break;}}
        if(!took){const ra=bounds[i],rb=bounds[i+1];const last=pc.runs[pc.runs.length-1];
          if(last&&!last.pr&&last.b===ra)last.b=rb;else pc.runs.push({a:ra,b:rb,pr:null});i++;}}}
    // keep a straight line / circle only where it is clearly intended: a whole line from end to
    // end (or corner to corner), or a long stretch; never chop a freeform curve into pieces
    const ends=new Set(pc.cs);
    pc.runs.forEach(r=>{if(!r.pr)return;const whole=ends.has(r.a)&&ends.has(r.b);const p=r.pr;
      // (a short whole piece also counts when it is plainly straight and nearly level or upright, like a
      // short bar across a border strip, so squaring up makes it exactly level or upright too)
      const nearAxis=p.type==='line'&&Math.min(Math.abs(p.d[0]),Math.abs(p.d[1]))<Math.sin(5*Math.PI/180);
      const keep=p.type==='line'?(whole?(r.L>=6*med||(nearAxis&&r.L>=2*med&&p.dev<=0.15*med)):r.L>=25*med):(p.sweep>=30&&(whole?r.L>=15*med:r.L>=40*med));
      // and where this line ends on another line, the exact shape has to reach that point; otherwise
      // its end would land somewhere else (past a leaf tip, say)
      if(keep){for(const[at_,on]of[[r.a,r.a===0&&pc.onS],[r.b,r.b===Qq.length-1&&pc.onE]]){if(!on)continue;
          const q=Qq[at_],pp=project(p,q);if(Math.hypot(q[0]-pp[0],q[1]-pp[1])>0.5*med){r.pr=null;return;}}}
      if(!keep)r.pr=null;});
    const merged=[];for(const r of pc.runs){const last=merged[merged.length-1];if(last&&!last.pr&&!r.pr&&last.b===r.a)last.b=r.b;else merged.push(r);}
    pc.runs=merged;};
  // fit stretches of the same straight line / circle together, across chains
  const mergePrims=pcs=>{const runs=[];pcs.forEach(pc=>pc.runs.forEach(r=>{if(r.pr)runs.push(r);}));
    const par=runs.map((_,i)=>i);const fd=i=>par[i]===i?i:(par[i]=fd(par[i]));
    for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){const A=runs[i].pr,B=runs[j].pr;if(A.type!==B.type)continue;
      if(A.type==='line'){if(Math.abs(A.d[0]*B.d[0]+A.d[1]*B.d[1])<Math.cos(Math.PI/180))continue;
        if(Math.abs((B.c[0]-A.c[0])*A.n[0]+(B.c[1]-A.c[1])*A.n[1])>0.4*med)continue;}
      else if(Math.hypot(A.c[0]-B.c[0],A.c[1]-B.c[1])>0.6*med||Math.abs(A.r-B.r)>0.6*med)continue;
      par[fd(j)]=fd(i);}
    const groups=new Map();runs.forEach((r,i)=>{const g=fd(i);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r);});
    groups.forEach(g=>{if(g.length<2)return;const P=[].concat(...g.map(r=>r.pts));const L=g.reduce((s,r)=>s+r.L,0);
      const anc=[].concat(...g.map(r=>r.anchors||[]));const Pw=P.slice();for(const a of anc)for(let k=0;k<200;k++)Pw.push(a);
      const pr=g[0].pr.type==='line'?fitLine(Pw):fitCircle(Pw);if(!pr)return;
      for(const a of anc){const q=project(pr,a);if(Math.hypot(q[0]-a[0],q[1]-a[1])>0.15*med)return;}   // joints must stay put
      let dv=0;for(const p of P){const q=project(pr,p);dv=Math.max(dv,Math.hypot(q[0]-p[0],q[1]-p[1]));}pr.dev=dv;
      const ok=pr.type==='line'?pr.dev<=tolLine(L):pr.dev<=tolCirc(L);if(ok)g.forEach(r=>{r.pr=pr;});});
    // a stretch that continues straight on from a long line or circle, and lies on it, becomes
    // part of it (so a circular border broken up by junctions is one exact circle)
    const strong=[];const tot=new Map();pcs.forEach(pc=>pc.runs.forEach(r=>{if(r.pr)tot.set(r.pr,(tot.get(r.pr)||0)+r.L);}));
    tot.forEach((L,pr)=>{if(pr.type==='line'?L>=25*med:L>=40*med)strong.push({pr,L,tol:pr.type==='line'?tolLine(L):tolCirc(L)});});
    const endsOf=pr=>{const o=[];pcs.forEach(pc=>pc.runs.forEach(r=>{if(r.pr===pr){o.push(pc.Q[r.a],pc.Q[r.b]);}}));return o;};
    let changed=true,guard=0;
    while(changed&&guard++<6){changed=false;
      for(const st of strong){const E=endsOf(st.pr);
        for(const pc of pcs){const nr=[];
          for(const r of pc.runs){if(r.pr||r.b-r.a<3){nr.push(r);continue;}
            const touch=E.some(e=>Math.hypot(e[0]-pc.Q[r.a][0],e[1]-pc.Q[r.a][1])<2*u||Math.hypot(e[0]-pc.Q[r.b][0],e[1]-pc.Q[r.b][1])<2*u);
            if(!touch){nr.push(r);continue;}
            const P=realPts(pc.Q,pc.w,r.a,r.b);if(P.length<6){nr.push(r);continue;}
            const d=P.map(p=>{const q=project(st.pr,p);return Math.hypot(q[0]-p[0],q[1]-p[1]);});
            // (and runs the same way: a line converging on it at a narrow angle, like the two sides of
            // a slim V meeting a stem, is not part of it however close it stays)
            let sameWay=true;if(st.pr.type==='line'){const fl=fitLine(P);if(fl){const c=Math.abs(fl.d[0]*st.pr.d[0]+fl.d[1]*st.pr.d[1]);sameWay=c>=Math.cos(4*Math.PI/180);}}
            if(sameWay&&Math.max(...d)<=st.tol){nr.push({a:r.a,b:r.b,pr:st.pr,pts:P,L:r.b-r.a});changed=true;}else nr.push(r);}
          pc.runs=nr;}}}};
  const squareUp=pcs=>{const prs=new Map();pcs.forEach(pc=>pc.runs.forEach(r=>{if(r.pr&&r.pr.type==='line'){if(!prs.has(r.pr))prs.set(r.pr,[]);prs.get(r.pr).push(r);}}));
    const dev=pr=>{let a=Math.atan2(pr.d[0],pr.d[1])*180/Math.PI;a=((a%90)+90)%90;if(a>45)a-=90;return a;};   // tilt from level/upright, degrees
    const big=Math.max(W,H);const votes=[];prs.forEach((rs,pr)=>{const L=rs.reduce((s,r)=>s+r.L,0);if(L>=0.25*big&&Math.abs(dev(pr))<=3)votes.push([dev(pr),L]);});
    if(!votes.length)return;votes.sort((a,b)=>a[0]-b[0]);const tot=votes.reduce((s,v)=>s+v[1],0);let acc=0;for(const v of votes){acc+=v[1];if(acc>=tot/2){frame=v[0];break;}}
    prs.forEach((rs,pr)=>{const t=dev(pr);if(Math.abs(t-frame)>1.5)return;
      const a=(Math.atan2(pr.d[0],pr.d[1])*180/Math.PI)-(t-frame);const ar=a*Math.PI/180;const d=[Math.sin(ar),Math.cos(ar)],nn=[-d[1],d[0]];
      const P=[].concat(...rs.map(r=>r.pts));const anc=[].concat(...rs.map(r=>r.anchors||[]));
      let c;if(anc.length){c=anc[0];}else{let o=0;for(const p of P)o+=(p[0]*nn[0]+p[1]*nn[1]);o/=P.length;const pr0=pr.c;const t0=(pr0[0]*d[0]+pr0[1]*d[1]);c=[t0*d[0]+o*nn[0],t0*d[1]+o*nn[1]];}
      let dv=0;for(const p of P)dv=Math.max(dv,Math.abs((p[0]-c[0])*nn[0]+(p[1]-c[1])*nn[1]));
      const L=rs.reduce((s,r)=>s+r.L,0);if(dv>3*tolLine(L))return;        // squaring would move it too far: leave it
      pr.c=c;pr.d=d;pr.n=nn;pr.dev=dv;});};
  const renderPC=pc=>{if(pc.loop&&!opt.exact){const Z=smoothPiece(pc.Q,pc.w,u,strength,true);return[...Z,Z[0]];}
    if(pc.full){const c=pc.full,a0=Math.atan2(pc.Q[0][1]-c.c[1],pc.Q[0][0]-c.c[0]);
      const sgn=(()=>{const q=pc.Q[Math.floor(pc.Q.length/4)];const am=Math.atan2(q[1]-c.c[1],q[0]-c.c[0]);let d=am-a0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d>=0?1:-1;})();
      const n=Math.max(16,Math.ceil(2*Math.PI*c.r)),out=[];for(let i=0;i<=n;i++){const an=a0+sgn*2*Math.PI*i/n;out.push([c.c[0]+c.r*Math.cos(an),c.c[1]+c.r*Math.sin(an)]);}return out;}
    const{Q,w,runs}=pc;if(!runs.length)return Q;
    // shared point at every boundary between runs (and at chain ends / corners)
    const bpt=new Map();
    const boundary=(idx,L,R)=>{let p=Q[idx].slice();
      if(L&&L.pr&&R&&R.pr&&L.pr!==R.pr){const x=intersect(L.pr,R.pr,Q[idx]);if(x)p=x;else{const a=project(L.pr,Q[idx]),b=project(R.pr,Q[idx]);p=[(a[0]+b[0])/2,(a[1]+b[1])/2];}}
      else if(L&&L.pr)p=project(L.pr,Q[idx]);else if(R&&R.pr)p=project(R.pr,Q[idx]);
      bpt.set(idx,p);};
    for(let i=0;i<runs.length;i++){const R=runs[i],L=i>0?runs[i-1]:null;
      if(i===0){const wrapL=(pc.closed||pc.loopOpened)?runs[runs.length-1]:null;boundary(R.a,wrapL,R);}
      else boundary(R.a,L,R);}
    {const last=runs[runs.length-1];if(pc.closed||pc.loopOpened)bpt.set(last.b,bpt.get(runs[0].a));else boundary(last.b,last,null);}
    let out=[];
    for(const r of runs){const p0=bpt.get(r.a),p1=bpt.get(r.b);let seg;
      if(r.pr)seg=sampleRun(r.pr,p0,p1,Q[Math.round((r.a+r.b)/2)]);
      else{const q=Q.slice(r.a,r.b+1).map(x=>x.slice()),ws=w.slice(r.a,r.b+1);q[0]=p0.slice();q[q.length-1]=p1.slice();ws[0]=PIN;ws[ws.length-1]=PIN;
        seg=q.length>=2?smoothPiece(q,ws,u,strength,false,pc.ownShort&&runs.length===1):q;
        // where a free curve carries straight on from an exact line / circle (no corner there), ease
        // it out of that shape's own direction over a short stretch, so the joint has no kink
        const ri=runs.indexOf(r),cset=new Set(pc.cs||[]);
        const ext=(pr,p,toward,len)=>{let t=pr.type==='line'?pr.d.slice():[-(p[1]-pr.c[1]),p[0]-pr.c[0]];const tn=norm2(t)||1;t=[t[0]/tn,t[1]/tn];
          if((toward[0]-p[0])*t[0]+(toward[1]-p[1])*t[1]<0)t=[-t[0],-t[1]];const o2=[];
          if(pr.type==='line'){for(let k2=0;k2<len;k2++)o2.push([p[0]+k2*t[0],p[1]+k2*t[1]]);return o2;}
          const a0=Math.atan2(p[1]-pr.c[1],p[0]-pr.c[0]);const sg=Math.sign((p[0]-pr.c[0])*t[1]-(p[1]-pr.c[1])*t[0])||1;
          for(let k2=0;k2<len;k2++){const an=a0+sg*k2/pr.r;o2.push([pr.c[0]+pr.r*Math.cos(an),pr.c[1]+pr.r*Math.sin(an)]);}return o2;};
        const blend=(S2,E2)=>{for(let k2=0;k2<E2.length;k2++){const x=k2/E2.length,sm=x*x*(3-2*x);S2[k2]=[(1-sm)*E2[k2][0]+sm*S2[k2][0],(1-sm)*E2[k2][1]+sm*S2[k2][1]];}};
        const Lb=Math.min(Math.round(8*u),Math.floor((seg.length-1)/2));
        if(Lb>=3){const Lr=ri>0?runs[ri-1]:null,Rr=ri<runs.length-1?runs[ri+1]:null;
          // (only where the two already nearly agree in direction; a line that meets the shape at a real
          // angle, like one side of a slim V reaching its stem, keeps its own direction)
          const agree=(S2,E2)=>{const k2=Math.min(S2.length-1,E2.length-1);const a=[S2[k2][0]-S2[0][0],S2[k2][1]-S2[0][1]],b=[E2[k2][0]-E2[0][0],E2[k2][1]-E2[0][1]];
            return(a[0]*b[0]+a[1]*b[1])/((norm2(a)*norm2(b))||1)>=Math.cos(10*Math.PI/180);};
          if(Lr&&Lr.pr&&!cset.has(r.a)){const E2=ext(Lr.pr,seg[0],seg[Lb],Lb);if(agree(seg,E2))blend(seg,E2);}
          if(Rr&&Rr.pr&&!cset.has(r.b)){const rv=seg.slice().reverse();const E2=ext(Rr.pr,rv[0],rv[Lb],Lb);if(agree(rv,E2)){blend(rv,E2);seg=rv.reverse();}}}
        }
      out=out.length?out.concat(seg.slice(1)):seg;}
    // two exact straight stretches of one line that meet where the line passes through a junction (not a
    // corner of the design, such as the eye of a bird sitting on a line) meet in a short round bend
    {const cset=new Set(pc.cs||[]);
      for(let i=1;i<runs.length;i++){const L=runs[i-1],R=runs[i];if(!L.pr||!R.pr||L.pr.type!=='line'||R.pr.type!=='line'||cset.has(R.a))continue;
        const p=bpt.get(R.a);if(!p||out.length<5)continue;
        let ip=0,bd=Infinity;out.forEach((q,k)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;ip=k;}});if(bd>1)continue;
        const La=arclen(out),t=Math.min(1.5*med,0.35*(R.a-L.a),0.35*(R.b-R.a));if(t<2)continue;
        let ia=ip,ib=ip;while(ia>0&&La[ip]-La[ia]<t)ia--;while(ib<out.length-1&&La[ib]-La[ip]<t)ib++;
        const A=out[ia],B=out[ib];const v1=[p[0]-A[0],p[1]-A[1]],v2=[B[0]-p[0],B[1]-p[1]];
        const turn=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/((norm2(v1)*norm2(v2))||1))))*180/Math.PI;if(turn<4||turn>70)continue;
        const n=Math.max(4,ib-ia),arc=[];for(let k=0;k<=n;k++){const x=k/n,a=(1-x)*(1-x),b=2*x*(1-x),c=x*x;arc.push([a*A[0]+b*p[0]+c*B[0],a*A[1]+b*p[1]+c*B[1]]);}
        out=[...out.slice(0,ia),...arc,...out.slice(ib+1)];}
      // ...and an exact straight stretch hands over to a freehand stretch of the same line (not at a corner)
      // smoothly, without a kink: the freehand side eases onto the straight line's direction
      for(let i=1;i<runs.length;i++){const L=runs[i-1],R=runs[i];if(cset.has(R.a))continue;
        const lineL=L.pr&&L.pr.type==='line',lineR=R.pr&&R.pr.type==='line';if(lineL===lineR||(!lineL&&L.pr)||(!lineR&&R.pr))continue;
        const p=bpt.get(R.a);if(!p||out.length<8)continue;
        let ip=0,bd=Infinity;out.forEach((q,k)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;ip=k;}});if(bd>1)continue;
        const La=arclen(out),tl=Math.min(1.5*med,0.3*((lineL?L:R).b-(lineL?L:R).a)),tf=Math.min(4*med,0.4*((lineL?R:L).b-(lineL?R:L).a));if(tl<2||tf<4)continue;
        const back=lineL?tl:tf,fwd=lineL?tf:tl;let ia=ip,ib=ip;while(ia>0&&La[ip]-La[ia]<back)ia--;while(ib<out.length-1&&La[ib]-La[ip]<fwd)ib++;
        if(ia<2||ib>out.length-3)continue;
        const A=out[ia],B=out[ib],ta=[A[0]-out[ia-2][0],A[1]-out[ia-2][1]],tb=[out[ib+2][0]-B[0],out[ib+2][1]-B[1]];
        const na=Math.hypot(ta[0],ta[1])||1,nb=Math.hypot(tb[0],tb[1])||1,ch=Math.hypot(B[0]-A[0],B[1]-A[1]);
        // (a point where the two sides meet at a real angle, like the tip of a diamond, stays sharp)
        if(angDeg([ta[0]/na,ta[1]/na],[tb[0]/nb,tb[1]/nb])>25)continue;
        const m0=[ta[0]/na*ch,ta[1]/na*ch],m1=[tb[0]/nb*ch,tb[1]/nb*ch];const n=ib-ia,br=[];
        for(let j=0;j<=n;j++){const t=j/n,t2=t*t,t3=t2*t;br.push([(2*t3-3*t2+1)*A[0]+(t3-2*t2+t)*m0[0]+(-2*t3+3*t2)*B[0]+(t3-t2)*m1[0],(2*t3-3*t2+1)*A[1]+(t3-2*t2+t)*m0[1]+(-2*t3+3*t2)*B[1]+(t3-t2)*m1[1]]);}
        let dev=0;for(let j=0;j<=n;j++)dev=Math.max(dev,Math.hypot(br[j][0]-out[ia+j][0],br[j][1]-out[ia+j][1]));if(dev>0.5*med)continue;
        out=[...out.slice(0,ia),...br,...out.slice(ib+1)];}}
    return out;};
  const fitAll=()=>{const pcs=chains.map(C=>C.dead?null:prepChain(C));
    pcs.forEach(pc=>{if(pc){if(opt.exact)analyze(pc);else{pc.runs=[];if(pc.loop){pc.cs=[0,pc.Q.length-1];}for(let c=0;c<(pc.cs||[]).length-1;c++)pc.runs.push({a:pc.cs[c],b:pc.cs[c+1],pr:null});}}});
    if(opt.exact){mergePrims(pcs.filter(Boolean));if(opt.square)squareUp(pcs.filter(Boolean));}
    return pcs.map(pc=>pc?renderPC(pc):[]);};
  // pass 1
  const stemNodes=new Map();
  chains.forEach((C,ci)=>{if(C.closed)return;for(const k2 of[C.start,C.end]){if(k2&&!isFreeEnd(k2)&&ends.has(key(k2[0],k2[1]))){const nd=ends.get(key(k2[0],k2[1])).node;if(!stemNodes.has(nd))stemNodes.set(nd,[]);stemNodes.get(nd).push([ci,k2]);}}});
  const through=new Map();
  chains.forEach((C,ci)=>{for(const[j]of C.seq)for(const s of[0,1]){const k=s===0?edges[j].a:edges[j].e;if(k!=null&&partner.has(key(j,s))){const r=find(k);if(!through.has(r))through.set(r,new Set());through.get(r).add(ci);}}});
  stemNodes.forEach((lst,k)=>{const np=nodePos.get(k);let p=np;
    if(lst.length>1){p=lsqPoint(lst.map(([,k2])=>ends.get(key(k2[0],k2[1])).anchor),lst.map(([,k2])=>{const d=ends.get(key(k2[0],k2[1])).dir;return[-d[0],-d[1]];}),np);
      if(Math.hypot(p[0]-np[0],p[1]-np[1])>3*u)p=np;}
    for(const[,k2]of lst)land.set(key(k2[0],k2[1]),p.slice());});
  say('Smoothing curves…');
  let fitted=fitAll();
  // pass 2: branches land on the fitted through-curve
  const rayHit=(p,d,F)=>{let best=null;for(let i=0;i<F.length-1;i++){const a=F[i],b=F[i+1],e=[b[0]-a[0],b[1]-a[1]];
      const det=d[0]*(-e[1])-(-e[0])*d[1];if(Math.abs(det)<1e-9)continue;const rx=a[0]-p[0],ry=a[1]-p[1];
      const t=(rx*(-e[1])-(-e[0])*ry)/det,s_=(d[0]*ry-d[1]*rx)/det;
      if(s_>=0&&s_<=1&&t>=-2*u&&t<=30*u&&(best===null||Math.abs(t)<Math.abs(best[0])))best=[t,[p[0]+t*d[0],p[1]+t*d[1]]];}
    return best?best[1]:null;};
  const segHit=(p,q,F)=>{for(let i=0;i<F.length-1;i++){const a=F[i],b=F[i+1];
      const d1=[q[0]-p[0],q[1]-p[1]],e=[b[0]-a[0],b[1]-a[1]];const det=d1[0]*(-e[1])+e[0]*d1[1];if(Math.abs(det)<1e-9)continue;
      const rx=a[0]-p[0],ry=a[1]-p[1];const t=(rx*(-e[1])+e[0]*ry)/det,s_=(d1[0]*ry-d1[1]*rx)/det;
      if(t>=0&&t<=1&&s_>=0&&s_<=1){const ne=norm2(e)||1,nd=norm2(d1)||1;
        const ang=Math.asin(Math.min(1,Math.abs(d1[0]*e[1]-d1[1]*e[0])/(ne*nd)))*180/Math.PI;
        return{p:[p[0]+t*d1[0],p[1]+t*d1[1]],ang};}}return null;};
  // where a branch meets the through-curve: follow the branch's own curve when it arrives
  // at a clear angle; when it arrives nearly tangent (< 25 degrees) the curved extension is
  // unreliable, so extend it straight instead
  // a line closing in on another almost parallel (under 25 degrees) whose own aim would carry it more
  // than two and a half line widths along that line from their junction lands at the junction itself,
  // instead of running alongside it (the tip of a petal where a background line meets it)
  // (and a landing reached only by crossing open paper is no landing: the line's end turns away before it, as where the
  // leg of a narrow arch runs down beside a line into a long wedge of ink; it lands where the ink joins instead)
  const overPaper=(a,h)=>{const L=Math.hypot(h[0]-a[0],h[1]-a[1]);let off=0;for(let t=0;t<=L;t+=1){const yy=Math.round(a[0]+(h[0]-a[0])*t/(L||1)),xx=Math.round(a[1]+(h[1]-a[1])*t/(L||1));
      if(yy>=0&&xx>=0&&yy<H&&xx<W&&dmap[yy*W+xx]<0.5)off++;}return off>Math.max(3,0.5*med)&&off>0.5*L;};
  const meet=(e,F,fallback)=>{let h=meet0(e,F,fallback);if(fallback&&h&&e.anchor&&Math.hypot(h[0]-fallback[0],h[1]-fallback[1])>2.5*med&&overPaper(e.anchor,h)&&!overPaper(e.anchor,fallback))h=fallback;if(!fallback||!h||Math.hypot(h[0]-fallback[0],h[1]-fallback[1])<=2.5*med)return h;
    let bi=0,bd=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-h[0],f[1]-h[1]);if(d<bd){bd=d;bi=q;}});
    const a=F[Math.max(0,bi-4)],b=F[Math.min(F.length-1,bi+4)],t=[b[0]-a[0],b[1]-a[1]],tn=Math.hypot(t[0],t[1])||1;
    const ang=Math.asin(Math.min(1,Math.abs(e.dir[0]*t[1]-e.dir[1]*t[0])/tn))*180/Math.PI;if(ang>=25)return h;
    // (where the two really do run together to a far meeting point, the ink between is doubled: keep it)
    let i0=0,d0=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-fallback[0],f[1]-fallback[1]);if(d<d0){d0=d;i0=q;}});
    const lo=Math.min(i0,bi),hi=Math.max(i0,bi),th=[];for(let i=lo;i<=hi;i++){const yy=Math.round(F[i][0]),xx=Math.round(F[i][1]);if(yy>=0&&xx>=0&&yy<H&&xx<W)th.push((2*dmap[yy*W+xx]-1)/med);}
    th.sort((p,q)=>p-q);return th.length&&th[th.length>>1]<0.9?fallback:h;};
  const meet0=(e,F,fallback)=>{
    let hc=null;if(e.curve){let prev=e.curve(0);const lim=e.reach+4*u;
      for(let t=1;t<=lim;t+=1){const q=e.curve(t);const h=segHit(prev,q,F);if(h){if(h.ang>=25)hc=h.p;break;}prev=q;}}
    // a short bent piece: aim it both curved and straight, and keep the landing nearer the junction
    // a short curved piece standing on its own (the rounded top of a small shape) meets each line where
    // its traced centre does: it is too short and too curved to aim along an end direction
    if(fallback&&e.dirBent&&e.len<4*med&&e.own)return fallback;
    if(fallback&&(e.dirBent||e.len<4*med)){const usual=hc||rayHit(e.anchor,[-e.dir[0],-e.dir[1]],F);
      const dd=p=>Math.hypot(p[0]-fallback[0],p[1]-fallback[1]);
      if(!usual||dd(usual)>0.7*med){const hb=e.dirBent?rayHit(e.anchor,[-e.dirBent[0],-e.dirBent[1]],F):null;
        if(hb&&(!usual||dd(hb)<0.5*dd(usual)))return hb;
        // too short to aim at all: it meets the other line where its traced centre does
        if(e.len<4*med&&usual)return fallback;}}
    if(hc)return hc;
    const h=rayHit(e.anchor,[-e.dir[0],-e.dir[1]],F);if(h)return h;
    // a line closing in on the curve at a shallow angle runs into it farther ahead (or merges with it
    // without ever crossing): land where it comes within half a line width of the curve, as long as
    // that stays near the junction
    {const d=[-e.dir[0],-e.dir[1]];let best=null;
      for(const f of F){const vx=f[0]-e.anchor[0],vy=f[1]-e.anchor[1],t=vx*d[0]+vy*d[1];if(t<=0||t>10*med)continue;
        if(Math.abs(vx*d[1]-vy*d[0])<=0.5*med&&(best===null||t<best[0]))best=[t,f.slice()];}
      if(best&&Math.hypot(best[1][0]-fallback[0],best[1][1]-fallback[1])<=4*med)return best[1];}
    return fallback;};
  stemNodes.forEach((lst,k)=>{const own=new Set(lst.map(([c])=>c));const cs=[...(through.get(k)||[])].filter(c=>!own.has(c));if(!cs.length)return;
    const F=fitted[cs[0]];const np=nodePos.get(k);
    const nearest=q=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-q[0],f[1]-q[1]);if(d<bd){bd=d;bi=i;}});return F[bi].slice();};
    const alongside=(j,sd,c)=>{ // is some other line from this junction within ~a line width, halfway into the zone?
      const q=at(edges[j].P,sd===0?c/2:edges[j].L[edges[j].L.length-1]-c/2,edges[j].L);
      for(const[jj,ss]of inc.get(k)||[]){if(jj===j)continue;const E2=edges[jj];const tot2=E2.L[E2.L.length-1];
        for(let t=0;t<=Math.min(c*1.5,tot2);t+=1){const r=at(E2.P,ss===0?t:tot2-t,E2.L);if(Math.hypot(r[0]-q[0],r[1]-q[1])<1.2*med)return true;}}
      return false;};
    let hits;
    if(lst.length>1){
      // lines that end at the same junction meet the curve at one shared point: the point on
      // the curve that best fits all of their directions (so a V or a pair of leaves lines up)
      const rays=lst.map(([,k2])=>ends.get(key(k2[0],k2[1])));
      let best=null,bd=Infinity;
      for(const f of F){if(Math.hypot(f[0]-np[0],f[1]-np[1])>8*u)continue;let s2=0;
        for(const e of rays){const vx=f[0]-e.anchor[0],vy=f[1]-e.anchor[1];const c=vx*e.dir[1]-vy*e.dir[0];s2+=c*c;}
        if(s2<bd){bd=s2;best=f;}}
      const p=best?best.slice():nearest(np);
      const own=rays.map(e=>meet(e,F,nearest(np)));
      let spread=0;for(const a of own)for(const b of own)spread=Math.max(spread,Math.hypot(a[0]-b[0],a[1]-b[1]));
      // within ~1.5 line widths they are meant to meet at one point; farther apart, the
      // original really has them touching the curve at different places
      // lines arriving from both sides of the curve that meet it at one point in the original (a pair
      // of leaves on a stem) keep that one point, even when their own directions would part a little
      const sides=new Set(rays.map(e=>{let bi=0,bd=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-e.anchor[0],f[1]-e.anchor[1]);if(d<bd){bd=d;bi=q;}});
        const a2=F[Math.max(0,bi-3)],b2=F[Math.min(F.length-1,bi+3)];return Math.sign((b2[0]-a2[0])*(e.anchor[1]-F[bi][1])-(b2[1]-a2[1])*(e.anchor[0]-F[bi][0]));}));
      if(spread<=1.5*med)hits=lst.map(()=>p);
      else if(sides.size>1&&spread<=2.5*med&&lst.length===2&&(()=>{ // a mirrored pair: both arrive at a similar, clear angle
          let bi=0,bd=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-np[0],f[1]-np[1]);if(d<bd){bd=d;bi=q;}});
          const a2=F[Math.max(0,bi-5)],b2=F[Math.min(F.length-1,bi+5)],tt=[b2[0]-a2[0],b2[1]-a2[1]],tn=norm2(tt)||1;
          const an=rays.map(e=>Math.asin(Math.min(1,Math.abs(e.dir[0]*tt[1]-e.dir[1]*tt[0])/tn))*180/Math.PI);
          return an.every(v=>v>=25&&v<=65)&&Math.abs(an[0]-an[1])<=20;})()){const q=nearest(np);hits=lst.map(()=>q.slice());}
      else hits=own;
    }else{
      const[,k2]=lst[0];const e=ends.get(key(k2[0],k2[1]));
      hits=[meet(e,F,nearest(np))];
      const[j,sd]=k2;const c=edges[j].clr[sd];
      if(c>3*u&&edges[j].L[edges[j].L.length-1]>c+8*u&&alongside(j,sd,c)){const[a2,d2]=endDir(edges[j].P,sd,u,edges[j].L,c);const h2=rayHit(a2,[-d2[0],-d2[1]],F);
        if(h2){hits[0]=h2;landTrim.set(key(j,sd),c);}}
    }
    // (a line that runs in almost parallel to the other one has no clear crossing point: it lands at the
    // junction itself rather than running on alongside the other line)
    {const q0=nearest(np);let bi=0,bd=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-q0[0],f[1]-q0[1]);if(d<bd){bd=d;bi=q;}});
      const a2=F[Math.max(0,bi-5)],b2=F[Math.min(F.length-1,bi+5)],tt=[b2[0]-a2[0],b2[1]-a2[1]],tn=norm2(tt)||1;
      lst.forEach(([,k2],i)=>{const e=ends.get(key(k2[0],k2[1]));const an=Math.asin(Math.min(1,Math.abs(e.dir[0]*tt[1]-e.dir[1]*tt[0])/tn))*180/Math.PI;
        if(an<10&&Math.hypot(hits[i][0]-q0[0],hits[i][1]-q0[1])>1.5*med)hits[i]=q0.slice();});}
    lst.forEach(([,k2],i)=>{const kk=key(k2[0],k2[1]);land.set(kk,hits[i]);landOn.set(kk,cs[0]);
      // angle at which this line meets the other one (shallow joints need their position held)
      const ix=(()=>{let bi=0,bd=Infinity;F.forEach((f,q)=>{const d=Math.hypot(f[0]-hits[i][0],f[1]-hits[i][1]);if(d<bd){bd=d;bi=q;}});return bi;})();
      const f1=F[Math.min(F.length-1,ix+3)],f0=F[Math.max(0,ix-3)];const tt=[f1[0]-f0[0],f1[1]-f0[1]],tn=norm2(tt)||1;const e=ends.get(kk);
      landAng.set(kk,Math.asin(Math.min(1,Math.abs(e.dir[0]*tt[1]-e.dir[1]*tt[0])/tn))*180/Math.PI);});});
  // The two sides of a V that touch a line at its tip (a petal on the top line) land at one point,
  // even when the drawing has them meet the line a little apart
  {const its=[];stemNodes.forEach((lst,k)=>{for(const[ci,k2]of lst){const kk=key(k2[0],k2[1]);if(!land.has(kk)||!landOn.has(kk)||landTrim.has(kk))continue;its.push({kk,ci,cF:landOn.get(kk),e:ends.get(kk)});}});
    const done=new Set();
    for(let x=0;x<its.length;x++)for(let y=x+1;y<its.length;y++){const a=its[x],b=its[y];if(done.has(a.kk)||done.has(b.kk))continue;
      if(a.cF!==b.cF||a.ci===b.ci)continue;const pa=land.get(a.kk),pb=land.get(b.kk);const gap=Math.hypot(pa[0]-pb[0],pa[1]-pb[1]);
      if(gap<1||gap>2*med)continue;if((landAng.get(a.kk)||0)<30||(landAng.get(b.kk)||0)<30)continue;
      if(angDeg(a.e.dir,b.e.dir)>=70)continue;
      // (a V's sides spread apart going back from the tip; two lines that run on side by side at the same
      // distance, like a pair of stems, are not a V and each keep their own landing)
      {const back=(kk,t)=>{const j=kk>>1,sd=kk&1,E=edges[j],tot=E.L[E.L.length-1];return at(E.P,sd===0?Math.min(t,tot):Math.max(0,tot-t),E.L);};
        const t=6*med,qa=back(a.kk,t),qb=back(b.kk,t);if(Math.hypot(qa[0]-qb[0],qa[1]-qb[1])<gap+0.8*med)continue;}
      const F=fitted[a.cF];const ni=p=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-p[0],f[1]-p[1]);if(d<bd){bd=d;bi=i;}});return bi;};
      const sd=(p,q)=>{const i=ni(p);const f0=F[Math.max(0,i-3)],f1=F[Math.min(F.length-1,i+3)];return Math.sign((f1[0]-f0[0])*(q[1]-F[i][1])-(f1[1]-f0[1])*(q[0]-F[i][0]));};
      if(sd(pa,a.e.anchor)!==sd(pb,b.e.anchor))continue;
      const mid=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];let best=null,bd=Infinity;
      for(const f of F){if(Math.hypot(f[0]-mid[0],f[1]-mid[1])>gap)continue;let s2=0;for(const e of[a.e,b.e]){const vx=f[0]-e.anchor[0],vy=f[1]-e.anchor[1];const c=vx*e.dir[1]-vy*e.dir[0];s2+=c*c;}if(s2<bd){bd=s2;best=f;}}
      if(!best)continue;land.set(a.kk,best.slice());land.set(b.kk,best.slice());done.add(a.kk);done.add(b.kk);}
    // a line that slides into the curve at a shallow angle, from the same side as another line that
    // leaves just ahead of it, joins the curve where that other line leaves (they meet at one point)
    for(const a of its){if(done.has(a.kk)||(landAng.get(a.kk)??90)>=34)continue;const pa=land.get(a.kk);const fw=[-a.e.dir[0],-a.e.dir[1]];
      const F=fitted[a.cF];const ni=p=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-p[0],f[1]-p[1]);if(d<bd){bd=d;bi=i;}});return bi;};
      const sd=(p,q)=>{const i=ni(p);const f0=F[Math.max(0,i-3)],f1=F[Math.min(F.length-1,i+3)];return Math.sign((f1[0]-f0[0])*(q[1]-F[i][1])-(f1[1]-f0[1])*(q[0]-F[i][0]));};
      let best=null;
      for(const b of its){if(b===a||b.cF!==a.cF||b.ci===a.ci||(landAng.get(b.kk)??0)<35)continue;const pb=land.get(b.kk);
        const ahead=(pb[0]-pa[0])*fw[0]+(pb[1]-pa[1])*fw[1],gap=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]);
        if(ahead<=0||gap>8*med||sd(pa,a.e.anchor)!==sd(pb,b.e.anchor))continue;
        // and the two run together into one band of doubled ink along the way (they touch, not just near)
        // (or they come from one junction in the drawing, or the shallow line is aimed right at where the other lands)
        const oneNode=a.e.node!=null&&a.e.node===b.e.node,aimed=gap<=3.5*med&&ahead>=0.8*gap;
        if(!oneNode&&!aimed){let i0=ni(pa),i1=ni(pb);if(i0>i1)[i0,i1]=[i1,i0];const th=[];const sgn=sd(pa,a.e.anchor);
          // (the ink is measured across toward this line's side too: a straightened line can run along one
          // edge of the doubled ink)
          for(let i=i0;i<=i1;i++){const f0=F[Math.max(0,i-3)],f1=F[Math.min(F.length-1,i+3)],tx=f1[0]-f0[0],ty=f1[1]-f0[1],tn=Math.hypot(tx,ty)||1;
            const nx=ty/tn*sgn,ny=-tx/tn*sgn;let best=0;
            for(let o=0;o<=1.0*med;o+=1){const yy=Math.round(F[i][0]-nx*o),xx=Math.round(F[i][1]-ny*o);if(yy>=0&&xx>=0&&yy<H&&xx<W)best=Math.max(best,(2*dmap[yy*W+xx]-1)/med);}
            th.push(best);}
          // (a longer slide needs the ink clearly doubled all the way)
          th.sort((p,q)=>p-q);if(!th.length||th[th.length>>1]<(gap>5*med?1.5:1.3)||(gap>5*med&&th[Math.floor(th.length*0.15)]<1.2))continue;}
        if(!best||gap<best[0])best=[gap,pb];}
      if(best){land.set(a.kk,best[1].slice());done.add(a.kk);}}
    // lines that land on a curve from the same side at two points barely a line width apart (a cluster
    // of lines meeting the curve in one blob of ink) meet it at one point, midway
    {const grp=new Map();for(const a of its){const p=land.get(a.kk);if(!p)continue;const g=grp.get(a.cF)||[];g.push({a,p});grp.set(a.cF,g);}
      grp.forEach((g,cF)=>{const F=fitted[cF];if(!F||g.length<3)return;
        const ni=p=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-p[0],f[1]-p[1]);if(d<bd){bd=d;bi=i;}});return bi;};
        const sd=(i,q)=>{const f0=F[Math.max(0,i-3)],f1=F[Math.min(F.length-1,i+3)];return Math.sign((f1[0]-f0[0])*(q[1]-F[i][1])-(f1[1]-f0[1])*(q[0]-F[i][0]));};
        // points where two or more lines already land together
        const pts=[];for(const x of g){let P=pts.find(q=>Math.hypot(q.p[0]-x.p[0],q.p[1]-x.p[1])<1);if(!P){P={p:x.p,m:[]};pts.push(P);}P.m.push(x);}
        for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const A=pts[i],B=pts[j];if(A.m.length<2||B.m.length<2)continue;
          const gap=Math.hypot(A.p[0]-B.p[0],A.p[1]-B.p[1]);if(gap<1||gap>1.3*med)continue;
          const ia=ni(A.p),ib=ni(B.p),sides=new Set([...A.m.map(x=>sd(ia,x.a.e.anchor)),...B.m.map(x=>sd(ib,x.a.e.anchor))]);if(sides.size!==1)continue;
          const mid=F[Math.round((ia+ib)/2)].slice();for(const x of[...A.m,...B.m]){land.set(x.a.kk,mid.slice());x.p=mid;}A.p=mid;B.p=mid;}});
      // two lines that land on a curve from opposite sides barely a line width apart, lining up with each
      // other as if one ran on through the curve (a stem's edge and a petal line), meet it at one point
      grp.forEach((g,cF)=>{const F=fitted[cF];if(!F)return;
        const ni=p=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-p[0],f[1]-p[1]);if(d<bd){bd=d;bi=i;}});return bi;};
        const sd=(i,q)=>{const f0=F[Math.max(0,i-3)],f1=F[Math.min(F.length-1,i+3)];return Math.sign((f1[0]-f0[0])*(q[1]-F[i][1])-(f1[1]-f0[1])*(q[0]-F[i][0]));};
        const used=new Set();
        for(let x=0;x<g.length;x++)for(let y=x+1;y<g.length;y++){const A=g[x],B=g[y];if(used.has(A.a.kk)||used.has(B.a.kk))continue;
          const pa=land.get(A.a.kk),pb=land.get(B.a.kk),gap=Math.hypot(pa[0]-pb[0],pa[1]-pb[1]);if(gap<1||gap>1.0*med)continue;
          // (only lines that land alone; a point several lines already share stays as it is)
          if(g.some(z=>z!==A&&z!==B&&[pa,pb].some(p=>{const q=land.get(z.a.kk);return Math.hypot(q[0]-p[0],q[1]-p[1])<1;})))continue;
          const ia=ni(pa),ib=ni(pb);if(sd(ia,A.a.e.anchor)===sd(ib,B.a.e.anchor))continue;
          if(angDeg([-A.a.e.dir[0],-A.a.e.dir[1]],B.a.e.dir)>30)continue;
          const mid=F[Math.round((ia+ib)/2)].slice();land.set(A.a.kk,mid.slice());land.set(B.a.kk,mid.slice());used.add(A.a.kk);used.add(B.a.kk);}});}}
  // Two lines that land close together on the same curve, from the same side, heading toward each
  // other at a shallow angle, with nothing crossing the curve where they land: in the drawing they
  // are the two sides of one rounded shape sitting on that curve (like the cat's cheek). Join them
  // into one continuous curve that rounds into the curve, follows it, and rounds back out.
  {const same=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
    const items=[];
    stemNodes.forEach((lst,k)=>{const own=new Set(lst.map(([c])=>c));const cs=[...(through.get(k)||[])].filter(c=>!own.has(c));if(!cs.length)return;
      for(const[ci,k2]of lst){const kk=key(k2[0],k2[1]);if(!land.has(kk)||landTrim.has(kk))continue;items.push({ci,k2,cF:cs[0],p:land.get(kk),e:ends.get(kk)});}});
    const nearestIdx=(F,p)=>{let bi=0,bd=Infinity;F.forEach((f,i)=>{const d=Math.hypot(f[0]-p[0],f[1]-p[1]);if(d<bd){bd=d;bi=i;}});return bi;};
    const sideOf=(F,i,q)=>{const a=F[Math.max(0,i-3)],b=F[Math.min(F.length-1,i+3)];return Math.sign((b[0]-a[0])*(q[1]-F[i][1])-(b[1]-a[1])*(q[0]-F[i][0]));};
    const cands=[];
    for(let x=0;x<items.length;x++)for(let y=x+1;y<items.length;y++){let a=items[x],b=items[y];
      if(a.cF!==b.cF||a.ci===b.ci||chains[a.ci].closed||chains[b.ci].closed)continue;
      const F=fitted[a.cF];let ia=nearestIdx(F,a.p),ib=nearestIdx(F,b.p);if(ia===ib)continue;if(ia>ib){[a,b]=[b,a];[ia,ib]=[ib,ia];}
      let dist=0;for(let i=ia;i<ib;i++)dist+=Math.hypot(F[i+1][0]-F[i][0],F[i+1][1]-F[i][1]);
      if(dist<3*u||dist>12*u)continue;
      const tt=[F[ib][0]-F[ia][0],F[ib][1]-F[ia][1]],tn=norm2(tt);const t=[tt[0]/tn,tt[1]/tn];
      const sa=sideOf(F,ia,a.e.anchor),sb=sideOf(F,ib,b.e.anchor);
      if(sa===0||sa!==sb)continue;                                         // same side of the curve
      if(-(a.e.dir[0]*t[0]+a.e.dir[1]*t[1])<0.6||-(b.e.dir[0]*t[0]+b.e.dir[1]*t[1])>-0.6)continue; // shallow, toward each other
      // nothing crosses the curve near either landing (otherwise that line is part of a crossing)
      const crossed=items.some(o=>o!==a&&o!==b&&o.cF===a.cF&&(()=>{const io=nearestIdx(F,o.p);if(sideOf(F,io,o.e.anchor)===sa)return false;
        return Math.hypot(F[io][0]-a.p[0],F[io][1]-a.p[1])<2.5*med||Math.hypot(F[io][0]-b.p[0],F[io][1]-b.p[1])<2.5*med;})());
      if(crossed)continue;
      // only where the meeting is tight: a small enclosed piece of glass sits right at it
      {const mx=(a.p[0]+b.p[0])/2,my=(a.p[1]+b.p[1])/2,r=Math.max(dist,2*med),cap=60*med*med,seen=new Set();let small=false;
        for(let yy=Math.max(0,Math.round(mx-r));yy<=Math.min(H-1,Math.round(mx+r))&&!small;yy+=2)for(let xx=Math.max(0,Math.round(my-r));xx<=Math.min(W-1,Math.round(my+r))&&!small;xx+=2){
          const id0=yy*W+xx;if(dmap[id0]>0||seen.has(id0))continue;const comp=[id0];seen.add(id0);let k=0,over=false;
          while(k<comp.length){const id=comp[k++],y=(id/W)|0,x=id-y*W;for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const y2=y+dy,x2=x+dx;if(y2<0||x2<0||y2>=H||x2>=W){over=true;continue;}
              const id2=y2*W+x2;if(dmap[id2]>0||seen.has(id2))continue;seen.add(id2);comp.push(id2);}if(comp.length>cap){over=true;break;}}
          if(!over)small=true;}
        if(!small)continue;
        // and the shape the two lines enclose is compact (a rounded shape sitting on the curve), not
        // an open region that runs far away
        const im=Math.round((ia+ib)/2),f0=F[Math.max(0,im-3)],f1=F[Math.min(F.length-1,im+3)];let nn=[-(f1[1]-f0[1]),f1[0]-f0[0]];const nl=norm2(nn)||1;nn=[nn[0]/nl,nn[1]/nl];
        if(sideOf(F,im,[F[im][0]+nn[0],F[im][1]+nn[1]])!==sa)nn=[-nn[0],-nn[1]];
        let seed=-1;for(let d=0.5*med;d<=3*med;d+=0.5){const yy=Math.round(F[im][0]+nn[0]*d),xx=Math.round(F[im][1]+nn[1]*d);if(yy<0||xx<0||yy>=H||xx>=W)break;if(dmap[yy*W+xx]<=0){seed=yy*W+xx;break;}}
        if(seed<0)continue;
        {const cap2=40*dist*dist,comp=[seed],sn=new Set([seed]);let k=0,over=false;
          while(k<comp.length){const id=comp[k++],y=(id/W)|0,x=id-y*W;for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const y2=y+dy,x2=x+dx;if(y2<0||x2<0||y2>=H||x2>=W){over=true;continue;}
              const id2=y2*W+x2;if(dmap[id2]>0||sn.has(id2))continue;sn.add(id2);comp.push(id2);}if(comp.length>cap2){over=true;break;}}
          if(over)continue;}}
      cands.push({a,b,ia,ib,dist});}
    cands.sort((p,q)=>p.dist-q.dist);const used=new Set();
    for(const c of cands){if(used.has(c.a.ci)||used.has(c.b.ci))continue;used.add(c.a.ci);used.add(c.b.ci);
      const CA=chains[c.a.ci],CB=chains[c.b.ci],F=fitted[c.a.cF];
      let rA=CA.raw.map(q=>q.slice()),wA=CA.w.slice();if(!same(CA.end,c.a.k2)){rA.reverse();wA.reverse();}
      let rB=CB.raw.map(q=>q.slice()),wB=CB.w.slice();if(!same(CB.start,c.b.k2)){rB.reverse();wB.reverse();}
      const soften=(r,w,atEnd,zone)=>{const L_=arclen(r),tot=L_[L_.length-1];for(let i=0;i<r.length;i++){const d=atEnd?tot-L_[i]:L_[i];if(d<zone&&w[i]<1e5)w[i]=GAP;}};
      soften(rA,wA,true,Math.min(Math.max(edges[c.a.k2[0]].clr2[c.a.k2[1]],3*u),0.3*arclen(rA)[rA.length-1]));
      soften(rB,wB,false,Math.min(Math.max(edges[c.b.k2[0]].clr2[c.b.k2[1]],3*u),0.3*arclen(rB)[rB.length-1]));
      const seg=F.slice(c.ia,c.ib+1).map(q=>q.slice());const Ls=arclen(seg),ts=Ls[Ls.length-1];
      const wS=seg.map((_,i)=>(Ls[i]<2*u||ts-Ls[i]<2*u)?GAP:20);
      const startKey=same(CA.start,c.a.k2)?CA.end:CA.start,endKey=same(CB.start,c.b.k2)?CB.end:CB.start;
      CA.dead=true;CB.dead=true;
      chains.push({seq:[],joins:[],closed:false,noCorners:true,raw:[...rA,...seg,...rB],w:[...wA,...wS,...wB],start:startKey,end:endKey});}}
  // (a corner the user asked for where lines land on a line: the lines that land there meet it at one point,
  // and the line it bends at is exactly that point)
  for(const{k,f}of cornerAt){const P=[];for(const[j,s_]of inc.get(k)||[]){const kk=key(j,s_);if(land.has(kk))P.push(kk);}
    if(!P.length)continue;const m=[0,0];for(const kk of P){const q=land.get(kk);m[0]+=q[0]/P.length;m[1]+=q[1]/P.length;}
    for(const kk of P)land.set(kk,m.slice());f.y=m[0];f.x=m[1];}
  fitted=fitAll();
  // a line that ends on another line ends exactly on it (after straightening, the end may sit a
  // fraction of a pixel off): extend or trim it along its own direction to meet that line
  chains.forEach((C,i)=>{if(C.dead||C.closed)return;let F=fitted[i];if(F.length<4)return;
    for(const[k2,atStart]of[[C.start,true],[C.end,false]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(!landOn.has(kk))continue;
      const T=fitted[landOn.get(kk)];if(!T||T.length<2||T===F)continue;
      const pts=atStart?F.slice().reverse():F;const n=pts.length;const E=pts[n-1],I=pts[Math.max(0,n-1-Math.min(4,n-2))];
      let d=[E[0]-I[0],E[1]-I[1]];const dn=norm2(d);if(dn<1e-9)continue;d=[d[0]/dn,d[1]/dn];
      const hit=rayHit(I,d,T);if(!hit||Math.hypot(hit[0]-E[0],hit[1]-E[1])>2*u)continue;
      const kept=pts.slice();while(kept.length>2){const p=kept[kept.length-1];if(((p[0]-hit[0])*d[0]+(p[1]-hit[1])*d[1])>=-1e-6&&Math.hypot(p[0]-hit[0],p[1]-hit[1])<=2*u)kept.pop();else break;}kept.push(hit);
      F=atStart?kept.reverse():kept;}
    fitted[i]=F;});
  // a straight line that lands right next to a sharp point of the line it meets (a vertical bar on
  // the tip of a petal): that point moves sideways onto the straight line's path, eased in, and the
  // straight line ends exactly on it
  chains.forEach((C,i)=>{if(C.dead||C.closed)return;const F=fitted[i];if(!F||F.length<6)return;
    for(const[k2,atStart]of[[C.start,true],[C.end,false]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(!landOn.has(kk))continue;
      const ti=landOn.get(kk);let T=fitted[ti];if(!T||T.length<8||ti===i)continue;
      const n=Math.min(F.length,Math.max(6,Math.round(3*u)));const P=atStart?F.slice(0,n):F.slice(F.length-n);
      const a=P[P.length-1],b=P[0];let ab=[b[0]-a[0],b[1]-a[1]];const l=Math.hypot(ab[0],ab[1]);if(l<2*u)continue;
      if(!P.every(q=>Math.abs((q[0]-a[0])*ab[1]-(q[1]-a[1])*ab[0])/l<0.05))continue;ab=[ab[0]/l,ab[1]/l];   // only exact straight ends
      const E=atStart?F[0]:F[F.length-1];const K=Math.max(3,Math.round(1.5*u));let best=-1,bang=0;
      for(let t=K;t<T.length-K;t++){if(Math.hypot(T[t][0]-E[0],T[t][1]-E[1])>1.2*med)continue;
        const v1=[T[t][0]-T[t-K][0],T[t][1]-T[t-K][1]],v2=[T[t+K][0]-T[t][0],T[t+K][1]-T[t][1]];
        const ang=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(norm2(v1)*norm2(v2)+1e-9))))*180/Math.PI;if(ang>bang){bang=ang;best=t;}}
      if(best<0||bang<35)continue;
      const c=T[best];const s_=(c[0]-a[0])*ab[0]+(c[1]-a[1])*ab[1];const foot=[a[0]+s_*ab[0],a[1]+s_*ab[1]];
      const dy=foot[0]-c[0],dx=foot[1]-c[1];if(Math.hypot(dy,dx)>0.6*med)continue;
      T=T.map(q=>q.slice());const L=arclen(T),span=4*u;
      for(let t=0;t<T.length;t++){const dist=Math.abs(L[t]-L[best]);if(dist>span)continue;const x=1-dist/span,wgt=x*x*(3-2*x);T[t][0]+=dy*wgt;T[t][1]+=dx*wgt;}
      fitted[ti]=T;const G=F.map(q=>q.slice());if(atStart)G[0]=foot.slice();else G[G.length-1]=foot.slice();fitted[i]=G;}});
  // lines that simply end together at a junction end at exactly the same point. If one of them is an
  // exact straight line (which straightening may have moved by a few pixels), the others come to its
  // end, easing over a short stretch, so the joint closes up
  {const byNode=new Map();
    chains.forEach((C,i)=>{if(C.dead||C.closed)return;const F=fitted[i];if(!F||F.length<4)return;
      for(const[k2,atStart]of[[C.start,true],[C.end,false]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(landOn.has(kk))continue;const e=ends.get(kk);if(!e)continue;
        const nd=find(e.node);if(!byNode.has(nd))byNode.set(nd,[]);byNode.get(nd).push({i,atStart});}});
    const isStraightEnd=(F,atStart)=>{const n=Math.min(F.length,Math.max(6,Math.round(3*u)));const P=atStart?F.slice(0,n):F.slice(F.length-n);
      const a=P[0],b=P[P.length-1],ab=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(ab[0],ab[1]);if(l<2*u)return false;
      return P.every(q=>Math.abs((q[0]-a[0])*ab[1]-(q[1]-a[1])*ab[0])/l<0.05);};
    byNode.forEach(list=>{if(list.length<2)return;const endPt=o=>{const F=fitted[o.i];return o.atStart?F[0]:F[F.length-1];};
      let straight=list.filter(o=>isStraightEnd(fitted[o.i],o.atStart));
      // (several straight ones: the one squared to exactly level or upright stays put)
      if(straight.length>1)straight=straight.filter(o=>{const F=fitted[o.i],n=Math.min(F.length,Math.round(3*u)),a=o.atStart?F[0]:F[F.length-1],b=o.atStart?F[n-1]:F[F.length-n];
        return Math.abs(a[0]-b[0])<0.01||Math.abs(a[1]-b[1])<0.01;});
      if(straight.length!==1)return;
      const tgt=endPt(straight[0]).slice();
      for(const o of list){if(o===straight[0])continue;const p=endPt(o);const dy=tgt[0]-p[0],dx=tgt[1]-p[1],dd=Math.hypot(dy,dx);if(dd<0.05||dd>1.2*med)continue;
        let F=fitted[o.i].map(q=>q.slice());if(o.atStart)F.reverse();const L=arclen(F),tot=L[L.length-1],span=isStraightEnd(fitted[o.i],o.atStart)?0.6*tot:Math.min(4*u,0.4*tot);
        for(let t=0;t<F.length;t++){const back=tot-L[t];if(back>span)continue;const x=1-back/span,wgt=x*x*(3-2*x);F[t][0]+=dy*wgt;F[t][1]+=dx*wgt;}
        if(o.atStart)F.reverse();fitted[o.i]=F;}});}
  // lines that were set to land at one point on a line (the two edges of a leaf meeting at its tip) end
  // at exactly one point, even if later straightening or smoothing nudged them a little apart
  {const grp=new Map();
    chains.forEach((C,i)=>{if(C.dead||C.closed)return;const F=fitted[i];if(!F||F.length<4)return;
      for(const[k2,atStart]of[[C.start,true],[C.end,false]]){if(!k2)continue;const kk=key(k2[0],k2[1]);if(!landOn.has(kk)||!land.has(kk))continue;
        const p=land.get(kk),g=landOn.get(kk)+':'+Math.round(p[0])+','+Math.round(p[1]);if(!grp.has(g))grp.set(g,[]);grp.get(g).push({i,atStart});}});
    grp.forEach(list=>{if(list.length<2)return;const pts=list.map(o=>{const F=fitted[o.i];return o.atStart?F[0]:F[F.length-1];});
      let spread=0;for(const a of pts)for(const b of pts)spread=Math.max(spread,Math.hypot(a[0]-b[0],a[1]-b[1]));if(spread<0.05||spread>0.6*med)return;
      const tgt=[pts.reduce((t,q)=>t+q[0],0)/pts.length,pts.reduce((t,q)=>t+q[1],0)/pts.length];
      for(const o of list){const p=o.atStart?fitted[o.i][0]:fitted[o.i][fitted[o.i].length-1];const dy=tgt[0]-p[0],dx=tgt[1]-p[1];
        let F=fitted[o.i].map(q=>q.slice());if(o.atStart)F.reverse();const L=arclen(F),tot=L[L.length-1],span=Math.min(6*med,0.45*tot);
        for(let t=0;t<F.length;t++){const back=tot-L[t];if(back>span)continue;const x=1-back/span,wgt=x*x*(3-2*x);F[t][0]+=dy*wgt;F[t][1]+=dx*wgt;}
        if(o.atStart)F.reverse();fitted[o.i]=F;}});}
  // a line that ends right beside the sharp tip of another line (a stem coming down onto the point of a
  // petal) ends exactly on that tip
  chains.forEach((C,i)=>{if(C.dead||C.closed)return;const F0=fitted[i];if(!F0||F0.length<4)return;
    for(const atStart of[true,false]){const E=atStart?fitted[i][0]:fitted[i][fitted[i].length-1];let best=null,bd=0.8*med;
      fitted.forEach((T,ti)=>{if(ti===i||!T||T.length<7)return;const K=Math.max(3,Math.round(1.5*u));
        for(let t=K;t<T.length-K;t++){const d=Math.hypot(T[t][0]-E[0],T[t][1]-E[1]);if(d>=bd||d<0.05)continue;
          const v1=[T[t][0]-T[t-K][0],T[t][1]-T[t-K][1]],v2=[T[t+K][0]-T[t][0],T[t+K][1]-T[t][1]];
          const ang=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(norm2(v1)*norm2(v2)+1e-9))))*180/Math.PI;
          // (the sharpest point nearby, not just any point on the line)
          let mx=true;for(const q of[t-1,t+1]){const w1=[T[q][0]-T[q-K>=0?q-K:0][0],T[q][1]-T[q-K>=0?q-K:0][1]],w2=[T[Math.min(T.length-1,q+K)][0]-T[q][0],T[Math.min(T.length-1,q+K)][1]-T[q][1]];
            const a2=Math.acos(Math.max(-1,Math.min(1,(w1[0]*w2[0]+w1[1]*w2[1])/(norm2(w1)*norm2(w2)+1e-9))))*180/Math.PI;if(a2>ang)mx=false;}
          if(ang>=45&&mx){bd=d;best=T[t].slice();}}});
      // (or the point where two other lines end together, such as the two sides of a petal meeting at its tip)
      fitted.forEach((T,ti)=>{if(ti===i||!T||T.length<2)return;for(const P of[T[0],T[T.length-1]]){const d=Math.hypot(P[0]-E[0],P[1]-E[1]);if(d>=bd||d<0.05)continue;
        const others=fitted.filter((U,ui)=>ui!==i&&ui!==ti&&U&&U.length>1&&[U[0],U[U.length-1]].some(Q=>Math.hypot(Q[0]-P[0],Q[1]-P[1])<0.5)).length;
        if(others>=1){bd=d;best=P.slice();}}});
      if(!best)continue;const p=E,dy=best[0]-p[0],dx=best[1]-p[1];
      let F=fitted[i].map(q=>q.slice());if(atStart)F.reverse();const L=arclen(F),tot=L[L.length-1],span=Math.min(6*med,0.45*tot);
      // (a straight line stays straight: it swings about its far end instead of bending near this one)
      const a0=F[0],b0=F[F.length-1],ab=[b0[0]-a0[0],b0[1]-a0[1]],lab=Math.hypot(ab[0],ab[1])||1;
      const straight=F.every(q=>Math.abs((q[0]-a0[0])*ab[1]-(q[1]-a0[1])*ab[0])/lab<0.15*med);
      if(straight){for(let t=0;t<F.length;t++){const x=L[t]/tot;F[t]=[a0[0]+ab[0]*x+dy*x,a0[1]+ab[1]*x+dx*x];}}
      else for(let t=0;t<F.length;t++){const back=tot-L[t];if(back>span)continue;const x=1-back/span,wgt=x*x*(3-2*x);F[t][0]+=dy*wgt;F[t][1]+=dx*wgt;}
      if(atStart)F.reverse();fitted[i]=F;}});
  // where lines run into another line through a swelling of ink, that line runs smoothly through: the stretch
  // across the swelling is replaced by a smooth bridge that matches the line's direction on either side
  {const byT=new Map();landOn.forEach((c,kk)=>{if(!land.has(kk))return;const p=land.get(kk),yy=Math.round(p[0]),xx=Math.round(p[1]);
      if(yy<0||xx<0||yy>=H||xx>=W)return;let mx=0;for(let dy=-Math.round(med);dy<=Math.round(med);dy+=2)for(let dx=-Math.round(med);dx<=Math.round(med);dx+=2){const y2=yy+dy,x2=xx+dx;if(y2>=0&&x2>=0&&y2<H&&x2<W)mx=Math.max(mx,(2*dmap[y2*W+x2]-1)/med);}
      if(mx<1.4)return;if(!byT.has(c))byT.set(c,[]);byT.get(c).push(p);});
    byT.forEach((pts,ti)=>{let F=fitted[ti];if(!F||F.length<20||chains[ti].closed)return;
      for(const p of pts){const L=arclen(F),tot=L[L.length-1];let ip=0,bd=Infinity;F.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;ip=i;}});if(bd>1.5*med)continue;
        const r=3*med;if(L[ip]<r+2*med||tot-L[ip]<r+2*med)continue;
        let ia=ip,ib=ip;while(ia>0&&L[ip]-L[ia]<r)ia--;while(ib<F.length-1&&L[ib]-L[ip]<r)ib++;
        let ka=ia,kb=ib;while(ka>0&&L[ia]-L[ka]<med)ka--;while(kb<F.length-1&&L[kb]-L[ib]<med)kb++;
        const A=F[ia],B=F[ib],ch=Math.hypot(B[0]-A[0],B[1]-A[1]);const ta=[A[0]-F[ka][0],A[1]-F[ka][1]],tb=[F[kb][0]-B[0],F[kb][1]-B[1]];
        const na=Math.hypot(ta[0],ta[1])||1,nb=Math.hypot(tb[0],tb[1])||1;if(angDeg([ta[0]/na,ta[1]/na],[tb[0]/nb,tb[1]/nb])>20)continue;   // (never across a real corner or bend)
        const m0=[ta[0]/na*ch,ta[1]/na*ch],m1=[tb[0]/nb*ch,tb[1]/nb*ch];
        const n=ib-ia,br=[];for(let j=0;j<=n;j++){const t=j/n,t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
          br.push([h00*A[0]+h10*m0[0]+h01*B[0]+h11*m1[0],h00*A[1]+h10*m0[1]+h01*B[1]+h11*m1[1]]);}
        // (only a small correction: a real bend in the line is left alone)
        let dev=0;for(let j=0;j<=n;j++)dev=Math.max(dev,Math.hypot(br[j][0]-F[ia+j][0],br[j][1]-F[ia+j][1]));if(dev>0.6*med)continue;
        F=[...F.slice(0,ia),...br,...F.slice(ib+1)];}
      fitted[ti]=F;});}
  // a line set to land on another ends exactly on that line as finally drawn: it is lengthened or shortened
  // along its own direction to meet it (the other line may have settled a little away from where it was)
  chains.forEach((C,i)=>{if(C.dead||C.closed)return;
    for(const atStart of[true,false]){const k2=atStart?C.start:C.end;if(!k2)continue;const kk=key(k2[0],k2[1]);if(!landOn.has(kk))continue;
      const T=fitted[landOn.get(kk)];let F=fitted[i];if(!T||!F||F.length<4||T.length<2)continue;
      const E=atStart?F[0]:F[F.length-1];let dmin=Infinity;for(const q of T)dmin=Math.min(dmin,Math.hypot(q[0]-E[0],q[1]-E[1]));if(dmin<0.3||dmin>1.2*med)continue;
      const G=atStart?F.slice().reverse():F.slice();const n=G.length,B=G[Math.max(0,n-1-Math.max(3,Math.round(2*u)))],dv=[E[0]-B[0],E[1]-B[1]],dl=Math.hypot(dv[0],dv[1]);if(dl<1)continue;const d=[dv[0]/dl,dv[1]/dl];
      // where the line, carried on straight from its end, crosses the other line
      let best=null;for(let t=0;t+1<T.length;t++){const a=T[t],b=T[t+1],e=[b[0]-a[0],b[1]-a[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-9)continue;
        const s1=((a[0]-E[0])*e[1]-(a[1]-E[1])*e[0])/den,s2=((a[0]-E[0])*d[1]-(a[1]-E[1])*d[0])/den;if(s2<0||s2>1||Math.abs(s1)>1.5*med)continue;if(!best||Math.abs(s1)<Math.abs(best[0]))best=[s1,[E[0]+s1*d[0],E[1]+s1*d[1]]];}
      if(!best)continue;const[s1,X]=best;
      if(s1>=0)G.push(X);else{const L=arclen(G),tot=L[L.length-1];while(G.length>2&&tot-arclen(G)[G.length-2]<=-s1)G.pop();G[G.length-1]=X;}
      fitted[i]=atStart?G.reverse():G;}});
  // a loose end that stops right up against a line (another line, or farther along its own, as where
  // the two sides of a pistil run together into its stem) lands exactly on that line
  chains.forEach((C,i)=>{if(C.dead||C.closed)return;let F=fitted[i];if(!F||F.length<6)return;
    for(const atStart of[true,false]){const k2=atStart?C.start:C.end;if(k2&&(landOn.has(key(k2[0],k2[1]))||!isFreeEnd(k2)))continue;
      const E=atStart?F[0]:F[F.length-1];let best=null,bd=0.6*med;
      fitted.forEach((T,ti)=>{if(!T||T.length<2)return;const L=ti===i?arclen(T):null;const tot=L?L[L.length-1]:0;
        for(let t=0;t<T.length;t++){if(ti===i){const along=atStart?L[t]:tot-L[t];if(along<6*med)continue;}
          const d=Math.hypot(T[t][0]-E[0],T[t][1]-E[1]);if(d<bd){bd=d;best=T[t];}}});
      if(!best||bd<0.05)continue;const dy=best[0]-E[0],dx=best[1]-E[1];
      F=F.map(q=>q.slice());if(atStart)F.reverse();const L=arclen(F),tot=L[L.length-1],span=Math.min(4*u,0.3*tot);
      for(let t=0;t<F.length;t++){const back=tot-L[t];if(back>span)continue;const x=1-back/span,wgt=x*x*(3-2*x);F[t][0]+=dy*wgt;F[t][1]+=dx*wgt;}
      if(atStart)F.reverse();fitted[i]=F;}});
  // closed loops: repeat the opening segment so the start point is a join, not two line ends
  chains.forEach((C,i)=>{let F=fitted[i];if(C.closed&&F.length>2){if(Math.hypot(F[0][0]-F[F.length-1][0],F[0][1]-F[F.length-1][1])>1e-6)F=[...F,F[0]];fitted[i]=[...F,F[1]];}});
  let out=fitted.filter(F=>F.length>1);
  const fillets=[];
  // junctions, for the page to show and let the user fix: where each is, the direction of each arm, and
  // which arms carry on into each other
  const junctions=[];inc.forEach((lst,k)=>{if(lst.length<3||isFree.has(k))return;const p=nodePos.get(k)||cent[k];if(!p)return;
    const arms=lst.map(([j,s_])=>armAng(k,j,s_)),pairs=[];
    lst.forEach(([j,s_],a)=>{const pr=partner.get(key(j,s_));if(!pr)return;const b=lst.findIndex(([j2,s2])=>j2===pr[0]&&s2===pr[1]);if(b>a)pairs.push([a,b,pr[2]?1:0]);});
    junctions.push({p:[p[0],p[1]],q:[p[0],p[1]],arms,pairs,fixed:fixedNodes.get(k)||null});});
  if(opt.exact&&opt.square&&Math.abs(frame)>0.01){const a=-frame*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cy=H/2,cx=W/2;
    const rot=p=>{const y=p[0]-cy,x=p[1]-cx;return[cy+x*sa+y*ca,cx+x*ca-y*sa];};
    out=out.map(F=>F.map(rot));fillets.forEach(f=>{f.fill=f.fill.map(rot);f.curve=f.curve.map(rot);});junctions.forEach(J=>{J.p=rot(J.p);});}
  return{strokes:out,fillets,junctions,rot:(opt.exact&&opt.square)?frame:0};}

