// Circles inside circles: a small ring standing alone inside a piece, touching no other line (the middle of a
// star, a dot in an eye). It would make the piece around it a ring of glass with a hole, which can't be cut, so it is
// left out. A closed line that anything else touches or lands on is part of the pattern and stays, and so does one
// out in the open, not inside any piece.
function dropIslands(strokes,med){
  const cell=Math.max(8,Math.round(med)),G=new Map(),key=(y,x)=>((y/cell)|0)*100000+((x/cell)|0);
  const put=(y,x,s)=>{const kk=key(y,x);let L=G.get(kk);if(!L)G.set(kk,L=[]);L.push(s);};
  // (points along long straight pieces too, so a straight line passing close by counts)
  strokes.forEach((Q,s)=>{for(let k=0;k<Q.length;k++){const q=Q[k];put(q[0],q[1],s);
    if(k>0){const a=Q[k-1],n=Math.floor(Math.hypot(q[0]-a[0],q[1]-a[1])/(cell/2));for(let t=1;t<n;t++)put(a[0]+(q[0]-a[0])*t/n,a[1]+(q[1]-a[1])*t/n,s);}}});
  const drop=new Set();
  strokes.forEach((Q,s)=>{if(Q.length<8)return;const a=Q[0],b=Q[Q.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])>3)return;
    let y0=1e9,x0=1e9,y1=-1e9,x1=-1e9;for(const q of Q){y0=Math.min(y0,q[0]);y1=Math.max(y1,q[0]);x0=Math.min(x0,q[1]);x1=Math.max(x1,q[1]);}
    if(y1-y0>H/4||x1-x0>W/4)return;
    // (nothing else within about a line width of it)
    for(const q of Q){const cy=(q[0]/cell)|0,cx=(q[1]/cell)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const L=G.get((cy+dy)*100000+cx+dx);if(L&&L.some(t=>t!==s))return;}}
    // (and only inside a piece: lines all round it. A shape out in the open, such as a circle standing above the rest of
    // a design, is part of the picture and stays; rays from its middle out to the picture's edge meet no other line)
    const cy=(y0+y1)/2,cx=(x0+x1)/2;
    for(let a=0;a<8;a++){const dy=Math.sin(a*Math.PI/4),dx=Math.cos(a*Math.PI/4);let hit=false;
      for(let t=0;;t+=cell/2){const y=cy+dy*t,x=cx+dx*t;if(y<0||x<0||y>=H||x>=W)break;const L=G.get(key(y,x));if(L&&L.some(o=>o!==s)){hit=true;break;}}
      if(!hit)return;}
    drop.add(s);});
  return drop.size?strokes.filter((_,s)=>!drop.has(s)):strokes;}
