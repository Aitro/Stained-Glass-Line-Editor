// Lines drawn by hand: straight lead lines added to the picture before tracing.
// ------------------------------------------------------------------------------------------------

// A straight lead line of radius r from a to b, drawn into the mask.
function drawSeg(m,ax,ay,bx,by,r){const x0=Math.max(0,Math.floor(Math.min(ax,bx)-r-1)),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx)+r+1)),
    y0=Math.max(0,Math.floor(Math.min(ay,by)-r-1)),y1=Math.min(H-1,Math.ceil(Math.max(ay,by)+r+1)),dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy||1e-9,r2=r*r;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){let t=((x-ax)*dx+(y-ay)*dy)/L2;t=t<0?0:t>1?1:t;const ex=ax+t*dx-x,ey=ay+t*dy-y;if(ex*ex+ey*ey<=r2)m[y*W+x]=1;}}

// The typical width of the lines, in pixels (the middle run of dark across a line).
function inkWidth(m){const r=[];for(let y=1;y<H-1;y+=3)for(let x=1;x<W-1;x+=3){const i=y*W+x;if(m[i]&&!m[i-1])for(let k=1;k<200;k++){if(x+k>=W||!m[i+k]){r.push(k);break;}}}
  r.sort((a,b)=>a-b);return r.length?Math.max(2,r[r.length>>1]):4;}
