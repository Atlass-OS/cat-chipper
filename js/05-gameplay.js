/* ---------------- game state ---------------- */
const game={started:false,over:false,paused:true,score:0,catsChipped:0,combo:0,comboT:0,
  workStarted:false,prepT:14,curTree:0,teaBreak:0,teaChips:0,frenzy:0,frenzyDone:false,
  earlyBird:true,tipped:false,acVan:null,goldenSpawned:false,failed:null,failTitle:null,hurtT:0,down:0,qte:null,eatenT:0,qteCD:0,charge:null,catchT:null,_catchTarget:null,_lmbDown:false,bandolier:[],time:0,kick:null,kickCD:0};
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
  tools:{hands:true,lasso:false,shovel:false,gun:false},tool:'hands',lassoCD:0,shovelCD:0,gunCD:0,grabCD:0,grabAttemptT:0,carryProp:null};
const keys={};
const goldMat=new THREE.MeshStandardMaterial({color:0xffd54a,metalness:.95,roughness:.15});
function spawnGoldenCat(){
  const c=addCat('walk',null);
  c.golden=true;
  c.mesh.traverse(o=>{if(o.isMesh)o.material=goldMat;});
  c.mesh.position.set(rand(-14,14),0,rand(2,22));
  c.t=rand(2,4);
  totalCats++;
  game.goldenSpawned=true;
  banner('★ A GOLDEN CAT APPEARS — 5x VALUE ★',3000);
  msg('something shiny darts across the yard. worth a FORTUNE.','#ffd34d');ding();}
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(!game.started||game.paused)return;
  if(game.qte){ // QTE swallows ALL keys (repeats included) — mash counter only
    if(!e.repeat){
      game.qte.prog=Math.min(1,game.qte.prog+0.09);
      struggleSound();
      fxShake=Math.max(fxShake,0.3);}
    return;}
  if(game.eatenT>0)return; // no tool switches while being digested
  if(e.code==='KeyE')interact();
  if(e.code==='KeyQ')tryReleaseDogs();
  if(e.code==='KeyX'){player.prone=!player.prone;msg(player.prone?'prone — crawl under things':'back on your feet','#9fb0c8');}
  if(e.code==='KeyM'){muted=!muted;if(masterG)masterG.gain.value=muted?0:.5;msg(muted?'muted':'unmuted');}
  if(e.code==='Digit1')selectTool('hands');
  if(e.code==='Digit2')selectTool('lasso');
  if(e.code==='Digit3')selectTool('shovel');
  if(e.code==='Digit4')selectTool('gun');});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{game._lmbDown=false;game.catchT=null;game._catchTarget=null;game.charge=null;game.kick=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let _mmAvg=0,_mmN=0; // adaptive spike filter state
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas)return;
  const mx=e.movementX,my=e.movementY;
  // Chrome pointer-lock coalescing artifact: reject one-frame giant deltas outright
  if(Math.abs(mx)>200||Math.abs(my)>200)return;
  // adaptive reject: a delta wildly out of line with recent motion is a spike
  if(_mmN>=10&&_mmAvg>2&&Math.abs(mx)>6*_mmAvg)return;
  _mmAvg=_mmAvg+(Math.abs(mx)-_mmAvg)*0.1;_mmN=Math.min(10,_mmN+1); // ~last-10 running average
  const cx=clamp(mx,-120,120),cy=clamp(my,-120,120);
  player.yaw-=cx*0.0021;player.pitch-=cy*0.0021;
  player.pitch=clamp(player.pitch,-1.45,1.45);});
// press/release actions — shared by desktop mouse (below) and the touch surface (08-mobile.js)
function pressRMB(){
    game._rmbDown=true;
    // 1. cancel an active throw wind-up — keep holding the cat/prop
    if(game.charge!==null&&game.charge!==undefined){
      game.charge=null;blip(220,.08,'sine',.12,-80);
      msg('easy... you keep hold of it.','#9fb0c8');return;}
    if(player.tool==='hands'&&!player.carryProp&&!teaState.carried&&!game.qte&&game.eatenT===0&&game.down<=0){
      // 2. AIRBORNE SNAG: falling/thrown/incoming cats caught with a single RMB click — big hitbox
      let air=null,ad=4.5;
      for(const c of cats){
        if(c.dead)continue;
        if(c.state!=='fall'&&c.state!=='thrown'&&c.state!=='ladythrow')continue;
        const d=player.pos.distanceTo(c.mesh.position);
        if(d<ad){ad=d;air=c;}}
      if(air){
        if(air.state==='ladythrow'){catchThrown();return;}
        if(!player.carrying){
          air.vel.set(0,0,0);air.mesh.rotation.x=0;air._stunOnLand=0;
          grabCat(air);msg('SNAGGED mid-air!','#ffd34d');return;}}
      // 3. RMB-hold = THE catch button, carrying or not: to hand when empty, to bandolier when carrying
      if(!player.carrying||game.bandolier.length<4)beginCatchChannel(2);}}
function pressLMB(){
  game._lmbDown=true;
  if(game.qte||game.eatenT>0||game.down>0)return;
  if(player.tool!=='hands'){primaryAction();return;} // lasso/shovel/gun unchanged
  // ---- HANDS LMB priority chain ----
  // 1. catch the lady/Sarah incoming cat (instant, preempts channel)
  {const _inc=activeThrow();if(_inc&&player.pos.distanceTo(_inc.mesh.position)<3.6){catchThrown();return;}}
  // 2. hostile dog in your face (instant, preempts channel)
  if(tryPuntDog(true))return;
  // 3. carried cat -> bandolier a dazed cat, else start the wind-up throw
  if(player.carrying){if(typeof tryBandolier==='function'&&tryBandolier())return;game.charge=0;game._chargeMeowed=false;return;}
  // 4. carried prop -> start the wind-up throw
  if(player.carryProp){game.charge=0;game._chargeMeowed=false;return;}
  // 5. hands empty -> begin the catch channel on the best cat target
  if(beginCatchChannel())return;
  // 6. no cat: instant non-hostile dog punt, else instant prop pickup (tap semantics)
  if(tryPuntDog(false))return;
  tryPickupProp();}
function releaseRMB(){
  game._rmbDown=false;
  if(game._catchBtn===2&&game.catchT!==null&&game.catchT!==undefined){ // abandon the second-catch channel
    game.catchT=null;game._catchTarget=null;game._catchBtn=null;}}
function releaseLMB(){
  game._lmbDown=false;
  if(game._catchBtn!==2&&game.catchT!==null&&game.catchT!==undefined){game.catchT=null;game._catchTarget=null;game._catchBtn=null;return;} // released before catch = abandon (LMB-owned only)
  if(game.charge===null)return;
  const ch=game.charge;game.charge=null;
  if(game.paused||game.over||game.qte||game.eatenT>0)return;
  if(player.carrying)throwCat(ch);
  else if(player.carryProp)throwProp(ch);}
addEventListener('mousedown',e=>{
  if(document.pointerLockElement!==canvas||game.paused||game.over)return;
  if(e.button===1){e.preventDefault();startKick();return;} // MIDDLE mouse = kick (works even mid-catch)
  if(e.button===2){pressRMB();return;}
  if(e.button===0)pressLMB();});
addEventListener('mouseup',e=>{
  if(e.button===1){releaseKick();return;} // middle mouse releases the kick
  if(e.button===2){releaseRMB();return;}
  if(e.button===0)releaseLMB();});
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
  if(game.over){
    if(player.carrying)player.carrying.mesh.visible=false;
    if(teaState.carried)tray.visible=false;
    return;}
  if(player.carrying){ // carried cat bobs in view
    const c=player.carrying;
    const _ch=(game.charge!==null)?game.charge:0;
    const p=camera.localToWorld(V3(-.35,-.32-.12*_ch,-.75+.28*_ch)); // pulled back+down while winding
    c.mesh.position.copy(p);
    c.mesh.rotation.y=player.yaw+1.4;
    c.mesh.rotation.z=Math.sin(game.time*9)*.12;}
  if(player.carryProp){
    const p=player.carryProp;
    const _chp=(game.charge!==null)?game.charge:0;
    p.mesh.position.copy(camera.localToWorld(V3(.35,-.3-.1*_chp,-.7+.25*_chp)));
    p.mesh.rotation.y=player.yaw;}
  if(teaState.carried){
    tray.position.copy(camera.localToWorld(V3(0,-.4,-.8)));
    tray.rotation.y=player.yaw;}}

/* ---------------- interaction ---------------- */
let promptText='',promptFn=null;
function setPrompt(t,fn){promptText=t;promptFn=fn;}
function computePrompt(){
  setPrompt('',null);
  if(game.qte||game.eatenT>0)return;
  const pp=player.pos,cd=camDir();
  const near=(v,d)=>pp.distanceTo(v)<d;
  const facing=(v,deg=42)=>{const to=v.clone().sub(pp);to.y*=0.4;if(to.lengthSq()<0.01)return true;
    to.normalize();return cd.dot(to)>Math.cos(deg*Math.PI/180);};
  // 1. incoming lady cat
  {const _inc=activeThrow();if(_inc&&near(_inc.mesh.position,3.6)){setPrompt('CLICK — CATCH!',null);return;}}
  // 2. stuff carried cat into chipper
  if(player.carrying&&near(chipper.intake,3.2)){
    if(chipper.catReady())setPrompt('E — feed the cat to the chipper',()=>stuffCat());
    else setPrompt('chipper is busy...',null);return;}
  // 3. tea tray
  if(teaState.phase==='onTable'&&near(tray.position,3)&&facing(tray.position)){
    setPrompt('E — take the iced tea tray',takeTray);return;}
  // hostile dog closing in
  for(const d of dogs){
    if(!d.dead&&d.state==='hostile'&&near(d.mesh.position,2.2)&&facing(d.mesh.position)){
      setPrompt('CLICK — PUNT',null);return;}}
  // 3.5 bandolier a dazed cat (hands full)
  if(player.carrying&&game.bandolier.length<4){
    for(const c of cats){
      if(c.dead||c.state!=='stun')continue;
      if(near(c.mesh.position,3.2)&&facing(c.mesh.position)){
        setPrompt('CLICK — bandolier the cat ('+(game.bandolier.length+1)+'/4)',null);return;}}}
  // 4. grab a cat
  if(!player.carrying&&!teaState.carried){
    let best=null,bd=3.2;
    for(const c of cats){
      if(c.dead)continue;
      const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'&&c.state!=='stored'));
      if(!grabbable)continue;
      const d=pp.distanceTo(c.mesh.position);
      if(d<bd&&facing(c.mesh.position,35)){bd=d;best=c;}}
    if(best){setPrompt(best.state==='bush'?'CLICK — reach into the bush':'CLICK — grab the cat',null);return;}}
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
        setPrompt('E — tip '+gm.name+' $20 to fire up the chipper early',tipCrew);return;}}}
  // 8.7 Braxton's mom — send him back to work
  if(braxton&&braxton.phase==='parked'&&!player.carrying&&!teaState.carried&&near(braxton.worker.mesh.position,2.6)&&facing(braxton.worker.mesh.position)){
    setPrompt('E — tell Braxton it\'s work time',tellBraxton);return;}
  // 9. tickle a crew member (E)
  if(!player.carrying&&!teaState.carried){
    for(const w of tickleWorkers){
      if(w.tickleState!=='none')continue;
      if(w===arborist){
        const tr=currentTree();
        if(!(arborist.mesh.position.y<terrainH(arborist.mesh.position.x,arborist.mesh.position.z)+0.6&&tr&&tr.state==='standing'&&(arborist.state==='walk'||arborist.state==='fell')))continue;}
      if(near(w.mesh.position,2.2)&&facing(w.mesh.position)){
        setPrompt(w.angerStage>=1?'E — tickle him again... (he looks FURIOUS)':'E — tickle under the armpits',()=>tickleWorker(w));
        return;}}}
}
function interact(){
  if(game.qte||game.eatenT>0)return;
  if(player.grabCD>0)return;
  player.grabCD=0.15;
  if(promptFn)promptFn();
}
function tipCrew(){
  game.tipped=true;chipper.engineOn=true;
  if(chipG)chipG.gain.value=.5;
  msg('the crew fires up the chipper and lets it idle. nice.', '#ffd34d');
  banner('EARLY BIRD — chipper is HOT');
  game.score-=20;updateHUD();}
