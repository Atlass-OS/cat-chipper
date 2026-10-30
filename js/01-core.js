'use strict';
/* ============================================================ CAT CHIPPER
   Single-file three.js dark-comedy yeet-em-up.
   ============================================================ */
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const smoothstep=(x,e0,e1)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};

/* ---------------- terrain heightfield ----------------
   terrainH(x,z) = gentle rolling hills, FLATTENED to 0 near structures/chipper/driveway/road so
   gameplay-critical geometry (chipper intake, felling trees, building pads, the splat decal) stays level.
   Everything that sits on the ground adds terrainH(x,z) to its Y. Contract: pure function, no state.
   terrainRaw = the analytic curve (only the ground mesh vertices sample it); terrainH = the RENDERED surface. */
const _flatZones=[
  {x:4,z:28,r:11},   // chipper + truck + branch staging pallet
  {x:-42,z:-34,r:14},// house + porch + tea table
  {x:38,z:-22,r:8},  // mobile home
  {x:-26,z:-18,r:6}, // deck
  {x:30,z:12,r:5},   // rusty car
  {x:48,z:2,r:6},    // boat
  {x:-46,z:16,r:5},  // shed
  {x:-30,z:34,r:7},  // dog run
];
function terrainRaw(x,z){
  // gentle rolling lawn: a few long-wavelength waves, ~0.9m peak in open areas
  let h=Math.sin(x*0.045+1.3)*0.55 + Math.cos(z*0.038-0.7)*0.5 + Math.sin((x+z)*0.028)*0.32;
  let mask=1;
  for(let i=0;i<_flatZones.length;i++){
    const f=_flatZones[i];
    mask=Math.min(mask, smoothstep(Math.hypot(x-f.x,z-f.z), f.r*0.55, f.r));
  }
  // driveway corridor (x≈-10) stays flat so the crew/vehicles read level
  mask=Math.min(mask, smoothstep(Math.abs(x+10), 4, 7));
  // road + far verge (z≳58) flat
  mask=Math.min(mask, 1-smoothstep(z, 56, 63));
  return h*mask;
}
// The ground mesh (02-world) samples terrainRaw on a TERRAIN_SEGS grid and draws flat triangles between the
// samples; at the flat-zone edges that chord sits up to ~0.6m off the analytic curve. terrainH interpolates
// the same grid with the same triangle split as PlaneGeometry, so feet/gibs/decals land on the grass you SEE.
const TERRAIN_SIZE=320,TERRAIN_SEGS=128,_tCell=TERRAIN_SIZE/TERRAIN_SEGS,_tHalf=TERRAIN_SIZE/2;
function terrainH(x,z){
  // grid vertex (i,j) sits at world (-half+i*cell, -half+j*cell); PlaneGeometry faces are (a,b,d)+(b,c,d)
  const fx=(x+_tHalf)/_tCell,fz=(z+_tHalf)/_tCell;
  if(fx<0||fz<0||fx>=TERRAIN_SEGS||fz>=TERRAIN_SEGS)return terrainRaw(x,z); // off the mesh
  const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
  const x0=-_tHalf+i*_tCell,z0=-_tHalf+j*_tCell,x1=x0+_tCell,z1=z0+_tCell;
  const b=terrainRaw(x0,z1),d=terrainRaw(x1,z0);
  if(u+v<=1){const a=terrainRaw(x0,z0);return a+(d-a)*u+(b-a)*v;}
  const c=terrainRaw(x1,z1);return c+(b-c)*(1-u)+(d-c)*(1-v);
}

/* ---------------- renderer / scene ---------------- */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.1,400);
camera.rotation.order='YXZ';
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

/* ---------------- mood lighting rig ---------------- */
const hemi=new THREE.HemisphereLight(0xbfd6ff,0x3d4a33,0.55); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe0b0,1.35);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-75;sun.shadow.camera.right=75;
sun.shadow.camera.top=75;sun.shadow.camera.bottom=-75;
sun.shadow.camera.far=260;sun.shadow.bias=-0.0006;
scene.add(sun); scene.add(sun.target);
const chipperLight=new THREE.PointLight(0xff8833,0,18,2); scene.add(chipperLight);
const gooLight=new THREE.PointLight(0xff2211,0,10,2); scene.add(gooLight);
scene.fog=new THREE.Fog(0xcfe0ef,60,260);

