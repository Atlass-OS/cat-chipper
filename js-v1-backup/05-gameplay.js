/* ---------------- game state ---------------- */
const game={started:false,over:false,paused:true,score:0,catsChipped:0,combo:0,comboT:0,
  workStarted:false,prepT:14,curTree:0,teaBreak:0,teaChips:0,frenzy:0,frenzyDone:false,
  earlyBird:true,tipped:false,acVan:null,time:0};
const msgsEl=document.getElementById('msgs');
function msg(text,color='#fff'){
  const d=document.createElement('div');d.textContent=text;d.style.color=color;
  msgsEl.appendChild(d);while(msgsEl.children.length>5)msgsEl.removeChild(msgsEl.firstChild);
  setTimeout(()=>{d.style.transition='opacity 1s';d.style.opacity=0;setTimeout(()=>d.remove(),1000);},5200);}
function banner(text,ms=2200){
  const b=document.getElementById('eventbanner');b.textContent=text;b.style.opacity=1;
  clearTimeout(banner._t);banner._t=setTimeout(()=>b.style.opacity=0,ms);}

/* ---------------- player ---------------- */
const player={pos:V3(-4,1.7,38),yaw:0,pitch:-.05,vel:V3(),carrying:null,
  tools:{hands:true,lasso:false,shovel:false,gun:false},tool:'hands',lassoCD:0,shovelCD:0,gunCD:0};
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(!game.started||game.paused)return;
  if(e.code==='KeyE')interact();
  if(e.code==='KeyQ')tryReleaseDogs();
  if(e.code==='KeyM'){muted=!muted;if(masterG)masterG.gain.value=muted?0:.5;msg(muted?'muted':'unmuted');}
  if(e.code==='Digit1')selectTool('hands');
  if(e.code==='Digit2')selectTool('lasso');
  if(e.code==='Digit3')selectTool('shovel');
  if(e.code==='Digit4')selectTool('gun');});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas)return;
  player.yaw-=e.movementX*0.0021;player.pitch-=e.movementY*0.0021;
  player.pitch=clamp(player.pitch,-1.45,1.45);});
addEventListener('mousedown',e=>{
  if(document.pointerLockElement!==canvas||game.paused||game.over)return;
  if(e.button===0)primaryAction();});
function selectTool(t){
  if(t!=='hands'&&!player.tools[t]){msg("you don't have that yet",'#f88');return;}
  player.tool=t;
  const map={hands:'t1',lasso:'t2',shovel:'t3',gun:'t4'};
  document.querySelectorAll('.tool').forEach(el=>el.classList.remove('sel'));
  document.getElementById(map[t]).classList.add('sel');}
function camDir(){const v=V3();camera.getWorldDirection(v);return v;}

// gun viewmodel
const gunVM=new THREE.Group();
gunVM.add(box(.06,.08,.5,M.metal,0,0,-.2));gunVM.add(box(.05,.14,.1,M.wood,0,-.08,.05));
gunVM.position.set(.28,-.22,-.5);gunVM.visible=false;camera.add(gunVM);
const lassoVM=new THREE.Mesh(new THREE.TorusGeometry(.14,.025,6,14),M.tea);
lassoVM.position.set(.3,-.25,-.5);lassoVM.visible=false;camera.add(lassoVM);
const shovelVM=new THREE.Group();
{const s=cyl(.025,.025,.9,M.wood);s.rotation.x=1.1;shovelVM.add(s);
 shovelVM.add(box(.26,.3,.04,M.metal,0,-.32,-.35));}
shovelVM.position.set(.32,-.4,-.55);shovelVM.visible=false;camera.add(shovelVM);
scene.add(camera);

function updateViewmodels(){
  gunVM.visible=player.tool==='gun';
  lassoVM.visible=player.tool==='lasso';
  shovelVM.visible=player.tool==='shovel';
  if(player.carrying){ // carried cat bobs in view
    const c=player.carrying;
    const p=camera.localToWorld(V3(-.35,-.32,-.75));
    c.mesh.position.copy(p);
    c.mesh.rotation.y=player.yaw+1.4;
    c.mesh.rotation.z=Math.sin(game.time*9)*.12;}
  if(teaState.carried){
    tray.position.copy(camera.localToWorld(V3(0,-.4,-.8)));
    tray.rotation.y=player.yaw;}}

