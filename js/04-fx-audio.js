/* ---------------- particles ---------------- */
const parts=[];
const chipGeo=new THREE.BoxGeometry(.09,.05,.12);
const fxTanMat=new THREE.MeshStandardMaterial({color:0xc9a066});
const fxBrownMat=new THREE.MeshStandardMaterial({color:0x8a6a3c});
const fxGreenMat=new THREE.MeshStandardMaterial({color:0x4e7d2f});
const fxSprites=[];
let mistTex=null;
function getMistTex(){
  if(mistTex)return mistTex;
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,70,70,.9)');g.addColorStop(.5,'rgba(200,20,20,.45)');g.addColorStop(1,'rgba(200,20,20,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  mistTex=new THREE.CanvasTexture(c);return mistTex;}
function spawnRedMist(pos){
  if(fxSprites.length>=8)return;
  const mat=new THREE.SpriteMaterial({map:getMistTex(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false,opacity:.85});
  const s=new THREE.Sprite(mat);s.position.copy(pos);s.scale.setScalar(.6);
  scene.add(s);fxSprites.push({s,mat});}
function spawnPart(pos,vel,mat,life=1.2,scale=1,opts=null){
  if(parts.length>=900){ // pool 700→900: settled carnage now lingers; recycle the OLDEST SETTLED resident first
    let idx=-1;
    for(let i=0;i<parts.length;i++){if(parts[i].settled){idx=i;break;}}
    const o=idx>=0?parts.splice(idx,1)[0]:parts.shift();scene.remove(o.m);}
  const m=new THREE.Mesh(chipGeo,mat);m.position.copy(pos);m.castShadow=false;
  m.scale.setScalar(scale);m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  scene.add(m);
  const grav=opts&&opts.grav!=null?opts.grav:14;
  const sticky=!!(opts&&opts.sticky);
  parts.push({m,vel:vel.clone(),life,mat,grav,sticky,flat:false,settled:false,painted:false});}
function chipBurst(n,red,power=1){
  const mouth=chipperG.localToWorld(chuteMouth.clone());
  if(red)spawnRedMist(mouth);
  // chute ejection axis: chute tilted rotation.x=PI/3.2 -> local axis (0,ca,sa); perp basis (1,0,0) & (0,sa,-ca)
  const ca=Math.cos(Math.PI/3.2),sa=Math.sin(Math.PI/3.2);
  const spread=n>10?0.36:n>3?0.27:0.19; // tan(half-angle): ~11deg stream, ~15deg mid, ~20deg burst
  n*=4; // 4x debris volume for BOTH paths — wood broadcasts in quantity like the gibs (designer spec)
  const spd=red?1.414:1; // red gibs fly ~2x as far (range ∝ v²)
  for(let i=0;i<n;i++){
    const j1=rand(-spread,spread),j2=rand(-spread,spread);
    const v=V3(j1,ca+j2*sa,sa-j2*ca).normalize()
      .multiplyScalar(rand(7,10)*power*spd)
      .applyAxisAngle(V3(0,1,0),chipperG.rotation.y);
    if(red){spawnPart(mouth,v,M.chipRed,rand(1.3,2.4),rand(.8,1.6),{grav:rand(16,24)});}
    else{const r=Math.random();
      const mat=r<.35?M.chipWood:r<.6?fxTanMat:r<.85?fxBrownMat:fxGreenMat;
      spawnPart(mouth,v,mat,rand(.8,1.6),rand(.8,1.3),{grav:rand(16,24)});}}
  if(red){
    const dropN=Math.max(1,Math.round(n*.15));
    for(let i=0;i<dropN;i++){
      const j1=rand(-.5,.5),j2=rand(-.5,.5);
      const v=V3(j1,ca+j2*sa,sa-j2*ca).normalize()
        .multiplyScalar(rand(4,6.5)*power)
        .applyAxisAngle(V3(0,1,0),chipperG.rotation.y);
      spawnPart(mouth,v,M.chipRed,rand(1.6,2.6),rand(.6,1.1),{grav:20,sticky:true});}}}
function poof(pos,mat,n=10){for(let i=0;i<n;i++)spawnPart(pos,V3(rand(-2,2),rand(1,4),rand(-2,2)),mat,rand(.4,.9),rand(1,2.2),{grav:rand(6,14)});}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];
    p.life-=dt;
    if(p.settled){if(p.life<=0){scene.remove(p.m);parts.splice(i,1);}continue;} // settled: no physics, just age out
    p.vel.y-=(p.grav||14)*dt;p.m.position.addScaledVector(p.vel,dt);
    p.m.rotation.x+=dt*6;p.m.rotation.z+=dt*4;
    const gy=terrainH(p.m.position.x,p.m.position.z)+0.04; // land ON the rolling terrain, not the old y=0 plane
    if(p.m.position.y<gy){p.m.position.y=gy;p.vel.set(0,0,0);
      if(!p.painted){p.painted=true;paintSplat(p.m.position.x,p.m.position.z,p.mat===M.chipRed?'blood':'chip');}
      if(p.sticky){if(!p.flat){p.m.scale.y*=.4;p.flat=true;p.life=Math.max(p.life,1.8);}}
      else{p.settled=true;p.life=p.mat===M.chipRed?rand(25,40):rand(15,25);}} // carnage lingers: gibs 25-40s, chips 15-25s
    if(p.life<=0){scene.remove(p.m);parts.splice(i,1);}}
  // broadcast decal: flush painted splats to the GPU at most 8x/s
  splatFlushT-=dt;
  if(splatDirty&&splatFlushT<=0){splatTex.needsUpdate=true;splatDirty=false;splatFlushT=0.125;}
  // goo streak: slow crawl down the chute underside, then hold + fade
  if(gooStreak&&gooStreak.active){const g=gooStreak;
    if(g.growT<10){g.growT+=dt;g.m.scale.y=lerp(0.05,2.3,clamp(g.growT/10,0,1));}
    else{g.fadeT+=dt;g.mat.opacity=Math.max(0,1-g.fadeT/30);
      if(g.fadeT>=30){g.active=false;g.m.visible=false;}}}
  for(let i=fxSprites.length-1;i>=0;i--){const fs=fxSprites[i];
    fs.mat.opacity-=dt/.7;fs.s.scale.multiplyScalar(1+dt*1.8);
    if(fs.mat.opacity<=0){scene.remove(fs.s);fxSprites.splice(i,1);}}
  updateScorePops(dt); // 3D floating score text
  engine.update(dt); // self-drive the rpm sim (deduped if gameplay also calls it)
}