function grabCat(c){
  if(c.spot&&c.spot.cats){const j=c.spot.cats.indexOf(c);if(j>=0)c.spot.cats.splice(j,1);c.spot=null;}
  if(c.state==='bush'&&c.home){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  c.peeking=false;
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
  if(!dogRun.unlocked)return;
  if(!dogRun.released){
    if(player.pos.distanceTo(V3(dogRun.x,0,dogRun.z))>8){msg('get closer to the dog run');return;}
    dogRun.released=true;dogRun.gateHinge.rotation.y=-1.8;
    for(const d of dogs)if(d.state==='penned')d.state='roam';
    bark();setTimeout(bark,300);
    banner('DOGS RELEASED');msg('the dogs are OUT. cats are about to have a bad day. (Q again = whistle them to you)','#ffd34d');
    return;}
  // already out: Q = WHISTLE — dogs converge on the player and flush/scare everything nearby
  if(game._whistleCD>game.time)return;
  game._whistleCD=game.time+8;
  blip(1500,.15,'sine',.25,600);setTimeout(()=>blip(1900,.2,'sine',.22,-400),160); // two-tone whistle
  let called=0;
  for(const d of dogs){
    if(d.dead||d.state==='penned'||d.state==='punted'||d.state==='hostile')continue;
    d.state='called';d.callPos=player.pos.clone();d.callT=6;d.targetSpot=null;d.chaseCat=null;called++;}
  if(called){bark();msg('you whistle — '+called+' dog'+(called>1?'s':'')+' inbound.','#ffd34d');}
  else msg('you whistle. nobody\'s listening.','#9fb0c8');}

/* ---------------- primary actions ---------------- */
function primaryAction(){
  if(game.qte||game.eatenT>0)return;
  if(game.down>0)return; // knocked down — can't act
  const t=player.tool;
  if(t==='hands'){handsPrimary();return;}
  if(t==='lasso')useLasso();
  else if(t==='shovel')useShovel();
  else if(t==='gun')useGun();
}
function knockDown(sec){
  game.down=Math.max(game.down,sec);
  game.catchT=null;game._catchTarget=null;
  game.kick=null;
  thudSound();
  fxShake=Math.max(fxShake,1.0);}
function catScratch(knockChance,srcCat){
  game.hurtT=1;
  game.clawT=0.8; // UX renders the red claw-mark overlay — makes 'what just hurt me' unmistakable
  scratchSound();
  blip(620,.16,'sawtooth',.2,-380);meow();
  // attack animation: the cat LUNGES at the camera, swipes, and lands past you
  if(srcCat&&!srcCat.dead&&srcCat.state!=='carried'&&srcCat.state!=='stored'&&srcCat.state!=='chip'){
    srcCat._lungeT=0.5;srcCat._lungeFrom=srcCat.mesh.position.clone();
    srcCat._lungeTo=camera.position.clone();srcCat._lungeTo.y-=0.5;}
  if(Math.random()<knockChance)knockDown(1.2);}
function handsPrimary(){
  // (a) catch the lady's incoming cat if it's in the catch window
  {const _inc=activeThrow();if(_inc&&player.pos.distanceTo(_inc.mesh.position)<3.6){catchThrown();return;}}
  // (b) throw a carried cat
  if(player.carrying){throwCat();return;}
  // (b2) throw a carried prop
  if(player.carryProp){throwProp();return;}
  // (b3) a hostile dog in your face beats everything
  if(tryPuntDog(true))return;
  // (c) cats take priority over peaceful dogs and props
  if(tryGrabCat())return;
  if(tryPuntDog(false))return;
  tryPickupProp();}
function grabTestCat(c,cd,pp,chasing){
  // returns 0 = miss, 1 = graze, 2 = hit. tests BOTH current and predicted position.
  const maxD=chasing?4.0:3.2;
  const cone=Math.cos((chasing?45:35)*Math.PI/180);
  const outerCone=Math.cos(55*Math.PI/180);
  let hit=0;
  for(let pass=0;pass<2;pass++){
    const lead=pass===0?0:0.15;
    const px=c.mesh.position.x+(c.vApprox?c.vApprox.x*lead:0);
    const py=c.mesh.position.y;
    const pz=c.mesh.position.z+(c.vApprox?c.vApprox.z*lead:0);
    const tox=px-pp.x,toy=(py-pp.y)*0.4,toz=pz-pp.z;
    const d=Math.hypot(tox,toy,toz);if(d<0.001)return 2;
    const dot=(cd.x*tox+cd.y*toy+cd.z*toz)/d;
    if(d<maxD&&dot>cone)return 2;
    if(d<4.2&&dot>outerCone)hit=Math.max(hit,1);}
  return hit;}
function isChasing(c,cd){
  // chase geometry: cat's velocity points away from the player AND the player is looking/moving toward it
  if(!c.vApprox)return false;
  const sp2=c.vApprox.x*c.vApprox.x+c.vApprox.z*c.vApprox.z;
  if(sp2<0.5)return false; // cat basically stationary
  const tox=c.mesh.position.x-player.pos.x,toz=c.mesh.position.z-player.pos.z;
  const dl=Math.hypot(tox,toz);if(dl<0.001)return true;
  const away=(c.vApprox.x*tox+c.vApprox.z*toz)/(Math.sqrt(sp2)*dl);
  return away>0.3&&(cd.x*tox+cd.z*toz)/dl>0.3;}
function tryGrabCat(){
  const cd=camDir(),pp=player.pos;
  let best=null,bd=1e9,graze=false,grazeStationary=false,grazeCat=null;
  for(const c of cats){
    if(c.dead)continue;
    const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'&&c.state!=='carried'&&c.state!=='chip'&&c.state!=='stored'));
    if(!grabbable)continue;
    const chasing=isChasing(c,cd);
    const r=grabTestCat(c,cd,pp,chasing);
    if(r===2){const d=pp.distanceTo(c.mesh.position);if(d<bd){bd=d;best=c;}}
    else if(r===1){graze=true;grazeCat=c;if(!chasing)grazeStationary=true;}}
  if(best){player.grabAttemptT=0;grabCat(best);return true;}
  // sticky grab: keep the attempt alive 0.25s — completed in updatePlayer if a cat enters the hitbox
  player.grabAttemptT=0.25;
  // scratch only on stationary/defensive misses (bush reach-ins, stunned, walkers) — never punish the chase
  if(graze&&grazeStationary)catScratch(0.25,grazeCat);
  return false;
}
/* ---------------- hold-LMB catch channel (contract: game.catchT = null|0..1) ---------------- */
function selectGrabTarget(){
  const cd=camDir(),pp=player.pos;
  let best=null,bd=1e9,graze=false,grazeStationary=false,grazeCat=null;
  for(const c of cats){
    if(c.dead)continue;
    const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'&&c.state!=='carried'&&c.state!=='chip'&&c.state!=='stored'));
    if(!grabbable)continue;
    const chasing=isChasing(c,cd);
    const r=grabTestCat(c,cd,pp,chasing);
    if(r===2){const d=pp.distanceTo(c.mesh.position);if(d<bd){bd=d;best=c;}}
    else if(r===1){graze=true;grazeCat=c;if(!chasing)grazeStationary=true;}}
  return {best,graze,grazeStationary,grazeCat};}
function catchDuration(c){
  // AGITATED ~1.2s ; CALM ~0.25s
  if(game.frenzy>0)return 1.2;
  if(!c)return 0.25;
  if(c.state==='flushed'||c.state==='flee'||(c.winded>0))return 1.2;
  return 0.25;}
function catchTargetValid(c,cd,pp){
  if(!c||c.dead)return false;
  const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'&&c.state!=='carried'&&c.state!=='chip'&&c.state!=='stored'));
  if(!grabbable)return false;
  return grabTestCat(c,cd,pp,isChasing(c,cd))===2;}
function beginCatchChannel(btn=0){
  // returns true if a channel started; false = no cat target (caller falls through to punt/pickup/kick)
  // btn 0 = LMB empty-hands catch-to-hand; btn 2 = RMB catch-a-second-cat-to-bandolier while carrying
  const sel=selectGrabTarget();
  if(sel.best){game._catchTarget=sel.best;game.catchT=0;game._catchBtn=btn;blip(360,.05,'sine',.1,120);return true;}
  // preserve scratch-on-defensive-miss (stationary/bush/stunned graze only — never punish the chase)
  if(sel.graze&&sel.grazeStationary)catScratch(0.25,sel.grazeCat);
  return false;}
function updateCatchChannel(dt){
  if(game.catchT===null||game.catchT===undefined)return;
  // cancel cleanly if the channel is no longer legal (legality differs by owning button)
  const rmb=game._catchBtn===2;
  const held=rmb?game._rmbDown:game._lmbDown;
  const carryBad=rmb?player.carryProp:(player.carrying||player.carryProp); // RMB channels with or without a hand cat
  if(!held||player.tool!=='hands'||carryBad||teaState.carried||game.qte||game.eatenT>0||game.down>0){
    game.catchT=null;game._catchTarget=null;game._catchBtn=null;return;}
  const cd=camDir(),pp=player.pos;
  let tgt=game._catchTarget;
  if(catchTargetValid(tgt,cd,pp)){
    game.catchT+=dt/catchDuration(tgt); // accrue on the SAME cat
  }else{
    const sel=selectGrabTarget();
    if(sel.best){game._catchTarget=sel.best;game.catchT=0;} // switching targets restarts
    else if(tgt&&!tgt.dead){game.catchT-=2*dt/catchDuration(tgt);if(game.catchT<0)game.catchT=0;} // forgiveness decay at 2x
    else{game.catchT=null;game._catchTarget=null;return;}}
  if(game.catchT>=1){
    const c=game._catchTarget,wasRmb=game._catchBtn===2;
    game.catchT=null;game._catchTarget=null;game._catchBtn=null;
    if(wasRmb&&player.carrying){ // hands full -> bandolier (awake cats wake MUCH sooner than dazed ones)
      if(game.bandolier.length>=4){msg('bandolier is FULL. four is plenty.','#f88');return;}
      if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
      if(c.spot&&c.spot.cats){const i=c.spot.cats.indexOf(c);if(i>=0)c.spot.cats.splice(i,1);c.spot=null;}
      const dazed=c.state==='stun';
      c.state='stored';c.peeking=false;c.winded=0;c.sprintT=0;
      c.mesh.visible=false;c.mesh.rotation.z=0;
      game.bandolier.push({cat:c,wakeT:dazed?rand(20,30):rand(6,10)});
      blip(500,.1,'square',.18);meow();
      msg('bandoliered ('+game.bandolier.length+'/4)'+(dazed?'.':' — it\'s AWAKE. it will not stay put long.'),dazed?'#ffd34d':'#ff8f5b');
      return;}
    grabCat(c); // to hand (existing path)
    if(game._lmbDown){game.charge=0;game._chargeMeowed=false;} // hold-to-catch flows into hold-to-charge
  }}
function updateStickyGrab(dt){
  if(!player.grabAttemptT||player.grabAttemptT<=0)return;
  player.grabAttemptT-=dt;
  if(player.carrying||teaState.carried||player.carryProp){player.grabAttemptT=0;return;}
  const cd=camDir(),pp=player.pos;
  for(const c of cats){
    if(c.dead)continue;
    const grabbable=(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking||(game.frenzy>0&&c.state!=='tree'&&c.state!=='hide'&&c.state!=='carried'&&c.state!=='chip'&&c.state!=='stored'));
    if(!grabbable)continue;
    if(grabTestCat(c,cd,pp,isChasing(c,cd))===2){
      player.grabAttemptT=0;grabCat(c);return;}}
}
/* ---------------- prop manipulation ---------------- */
function propsAvail(){return (typeof props!=='undefined'&&props)?props:null;}
function tryPickupProp(){
  const P=propsAvail();if(!P||player.carryProp)return false;
  const cd=camDir(),pp=player.pos;
  let best=null,bd=2.5;
  for(const p of P){
    if(p._gone||p._held)continue;
    const to=p.mesh.position.clone().sub(pp);to.y*=0.4;
    const d=to.length();if(d>bd||d<0.001)continue;
    to.normalize();
    if(cd.dot(to)>Math.cos(45*Math.PI/180)){bd=d;best=p;}}
  if(!best)return false;
  best._held=true;best._vel=best._vel||V3();best._vel.set(0,0,0);best._air=false;
  player.carryProp=best;
  blip(340,.08,'square',.15);
  return true;}
function throwProp(ch=0){
  const p=player.carryProp;if(!p)return;
  player.carryProp=null;p._held=false;
  p._air=true;p._bounced=false;
  p._vel=p._vel||V3();
  p._vel.copy(camDir()).multiplyScalar(clamp(14/Math.max(0.3,p.mass),6,26)*lerp(1,2,ch)).add(V3(0,lerp(3,5.5,ch),0));
  p.mesh.position.copy(camera.localToWorld(V3(.2,-.15,-.7)));
  blip(240,.1,'square',.2,-80);}
function updatePropsSim(dt){
  const P=propsAvail();if(!P)return;
  for(const p of P){
    if(p._gone||p._held||!p._air)continue;
    p._vel.y-=22*dt;
    p.mesh.position.addScaledVector(p._vel,dt);
    p.mesh.rotation.x+=dt*6;p.mesh.rotation.z+=dt*4;
    // chipper intake?
    if(chipper.engineOn&&chipper.catReady()&&p.mesh.position.distanceTo(chipper.intake)<1.5){
      chipBurst(8,false,1);
      msg(p.mass>=1?'the '+(p.name||'prop')+' is mulch. the crew pretends not to notice.':'shredded. no one saw that.','#9fb0c8');
      scene.remove(p.mesh);p._gone=true;p._air=false;continue;}
    // bonk a cat?
    for(const c of cats){
      if(c.dead||c.state==='tree'||c.state==='hide'||c.state==='carried'||c.state==='chip'||c.state==='stun')continue;
      if(p.mesh.position.distanceTo(c.mesh.position)<1.0+p.r){
        c.state='stun';c.stun=2;c.mesh.rotation.z=Math.PI/2;
        poof(c.mesh.position,M.chipRed,3);meow();
        msg('DONK. right off the noggin.','#ffd34d');
        p._vel.multiplyScalar(0.3);break;}}
    // ground
    const rest=terrainH(p.mesh.position.x,p.mesh.position.z)+Math.max(0.08,p.r*0.8);
    if(p.mesh.position.y<=rest){
      p.mesh.position.y=rest;
      if(!p._bounced&&Math.hypot(p._vel.x,p._vel.z)+Math.abs(p._vel.y)>3){
        p._bounced=true;
        p._vel.y=Math.abs(p._vel.y)*0.4;p._vel.x*=0.5;p._vel.z*=0.5;}
      else{p._air=false;p._vel.set(0,0,0);p.mesh.rotation.x=0;p.mesh.rotation.z=0;}}}
}
function kickProps(mv,dt){
  const P=propsAvail();if(!P||mv.lengthSq()===0)return;
  for(const p of P){
    if(p._gone||p._held||p.mass>=1)continue;
    const dx=p.mesh.position.x-player.pos.x,dz=p.mesh.position.z-player.pos.z;
    if(Math.hypot(dx,dz)<0.9&&!p._air){
      p._air=true;p._bounced=true;
      p._vel=p._vel||V3();
      p._vel.set(mv.x*2,1.2,mv.z*2);
      blip(180,.06,'square',.12);}}
}
/* ---------------- dog punt ---------------- */
function tryPuntDog(hostileOnly){
  const cd=camDir(),pp=player.pos;
  let best=null,bd=2.2;
  for(const d of dogs){
    if(d.dead||d.state==='penned'||d.state==='punted'||d.state==='dogstun')continue;
    if(hostileOnly&&d.state!=='hostile')continue;
    const to=d.mesh.position.clone().sub(pp);to.y*=0.4;
    const dist=to.length();if(dist>bd||dist<0.001)continue;
    to.normalize();
    if(cd.dot(to)>Math.cos(50*Math.PI/180)){bd=dist;best=d;}}
  if(!best)return false;
  puntDog(best);return true;}
function puntDog(d){
  d.wasHostile=d.state==='hostile';
  d.state='punted';d.hostileT=0;
  d.vel.copy(camDir()).multiplyScalar(14).add(V3(0,6,0));
  yelp();thudSound();fxShake=Math.max(fxShake,0.7);
  msg(d.wasHostile?'PUNT. self defense, your honor.':'PUNT. that felt... unnecessary.','#ffd34d');}
/* ---------------- RMB kick (contract: game.kick = null|0..1, game.kickCD 0=ready) ---------------- */
function startKick(){
  if(game.over||game.qte||game.eatenT>0||game.down>0)return;
  if(game.charge!==null)return;            // a throw wind-up already owns the input — first one wins
  // (kick is allowed DURING a catch channel now — middle mouse is independent of RMB catching)
  if(game.kick!==null&&game.kick!==undefined)return;
  if(game.kickCD>0)return;
  game.kick=0;
  blip(150,.05,'square',.12,-40);}        // faint wind-up tick
function updateKick(dt){
  game.kickCD=Math.max(0,game.kickCD-dt);
  if(game.kick===null||game.kick===undefined)return;
  if(game.qte||game.eatenT>0||game.down>0){game.kick=null;return;} // cancel cleanly on peril
  game.kick=Math.min(1,game.kick+dt/0.9);}
function releaseKick(){
  if(game.kick===null||game.kick===undefined)return;
  const ch=Math.max(0.25,game.kick);       // min 25% power on a tap
  game.kick=null;
  if(game.paused||game.over||game.qte||game.eatenT>0||game.down>0)return;
  doKick(ch);}
function doKick(ch){
  const cd=camDir(),pp=player.pos;
  const range=2.3,coneCos=Math.cos(50*Math.PI/180);
  const inArc=v=>{const to=v.clone().sub(pp);to.y*=0.4;const d=to.length();if(d>range||d<0.001)return -1;to.normalize();return cd.dot(to)>coneCos?d:-1;};
  let best=null,bd=1e9,type=null;
  for(const c of cats){
    if(c.dead||c.state==='tree'||c.state==='hide'||c.state==='carried'||c.state==='chip'||c.state==='stored'||c.state==='ladythrow')continue;
    const d=inArc(c.mesh.position);if(d>=0&&d<bd){bd=d;best=c;type='cat';}}
  for(const dg of dogs){
    if(dg.dead||dg.state==='penned'||dg.state==='punted'||dg.state==='dogstun')continue;
    const d=inArc(dg.mesh.position);if(d>=0&&d<bd){bd=d;best=dg;type='dog';}}
  const P=propsAvail();
  if(P)for(const p of P){
    if(p._gone||p._held)continue;
    const d=inArc(p.mesh.position);if(d>=0&&d<bd){bd=d;best=p;type='prop';}}
  if(snappedWorker&&snappedWorker.tickleState==='chase'){
    const d=inArc(snappedWorker.mesh.position);if(d>=0&&d<bd){bd=d;best=snappedWorker;type='worker';}}
  if(best){
    if(type==='cat'){
      const c=best;
      if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
      if(c.spot&&c.spot.cats){const i=c.spot.cats.indexOf(c);if(i>=0)c.spot.cats.splice(i,1);c.spot=null;}
      c.peeking=false;c.state='thrown';c.mesh.rotation.x=0;
      c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.55; // pop off the ground — else the thrown-state landing check (y<=0.15) eats the velocity same-frame
      { // artillery punt: prior speed DOUBLED, launch inclination raised +20° (designer: across the yard into the chipper)
        const h0=(6+16*ch)*3.9,v0=Math.max(6,(2+4*ch)*3.9);
        const spd=0.5*Math.hypot(h0,v0),ang=Math.atan2(v0,h0)+20*Math.PI/180; // tuned down twice from the artillery era
        const hd=cd.clone();hd.y=0;if(hd.lengthSq()<0.001)hd.set(0,0,-1);hd.normalize();
        c.vel.copy(hd).multiplyScalar(spd*Math.cos(ang));c.vel.y=spd*Math.sin(ang);}
      c._kicked=true;
      meow();thudSound();fxShake=Math.max(fxShake,0.4+0.5*ch);
      msg(ch>0.85?'PUNTED into orbit.':'you boot the cat across the yard.','#ffd34d');
    }else if(type==='dog'){
      const d=best;d.wasHostile=d.state==='hostile';d.state='punted';d.hostileT=0;
      { // doubled + lofted 20° like the cat punt
        const h0=(8+10*ch)*3.16,v0=(4+3*ch)*2.2;
        const spd=2*Math.hypot(h0,v0),ang=Math.atan2(v0,h0)+20*Math.PI/180;
        const hd=cd.clone();hd.y=0;if(hd.lengthSq()<0.001)hd.set(0,0,-1);hd.normalize();
        d.vel.copy(hd).multiplyScalar(spd*Math.cos(ang));d.vel.y=spd*Math.sin(ang);
        d.mesh.position.y=Math.max(d.mesh.position.y,terrainH(d.mesh.position.x,d.mesh.position.z)+0.6);}
      yelp();thudSound();fxShake=Math.max(fxShake,0.6+0.3*ch);
      msg(d.wasHostile?'KICK. self defense, your honor.':'KICK. the dog did not deserve that.','#ffd34d');
    }else if(type==='prop'){
      const p=best;p._held=false;p._air=true;p._bounced=false;p._vel=p._vel||V3();
      { // doubled + lofted 20°
        const h0=clamp(14/Math.max(0.3,p.mass),6,26)*(0.4+0.9*ch)*3.16,v0=(2+3*ch)*2.2;
        const spd=2*Math.hypot(h0,v0),ang=Math.atan2(v0,h0)+20*Math.PI/180;
        const hd=cd.clone();hd.y=0;if(hd.lengthSq()<0.001)hd.set(0,0,-1);hd.normalize();
        p._vel.copy(hd).multiplyScalar(spd*Math.cos(ang));p._vel.y=spd*Math.sin(ang);
        p.mesh.position.y=Math.max(p.mesh.position.y,terrainH(p.mesh.position.x,p.mesh.position.z)+0.5);}
      blip(220,.08,'square',.18,-60);}
    else if(type==='worker'){ // one shovel-parry-equivalent hit
      const w=best;w.parried=(w.parried||0)+1;
      thudSound();fxShake=Math.max(fxShake,0.8);
      w.tickleState='parried';w.mesh.rotation.z=Math.PI/2;w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z)+0.2;
      if(w.parried>=2){w.parryT=5;msg(w.name+' decides it isn\'t worth it. his cousin will hear about this.','#5dff7a');}
      else{w.parryT=2.7;msg(w.name+' is BEYOND litigation now.','#ff5b4d');}}
    game.kickCD=0.45;return;}
  // no dynamic target hit
  if(ch>0.4){
    for(const c of colliders){
      let near;
      if(c.rect){ // rect-aware: distance to the fitted box, not its center
        const cs=Math.cos(-(c.yaw||0)),sn=Math.sin(-(c.yaw||0));
        const dx=pp.x-c.x,dz=pp.z-c.z;
        const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
        near=Math.hypot(lx-clamp(lx,-c.hw,c.hw),lz-clamp(lz,-c.hd,c.hd))<1.1;
      }else near=Math.hypot(pp.x-c.x,pp.z-c.z)<1.6;
      if(near){ // stubbed toe on something immovable = self-harm
        game.hurtT=Math.max(game.hurtT,0.7);
        thudSound();blip(85,.2,'square',.2,-40); // low grunt
        fxShake=Math.max(fxShake,0.6);
        game.kickCD=4;
        msg('you kicked a tree. the tree wins.','#ff5b4d');
        return;}}}
  // whiff into open air
  thudSound();game.kickCD=0.5;}
