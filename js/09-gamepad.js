/* ---------------- gamepad: Xbox / standard-mapping controller profile ----------------
   pollGamepad(dt) is called from tick() (06) BEFORE the sim updates, so stick + trigger input lands the same
   frame. Drives the same shared actions as mouse/keyboard/touch (05: pressLMB/releaseLMB, pressRMB/releaseRMB,
   startKick/releaseKick, interact, tryReleaseDogs, selectTool) and writes movement into `keys` ONLY on edges,
   so a keyboard held at the same time is never stomped. Last-used device wins: pad input tags body.pad
   (controller cheat-sheet, Ⓐ prompts, D-pad tool caps); a key or mouse press flips it back.

   LS move · L3 sprint (latched until the stick recenters) · RS look (aim slowdown over cats)
   RT = LMB (hold wind-up → YEET) · LT = RMB (catch / snag) · RB = kick · A/X interact · Y dogs
   B tap = crouch, hold = prone · LB / D-pad tools · VIEW mute · MENU pause/resume/start
   Rumble rides fxShake: every camera-shake event (chip, scratch, TIMBER, QTE mash) pulses the motors. */
const PAD={active:false,connected:false,prev:[],mv:{w:false,s:false,a:false,d:false,sprint:false},
  sprint:false,crouch:false,rt:false,lt:false,kick:false,bT:-1,lastShake:0,overAt:0};
const PAD_LOOK_YAW=3.3,PAD_LOOK_PITCH=2.2; // rad/s at full deflection
const PAD_MV=[['KeyW','w'],['KeyS','s'],['KeyA','a'],['KeyD','d'],['ShiftLeft','sprint']];
const PAD_TOOLS=['hands','lasso','shovel','gun'];
const _padFwd=new THREE.Vector3(),_padCam=new THREE.Vector3(),_padTo=new THREE.Vector3();
const _padTxt={}; // original HUD strings, restored when the keyboard/mouse takes over again

function getPad(){
  const list=navigator.getGamepads?navigator.getGamepads():[];
  let any=null;
  for(const g of list){if(!g||!g.connected)continue;if(g.mapping==='standard')return g;if(!any)any=g;}
  return any;}
function setPadMode(on){
  if(PAD.active===on)return;PAD.active=on;
  document.body.classList.toggle('pad',on);
  const swap=(key,el,txt)=>{if(!el)return;if(!(key in _padTxt))_padTxt[key]=el.textContent;el.textContent=on?txt:_padTxt[key];};
  swap('incoming',document.getElementById('incoming'),'⚠ INCOMING CAT — PULL RT TO CATCH ⚠');
  swap('qtetext',document.getElementById('qtetext'),'MASH ANY BUTTON');
  swap('resumehint',document.getElementById('resumehint'),'press A or MENU to resume');
  PAD_TOOLS.forEach((t,i)=>swap('kc'+i,document.querySelector('#t'+(i+1)+' .kc'),'↑→↓←'[i]));}
// prompt text hook for tick() (06): every prompt is written 'E — ...'
function padLabel(t){return PAD.active&&t.startsWith('E —')?'Ⓐ'+t.slice(1):t;}

function padKey(code,k,v){if(PAD.mv[k]!==v){PAD.mv[k]=v;keys[code]=v;}}
// let go of everything the pad is holding (menus, pause, disconnect) — paused first, so a wind-up cancels, never throws
function padRelease(){
  if(PAD.rt){PAD.rt=false;releaseLMB();}
  if(PAD.lt){PAD.lt=false;releaseRMB();}
  if(PAD.kick){PAD.kick=false;releaseKick();}
  for(const [code,k] of PAD_MV)padKey(code,k,false);
  PAD.sprint=false;PAD.bT=-1;}
function padPause(){
  if(document.pointerLockElement===canvas){document.exitPointerLock();return;} // pointerlockchange (06) pauses for us
  game.paused=true;padRelease();showPauseCard();}
function padCycleTool(){
  const own=PAD_TOOLS.filter(t=>t==='hands'||player.tools[t]);
  selectTool(own[(own.indexOf(player.tool)+1)%own.length]);}