/* ---------------- interaction ---------------- */
let promptText='',promptFn=null;
function setPrompt(t,fn){promptText=t;promptFn=fn;}
function computePrompt(){
  setPrompt('',null);
  const pp=player.pos,cd=camDir();
  const near=(v,d)=>pp.distanceTo(v)<d;
  const facing=(v,deg=42)=>{const to=v.clone().sub(pp);to.y*=0.4;if(to.lengthSq()<0.01)return true;
    to.normalize();return cd.dot(to)>Math.cos(deg*Math.PI/180);};
  // 1. incoming lady cat
  if(lady.throwCat&&lady.throwCat.state==='ladythrow'&&near(lady.throwCat.mesh.position,3.6)){
    setPrompt('E — CATCH THE CAT!',catchLadyCat);return;}
  // 2. stuff carried cat into chipper
  if(player.carrying&&near(chipper.intake,3.2)){
    if(chipper.catReady())setPrompt('E — feed the cat to the chipper',()=>stuffCat());
    else setPrompt('chipper is busy...',null);return;}
  // 3. tea tray
  if(teaState.phase==='onTable'&&near(tray.position,3)&&facing(tray.position)){
    setPrompt('E — take the iced tea tray',takeTray);return;}
  // 4. grab a cat
  if(!player.carrying&&!teaState.carried){
    let best=null,bd=3.1;
    for(const c of cats){
      if(c.dead)continue;
      const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='stun'||c.state==='bush'||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'));
      if(!grabbable)continue;
      const d=pp.distanceTo(c.mesh.position);
      if(d<bd&&facing(c.mesh.position)){bd=d;best=c;}}
    if(best){setPrompt(best.state==='bush'?'E — reach into the bush':'E — grab the cat',()=>grabCat(best));return;}}
  // 5. tool pickups
  for(const p of pickups){
    if(p.taken)continue;
    if(p.gated&&!p.gated.open)continue;
    p.mesh.getWorldPosition(p.worldPos);
    if(near(p.worldPos,2.6)&&facing(p.worldPos)){
      setPrompt('E — take the '+p.name,()=>takePickup(p));return;}}
  // 6. doors
  for(const d of [shedDoor,...carDoors]){
    const wp=V3();d.hinge.getWorldPosition(wp);
    if(!d.open&&near(wp,2.8)&&facing(wp)){setPrompt('E — open the '+d.label,()=>{d.open=true;blip(220,.1,'square',.15);msg('you open the '+d.label);});return;}}
  // 7. dog run lock
  if(!dogRun.unlocked){
    const wp=V3();dogRun.lock.getWorldPosition(wp);
    if(near(wp,2.6)&&facing(wp)){
      if(player.tool==='shovel')setPrompt('CLICK — smash the lock',null);
      else setPrompt('locked. smash it with a shovel or shoot it',null);
      return;}}
  else if(!dogRun.released&&near(V3(dogRun.x,0,dogRun.z),6)){
    setPrompt('Q — release the dogs',null);return;}
  // 8. tip the crew (before work starts)
  if(!game.tipped&&!game.workStarted){
    for(const gm of groundies){
      if(near(gm.mesh.position,2.8)&&facing(gm.mesh.position)){
        setPrompt('E — tip the crew $20 to fire up the chipper early',tipCrew);return;}}}
}
function interact(){if(promptFn)promptFn();}
function tipCrew(){
  game.tipped=true;chipper.engineOn=true;
  if(chipG)chipG.gain.value=.5;
  msg('the crew fires up the chipper and lets it idle. nice.', '#ffd34d');
  banner('EARLY BIRD — chipper is HOT');
  game.score-=20;updateHUD();}