function chipDog(d){
  d.dead=true;scene.remove(d.mesh);
  chipper.redT=4;chipper.gooT=Math.max(chipper.gooT,4.05);chipper.catLoadT=0.6;
  chipBurst(26,true,1.3);chipSound(true);
  gooStain.material.opacity=Math.min(0.95,gooStain.material.opacity+0.25);
  gooStain.scale.multiplyScalar(1.08);
  fxShake=Math.max(fxShake,0.9);
  if(d.wasHostile){game.score+=150;banner('SELF DEFENSE +$150');msg('the hostile dog has been... resolved. +$150','#ffd34d');updateHUD();}
  else msg('that one wasn\'t even mad at you. the protesters will remember this.','#ff5b4d');}
function throwCat(ch=0){
  const c=player.carrying;player.carrying=null;
  c.state='thrown';
  c.vel.copy(camDir()).multiplyScalar(lerp(17,34,ch)).add(V3(0,lerp(3.5,6,ch),0));
  c.mesh.position.copy(camera.localToWorld(V3(0,-.1,-.6)));
  meow();}
function useLasso(){
  if(player.lassoCD>0||player.carrying)return;
  player.lassoCD=2.2;
  const cd=camDir(),pp=player.pos;
  let best=null,bestDot=0;
  for(const c of cats){
    if(c.dead||!(c.state==='walk'||c.state==='flushed'||c.state==='flee'||c.state==='stun'||c.state==='bush'||c.peeking))continue;
    const spd=c.vApprox?Math.hypot(c.vApprox.x,c.vApprox.z):0;
    const cone=Math.cos((spd>2?18:10)*Math.PI/180);
    for(let pass=0;pass<2;pass++){
      const lead=pass?0.12:0;
      const to=V3(c.mesh.position.x+(c.vApprox?c.vApprox.x*lead:0)-pp.x,
                  c.mesh.position.y-pp.y,
                  c.mesh.position.z+(c.vApprox?c.vApprox.z*lead:0)-pp.z);
      const d=to.length();if(d>14||d<0.001)continue;to.normalize();
      const dot=cd.dot(to);
      if(dot>cone&&dot>bestDot){bestDot=dot;best=c;}}}
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
  // PARRY a chasing worker
  if(snappedWorker&&snappedWorker.tickleState==='chase'){
    const w=snappedWorker;
    const to=w.mesh.position.clone().sub(pp);to.y=0;const dw=to.length();
    if(dw<3){
      to.normalize();
      if(cd.dot(to)>Math.cos(60*Math.PI/180)||dw<1.2){
        w.parried=(w.parried||0)+1;
        thudSound();fxShake=Math.max(fxShake,0.8);
        w.tickleState='parried';
        w.mesh.rotation.z=Math.PI/2;w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z)+0.2;
        if(w.parried>=2){w.parryT=5;
          msg(w.name+' decides it isn\'t worth it. his cousin will hear about this.','#5dff7a');}
        else{w.parryT=2.7; // 10% faster than a 3s knockdown — and angrier
          msg(w.name+' is BEYOND litigation now.','#ff5b4d');}
        return;}}}
  let hit=0;
  for(const c of cats){
    if(c.dead||c.state==='carried'||c.state==='tree'||c.state==='hide'||c.state==='chip'||c.state==='stored')continue;
    const to=c.mesh.position.clone().sub(pp);const d=to.length();
    if(d>3.4)continue;to.y=0;to.normalize();
    if(cd.dot(to)>Math.cos(50*Math.PI/180)||d<1.2){
      c.state='thrown';
      c.mesh.position.y=Math.max(c.mesh.position.y,terrainH(c.mesh.position.x,c.mesh.position.z)+0.3); // clear the same-frame landing check
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
  if(accuser){
    const ato=accuser.mesh.position.clone().sub(pp);const ad=ato.length();ato.normalize();
    if(ad<40&&cd.dot(ato)>Math.cos(6*Math.PI/180)){
      const a=accuser;a.confronting=false;accuser=null;a.snapReason='accusation';
      snapWorker(a);msg('you SHOT at him?! oh, now he is coming for you.','#ff5b4d');return;}}
  let best=null,bestDot=0,bd=45;
  for(const c of cats){
    if(c.dead||c.state==='carried'||c.state==='chip'||c.state==='hide'||c.state==='stored')continue;
    const spd=c.vApprox?Math.hypot(c.vApprox.x,c.vApprox.z):0;
    const cone=Math.cos((spd>3?8:5)*Math.PI/180); // moving-target forgiveness
    for(let pass=0;pass<2;pass++){
      const lead=pass?0.12:0;
      const to=V3(c.mesh.position.x+(c.vApprox?c.vApprox.x*lead:0)-pp.x,
                  c.mesh.position.y-pp.y,
                  c.mesh.position.z+(c.vApprox?c.vApprox.z*lead:0)-pp.z);
      const d=to.length();if(d>bd||d<0.001)continue;to.normalize();
      const dot=cd.dot(to);
      if(dot>cone&&dot>bestDot){bestDot=dot;best=c;}}}
  if(best){
    if(best.state==='tree'){ // shot out of the tree: it FALLS, and lands stunned
      catLeaveTree(best);best._stunOnLand=6;
      poof(best.mesh.position,M.chipRed,4);meow();
      msg('pellet’d — it\'s coming DOWN.');}
    else{
      best.state='stun';best.stun=6;best.mesh.rotation.z=Math.PI/2;
      poof(best.mesh.position,M.chipRed,4);meow();
      msg('pellet’d. that cat is seeing stars.');}}
  else{
    let dbest=null,dbs=Math.cos(5*Math.PI/180);
    for(const d of dogs){
      if(d.state==='penned')continue;
      const to=d.mesh.position.clone().sub(pp);const dd=to.length();
      if(dd>45)continue;to.normalize();
      const dot=cd.dot(to);if(dot>dbs){dbs=dot;dbest=d;}}
    if(dbest){
      yelp();bark();poof(dbest.mesh.position,M.chipRed,5);
      dbest.state='hostile';dbest.hostileT=12;dbest.boreT=0;
      msg('you SHOT the DOG?! he remembers.','#ff5b4d');}}
}
function unlockDogRun(t){
  dogRun.unlocked=true;dogRun.lock.visible=false;
  poof(dogRun.lock.getWorldPosition(V3()),M.metal,6);
  msg(t+'. press Q near the run to release the dogs!','#ffd34d');ding();}

/* ---------------- chip a cat ---------------- */
function chipCat(c,how){
  c.dead=true;c.state='chip';scene.remove(c.mesh);
  chipper.redT=4;   // phase 1: red debris SPRAY (re-chips refresh it)
  chipper.catLoadT=0.6; // engine load spikes to 1.0 briefly
  chipper.gooT=4.05; // pinned during spray (keeps 01's chipper/goo lights red), drips only after redT ends
  fxShake=Math.max(fxShake,0.9);
  chipBurst(26,true,1.3);
  chipSound(true);
  gooStain.material.opacity=Math.min(0.95,gooStain.material.opacity+0.25);
  gooStain.scale.multiplyScalar(1.08);
  game.catsChipped++;
  game.combo=(game.comboT>0)?game.combo+1:1;
  game.comboT=5;
  let pts=100*(1+(game.combo-1)*0.35);
  let tags=[];
  if(!game.workStarted){pts*=2;tags.push('EARLY BIRD x2');}
  if(game.frenzy>0){pts*=2;tags.push('FRENZY x2');}
  if(game.teaBreak>0){game.teaChips++;tags.push('TEA TIME');}
  if(c.golden){pts*=5;tags.push('GOLDEN x5');}
  if(c._kicked){
    pts*=3;tags.push('FIELD GOAL x3');
    banner('⚡ FIELD GOAL!!! ⚡',2600);
    if(typeof hornSound==='function')hornSound();
    fxShake=Math.max(fxShake,1.4);}
  pts=Math.round(pts);
  game.score+=pts;
  if(typeof spawnScorePop==='function'){
    const _pp=chipperG.localToWorld(chuteMouth.clone());
    spawnScorePop(_pp,'+$'+pts,c._kicked?'#ffd34d':'#ff5b4d',c._kicked?2.2:1.3);}
  const comboEl=document.getElementById('combo');
  comboEl.textContent=(game.combo>1?game.combo+'x COMBO  ':'')+'+$'+pts+(tags.length?'  '+tags.join(' '):'');
  comboEl.style.opacity=1;clearTimeout(chipCat._t);chipCat._t=setTimeout(()=>comboEl.style.opacity=0,1600);
  msg('SCHLORP. +$'+pts,'#ff7b6d');
  // unlocks
  if(game.catsChipped===3&&!player.tools.gun){
    player.tools.gun=true;document.getElementById('t4').classList.add('have');
    banner('PELLET GUN UNLOCKED');msg('pellet gun unlocked! press 4.','#ffd34d');ding();}
  // lady saw it: if it was her cat -> tea
  if(c.fromLady){
    if(c.catName)msg(c.catName+' has been... processed.','#e08fb2');
    if(!lady.teaReady&&teaState.phase==='none'){
      lady.teaReady=true;
      msg('the matriarch is CACKLING on the porch. she has gone to fetch something...','#e08fb2');}}
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
      msg('the matriarch appears on her porch in a monogrammed robe... cradling a cat.','#e08fb2');}
  }else if(lady.state==='out'){
    lady.mesh.lookAt(player.pos.x,0,player.pos.z);
    if(Math.random()<dt*0.4)msg('“'+pick(LADY_LINES)+'”','#e08fb2');
    if(lady.t<=0){
      // throw a cat at the camera
      const c=addCat('ladythrow',null);totalCats++;
      c.fromLady=true;
      c.catName=pick(LADY_CATS);
      c.mesh.position.copy(ladyDoorPos).add(V3(0,1.8,0));
      c.throwFrom=c.mesh.position.clone();
      c.throwT=0;
      lady.throwCat=c;
      lady.state='watch';lady.t=4;
      alertSound();
      banner('INCOMING — '+c.catName.toUpperCase()+'! (CLICK to catch)');
      msg('she winds up and hurls '+c.catName+' at your head.','#e08fb2');}
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
function activeThrow(){
  if(lady.throwCat&&lady.throwCat.state==='ladythrow')return lady.throwCat;
  if(typeof braxton!=='undefined'&&braxton&&braxton.throwCat&&braxton.throwCat.state==='ladythrow')return braxton.throwCat;
  return null;}
function catchThrown(){
  const c=activeThrow();if(!c)return;
  if(c.thrower==='sarah'){if(typeof braxton!=='undefined'&&braxton)braxton.throwCat=null;}
  else lady.throwCat=null;
  if(player.carrying){msg('hands full! it bounced off you');c.state='flushed';c.t=6;return;}
  c.state='carried';player.carrying=c;
  msg('CAUGHT IT. now hold it til the chipper\'s free...','#ffd34d');ding();}
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
  sirenStart();
  game.frenzyDone=true;game.frenzy=30;
  banner('★ HOA COMPLIANCE RAID — 30 SECONDS — 2x POINTS ★',3500);
  msg('a beige sedan glides in. clipboard inspectors in pressed khakis fan out, writing citations for EVERYONE.','#ff5b4d');
  // van
  const van=new THREE.Group();
  van.add(box(2.6,2.4,5.4,new THREE.MeshStandardMaterial({color:0xd8cba0,roughness:.7}),0,1.6,0));
  van.add(box(2.5,1,1.6,M.glass,0,1.9,-2.2));
  const beacon=box(.4,.25,.4,new THREE.MeshBasicMaterial({color:0xff2222}),0,2.95,-1.6);van.add(beacon);
  van.position.set(-10,0,58);scene.add(van);
  game.acVan={mesh:van,t:0,beacon};
  // extra dogs pour out
  for(let i=0;i<3;i++){const d=addDog(-10+rand(-2,2),50+rand(-2,2),false,dogMat3);d.state='roam';}
  msg('three golden retrievers spill out of the sedan, absolutely delighted to be here.','#ffd34d');
  // every hidden cat gets flushed in waves
  for(const c of cats)if(!c.dead&&(c.state==='hide'||c.state==='bush'))flushCat(c);
  for(const c of cats)if(!c.dead&&c.state==='tree')catLeaveTree(c);
  bark();setTimeout(bark,200);setTimeout(bark,500);
}