/* ---------------- persistent carnage: broadcast decal + drip/streak ---------------- */
let splatPlane=null,splatCtx=null,splatTex=null,splatDirty=false,splatFlushT=0;
const _splatV=new THREE.Vector3();
function ensureSplatPlane(){
  if(splatPlane)return true;
  if(typeof chipperG==='undefined')return false;
  // canvas 384x512: the 512px axis runs along the plane's 12-unit throw axis (plane local Y)
  const c=document.createElement('canvas');c.width=384;c.height=512;
  splatCtx=c.getContext('2d'); // starts fully transparent
  splatTex=new THREE.CanvasTexture(c);
  const mat=new THREE.MeshStandardMaterial({map:splatTex,transparent:true,roughness:.55,metalness:0,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4}); // draped on the grass: win the depth tie
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(9,12,18,24),mat); // 9 across the throw, 12 along it; segmented so it can drape
  // center = chute mouth + 5 units along the horizontal projection of the chute axis
  const mouth=chipperG.localToWorld(chuteMouth.clone());
  const dir=V3(0,0,1).applyAxisAngle(V3(0,1,0),chipperG.rotation.y);
  mesh.rotation.order='YXZ';mesh.rotation.y=chipperG.rotation.y;mesh.rotation.x=-Math.PI/2; // flat; local Y ends up anti-parallel to dir (sign is irrelevant, worldToLocal handles mapping)
  mesh.position.set(mouth.x+dir.x*5,0,mouth.z+dir.z*5);
  mesh.renderOrder=1;mesh.castShadow=false;mesh.receiveShadow=false;
  scene.add(mesh);mesh.updateMatrixWorld(true);
  // drape over the rolling terrain: after the -90° X tilt local Z is world Y, so lift each vertex to the grass under it
  const dp=mesh.geometry.attributes.position;
  for(let i=0;i<dp.count;i++){
    _splatV.set(dp.getX(i),dp.getY(i),0);mesh.localToWorld(_splatV);
    dp.setZ(i,terrainH(_splatV.x,_splatV.z)+0.035);}
  dp.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
  splatPlane=mesh;return true;}
const _bloodTones=['#6b1111','#521010','#7a1a14','#450b0b'];
const _chipTones=['#c9a066','#8a6a3c','#d4b06a','#a07840'];
function paintSplat(x,z,kind){
  if(!ensureSplatPlane())return;
  _splatV.set(x,0.035,z);splatPlane.worldToLocal(_splatV);
  if(Math.abs(_splatV.x)>4.45||Math.abs(_splatV.y)>5.95)return; // off the decal — ignore
  const px=(_splatV.x+4.5)/9*384,py=(1-(_splatV.y+6)/12)*512,ctx=splatCtx;
  if(kind==='blood'){
    // LOW alpha multi-tone blobs: first cats speckle, the tenth cat SOAKS
    const nb=3+(Math.random()*3|0);
    for(let i=0;i<nb;i++){
      ctx.globalAlpha=rand(.2,.45);ctx.fillStyle=pick(_bloodTones);
      ctx.beginPath();ctx.arc(px+rand(-6,6),py+rand(-6,6),rand(4,11),0,6.2832);ctx.fill();}
  }else{
    const ns=2+(Math.random()*3|0);
    for(let i=0;i<ns;i++){
      ctx.globalAlpha=rand(.5,.8);ctx.fillStyle=pick(_chipTones);
      ctx.beginPath();ctx.arc(px+rand(-4,4),py+rand(-4,4),rand(1.5,3.5),0,6.2832);ctx.fill();}}
  ctx.globalAlpha=1;splatDirty=true;}
/* drip rework: 05 calls dripOnce() a handful of times + one gooStreakStart() */
function dripOnce(){
  if(typeof chipperG==='undefined')return;
  const mouth=chipperG.localToWorld(chuteMouth.clone());
  spawnPart(mouth,V3(rand(-.3,.3),-.5,rand(-.3,.3)),M.chipRed,1.4,rand(1.5,2.5));}
let gooStreak=null;
function gooStreakStart(){
  if(typeof chipperG==='undefined')return;
  if(!gooStreak){
    const geo=new THREE.BoxGeometry(0.06,1,0.03);geo.translate(0,-0.5,0); // top-anchored: grows down-chute from the mouth
    const mat=new THREE.MeshStandardMaterial({color:0x4a0a0a,roughness:.15,metalness:0,transparent:true,opacity:1});
    const m=new THREE.Mesh(geo,mat);m.castShadow=false;
    const a=Math.PI/3.2,ca=Math.cos(a),sa=Math.sin(a);
    // chute mouth end of axis (0,2.7+1.3ca,1.9+1.3sa) pushed 0.435 to the underside surface, perp (0,-sa,ca)
    m.position.set(0,2.7+1.3*ca-0.435*sa,1.9+1.3*sa+0.435*ca);
    m.rotation.x=a; // local +Y = up-chute axis; the box body extends down-chute
    m.scale.y=0.05;
    chipperG.add(m);
    gooStreak={m,mat,growT:0,fadeT:0,active:false};}
  const g=gooStreak;
  if(!g.active){g.growT=0;g.m.scale.y=0.05;} // fully faded: restart the crawl
  g.fadeT=0;g.mat.opacity=1;g.active=true;g.m.visible=true;} // fresh blood keeps it wet
/* ---------------- audio (tiny synth) ---------------- */
let AC=null,masterG=null,muted=false,sawG=null,chipG=null;
let meowDelay=null;
let sirenOsc=null,sirenGain=null,sirenActive=false;
let dzFire=null,dzDriveG=null,dzShaper=null,dzFireG=null,dzSub=null,dzSubG=null,dzNoiseG=null,dzMixG=null;
let drumBP=null,drumAmG=null,drumLfo=null,drumG=null;
let sawOsc=null,sawToneG=null,sawNoiseG=null,sawPrevG=0,sawBase=62,sawCutF=200,sawWob=0,sawCutT=0;
/* ---------------- HD sample layer (real recordings layered over the synth) ---------------- */
const SFX={ready:false,buf:null,labels:null,clips:[],seg:{},
  oneshot:{meow:[],alert:[],fight:[],hurt:[],bark:[],yelp:[],stepGrass:[],stepDirt:[],stepWood:[],horn:[],siren:[]},
  bed:false,saw:false,amb:false,
  _dieselSrc:null,_chipSrc:null,_sawIdleSrc:null,_sawCutSrc:null,
  groupReady(k){return !!(this.oneshot[k]&&this.oneshot[k].length);}};
