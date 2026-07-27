/* ===========================================================
   Portrait halftone particle dissolve — scroll driven
   =========================================================== */
(function(){
  const cfg = window.PCONFIG = {
    src:'portrait-real.png',
    sampleW:165,          // sampling grid width (density)
    lumThreshold:0.11,    // (on inverted value) drops light background ghosts
    dotScale:0.5,         // dot radius as fraction of cell spacing
    accentMix:0.10,       // fraction of bronze dots
    dispersion:'updrift', // 'updrift' | 'scatter' | 'down'
    invertLuma:true,      // photo: darker areas (hair/eyes/beard) -> more ink
    inkColor:[26,26,26],
    bronzeColor:[176,141,87],
    travel:1.05           // dispersion distance (× portrait height)
  };

  const canvas=document.getElementById('portrait');
  const ctx=canvas.getContext('2d');
  const scroller=document.getElementById('scroll');
  const hero=document.getElementById('hero');
  let dpr=Math.min(window.devicePixelRatio||1,2);

  let particles=[]; let bronzeStart=0;
  let cssW=0,cssH=0;            // display size of portrait box (css px)
  let progress=0, targetProgress=0;
  let t0=performance.now();
  let ready=false;

  function sizeBox(){
    const vh=window.innerHeight;
    cssH=Math.min(vh*0.74, 660);
    cssW=cssH*(700/900);
    canvas.style.width=cssW+'px';
    canvas.style.height=cssH+'px';
    canvas.width=Math.round(cssW*dpr);
    canvas.height=Math.round(cssH*dpr);
  }

  function smooth(a,b,x){ x=Math.max(0,Math.min(1,(x-a)/(b-a))); return x*x*(3-2*x); }
  function rnd(a,b){ return a+Math.random()*(b-a); }

  function build(img){
    const sw=cfg.sampleW;
    const sh=Math.round(sw*(img.height/img.width));
    const off=document.createElement('canvas');
    off.width=sw; off.height=sh;
    const o=off.getContext('2d');
    o.drawImage(img,0,0,sw,sh);
    const data=o.getImageData(0,0,sw,sh).data;

    const ink=[], bronze=[];
    for(let y=0;y<sh;y++){
      for(let x=0;x<sw;x++){
        const i=(y*sw+x)*4;
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<10) continue;
        let lum=(0.299*r+0.587*g+0.114*b)/255;
        if(cfg.invertLuma) lum=1-lum;
        if(lum<cfg.lumThreshold) continue;
        const nx=(x+0.5)/sw, ny=(y+0.5)/sh;
        // dispersion vector
        let ang, mag, up;
        const cx=nx-0.5;
        if(cfg.dispersion==='scatter'){
          ang=Math.atan2(ny-0.5,cx)+rnd(-0.5,0.5); up=0;
        }else if(cfg.dispersion==='down'){
          ang=rnd(0,Math.PI); up=0; // downward arc
        }else{ // updrift: mostly up + outward
          ang=-Math.PI/2 + cx*1.5 + rnd(-0.55,0.55); up=1;
        }
        mag=rnd(0.45,1)*(0.5+lum*0.6);
        const p={
          nx,ny,
          a:Math.pow(lum,0.60),                  // base alpha (gamma — richer mid-tones)
          vx:Math.cos(ang),
          vy:cfg.dispersion==='down'?Math.abs(Math.sin(ang)):Math.sin(ang)-up*rnd(0.2,0.7),
          mag,
          stagger:rnd(0,0.45),                   // start-time offset
          ph:rnd(0,Math.PI*2),                   // shimmer phase
          spd:rnd(0.6,1.4),
          sz:rnd(0.78,1.18)
        };
        (Math.random()<cfg.accentMix?bronze:ink).push(p);
      }
    }
    particles=ink.concat(bronze);
    bronzeStart=ink.length;
  }

  function render(now){
    t0=now;
    const p=progress;
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);

    const sx=cssW*dpr, sy=cssH*dpr;
    const spacing=(sx/cfg.sampleW);
    const dot=Math.max(1, spacing*cfg.dotScale);
    const travel=sy*cfg.travel;
    const time=now*0.001;

    const ink=cfg.inkColor, br=cfg.bronzeColor;
    ctx.fillStyle=`rgb(${ink[0]},${ink[1]},${ink[2]})`;
    let usingBronze=false;

    for(let k=0;k<particles.length;k++){
      if(!usingBronze && k>=bronzeStart){ ctx.fillStyle=`rgb(${br[0]},${br[1]},${br[2]})`; usingBronze=true; }
      const q=particles[k];
      // local progress with stagger
      const lp=smooth(q.stagger*0.7, 0.7+q.stagger*0.3, p);
      const disp=lp;
      // base position
      let bx=q.nx*sx, by=q.ny*sy;
      // shimmer (alive when assembled)
      const idle=(1-Math.min(1,p*4));
      if(idle>0.01){
        bx+=Math.sin(time*q.spd+q.ph)*0.9*dpr*idle;
        by+=Math.cos(time*q.spd*0.9+q.ph)*0.9*dpr*idle;
      }
      // dispersion offset
      bx+=q.vx*q.mag*travel*disp;
      by+=q.vy*q.mag*travel*disp;
      // alpha: fade out as it flies away
      const alpha=q.a*(1-smooth(0.45,0.96,lp));
      if(alpha<=0.01) continue;
      ctx.globalAlpha=alpha;
      const s=dot*q.sz*(1+disp*0.25);
      ctx.fillRect(bx-s*0.5, by-s*0.5, s, s);
    }
    ctx.globalAlpha=1;
  }
  function loop(now){ render(now); rafId=requestAnimationFrame(loop); }
  let rafId=0;

  function onScroll(){
    const rect=hero.getBoundingClientRect();
    const vh=window.innerHeight;
    targetProgress=Math.max(0,Math.min(1, -rect.top/(vh*0.92) ));
    progress=targetProgress;            // scroll-driven (scrubs exactly with scroll)
    render(performance.now());
  }

  function start(){
    sizeBox();
    onScroll();
    scroller.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',()=>{ dpr=Math.min(window.devicePixelRatio||1,2); sizeBox(); onScroll(); },{passive:true});
    ready=true;
    t0=performance.now();
    render(t0);                 // draw one frame immediately
    rafId=requestAnimationFrame(loop);
  }

  // expose rebuild for tweaks
  window.__portraitRebuild=function(){ if(window.__portraitImg){ build(window.__portraitImg); } };

  const img=new Image();
  img.onload=()=>{ window.__portraitImg=img; build(img); start(); };
  img.onerror=()=>{ console.warn('portrait failed to load'); };
  img.src=cfg.src;
})();