/* ---------------- cats update ---------------- */
function nearestHide(from,exclude){
  const list=[];
  for(const h of hideSpots){
    if(h===exclude)continue;
    list.push({h,d:from.distanceTo(h.pos)});}
  if(!list.length)return null;
  list.sort((a,b)=>a.d-b.d);
  let cand=list.slice(0,3).map(o=>o.h);
  // prefer spots without a dog within ~4m
  const dogFree=cand.filter(h=>{
    for(const d of dogs){if(d.mesh.position.distanceTo(h.pos)<4)return false;}
    return true;});
  if(dogFree.length)cand=dogFree;
  return pick(cand);}
function flushCat(c){
  if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  c.lastSpot=c.spot||c.lastSpot;
  if(c.spot){const i=c.spot.cats.indexOf(c);if(i>=0)c.spot.cats.splice(i,1);c.spot=null;}
  c.peeking=false;
  c.state='flushed';c.t=rand(5,9);c.mesh.visible=true;c.mesh.rotation.z=0;
  c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.02;
  c.target=V3(c.mesh.position.x+rand(-8,8),0,c.mesh.position.z+rand(-8,8));meow();}
function catLeaveTree(c){
  // leap down then flee
  c.state='fall';c.mesh.visible=true;
  c.vel.set(rand(-2,2),1,rand(-2,2));
  if(c.home&&c.home.cats){const i=c.home.cats.indexOf(c);if(i>=0)c.home.cats.splice(i,1);}
  meow();}
function moveToward(mesh,tgt,speed,dt){
  const to=tgt.clone().sub(mesh.position);to.y=0;const d=to.length();
  if(d>0.05){to.normalize();
    // ride the terrain: carry Y by the ground delta so walkers keep their offset (feet, sitting sink) over hills
    const h0=terrainH(mesh.position.x,mesh.position.z);
    mesh.position.addScaledVector(to,Math.min(speed*dt,d));
    mesh.position.y+=terrainH(mesh.position.x,mesh.position.z)-h0;
    mesh.rotation.y=Math.atan2(to.x,to.z)+Math.PI/2*0;
    mesh.rotation.y=Math.atan2(to.x,to.z)-Math.PI/2;}
  return d;}
// cat movement with heading smoothing: direction changes are RATE-LIMITED so cats arc instead of
// snap-turning — makes them aimable/catchable (designer: "they change direction too fast")
function catMove(c,tgt,speed,dt,turn=3.2){
  const to=tgt.clone().sub(c.mesh.position);to.y=0;const d=to.length();
  if(d<=0.05)return d;
  to.normalize();
  if(!c._dir)c._dir=to.clone();
  else{
    const k=Math.min(1,turn*dt);
    c._dir.lerp(to,k);
    if(c._dir.lengthSq()<0.0001)c._dir.copy(to);else c._dir.normalize();}
  c.mesh.position.addScaledVector(c._dir,Math.min(speed*dt,d));
  c.mesh.rotation.y=Math.atan2(c._dir.x,c._dir.z)-Math.PI/2;
  return d;}
function updateCats(dt){
  if(game.curTree>=2&&!game.goldenSpawned&&!game.over)spawnGoldenCat();
  const speedMul=game.frenzy>0?1.7:1;
  for(const c of cats){
    if(c.dead)continue;
    const gmul=c.golden?1.45:1;
    // stamina: flee/flushed sprint tops out ~5s, then winded (slow trot) before recovering
    if(c.state==='flee'||c.state==='flushed'){
      if(c.winded>0){c.winded-=dt;if(c.winded<=0)c.sprintT=0;}
      else{c.sprintT=(c.sprintT||0)+dt;
        if(c.sprintT>5)c.winded=game.frenzy>0?0.75:1.5;}
    }else{c.sprintT=0;if(c.winded>0)c.winded=Math.max(0,c.winded-dt);}
    const stam=(c.winded>0)?0.6:1;
    c.meowT-=dt;if(c.meowT<0&&c.mesh.visible&&c.state!=='carried'){c.meowT=rand(14,30);if(Math.random()<.22)meow();} // ambient meows much rarer
    if(c._lungeT>0){
      // attack lunge: leap at the camera, swipe, land past the player
      c._lungeT-=dt;
      const lk=Math.min(1,(1-c._lungeT/0.5)*1.35);
      c.mesh.position.lerpVectors(c._lungeFrom,c._lungeTo,lk);
      c.mesh.position.y+=Math.sin(lk*Math.PI)*0.9;
      c.mesh.rotation.z=Math.sin(lk*Math.PI*2)*0.6;
      if(c._lungeT<=0){
        c.state='flushed';c.t=5;c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.05;c.mesh.rotation.z=0;
        c.target=V3(player.pos.x+rand(-8,8),0,player.pos.z+rand(-8,8));}
      continue;}
    switch(c.state){
      case 'walk':{
        c.t-=dt;
        if(!c.target||c.t<=0){c.target=V3(rand(-30,30),0,rand(-25,30));c.t=rand(4,9);}
        catMove(c,c.target,1.1*speedMul*gmul,dt,2.2);
        c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+Math.abs(Math.sin(game.time*8))*0.05;
        // dogs nearby scare it
        for(const d of dogs)if(d.state!=='penned'&&d.mesh.position.distanceTo(c.mesh.position)<3){c.state='flushed';c.t=6;break;}
        break;}
      case 'bush':{
        c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.02+Math.sin(game.time*2+c.t)*0.02;
        break;}
      case 'tree':{
        c.mesh.position.y=c.home.pos.y+c.limb.h+0.55+Math.sin(game.time*1.5+c.t)*0.05;
        break;}
      case 'fall':{
        c.vel.y-=20*dt;c.mesh.position.addScaledVector(c.vel,dt);
        const ty=terrainH(c.mesh.position.x,c.mesh.position.z);
        if(c.mesh.position.y<=ty+0.05){c.mesh.position.y=ty+0.05;
          if(c._stunOnLand){ // shot out of the tree — lands seeing stars
            c.state='stun';c.stun=c._stunOnLand;c._stunOnLand=0;c.mesh.rotation.z=Math.PI/2;
            poof(c.mesh.position,M.chipWood,4);thudSound();}
          else{c.state='flee';c.spotTgt=nearestHide(c.mesh.position,c.lastSpot);}}
        break;}
      case 'flee':{
        if(!c.spotTgt)c.spotTgt=nearestHide(c.mesh.position,c.lastSpot);
        const d=catMove(c,c.spotTgt.pos,4.4*speedMul*gmul*stam,dt,3.6);
        c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+((c.winded>0)?Math.abs(Math.sin(game.time*20))*0.05:Math.abs(Math.sin(game.time*14))*0.1);
        if(d<c.spotTgt.r*0.6){
          c.state='hide';c.spot=c.spotTgt;c.spotTgt.cats.push(c);
          c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.02;c.mesh.visible=game.frenzy>0; // peek only? hidden
          c.peeking=false;c.peekCD=rand(4,9);
          msg('a cat scrambled under '+c.spot.name,'#9fb0c8');}
        break;}
      case 'hide':{
        // stays until dogs flush or frenzy — but occasionally PEEKS out (grabbable!)
        if(c.peeking){
          c.peekT-=dt;
          if(c.spot){
            const dir=player.pos.clone().sub(c.spot.pos);dir.y=0;
            if(dir.lengthSq()>0.0001)dir.normalize();else dir.set(0,0,1);
            c.mesh.position.copy(c.spot.pos).addScaledVector(dir,c.spot.r*0.85);
            c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.05;
            c.mesh.visible=true;}
          if(c.peekT<=0){
            c.peeking=false;c.mesh.visible=false;
            if(c.spot){c.mesh.position.copy(c.spot.pos);}
            c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.02;c.peekCD=rand(4,9);}
        }else{
          c.peekCD-=dt;
          if(c.peekCD<=0&&c.spot){
            c.peeking=true;c.peekT=1.5;c.mesh.visible=true;
            const dir=player.pos.clone().sub(c.spot.pos);dir.y=0;
            if(dir.lengthSq()>0.0001)dir.normalize();else dir.set(0,0,1);
            c.mesh.position.copy(c.spot.pos).addScaledVector(dir,c.spot.r*0.85);
            c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.05;}}
        break;}
      case 'flushed':{
        c.t-=dt;
        // retarget less often, and biased FORWARD (±70° of current heading) — arcs, not zigzags
        if(!c.target||Math.random()<0.008){
          let a;
          if(c._dir&&c._dir.lengthSq()>0.01)a=Math.atan2(c._dir.z,c._dir.x)+rand(-1.2,1.2);
          else a=rand(0,Math.PI*2);
          const r=rand(6,12);
          c.target=V3(c.mesh.position.x+Math.cos(a)*r,0,c.mesh.position.z+Math.sin(a)*r);}
        catMove(c,c.target,3.6*speedMul*gmul*stam,dt,3.0);
        c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+((c.winded>0)?Math.abs(Math.sin(game.time*20))*0.05:Math.abs(Math.sin(game.time*12))*0.12);
        if(c.t<=0&&game.frenzy<=0){c.state='flee';c.spotTgt=nearestHide(c.mesh.position,c.lastSpot);}
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
        const _toI=chipper.intake.clone().sub(c.mesh.position);const _dI=_toI.length();
        if(_dI<4&&_dI>0.001&&chipper.catReady()){
          _toI.normalize();
          const _spd=Math.max(6,Math.hypot(c.vel.x,c.vel.z));
          c.vel.x=lerp(c.vel.x,_toI.x*_spd,dt*2.5);
          c.vel.z=lerp(c.vel.z,_toI.z*_spd,dt*2.5);
        }
        if(c.mesh.position.distanceTo(chipper.intake)<1.8){
          if(chipper.catReady()){chipCat(c,'thrown');continue;}
          else if(!(c._bonkCD>game.time)){ // bonk ONCE — deflect hard AWAY so it can't hover-loop at the mouth
            c._bonkCD=game.time+0.8;
            const away=c.mesh.position.clone().sub(chipper.intake);away.y=0;
            if(away.lengthSq()<0.01)away.set(0,0,-1);away.normalize();
            c.vel.set(away.x*7,4,away.z*7);
            c.mesh.rotation.x=0; // stop the tumble; it's a deflection, not a launch
            thudSound();poof(c.mesh.position,M.chipWood,10);
            if(!game._bonkMsgT||game.time>game._bonkMsgT){
              game._bonkMsgT=game.time+5;
              msg('the chipper is CHEWING — wait for the mouth','#f88');}}}
        // defensive ammunition: hostile dog midair intercept
        for(const d of dogs){
          if(d.dead||d.state!=='hostile')continue;
          if(c.mesh.position.distanceTo(d.mesh.position)<1.3){
            d.wasHostile=true;d.hostileT=0;d.state='punted';
            d.vel.copy(c.vel).multiplyScalar(0.5);d.vel.y=Math.max(4,Math.abs(c.vel.y));
            yelp();thudSound();
            c.vel.multiplyScalar(-0.25);c.vel.y=3;c._dogBonk=true;
            msg('cat-based air defense. the dog regrets everything.','#ffd34d');
            break;}}
        // chasing worker face-hit
        if(snappedWorker&&snappedWorker.tickleState==='chase'&&c.mesh.position.distanceTo(snappedWorker.mesh.position)<1.3){
          const w=snappedWorker;
          thudSound();fxShake=Math.max(fxShake,0.8);
          w.tickleState='parried';w.parryT=2;w.mesh.rotation.z=Math.PI/2;w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z)+0.2;
          c.state='cling';c.clingT=1;c.clingTo=w;c.mesh.rotation.x=0;
          if(w.snapReason==='accusation'){
            w._endChaseAfterParry=true;
            msg(w.name+' cannot sue a cat. he returns to work, shaken.','#5dff7a');}
          else msg('direct hit. '+w.name+' goes down with a cat on his face.','#ffd34d');
          break;}
        const ty=terrainH(c.mesh.position.x,c.mesh.position.z);
        if(c.mesh.position.y<=ty+0.15){c._kicked=false;
          c.mesh.position.y=ty+0.15;c.mesh.rotation.x=0;
          if(c.vel.length()>6){c.vel.multiplyScalar(0.4);c.vel.y=Math.abs(c.vel.y)*0.4;}
          else{c.state='stun';c.stun=c._dogBonk?4:1.5;c._dogBonk=false;c.mesh.rotation.z=Math.PI/2;}}
        break;}
      case 'ladythrow':{
        c.throwT+=dt/1.7;
        const t=Math.min(1,c.throwT);
        const to=camera.position.clone();to.y-=0.3;
        c.mesh.position.lerpVectors(c.throwFrom,to,t);
        c.mesh.position.y+=Math.sin(t*Math.PI)*5;
        c.mesh.rotation.x+=dt*12;
        if(t>=1){ // whiffed past your head
          if(c.thrower==='sarah'){if(typeof braxton!=='undefined'&&braxton)braxton.throwCat=null;}else lady.throwCat=null;
          c.state='flushed';c.t=7;c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.1;c.mesh.rotation.x=0;
          msg('the cat rakes your face on the way past. RUDE.','#ff5b4d');
          catScratch(1);}
        break;}
      case 'cling':{
        c.clingT-=dt;
        if(c.clingTo){c.mesh.position.copy(c.clingTo.mesh.position);c.mesh.position.y=c.clingTo.mesh.position.y+2.1;}
        if(c.clingT<=0){c.clingTo=null;c.state='flushed';c.t=6;c.mesh.position.y=terrainH(c.mesh.position.x,c.mesh.position.z)+0.1;}
        break;}
      case 'carried':break;
    }
    // keep in bounds
    if(c.state!=='tree'&&c.state!=='carried'&&c.state!=='ladythrow'&&c.state!=='stored'&&c.state!=='cling'){
      c.mesh.position.x=clamp(c.mesh.position.x,-70,70);
      c.mesh.position.z=clamp(c.mesh.position.z,-58,62);}
    // approx per-cat velocity for LMB grab prediction (persistent vectors, no per-frame allocation)
    if(!c.prevPos)c.prevPos=c.mesh.position.clone();
    if(!c.vApprox)c.vApprox=V3();
    c.vApprox.copy(c.mesh.position).sub(c.prevPos);
    if(dt>0)c.vApprox.multiplyScalar(1/dt);
    c.prevPos.copy(c.mesh.position);
  }
}