let bedDieselG=null,bedChipG=null,bedSawIdleG=null,bedSawCutG=null,ambG=null,dzSampleDuck=null,sawSynthDuck=null,sawCutLfo=null,sawCutLfoG=null;
/* ---------------- engine rpm sim ---------------- */
const engine={
  dieselRpm:0,drumRpm:0,load:0,running:false,
  _stalled:false,_t:0,
  setLoad(x){this.load=clamp(x,0,1);},
  start(){this._stalled=false;this.running=true;},
  stop(){this.running=false;},
  update(dt){
    const _n=performance.now(); // dedupe: safe if both gameplay and updateParts call this in one frame
    if(_n-(this._lastCall||0)<4)return;
    this._lastCall=_n;
    if(typeof chipper!=='undefined'&&!this._stalled)this.running=chipper.engineOn;
    const govTarget=this.running?3600:0; // governed at rated rpm whenever running; load only DRAGS below
    const effTarget=govTarget*(1-0.4*this.load);
    const k=effTarget<this.dieselRpm?1-Math.exp(-dt/0.6):1-Math.exp(-dt/1.2);
    this.dieselRpm+=(effTarget-this.dieselRpm)*k;
    this._t+=dt;
    const rpmA=this.dieselRpm*(1+Math.sin(this._t*1.7)*0.008+Math.sin(this._t*5.3)*0.007);
    this.drumRpm=this.dieselRpm/5;// belt 5:1 reduction (was 4.5)
    if(AC&&dzFire){
      dzFire.frequency.value=rpmA/60*2;
      dzSub.frequency.value=rpmA/60;
      dzDriveG.gain.value=.6+this.load*2.2;
      const rpmNorm=Math.min(1,rpmA/1800);
      dzNoiseG.gain.value=(.08+this.load*.17)*rpmNorm;
      dzMixG.gain.setTargetAtTime(rpmA>150?.5:0,AC.currentTime,.08);
      drumLfo.frequency.value=this.drumRpm/60*2;
      drumG.gain.setTargetAtTime(rpmA>150?.05:0,AC.currentTime,.08);}
    if(typeof _sawTick==='function')_sawTick(dt);
    if(typeof _bedTick==='function')_bedTick(dt);}};
function initAudio(){
  if(AC)return;AC=new(window.AudioContext||window.webkitAudioContext)();
  masterG=AC.createGain();masterG.gain.value=.5;masterG.connect(AC.destination);
  // chipG: master gate for all chipper machine sound (gameplay sets .gain.value 0/.5)
  chipG=AC.createGain();chipG.gain.value=0;chipG.connect(masterG);
  // diesel firing pulse: sawtooth -> drive gain -> soft-clip waveshaper
  const dzCurve=new Float32Array(256);
  for(let i=0;i<256;i++){const x=i/128-1;dzCurve[i]=Math.tanh(x*3);}
  dzShaper=AC.createWaveShaper();dzShaper.curve=dzCurve;dzShaper.oversample='2x';
  dzDriveG=AC.createGain();dzDriveG.gain.value=.6;
  dzFire=AC.createOscillator();dzFire.type='sawtooth';dzFire.frequency.value=60;
  dzFire.connect(dzDriveG);dzDriveG.connect(dzShaper);
  dzFireG=AC.createGain();dzFireG.gain.value=.6;dzShaper.connect(dzFireG);
  // sub thump: sine at firing fundamental
  dzSub=AC.createOscillator();dzSub.type='sine';dzSub.frequency.value=30;
  dzSubG=AC.createGain();dzSubG.gain.value=.35;dzSub.connect(dzSubG);
  // combustion rasp: filtered noise, level tracks load
  const dlen=AC.sampleRate*2,dbuf=AC.createBuffer(1,dlen,AC.sampleRate),dd=dbuf.getChannelData(0);
  for(let i=0;i<dlen;i++)dd[i]=Math.random()*2-1;
  const dzNoiseSrc=AC.createBufferSource();dzNoiseSrc.buffer=dbuf;dzNoiseSrc.loop=true;
  const dzNoiseF=AC.createBiquadFilter();dzNoiseF.type='lowpass';dzNoiseF.frequency.value=420;
  dzNoiseG=AC.createGain();dzNoiseG.gain.value=.08;
  dzNoiseSrc.connect(dzNoiseF);dzNoiseF.connect(dzNoiseG);dzNoiseSrc.start();
  // mix bus with slow AM wobble (laboring rhythm), gated to ~0 when rpm near 0
  dzMixG=AC.createGain();dzMixG.gain.value=0;
  dzFireG.connect(dzMixG);dzSubG.connect(dzMixG);dzNoiseG.connect(dzMixG);
  const dzWobLfo=AC.createOscillator();dzWobLfo.type='sine';dzWobLfo.frequency.value=4.5;
  const dzWobG=AC.createGain();dzWobG.gain.value=.12;
  dzWobLfo.connect(dzWobG);dzWobG.connect(dzMixG.gain);
  dzSampleDuck=AC.createGain();dzSampleDuck.gain.value=1;// ducked to 0 when sample diesel bed takes over
  dzMixG.connect(dzSampleDuck);dzSampleDuck.connect(chipG);
  dzFire.start();dzSub.start();dzWobLfo.start();
  // drum whir: bandpass noise, amplitude-modulated at blade-pass rate, felt more than heard
  const rlen=AC.sampleRate*2,rbuf=AC.createBuffer(1,rlen,AC.sampleRate),rd=rbuf.getChannelData(0);
  for(let i=0;i<rlen;i++)rd[i]=Math.random()*2-1;
  const drumSrc=AC.createBufferSource();drumSrc.buffer=rbuf;drumSrc.loop=true;
  drumBP=AC.createBiquadFilter();drumBP.type='bandpass';drumBP.frequency.value=700;drumBP.Q.value=6;
  drumAmG=AC.createGain();drumAmG.gain.value=.5;
  drumSrc.connect(drumBP);drumBP.connect(drumAmG);
  drumLfo=AC.createOscillator();drumLfo.type='sine';drumLfo.frequency.value=26.7;
  const drumLfoG=AC.createGain();drumLfoG.gain.value=.5;
  drumLfo.connect(drumLfoG);drumLfoG.connect(drumAmG.gain);
  drumG=AC.createGain();drumG.gain.value=0;
  drumAmG.connect(drumG);drumG.connect(chipG);
  drumSrc.start();drumLfo.start();
  // chainsaw: two-stroke putter + exhaust rasp
  sawG=AC.createGain();sawG.gain.value=0;sawG.connect(masterG);
  sawSynthDuck=AC.createGain();sawSynthDuck.gain.value=1;sawSynthDuck.connect(sawG);// ducked to 0 when chainsaw sample bed takes over
  sawOsc=AC.createOscillator();sawOsc.type='square';sawOsc.frequency.value=sawBase;
  const sawLP=AC.createBiquadFilter();sawLP.type='lowpass';sawLP.frequency.value=1800;
  sawToneG=AC.createGain();sawToneG.gain.value=.6;
  sawOsc.connect(sawLP);sawLP.connect(sawToneG);sawToneG.connect(sawSynthDuck);sawOsc.start();
  const snlen=AC.sampleRate*2,snbuf=AC.createBuffer(1,snlen,AC.sampleRate),snd=snbuf.getChannelData(0);
  for(let i=0;i<snlen;i++)snd[i]=Math.random()*2-1;
  const sawNoiseSrc=AC.createBufferSource();sawNoiseSrc.buffer=snbuf;sawNoiseSrc.loop=true;
  const sawBP=AC.createBiquadFilter();sawBP.type='bandpass';sawBP.frequency.value=900;sawBP.Q.value=1.5;
  sawNoiseG=AC.createGain();sawNoiseG.gain.value=.35;
  sawNoiseSrc.connect(sawBP);sawBP.connect(sawNoiseG);sawNoiseG.connect(sawSynthDuck);sawNoiseSrc.start();
  // shared echo bus (feedback delay) for meow etc.
  meowDelay=AC.createDelay(1);meowDelay.delayTime.value=.18;
  const fbG=AC.createGain();fbG.gain.value=.3;
  meowDelay.connect(fbG);fbG.connect(meowDelay);meowDelay.connect(masterG);
  loadSFX();}