function padStance(prone){
  if(game.eatenT>0)return;
  if(prone){player.prone=!player.prone;PAD.crouch=false;}
  else if(player.prone){player.prone=false;PAD.crouch=false;} // tap B while prone = stand straight up
  else PAD.crouch=!PAD.crouch;
  keys['ControlLeft']=PAD.crouch;
  msg(player.prone?'prone — crawl under things':(PAD.crouch?'crouching':'back on your feet'),'#9fb0c8');}
// console-style aim friction: look speed halves while the crosshair sits on a live cat (~0.7m sticky radius)
function padAimSlow(){
  camera.getWorldPosition(_padCam);camera.getWorldDirection(_padFwd);
  for(const c of cats){
    if(c.dead||!c.mesh.visible||c.state==='carried')continue;
    _padTo.copy(c.mesh.position);_padTo.y+=0.25;_padTo.sub(_padCam);
    const d=_padTo.length();if(d>45||d<0.6)continue;
    if(_padFwd.dot(_padTo)/d>Math.cos(clamp(Math.atan(0.7/d),0.044,0.157)))return 0.5;}
  return 1;}
function padRumble(g,s){
  const va=g.vibrationActuator;if(!va||!va.playEffect)return;
  try{const p=va.playEffect('dual-rumble',{startDelay:0,duration:Math.min(420,90+s*170),
      strongMagnitude:Math.min(1,0.2+s*0.45),weakMagnitude:Math.min(1,0.35+s*0.4)});
    if(p&&p.catch)p.catch(()=>{});}catch(e){}}