/* ---------------- atmosphere sprites (cheap canvas glow/haze) ---------------- */
function radialTex(stops,size=128){
  const cv=document.createElement('canvas');cv.width=cv.height=size;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  for(const[o,c]of stops)g.addColorStop(o,c);
  ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(cv);
}
const sunGlowTex=radialTex([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']]);
const sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:sunGlowTex,color:0xffffff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));
sunGlow.scale.set(55,55,1);
scene.add(sunGlow);
const cloudTex=radialTex([[0,'rgba(255,255,255,.9)'],[.5,'rgba(255,255,255,.4)'],[1,'rgba(255,255,255,0)']]);
const clouds=[];
for(let i=0;i<5;i++){
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,color:0xffffff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.12,fog:false}));
  spr.position.set(rand(-120,120),rand(55,85),rand(-120,120));
  const s=rand(30,60);
  spr.scale.set(s,s*rand(.6,.9),1);
  clouds.push(spr);scene.add(spr);
}

// mood presets: game progresses golden morning -> hot noon -> blood dusk
const MOODS={
  dawn:  {sun:0xffddab,sunI:1.32,hemiSky:0xbfd6ff,hemiGnd:0x3d4a33,hemiI:.55,fog:0xe8d9c4,bg:0xf4e3c8,az:.85,el:.35,exp:1.05,fogNear:26,fogFar:200},
  noon:  {sun:0xfff2df,sunI:1.5, hemiSky:0xcfe4ff,hemiGnd:0x49543b,hemiI:.6, fog:0xd6e6f2,bg:0xbcd9f0,az:.15,el:1.05,exp:1.0, fogNear:70,fogFar:300},
  dusk:  {sun:0xff6a2d,sunI:1.15,hemiSky:0x7a6aa0,hemiGnd:0x33241f,hemiI:.5, fog:0xdba883,bg:0xe89a5a,az:-.9,el:.22,exp:1.08,fogNear:46,fogFar:240},
  blood: {sun:0xee2a1c,sunI:.88, hemiSky:0x552244,hemiGnd:0x1d0f0f,hemiI:.45,fog:0xa05545,bg:0x7e2f24,az:-1.2,el:.12,exp:1.09,fogNear:30,fogFar:185},
};
const moodCur=JSON.parse(JSON.stringify(MOODS.dawn));
let moodTarget=MOODS.dawn, strobeT=0, reduceFlash=false, fxShake=0, cloudT=0;
const _c1=new THREE.Color(),_c2=new THREE.Color();
function lerpHex(cur,tgt,k){_c1.setHex(cur);_c2.setHex(tgt);_c1.lerp(_c2,k);return _c1.getHex();}
function updateMood(dt){
  const k=1-Math.pow(0.25,dt); // smooth chase
  moodCur.sun=lerpHex(moodCur.sun,moodTarget.sun,k);
  moodCur.hemiSky=lerpHex(moodCur.hemiSky,moodTarget.hemiSky,k);
  moodCur.hemiGnd=lerpHex(moodCur.hemiGnd,moodTarget.hemiGnd,k);
  moodCur.fog=lerpHex(moodCur.fog,moodTarget.fog,k);
  moodCur.bg=lerpHex(moodCur.bg,moodTarget.bg,k);
  for(const p of['sunI','hemiI','az','el','exp','fogNear','fogFar'])moodCur[p]=lerp(moodCur[p],moodTarget[p],k);
  let sunC=moodCur.sun,fogC=moodCur.fog,bgC=moodCur.bg,sunI=moodCur.sunI;
  if(game.frenzy>0){ // strobing bonus round
    strobeT+=dt;
    if(reduceFlash){const h=(strobeT*0.25)%1;_c1.setHSL(h,.7,.55);sunC=_c1.getHex();}
    else{const ph=Math.floor(strobeT*2.6)%3;sunC=[0xff2233,0x2266ff,0xffffff][ph];sunI=moodCur.sunI*(ph===2?1.5:1.1);
      _c1.setHex(sunC);_c2.setHex(fogC);_c2.lerp(_c1,.35);fogC=_c2.getHex();bgC=fogC;}
  }
  sun.color.setHex(sunC);sun.intensity=sunI;
  hemi.color.setHex(moodCur.hemiSky);hemi.groundColor.setHex(moodCur.hemiGnd);hemi.intensity=moodCur.hemiI;
  scene.fog.color.setHex(fogC);scene.background=new THREE.Color(bgC);
  scene.fog.near=moodCur.fogNear;scene.fog.far=moodCur.fogFar;
  // sky dome + parallax hills (07-neighborhood): tint with the mood so dawn->dusk->blood still reads
  if(typeof skyEnv!=='undefined'&&skyEnv&&skyEnv.dome){
    skyEnv.dome.material.color.setHex(bgC);
    if(skyEnv.hills)for(let i=0;i<skyEnv.hills.length;i++){
      _c1.setHex(fogC);_c2.setHex(0x2a3a28);_c2.lerp(_c1,0.45+i*0.25); // nearer ridge darker, farther ridge foggier
      skyEnv.hills[i].material.color.copy(_c2);}}
  renderer.toneMappingExposure=moodCur.exp;
  const r=110;
  sun.position.set(Math.sin(moodCur.az)*Math.cos(moodCur.el)*r,Math.sin(moodCur.el)*r,Math.cos(moodCur.az)*Math.cos(moodCur.el)*r);
  // sun glow billboard
  sunGlow.position.copy(sun.position);
  sunGlow.material.color.setHex(sunC);
  sunGlow.scale.setScalar(55);
  sunGlow.material.opacity=clamp(0.5+moodCur.el*0.5,0.25,1);
  // drifting cloud sprites
  cloudT+=dt;
  const cloudTint=lerpHex(0xffffff,bgC,0.35);
  for(const c of clouds){
    c.position.x+=dt*3;
    if(c.position.x>130)c.position.x=-130;
    c.material.color.setHex(cloudTint);
  }
  // camera shake decay
  if(fxShake>0){
    fxShake=Math.max(0,fxShake-dt*4);
    if(!game.paused){const a=fxShake*0.12;camera.position.x+=rand(-a,a);camera.position.y+=rand(-a,a);camera.position.z+=rand(-a,a);}
  }
  // chipper glow flicker
  if(chipper.engineOn){
    const fast=Math.random(),slow=Math.sin(game.time*9)*0.5+0.5;
    chipperLight.intensity=lerp(chipperLight.intensity,0.85+fast*0.35+slow*0.15,0.4);
    chipperLight.color.setHex(chipper.gooT>0?0xff2211:0xffa04d);}
  else chipperLight.intensity=lerp(chipperLight.intensity,0,0.1);
  gooLight.intensity=Math.max(0,chipper.gooT)*1.6;
}