/* ----- HD sample loading (async; multi-clip labels.json — the game runs on the synth until/unless these arrive or if they 404) ----- */
async function loadSFX(){
  if(!AC)return;
  try{
    const lb=await fetch('audio/labels.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
    if(lb){
      SFX.labels=lb;
      // multi-clip shape clips:[{file,segments}]; a legacy single-file labels.json is treated as one clip
      const clipDefs=(Array.isArray(lb.clips)?lb.clips:[{file:lb.file,segments:lb.segments}])
        .filter(c=>c&&c.file&&Array.isArray(c.segments)&&c.segments.length);
      const clips=(await Promise.all(clipDefs.map(c=>
        fetch(c.file,{cache:'no-store'}).then(r=>r.ok?r.arrayBuffer():null)
          .then(ab=>ab?AC.decodeAudioData(ab):null)
          .then(buf=>buf?{file:c.file,buf,segments:c.segments}:null).catch(()=>null))))
        .filter(Boolean);
      if(clips.length){
        SFX.clips=clips;SFX.buf=clips[0].buf;
        pickSegments(clips);SFX.ready=true;buildSampleBeds();}}
  }catch(e){/* stay on synth */}
  loadOneShots();}
function _segRms(buf,start,end){
  const d=buf.getChannelData(0),sr=buf.sampleRate;
  const i0=Math.max(0,Math.floor(start*sr)),i1=Math.min(d.length,Math.floor(end*sr));
  let sum=0,n=0;
  for(let i=i0;i<i1;i+=4){sum+=d[i]*d[i];n++;}
  return n?Math.sqrt(sum/n):0;}
function _quietFloor(buf){
  // 10th-percentile RMS over 1s windows = the file's silence floor
  const d=buf.getChannelData(0),win=buf.sampleRate,rmses=[];
  for(let i0=0;i0+win<=d.length;i0+=win){
    let sum=0,n=0;
    for(let i=i0;i<i0+win;i+=8){sum+=d[i]*d[i];n++;}
    rmses.push(Math.sqrt(sum/n));}
  if(!rmses.length)return 0;
  rmses.sort((a,b)=>a-b);
  return rmses[Math.floor(rmses.length*.1)];}
function pickSegments(clips){
  // energy-weighted pooling across ALL clips: score=rms*sqrt(len) per label; reject labeled silence; carry gainMul for loudness normalization
  const best={};
  clips.forEach(c=>{
    const floor=_quietFloor(c.buf);
    (c.segments||[]).forEach(s=>{
      const len=s.end-s.start;if(len<=0)return;
      const rms=_segRms(c.buf,s.start,s.end);
      if(rms<floor*2.5)return; // barely above the silence floor — someone labeled near-silence
      const score=rms*Math.sqrt(len);
      if(!(s.label in best)||score>best[s.label].score)
        best[s.label]={start:s.start,end:s.end,len,buf:c.buf,file:c.file,rms,score,
          gainMul:clamp(0.02/rms,0.5,3.0)};});}); // normalize toward targetRms=0.02
  const g=k=>best[k]||null;
  SFX.seg={chipperIdle:g('chipper-idle'),chipperChipping:g('chipper-chipping'),
    chainsawIdle:g('chainsaw-idle'),chainsawCutting:g('chainsaw-cutting'),ambience:g('ambience')};}
function makeLoopSrc(seg,destGain){
  if(!seg||!seg.buf)return null;
  const s=AC.createBufferSource();s.buffer=seg.buf;s.loop=true;
  s.loopStart=seg.start;s.loopEnd=seg.end;s.connect(destGain);s.start(0,seg.start);return s;}
function _logBed(name,seg){
  if(seg)console.info('[SFX] '+name+': '+seg.file+' '+seg.start.toFixed(2)+'-'+seg.end.toFixed(2)+'s rms='+seg.rms.toFixed(4)+' gainMul='+seg.gainMul.toFixed(2));
  else console.info('[SFX] '+name+': no usable segment — synth fallback');}
function buildSampleBeds(){
  if(!AC||!SFX.ready)return;
  _logBed('diesel',SFX.seg.chipperIdle);_logBed('chipping',SFX.seg.chipperChipping);
  _logBed('saw-cut',SFX.seg.chainsawCutting);_logBed('saw-idle',SFX.seg.chainsawIdle);
  _logBed('ambience',SFX.seg.ambience);
  // chipper bed: sample diesel loop (pitch-bound to engine rpm live) + chipping loop, both through chipG
  if(SFX.seg.chipperIdle){
    bedDieselG=AC.createGain();bedDieselG.gain.value=.95*SFX.seg.chipperIdle.gainMul;bedDieselG.connect(chipG); // designer: chipper louder (was .5)
    SFX._dieselSrc=makeLoopSrc(SFX.seg.chipperIdle,bedDieselG);
    bedChipG=AC.createGain();bedChipG.gain.value=0;bedChipG.connect(chipG);
    if(SFX.seg.chipperChipping){SFX._chipSrc=makeLoopSrc(SFX.seg.chipperChipping,bedChipG);
      SFX._chipGainMax=.95*SFX.seg.chipperChipping.gainMul;} // louder (was .6)
    SFX.bed=true;
    if(dzSampleDuck)dzSampleDuck.gain.setTargetAtTime(0,AC.currentTime,.2);}// synth diesel yields to the recording
  // chainsaw bed: idle + cutting loops through sawG (alongside the ducked synth saw)
  if(SFX.seg.chainsawCutting){
    bedSawIdleG=AC.createGain();bedSawIdleG.gain.value=0;bedSawIdleG.connect(sawG);
    if(SFX.seg.chainsawIdle)SFX._sawIdleSrc=makeLoopSrc(SFX.seg.chainsawIdle,bedSawIdleG);
    bedSawCutG=AC.createGain();bedSawCutG.gain.value=0;bedSawCutG.connect(sawG);
    SFX._sawCutSrc=makeLoopSrc(SFX.seg.chainsawCutting,bedSawCutG);
    SFX._sawCutGainMax=2.6*SFX.seg.chainsawCutting.gainMul;
    if(SFX._sawCutSrc){
      sawCutLfo=AC.createOscillator();sawCutLfo.type='sine';sawCutLfo.frequency.value=7;
      sawCutLfoG=AC.createGain();sawCutLfoG.gain.value=.08;// +-8% digging-in wobble added onto the rate ramp
      sawCutLfo.connect(sawCutLfoG);sawCutLfoG.connect(SFX._sawCutSrc.playbackRate);sawCutLfo.start();}
    SFX.saw=true;
    if(sawSynthDuck)sawSynthDuck.gain.setTargetAtTime(0,AC.currentTime,.2);}
  // ambience: long birds/air bed at low gain, straight to masterG, from game start
  if(SFX.seg.ambience){
    ambG=AC.createGain();ambG.gain.value=.08*SFX.seg.ambience.gainMul;ambG.connect(masterG);
    makeLoopSrc(SFX.seg.ambience,ambG);SFX.amb=true;}}
function loadOneShots(){
  const grp=(names,arr)=>names.forEach(n=>{
    fetch('audio/sfx/'+n,{cache:'no-store'}).then(r=>r.ok?r.arrayBuffer():null)
      .then(ab=>ab?AC.decodeAudioData(ab):null).then(b=>{if(b)arr.push(b);}).catch(()=>{});});
  grp(['meow1.mp3','meow2.mp3','meow3.mp3'],SFX.oneshot.meow);
  grp(['cat-alert1.mp3','cat-alert2.mp3'],SFX.oneshot.alert);
  grp(['cat-fight1.mp3','cat-fight2.mp3'],SFX.oneshot.fight);
  grp(['cat-hurt1.mp3','cat-hurt2.mp3'],SFX.oneshot.hurt);
  grp(['bark1.mp3','bark2.mp3'],SFX.oneshot.bark);
  grp(['yelp1.mp3'],SFX.oneshot.yelp);
  grp(['step-grass1.mp3','step-grass2.mp3','step-grass3.mp3'],SFX.oneshot.stepGrass);
  grp(['step-dirt1.mp3','step-dirt2.mp3','step-dirt3.mp3'],SFX.oneshot.stepDirt);
  grp(['step-wood1.mp3','step-wood2.mp3'],SFX.oneshot.stepWood);
  grp(['horn1.mp3'],SFX.oneshot.horn);
  grp(['siren1.mp3'],SFX.oneshot.siren);}
function playOneShot(list,vol,jitter){
  if(!AC||muted||!list||!list.length)return false;
  const b=pick(list),s=AC.createBufferSource();s.buffer=b;
  s.playbackRate.value=1+rand(-jitter,jitter);
  const g=AC.createGain();g.gain.value=vol;s.connect(g);g.connect(masterG);s.start();return true;}
/* HD chipper bed: keep the sample diesel/chipping loops pitch-locked to the live engine rpm */
function _bedTick(dt){
  if(!AC||!SFX.bed)return;
  const t=AC.currentTime;
  const r=clamp(engine.dieselRpm/3600,0.25,1.3);// the recording now sags exactly like the synth did
  if(SFX._dieselSrc)SFX._dieselSrc.playbackRate.setTargetAtTime(r,t,.05);
  if(SFX._chipSrc)SFX._chipSrc.playbackRate.setTargetAtTime(r,t,.05);
  // chipping ('eating') layer crossfades up with load above 0.35
  if(bedChipG){
    const tgt=engine.load>0.35?clamp((engine.load-0.35)/0.65,0,1)*(SFX._chipGainMax||0.6):0;
    bedChipG.gain.setTargetAtTime(tgt,t,.04);}}
/* two-stroke chainsaw envelope: driven purely by observing sawG.gain.value each frame */
function _sawTick(dt){
  if(!AC||!sawOsc)return;
  const g=sawG.gain.value,t=AC.currentTime;
  const started=(sawPrevG<=0&&g>0),ended=(sawPrevG>0&&g<=0);
  if(SFX.saw){
    // HD chainsaw: crossfade the cutting loop by the existing sawG gate, with a rev-in ramp
    if(started){
      if(bedSawCutG)bedSawCutG.gain.setTargetAtTime(SFX._sawCutGainMax||2.6,t,.05);
      if(bedSawIdleG)bedSawIdleG.gain.setTargetAtTime(0,t,.08);
      if(SFX._sawCutSrc){const pr=SFX._sawCutSrc.playbackRate;
        pr.cancelScheduledValues(t);pr.setValueAtTime(.85,t);pr.linearRampToValueAtTime(1.0,t+.3);}
    }else if(ended){
      if(bedSawCutG)bedSawCutG.gain.setTargetAtTime(0,t,.1);
      if(bedSawIdleG)bedSawIdleG.gain.setTargetAtTime(0,t,.12);}
    sawPrevG=g;return;}
  // --- synth fallback (original behavior, used until the chainsaw samples load) ---
  if(started){
    // cut starts: throttle rev toward a fresh cut frequency
    sawCutF=rand(180,220);sawCutT=0;
    sawOsc.frequency.cancelScheduledValues(t);
    sawOsc.frequency.setValueAtTime(sawOsc.frequency.value,t);
    sawOsc.frequency.linearRampToValueAtTime(sawCutF,t+.3);
  }else if(ended){
    // cut ends: decel back to idle putter + throttle-off blip
    sawOsc.frequency.cancelScheduledValues(t);
    sawOsc.frequency.setValueAtTime(sawOsc.frequency.value,t);
    sawOsc.frequency.linearRampToValueAtTime(sawBase,t+.25);
    blip(140,.12,'square',.12,-70);
  }else if(g>0){
    // digging in: irregular load wobble drags pitch down once the rev-up settles
    sawCutT+=dt;
    sawWob=clamp(sawWob+rand(-1,1)*dt*2.5,0,1);
    if(sawCutT>.35)sawOsc.frequency.value=sawCutF*(1-.15*sawWob);
  }
  sawPrevG=g;}
function blip(freq,dur=.15,type='square',vol=.25,slide=0){
  if(!AC||muted)return;const o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.value=freq;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),AC.currentTime+dur);
  g.gain.setValueAtTime(vol,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+dur);
  o.connect(g);g.connect(masterG);o.start();o.stop(AC.currentTime+dur);}