/* ---------------- dogs update ---------------- */
function updateDogs(dt){
  for(const d of dogs){
    if(d.dead)continue;
    d.t-=dt;
    if(d.state==='punted'){
      d.vel.y-=22*dt;
      d.mesh.position.addScaledVector(d.vel,dt);
      d.mesh.rotation.x+=dt*11; // tumbling
      if(chipper.engineOn&&chipper.catReady()&&d.mesh.position.distanceTo(chipper.intake)<1.5){chipDog(d);continue;}
      const ty=terrainH(d.mesh.position.x,d.mesh.position.z);
      if(d.mesh.position.y<=ty){
        d.mesh.position.y=ty;d.mesh.rotation.x=0;
        d.state='dogstun';d.stunT=2;d.mesh.rotation.z=Math.PI/2;}
      continue;}
    if(d.state==='dogstun'){
      d.stunT-=dt;
      if(d.stunT<=0){
        d.mesh.rotation.z=0;
        if(d.wasHostile){d.wary=60;msg('that dog keeps its distance now.','#9fb0c8');}
        d.wasHostile=false;d.state='roam';d.t=0;}
      continue;}
    if(d.state==='called'){ // Q-whistle: sprint to the player's call point, then scatter every cat nearby
      d.callT-=dt;
      const dd=moveToward(d.mesh,d.callPos,6.5,dt);
      d.mesh.position.y=terrainH(d.mesh.position.x,d.mesh.position.z)+Math.abs(Math.sin(game.time*12+d.t*7))*0.12;
      if(dd<2||d.callT<=0){
        d.state='roam';d.t=0.5;bark();
        let scared=0;
        for(const c of cats){
          if(c.dead||c.state==='carried'||c.state==='stored'||c.state==='chip'||c.state==='thrown'||c.state==='tree'||c.state==='ladythrow')continue;
          const cpos=(c.state==='hide'&&c.spot)?c.spot.pos:c.mesh.position;
          if(cpos.distanceTo(d.callPos)<9){
            if(c.state==='hide'||c.state==='bush')flushCat(c);
            else if(c.state==='walk'){c.state='flushed';c.t=6;}
            scared++;}}
        if(scared)msg('the dog scatters '+scared+' cat'+(scared>1?'s':'')+'!','#ffd34d');}
      continue;}
    if(d.wary>0){ // punted-hostile payoff: won't come within 4m of you
      d.wary-=dt;
      const wx=d.mesh.position.x-player.pos.x,wz=d.mesh.position.z-player.pos.z;
      const wd=Math.hypot(wx,wz);
      if(wd<4&&wd>0.001){d.mesh.position.x+=wx/wd*(4-wd)*Math.min(1,dt*6);d.mesh.position.z+=wz/wd*(4-wd)*Math.min(1,dt*6);}}
    if(d.state==='hostile'){
      d.hostileT-=dt;
      moveToward(d.mesh,player.pos,5.6,dt);
      d.mesh.position.y=terrainH(d.mesh.position.x,d.mesh.position.z)+Math.abs(Math.sin(game.time*12))*0.12;
      d.touchCD=Math.max(0,(d.touchCD||0)-dt);
      const dxz=Math.hypot(d.mesh.position.x-player.pos.x,d.mesh.position.z-player.pos.z);
      if(dxz<1.4&&!game.over&&d.touchCD<=0){
        game.hurtT=Math.max(game.hurtT,0.8);scratchSound();blip(500,.12,'sawtooth',.18,-260);
        const kx=player.pos.x-d.mesh.position.x,kz=player.pos.z-d.mesh.position.z,kl=Math.hypot(kx,kz)||1;
        player.pos.x+=kx/kl*1.2;player.pos.z+=kz/kl*1.2;
        d.touchCD=1.0;}
      if(d.hostileT<=0){d.state='roam';d.t=0;}
      continue;}
    if(d.state==='penned'){
      if(d.t<=0){d.t=rand(1,4);d.target=V3(dogRun.x+rand(-3,3),0,dogRun.z+rand(-2,2));}
      if(d.target)moveToward(d.mesh,d.target,1.4,dt);
      continue;}
    // roaming: seek structures with hidden cats, else chase visible cats
    if(d.boreT===undefined)d.boreT=0;
    d.boreT+=dt;
    if(!d.target||d.t<=0){
      d.t=rand(2,4);
      const withCats=hideSpots.filter(h=>h.cats.length>0);
      if(withCats.length){d.targetSpot=pick(withCats);d.boreT=0;}
      else d.targetSpot=null;
      if(!d.targetSpot){
        const open=cats.filter(c=>!c.dead&&(c.state==='walk'||c.state==='flushed'));
        d.chaseCat=open.length?pick(open):null;
        if(d.chaseCat)d.boreT=0;}}
    if(d.boreT>20){
      d.targetSpot=null;d.chaseCat=null;
      d.target=V3(rand(-35,35),0,rand(-30,35));d.t=rand(2,5);d.boreT=0;}
    if(d.targetSpot){
      const dd=moveToward(d.mesh,d.targetSpot.pos,5,dt);
      if(dd<d.targetSpot.r*0.8){
        bark();
        const flushing=[...d.targetSpot.cats];
        for(const c of flushing)flushCat(c);
        if(flushing.length)msg('the dogs flushed '+flushing.length+' cat'+(flushing.length>1?'s':'')+' out from '+d.targetSpot.name+'!','#ffd34d');
        d.boreT=0;
        d.targetSpot=null;d.t=0.5;}
    }else if(d.chaseCat&&!d.chaseCat.dead&&d.chaseCat.mesh.visible){
      moveToward(d.mesh,d.chaseCat.mesh.position,5.2,dt);
      if(d.mesh.position.distanceTo(d.chaseCat.mesh.position)<2&&d.chaseCat.state==='walk'){
        d.chaseCat.state='flushed';d.chaseCat.t=6;}
      if(Math.random()<0.008)bark();
    }else{
      if(d.t<=0||!d.target){d.target=V3(rand(-35,35),0,rand(-30,35));d.t=rand(2,5);}
      moveToward(d.mesh,d.target,3,dt);}
    d.mesh.position.y=terrainH(d.mesh.position.x,d.mesh.position.z)+Math.abs(Math.sin(game.time*10+d.t*7))*0.1;
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
    if(bc){bc.state='flee';bc.mesh.position.copy(bc.home.pos);bc.spotTgt=nearestHide(bc.mesh.position,bc.lastSpot);
      if(bc.home.cats){const i=bc.home.cats.indexOf(bc);if(i>=0)bc.home.cats.splice(i,1);}
      meow();msg('the chainsaw spooked a cat out of a bush!','#9fb0c8');}}
  // PERIL: widow-maker — a dead branch lodges then drops later
  if(Math.random()<0.20){
    const wm=box(0.18,0.18,rand(1.2,2),M.bark,tr.pos.x+rand(-1.2,1.2),tr.H*0.72,tr.pos.z+rand(-1.2,1.2));
    wm.rotation.set(rand(0,3),rand(0,3),rand(0,3));scene.add(wm);
    widowMakers.push({mesh:wm,tree:tr,t:rand(3,8),vy:0,fell:false});
    crackSound();fxShake=Math.max(fxShake,0.4);
    msg('something cracked up there...','#ffd34d');}
}
const fallingLimbs=[];
function updateFallingLimbs(dt){
  updateWidowMakers(dt);
  updatePropsSim(dt);
  for(let i=fallingLimbs.length-1;i>=0;i--){
    const f=fallingLimbs[i];
    if(f.landed)continue;
    f.vy-=16*dt;f.mesh.position.y+=f.vy*dt;
    f.mesh.rotation.z+=f.rot*dt;
    const ty=terrainH(f.mesh.position.x,f.mesh.position.z);
    if(f.mesh.position.y<=ty+0.5){
      f.mesh.position.y=ty+0.5;f.landed=true;
      fallenBranches.push({mesh:f.mesh,claimed:false});
      fallingLimbs.splice(i,1);}}}
/* ---------------- tickle mechanic ---------------- */
const tickleWorkers=[arborist,...groundies];
let snappedWorker=null;
const swearBubbles=[];
const GRAWLIX=['#$%@!!','@#*&!','$%#@!','#@$%&!','!?#$@','%$#@!!','H-E-DOUBLE-HOCKEY-STICKS!!','GOSH DARN IT TO HECK!','SON of a BISCUIT!','FUDGE. NUGGETS.'];
for(const w of tickleWorkers){
  w.ticklish=rand(0.4,1.0);
  w.anger=0;w.angerStage=0;w.tickleState='none';w.warned=false;
  w.escapeT=12;w.fitT=0;w.fitBase=w.mesh.position.clone();
  w.mesh.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='SphereGeometry'&&o.material!==M.helmet&&!w.headMat){w.headMat=o.material.clone();o.material=w.headMat;}});
}
const CREW_NAMES=['Johnathan','Tanner','Jamal','Braxton','Stephen','Javier','Juan','Jin','Carter'];
(function(){const pool=[...CREW_NAMES];for(const w of tickleWorkers){const i=Math.floor(Math.random()*pool.length);w.name=pool.splice(i,1)[0];}})();
const LADY_CATS=['Bartholomew','Winston','Prudence','Chauncey','Mittens III'];
const LADY_LINES=['I PLAY TENNIS WITH THE MAYOR\'S WIFE, you know.','this is a GATED community. or it WAS.','my late husband endowed the GAZEBO.','I summer somewhere you will never afford.'];
function jabber(){
  blip(300,.08,'square',.2,-120);
  setTimeout(()=>blip(235,.09,'square',.2,-100),90);
  setTimeout(()=>blip(175,.11,'square',.2,-80),190);}
function applyAngerTint(w){if(w.headMat)w.headMat.color.setHex(0xd94b3a);}
function spawnSwearBubble(w){
  const cv=document.createElement('canvas');cv.width=256;cv.height=128;
  const ctx=cv.getContext('2d');
  ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=9;ctx.strokeStyle='#000';ctx.fillStyle='#ffdb2e';
  const txt=pick(GRAWLIX);
  let _fs=66;ctx.font='bold '+_fs+'px sans-serif';
  while(ctx.measureText(txt).width>236&&_fs>16){_fs-=4;ctx.font='bold '+_fs+'px sans-serif';}
  ctx.strokeText(txt,128,64);ctx.fillText(txt,128,64);
  const tex=new THREE.CanvasTexture(cv);
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}));
  spr.scale.set(2.4,1.2,1);
  spr.position.copy(w.mesh.position);spr.position.y=2.6;
  scene.add(spr);
  swearBubbles.push({spr,t:0,life:1.6});
  msg(txt,'#ffdb2e');}
function tickleWorker(w){
  if(w.tickleState!=='none')return;
  if(w.confronting){w.confronting=false;if(accuser===w)accuser=null;w.snapReason='accusation';spawnSwearBubble(w);jabber();snapWorker(w);return;}
  if(w.carry){w.carry.claimed=false;w.carry.mesh.position.y=terrainH(w.carry.mesh.position.x,w.carry.mesh.position.z)+0.5;w.carry=null;w.state='idle';}
  spawnSwearBubble(w);jabber();
  const wasWarned=w.angerStage>=1;
  w.anger+=(1.15-w.ticklish);
  if(w.anger>=1&&w.angerStage<1){
    w.angerStage=1;w.warned=true;applyAngerTint(w);
    msg(w.name+' does NOT look amused. maybe put him down.','#ff5b4d');
    banner('⚠ '+w.name.toUpperCase()+' IS GETTING MAD');}
  if(wasWarned&&!snappedWorker){snapWorker(w);return;}
  w.tickleState='fit';
  w.fitT=lerp(2,5,clamp((w.ticklish-0.4)/0.6,0,1));
  w.fitBase=w.mesh.position.clone();}
function snapWorker(w){
  if(w.carry){w.carry.claimed=false;w.carry.mesh.position.y=terrainH(w.carry.mesh.position.x,w.carry.mesh.position.z)+0.5;w.carry=null;w.state='idle';}
  w.tickleState='chase';snappedWorker=w;w.escapeT=12;applyAngerTint(w);
  banner('HE SNAPPED — RUN',3000);
  msg('you pushed him too far. he is coming for YOU.','#ff5b4d');}
function updateChaseWorker(w,dt){
  moveToward(w.mesh,player.pos,6.8,dt);
  w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z)+Math.abs(Math.sin(game.time*12))*0.12;
  const dx=w.mesh.position.x-player.pos.x,dz=w.mesh.position.z-player.pos.z;
  const dh=Math.hypot(dx,dz);
  if(dh<1.3){
    if(w.snapReason==='accusation'){if(w.accuseVariant==='b'){game.failTitle='VIOLATED';game.failed='He had one week left on paper. ONE WEEK.';}else{game.failTitle='SERVED';game.failed='You\'ll be hearing from his cousin. He passed the bar in \'09.';}}
    else game.failed='You tickled the wrong guy one too many times.';
    if(!game.over)endGame(false);
    return;}
  if(dh>6)w.escapeT-=dt;else w.escapeT=12;
  if(w.escapeT<=0){
    w.tickleState='none';snappedWorker=null;w.parried=0;w.snapReason=null;
    w.mesh.rotation.z=0;w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z);
    msg('he loses you in the yard and stomps back to work, muttering.','#9fb0c8');}}