/* ---------------- materials ---------------- */
const M={
  grass:new THREE.MeshStandardMaterial({color:0x5e7a3a,roughness:1}),
  dirt:new THREE.MeshStandardMaterial({color:0x8a6f4d,roughness:1}),
  bark:new THREE.MeshStandardMaterial({color:0x6b4a2f,roughness:.95}),
  leaf:new THREE.MeshStandardMaterial({color:0x3f6b2a,roughness:.9}),
  leaf2:new THREE.MeshStandardMaterial({color:0x557a2e,roughness:.9}),
  bush:new THREE.MeshStandardMaterial({color:0x46662c,roughness:.95}),
  metal:new THREE.MeshStandardMaterial({color:0x9aa2ab,roughness:.5,metalness:.6}),
  rust:new THREE.MeshStandardMaterial({color:0x8a4a2b,roughness:.85,metalness:.3}),
  chipOrange:new THREE.MeshStandardMaterial({color:0xd96a1f,roughness:.6,metalness:.25}),
  wood:new THREE.MeshStandardMaterial({color:0x9c7b52,roughness:.9}),
  white:new THREE.MeshStandardMaterial({color:0xe8e4da,roughness:.85}),
  glass:new THREE.MeshStandardMaterial({color:0x8fb6c9,roughness:.15,metalness:.6}),
  red:new THREE.MeshStandardMaterial({color:0xb01818,roughness:.6}),
  goo:new THREE.MeshStandardMaterial({color:0x9e0f0f,roughness:.35}),
  hivis:new THREE.MeshStandardMaterial({color:0xe8ff2a,roughness:.7}),
  denim:new THREE.MeshStandardMaterial({color:0x3b5773,roughness:.9}),
  skin:new THREE.MeshStandardMaterial({color:0xc98e63,roughness:.8}),
  helmet:new THREE.MeshStandardMaterial({color:0xff8c1a,roughness:.5}),
  robe:new THREE.MeshStandardMaterial({color:0xe08fb2,roughness:.95}),
  hair:new THREE.MeshStandardMaterial({color:0xd8d8de,roughness:1}),
  fence:new THREE.MeshStandardMaterial({color:0x777d84,roughness:.6,metalness:.5,transparent:true,opacity:.55}),
  chipWood:new THREE.MeshStandardMaterial({color:0xc9a066,roughness:1}),
  chipRed:new THREE.MeshStandardMaterial({color:0xc01212,roughness:.7}),
  tea:new THREE.MeshStandardMaterial({color:0xc77b2e,roughness:.3}),
};
function box(w,h,d,mat,x=0,y=0,z=0,shadow=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;return m;}
function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=10){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
function sph(r,mat,x=0,y=0,z=0,seg=10){
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg,seg),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}