function meow(){
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.meow,.9,.1))return;
  const t0=AC.currentTime,kind=pick(['plaintive','alarmed','angry']);
  let base,dur,peak;
  if(kind==='plaintive'){base=rand(440,560);dur=.34;peak=.07;}
  else if(kind==='alarmed'){base=rand(600,740);dur=.2;peak=.06;}
  else{base=rand(320,400);dur=.28;peak=.08;} // all quieter + lower-pitched — less grating
  const o=AC.createOscillator();o.type='sawtooth';
  o.frequency.setValueAtTime(base*.85,t0);
  o.frequency.exponentialRampToValueAtTime(base*1.15,t0+dur*.4);
  o.frequency.exponentialRampToValueAtTime(base*.7,t0+dur);
  let src=o;
  if(kind==='angry'){
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*4);}
    const shp=AC.createWaveShaper();shp.curve=curve;shp.oversample='2x';
    o.connect(shp);src=shp;}
  const f1=AC.createBiquadFilter();f1.type='bandpass';f1.Q.value=8;
  f1.frequency.setValueAtTime(1100,t0);f1.frequency.linearRampToValueAtTime(1100*.75,t0+dur);
  const f2=AC.createBiquadFilter();f2.type='bandpass';f2.Q.value=8;
  f2.frequency.setValueAtTime(2600,t0);f2.frequency.linearRampToValueAtTime(2600*.75,t0+dur);
  const dryG=AC.createGain();dryG.gain.value=.12;
  const f1G=AC.createGain();f1G.gain.value=1;
  const f2G=AC.createGain();f2G.gain.value=.45; // upper formant tamed — this was the "nails" component
  src.connect(f1);f1.connect(f1G);
  src.connect(f2);f2.connect(f2G);
  src.connect(dryG);
  const body=AC.createBiquadFilter();body.type='lowpass';body.frequency.value=3800;
  f1G.connect(body);f2G.connect(body);dryG.connect(body);
  const g=AC.createGain();g.gain.setValueAtTime(0,t0);
  g.gain.linearRampToValueAtTime(peak,t0+.015);
  g.gain.exponentialRampToValueAtTime(.001,t0+dur);
  body.connect(g);g.connect(masterG);if(meowDelay)g.connect(meowDelay);
  o.start(t0);o.stop(t0+dur);}
