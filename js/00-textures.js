/* procedural texture library — all CanvasTexture, drawn once at load */
const TEX={};
(function(){
  // ---- shared helpers (module-local) ----
  // TEX.mk(w,h,drawFn,opts) — create a configured CanvasTexture.
  //   opts.clamp:true => ClampToEdgeWrapping (for sky/hills); default RepeatWrapping.
  //   opts.alpha not needed (canvas is always RGBA). Sets anisotropy=4, needsUpdate.
  function mk(w,h,drawFn,opts){
    opts=opts||{};
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const ctx=cv.getContext('2d');
    drawFn(ctx,w,h);
    const t=new THREE.CanvasTexture(cv);
    const wrap=opts.clamp?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
    t.wrapS=t.wrapT=wrap;
    t.anisotropy=4;
    t.needsUpdate=true;
    return t;
  }
  TEX.mk=mk;

  // ---- deterministic RNG (so textures are stable run-to-run) ----
  let _seed=1234567;
  function rnd(){ _seed=(_seed*1103515245+12345)&0x7fffffff; return _seed/0x7fffffff; }
  function rseed(s){ _seed=(s|0)||1; }
  function rr(a,b){ return a+(b-a)*rnd(); }
  TEX.rnd=rnd; TEX.rseed=rseed; TEX.rr=rr;

  // ---- fill a flat base color ----
  function fill(ctx,w,h,col){ ctx.fillStyle=col; ctx.fillRect(0,0,w,h); }
  TEX.fill=fill;

  // ---- value-noise lattice, bilinear-sampled, TILEABLE (lattice wraps mod cells) ----
  // returns function n(x,y) in [0,1] over domain [0,w]x[0,h] with 'cells' periods.
  function makeNoise(w,h,cells){
    const g=new Float32Array((cells+1)*(cells+1));
    for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){ g[j*(cells+1)+i]=rnd(); }
    // wrap edges so it tiles
    for(let j=0;j<=cells;j++) g[j*(cells+1)+cells]=g[j*(cells+1)+0];
    for(let i=0;i<=cells;i++) g[cells*(cells+1)+i]=g[0*(cells+1)+i];
    const sm=t=>t*t*(3-2*t);
    return function(x,y){
      const fx=(x/w)*cells, fy=(y/h)*cells;
      let x0=Math.floor(fx), y0=Math.floor(fy);
      const tx=sm(fx-x0), ty=sm(fy-y0);
      x0=((x0%cells)+cells)%cells; y0=((y0%cells)+cells)%cells;
      const x1=(x0+1), y1=(y0+1);
      const a=g[y0*(cells+1)+x0], b=g[y0*(cells+1)+x1];
      const c=g[y1*(cells+1)+x0], d=g[y1*(cells+1)+x1];
      const top=a+(b-a)*tx, bot=c+(d-c)*tx;
      return top+(bot-top)*ty;
    };
  }
  TEX.makeNoise=makeNoise;
  // fractal brownian motion sum of noise octaves, tileable, returns fn ->[0,1]
  function makeFbm(w,h,baseCells,octaves){
    const layers=[]; let amp=1,tot=0,cells=baseCells;
    for(let o=0;o<octaves;o++){ layers.push({n:makeNoise(w,h,cells),amp:amp}); tot+=amp; amp*=0.5; cells*=2; }
    return function(x,y){ let s=0; for(const L of layers) s+=L.n(x,y)*L.amp; return s/tot; };
  }
  TEX.makeFbm=makeFbm;

  // ---- draw a small dot with wrap-around copies so it never clips an edge ----
  function wrapDot(ctx,w,h,x,y,r,col){
    ctx.fillStyle=col;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      ctx.beginPath(); ctx.arc(x+dx*w,y+dy*h,r,0,7); ctx.fill();
    }
  }
  TEX.wrapDot=wrapDot;
  // ---- draw a short stroke (blade/ridge) with wrap copies ----
  function wrapStroke(ctx,w,h,x,y,len,ang,width,col){
    ctx.strokeStyle=col; ctx.lineWidth=width; ctx.lineCap='round';
    const dx=Math.cos(ang)*len, dy=Math.sin(ang)*len;
    for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
      ctx.beginPath(); ctx.moveTo(x+ox*w,y+oy*h); ctx.lineTo(x+ox*w+dx,y+oy*h+dy); ctx.stroke();
    }
  }
  TEX.wrapStroke=wrapStroke;
  // ---- draw a soft radial blob with wrap copies ----
  function wrapBlob(ctx,w,h,x,y,r,inner,outer){
    for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
      const g=ctx.createRadialGradient(x+ox*w,y+oy*h,0,x+ox*w,y+oy*h,r);
      g.addColorStop(0,inner); g.addColorStop(1,outer);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x+ox*w,y+oy*h,r,0,7); ctx.fill();
    }
  }
  TEX.wrapBlob=wrapBlob;
  // ---- speckle grunge: n specks, wrap-safe ----
  function speckle(ctx,w,h,n,rmin,rmax,cols){
    for(let i=0;i<n;i++){
      const x=rr(0,w),y=rr(0,h),r=rr(rmin,rmax);
      wrapDot(ctx,w,h,x,y,r,cols[(rnd()*cols.length)|0]);
    }
  }
  TEX.speckle=speckle;

  // ================= GROUND / NATURE TEXTURES (chunk 1) =================

  // ---- GRASS + BUMP -------------------------------------------------
  function drawGrass(ctx,w,h,bump){
    rseed(101);
    const patch=makeFbm(w,h,4,3);
    fill(ctx,w,h, bump?'#7a7a7a':'#546e33');
    // low-freq patch mottling written per-pixel
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=patch(x,y), i=(y*w+x)*4;
      if(bump){ const v=90+n*90|0; d[i]=d[i+1]=d[i+2]=v; }
      else{
        d[i]=(70+(n-0.5)*44)|0; d[i+1]=(98+(n-0.5)*50)|0; d[i+2]=(48+(n-0.5)*30)|0;
      }
      d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // dry-yellow patches (a few soft blobs)
    rseed(202);
    for(let k=0;k<5;k++){
      const x=rr(0,w),y=rr(0,h),r=rr(20,46);
      if(bump) wrapBlob(ctx,w,h,x,y,r,'rgba(150,150,150,0.5)','rgba(150,150,150,0)');
      else wrapBlob(ctx,w,h,x,y,r,'rgba(150,140,64,0.45)','rgba(150,140,64,0)');
    }
    // fine vertical blade streaks (high-freq short strokes)
    rseed(303);
    const N=bump?1400:1800;
    for(let i=0;i<N;i++){
      const x=rr(0,w),y=rr(0,h),len=rr(3,7);
      const ang=-Math.PI/2+rr(-0.28,0.28), lit=rnd();
      let col;
      if(bump){ const v=lit>0.5?200:70; col='rgba('+v+','+v+','+v+',0.5)'; }
      else col = lit>0.66 ? 'rgba(126,158,78,0.55)' : lit>0.33 ? 'rgba(58,82,36,0.5)' : 'rgba(96,124,58,0.5)';
      wrapStroke(ctx,w,h,x,y,len,ang,rr(0.7,1.3),col);
    }
    // tiny clover dots (color only)
    if(!bump){
      rseed(404);
      for(let i=0;i<24;i++) wrapDot(ctx,w,h,rr(0,w),rr(0,h),rr(1.1,2.0),'rgba(74,120,52,0.8)');
    }
  }
  TEX.grass=mk(256,256,(c,w,h)=>drawGrass(c,w,h,false));
  TEX.grassBump=mk(256,256,(c,w,h)=>drawGrass(c,w,h,true));

  // ---- DIRT DRIVEWAY + BUMP ----------------------------------------
  function drawDirt(ctx,w,h,bump){
    rseed(111);
    const grain=makeFbm(w,h,8,4);
    fill(ctx,w,h, bump?'#888':'#8a6f4c');
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=grain(x,y), u=x/w;
      // two soft parallel ruts (vertical bands) — recessed / darker
      const rut=Math.exp(-Math.pow((u-0.34)/0.07,2))+Math.exp(-Math.pow((u-0.66)/0.07,2));
      const i=(y*w+x)*4;
      if(bump){
        let v=118+(n-0.5)*70-rut*40; v=v<0?0:v>255?255:v; d[i]=d[i+1]=d[i+2]=v;
      }else{
        const s=(n-0.5)*46-rut*26;
        d[i]=(142+s)|0; d[i+1]=(114+s*0.9)|0; d[i+2]=(78+s*0.7)|0;
      }
      d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // scattered pebbles: base speck + light highlight
    rseed(222);
    for(let i=0;i<220;i++){
      const x=rr(0,w),y=rr(0,h),r=rr(1.2,3.2);
      if(bump){
        wrapDot(ctx,w,h,x,y,r,'rgba(210,210,210,0.85)');
        wrapDot(ctx,w,h,x+r*0.3,y-r*0.3,r*0.4,'rgba(255,255,255,0.9)');
      }else{
        wrapDot(ctx,w,h,x,y,r, rnd()>0.5?'rgba(120,104,80,0.9)':'rgba(168,150,120,0.9)');
        wrapDot(ctx,w,h,x-r*0.3,y-r*0.3,r*0.4,'rgba(220,210,190,0.7)');
      }
    }
    // fine dust speckle
    rseed(333);
    speckle(ctx,w,h,600,0.4,0.9, bump?['rgba(140,140,140,0.3)','rgba(100,100,100,0.3)']:['rgba(110,92,66,0.3)','rgba(160,140,108,0.3)']);
  }
  TEX.dirt=mk(256,256,(c,w,h)=>drawDirt(c,w,h,false));
  TEX.dirtBump=mk(256,256,(c,w,h)=>drawDirt(c,w,h,true));

  // ---- SOIL (dark cool under-structure) ----------------------------
  TEX.soil=mk(256,256,(ctx,w,h)=>{
    rseed(121);
    const grain=makeFbm(w,h,10,4);
    fill(ctx,w,h,'#3a3630');
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=grain(x,y), i=(y*w+x)*4, s=(n-0.5)*22; // LOW contrast
      d[i]=(58+s)|0; d[i+1]=(54+s)|0; d[i+2]=(52+s)|0; d[i+3]=255; // slight cool lift
    }
    ctx.putImageData(img,0,0);
    rseed(232);
    speckle(ctx,w,h,400,0.5,1.2,['rgba(30,30,34,0.4)','rgba(80,78,74,0.35)']);
  });

  // ---- BARK + BUMP --------------------------------------------------
  function drawBark(ctx,w,h,bump){
    rseed(131);
    const ridge=makeFbm(w,h,6,3);
    fill(ctx,w,h, bump?'#777':'#5c3f28');
    // vertical ridge streaks: long wandering vertical strokes, alternating light/dark
    const cols=Math.floor(w/5);
    for(let c=0;c<cols;c++){
      const x=(c/cols)*w+rr(-1.5,1.5);
      const lit=ridge(x,0)*0.6+rnd()*0.4;
      let col;
      if(bump){ const v=(70+lit*150)|0; col='rgba('+v+','+v+','+v+',0.8)'; }
      else{
        const base= lit>0.55?[122,88,54] : lit>0.3?[92,64,40] : [66,44,28];
        col='rgba('+base[0]+','+base[1]+','+base[2]+',0.85)';
      }
      ctx.strokeStyle=col; ctx.lineWidth=rr(2.2,4.5); ctx.lineCap='round';
      let px=x;
      ctx.beginPath(); ctx.moveTo(px,-6);
      for(let y=0;y<=h+6;y+=8){ px=x+Math.sin((y/h)*6+c)*1.6+rr(-0.8,0.8); ctx.lineTo(px,y); }
      ctx.stroke();
    }
    // furrow darkening between ridges (fine dark vertical lines)
    rseed(242);
    for(let i=0;i<160;i++){
      const x=rr(0,w),y=rr(0,h),len=rr(10,40);
      wrapStroke(ctx,w,h,x,y,len,Math.PI/2+rr(-0.05,0.05),rr(0.6,1.3), bump?'rgba(40,40,40,0.5)':'rgba(38,26,16,0.45)');
    }
    // a knot or two — concentric dark rings, recessed
    rseed(353);
    for(let k=0;k<2;k++){
      const cx=rr(w*0.2,w*0.8), cy=rr(h*0.2,h*0.8);
      for(let ring=8;ring>=1;ring--){
        const rad=ring*2.2+2; ctx.lineWidth=1.6; ctx.beginPath();
        ctx.ellipse(cx,cy,rad,rad*1.4,0,0,7);
        ctx.strokeStyle= bump?'rgba(50,50,50,0.5)':(ring%2?'rgba(44,30,18,0.55)':'rgba(96,68,42,0.4)');
        ctx.stroke();
      }
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,7);
      g.addColorStop(0, bump?'rgba(30,30,30,0.85)':'rgba(30,20,12,0.8)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,7,10,0,0,7); ctx.fill();
    }
    // grunge speckle
    rseed(464);
    speckle(ctx,w,h,300,0.5,1.3, bump?['rgba(60,60,60,0.3)','rgba(180,180,180,0.25)']:['rgba(40,28,18,0.3)','rgba(140,104,66,0.25)']);
  }
  TEX.bark=mk(256,512,(c,w,h)=>drawBark(c,w,h,false));
  TEX.barkBump=mk(256,512,(c,w,h)=>drawBark(c,w,h,true));

  // ---- FOLIAGE (leafy canopy clump) --------------------------------
  TEX.foliage=mk(256,256,(ctx,w,h)=>{
    rseed(141);
    fill(ctx,w,h,'#2f5220');
    const greens=[[47,74,32],[63,107,42],[85,122,46],[110,150,60]];
    function blob(x,y,r,col,a){
      wrapBlob(ctx,w,h,x,y,r,'rgba('+col[0]+','+col[1]+','+col[2]+','+a+')','rgba('+col[0]+','+col[1]+','+col[2]+',0)');
    }
    // interior shadow layer
    for(let i=0;i<40;i++) blob(rr(0,w),rr(0,h),rr(14,30),[30,48,22],0.5);
    // mid greens
    for(let i=0;i<90;i++) blob(rr(0,w),rr(0,h),rr(8,22),greens[1+((rnd()*2)|0)],0.55);
    // dappled highlights on top
    for(let i=0;i<70;i++) blob(rr(0,w),rr(0,h),rr(4,11),greens[3],0.5);
    // small leaf specks
    rseed(252);
    for(let i=0;i<500;i++){
      const g=greens[(rnd()*greens.length)|0];
      wrapDot(ctx,w,h,rr(0,w),rr(0,h),rr(0.8,1.8),'rgba('+g[0]+','+g[1]+','+g[2]+',0.6)');
    }
  });

  // ================= STRUCTURE / BUILT-SURFACE TEXTURES (chunk 2) =================

  // ---- ROOF SHINGLES + BUMP ----------------------------------------
  // Horizontal courses of asphalt tabs, staggered vertical tab lines per row.
  function drawShingle(ctx,w,h,bump){
    rseed(501);
    const grain=makeFbm(w,h,10,4);
    const courses=6;                 // horizontal rows
    const ch=h/courses;              // course height
    const tabsPerRow=8;              // tabs across
    const tw=w/tabsPerRow;           // tab width
    fill(ctx,w,h, bump?'#8a8a8a':'#4a4744');
    // per-pixel base: asphalt grain + a soft shadow gradient toward bottom of each course
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++){
      const cy=(y%ch)/ch;            // 0 at top of course, 1 at bottom
      // recessed shadow line at the very bottom (course overlap)
      const gap=Math.exp(-Math.pow((cy-0.985)/0.03,2));
      const topLift=Math.exp(-Math.pow((cy-0.04)/0.06,2)); // slight raised top edge
      for(let x=0;x<w;x++){
        const n=grain(x,y), i=(y*w+x)*4;
        if(bump){
          let v=150+(n-0.5)*36 - gap*120 + topLift*36;
          v=v<0?0:v>255?255:v; d[i]=d[i+1]=d[i+2]=v;
        }else{
          const s=(n-0.5)*30 - gap*46;
          d[i]  =(74+s)|0;
          d[i+1]=(71+s)|0;
          d[i+2]=(68+s)|0;
        }
        d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    // per-tab tone variance + staggered vertical tab gaps
    for(let r=0;r<courses;r++){
      const yTop=r*ch;
      const off=(r%2)*(tw*0.5);     // stagger every other row by half a tab
      for(let tcol=-1;tcol<tabsPerRow;tcol++){
        const xL=tcol*tw+off;
        // per-tab tone patch (color only, subtle)
        if(!bump){
          const t=rr(-14,10);
          ctx.fillStyle='rgba('+(74+t|0)+','+(71+t|0)+','+(68+t|0)+',0.35)';
          ctx.fillRect(xL,yTop, tw, ch*0.98);
        }
        // vertical tab gap line (dark recessed slot)
        const gx=xL;
        wrapStroke(ctx,w,h,gx, yTop+ch*0.55, ch*0.9, Math.PI/2, bump?2.2:1.6,
                   bump?'rgba(40,40,40,0.85)':'rgba(24,22,20,0.7)');
      }
    }
    // course shadow line reinforcement (thin dark horizontal band under each course)
    for(let r=1;r<=courses;r++){
      const y=r*ch;
      wrapStroke(ctx,w,h,0,y-1,w,0, bump?3:2.4, bump?'rgba(30,30,30,0.9)':'rgba(20,18,16,0.55)');
    }
    // granular asphalt speckle
    rseed(611);
    speckle(ctx,w,h, bump?260:520, 0.4,1.1,
      bump?['rgba(120,120,120,0.3)','rgba(190,190,190,0.28)']
          :['rgba(30,28,26,0.4)','rgba(110,104,96,0.35)','rgba(150,128,96,0.2)']);
  }
  TEX.shingle    =mk(256,256,(c,w,h)=>drawShingle(c,w,h,false));
  TEX.shingleBump=mk(256,256,(c,w,h)=>drawShingle(c,w,h,true));

  // ---- LAP SIDING (clapboard) — no bump ----------------------------
  TEX.siding=mk(256,256,(ctx,w,h)=>{
    rseed(521);
    const grain=makeFbm(w,h,6,3);
    const courses=9;                 // horizontal boards
    const ch=h/courses;
    fill(ctx,w,h,'#d9d6cc');
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++){
      const cy=(y%ch)/ch;            // 0 top of board .. 1 bottom
      // shadow line beneath each board (bottom), highlight along top
      const shadow=Math.exp(-Math.pow((cy-0.97)/0.05,2));
      const hilite=Math.exp(-Math.pow((cy-0.06)/0.07,2));
      // gentle across-board shading (board bows out slightly)
      const bow=Math.sin(cy*Math.PI)*6;
      for(let x=0;x<w;x++){
        const n=grain(x,y), i=(y*w+x)*4;
        const s=(n-0.5)*10 + bow - shadow*70 + hilite*20;
        d[i]  =(217+s)|0;
        d[i+1]=(214+s)|0;
        d[i+2]=(204+s*0.9)|0;
        d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    // faint vertical grain streaks
    rseed(631);
    for(let i=0;i<300;i++){
      const x=rr(0,w),y=rr(0,h),len=rr(6,20);
      wrapStroke(ctx,w,h,x,y,len,Math.PI/2+rr(-0.03,0.03),rr(0.5,1.0),'rgba(150,146,134,0.18)');
    }
    // reinforce crisp shadow line under each course
    for(let r=1;r<courses;r++){
      wrapStroke(ctx,w,h,0,r*ch-0.5,w,0,1.4,'rgba(120,116,104,0.5)');
      wrapStroke(ctx,w,h,0,r*ch+1.2,w,0,1.0,'rgba(240,238,230,0.45)');
    }
    // sparse weathering speckle
    rseed(641);
    speckle(ctx,w,h,180,0.4,0.9,['rgba(160,155,140,0.18)','rgba(120,115,100,0.14)']);
  });

  // ---- DECK PLANKS + BUMP ------------------------------------------
  // Vertical planks separated by dark gaps, grain streaks, a few knots.
  function drawPlank(ctx,w,h,bump){
    rseed(541);
    const grain=makeFbm(w,h,8,3);
    const planks=5;                  // vertical boards
    const pw=w/planks;
    fill(ctx,w,h, bump?'#9a9a9a':'#8a7a62');
    // per-board base tone (weathered gray-brown, varies board to board)
    const tone=[];
    for(let p=0;p<planks;p++) tone[p]=rr(-16,14);
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let x=0;x<w;x++){
      const p=Math.floor(x/pw), px=(x%pw)/pw; // 0..1 across board
      // gap darkening near board edges
      const gap=Math.exp(-Math.pow((px-0.0)/0.03,2))+Math.exp(-Math.pow((px-1.0)/0.03,2));
      // crown highlight in the middle of each board
      const crown=Math.exp(-Math.pow((px-0.5)/0.4,2));
      const t=tone[p];
      for(let y=0;y<h;y++){
        const n=grain(x,y), i=(y*w+x)*4;
        if(bump){
          let v=150+(n-0.5)*30 - gap*130 + crown*24;
          v=v<0?0:v>255?255:v; d[i]=d[i+1]=d[i+2]=v;
        }else{
          const s=(n-0.5)*30 + t - gap*70 + crown*10;
          d[i]  =(138+s)|0;
          d[i+1]=(122+s*0.9)|0;
          d[i+2]=(98+s*0.75)|0;
        }
        d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    // long vertical grain streaks per plank
    rseed(651);
    for(let i=0;i<420;i++){
      const x=rr(0,w),y=rr(0,h),len=rr(20,70);
      const lit=rnd();
      let col;
      if(bump){ const v=lit>0.5?185:95; col='rgba('+v+','+v+','+v+',0.35)'; }
      else col= lit>0.5?'rgba(96,82,60,0.3)':'rgba(160,144,116,0.28)';
      wrapStroke(ctx,w,h,x,y,len,Math.PI/2+rr(-0.02,0.02),rr(0.5,1.1),col);
    }
    // knots — concentric rings, recessed
    rseed(661);
    for(let k=0;k<3;k++){
      const p=(rnd()*planks)|0;
      const cx=p*pw+pw*rr(0.3,0.7), cy=rr(h*0.12,h*0.88);
      for(let ring=6;ring>=1;ring--){
        const rad=ring*1.9+2; ctx.lineWidth=1.4; ctx.beginPath();
        ctx.ellipse(cx,cy,rad*0.8,rad*1.5,0,0,7);
        ctx.strokeStyle= bump?'rgba(70,70,70,0.55)':(ring%2?'rgba(70,54,34,0.5)':'rgba(120,100,72,0.35)');
        ctx.stroke();
      }
      wrapBlob(ctx,w,h,cx,cy,7, bump?'rgba(55,55,55,0.85)':'rgba(58,44,28,0.8)', bump?'rgba(55,55,55,0)':'rgba(58,44,28,0)');
    }
    // dark gap lines between planks (crisp)
    for(let p=0;p<=planks;p++){
      wrapStroke(ctx,w,h,p*pw,0,h,Math.PI/2, bump?3.2:2.6, bump?'rgba(30,30,30,0.9)':'rgba(40,32,22,0.7)');
    }
    // grunge speckle
    rseed(671);
    speckle(ctx,w,h, bump?200:360, 0.4,1.1,
      bump?['rgba(120,120,120,0.28)','rgba(180,180,180,0.24)']
          :['rgba(80,66,48,0.28)','rgba(170,152,120,0.24)']);
  }
  TEX.plank    =mk(256,256,(c,w,h)=>drawPlank(c,w,h,false));
  TEX.plankBump=mk(256,256,(c,w,h)=>drawPlank(c,w,h,true));

  // ---- SHED WALL: rough-sawn vertical boards, faded paint — no bump -
  TEX.shedWood=mk(256,256,(ctx,w,h)=>{
    rseed(561);
    const grain=makeFbm(w,h,7,4);
    const boards=6;
    const bw=w/boards;
    fill(ctx,w,h,'#6b5a44');
    const tone=[];
    for(let p=0;p<boards;p++) tone[p]=rr(-20,12);
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let x=0;x<w;x++){
      const p=Math.floor(x/bw), px=(x%bw)/bw;
      const gap=Math.exp(-Math.pow((px-0.0)/0.025,2))+Math.exp(-Math.pow((px-1.0)/0.025,2));
      const t=tone[p];
      for(let y=0;y<h;y++){
        const n=grain(x,y), i=(y*w+x)*4;
        const s=(n-0.5)*44 + t - gap*80; // rougher, higher-contrast than deck
        d[i]  =(107+s)|0;
        d[i+1]=(90+s*0.9)|0;
        d[i+2]=(68+s*0.75)|0;
        d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    // faded paint patches — muted color blotches partly worn off
    rseed(571);
    const paints=[[120,132,120],[150,120,96],[96,110,128]]; // muted sage / tan / dusty blue
    for(let k=0;k<2;k++){
      const pc=paints[(rnd()*paints.length)|0];
      const cx=rr(0,w),cy=rr(0,h),r=rr(34,64);
      // patchy fill via several soft blobs with low alpha (worn look)
      for(let b=0;b<14;b++){
        const bx=cx+rr(-r*0.7,r*0.7), by=cy+rr(-r*0.7,r*0.7), br=rr(6,r*0.5);
        wrapBlob(ctx,w,h,bx,by,br,
          'rgba('+pc[0]+','+pc[1]+','+pc[2]+','+rr(0.12,0.32).toFixed(2)+')',
          'rgba('+pc[0]+','+pc[1]+','+pc[2]+',0)');
      }
    }
    // long rough grain streaks
    rseed(581);
    for(let i=0;i<520;i++){
      const x=rr(0,w),y=rr(0,h),len=rr(16,80);
      const lit=rnd();
      const col= lit>0.5?'rgba(70,56,38,0.34)':'rgba(150,132,104,0.28)';
      wrapStroke(ctx,w,h,x,y,len,Math.PI/2+rr(-0.025,0.025),rr(0.5,1.3),col);
    }
    // knots
    rseed(591);
    for(let k=0;k<4;k++){
      const p=(rnd()*boards)|0;
      const cx=p*bw+bw*rr(0.25,0.75), cy=rr(h*0.1,h*0.9);
      for(let ring=5;ring>=1;ring--){
        const rad=ring*1.7+2; ctx.lineWidth=1.3; ctx.beginPath();
        ctx.ellipse(cx,cy,rad*0.75,rad*1.5,0,0,7);
        ctx.strokeStyle= ring%2?'rgba(52,40,24,0.55)':'rgba(110,90,64,0.35)';
        ctx.stroke();
      }
      wrapBlob(ctx,w,h,cx,cy,6,'rgba(44,32,20,0.8)','rgba(44,32,20,0)');
    }
    // dark gaps between boards
    for(let p=0;p<=boards;p++){
      wrapStroke(ctx,w,h,p*bw,0,h,Math.PI/2,3.0,'rgba(28,20,12,0.75)');
    }
    // grunge speckle
    rseed(601);
    speckle(ctx,w,h,420,0.4,1.2,['rgba(50,40,26,0.3)','rgba(160,142,112,0.24)']);
  });

  // ---- RUSTY CAR BODY — no bump ------------------------------------
  TEX.rust=mk(256,256,(ctx,w,h)=>{
    rseed(581);
    const paintN=makeFbm(w,h,5,3);
    const rustN =makeFbm(w,h,4,4);
    // base: faded teal paint
    fill(ctx,w,h,'#3a6273');
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const pn=paintN(x,y), rn=rustN(x,y), i=(y*w+x)*4;
      // paint variation
      let R=58+(pn-0.5)*26, G=98+(pn-0.5)*30, B=115+(pn-0.5)*30;
      // rust eats where rustN is high
      const rust=Math.max(0,(rn-0.5)*2.2); // 0..~1.1
      if(rust>0){
        const rc=Math.min(1,rust);
        // orange-brown rust colors, deeper where stronger
        const ro= rc>0.6? [90,58,40] : [138,74,43]; // #5a2e18-ish deep vs #8a4a2b
        R=R*(1-rc)+ro[0]*rc;
        G=G*(1-rc)+ro[1]*rc;
        B=B*(1-rc)+ro[2]*rc;
      }
      d[i]=R|0; d[i+1]=G|0; d[i+2]=B|0; d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // vertical drip streaks running DOWN from rust spots
    rseed(591);
    for(let i=0;i<70;i++){
      const x=rr(0,w), y=rr(0,h*0.7), len=rr(18,70);
      const dc= rnd()>0.5?[138,74,43]:[90,52,32];
      // taper: draw as fading segments downward
      const segs=8;
      for(let s=0;s<segs;s++){
        const a=(1-s/segs)*0.5;
        const yy=y+ (len*s/segs);
        wrapStroke(ctx,w,h,x+rr(-0.6,0.6),yy,len/segs+1,Math.PI/2, rr(1.2,2.6),
          'rgba('+dc[0]+','+dc[1]+','+dc[2]+','+a.toFixed(2)+')');
      }
    }
    // rust bloom blobs (crusty edges)
    rseed(601);
    for(let i=0;i<26;i++){
      const x=rr(0,w),y=rr(0,h),r=rr(6,22);
      wrapBlob(ctx,w,h,x,y,r,'rgba(150,82,46,0.5)','rgba(90,50,30,0)');
    }
    // pitting speckle (dark corrosion pits + a few paint flecks)
    rseed(611);
    speckle(ctx,w,h,700,0.4,1.4,
      ['rgba(40,24,14,0.4)','rgba(110,60,34,0.35)','rgba(70,110,124,0.2)']);
  });

  // ---- CHAINLINK — RGBA ALPHA lattice, transparent interiors -------
  TEX.chainlink=mk(256,256,(ctx,w,h)=>{
    rseed(621);
    // transparent background — DO NOT fill opaque
    ctx.clearRect(0,0,w,h);
    const spacing=32;                // diamond pitch (must divide w & h evenly => tiles)
    const lw=3.2;                    // strand width
    ctx.lineCap='round';
    // helper: draw a full family of parallel diagonal lines, wrapped, with woven shading.
    // slope +1 lines: x - y = const ; slope -1 lines: x + y = const
    function drawFamily(sign){
      // c ranges to cover the canvas plus wrap margin
      for(let c=-h; c<=w+h; c+=spacing){
        // main strand
        ctx.strokeStyle='rgba(150,154,158,1)';
        ctx.lineWidth=lw;
        ctx.beginPath();
        if(sign>0){ // x - y = c  => y = x - c
          ctx.moveTo(-8, -8 - c);
          ctx.lineTo(w+8, w+8 - c);
        }else{      // x + y = c  => y = c - x
          ctx.moveTo(-8, c + 8);
          ctx.lineTo(w+8, c - w - 8);
        }
        ctx.stroke();
        // highlight core (woven light)
        ctx.strokeStyle='rgba(205,208,210,0.9)';
        ctx.lineWidth=lw*0.4;
        ctx.beginPath();
        if(sign>0){
          ctx.moveTo(-8, -8 - c);
          ctx.lineTo(w+8, w+8 - c);
        }else{
          ctx.moveTo(-8, c + 8);
          ctx.lineTo(w+8, c - w - 8);
        }
        ctx.stroke();
      }
    }
    // dark under-shadow first (slightly offset) for weave depth
    function drawShadow(sign){
      ctx.strokeStyle='rgba(40,42,44,0.7)';
      ctx.lineWidth=lw+1.2;
      for(let c=-h; c<=w+h; c+=spacing){
        ctx.beginPath();
        if(sign>0){
          ctx.moveTo(-8, -8 - c +1);
          ctx.lineTo(w+8, w+8 - c +1);
        }else{
          ctx.moveTo(-8, c + 8 +1);
          ctx.lineTo(w+8, c - w - 8 +1);
        }
        ctx.stroke();
      }
    }
    drawShadow(+1); drawShadow(-1);
    drawFamily(+1); drawFamily(-1);
  });

  // ================= GROUND SURFACES + SKY / HILLS (chunk 3) =================

  // ---- ASPHALT ROAD — fine dark aggregate, specks, faint cracks (repeat) ----
  TEX.asphalt=mk(256,256,(ctx,w,h)=>{
    rseed(701);
    const grain=makeFbm(w,h,12,4);
    fill(ctx,w,h,'#3c3f42');
    // pass 1: fine per-pixel aggregate noise
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=grain(x,y), i=(y*w+x)*4, s=(n-0.5)*30; // low contrast
      d[i]=(60+s)|0; d[i+1]=(63+s)|0; d[i+2]=(66+s)|0; d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // pass 2: tiny light + dark aggregate specks
    rseed(702);
    speckle(ctx,w,h,900,0.4,1.1,
      ['rgba(150,152,154,0.4)','rgba(120,122,124,0.35)','rgba(24,25,27,0.45)','rgba(90,80,70,0.25)']);
    // pass 3: a few faint hairline cracks — thin irregular dark polylines
    rseed(703);
    for(let k=0;k<7;k++){
      let x=rr(0,w), y=rr(0,h);
      const dir=rr(0,Math.PI*2);
      let ang=dir;
      ctx.strokeStyle='rgba(22,23,25,0.45)';
      ctx.lineWidth=rr(0.6,1.1);
      ctx.lineCap='round';
      const segs=(rr(5,10))|0;
      // draw with wrap copies so cracks tile
      for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
        let px=x+ox*w, py=y+oy*h, a=ang;
        ctx.beginPath(); ctx.moveTo(px,py);
        for(let s=0;s<segs;s++){
          a+=rr(-0.6,0.6);
          px+=Math.cos(a)*rr(6,16); py+=Math.sin(a)*rr(6,16);
          ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
    }
  });

  // ---- CONCRETE — light gray, mottled staining, faint joints (repeat) ----
  TEX.concrete=mk(256,256,(ctx,w,h)=>{
    rseed(711);
    const mottle=makeFbm(w,h,7,4);
    fill(ctx,w,h,'#b9bab7');
    // pass 1: per-pixel subtle mottle
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=mottle(x,y), i=(y*w+x)*4, s=(n-0.5)*20; // low contrast
      d[i]=(185+s)|0; d[i+1]=(186+s)|0; d[i+2]=(183+s)|0; d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // pass 2: soft low-alpha darker staining blotches
    rseed(712);
    for(let k=0;k<14;k++){
      const x=rr(0,w),y=rr(0,h),r=rr(18,52);
      wrapBlob(ctx,w,h,x,y,r,'rgba(120,120,116,0.16)','rgba(120,120,116,0)');
    }
    // pass 3: a couple faint control-joint hairlines + fine speckle
    rseed(713);
    // one vertical + one horizontal joint at pseudo-random positions
    wrapStroke(ctx,w,h,rr(w*0.3,w*0.7),0,h,Math.PI/2,1.2,'rgba(140,140,136,0.5)');
    wrapStroke(ctx,w,h,0,rr(h*0.3,h*0.7),w,0,1.2,'rgba(140,140,136,0.5)');
    speckle(ctx,w,h,700,0.4,0.9,
      ['rgba(150,150,146,0.3)','rgba(200,200,196,0.28)','rgba(110,110,106,0.22)']);
  });

  // ---- PUDDLE BUMP — mostly flat mid-gray, subtle concentric ripples (repeat) ----
  TEX.puddleBump=mk(256,256,(ctx,w,h)=>{
    rseed(721);
    const wob=makeFbm(w,h,6,3);
    fill(ctx,w,h,'#808080');
    // pass 1: gentle low-amplitude noise around 128
    const img=ctx.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=wob(x,y), i=(y*w+x)*4;
      let v=128+(n-0.5)*14; v=v<0?0:v>255?255:v; // very low contrast
      d[i]=d[i+1]=d[i+2]=v|0; d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    // pass 2 + 3: a few soft concentric ripple ring sets (light+dark thin rings)
    rseed(722);
    for(let k=0;k<3;k++){
      const cx=rr(0,w), cy=rr(0,h);
      const rings=(rr(4,7))|0, step=rr(8,13);
      for(let r=1;r<=rings;r++){
        const rad=r*step;
        const lw=rr(1.0,2.0);
        // wrapped light ring
        ctx.lineWidth=lw;
        for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
          ctx.strokeStyle='rgba(160,160,160,0.20)';
          ctx.beginPath(); ctx.arc(cx+ox*w,cy+oy*h,rad,0,7); ctx.stroke();
          ctx.strokeStyle='rgba(96,96,96,0.18)';
          ctx.beginPath(); ctx.arc(cx+ox*w,cy+oy*h,rad+lw,0,7); ctx.stroke();
        }
      }
    }
  });

  // ---- SKY GRADIENT — vertical, neutral light-gray w/ hint of blue (CLAMP) ----
  TEX.skyGrad=mk(64,256,(ctx,w,h)=>{
    rseed(731);
    // top (y=0) = zenith slightly deeper; bottom (y=h) = horizon near-white.
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0.0,'#c4c9d0'); // zenith: light gray, faint blue
    g.addColorStop(0.5,'#d4d8dd');
    g.addColorStop(0.82,'#e6e8ea');
    g.addColorStop(1.0,'#f2f2f0'); // horizon: near-white, neutral
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // a few very faint lighter horizontal bands (haze layers)
    for(let k=0;k<4;k++){
      const y=rr(h*0.4,h*0.95), bh=rr(6,16);
      const bg=ctx.createLinearGradient(0,y-bh,0,y+bh);
      bg.addColorStop(0,'rgba(255,255,255,0)');
      bg.addColorStop(0.5,'rgba(255,255,255,0.10)');
      bg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=bg; ctx.fillRect(0,y-bh,w,bh*2);
    }
  },{clamp:true});

  // ---- HILLS (far + near) — RGBA forested-ridge silhouette strips (CLAMP) ----
  // Build a top-y profile per column, fill solid neutral mid-gray below,
  // transparent above, then add conifer-tip bumps along the ridge.
  function drawHills(ctx,w,h,near){
    ctx.clearRect(0,0,w,h);
    const col = near ? '#525a50' : '#586055'; // neutral mid-gray-green, near a touch darker
    ctx.fillStyle=col;
    // ridge parameters differ: near = jaggier + lower (closer/taller), far = smoother + higher
    const base = near ? h*0.42 : h*0.30;      // mean ridge height (y from top)
    const noise = makeNoise(w, 64, near?18:9); // 1-D-ish via sampling at fixed y
    // profile function: sum of a few sines + noise
    function ridgeY(x){
      const u=x/w;
      let y=base;
      if(near){
        y += Math.sin(u*Math.PI*2*3 + 0.6)*14;
        y += Math.sin(u*Math.PI*2*7 + 1.9)*7;
        y += Math.sin(u*Math.PI*2*13 + 4.1)*4;
        y += (noise(x,12)-0.5)*22;
      }else{
        y += Math.sin(u*Math.PI*2*2 + 1.2)*16;
        y += Math.sin(u*Math.PI*2*5 + 3.3)*6;
        y += (noise(x,20)-0.5)*10;
      }
      return y;
    }
    // fill solid below ridge as a single path
    ctx.beginPath();
    ctx.moveTo(0,h);
    for(let x=0;x<=w;x++) ctx.lineTo(x, ridgeY(x));
    ctx.lineTo(w,h); ctx.closePath(); ctx.fill();
    // conifer spikes poking up along the ridge (triangular tips)
    rseed(near?742:741);
    const tips = near? 80 : 34;
    for(let k=0;k<tips;k++){
      const x=rr(0,w);
      const gy=ridgeY(x);
      const th = near ? rr(6,20) : rr(3,9);   // tip height above ridge
      const tw = near ? rr(2.5,6) : rr(2,4.5); // half-width at base
      ctx.beginPath();
      ctx.moveTo(x, gy-th);
      ctx.lineTo(x-tw, gy+2);
      ctx.lineTo(x+tw, gy+2);
      ctx.closePath();
      ctx.fill();
    }
    // subtle darker base band at very bottom for depth (near only, low alpha)
    if(near){
      const bg=ctx.createLinearGradient(0,h*0.7,0,h);
      bg.addColorStop(0,'rgba(0,0,0,0)');
      bg.addColorStop(1,'rgba(0,0,0,0.18)');
      ctx.fillStyle=bg; ctx.fillRect(0,h*0.7,w,h*0.3);
    }
  }
  TEX.hillsFar =mk(1024,256,(c,w,h)=>drawHills(c,w,h,false),{clamp:true});
  TEX.hillsNear=mk(1024,256,(c,w,h)=>drawHills(c,w,h,true), {clamp:true});

})();