function updateTickleWorkers(dt){
  for(const w of tickleWorkers){
    if(w.tickleState==='fit'){
      w.fitT-=dt;
      const j=0.07;
      w.mesh.position.x=w.fitBase.x+rand(-j,j);
      w.mesh.position.z=w.fitBase.z+rand(-j,j);
      w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z)+Math.abs(Math.sin(game.time*32))*0.16;
      w.mesh.rotation.z=Math.sin(game.time*42)*0.28;
      if(w.fitT<=0){
        w.tickleState='none';
        w.mesh.position.copy(w.fitBase);w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z);w.mesh.rotation.z=0;}
    }else if(w.tickleState==='chase'){
      updateChaseWorker(w,dt);
    }else if(w.tickleState==='parried'){
      w.parryT-=dt;
      if(w.parryT<=0){
        w.mesh.rotation.z=0;w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z);
        if(w._endChaseAfterParry||w.parried>=2){ // he's done — limps back to work
          w._endChaseAfterParry=false;w.parried=0;w.tickleState='none';w.snapReason=null;
          if(snappedWorker===w)snappedWorker=null;
        }else{ // up again, angrier
          w.tickleState='chase';w.escapeT=12;}}
    }else if(w.angerStage>=1){
      w.mesh.rotation.z=Math.sin(game.time*24)*0.05;}
  }
  for(let i=swearBubbles.length-1;i>=0;i--){
    const b=swearBubbles[i];b.t+=dt;
    b.spr.position.y+=dt*0.8;
    b.spr.material.opacity=Math.max(0,1-b.t/b.life);
    if(b.t>=b.life){scene.remove(b.spr);
      if(b.spr.material.map)b.spr.material.map.dispose();
      b.spr.material.dispose();swearBubbles.splice(i,1);}}
}
/* ---------------- peril systems ---------------- */
const widowMakers=[]; // {mesh,tree,t,vy,fell}
function segDistXZ(px,pz,ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;
  let t=l2>0?((px-ax)*dx+(pz-az)*dz)/l2:0;t=clamp(t,0,1);
  const cx=ax+t*dx,cz=az+t*dz;
  return Math.hypot(px-cx,pz-cz);}
function updateWidowMakers(dt){
  for(let i=widowMakers.length-1;i>=0;i--){
    const w=widowMakers[i];
    if(!w.fell){w.t-=dt;if(w.t<=0)w.fell=true;continue;}
    w.vy-=18*dt;w.mesh.position.y+=w.vy*dt;
    w.mesh.rotation.x+=dt*4;w.mesh.rotation.z+=dt*3;
    const wy=terrainH(w.mesh.position.x,w.mesh.position.z)+0.3;
    if(w.mesh.position.y<=wy){
      w.mesh.position.y=wy;
      const dxz=Math.hypot(player.pos.x-w.tree.pos.x,player.pos.z-w.tree.pos.z);
      if(!game.over&&dxz<2.5){
        catScratch(1);fxShake=Math.max(fxShake,1.5);
        if(Math.random()<0.15){
          game.failTitle='WIDOW-MAKER';game.failed='Never stand under the tree being pruned.';
          endGame(false);}
        else msg('a dead branch nearly brained you. that HURT.','#ff5b4d');}
      else poof(w.mesh.position,M.bark,6);
      scene.remove(w.mesh);widowMakers.splice(i,1);}}
}
// ---- false accusation event ----
let accusationDone=false,accuser=null;
function maybeStartAccusation(dt){
  if(accusationDone||accuser||snappedWorker)return;
  if(!game.workStarted||game.over||game.teaBreak>0||game.frenzy>0)return;
  if(game.curTree<1||game.curTree>=trees.length-1)return;
  if(Math.random()<dt*0.02){
    const g=groundies.find(gm=>gm.tickleState==='none'&&!gm.confronting);
    if(!g)return;
    accusationDone=true;accuser=g;g.confronting=true;g.confrontPhase='approach';g.confrontT=0;g.fleeT=0;
    g.accuseVariant=Math.random()<0.5?'a':'b';
    if(g.carry){g.carry.claimed=false;g.carry.mesh.position.y=terrainH(g.carry.mesh.position.x,g.carry.mesh.position.z)+0.5;g.carry=null;}g.state='idle';
    spawnSwearBubble(g);
    banner('SOMEBODY SNITCHED',2600);
    if(g.accuseVariant==='b')msg(g.name+' drops his rake and stomps over — he is CONVINCED you called his PO about the thing at the lake. you didn\'t. probably.','#ffd34d');
    else msg(g.name+' drops his rake and stomps over — somebody told the HOA about his unpermitted dock, and he thinks it was YOU.','#ffd34d');}
}
function endAccusation(weathered){
  const g=accuser;accuser=null;if(!g)return;
  g.confronting=false;g.confrontPhase=null;g.state='idle';
  g.mesh.rotation.z=0;g.mesh.position.y=terrainH(g.mesh.position.x,g.mesh.position.z);
  if(weathered){
    game.score+=50;banner('REPUTATION INTACT +$50');
    if(g.accuseVariant==='a')msg('you hold your ground. he admits it was probably his cousin. reputation intact at the club. +$50','#5dff7a');
    else msg('you hold your ground. he admits it was probably his cousin. +$50','#5dff7a');
    updateHUD();}
  else msg('he loses you in the yard and stomps back to work, still fuming.','#9fb0c8');
}
function updateAccusation(dt){
  if(!accuser)return;
  const g=accuser;
  const dxz=Math.hypot(g.mesh.position.x-player.pos.x,g.mesh.position.z-player.pos.z);
  g.mesh.rotation.z=Math.sin(game.time*20)*0.12; // finger-jab jitter
  if(g.confrontPhase==='approach'){
    moveToward(g.mesh,player.pos,4.5,dt);
    if(dxz<4){g.confrontPhase='yell';g.confrontT=0;
      msg('“was it YOU?! LOOK at me and tell me it wasn\'t YOU!” — '+g.name,'#ffd34d');}
    return;}
  // yell phase
  if(Math.random()<dt*1.1)jabber();
  if(Math.random()<dt*0.6)spawnSwearBubble(g);
  if(dxz<4){
    g.confrontT+=dt;g.fleeT=0;
    if(g.confrontT>=3)endAccusation(true);
  }else if(dxz>12){
    g.fleeT+=dt;g.confrontT=Math.max(0,g.confrontT-dt*0.5);
    if(g.fleeT>=8)endAccusation(false);
  }else{
    moveToward(g.mesh,player.pos,3,dt);g.confrontT=Math.max(0,g.confrontT-dt*0.3);}
}

/* ---------------- ambient crew banter ---------------- */
const BANTER=[
  '{T}, your dad only sends you up the tree so the insurance pays out.',
  'ladies love a man with three liens and a chainsaw.',
  'I had a 401k once. spent it on this truck.',
  'you climb like my grandma. she\'s faster, actually.',
  'chicks dig the ear protection. very mysterious.',
  'my physical therapist says I shouldn\'t even BE here.',
  '{T} drinks his iced tea with his pinky out, watch him.',
  'this is why your wife calls ME to do the gutters.',
  'just because school wasn\'t for you doesn\'t mean roofing is.',
  'my PO says this counts as stable employment.',
  'two baby mamas, one truck. you do the math.',
  'alimony means she still thinks about me.',
  'I got a diploma. it\'s a tattoo, but still.',
  'court says I gotta be here. no wait, that\'s you.',
  '{T}\'s the only guy here whose record is a GPA.',
  'child support built this skyline, one gutter at a time.',
  'Braxton, your mom packed you a Lunchable again.',
  'participation trophies don\'t cut limbs, buddy.',
];
let banterBag=[];
function updateBanter(dt){
  if(!game.workStarted||game.over||game.teaBreak>0||game.frenzy>0||snappedWorker||accuser)return;
  if(game.banterT===undefined)game.banterT=rand(25,40);
  game.banterT-=dt;if(game.banterT>0)return;
  game.banterT=rand(25,40);
  const nearby=[arborist,...groundies].filter(w=>w.tickleState==='none'&&!w.confronting&&player.pos.distanceTo(w.mesh.position)<14);
  if(!nearby.length)return;
  const speaker=pick(nearby);
  if(player.carrying&&Math.random()<0.5){msg('“don\'t ask what he\'s doing. it pays the same.” — '+speaker.name,'#8fd4ff');return;}
  if(!banterBag.length){banterBag=[...BANTER];for(let i=banterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=banterBag[i];banterBag[i]=banterBag[j];banterBag[j]=t;}}
  const others=[arborist,...groundies].filter(w=>w!==speaker);
  const target=(others.length?pick(others):speaker).name;
  const line=banterBag.pop().replace(/\{T\}/g,target);
  msg('“'+line+'” — '+speaker.name,'#8fd4ff');
}
/* ---------------- THE BRAXTON'S MOM INCIDENT ---------------- */
let braxton=null;
(function(){
  const bw=[arborist,...groundies].find(w=>w.name==='Braxton');
  if(bw)braxton={worker:bw,phase:'idle',t:0,sarah:null,agents:null,throwsLeft:3,throwCD:0,throwCat:null,arrested:[],retT:0,parkSpot:null,iceTarget:null};
})();
function nearestTreeShade(pos){
  let best=null,bd=1e9;
  for(const tr of trees){if(tr.state==='done')continue;const d=pos.distanceTo(tr.pos);if(d<bd){bd=d;best=tr;}}
  const t=best||trees[0];
  return t?V3(t.pos.x+2,0,t.pos.z+2):pos.clone();}
function startSarahArrive(){
  const B=braxton;
  let s;
  if(typeof sarah!=='undefined'&&sarah){s=sarah;}
  else{s=lady.mesh.clone();s.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();if(o.material.color)o.material.color.offsetHSL(0.45,0,0.08);}});}
  s.visible=true;s.position.set(-10,0,52);scene.add(s);
  B.sarah=s;B.phase='sarahArrive';
  msg('a white SUV pulls up. it\'s... Braxton\'s mom?','#e08fb2');}
function sarahThrow(){
  const B=braxton;
  const c=addCat('ladythrow',null);totalCats++;
  c.fromSarah=true;c.thrower='sarah';c.catName=pick(LADY_CATS);
  c.mesh.position.copy(B.sarah.position).add(V3(0,1.8,0));
  c.throwFrom=c.mesh.position.clone();c.throwT=0;
  B.throwCat=c;
  alertSound();
  banner('INCOMING — '+c.catName.toUpperCase()+'! (CLICK to catch)');
  msg('Sarah hurls '+c.catName+' at you with SHOCKING velocity.','#e08fb2');}
function startICE(){
  const B=braxton;B.agents=[];
  for(let i=0;i<2;i++){
    let ag;
    if(typeof makeAgent==='function')ag=makeAgent();
    else ag=makePerson(new THREE.MeshStandardMaterial({color:0x22262b,roughness:.7}),false);
    ag.position.set(-10+i*1.6,0,54);scene.add(ag);B.agents.push(ag);}
  B.iceTarget=V3(4,0,29);B.phase='ice';B.t=9;}
function cleanupBraxtonProps(){
  const B=braxton;
  if(B.agents){for(const ag of B.agents)scene.remove(ag);B.agents=null;}
  if(B.sarah){scene.remove(B.sarah);B.sarah=null;}}
function resolveICE(){
  const B=braxton;
  const toArrest=[arborist,...groundies].filter(w=>w.name==='Tanner'||w.name==='Carter');
  if(toArrest.length){
    B.arrested=toArrest;
    for(const w of toArrest){
      w.arrested=true;w._gone=false;
      if(w===arborist){arborist.state='walk';arborist.climbH=0;arborist.mesh.position.y=terrainH(arborist.mesh.position.x,arborist.mesh.position.z);}
      msg(w.name+' has been detained. illegal Canadian national. papers were "in his other boot."','#ff5b4d');}
    banner('PAPERS PLEASE — the chipper is unattended',3000);
    B.phase='papers';B.retT=45;
  }else{
    msg('everyone\'s papers check out. the agents leave, visibly disappointed. Sarah is FURIOUS.','#ffd34d');
    B.phase='leaveAgents';B.t=6;}}
function endBraxtonPeaceful(){
  const B=braxton;
  B.worker.parked=false;B.worker.mesh.position.y=terrainH(B.worker.mesh.position.x,B.worker.mesh.position.z);B.worker.state='idle';
  cleanupBraxtonProps();
  msg('Sarah leaves. Braxton finishes his drink. nobody learned anything.','#9fb0c8');
  B.phase='done';}