function bark(){
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.bark,.9,.08))return;
  const burst=(t)=>{
    const o=AC.createOscillator(),g=AC.createGain(),bp=AC.createBiquadFilter();
    o.type='sawtooth';o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(90,t+.09);
    bp.type='bandpass';bp.frequency.value=300;bp.Q.value=3;
    g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.09);
    o.connect(bp);bp.connect(g);g.connect(masterG);o.start(t);o.stop(t+.09);
    const nlen=Math.floor(AC.sampleRate*.03),nbuf=AC.createBuffer(1,nlen,AC.sampleRate),nd=nbuf.getChannelData(0);
    for(let i=0;i<nlen;i++)nd[i]=(Math.random()*2-1)*(1-i/nlen);
    const ns=AC.createBufferSource();ns.buffer=nbuf;
    const nf=AC.createBiquadFilter();nf.type='lowpass';nf.frequency.value=1200;
    const ng=AC.createGain();ng.gain.value=.12;
    ns.connect(nf);nf.connect(ng);ng.connect(masterG);ns.start(t);};
  burst(AC.currentTime);
  setTimeout(()=>{if(!AC||muted)return;burst(AC.currentTime);},120);}
function grind(dur=0.5){
  if(!AC||muted)return;
  const o=AC.createOscillator(),g=AC.createGain(),bp=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(90,AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(260,AC.currentTime+dur);
  bp.type='bandpass';bp.frequency.value=400;bp.Q.value=1.2;
  g.gain.setValueAtTime(.3,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+dur);
  o.connect(bp);bp.connect(g);g.connect(masterG);
  o.start();o.stop(AC.currentTime+dur);}
function chipSound(red){
  if(!AC||muted)return;
  blip(60,.4,'sawtooth',.35,-20);
  if(red){
    blip(900,.3,'sawtooth',.2,-700);setTimeout(()=>blip(400,.25,'square',.15,-300),80);
    // wet blorp: sine dropping fast
    const o=AC.createOscillator(),g=AC.createGain();
    o.type='sine';o.frequency.setValueAtTime(320,AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(60,AC.currentTime+.18);
    g.gain.setValueAtTime(.22,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.18);
    o.connect(g);g.connect(masterG);o.start();o.stop(AC.currentTime+.18);
    // tiny noise burst (splat)
    const nlen=Math.floor(AC.sampleRate*.08),nbuf=AC.createBuffer(1,nlen,AC.sampleRate),nd=nbuf.getChannelData(0);
    for(let i=0;i<nlen;i++)nd[i]=(Math.random()*2-1)*(1-i/nlen);
    const ns=AC.createBufferSource();ns.buffer=nbuf;
    const ng=AC.createGain();ng.gain.value=.18;
    const nf=AC.createBiquadFilter();nf.type='lowpass';nf.frequency.value=1800;
    ns.connect(nf);nf.connect(ng);ng.connect(masterG);ns.start();
    // drum shriek: brief pitch spike on the blade whir
    if(drumBP){
      const st=AC.currentTime;
      drumBP.frequency.cancelScheduledValues(st);
      drumBP.frequency.setValueAtTime(drumBP.frequency.value,st);
      drumBP.frequency.linearRampToValueAtTime(2400,st+.18);
      drumBP.frequency.linearRampToValueAtTime(700,st+.45);
      if(drumG){
        drumG.gain.cancelScheduledValues(st);
        drumG.gain.setValueAtTime(drumG.gain.value,st);
        drumG.gain.linearRampToValueAtTime(.22,st+.18);
        drumG.gain.linearRampToValueAtTime(.05,st+.45);}}}}
function ding(){blip(880,.3,'sine',.25);setTimeout(()=>blip(1320,.4,'sine',.2),110);}
function hornSound(){
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.horn,.5,.03))return;
  const dur=.55,t0=AC.currentTime;
  [[220,'square',-6],[277,'sawtooth',6]].forEach(([freq,type,det])=>{
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type;o.frequency.value=freq;o.detune.value=det;
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(.28,t0+.03);
    g.gain.setValueAtTime(.28,t0+dur-.15);
    g.gain.linearRampToValueAtTime(.001,t0+dur);
    o.connect(g);g.connect(masterG);o.start(t0);o.stop(t0+dur);});}
function sirenStart(){
  if(!AC||muted)return;
  if(!sirenOsc){
    sirenOsc=AC.createOscillator();sirenOsc.type='sine';sirenOsc.frequency.value=900;
    const lfo=AC.createOscillator();lfo.type='triangle';lfo.frequency.value=.6;
    const lfoG=AC.createGain();lfoG.gain.value=300;
    lfo.connect(lfoG);lfoG.connect(sirenOsc.frequency);lfo.start();
    sirenGain=AC.createGain();sirenGain.gain.value=0;
    sirenOsc.connect(sirenGain);sirenGain.connect(masterG);sirenOsc.start();}
  sirenActive=true;
  sirenGain.gain.cancelScheduledValues(AC.currentTime);
  sirenGain.gain.linearRampToValueAtTime(.22,AC.currentTime+.3);}