function grabCat(c){
  if(c.state==='bush'&&c.home){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  c.state='carried';player.carrying=c;meow();
  msg('got one. it is NOT happy.');}
function stuffCat(){
  const c=player.carrying;player.carrying=null;
  chipCat(c,'hand-fed');}
function takePickup(p){
  p.taken=true;p.mesh.visible=false;
  player.tools[p.name]=true;
  document.getElementById(p.name==='lasso'?'t2':'t3').classList.add('have');
  msg('picked up the '+p.name+'!','#ffd34d');ding();selectTool(p.name);}
function takeTray(){
  teaState.phase='carried';teaState.carried=true;
  msg('iced tea acquired. deliver it to the crew.','#ffd34d');}
function tryReleaseDogs(){
  if(!dogRun.unlocked||dogRun.released)return;
  if(player.pos.distanceTo(V3(dogRun.x,0,dogRun.z))>8){msg('get closer to the dog run');return;}
  dogRun.released=true;dogRun.gateHinge.rotation.y=-1.8;
  for(const d of dogs)if(d.state==='penned')d.state='roam';
  bark();setTimeout(bark,300);
  banner('DOGS RELEASED');msg('the dogs are OUT. cats are about to have a bad day.','#ffd34d');}

/* ---------------- primary actions ---------------- */
function primaryAction(){
  const t=player.tool;
  if(player.carrying&&t==='hands'){throwCat();return;}
  if(t==='lasso')useLasso();
  else if(t==='shovel')useShovel();
  else if(t==='gun')useGun();
  else if(promptFn)promptFn(); // hands click = interact fallback
}
function throwCat(){
  const c=player.carrying;player.carrying=null;
  c.state='thrown';
  c.vel.copy(camDir()).multiplyScalar(17).add(V3(0,3.5,0));
  c.mesh.position.copy(camera.localToWorld(V3(0,-.1,-.6)));
  meow();}
function useLasso(){
  if(player.lassoCD>0||player.carrying)return;
  player.lassoCD=2.2;
  const cd=camDir(),pp=player.pos;
  let best=null,bs=Math.cos(10*Math.PI/180);
  for(const c of cats){
    if(c.dead||!(c.state==='walk'||c.state==='flushed'||c.state==='stun'||c.state==='bush'))continue;
    const to=c.mesh.position.clone().sub(pp);const d=to.length();
    if(d>14)continue;to.normalize();
    const dot=cd.dot(to);if(dot>bs){bs=dot;best=c;}}
  blip(300,.12,'sine',.15,200);
  if(best){grabCat(best);msg('LASSO’D!','#ffd34d');}
  else msg('lasso missed');}
function useShovel(){
  if(player.shovelCD>0)return;player.shovelCD=.8;
  blip(120,.1,'square',.2,-40);
  const cd=camDir(),pp=player.pos;
  // smash lock?
  if(!dogRun.unlocked){
    const wp=V3();dogRun.lock.getWorldPosition(wp);
    if(pp.distanceTo(wp)<3){unlockDogRun('you smash the lock clean off');return;}}
  let hit=0;
  for(const c of cats){
    if(c.dead||c.state==='carried'||c.state==='tree'||c.state==='hide'||c.state==='chip')continue;
    const to=c.mesh.position.clone().sub(pp);const d=to.length();
    if(d>3.4)continue;to.y=0;to.normalize();
    if(cd.dot(to)>Math.cos(50*Math.PI/180)||d<1.2){
      c.state='thrown';
      c.vel.copy(cd).multiplyScalar(16).add(V3(0,5,0));
      if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
      hit++;meow();}}
  if(hit>1)msg('DOUBLE SCOOP!','#ffd34d');}
function useGun(){
  if(player.gunCD>0)return;player.gunCD=.55;
  blip(1200,.06,'square',.25,-900);
  gunVM.position.z=-.42;setTimeout(()=>gunVM.position.z=-.5,60);
  const cd=camDir(),pp=player.pos;
  // lock first
  if(!dogRun.unlocked){
    const wp=V3();dogRun.lock.getWorldPosition(wp);
    const to=wp.clone().sub(pp);const d=to.length();to.normalize();
    if(d<35&&cd.dot(to)>Math.cos(4*Math.PI/180)){unlockDogRun('you shoot the lock off the dog run');return;}}
  let best=null,bs=Math.cos(5*Math.PI/180),bd=45;
  for(const c of cats){
    if(c.dead||c.state==='carried'||c.state==='chip'||c.state==='hide')continue;
    const to=c.mesh.position.clone().sub(pp);const d=to.length();
    if(d>bd)continue;to.normalize();
    const dot=cd.dot(to);if(dot>bs){bs=dot;best=c;}}
  if(best){
    if(best.state==='tree')catLeaveTree(best);
    best.state='stun';best.stun=6;best.mesh.rotation.z=Math.PI/2;
    poof(best.mesh.position,M.chipRed,4);meow();
    msg('pellet’d. that cat is seeing stars.');}}
function unlockDogRun(t){
  dogRun.unlocked=true;dogRun.lock.visible=false;
  poof(dogRun.lock.getWorldPosition(V3()),M.metal,6);
  msg(t+'. press Q near the run to release the dogs!','#ffd34d');ding();}

/* ---------------- chip a cat ---------------- */
function chipCat(c,how){
  c.dead=true;c.state='chip';scene.remove(c.mesh);
  chipper.gooT=4;
  chipBurst(26,true,1.3);
  chipSound(true);
  gooStain.material.opacity=Math.min(0.95,gooStain.material.opacity+0.25);
  gooStain.scale.multiplyScalar(1.08);
  game.catsChipped++;
  game.combo=(game.comboT>0)?game.combo+1:1;
  game.comboT=6;
  let pts=100*(1+(game.combo-1)*0.25);
  let tags=[];
  if(!game.workStarted){pts*=2;tags.push('EARLY BIRD x2');}
  if(game.frenzy>0){pts*=2;tags.push('FRENZY x2');}
  if(game.teaBreak>0){game.teaChips++;tags.push('TEA TIME');}
  pts=Math.round(pts);
  game.score+=pts;
  const comboEl=document.getElementById('combo');
  comboEl.textContent=(game.combo>1?game.combo+'x COMBO  ':'')+'+$'+pts+(tags.length?'  '+tags.join(' '):'');
  comboEl.style.opacity=1;clearTimeout(chipCat._t);chipCat._t=setTimeout(()=>comboEl.style.opacity=0,1600);
  msg('SCHLORP. +$'+pts,'#ff7b6d');
  // unlocks
  if(game.catsChipped===3&&!player.tools.gun){
    player.tools.gun=true;document.getElementById('t4').classList.add('have');
    banner('PELLET GUN UNLOCKED');msg('pellet gun unlocked! press 4.','#ffd34d');ding();}
  // lady saw it: if it was her cat -> tea
  if(c.fromLady&&!lady.teaReady&&teaState.phase==='none'){
    lady.teaReady=true;
    msg('the old lady is CACKLING. she went to get something...','#e08fb2');}
  // frenzy trigger: 3 chips during tea break
  if(game.teaBreak>0&&game.teaChips>=3&&!game.frenzyDone)startFrenzy();
  updateHUD();
  checkAllCatsGone();
}
function checkAllCatsGone(){
  if(cats.every(c=>c.dead)&&!game.over)endGame(true);}

/* ---------------- lady logic ---------------- */
function updateLady(dt){
  lady.t-=dt;
  if(lady.state==='inside'){
    if(lady.teaReady){lady.state='teaWalk';lady.mesh.visible=true;lady.mesh.position.copy(ladyDoorPos);lady.t=0;
      tray.visible=true;tray.position.copy(ladyDoorPos).add(V3(0,1.3,0));return;}
    if(lady.t<=0&&game.workStarted&&!game.over){
      lady.state='out';lady.mesh.visible=true;lady.mesh.position.copy(ladyDoorPos);lady.t=1.6;
      msg('the old lady is on the porch... and she\'s holding a CAT','#e08fb2');}
  }else if(lady.state==='out'){
    lady.mesh.lookAt(player.pos.x,0,player.pos.z);
    if(lady.t<=0){
      // throw a cat at the camera
      const c=addCat('ladythrow',null);totalCats++;
      c.fromLady=true;
      c.mesh.position.copy(ladyDoorPos).add(V3(0,1.8,0));
      c.throwFrom=c.mesh.position.clone();
      c.throwT=0;
      lady.throwCat=c;
      lady.state='watch';lady.t=4;
      meow();blip(200,.3,'sawtooth',.2,300);
      banner('INCOMING CAT — press E to CATCH');}
  }else if(lady.state==='watch'){
    if(lady.t<=0){lady.state='inside';lady.mesh.visible=false;lady.t=rand(35,55);}
  }else if(lady.state==='teaWalk'){
    // walks tray to the porch table
    const tgt=V3(teaTable.position.x,0,teaTable.position.z+1.2);
    const d=moveToward(lady.mesh,tgt,1.6,dt);
    tray.position.copy(lady.mesh.position).add(V3(0,1.3,0));
    if(d<0.3){
      teaState.phase='onTable';
      tray.position.set(teaTable.position.x,1.35,teaTable.position.z);
      tray.rotation.y=0;
      lady.state='inside';lady.mesh.visible=false;lady.t=rand(40,60);lady.teaReady=false;
      banner('ICED TEA IS OUT');msg('she left a tray of iced tea on the porch table. the crew looks thirsty...','#ffd34d');}
  }
}
function catchLadyCat(){
  const c=lady.throwCat;
  if(!c||c.state!=='ladythrow')return;
  lady.throwCat=null;
  if(player.carrying){msg('hands full! it bounced off you');c.state='flushed';c.t=6;return;}
  c.state='carried';player.carrying=c;
  msg('CAUGHT IT. now hold it til the chipper\'s free...','#ffd34d');ding();}

/* ---------------- tea / crew break ---------------- */
function serveTea(){
  teaState.phase='served';teaState.carried=false;
  tray.visible=false;
  game.teaBreak=20;game.teaChips=0;
  for(const gm of groundies)gm.state='break';
  banner('TEA BREAK — CHIPPER IS ALL YOURS',2600);
  msg('the crew sits down. 20 seconds of pure, unoccupied chipper.','#ffd34d');ding();
  if(chipG)chipG.gain.value=.5;
  chipper.engineOn=true; // idles through break
}
function startFrenzy(){
  game.frenzyDone=true;game.frenzy=30;
  banner('★ ANIMAL CONTROL RAID — 30 SECONDS — 2x POINTS ★',3500);
  msg('an Animal Control van screeches in. dogs everywhere. cats FREAKING OUT.','#ff5b4d');
  // van
  const van=new THREE.Group();
  van.add(box(2.6,2.4,5.4,M.white,0,1.6,0));
  van.add(box(2.5,1,1.6,M.glass,0,1.9,-2.2));
  const beacon=box(.4,.25,.4,new THREE.MeshBasicMaterial({color:0xff2222}),0,2.95,-1.6);van.add(beacon);
  van.position.set(-10,0,58);scene.add(van);
  game.acVan={mesh:van,t:0,beacon};
  // extra dogs pour out
  for(let i=0;i<3;i++){const d=addDog(-10+rand(-2,2),50+rand(-2,2),false);d.state='roam';}
  // every hidden cat gets flushed in waves
  for(const c of cats)if(!c.dead&&(c.state==='hide'||c.state==='bush'))flushCat(c);
  for(const c of cats)if(!c.dead&&c.state==='tree')catLeaveTree(c);
  bark();setTimeout(bark,200);setTimeout(bark,500);
}

/* ---------------- cats update ---------------- */
function nearestHide(from){
  let best=null,bd=1e9;
  for(const h of hideSpots){const d=from.distanceTo(h.pos);if(d<bd){bd=d;best=h;}}
  return best;}
function flushCat(c){
  if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  if(c.spot){const i=c.spot.cats.indexOf(c);if(i>=0)c.spot.cats.splice(i,1);c.spot=null;}
  c.state='flushed';c.t=rand(5,9);c.mesh.visible=true;c.mesh.rotation.z=0;
  c.mesh.position.y=0.02;
  c.target=V3(c.mesh.position.x+rand(-8,8),0,c.mesh.position.z+rand(-8,8));meow();}
function catLeaveTree(c){
  // leap down then flee
  c.state='fall';c.mesh.visible=true;
  c.vel.set(rand(-2,2),1,rand(-2,2));
  if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  meow();}
function moveToward(mesh,tgt,speed,dt){
  const to=tgt.clone().sub(mesh.position);to.y=0;const d=to.length();
  if(d>0.05){to.normalize();mesh.position.addScaledVector(to,Math.min(speed*dt,d));
    mesh.rotation.y=Math.atan2(to.x,to.z)+Math.PI/2*0;
    mesh.rotation.y=Math.atan2(to.x,to.z)-Math.PI/2;}
  return d;}
function updateCats(dt){
  const speedMul=game.frenzy>0?1.7:1;
  for(const c of cats){
    if(c.dead)continue;
    c.meowT-=dt;if(c.meowT<0&&c.mesh.visible&&c.state!=='carried'){c.meowT=rand(6,16);if(Math.random()<.4)meow();}
    switch(c.state){
      case 'walk':{
        c.t-=dt;
        if(!c.target||c.t<=0){c.target=V3(rand(-30,30),0,rand(-25,30));c.t=rand(4,9);}
        moveToward(c.mesh,c.target,1.1*speedMul,dt);
        c.mesh.position.y=Math.abs(Math.sin(game.time*8))*0.05;
        // dogs nearby scare it
        for(const d of dogs)if(d.state!=='penned'&&d.mesh.position.distanceTo(c.mesh.position)<3){c.state='flushed';c.t=6;break;}
        break;}
      case 'bush':{
        c.mesh.position.y=0.02+Math.sin(game.time*2+c.t)*0.02;
        break;}
      case 'tree':{
        c.mesh.position.y=c.home.pos.y+c.limb.h+0.55+Math.sin(game.time*1.5+c.t)*0.05;
        break;}
      case 'fall':{
        c.vel.y-=20*dt;c.mesh.position.addScaledVector(c.vel,dt);
        if(c.mesh.position.y<=0.05){c.mesh.position.y=0.05;
          c.state='flee';c.spotTgt=nearestHide(c.mesh.position);}
        break;}
      case 'flee':{
        if(!c.spotTgt)c.spotTgt=nearestHide(c.mesh.position);
        const d=moveToward(c.mesh,c.spotTgt.pos,4.4*speedMul,dt);
        c.mesh.position.y=Math.abs(Math.sin(game.time*14))*0.1;
        if(d<c.spotTgt.r*0.6){
          c.state='hide';c.spot=c.spotTgt;c.spotTgt.cats.push(c);
          c.mesh.position.y=0.02;c.mesh.visible=game.frenzy>0; // peek only? hidden
          msg('a cat scrambled under '+c.spot.name,'#9fb0c8');}
        break;}
      case 'hide':{
        // stays until dogs flush or frenzy
        break;}
      case 'flushed':{
        c.t-=dt;
        if(!c.target||Math.random()<0.02)c.target=V3(c.mesh.position.x+rand(-10,10),0,c.mesh.position.z+rand(-10,10));
        moveToward(c.mesh,c.target,3.6*speedMul,dt);
        c.mesh.position.y=Math.abs(Math.sin(game.time*12))*0.12;
        if(c.t<=0&&game.frenzy<=0){c.state='flee';c.spotTgt=nearestHide(c.mesh.position);}
        break;}
      case 'stun':{
        c.stun-=dt;
        if(c.stun<=0){c.mesh.rotation.z=0;c.state='flushed';c.t=5;}
        break;}
      case 'thrown':{
        c.vel.y-=22*dt;
        c.mesh.position.addScaledVector(c.vel,dt);
        c.mesh.rotation.x+=dt*9;
        // chipper intake check
        if(c.mesh.position.distanceTo(chipper.intake)<1.5){
          if(chipper.catReady()){chipCat(c,'thrown');continue;}
          else{ // bonk
            c.vel.multiplyScalar(-0.3);c.vel.y=3;
            msg('BONK — chipper was busy. the cat bounced off.','#f88');}}
        if(c.mesh.position.y<=0.15){
          c.mesh.position.y=0.15;c.mesh.rotation.x=0;
          if(c.vel.length()>6){c.vel.multiplyScalar(0.4);c.vel.y=Math.abs(c.vel.y)*0.4;}
          else{c.state='stun';c.stun=1.5;c.mesh.rotation.z=Math.PI/2;}}
        break;}
      case 'ladythrow':{
        c.throwT+=dt/1.7;
        const t=Math.min(1,c.throwT);
        const to=camera.position.clone();to.y-=0.3;
        c.mesh.position.lerpVectors(c.throwFrom,to,t);
        c.mesh.position.y+=Math.sin(t*Math.PI)*5;
        c.mesh.rotation.x+=dt*12;
        if(t>=1){ // whiffed past your head
          lady.throwCat=null;
          c.state='flushed';c.t=7;c.mesh.position.y=0.1;c.mesh.rotation.x=0;
          msg('the cat sailed past your head. rude.');}
        break;}
      case 'carried':break;
    }
    // keep in bounds
    if(c.state!=='tree'&&c.state!=='carried'&&c.state!=='ladythrow'){
      c.mesh.position.x=clamp(c.mesh.position.x,-70,70);
      c.mesh.position.z=clamp(c.mesh.position.z,-58,62);}
  }
}

/* ---------------- dogs update ---------------- */
function updateDogs(dt){
  for(const d of dogs){
    d.t-=dt;
    if(d.state==='penned'){
      if(d.t<=0){d.t=rand(1,4);d.target=V3(dogRun.x+rand(-3,3),0,dogRun.z+rand(-2,2));}
      if(d.target)moveToward(d.mesh,d.target,1.4,dt);
      continue;}
    // roaming: seek structures with hidden cats, else chase visible cats
    if(!d.target||d.t<=0){
      d.t=rand(2,4);
      const withCats=hideSpots.filter(h=>h.cats.length>0);
      if(withCats.length)d.targetSpot=pick(withCats);
      else d.targetSpot=null;
      if(!d.targetSpot){
        const open=cats.filter(c=>!c.dead&&(c.state==='walk'||c.state==='flushed'));
        d.chaseCat=open.length?pick(open):null;}}
    if(d.targetSpot){
      const dd=moveToward(d.mesh,d.targetSpot.pos,5,dt);
      if(dd<d.targetSpot.r*0.8){
        bark();
        const flushing=[...d.targetSpot.cats];
        for(const c of flushing)flushCat(c);
        if(flushing.length)msg('the dogs flushed '+flushing.length+' cat'+(flushing.length>1?'s':'')+' out from '+d.targetSpot.name+'!','#ffd34d');
        d.targetSpot=null;d.t=0.5;}
    }else if(d.chaseCat&&!d.chaseCat.dead&&d.chaseCat.mesh.visible){
      moveToward(d.mesh,d.chaseCat.mesh.position,5.2,dt);
      if(d.mesh.position.distanceTo(d.chaseCat.mesh.position)<2&&d.chaseCat.state==='walk'){
        d.chaseCat.state='flushed';d.chaseCat.t=6;}
      if(Math.random()<0.008)bark();
    }else{
      if(d.t<=0||!d.target){d.target=V3(rand(-35,35),0,rand(-30,35));d.t=rand(2,5);}
      moveToward(d.mesh,d.target,3,dt);}
    d.mesh.position.y=Math.abs(Math.sin(game.time*10+d.t*7))*0.1;
  }
}

/* ---------------- crew / trees update ---------------- */
function currentTree(){return trees[game.curTree]||null;}
const fallenBranches=[]; // {mesh, pos, claimed}
function cutLimb(tr,limb){
  limb.cut=true;
  const wp=V3();limb.group.getWorldPosition(wp);
  // detach & drop
  const drop={mesh:limb.group,vy:0,rot:rand(-2,2),landed:false};
  scene.attach(limb.group);
  drop.pos=limb.group.position;
  fallingLimbs.push(drop);
  poof(wp,M.leaf,8);
  blip(80,.5,'sawtooth',.3,-30);
  // scare this tree's cats
  for(const c of [...tr.cats])catLeaveTree(c);
  // ambient scare: random bush cat
  if(Math.random()<0.35){
    const bc=cats.find(c=>!c.dead&&c.state==='bush');
    if(bc){bc.state='flee';bc.mesh.position.copy(bc.home.pos);bc.spotTgt=nearestHide(bc.mesh.position);
      if(bc.home.cats){const i=bc.home.cats.indexOf(bc);if(i>=0)bc.home.cats.splice(i,1);}
      meow();msg('the chainsaw spooked a cat out of a bush!','#9fb0c8');}}
}
const fallingLimbs=[];
function updateFallingLimbs(dt){
  for(let i=fallingLimbs.length-1;i>=0;i--){
    const f=fallingLimbs[i];
    if(f.landed)continue;
    f.vy-=16*dt;f.mesh.position.y+=f.vy*dt;
    f.mesh.rotation.z+=f.rot*dt;
    if(f.mesh.position.y<=0.5){
      f.mesh.position.y=0.5;f.landed=true;
      fallenBranches.push({mesh:f.mesh,claimed:false});
      fallingLimbs.splice(i,1);}}}
function updateCrew(dt){
  if(game.teaBreak>0){
    // crew sits by the truck
    game.teaBreak-=dt;
    for(const gm of groundies){
      moveToward(gm.mesh,gm.seat,2.5,dt);
      gm.mesh.position.y=lerp(gm.mesh.position.y,-0.45,dt*4);} // sitting = sunk a bit
    arborist.paused=true;
    if(game.teaBreak<=0){
      msg('break\'s over. the crew gets back to work.');
      for(const gm of groundies){gm.state='idle';gm.mesh.position.y=0;}
      arborist.paused=false;}
    return;}
  arborist.paused=false;
  const tr=currentTree();
  if(!tr){if(!game.over)endGame(false);return;}
  // ARBORIST
  const A=arborist;
  if(tr.state==='standing'){
    const base=tr.pos;
    if(A.state==='walk'){
      const d=moveToward(A.mesh,base,3.5,dt);
      if(d<1.3){A.state='climb';A.climbH=0;
        if(!game.workStarted){game.workStarted=true;chipper.engineOn=true;
          if(chipG)chipG.gain.value=.5;
          banner('THE WORK HAS BEGUN');
          msg('chainsaws up. every cat on this lot is now on notice.','#ffd34d');
          moodTarget=MOODS.noon;}}
    }else if(A.state==='climb'){
      const next=tr.limbs.find(l=>!l.cut);
      const targetH=next?next.h:tr.H-1;
      A.climbH=Math.min(A.climbH+dt*1.6,targetH);
      A.mesh.position.set(base.x+0.75,A.climbH-0.8,base.z);
      A.mesh.rotation.y+=dt;
      if(A.climbH>=targetH-0.01){A.state='cut';A.t=3.5;if(sawG&&!muted)sawG.gain.value=.14;}
    }else if(A.state==='cut'){
      A.t-=dt;
      A.mesh.position.x=tr.pos.x+0.75+Math.sin(game.time*22)*0.02;
      if(A.t<=0){
        if(sawG)sawG.gain.value=0;
        const next=tr.limbs.find(l=>!l.cut);
        if(next){cutLimb(tr,next);A.state='climb';}
        else if(!tr.topCut){
          tr.topCut=true;
          scene.attach(tr.top);
          fallingLimbs.push({mesh:tr.top,vy:0,rot:rand(-1,1),landed:false,pos:tr.top.position});
          for(const c of [...tr.cats])catLeaveTree(c);
          A.state='descend';}
        else A.state='descend';}
    }else if(A.state==='descend'){
      A.climbH=Math.max(0,A.climbH-dt*3);
      A.mesh.position.set(tr.pos.x+0.75,A.climbH-0.8,tr.pos.z);
      if(A.climbH<=0){A.mesh.position.y=0;A.state='fell';A.t=2.5;if(sawG&&!muted)sawG.gain.value=.16;}
    }else if(A.state==='fell'){
      A.t-=dt;
      A.mesh.position.set(tr.pos.x+1.4,0,tr.pos.z);
      if(A.t<=0){
        if(sawG)sawG.gain.value=0;
        tr.state='falling';tr.fallT=0;
        blip(60,1,'sawtooth',.35,-40);
        msg('TIMBERRR!','#ffd34d');}}
  }else if(tr.state==='falling'){
    tr.fallT+=dt;
    const a=Math.min(1,tr.fallT/1.6);
    tr.trunk.rotation.z=a*a*(Math.PI/2-0.05);
    tr.trunk.position.x=Math.sin(a*a*(Math.PI/2))*tr.H/2*0.9;
    tr.trunk.position.y=Math.cos(a*a*(Math.PI/2))*tr.H/2+0.3;
    if(a>=1){
      tr.state='bucking';tr.t=6;
      poof(tr.pos.clone().add(V3(tr.H/2,0.5,0)),M.leaf,14);
      // trunk becomes big chipper job
      chipper.queue+=3;
      msg('the crew is bucking the trunk into the chipper...','#9fb0c8');}
  }else if(tr.state==='bucking'){
    tr.t-=dt;
    A.state='walk';A.mesh.position.y=0;
    if(tr.t<=0&&chipper.queue===0){
      scene.remove(tr.group);tr.state='done';
      game.curTree++;
      const left=trees.length-game.curTree;
      if(left>0){msg(left+' tree'+(left>1?'s':'')+' left. cats remaining: '+cats.filter(c=>!c.dead).length,'#9fb0c8');
        if(left===2)moodTarget=MOODS.dusk;
        if(left===1)moodTarget=MOODS.blood;}
      updateHUD();}}
  // GROUNDIES: haul branches to chipper
  for(const gm of groundies){
    if(gm.state==='idle'){
      const br=fallenBranches.find(b=>!b.claimed);
      if(br){br.claimed=true;gm.carry=br;gm.state='fetch';}
      else{moveToward(gm.mesh,V3(6,0,29),2,dt);}
    }else if(gm.state==='fetch'){
      const d=moveToward(gm.mesh,gm.carry.mesh.position,3,dt);
      if(d<1){gm.state='haul';}
    }else if(gm.state==='haul'){
      gm.carry.mesh.position.copy(gm.mesh.position).add(V3(0,1.6,0));
      gm.carry.mesh.rotation.set(0,0,1.2);
      const d=moveToward(gm.mesh,chipper.intake,3,dt);
      if(d<2){
        scene.remove(gm.carry.mesh);
        const i=fallenBranches.indexOf(gm.carry);if(i>=0)fallenBranches.splice(i,1);
        gm.carry=null;chipper.queue++;gm.state='idle';}
    }else if(gm.state==='break'){/* handled in teaBreak block */}
  }
}
function updateChipper(dt){
  if(chipper.gooT>0){
    chipper.gooT-=dt;
    if(Math.random()<0.35){ // goo drips from outlet
      const mouth=chipperG.localToWorld(chuteMouth.clone());
      spawnPart(mouth,V3(rand(-.3,.3),-.5,rand(-.3,.3)),M.chipRed,1.4,rand(1.5,2.5));}}
  if(game.teaBreak>0){chipper.busy=false;intakeGlow.material.color.setHex(0x22ff55);return;}
  if(chipper.queue>0){
    chipper.busy=true;
    chipper.procT+=dt;
    if(Math.random()<0.5)chipBurst(1,false);
    if(chipper.procT>3.2){
      chipper.procT=0;chipper.queue--;
      chipper.pileS=Math.min(1.6,chipper.pileS+0.09);
      pile.scale.setScalar(chipper.pileS);
      if(chipper.queue===0)chipper.busy=false;}
  }else chipper.busy=false;
  intakeGlow.material.color.setHex(chipper.catReady()?0x22ff55:(chipper.engineOn?0xff3322:0x333333));
}

/* ---------------- frenzy update ---------------- */
function updateFrenzy(dt){
  if(game.frenzy<=0)return;
  game.frenzy-=dt;
  if(game.acVan){
    game.acVan.t+=dt;
    if(game.acVan.mesh.position.z>44)game.acVan.mesh.position.z-=dt*10;
    game.acVan.beacon.material.color.setHex(Math.floor(game.acVan.t*4)%2?0xff2222:0x2244ff);}
  // periodic panic waves
  if(Math.random()<dt*0.5){
    const hidden=cats.filter(c=>!c.dead&&c.state==='hide');
    if(hidden.length)flushCat(pick(hidden));}
  if(game.frenzy<=0){
    banner('RAID OVER');
    msg('animal control packs it in. back to normal... ish.');
    if(game.acVan){scene.remove(game.acVan.mesh);game.acVan=null;}
    // return to progression mood
    const left=trees.length-game.curTree;
    moodTarget=left<=1?MOODS.blood:left<=2?MOODS.dusk:MOODS.noon;}
}

/* ---------------- player update ---------------- */
function updatePlayer(dt){
  const sp=(keys['ShiftLeft']||keys['ShiftRight'])?9:5.2;
  const f=V3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const r=V3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const mv=V3();
  if(keys['KeyW'])mv.add(f);if(keys['KeyS'])mv.sub(f);
  if(keys['KeyD'])mv.add(r);if(keys['KeyA'])mv.sub(r);
  if(mv.lengthSq()>0){mv.normalize();player.pos.addScaledVector(mv,sp*dt);}
  // colliders
  for(const c of colliders){
    const dx=player.pos.x-c.x,dz=player.pos.z-c.z;
    const d=Math.hypot(dx,dz);
    if(d<c.r+0.5&&d>0.001){const push=(c.r+0.5-d);player.pos.x+=dx/d*push;player.pos.z+=dz/d*push;}}
  player.pos.x=clamp(player.pos.x,-72,72);
  player.pos.z=clamp(player.pos.z,-60,64);
  player.pos.y=1.7+((mv.lengthSq()>0)?Math.abs(Math.sin(game.time*(sp>6?11:8)))*0.06:0);
  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch,player.yaw,0);
  player.lassoCD=Math.max(0,player.lassoCD-dt);
  player.shovelCD=Math.max(0,player.shovelCD-dt);
  player.gunCD=Math.max(0,player.gunCD-dt);
  // tea serve check
  if(teaState.carried){
    let served=false;
    for(const gm of groundies)if(player.pos.distanceTo(gm.mesh.position)<4)served=true;
    if(player.pos.distanceTo(arborist.mesh.position)<4)served=true;
    if(served)serveTea();}
}