function pollGamepad(dt){
  const g=getPad();
  if(!g){if(PAD.connected){PAD.connected=false;padRelease();}return;}
  PAD.connected=true;
  const b=g.buttons,ax=g.axes,prev=PAD.prev,now=[];
  for(let i=0;i<b.length;i++)now[i]=!!(b[i]&&b[i].pressed);
  // analog triggers with hysteresis so a resting finger doesn't chatter
  const rtv=b[7]?b[7].value:0,ltv=b[6]?b[6].value:0;
  now[7]=prev[7]?rtv>0.35:rtv>0.55;now[6]=prev[6]?ltv>0.35:ltv>0.55;
  PAD.prev=now;
  const hit=i=>now[i]&&!prev[i],rel=i=>!now[i]&&prev[i];
  const lx=ax[0]||0,ly=ax[1]||0,rx=ax[2]||0,ry=ax[3]||0;
  const lm=Math.hypot(lx,ly),rm=Math.hypot(rx,ry);
  let pressed=false;for(let i=0;i<now.length;i++)if(now[i]&&!prev[i]){pressed=true;break;}
  if(pressed||lm>0.5||rm>0.5)setPadMode(true);
  // rumble only for the device actually in hand
  if(PAD.active&&fxShake>PAD.lastShake+0.12)padRumble(g,fxShake);
  PAD.lastShake=fxShake;

  // ---- menus: A or MENU starts / resumes; end screen waits 1.5s so a mashed A can't skip the results ----
  if(game.over&&!PAD.overAt)PAD.overAt=performance.now();
  const ov=document.getElementById('overlay');
  if(ov.style.display!=='none'){
    padRelease();
    if(hit(0)||hit(9)){
      if(game.over){if(performance.now()-PAD.overAt>1500)document.getElementById('playbtn').click();}
      else if(!game.started||game.paused){
        document.getElementById('playbtn').click();
        // a controller press isn't a browser "user gesture", so the AudioContext may stay asleep until a click/key
        setTimeout(()=>{if(AC&&AC.state==='suspended')msg('🎮 sound is asleep — click or press any key once to wake it','#9fb0c8');},400);}}
    return;}
  if(!game.started||game.paused||game.over){padRelease();return;}
  if(hit(9)){padPause();return;}

  // ---- movement: LS -> 8-way WASD (updatePlayer normalizes), L3 latches sprint until the stick recenters ----
  let w=false,s=false,a=false,d=false;
  if(lm>0.25){const nx=lx/lm,ny=ly/lm;w=ny<-0.383;s=ny>0.383;a=nx<-0.383;d=nx>0.383;}
  if(hit(10))PAD.sprint=!PAD.sprint;
  if(lm<0.3)PAD.sprint=false;
  padKey('KeyW','w',w);padKey('KeyS','s',s);padKey('KeyA','a',a);padKey('KeyD','d',d);
  padKey('ShiftLeft','sprint',PAD.sprint);

  // ---- look: RS, radial deadzone + 1.7 response curve (fine aim near center, fast turns at the rim) ----
  if(rm>0.12){
    const k=Math.pow(Math.min(1,(rm-0.12)/0.88),1.7)/rm*padAimSlow()*dt;
    player.yaw-=rx*k*PAD_LOOK_YAW;player.pitch-=ry*k*PAD_LOOK_PITCH;
    player.pitch=clamp(player.pitch,-1.45,1.45);}

  // ---- chipper QTE swallows every button: each fresh press = one mash (mirrors the keydown masher) ----
  if(game.qte){
    for(let i=0;i<now.length;i++)if(i!==9&&now[i]&&!prev[i]){
      game.qte.prog=Math.min(1,game.qte.prog+0.09);struggleSound();fxShake=Math.max(fxShake,0.3);}
    if(rel(7)&&PAD.rt){PAD.rt=false;releaseLMB();}
    if(rel(6)&&PAD.lt){PAD.lt=false;releaseRMB();}
    if(rel(5)&&PAD.kick){PAD.kick=false;releaseKick();}
    return;}

  // ---- triggers = mouse buttons (hold semantics intact), RB = middle-mouse kick ----
  if(hit(7)){PAD.rt=true;pressLMB();}else if(rel(7)&&PAD.rt){PAD.rt=false;releaseLMB();}
  if(hit(6)){PAD.lt=true;pressRMB();}else if(rel(6)&&PAD.lt){PAD.lt=false;releaseRMB();}
  if(hit(5)){PAD.kick=true;startKick();}else if(rel(5)&&PAD.kick){PAD.kick=false;releaseKick();}

  // ---- B: tap = crouch toggle, hold 0.4s = prone toggle ----
  if(hit(1))PAD.bT=0;
  if(now[1]&&PAD.bT>=0){PAD.bT+=dt;if(PAD.bT>=0.4){PAD.bT=-1;padStance(true);}}
  if(rel(1)&&PAD.bT>=0){PAD.bT=-1;padStance(false);}

  if(game.eatenT>0)return; // no tool switches while being digested (same as the keyboard)
  if(hit(0)||hit(2))interact();
  if(hit(3))tryReleaseDogs();
  if(hit(4))padCycleTool();
  if(hit(12))selectTool('hands');if(hit(15))selectTool('lasso');
  if(hit(13))selectTool('shovel');if(hit(14))selectTool('gun');
  if(hit(8)){muted=!muted;if(masterG)masterG.gain.value=muted?0:.5;msg(muted?'muted':'unmuted');}}

// device switching: keyboard/mouse take the glyphs back; either also wakes audio a pad-start left asleep
function padHandsOff(){setPadMode(false);if(AC&&AC.state==='suspended')AC.resume();}
addEventListener('keydown',padHandsOff);
addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')padHandsOff();});
// a pad resume can't take pointer lock (no user gesture) — the next mouse click on the canvas grabs it
if(!IS_TOUCH)canvas.addEventListener('mousedown',()=>{
  if(game.started&&!game.paused&&!game.over&&document.pointerLockElement!==canvas)lockPointer();});
addEventListener('gamepadconnected',()=>{setPadMode(true);
  if(game.started&&!game.over)msg('🎮 controller connected — RT yeet · LT catch · A interact','#9fb0c8');});
addEventListener('gamepaddisconnected',()=>{
  if(getPad())return;
  const wasActive=PAD.active;padRelease();setPadMode(false);
  if(wasActive&&game.started&&!game.paused&&!game.over)padPause(); // controller died mid-run: pause, don't strand the player
});
// cheat-sheet follows the overlay mode (06 only toggles the first .keys block)
{const _som=setOverlayMode;
 setOverlayMode=function(mode){_som(mode);
   const pk=document.getElementById('padkeys');if(pk)pk.style.display=(mode==='start'||mode==='pause')?'':'none';};}