function sirenStop(){
  if(!AC||!sirenGain)return;
  sirenActive=false;
  sirenGain.gain.cancelScheduledValues(AC.currentTime);
  sirenGain.gain.linearRampToValueAtTime(0,AC.currentTime+.4);}
/* ---------------- 3D in-world score pops (high-dopamine floaters) ---------------- */
const scorePops=[];
function spawnScorePop(pos,text,color,scale){
  if(scorePops.length>=10){const o=scorePops.shift();scene.remove(o.s);}
  const c=document.createElement('canvas');c.width=256;c.height=96;
  const ctx=c.getContext('2d');
  ctx.font='900 56px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=10;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(text,128,48);
  ctx.fillStyle=color||'#ff5b4d';ctx.fillText(text,128,48);
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,fog:false});
  const s=new THREE.Sprite(mat);
  s.position.copy(pos);s.position.y+=0.6;
  s.position.x+=rand(-.4,.4);s.position.z+=rand(-.4,.4);
  const sc=scale||1.3;s.scale.set(2.6*sc,0.975*sc,1);
  scene.add(s);
  scorePops.push({s,mat,t:0,life:1.35,vy:2.2,baseSc:sc});}
function updateScorePops(dt){
  for(let i=scorePops.length-1;i>=0;i--){const p=scorePops[i];
    p.t+=dt;
    p.s.position.y+=p.vy*dt;p.vy*=Math.pow(0.35,dt); // rises fast, eases off
    const punch=p.t<0.18?(0.6+p.t/0.18*0.55):(1.15-Math.min(0.15,(p.t-0.18)*0.3)); // pop-in overshoot
    p.s.scale.set(2.6*p.baseSc*punch,0.975*p.baseSc*punch,1);
    if(p.t>p.life*0.55)p.mat.opacity=Math.max(0,1-(p.t-p.life*0.55)/(p.life*0.45));
    if(p.t>=p.life){scene.remove(p.s);p.mat.map.dispose();scorePops.splice(i,1);}}}
function alertSound(){ // incoming-cat / event warning: sample-first, else a gentle two-tone chime (the old sawtooth honk was hated)
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.alert,.7,.08))return;
  blip(660,.12,'sine',.14,0);setTimeout(()=>blip(880,.18,'sine',.12,0),110);}
function scratchSound(){
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.fight,.8,.12))return; // real cat-fight sample wins when present
  const n=3;
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      if(!AC||muted)return;
      const nlen=Math.floor(AC.sampleRate*.08),nbuf=AC.createBuffer(1,nlen,AC.sampleRate),nd=nbuf.getChannelData(0);
      for(let j=0;j<nlen;j++){const t=j/nlen;nd[j]=(Math.random()*2-1)*Math.sin(Math.PI*Math.min(1,t*4))*(1-t);}
      const ns=AC.createBufferSource();ns.buffer=nbuf;
      const nf=AC.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1600-i*250;nf.Q.value=1.2; // fabric-rip, not glass-scrape
      const ng=AC.createGain();ng.gain.value=.13;
      ns.connect(nf);nf.connect(ng);ng.connect(masterG);ns.start();
      blip(500-i*80,.06,'triangle',.08,-200); // low thump accent instead of the piercing square
    },i*70);}}
function yelp(){
  if(!AC||muted)return;
  if(playOneShot(SFX.oneshot.yelp,.9,.1))return;
  const note=(t,f0,f1,dur,vol)=>{
    const o=AC.createOscillator(),g=AC.createGain(),bp=AC.createBiquadFilter(),dryG=AC.createGain(),wetG=AC.createGain();
    o.type='triangle';o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    bp.type='bandpass';bp.frequency.value=500;bp.Q.value=2.5;
    dryG.gain.value=.3;wetG.gain.value=.7;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g);
    g.connect(dryG);dryG.connect(masterG);
    g.connect(bp);bp.connect(wetG);wetG.connect(masterG);
    o.start(t);o.stop(t+dur);};
  note(AC.currentTime,900,600,.15,.22);
  setTimeout(()=>{if(!AC||muted)return;note(AC.currentTime,700,350,.15,.2);},100);}
function crackSound(){
  if(!AC||muted)return;
  blip(100,.09,'square',.4,-40);
  setTimeout(()=>{
    if(!AC||muted)return;
    const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter();
    o.type='sawtooth';o.frequency.setValueAtTime(80,AC.currentTime);
    o.frequency.linearRampToValueAtTime(60,AC.currentTime+.6);
    lp.type='lowpass';lp.frequency.value=300;
    g.gain.setValueAtTime(0,AC.currentTime);
    g.gain.linearRampToValueAtTime(.18,AC.currentTime+.05);
    g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.65);
    o.connect(lp);lp.connect(g);g.connect(masterG);
    o.start();o.stop(AC.currentTime+.65);
  },50);}
function thudSound(){
  if(!AC||muted)return;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type='sine';o.frequency.setValueAtTime(90,AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(45,AC.currentTime+.15);
  g.gain.setValueAtTime(.35,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.15);
  o.connect(g);g.connect(masterG);o.start();o.stop(AC.currentTime+.15);
  const nlen=Math.floor(AC.sampleRate*.08),nbuf=AC.createBuffer(1,nlen,AC.sampleRate),nd=nbuf.getChannelData(0);
  for(let i=0;i<nlen;i++)nd[i]=(Math.random()*2-1)*(1-i/nlen);
  const ns=AC.createBufferSource();ns.buffer=nbuf;
  const ng=AC.createGain();ng.gain.value=.2;
  const nf=AC.createBiquadFilter();nf.type='lowpass';nf.frequency.value=500;
  ns.connect(nf);nf.connect(ng);ng.connect(masterG);ns.start();}
let heartbeatGain=null,heartbeatTimer=null;
function heartbeat(on){
  if(!on){
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
    if(heartbeatGain&&AC){
      heartbeatGain.gain.cancelScheduledValues(AC.currentTime);
      heartbeatGain.gain.linearRampToValueAtTime(0,AC.currentTime+.4);}
    return;}
  if(!AC||muted)return;
  if(!heartbeatGain){heartbeatGain=AC.createGain();heartbeatGain.gain.value=0;heartbeatGain.connect(masterG);}
  heartbeatGain.gain.cancelScheduledValues(AC.currentTime);
  heartbeatGain.gain.linearRampToValueAtTime(.5,AC.currentTime+.3);
  if(!heartbeatTimer){
    const thump=(freq)=>{
      if(!AC||!heartbeatGain)return;
      const o=AC.createOscillator(),g=AC.createGain();
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(.001,AC.currentTime);
      g.gain.exponentialRampToValueAtTime(1,AC.currentTime+.02);
      g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.12);
      o.connect(g);g.connect(heartbeatGain);o.start();o.stop(AC.currentTime+.12);};
    const beat=()=>{thump(60);setTimeout(()=>thump(55),180);};
    beat();
    heartbeatTimer=setInterval(beat,900);}}