function tellBraxton(){ if(braxton&&braxton.phase==='parked')braxton.phase='toldReturn'; }
function updateBraxtonEvent(dt){
  if(!braxton)return;
  const B=braxton,bw=B.worker;
  if(B.phase==='idle'){
    if(!game.workStarted||game.over||game.teaBreak>0||game.frenzy>0)return;
    if(game.curTree<2||game.curTree>=trees.length)return;
    if(snappedWorker||accuser)return;
    if(bw.tickleState!=='none'||bw.confronting||bw.arrested)return;
    if(Math.random()<dt*0.02)startSarahArrive();
    return;}
  if(B.phase==='sarahArrive'){
    const d=moveToward(B.sarah,bw.mesh.position,3,dt);
    B.sarah.position.y=terrainH(B.sarah.position.x,B.sarah.position.z);
    if(d<2.6){B.phase='parked';B.t=40;B.parkSpot=nearestTreeShade(bw.mesh.position);bw.parked=true;
      msg('“sit down in the shade, baby boy. you\'ll overheat.” — Sarah','#e08fb2');}
    return;}
  if(B.phase==='parked'){
    if(B.parkSpot)moveToward(bw.mesh,B.parkSpot,2,dt);
    bw.mesh.position.y=lerp(bw.mesh.position.y,terrainH(bw.mesh.position.x,bw.mesh.position.z)-0.3,dt*3);
    B.t-=dt;
    if(B.t<=0)endBraxtonPeaceful();
    return;}
  if(B.phase==='toldReturn'){
    bw.parked=false;bw.mesh.position.y=terrainH(bw.mesh.position.x,bw.mesh.position.z);bw.state='idle';
    B.phase='sarahThrow';B.throwCD=1.5;B.throwsLeft=3;B.throwCat=null;
    msg('Sarah has HEARD how you spoke to her baby boy.','#e08fb2');
    return;}
  if(B.phase==='sarahThrow'){
    if(B.sarah)B.sarah.lookAt(player.pos.x,0,player.pos.z);
    if(B.throwCat){if(B.throwCat.state!=='ladythrow')B.throwCat=null;return;}
    B.throwCD-=dt;
    if(B.throwCD<=0){
      if(B.throwsLeft>0){sarahThrow();B.throwsLeft--;B.throwCD=5.5;}
      else{B.phase='police';B.t=0.6;}}
    return;}
  if(B.phase==='police'){
    B.t-=dt;
    if(B.t<=0){msg('Sarah is calling the police.','#e08fb2');B.phase='policeWait';B.t=10;}
    return;}
  if(B.phase==='policeWait'){
    B.t-=dt;
    if(B.t<=0){msg('the police called ICE. obviously.','#ff5b4d');startICE();}
    return;}
  if(B.phase==='ice'){
    let allThere=true;
    for(const ag of B.agents){const d=moveToward(ag,B.iceTarget,3.2,dt);ag.position.y=terrainH(ag.position.x,ag.position.z)+Math.abs(Math.sin(game.time*10))*0.08;if(d>3)allThere=false;}
    B.t-=dt;
    if(allThere||B.t<=0)resolveICE();
    return;}
  if(B.phase==='leaveAgents'){
    B.t-=dt;
    if(B.agents)for(const ag of B.agents)moveToward(ag,V3(-10,0,58),3.5,dt);
    if(B.t<=0){cleanupBraxtonProps();B.phase='done';}
    return;}
  if(B.phase==='papers'){
    B.retT-=dt;
    for(const w of B.arrested){if(!w._gone){const d=moveToward(w.mesh,V3(-10,0,55),3.5,dt);w.mesh.position.y=terrainH(w.mesh.position.x,w.mesh.position.z);if(d<2){w._gone=true;w.mesh.visible=false;}}}
    if(B.agents)for(const ag of B.agents)moveToward(ag,V3(-10,0,58),3.5,dt);
    if(Math.random()<dt*0.4){const h=cats.filter(c=>!c.dead&&(c.state==='hide'||c.state==='bush'));if(h.length)flushCat(pick(h));}
    if(B.retT<=0){
      for(const w of B.arrested){w.arrested=false;w._gone=false;w.mesh.visible=true;w.mesh.position.set(-10,0,52);if(w===arborist)w.state='walk';else w.state='idle';
        msg(w.name+' is back. turns out Canada is fine, actually.','#9fb0c8');}
      B.arrested=[];cleanupBraxtonProps();B.phase='done';}
    return;}
}
function updateCrew(dt){
  if(!game.workStarted)game.prepT=Math.max(0,game.prepT);
  updateTickleWorkers(dt);
  maybeStartAccusation(dt);
  updateAccusation(dt);
  updateBanter(dt);
  updateBraxtonEvent(dt);
  if(game.teaBreak>0){
    // crew sits by the truck
    game.teaBreak-=dt;
    for(const gm of groundies){
      if(gm.tickleState!=='none'||gm.confronting||gm.parked||gm.arrested)continue;
      moveToward(gm.mesh,gm.seat,2.5,dt);
      gm.mesh.position.y=lerp(gm.mesh.position.y,terrainH(gm.mesh.position.x,gm.mesh.position.z)-0.45,dt*4);} // sitting = sunk a bit
    arborist.paused=true;
    if(game.teaBreak<=0){
      msg('break\'s over. the crew gets back to work.');
      for(const gm of groundies){gm.state='idle';gm.mesh.position.y=terrainH(gm.mesh.position.x,gm.mesh.position.z);}
      arborist.paused=false;}
    return;}
  arborist.paused=false;
  const tr=currentTree();
  if(!tr){if(!game.over)endGame(false);return;}
  // ARBORIST
  const A=arborist;
  if(tr.state==='standing'&&arborist.tickleState==='none'&&!arborist.parked&&!arborist.arrested){
    const base=tr.pos;
    if(A.state==='walk'){
      const d=moveToward(A.mesh,base,3.5,dt);
      if(d<1.3){A.state='climb';A.climbH=0;
        // tree-start startle: nearby ground cats scatter briefly
        let scattered=0;
        for(const cc of cats){
          if(cc.dead||cc.state!=='walk')continue;
          if(cc.mesh.position.distanceTo(tr.pos)>=12)continue;
          cc.state='flushed';cc.t=rand(1.5,3);
          const away=cc.mesh.position.clone().sub(tr.pos);away.y=0;
          if(away.lengthSq()>0.0001)away.normalize();else away.set(rand(-1,1),0,rand(-1,1)).normalize();
          cc.target=cc.mesh.position.clone().add(away.multiplyScalar(rand(6,10)));
          scattered++;}
        if(scattered){meow();msg('the crew fires up the saw — cats scatter!','#9fb0c8');}
        if(!game.workStarted){game.workStarted=true;chipper.engineOn=true;
          if(chipG)chipG.gain.value=.5;
          banner('THE WORK HAS BEGUN');
          msg('chainsaws up. every cat in Kensington Estates is now on notice.','#ffd34d');
          moodTarget=MOODS.noon;}}
    }else if(A.state==='climb'){
      const next=tr.limbs.find(l=>!l.cut);
      const targetH=next?next.h:tr.H-1;
      A.climbH=Math.min(A.climbH+dt*1.6,targetH);
      A.mesh.position.set(base.x+0.75,terrainH(base.x,base.z)+A.climbH-0.8,base.z);
      A.mesh.rotation.y+=dt;
      if(A.climbH>=targetH-0.01){A.state='cut';A.t=3.5*Math.pow(0.9,game.curTree);if(sawG&&!muted)sawG.gain.value=.14;}
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
      A.mesh.position.set(tr.pos.x+0.75,terrainH(tr.pos.x,tr.pos.z)+A.climbH-0.8,tr.pos.z);
      if(A.climbH<=0){A.mesh.position.y=terrainH(tr.pos.x,tr.pos.z);A.state='fell';A.t=2.5*Math.pow(0.9,game.curTree);if(sawG&&!muted)sawG.gain.value=.16;}
    }else if(A.state==='fell'){
      A.t-=dt;
      A.mesh.position.set(tr.pos.x+1.4,terrainH(tr.pos.x,tr.pos.z),tr.pos.z);
      if(A.t<=0){
        if(sawG)sawG.gain.value=0;
        tr.state='falling';tr.fallT=0;
        blip(60,1,'sawtooth',.35,-40);
        hornSound();
        fxShake=Math.max(fxShake,1.6);
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
    A.state='walk';A.mesh.position.y=terrainH(A.mesh.position.x,A.mesh.position.z);
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
    if(gm.tickleState!=='none'||gm.confronting||gm.parked||gm.arrested)continue;
    if(gm.state==='idle'){
      const br=fallenBranches.find(b=>!b.claimed);
      if(br){br.claimed=true;gm.carry=br;gm.state='fetch';}
      else{moveToward(gm.mesh,V3(6,0,29),2,dt);}
    }else if(gm.state==='fetch'){
      const d=moveToward(gm.mesh,gm.carry.mesh.position,3,dt);
      if(d<1){gm.state='haul';}
    }else if(gm.state==='haul'){
      const d=moveToward(gm.mesh,chipper.intake,2.55,dt); // 15% slower: stump-end mass
      // branch DRAGS behind: stump end at the hand, leaf end trailing on the ground
      const bm=gm.carry.mesh;
      bm.position.copy(gm.mesh.position);bm.position.y=terrainH(gm.mesh.position.x,gm.mesh.position.z)+0.9;
      const trailYaw=gm.mesh.rotation.y+Math.PI; // opposite of heading
      if(bm._dragYaw===undefined)bm._dragYaw=trailYaw;
      let dy=trailYaw-bm._dragYaw;
      while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;
      bm._dragYaw+=clamp(dy,-2.5*dt,2.5*dt); // leaf-end friction lag
      bm.rotation.set(0,bm._dragYaw,0.55+Math.sin(game.time*13)*0.04); // tilted so the leaf end scrapes, slight jitter
      if(d<2){
        const i=fallenBranches.indexOf(gm.carry);if(i>=0)fallenBranches.splice(i,1);
        feedBranch(gm.carry.mesh);
        gm.carry=null;chipper.queue++;gm.state='idle';}
    }else if(gm.state==='break'){/* handled in teaBreak block */}
  }
}
/* ---- slow feed: branch visibly translates into the machine over the 3.2s processing ---- */
const feedQueue=[]; // meshes waiting to be visibly eaten (FIFO; queue items without a mesh feed invisibly)
// visually-truthful availability: the chipper refuses cats ONLY while something is in the throat
chipper.catReady=function(){return this.engineOn&&!game.over&&!this.curFeed&&!(this.stallT>0);};
chipper.gapT=0; // CRITICAL init: undefined<=0 is false in JS — without this the feed loop can never start
function stagingPos(i){
  // ART contract: chipperVis.palletTop ≈ world (5.37,0.2,23.05); stack +0.15y per branch
  if(typeof chipperVis!=='undefined'&&chipperVis){
    if(chipperVis.pallet&&chipperVis.pallet.getWorldPosition){
      const p=chipperVis.pallet.getWorldPosition(V3());
      return V3(p.x,0.2+i*0.15,p.z);}
    return V3(5.37,0.2+i*0.15,23.05);}
  // fallback: stacked beside the chipper until ART's pallet lands
  return V3(chipperG.position.x-2.2,0.5+i*0.15,chipperG.position.z-1.2);}
function parkAtStaging(mesh,i){
  mesh._dragYaw=undefined;
  mesh.position.copy(stagingPos(i));
  mesh.rotation.set(0,rand(0,Math.PI),1.45);} // lying flat, slight random yaw each
function feedBranch(mesh){
  parkAtStaging(mesh,feedQueue.length);
  feedQueue.push(mesh);}
function promoteFeed(){
  // pull the next visible item into the throat; meshless (trunk-bucking) items get a generic log so busy is ALWAYS visible
  let m;
  if(feedQueue.length)m=feedQueue.shift();
  else{m=cyl(0.26,0.34,2.4,M.bark);m._genLog=true;scene.add(m);}
  const outDir=chipper.intake.clone().sub(chipperG.position);outDir.y=0;outDir.normalize();
  m.position.copy(chipper.intake).addScaledVector(outDir,0.9);
  m.position.y=1.5;
  m.scale.setScalar(1);
  // align the item's LONG AXIS with the feed direction (into the machine, dipping into the throat)
  const start=chipper.intake.clone().addScaledVector(outDir,0.9);start.y=1.5;
  const end=chipperG.position.clone().add(V3(0,1.2,0));
  const feedDir=end.clone().sub(start).normalize();
  if(m._genLog)m.quaternion.setFromUnitVectors(V3(0,1,0),feedDir); // cylinder axis = local Y
  else m.quaternion.setFromUnitVectors(V3(1,0,0),feedDir.clone().negate()); // limb: branch runs +X to the LEAF — leaf points away, stump enters first
  m._baseQ=m.quaternion.clone();
  m._whip=0;
  chipper.curFeed=m;chipper.feedK=0;chipper.tugT=0;}
function updateFeedVisual(dt){
  if(!chipper.curFeed)return;
  const f=chipper.curFeed;
  const targetK=clamp(chipper.procT/3.2,0,1);
  const rpmK=(typeof engine!=='undefined'&&engine)?clamp(engine.drumRpm/800,0.25,1.5):1;
  // discrete tugs (~4/s, rpm-scaled): drum teeth grabbing
  chipper.tugT-=dt;
  if(chipper.tugT<=0){
    chipper.tugT=0.25/rpmK;
    let chunk=(targetK-chipper.feedK)*0.55+0.02;
    if(chipper.feedK>0.7)chunk*=2.2; // <30% left: the drum wins, it accelerates sharply
    chipper.feedK=Math.min(1,chipper.feedK+Math.max(0,chunk));
    f._whip=(Math.random()<0.5?-1:1)*0.052; // leaf-end whips ±3°
    chipBurst(1,false); // chips spray in sync with the tug
  }
  f._whip*=Math.pow(0.02,dt); // whip decay
  const k=chipper.feedK;
  const outDir=chipper.intake.clone().sub(chipperG.position);outDir.y=0;outDir.normalize();
  const start=chipper.intake.clone().addScaledVector(outDir,0.9);start.y=1.5;
  const end=chipperG.position.clone().add(V3(0,1.2,0));
  f.position.lerpVectors(start,end,k);
  // high-freq vibration while the drum has it
  f.position.x+=rand(-0.025,0.025);f.position.y+=rand(-0.02,0.02);f.position.z+=rand(-0.025,0.025);
  f.scale.setScalar(Math.max(0.15,1-k*0.7));
  // whip + drum-grab vibration applied ON TOP of the long-axis alignment
  f.quaternion.copy(f._baseQ);
  f.rotateY(f._whip*3);
  f.rotateX(Math.sin(game.time*25)*0.06*(1+k));}
function updateChipper(dt){
  if(chipper.stallT>0){
    chipper.stallT-=dt;
    if(chipper.stallT<=0){
      chipper.engineOn=true;
      restartSound(); // swells chipG back to .5 itself (~0.8-1.2s in)
      msg('they restart the chipper.');}}
  // RPM wiring (FX 'engine') — start/stop mirrors engineOn; load: 0 idle, ~0.8 feeding, 1.0 briefly on cat chip
  if(typeof engine!=='undefined'&&engine){
    if(chipper.engineOn&&!engine.running)engine.start();
    else if(!chipper.engineOn&&engine.running)engine.stop();
    chipper.catLoadT=Math.max(0,(chipper.catLoadT||0)-dt);
    let tgt=chipper.curFeed?0.8:0;
    if(chipper.catLoadT>0)tgt=1;
    chipper.loadCur=lerp(chipper.loadCur||0,tgt,Math.min(1,dt*3));
    engine.setLoad(chipper.loadCur);
    engine.update(dt);}
  if(typeof chipperVis!=='undefined'&&chipperVis){ // ART intake debris accumulates with workload
    chipperVis.update(dt);
    chipperVis.setDebris(Math.min(1,chipper.queue*0.25+(chipper.curFeed?0.3:0)));}
  if(chipper.redT>0){ // phase 1: SPRAY — red debris hoses from the chute for ~4s
    chipper.redT-=dt;
    chipper._dripStarted=false; // spray still going: keep re-arming so the drip phase (re-)inits fresh, incl. re-chips
    chipper.sprayAcc=(chipper.sprayAcc||0)+dt;
    while(chipper.sprayAcc>=0.15){chipper.sprayAcc-=0.15;chipBurst(2,true,1.0);}
    chipper.gooT=Math.max(chipper.gooT,4.05); // hold: red light stays on, full drip phase follows
  }else if(chipper.gooT>0){ // phase 2: DRIP — scheduled drops + one slow red streak crawling down the chute
    if(!chipper._dripStarted){
      chipper._dripStarted=true;
      chipper._dripQueue=[0,0.4,0.9,1.6,2.6]; // ~5 drops at a decreasing rate, times relative to phase start
      chipper._dripT=0;
      if(typeof gooStreakStart==='function')gooStreakStart();}
    chipper.gooT-=dt;
    chipper._dripT+=dt;
    while(chipper._dripQueue.length&&chipper._dripT>=chipper._dripQueue[0]){
      chipper._dripQueue.shift();
      if(typeof dripOnce==='function')dripOnce();}}
  if(game.teaBreak>0){
    chipper.busy=false;chipper.itemStarted=false;
    if(chipper.curFeed){
      if(chipper.curFeed._genLog)scene.remove(chipper.curFeed);
      else{feedQueue.unshift(chipper.curFeed);parkAtStaging(chipper.curFeed,0);}
      chipper.curFeed=null;chipper.procT=0;}
    intakeGlow.material.color.setHex(0x22ff55);return;}
  if(chipper.gapT>0)chipper.gapT=Math.max(0,chipper.gapT-dt); // mouth open between items — cats welcome
  if(chipper.queue>0&&chipper.gapT<=0){
    chipper.busy=true;
    if(!chipper.itemStarted){grind(0.6);chipper.itemStarted=true;promoteFeed();}
    updateFeedVisual(dt);
    const rpmK=(typeof engine!=='undefined'&&engine)?clamp(engine.drumRpm/800,0.25,1.5):1;
    chipper.procT+=dt*rpmK; // when the engine bogs, consumption honestly slows
    if(chipper.procT>3.2){
      chipper.procT=0;chipper.queue--;
      chipper.itemStarted=false;chipper.gapT=1.2;
      if(chipper.curFeed){scene.remove(chipper.curFeed);chipper.curFeed=null;}
      chipper.pileS=Math.min(1.6,chipper.pileS+0.09);
      pile.scale.setScalar(chipper.pileS);
      if(chipper.queue===0)chipper.busy=false;}
  }else{chipper.busy=false;chipper.itemStarted=false;}
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
    sirenStop();
    msg('the inspectors file their citations and glide off. back to normal... ish.','#9fb0c8');
    if(game.acVan){scene.remove(game.acVan.mesh);game.acVan=null;}
    // return to progression mood
    const left=trees.length-game.curTree;
    moodTarget=left<=1?MOODS.blood:left<=2?MOODS.dusk:MOODS.noon;}
}

/* ---------------- chipper QTE ---------------- */
function startChipperQTE(){
  game.qte={t:2.6,prog:0.35};
  game.catchT=null;game._catchTarget=null;
  game.kick=null;
  fxShake=Math.max(fxShake,2.5);
  grind(1);
  banner('MASH ANY KEY — CLIMB OUT',1200);
  msg('YOUR SLEEVE IS CAUGHT IN THE INTAKE.','#ff5b4d');}
function qteEscape(){
  game.charge=null;
  game.qte=null;game.qteCD=3;
  // fling backward 4m from the intake
  const away=player.pos.clone().sub(chipper.intake);away.y=0;
  if(away.lengthSq()<0.001)away.set(0,0,1);else away.normalize();
  player.pos.copy(chipper.intake).addScaledVector(away,4);
  player.pos.y=0.7;
  knockDown(2);game.hurtT=Math.max(game.hurtT,0.6);
  stallSound(); // ducks chipper idle to 0 and holds it — restartSound() restores
  fxShake=Math.max(fxShake,1.2);
  chipper.engineOn=false;chipper.stallT=5;
  msg('you rip free. the chipper chokes and STALLS.','#5dff7a');
  // crew laughing fit
  laughTrack();
  for(const w of tickleWorkers){
    if(w.tickleState!=='none'||w.arrested||w.confronting||w.parked)continue;
    w.tickleState='fit';w.fitT=4;w.fitBase=w.mesh.position.clone();
    spawnSwearBubble(w);
    msg(w.name+' is laughing so hard he sat down.','#8fd4ff');}
  msg('HA. HA. HA.','#8fd4ff');}
function startEaten(){
  game.charge=null;
  game.catchT=null;game._catchTarget=null;
  game.kick=null;
  game.qte=null;
  game.eatenT=0.0001;
  game._eatenBurst=false;
  swallowSound(); // exactly 3s, silent by 2.9 — lines up with UX flash at 1.8-2.2
  banner('...');}
function updateChipperQTE(dt){
  // returns true if it consumed the frame (player is in QTE or being eaten)
  if(game.eatenT>0){
    game.eatenT=Math.min(3.0,game.eatenT+dt);
    const k=game.eatenT/3.0;
    const inside=chipper.intake.clone().lerp(chipperG.position.clone().add(V3(0,1.2,0)),Math.min(1,k*1.6));
    camera.position.lerp(inside,dt*5);
    camera.rotation.z+=dt*(4+k*8);
    camera.rotation.x+=dt*(3+k*6);
    fxShake=Math.max(fxShake,1.2);
    if(!game._eatenBurst&&game.eatenT>=1.2){
      game._eatenBurst=true;
      fxShake=Math.max(fxShake,2.0); // spike at the flash
      chipBurst(50,true,1.6);
      gooStain.material.opacity=Math.min(0.95,gooStain.material.opacity+0.35);
      gooStain.scale.multiplyScalar(1.15);}
    if(game.eatenT>=3.0&&!game.over){
      game.failTitle='EATEN';
      game.failed='You were fed into the chipper, stump end first.';
      endGame(false);}
    return true;}
  if(game.qte){
    const q=game.qte;
    q.t-=dt;
    q.prog=Math.max(0,q.prog-0.28*dt);
    // camera yanked above the hopper, looking down into it
    camera.position.lerp(chipper.intake.clone().add(V3(0,1.4,0)),dt*10);
    camera.lookAt(chipper.intake.x,chipper.intake.y-0.6,chipper.intake.z);
    camera.rotation.z=Math.sin(game.time*30)*0.06;
    fxShake=Math.max(fxShake,1.4);
    if(Math.random()<dt*8)blip(rand(700,1400),.04,'square',.15,-300);
    if(q.prog>=1){qteEscape();return true;}
    if(q.t<=0){startEaten();return true;}
    return true;}
  return false;}

/* ---------------- cat-munition bandolier ---------------- */
function tryBandolier(){
  if(!player.carrying)return false; // must have a hand cat; carrying a prop = normal charge
  const cd=camDir(),pp=player.pos;
  let best=null,bd=3.2,awake=null;
  for(const c of cats){
    if(c.dead||c===player.carrying)continue;
    const to=c.mesh.position.clone().sub(pp);to.y*=0.4;
    const d=to.length();if(d<0.001)continue;
    to.normalize();
    if(cd.dot(to)<=Math.cos(40*Math.PI/180))continue;
    if(c.state==='stun'&&d<bd){bd=d;best=c;}
    else if(d<2.5&&(c.state==='walk'||c.state==='flushed'||c.state==='bush'||c.peeking))awake=c;}
  if(best){
    if(game.bandolier.length>=4){msg('bandolier is FULL. four is plenty.','#f88');return true;}
    if(best.home&&best.home.cats){const i=best.home.cats.indexOf(best);if(i>=0)best.home.cats.splice(i,1);}
    if(best.spot&&best.spot.cats){const i=best.spot.cats.indexOf(best);if(i>=0)best.spot.cats.splice(i,1);best.spot=null;}
    best.state='stored';best.peeking=false;best.winded=0;best.sprintT=0;
    best.mesh.visible=false;best.mesh.rotation.z=0;
    game.bandolier.push({cat:best,wakeT:rand(20,30)});
    blip(500,.1,'square',.18);meow();
    msg('bandoliered ('+game.bandolier.length+'/4). it will NOT stay asleep forever.','#ffd34d');
    return true;}
  if(awake){
    if(!game._squirmT||game.time>game._squirmT){
      game._squirmT=game.time+2;
      msg('it squirms — you can only bandolier DAZED cats.','#f88');}
    return false;} // fall through to the wind-up
  return false;}
function updateBandolier(dt){
  const B=game.bandolier;
  for(let i=B.length-1;i>=0;i--){
    const s=B[i];s.wakeT-=dt;
    if(s.wakeT<=0){ // WAKES — claws its way out
      B.splice(i,1);
      const c=s.cat;
      c.state='flushed';c.t=6;c.mesh.visible=true;
      c.mesh.position.set(player.pos.x+rand(-.5,.5),0.05,player.pos.z+rand(-.5,.5));
      c.target=V3(player.pos.x+rand(-10,10),0,player.pos.z+rand(-10,10));
      game.hurtT=Math.max(game.hurtT,0.5);scratchSound();meow();
      msg('a bandolier cat WOKE UP and clawed its way out!','#ff5b4d');}}
  // auto-draw: hand empty + cats stored -> next one to hand after 0.4s
  if(B.length&&!player.carrying&&!teaState.carried&&!game.qte&&game.eatenT===0){
    game._drawT=(game._drawT===undefined?0.4:game._drawT)-dt;
    if(game._drawT<=0){
      game._drawT=0.4;
      const s=B.shift();const c=s.cat;
      c.state='carried';c.mesh.visible=true;
      player.carrying=c;meow();
      msg('next cat drawn from the bandolier.','#9fb0c8');}}
  else game._drawT=0.4;}

/* ---------------- player update ---------------- */
function updatePlayer(dt){
  if(updateChipperQTE(dt))return;
  game.hurtT=Math.max(0,game.hurtT-1.2*dt);
  const dazed=(game.hurtT>0.45||game.down>0);
  if(dazed&&!player._dazed){player._dazed=true;heartbeat(true);}
  else if(!dazed&&player._dazed){player._dazed=false;heartbeat(false);}
  if(game.down>0){
    game.charge=null;
    game.catchT=null;game._catchTarget=null;
    game.kick=null;
    game.down=Math.max(0,game.down-dt);
    player.pos.y=lerp(player.pos.y,terrainH(player.pos.x,player.pos.z)+0.7,dt*7);
    camera.position.copy(player.pos);
    camera.rotation.set(player.pitch-0.28,player.yaw,0.1+Math.sin(game.time*4)*0.08);
    player.lassoCD=Math.max(0,player.lassoCD-dt);
    player.shovelCD=Math.max(0,player.shovelCD-dt);
    player.gunCD=Math.max(0,player.gunCD-dt);
    player.grabCD=Math.max(0,player.grabCD-dt);
    game.kickCD=Math.max(0,game.kickCD-dt);
    return;}
  const crouching=keys['ControlLeft']||keys['ControlRight'];
  if(crouching&&player.prone)player.prone=false;
  const stanceMul=player.prone?0.3:(crouching?0.55:1);
  const sp=((keys['ShiftLeft']||keys['ShiftRight'])?9.8:5.2)*stanceMul;
  const f=V3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const r=V3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const mv=V3();
  if(keys['KeyW'])mv.add(f);if(keys['KeyS'])mv.sub(f);
  if(keys['KeyD'])mv.add(r);if(keys['KeyA'])mv.sub(r);
  if(mv.lengthSq()>0){mv.normalize();player.pos.addScaledVector(mv,sp*dt);}
  // footsteps: surface-aware cadence (walk ~0.38s, sprint ~0.30s); spec from the HD-audio team
  if(mv.lengthSq()>0){
    player.stepT=(player.stepT||0)-dt;
    if(player.stepT<=0){
      player.stepT=sp>6?0.30:0.38;
      let surf='grass';
      const px=player.pos.x,pz=player.pos.z;
      if(pz>63.5)surf='dirt'; // road + shoulders
      else if(px>-14&&px<-6&&pz>2&&pz<62)surf='dirt'; // driveway strip
      else if(px>-30.5&&px<-21.5&&pz>-21&&pz<-15)surf='wood'; // deck platform
      footstep(surf);}}
  else player.stepT=0;
  kickProps(mv,dt);
  // colliders (circles + fitted rects)
  for(const c of colliders){
    if(c.rect){
      const cs=Math.cos(-(c.yaw||0)),sn=Math.sin(-(c.yaw||0));
      const dx=player.pos.x-c.x,dz=player.pos.z-c.z;
      const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs; // player in rect-local frame
      const px=clamp(lx,-c.hw,c.hw),pz=clamp(lz,-c.hd,c.hd); // closest point on box
      let nx=lx-px,nz=lz-pz;const d=Math.hypot(nx,nz);
      if(d>=0.5)continue;
      if(d>0.001){nx/=d;nz/=d;}
      else{ // fully inside: exit via the nearest face
        const ex=c.hw-Math.abs(lx),ez=c.hd-Math.abs(lz);
        if(ex<ez){nx=lx>=0?1:-1;nz=0;}else{nx=0;nz=lz>=0?1:-1;}}
      const need=0.5-d;
      const wx=nx*cs+nz*sn,wz=-nx*sn+nz*cs; // normal back to world frame (inverse rotation)
      player.pos.x+=wx*need;player.pos.z+=wz*need;
      continue;}
    const dx=player.pos.x-c.x,dz=player.pos.z-c.z;
    const d=Math.hypot(dx,dz);
    if(d<c.r+0.5&&d>0.001){const push=(c.r+0.5-d);player.pos.x+=dx/d*push;player.pos.z+=dz/d*push;}}
  player.pos.x=clamp(player.pos.x,-72,72);
  player.pos.z=clamp(player.pos.z,-60,64);
  const stanceH=player.prone?0.45:(crouching?0.95:1.7);
  player.eyeH=lerp(player.eyeH||1.7,stanceH,Math.min(1,dt*8));
  player.pos.y=terrainH(player.pos.x,player.pos.z)+player.eyeH+((mv.lengthSq()>0)?Math.abs(Math.sin(game.time*(sp>6?11:8)))*0.06*stanceMul:0);
  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch,player.yaw,0);
  player.lassoCD=Math.max(0,player.lassoCD-dt);
  player.shovelCD=Math.max(0,player.shovelCD-dt);
  player.gunCD=Math.max(0,player.gunCD-dt);
  player.grabCD=Math.max(0,player.grabCD-dt);
  updateStickyGrab(dt);
  updateBandolier(dt);
  updateCatchChannel(dt);
  updateKick(dt);
  // wind-up charge
  if(game.charge!==null){
    if(!player.carrying&&!player.carryProp){game.charge=null;}
    else{
      game.charge=Math.min(1,game.charge+dt/1.1);
      if(game.charge>=1){
        fxShake=Math.max(fxShake,0.12); // trembling at full draw
        if(!game._chargeMeowed){game._chargeMeowed=true;if(player.carrying)meow();}}}}
  // PERIL: chipper QTE (sleeve caught in the intake)
  game.qteCD=Math.max(0,game.qteCD-dt);
  if(chipper.engineOn&&!game.over&&!game.qte&&game.eatenT===0&&game.qteCD<=0&&player.pos.distanceTo(chipper.intake)<1.1){
    startChipperQTE();return;}
  // PERIL: clothesline (sprinting across the wire in XZ — height ignored per design)
  if(typeof clothesline!=='undefined'&&clothesline){
    if(game.clotheslineT===undefined)game.clotheslineT=0;
    game.clotheslineT=Math.max(0,game.clotheslineT-dt);
    if((keys['ShiftLeft']||keys['ShiftRight'])&&game.down<=0&&game.clotheslineT<=0){
      const ds=segDistXZ(player.pos.x,player.pos.z,clothesline.a.x,clothesline.a.z,clothesline.b.x,clothesline.b.z);
      if(ds<0.5){knockDown(1.6);game.hurtT=0.7;game.clotheslineT=2.5;
        msg('CLOTHESLINED. by an actual clothesline.','#ff5b4d');}}}
  // tea serve check
  if(teaState.carried){
    let served=false;
    for(const gm of groundies)if(player.pos.distanceTo(gm.mesh.position)<4)served=true;
    if(player.pos.distanceTo(arborist.mesh.position)<4)served=true;
    if(served)serveTea();}
}
