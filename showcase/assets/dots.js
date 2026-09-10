// Interactive point-field background. Theme-aware, reaches toward the cursor, honours reduced-motion.
(function(){
  const cv=document.getElementById('dots'); if(!cv) return;
  const ctx=cv.getContext('2d',{alpha:true});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W=0,H=0,DPR=1,pts=[],raf=0;
  const mouse={x:-9999,y:-9999,on:false};
  function col(){ // read --dot "r,g,b" from the theme
    const v=getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
    return v||'20,28,45';
  }
  let RGB=col();
  function resize(){
    DPR=Math.min(2,window.devicePixelRatio||1);
    W=cv.clientWidth; H=cv.clientHeight;
    cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const target=Math.min(150,Math.round(W*H/12000));
    pts=[];
    for(let i=0;i<target;i++){
      const z=Math.random();               // depth 0(far)..1(near)
      pts.push({x:Math.random()*W,y:Math.random()*H,z,
        vx:(Math.random()-.5)*(.12+z*.22),vy:(Math.random()-.5)*(.12+z*.22)});
    }
  }
  function step(){
    ctx.clearRect(0,0,W,H);
    const near=150, near2=near*near;
    for(const p of pts){
      // ambient drift
      p.x+=p.vx; p.y+=p.vy;
      // reach toward the cursor when close
      if(mouse.on){
        const dx=mouse.x-p.x, dy=mouse.y-p.y, d2=dx*dx+dy*dy;
        if(d2<near2 && d2>1){ const f=(1-d2/near2)*0.06*(0.5+p.z); p.x+=dx*f; p.y+=dy*f; }
      }
      // wrap
      if(p.x<-10)p.x=W+10; if(p.x>W+10)p.x=-10; if(p.y<-10)p.y=H+10; if(p.y>H+10)p.y=-10;
      const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill();
    }
    // constellation lines around the cursor
    if(mouse.on){
      for(let i=0;i<pts.length;i++){
        const a=pts[i]; const adx=a.x-mouse.x, ady=a.y-mouse.y; if(adx*adx+ady*ady>near2) continue;
        for(let j=i+1;j<pts.length;j++){
          const b=pts[j]; const dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy;
          if(d2<near2){ const al=(1-d2/near2)*0.16;
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
            ctx.strokeStyle='rgba('+RGB+','+al+')'; ctx.lineWidth=0.6; ctx.stroke(); }
        }
      }
    }
    raf=requestAnimationFrame(step);
  }
  function stat(){ // static field for reduced-motion
    ctx.clearRect(0,0,W,H);
    for(const p of pts){ const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill(); }
  }
  window.addEventListener('resize',()=>{resize(); if(reduce)stat();});
  window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.on=true;});
  window.addEventListener('mouseout',()=>{mouse.on=false;mouse.x=-9999;mouse.y=-9999;});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{RGB=col();});
  resize();
  if(reduce){ stat(); } else { raf=requestAnimationFrame(step); }
})();