function struggleSound(){
  if(!AC||muted)return;
  const t0=AC.currentTime,dur=.16;
  const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(rand(70,90),t0);
  o.frequency.linearRampToValueAtTime(rand(95,110),t0+dur);
  lp.type='lowpass';lp.frequency.value=500;
  g.gain.setValueAtTime(.28,t0);g.gain.exponentialRampToValueAtTime(.001,t0+dur);
  o.connect(lp);lp.connect(g);g.connect(masterG);o.start(t0);o.stop(t0+dur);
  blip(500,.1,'square',.15,300);}
function stallSound(){
  engine._stalled=true;engine.running=false;
  if(!AC||muted)return;
  const t0=AC.currentTime;
  const gaps=[0,90,200,340,520],freqs=[140,115,95,75,60];
  gaps.forEach((gap,i)=>{
    const t=t0+gap/1000,f=freqs[i],dur=.07;
    const o=AC.createOscillator(),g=AC.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g);g.connect(masterG);o.start(t);o.stop(t+dur);});
  const tc=t0+.7,co=AC.createOscillator(),cg=AC.createGain();
  co.type='square';co.frequency.setValueAtTime(70,tc);
  cg.gain.setValueAtTime(.3,tc);cg.gain.exponentialRampToValueAtTime(.001,tc+.12);
  co.connect(cg);cg.connect(masterG);co.start(tc);co.stop(tc+.12);
  if(chipG){
    chipG.gain.cancelScheduledValues(t0);
    chipG.gain.setValueAtTime(chipG.gain.value,t0);
    chipG.gain.linearRampToValueAtTime(0,t0+.5);}}
function laughTrack(){
  if(!AC||muted)return;
  const voices=[
    {delay:0,base:560,type:'square',triple:false},
    {delay:350,base:660,type:'triangle',triple:true},
    {delay:750,base:480,type:'square',triple:false},
    {delay:1200,base:600,type:'triangle',triple:true}];
  voices.forEach(v=>{
    setTimeout(()=>{
      if(!AC||muted)return;
      const freqs=v.triple?[v.base,v.base*.78,v.base*.6]:[v.base,v.base*.75];
      freqs.forEach((f,i)=>{
        const t=AC.currentTime+i*.14,dur=.12;
        const o=AC.createOscillator(),g=AC.createGain();
        o.type=v.type;o.frequency.value=f;
        g.gain.setValueAtTime(.001,t);
        g.gain.exponentialRampToValueAtTime(rand(.12,.18),t+.015);
        g.gain.exponentialRampToValueAtTime(.001,t+dur);
        o.connect(g);g.connect(masterG);o.start(t);o.stop(t+dur);});
    },v.delay);});}
function restartSound(){
  engine.dieselRpm=Math.max(engine.dieselRpm,250);
  if(!AC||muted)return;
  const t0=AC.currentTime;
  const freqs=[55,58,61,64,67,70,72];
  let t=t0,delta=.1;
  freqs.forEach(f=>{
    const o=AC.createOscillator(),g=AC.createGain();
    o.type='square';o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);
    o.connect(g);g.connect(masterG);o.start(t);o.stop(t+.05);
    t+=delta;delta*=.93;});
  if(chipG){
    chipG.gain.cancelScheduledValues(t0);
    chipG.gain.setValueAtTime(chipG.gain.value,t0);
    chipG.gain.linearRampToValueAtTime(0,t0+.05);
    chipG.gain.setValueAtTime(0,t0+.8);
    chipG.gain.linearRampToValueAtTime(.5,t0+1.2);}
  setTimeout(()=>{engine.start();if(!AC||muted)return;blip(90,.3,'sawtooth',.3,-20);},800);}
function swallowSound(){
  if(!AC||muted)return;
  const t0=AC.currentTime;
  const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(110,t0);
  o.frequency.exponentialRampToValueAtTime(35,t0+2.8);
  lp.type='lowpass';lp.frequency.setValueAtTime(400,t0);
  lp.frequency.exponentialRampToValueAtTime(150,t0+2.8);
  g.gain.setValueAtTime(.001,t0);
  g.gain.linearRampToValueAtTime(.3,t0+.4);
  g.gain.exponentialRampToValueAtTime(.02,t0+2.9);
  o.connect(lp);lp.connect(g);g.connect(masterG);o.start(t0);o.stop(t0+2.9);
  const thumpT=[.4,.9,1.4,1.9,2.3,2.6],thumpV=[.28,.26,.24,.22,.18,.14];
  thumpT.forEach((off,i)=>{
    const t=t0+off,to=AC.createOscillator(),tg=AC.createGain(),tf=AC.createBiquadFilter();
    to.type='sine';to.frequency.setValueAtTime(rand(50,65),t);
    tf.type='lowpass';tf.frequency.value=300;
    tg.gain.setValueAtTime(thumpV[i],t);tg.gain.exponentialRampToValueAtTime(.001,t+.15);
    to.connect(tf);tf.connect(tg);tg.connect(masterG);to.start(t);to.stop(t+.15);});}
/* footsteps: surface in {'grass','dirt','wood'} — loaded step sample if present, else a filtered-noise tick */
function footstep(surface){
  if(!AC||muted)return;
  const map={grass:SFX.oneshot.stepGrass,dirt:SFX.oneshot.stepDirt,wood:SFX.oneshot.stepWood};
  const list=map[surface]||SFX.oneshot.stepGrass;
  if(list&&list.length){playOneShot(list,.15,.1);return;}
  // synth fallback: soft scuff, not a click — longer noise with eased attack+decay, darker filtering, quieter
  const spec={grass:['lowpass',1400,0],dirt:['lowpass',700,0],wood:['lowpass',1000,1]}[surface]||['lowpass',900,0];
  const nlen=Math.floor(AC.sampleRate*.11),nbuf=AC.createBuffer(1,nlen,AC.sampleRate),nd=nbuf.getChannelData(0);
  for(let i=0;i<nlen;i++){const t=i/nlen;const env=Math.sin(Math.PI*Math.min(1,t*3))*(1-t);nd[i]=(Math.random()*2-1)*env;}
  const ns=AC.createBufferSource();ns.buffer=nbuf;
  ns.playbackRate.value=0.9+Math.random()*0.2; // vary each step so it doesn't machine-gun
  const nf=AC.createBiquadFilter();nf.type=spec[0];nf.frequency.value=spec[1];if(spec[2])nf.Q.value=spec[2];
  const ng=AC.createGain();ng.gain.value=.055;
  ns.connect(nf);nf.connect(ng);ng.connect(masterG);ns.start();}
