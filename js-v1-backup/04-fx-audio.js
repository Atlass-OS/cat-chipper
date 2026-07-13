/* ---------------- particles ---------------- */
const parts=[];
const chipGeo=new THREE.BoxGeometry(.09,.05,.12);
function spawnPart(pos,vel,mat,life=1.2,scale=1){
  const m=new THREE.Mesh(chipGeo,mat);m.position.copy(pos);m.castShadow=false;
  m.scale.setScalar(scale);m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  scene.add(m);parts.push({m,vel:vel.clone(),life,mat});}
function chipBurst(n,red,power=1){
  const dir=chipperG.localToWorld(chuteMouth.clone()).sub(chipperG.position).normalize();
  const mouth=chipperG.localToWorld(chuteMouth.clone());
  for(let i=0;i<n;i++){
    const v=V3(rand(-1.4,1.4),rand(3.5,6.5)*power,rand(2.5,5.5)*power).applyAxisAngle(V3(0,1,0),chipperG.rotation.y);
    spawnPart(mouth,v,red?M.chipRed:M.chipWood,rand(.8,1.6),red?rand(.8,1.6):1);}}
function poof(pos,mat,n=10){for(let i=0;i<n;i++)spawnPart(pos,V3(rand(-2,2),rand(1,4),rand(-2,2)),mat,rand(.4,.9),rand(1,2));}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];
    p.life-=dt;p.vel.y-=14*dt;p.m.position.addScaledVector(p.vel,dt);
    p.m.rotation.x+=dt*6;p.m.rotation.z+=dt*4;
    if(p.m.position.y<0.04){p.m.position.y=0.04;p.vel.set(0,0,0);}
    if(p.life<=0){scene.remove(p.m);parts.splice(i,1);}}}

/* ---------------- audio (tiny synth) ---------------- */
let AC=null,masterG=null,muted=false,sawG=null,chipG=null;
function initAudio(){
  if(AC)return;AC=new(window.AudioContext||window.webkitAudioContext)();
  masterG=AC.createGain();masterG.gain.value=.5;masterG.connect(AC.destination);
  // chipper idle: filtered noise
  const len=AC.sampleRate*2,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const src=AC.createBufferSource();src.buffer=buf;src.loop=true;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=220;
  chipG=AC.createGain();chipG.gain.value=0;src.connect(f);f.connect(chipG);chipG.connect(masterG);src.start();
  // chainsaw: sawtooth
  const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=95;
  const lfo=AC.createOscillator();lfo.frequency.value=13;const lg=AC.createGain();lg.gain.value=25;
  lfo.connect(lg);lg.connect(o.frequency);lfo.start();
  sawG=AC.createGain();sawG.gain.value=0;o.connect(sawG);sawG.connect(masterG);o.start();}
function blip(freq,dur=.15,type='square',vol=.25,slide=0){
  if(!AC||muted)return;const o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.value=freq;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),AC.currentTime+dur);
  g.gain.setValueAtTime(vol,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+dur);
  o.connect(g);g.connect(masterG);o.start();o.stop(AC.currentTime+dur);}
function meow(){blip(rand(500,750),.28,'sawtooth',.12,-250);}
function bark(){blip(150,.09,'square',.2,80);setTimeout(()=>blip(140,.09,'square',.18,70),120);}
function chipSound(red){
  if(!AC||muted)return;
  blip(60,.4,'sawtooth',.35,-20);
  if(red){blip(900,.3,'sawtooth',.2,-700);setTimeout(()=>blip(400,.25,'square',.15,-300),80);}}
function ding(){blip(880,.3,'sine',.25);setTimeout(()=>blip(1320,.4,'sine',.2),110);}

