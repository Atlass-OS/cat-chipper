/* ---------------- mobile: touch control surface + gesture lockdown ---------------- */
// Gesture/zoom lockdown runs on every device (harmless with a mouse); the control
// surface itself only activates on coarse-pointer / touch devices (body.touch).

// block rubber-band scroll, pull-to-refresh and swipe-navigation — but let the
// overlay card keep its own internal scroll (it has overflow:auto)
document.addEventListener('touchmove',e=>{
  if(!(e.target.closest&&e.target.closest('#overlay .card')))e.preventDefault();
},{passive:false});
// iOS Safari pinch zoom (non-standard gesture events)
for(const ev of ['gesturestart','gesturechange','gestureend'])
  document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
// double-tap zoom: kill the second tap outside the overlay (overlay needs its clicks)
let _tapT=0;
document.addEventListener('touchend',e=>{
  const n=performance.now();
  if(n-_tapT<320&&!(e.target.closest&&e.target.closest('#overlay')))e.preventDefault();
  _tapT=n;},{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault());

const IS_TOUCH=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window);
if(IS_TOUCH){
  document.body.classList.add('touch');
  document.getElementById('touchui').addEventListener('contextmenu',e=>e.preventDefault());
  {const _inc=document.getElementById('incoming');if(_inc)_inc.textContent='⚠ INCOMING CAT — TAP CATCH ⚠';}
  {const _qt=document.getElementById('qtetext');if(_qt)_qt.textContent='MASH THE SCREEN';}
  // swap the keyboard cheat-sheet for the touch one whenever the overlay changes mode
  {const _tk=document.getElementById('touchkeys');if(_tk)_tk.style.display='block';}
  if(typeof setOverlayMode==='function'){
    const _som=setOverlayMode;
    setOverlayMode=function(mode){_som(mode);
      const tk=document.getElementById('touchkeys');
      if(tk)tk.style.display=(mode==='start'||mode==='pause')?'block':'none';};}

  const inPlay=()=>game.started&&!game.paused&&!game.over;
  // the chipper QTE eats every input: any touch = one mash (mirrors the keydown masher)
  function qteMash(){
    if(!game.qte)return false;
    if(typeof game.qte.prog==='number'){
      game.qte.prog=Math.min(1,game.qte.prog+0.09);
      if(typeof struggleSound==='function')struggleSound();
      fxShake=Math.max(fxShake,0.3);}
    return true;}

  /* ---- virtual joystick: maps onto the same `keys` object updatePlayer reads
     (movement is normalized there, so 8-way digital == analog); rim = sprint ---- */
  const joy=document.getElementById('joy'),knob=document.getElementById('joyknob');
  const JR=58; // knob travel radius, px
  let joyId=null,joyCX=0,joyCY=0;
  function clearMoveKeys(){keys['KeyW']=keys['KeyS']=keys['KeyA']=keys['KeyD']=keys['ShiftLeft']=false;}
  function joyApply(t){
    let dx=t.clientX-joyCX,dy=t.clientY-joyCY;
    const d=Math.hypot(dx,dy);
    if(d>JR){dx*=JR/d;dy*=JR/d;}
    knob.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)';
    if(!inPlay()){clearMoveKeys();return;}
    const nx=dx/JR,ny=dy/JR;
    keys['KeyW']=ny<-0.35;keys['KeyS']=ny>0.35;
    keys['KeyA']=nx<-0.35;keys['KeyD']=nx>0.35;
    keys['ShiftLeft']=Math.min(1,d/JR)>0.92;}
  joy.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(qteMash())return;
    if(joyId!==null)return;
    const t=e.changedTouches[0];joyId=t.identifier;
    const r=joy.getBoundingClientRect();joyCX=r.left+r.width/2;joyCY=r.top+r.height/2;
    joyApply(t);},{passive:false});
  joy.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches)if(t.identifier===joyId)joyApply(t);},{passive:false});
  const joyEnd=e=>{
    for(const t of e.changedTouches)if(t.identifier===joyId){
      joyId=null;knob.style.transform='';clearMoveKeys();}};
  joy.addEventListener('touchend',joyEnd);joy.addEventListener('touchcancel',joyEnd);

  /* ---- look: drag anywhere on the canvas (no pointer lock on touch) ---- */
  let lookId=null,lookX=0,lookY=0;
  canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(qteMash())return;
    if(lookId!==null)return;
    const t=e.changedTouches[0];lookId=t.identifier;lookX=t.clientX;lookY=t.clientY;},{passive:false});
  canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier!==lookId)continue;
      const dx=t.clientX-lookX,dy=t.clientY-lookY;
      lookX=t.clientX;lookY=t.clientY;
      if(!inPlay())continue;
      player.yaw-=dx*0.0052;player.pitch-=dy*0.0052;
      player.pitch=clamp(player.pitch,-1.45,1.45);}},{passive:false});
  const lookEnd=e=>{for(const t of e.changedTouches)if(t.identifier===lookId)lookId=null;};
  canvas.addEventListener('touchend',lookEnd);canvas.addEventListener('touchcancel',lookEnd);

  /* ---- action buttons -> the shared press/release actions from 05-gameplay ---- */
  function bindHold(id,down,up){
    const el=document.getElementById(id);
    el.addEventListener('touchstart',e=>{
      e.preventDefault();el.classList.add('on');
      if(qteMash())return;
      if(!inPlay())return;
      down();},{passive:false});
    const end=e=>{e.preventDefault();el.classList.remove('on');if(up)up();};
    el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);}
  bindHold('btn-yeet',pressLMB,releaseLMB);          // hold = wind up, release = YEET; tap = grab/punt
  bindHold('btn-catch',pressRMB,releaseRMB);         // hold = catch channel; tap = mid-air snag
  bindHold('btn-kick',startKick,releaseKick);        // hold = kick wind-up (middle-mouse twin)
  bindHold('btn-act',()=>{if(game.eatenT>0)return;interact();});
  bindHold('btn-dogs',()=>{if(game.eatenT>0)return;tryReleaseDogs();});

  // stance cycles stand -> crouch -> prone (Ctrl / X on keyboard)
  let stance=0;
  document.getElementById('btn-stance').addEventListener('touchstart',e=>{
    e.preventDefault();
    if(qteMash()||!inPlay()||game.eatenT>0)return;
    stance=(stance+1)%3;
    keys['ControlLeft']=stance===1;
    player.prone=stance===2;
    e.currentTarget.textContent=stance===2?'🐍':(stance===1?'🧎':'🧍');
    msg(stance===2?'prone — crawl under things':(stance===1?'crouching':'back on your feet'),'#9fb0c8');},{passive:false});

  // pause: no pointer lock on touch, so pointerlockchange never pauses for us
  document.getElementById('btn-pause').addEventListener('touchstart',e=>{
    e.preventDefault();
    if(!game.started||game.over||game.paused)return;
    game.paused=true;
    clearMoveKeys();releaseLMB();releaseRMB();releaseKick();
    showPauseCard();},{passive:false});

  // toolbar chips become tap targets (1-4 on keyboard)
  [['t1','hands'],['t2','lasso'],['t3','shovel'],['t4','gun']].forEach(([id,tool])=>{
    document.getElementById(id).addEventListener('touchstart',e=>{
      e.preventDefault();
      if(qteMash()||!inPlay()||game.eatenT>0)return;
      selectTool(tool);},{passive:false});});

  // pulse the E button while an interaction prompt is up (same signal as cross-big)
  (function touchUiLoop(){
    requestAnimationFrame(touchUiLoop);
    const el=document.getElementById('btn-act');
    const hot=inPlay()&&!!(typeof promptText!=='undefined'&&promptText);
    if(el._hot!==hot){el.classList.toggle('hot',hot);el._hot=hot;}})();
}
