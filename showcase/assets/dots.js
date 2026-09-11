// Interactive point-field background. Theme-aware; honours reduced-motion.
//
// Ambient: a field of points drifts, and points near the cursor connect into a
// constellation web. Gather: hold the cursor and nearby points are pulled in and
// absorbed into a growing STAR; at a threshold the star bursts and scatters its
// points back across the field, where they can be gathered again — a continuous
// cycle. New points spawn while you play, up to a hard cap so the page never bogs.
(function(){
  const cv=document.getElementById('dots'); if(!cv) return;
  const ctx=cv.getContext('2d',{alpha:true});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MAX=5000;                 // hard cap on total points (field + star) — the plateau of the whole cycle
  const NEAR=175, NEAR2=NEAR*NEAR; // cursor influence + web radius
  const ABSORB=13, ABSORB2=ABSORB*ABSORB;
  const BURST0=120;               // first star bursts small; the threshold climbs each cycle
  const BURST_STEP=55, BURST_MAX=560; // each burst raises the next threshold — a bigger star each time, up to a ceiling
  const REGROW=0.35;              // fraction of the star's mass ADDED as fresh points on burst — the field grows toward MAX
  const ABSORB_RATE=1;            // points absorbed per frame — paces the growth so you can watch it climb
  const WEBCAP=90;                // cap the web to the nearest N points (keeps O(k^2) bounded)

  const COOL=80;                  // frames after a burst before gathering resumes — lets them disperse first
  let W=0,H=0,DPR=1,pts=[],raf=0,frame=0,cool=0,burstAt=BURST0;
  const mouse={x:-9999,y:-9999,on:false};
  const star={x:0,y:0,mass:0,r:0};

  function cssvar(n,f){ const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v||f; }
  function hexToRgb(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16); return (h.length===6)?[(n>>16)&255,(n>>8)&255,n&255]:[150,120,240]; }
  let RGB=cssvar('--dot','20,28,45');       // "r,g,b" for the field
  let HD=hexToRgb(cssvar('--hd','#6d28d9')); // accent for the star glow
  function readTheme(){ RGB=cssvar('--dot','20,28,45'); HD=hexToRgb(cssvar('--hd','#6d28d9')); }

  function mkpt(x,y,vx,vy){ const z=Math.random();
    return {x:(x==null?Math.random()*W:x), y:(y==null?Math.random()*H:y), z,
      vx:(vx==null?(Math.random()-.5)*(.12+z*.22):vx), vy:(vy==null?(Math.random()-.5)*(.12+z*.22):vy)}; }

  function resize(){
    DPR=Math.min(2,window.devicePixelRatio||1);
    W=cv.clientWidth; H=cv.clientHeight;
    cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const target=Math.min(MAX, Math.round(W*H/6500)); // sparse start, like before — the burst cycle grows it toward MAX
    pts=[]; for(let i=0;i<target;i++) pts.push(mkpt());
    star.mass=0; star.r=0; burstAt=BURST0;
  }

  function explode(){
    // re-emit the star's mass PLUS a fresh share, so the field grows each cycle — capped at MAX
    const headroom=Math.max(0,MAX-pts.length);
    const emit=Math.min(headroom, star.mass+Math.round(star.mass*REGROW));
    for(let i=0;i<emit;i++){ const a=Math.random()*6.283, sp=4.0+Math.random()*8.0; // fling them across the screen
      pts.push(mkpt(star.x,star.y,Math.cos(a)*sp,Math.sin(a)*sp)); }
    star.mass=0; star.r=0; cool=COOL;             // pause the gather so they scatter before regrouping
    burstAt=Math.min(BURST_MAX,burstAt+BURST_STEP); // next star bursts bigger, until the ceiling
  }

  // two rings, each tumbling on its own axis — different tilt planes and speeds, like a gyroscope
  const RINGS=[{rad:1.7,sp:0.020,tsp:0.017,ph:0.0,w:1.3},
               {rad:2.2,sp:-0.013,tsp:0.024,ph:1.7,w:1.1}];
  function drawStar(x,y,r,t){ // t = charge 0..1
    const pulse=1+0.08*Math.sin(frame*0.2)*(t>0.7?1:0.4);
    const R=r*pulse, gl=R*3.4;
    const g=ctx.createRadialGradient(x,y,0,x,y,gl);
    g.addColorStop(0,'rgba('+HD[0]+','+HD[1]+','+HD[2]+','+(0.28+0.22*t)+')');
    g.addColorStop(0.45,'rgba('+HD[0]+','+HD[1]+','+HD[2]+','+(0.07+0.07*t)+')');
    g.addColorStop(1,'rgba('+HD[0]+','+HD[1]+','+HD[2]+',0)');
    ctx.beginPath(); ctx.arc(x,y,gl,0,6.283); ctx.fillStyle=g; ctx.fill();
    // orbiting rings — each on its own axis
    ctx.strokeStyle='rgba(255,244,214,'+(0.09+0.15*t)+')';
    for(let i=0;i<RINGS.length;i++){ const rg=RINGS[i];
      const axis=rg.ph+frame*rg.sp;                              // ellipse orientation spins
      const tilt=0.20+Math.abs(Math.sin(rg.ph+frame*rg.tsp))*0.85; // foreshortening tumbles 0.20..1.05
      ctx.save(); ctx.translate(x,y); ctx.rotate(axis); ctx.scale(1,tilt);
      ctx.beginPath(); ctx.arc(0,0,R*rg.rad,0,6.283); ctx.lineWidth=rg.w; ctx.stroke(); ctx.restore();
    }
    // bright soft core
    ctx.beginPath(); ctx.arc(x,y,Math.max(1.6,R*0.55),0,6.283);
    ctx.fillStyle='rgba(255,248,230,'+(0.50+0.25*t)+')'; ctx.fill();
  }

  function step(){
    frame++;
    if(cool>0) cool--; // count down the post-burst scatter pause
    ctx.clearRect(0,0,W,H);

    // spawn new points at an edge while gathering, up to the cap
    if(mouse.on && cool===0 && (frame%7)===0 && pts.length+star.mass<MAX){
      const e=frame%4; let x,y;
      if(e===0){x=Math.random()*W;y=-6;} else if(e===1){x=W+6;y=Math.random()*H;}
      else if(e===2){x=Math.random()*W;y=H+6;} else {x=-6;y=Math.random()*H;}
      pts.push(mkpt(x,y));
    }

    const near=[]; let absorbed=0;
    for(let k=pts.length-1;k>=0;k--){
      const p=pts[k];
      p.x+=p.vx; p.y+=p.vy;
      // scattered (fast) points bleed speed slowly, so a burst carries them far before they settle
      if(p.vx*p.vx+p.vy*p.vy>0.4){ p.vx*=0.988; p.vy*=0.988; }
      if(mouse.on && cool===0){
        const dx=mouse.x-p.x, dy=mouse.y-p.y, d2=dx*dx+dy*dy;
        if(d2<ABSORB2 && absorbed<ABSORB_RATE){ pts.splice(k,1); star.mass++; absorbed++; continue; } // absorbed, but paced
        if(d2<NEAR2){ const d=Math.sqrt(d2)+1, f=(1-d2/NEAR2)*0.35*(0.6+p.z)/d;
          p.vx+=dx*f; p.vy+=dy*f; if(near.length<WEBCAP) near.push(p); }
      }
      if(p.x<-10)p.x=W+10; if(p.x>W+10)p.x=-10; if(p.y<-10)p.y=H+10; if(p.y>H+10)p.y=-10;
      const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill();
    }

    // constellation web — only among the near-cursor subset, so it stays cheap at any cap
    for(let i=0;i<near.length;i++){ const a=near[i];
      for(let j=i+1;j<near.length;j++){ const b=near[j]; const dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;
        if(d2<NEAR2){ const al=(1-d2/NEAR2)*0.16;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle='rgba('+RGB+','+al+')'; ctx.lineWidth=0.6; ctx.stroke(); } } }

    // the star follows the cursor, grows toward its mass, and bursts at the threshold
    if(mouse.on){ star.x+=(mouse.x-star.x)*0.1; star.y+=(mouse.y-star.y)*0.1; }
    if(star.mass>0){
      const tr=5+Math.sqrt(star.mass)*2.8; star.r+=(tr-star.r)*0.07; // visible floor + gentle, slow growth
      drawStar(star.x,star.y,star.r,Math.min(1,star.mass/burstAt));
      if(star.mass>=burstAt) explode();
    }

    raf=requestAnimationFrame(step);
  }

  function stat(){ // reduced-motion: a still field, no gather
    ctx.clearRect(0,0,W,H);
    for(const p of pts){ const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill(); }
  }

  window.addEventListener('resize',()=>{resize(); if(reduce)stat();});
  window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.on=true;});
  window.addEventListener('mouseout',()=>{mouse.on=false;mouse.x=-9999;mouse.y=-9999;});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',readTheme);
  resize();
  if(reduce){ stat(); } else { raf=requestAnimationFrame(step); }
})();
