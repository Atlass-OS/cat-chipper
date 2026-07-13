/* ---------------- HUD ---------------- */
function updateHUD(){
  document.getElementById('score').firstChild.textContent='$'+game.score;
  document.getElementById('catcount').textContent='cats chipped: '+game.catsChipped+' / '+totalCats;
  const left=trees.length-game.curTree;
  document.getElementById('treecount').textContent='🌲 trees left: '+Math.max(0,left);
  const cs=document.getElementById('chipstat');
  if(!chipper.engineOn){cs.textContent='chipper: OFF';cs.style.color='#8a93a5';}
  else if(chipper.catReady()){cs.textContent='chipper: CAT READY';cs.style.color='#5dff7a';}
  else{cs.textContent='chipper: BUSY';cs.style.color='#ff5b4d';}
  const ev=document.getElementById('eventstat');
  if(game.frenzy>0){ev.textContent='RAID: '+Math.ceil(game.frenzy)+'s';ev.style.color='#ff5b4d';}
  else if(game.teaBreak>0){ev.textContent='TEA BREAK: '+Math.ceil(game.teaBreak)+'s ('+game.teaChips+'/3 for raid)';ev.style.color='#ffd34d';}
  else if(!game.workStarted){ev.textContent='crew prepping: '+Math.ceil(game.prepT)+'s';ev.style.color='#9fb0c8';}
  else ev.textContent='';
}

/* ---------------- game flow ---------------- */
function endGame(annihilation){
  game.over=true;
  if(sawG)sawG.gain.value=0;if(chipG)chipG.gain.value=0;
  const pct=game.catsChipped/totalCats;
  let rank;
  if(annihilation)rank='TOTAL ANNIHILATION — NOT ONE WHISKER LEFT';
  else if(pct>=.9)rank='FELINE APOCALYPSE';
  else if(pct>=.7)rank='CERTIFIED CAT CHIPPER';
  else if(pct>=.5)rank='PEST CONTROL PROFESSIONAL';
  else if(pct>=.3)rank='WEEKEND WARRIOR';
  else if(pct>0)rank='THE CATS BARELY NOTICED';
  else rank='FRIEND OF ALL CATS (wrong game?)';
  document.getElementById('endstats').style.display='block';
  document.getElementById('endstats').innerHTML=
    'FINAL SCORE: <b style="color:#ff5b4d">$'+game.score+'</b><br>'+
    'cats chipped: '+game.catsChipped+' / '+totalCats+'<br>'+
    (game.frenzyDone?'✔ triggered the Animal Control raid<br>':'')+
    (game.tipped?'✔ tipped the crew early<br>':'');
  document.getElementById('rank').style.display='block';
  document.getElementById('rank').textContent='RANK: '+rank;
  document.getElementById('introtext').style.display='none';
  document.querySelector('.keys').style.display='none';
  document.getElementById('playbtn').textContent='PLAY AGAIN';
  document.getElementById('playbtn').onclick=()=>location.reload();
  document.getElementById('overlay').style.display='flex';
  document.exitPointerLock();
  banner(annihilation?'EVERY. SINGLE. CAT.':'JOB COMPLETE');
}
document.getElementById('playbtn').addEventListener('click',()=>{
  reduceFlash=document.getElementById('noflash').checked;
  initAudio();
  if(AC&&AC.state==='suspended')AC.resume();
  document.getElementById('overlay').style.display='none';
  try{const plp=canvas.requestPointerLock();if(plp&&plp.catch)plp.catch(()=>{});}catch(e){/* automation/iframe contexts */}
  if(!game.started){game.started=true;game.paused=false;
    msg('the crew is unloading. cats are wandering. you have a moment...','#9fb0c8');
    msg('tip: TIP the crew (E) to start the chipper before the chaos.','#ffd34d');}
  else game.paused=false;});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement!==canvas&&game.started&&!game.over){
    game.paused=true;
    document.getElementById('playbtn').textContent='RESUME';
    document.getElementById('overlay').style.display='flex';}});

/* ---------------- doors anim ---------------- */
function updateDoors(dt){
  for(const d of [shedDoor,...carDoors]){
    const tgt=d.open?-1.9:0;
    d.hinge.rotation.y=lerp(d.hinge.rotation.y,tgt,dt*6);}
  for(const p of pickups)if(!p.taken){p.mesh.rotation.y+=dt*2;}}

/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let hudT=0;
function tick(){
  requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),0.05);
  if(game.started&&!game.paused&&!game.over){
    game.time+=dt;
    if(!game.workStarted){game.prepT-=dt;}
    game.comboT=Math.max(0,game.comboT-dt);
    if(game.comboT===0)game.combo=0;
    updatePlayer(dt);
    updateCats(dt);
    updateDogs(dt);
    updateCrew(dt);
    updateFallingLimbs(dt);
    updateChipper(dt);
    updateLady(dt);
    updateFrenzy(dt);
    updateDoors(dt);
    updateParts(dt);
    computePrompt();
    const pe=document.getElementById('prompt');
    if(promptText){pe.style.display='block';pe.textContent=promptText;}
    else pe.style.display='none';
    hudT-=dt;if(hudT<=0){hudT=0.2;updateHUD();}
  }
  updateMood(dt||0.016);
  updateViewmodels();
  renderer.render(scene,camera);
}
updateHUD();
tick();
