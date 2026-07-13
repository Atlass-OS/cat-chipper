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

// mood presets: game progresses golden morning -> hot noon -> blood dusk
const MOODS={
  dawn:  {sun:0xffd9a8,sunI:1.25,hemiSky:0xbfd6ff,hemiGnd:0x3d4a33,hemiI:.55,fog:0xe8d9c4,bg:0xf4e3c8,az:.85,el:.35,exp:1.05},
  noon:  {sun:0xfff2df,sunI:1.5, hemiSky:0xcfe4ff,hemiGnd:0x49543b,hemiI:.6, fog:0xd6e6f2,bg:0xbcd9f0,az:.15,el:1.05,exp:1.0},
  dusk:  {sun:0xff7a3d,sunI:1.1, hemiSky:0x7a6aa0,hemiGnd:0x33241f,hemiI:.5, fog:0xdba883,bg:0xe89a5a,az:-.9,el:.22,exp:1.08},
  blood: {sun:0xff4530,sunI:.95, hemiSky:0x552244,hemiGnd:0x1d0f0f,hemiI:.45,fog:0xa05545,bg:0x7e2f24,az:-1.2,el:.12,exp:1.12},
};
const moodCur=JSON.parse(JSON.stringify(MOODS.dawn));
let moodTarget=MOODS.dawn, strobeT=0, reduceFlash=false;
const _c1=new THREE.Color(),_c2=new THREE.Color();
function lerpHex(cur,tgt,k){_c1.setHex(cur);_c2.setHex(tgt);_c1.lerp(_c2,k);return _c1.getHex();}
function updateMood(dt){
  const k=1-Math.pow(0.25,dt); // smooth chase
  moodCur.sun=lerpHex(moodCur.sun,moodTarget.sun,k);
  moodCur.hemiSky=lerpHex(moodCur.hemiSky,moodTarget.hemiSky,k);
  moodCur.hemiGnd=lerpHex(moodCur.hemiGnd,moodTarget.hemiGnd,k);
  moodCur.fog=lerpHex(moodCur.fog,moodTarget.fog,k);
  moodCur.bg=lerpHex(moodCur.bg,moodTarget.bg,k);
  for(const p of['sunI','hemiI','az','el','exp'])moodCur[p]=lerp(moodCur[p],moodTarget[p],k);
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
  renderer.toneMappingExposure=moodCur.exp;
  const r=110;
  sun.position.set(Math.sin(moodCur.az)*Math.cos(moodCur.el)*r,Math.sin(moodCur.el)*r,Math.cos(moodCur.az)*Math.cos(moodCur.el)*r);
  // chipper glow flicker
  if(chipper.engineOn){chipperLight.intensity=lerp(chipperLight.intensity,0.9+Math.random()*0.5,0.3);
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

