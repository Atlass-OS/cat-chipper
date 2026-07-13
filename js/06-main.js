/* ---------------- HUD ---------------- */
function updateHUD(){
  document.getElementById('score').firstChild.textContent='$'+game.score;
  const _se=document.getElementById('score');
  if(_se._lastScore!==game.score){
    if(_se._lastScore!==undefined){_se.classList.remove('pop');void _se.offsetWidth;_se.classList.add('pop');}
    _se._lastScore=game.score;
  }
  document.getElementById('catcount').textContent='cats chipped: '+game.catsChipped+' / '+totalCats;
  const left=trees.length-game.curTree;
  document.getElementById('treecount').textContent='🌲 trees left: '+Math.max(0,left);
  const cs=document.getElementById('chipstat');
  let lampState,lampText;
  if(!chipper.engineOn){lampState='lamp-off';lampText='CHIPPER OFF';}
  else if(chipper.catReady()){
    // mouth-open gap between queued branches = urgent opportunity window
    if(chipper.queue>0){lampState='lamp-gap';lampText='MOUTH OPEN!';}
    else{lampState='lamp-on';lampText='CAT READY';}}
  else{lampState='lamp-busy';lampText='CHEWING';}
  if(cs._lamp!==lampState){cs.className=lampState;cs._lamp=lampState;}
  const _ll=cs.querySelector('.lamplabel');if(_ll)_ll.textContent=lampText;
  const ev=document.getElementById('eventstat');
  if(game.frenzy>0){ev.textContent='RAID: '+Math.ceil(game.frenzy)+'s';ev.style.color='#ff5b4d';}
  else if(game.teaBreak>0){ev.textContent='TEA BREAK: '+Math.ceil(game.teaBreak)+'s ('+game.teaChips+'/3 for raid)';ev.style.color='#ffd34d';}
  else if(!game.workStarted){ev.textContent='crew prepping: '+Math.ceil(game.prepT)+'s';ev.style.color='#9fb0c8';}
  else ev.textContent='';
}

/* ---------------- game flow ---------------- */
function setOverlayMode(mode){
  const show=(id,v,on)=>{const e=document.getElementById(id);if(e)e.style.display=v?(on||''):'none';};
  show('introtext',mode==='start');
  show('subtitle',mode==='start');
  show('warnbox',mode==='start');
  show('hintticker',mode==='start');
  const _k=document.querySelector('.keys');if(_k)_k.style.display=(mode==='start'||mode==='pause')?'':'none';
  show('pausetitle',mode==='pause');
  show('sessionstats',mode==='pause');
  show('resumehint',mode==='pause');
  show('endstats',mode==='end','block'); // stylesheet default is display:none — need explicit block
  show('rank',mode==='end','block');
  const _nb=document.getElementById('newbest');if(_nb&&mode!=='end')_nb.style.display='none';
}
function endGame(annihilation){
  game.over=true;
  if(sawG)sawG.gain.value=0;if(chipG)chipG.gain.value=0;
  // clear damage/peril visuals (keep tick caches in sync)
  canvas.classList.remove('dazed');canvas._dz=false;
  {const _he=document.getElementById('hurt');if(_he){_he.style.opacity=0;_he._op=0;}}
  {const _qe=document.getElementById('qte');if(_qe){_qe.style.display='none';_qe._vis=false;}}
  {const _ee=document.getElementById('eaten');if(_ee){_ee.style.opacity=0;_ee._op=0;_ee.classList.remove('flash');_ee._fl=false;}}
  {const _cre=document.getElementById('catchring');if(_cre){_cre.style.display='none';_cre._vis=false;
    const _crfg=document.getElementById('catchringfg');if(_crfg){_crfg.style.strokeDashoffset=100;_crfg._off=100;_crfg.classList.remove('done');_crfg._done=false;}}}
  {const _kme=document.getElementById('kickmeter');if(_kme){_kme.style.display='none';_kme._vis=false;_kme.classList.remove('cooling');_kme._cool=false;
    const _kfe=document.getElementById('kickfill');if(_kfe){_kfe.style.width='0%';_kfe._w=0;_kfe.classList.remove('full');_kfe._full=false;}
    const _kcde=document.getElementById('kickcd');if(_kcde){_kcde.textContent='';_kcde._t='';}}}
  const pct=game.catsChipped/totalCats;
  let rank;
  if(annihilation)rank='TOTAL ANNIHILATION — NOT ONE WHISKER LEFT';
  else if(pct>=.9)rank='FELINE APOCALYPSE';
  else if(pct>=.7)rank='CERTIFIED CAT CHIPPER';
  else if(pct>=.5)rank='PEST CONTROL PROFESSIONAL';
  else if(pct>=.3)rank='WEEKEND WARRIOR';
  else if(pct>0)rank='THE CATS BARELY NOTICED';
  else rank='FRIEND OF ALL CATS (wrong game?)';
  // fail state: only on a non-annihilation ending; rank derived from death type
  const _ko=(!annihilation&&game.failed);
  if(_ko){
    const _koRanks={
      'EATEN':'CHIPPER FOOD',
      'CHIPPED':'MULCH',
      'WIDOW-MAKER':'STOOD IN THE WRONG SPOT',
      'SERVED':'LEGALLY OUTMANEUVERED',
      'VIOLATED':'SNITCH (ALLEGED)'};
    rank=_koRanks[game.failTitle]||'TICKLED THE WRONG GUY';}
  // best score persistence
  let _best=0;try{_best=parseInt(localStorage.getItem('catchipper_best'))||0;}catch(e){}
  const _isNew=game.score>_best;
  if(_isNew){try{localStorage.setItem('catchipper_best',String(game.score));}catch(e){}}
  const _bestShown=Math.max(_best,game.score);
  const _badges=[];
  if(game.tipped)_badges.push('🐤 EARLY BIRD');
  if(typeof teaState!=='undefined'&&teaState&&teaState.phase==='served')_badges.push('🥤 TEA TIME');
  if(game.frenzyDone)_badges.push('🚨 THE RAID');
  const _es=document.getElementById('endstats');
  _es.innerHTML=
    (_ko?'<div class="ko-head">'+(game.failTitle||'KNOCKED OUT')+'</div><div class="ko-epitaph">'+game.failed+'</div>':'')+
    '<table class="stat-table">'+
    '<tr><td>Final score</td><td>$'+game.score+'</td></tr>'+
    '<tr><td>Cats chipped</td><td>'+game.catsChipped+' / '+totalCats+'</td></tr>'+
    '<tr><td>Best combo</td><td>'+(game.bestCombo||0)+'x</td></tr>'+
    '<tr><td>Best score</td><td>$'+_bestShown+'</td></tr>'+
    '</table>'+
    (_badges.length?'<div class="badges">'+_badges.map(b=>'<span class="badge">'+b+'</span>').join('')+'</div>':'');
  document.getElementById('rank').textContent='RANK: '+rank;
  setOverlayMode('end');
  const _nb=document.getElementById('newbest');if(_nb)_nb.style.display=_isNew?'block':'none';
  document.getElementById('playbtn').textContent='PLAY AGAIN';
  document.getElementById('playbtn').onclick=()=>location.reload();
  document.getElementById('overlay').style.display='flex';
  document.exitPointerLock();
  banner(annihilation?'EVERY. SINGLE. CAT.':(_ko?(game.failTitle||'KNOCKED OUT'):'JOB COMPLETE'));
}
// raw-input pointer lock: unadjustedMovement kills OS mouse accel + Chrome delta spikes;
// falls back to the plain request where unsupported. All rejections swallowed (automation/iframes).
function lockPointer(){
  try{
    const p=canvas.requestPointerLock({unadjustedMovement:true});
    if(p&&p.catch)p.catch(()=>{try{const q=canvas.requestPointerLock();if(q&&q.catch)q.catch(()=>{});}catch(e){}});
  }catch(e){
    try{const q=canvas.requestPointerLock();if(q&&q.catch)q.catch(()=>{});}catch(e2){}
  }
}
document.getElementById('playbtn').addEventListener('click',()=>{
  reduceFlash=document.getElementById('noflash').checked;
  initAudio();
  if(AC&&AC.state==='suspended')AC.resume();
  document.getElementById('overlay').style.display='none';
  lockPointer();
  if(!game.started){game.started=true;game.paused=false;
    msg('the crew is unloading. cats are wandering. you have a moment...','#9fb0c8');
    msg('tip: TIP the crew (E) to start the chipper before the chaos.','#ffd34d');}
  else game.paused=false;});
// mid-run pause: click ANYWHERE on the overlay to resume (start/end screens stay button-only).
// The playbtn handler runs first on button clicks and clears game.paused, so this guard skips there.
document.getElementById('overlay').addEventListener('click',()=>{
  if(!(game.started&&!game.over&&game.paused))return;
  document.getElementById('overlay').style.display='none';
  lockPointer();
  game.paused=false;});
// keep the reduce-flash checkbox (and its label) clickable without triggering resume
{const _nf=document.getElementById('noflash');
 if(_nf&&_nf.parentElement)_nf.parentElement.addEventListener('click',e=>e.stopPropagation());}
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement!==canvas&&game.started&&!game.over){
    game.paused=true;
    setOverlayMode('pause');
    const _ss=document.getElementById('sessionstats');
    if(_ss)_ss.innerHTML='cats chipped: <b>'+game.catsChipped+'</b> &nbsp;·&nbsp; score: <b>$'+game.score+'</b> &nbsp;·&nbsp; best combo: <b>'+(game.bestCombo||0)+'x</b>';
    document.getElementById('playbtn').textContent='RESUME';
    document.getElementById('overlay').style.display='flex';}});

/* ---------------- doors anim ---------------- */
function updateDoors(dt){
  for(const d of [shedDoor,...carDoors]){
    // doors auto-open on approach — they were too fussy to open with E (E still works too)
    if(!d.open){
      const wp=d.hinge.getWorldPosition(new THREE.Vector3());
      if(player.pos.distanceTo(wp)<2.6){d.open=true;blip(220,.1,'square',.15);msg('the '+d.label+' creaks open.','#9fb0c8');}}
    const tgt=d.open?-1.9:0;
    d.hinge.rotation.y=lerp(d.hinge.rotation.y,tgt,dt*6);}
  for(const p of pickups)if(!p.taken){p.mesh.rotation.y+=dt*2;}}

/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let hudT=0;
let comboWatch=0;
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
    // combo pop + best combo tracking
    if(game.combo>(game.bestCombo||0))game.bestCombo=game.combo;
    if(game.combo!==comboWatch){
      if(game.combo>comboWatch&&game.combo>0){
        const _ce=document.getElementById('combo');
        _ce.classList.remove('combo-pop');void _ce.offsetWidth;_ce.classList.add('combo-pop');
      }
      comboWatch=game.combo;
    }
    // crosshair grows while a prompt is active
    document.getElementById('cross').classList.toggle('cross-big',!!promptText);
    // damage/peril feedback (fields may not exist yet — treat undefined as 0)
    {const _hurtT=(typeof game.hurtT==='number')?game.hurtT:0;
     const _down=(typeof game.down==='number')?game.down:0;
     const _he=document.getElementById('hurt');
     const _hop=Math.min(1,_hurtT*1.2);
     if(_he&&_he._op!==_hop){_he.style.opacity=_hop;_he._op=_hop;}
     const _dz=(_hurtT>0.45||_down>0);
     if(canvas._dz!==_dz){canvas.classList.toggle('dazed',_dz);canvas._dz=_dz;}}
    // claw-mark slashes: flash on cat scratches (game.clawT set by catScratch, decayed here)
    {if(typeof game.clawT==='number'&&game.clawT>0)game.clawT=Math.max(0,game.clawT-dt);
     const _cm=document.getElementById('clawmarks');
     const _cop=(typeof game.clawT==='number')?Math.min(1,game.clawT*1.6):0;
     if(_cm&&_cm._op!==_cop){_cm.style.opacity=_cop;_cm._op=_cop;}}
    // incoming-cat warning below the crosshair (activeThrow lives in 05)
    {const _inc=(typeof activeThrow==='function')?activeThrow():null;
     const _ie=document.getElementById('incoming');
     const _ivis=!!_inc;
     if(_ie&&_ie._vis!==_ivis){_ie.style.display=_ivis?'block':'none';_ie._vis=_ivis;}}
    // chipper intake QTE (game.qte may not exist yet; null = hidden instantly)
    {const _q=game.qte;
     const _qe=document.getElementById('qte');
     const _qvis=!!(_q&&typeof _q.prog==='number');
     if(_qe&&_qe._vis!==_qvis){_qe.style.display=_qvis?'block':'none';_qe._vis=_qvis;}
     if(_qe&&_qvis){
       const _qb=document.getElementById('qtebar');
       const _p=clamp(_q.prog,0,1);
       const _pw=Math.round(_p*100);
       if(_qb._w!==_pw){_qb.style.width=_pw+'%';_qb._w=_pw;}
       const _qc=_p>0.7?'good':(_p>0.35?'mid':'');
       if(_qb._c!==_qc){_qb.className=_qc;_qb._c=_qc;}
       const _qt=document.getElementById('qtetime');
       const _tw=Math.round(clamp((_q.t||0)/2.6,0,1)*100);
       if(_qt._w!==_tw){_qt.style.width=_tw+'%';_qt._w=_tw;}}}
    // throw charge meter (game.charge may not exist yet; null = hidden instantly)
    {const _ch=(typeof game.charge==='number')?clamp(game.charge,0,1):null;
     const _che=document.getElementById('charge');
     const _cvis=_ch!==null;
     if(_che&&_che._vis!==_cvis){_che.style.display=_cvis?'block':'none';_che._vis=_cvis;}
     if(_che&&_cvis){
       const _cf=document.getElementById('chargefill');
       const _chh=Math.round(_ch*100);
       if(_cf._h!==_chh){_cf.style.height=_chh+'%';_cf._h=_chh;}
       const _cc=_ch>=1?'max':(_ch>0.55?'hot':'');
       if(_cf._c!==_cc){_cf.className=_cc;_cf._c=_cc;}
       const _cfull=_ch>=1;
       if(_che._f!==_cfull){_che.classList.toggle('full',_cfull);_che._f=_cfull;}}}
    // catch ring around crosshair (game.catchT may not exist yet; null = hidden instantly)
    {const _ct=(typeof game.catchT==='number')?clamp(game.catchT,0,1):null;
     const _cre=document.getElementById('catchring');
     const _crvis=_ct!==null;
     if(_cre&&_cre._vis!==_crvis){_cre.style.display=_crvis?'block':'none';_cre._vis=_crvis;}
     if(_cre&&_crvis){
       const _crfg=document.getElementById('catchringfg');
       const _croff=Math.round(100*(1-_ct));
       if(_crfg._off!==_croff){_crfg.style.strokeDashoffset=_croff;_crfg._off=_croff;}
       const _crdone=_ct>=1;
       if(_crfg._done!==_crdone){_crfg.classList.toggle('done',_crdone);_crfg._done=_crdone;}}}
    // kick wind-up meter + cooldown (game.kick / game.kickCD may not exist yet)
    {const _kk=(typeof game.kick==='number')?clamp(game.kick,0,1):null;
     const _kcd=(typeof game.kickCD==='number')?game.kickCD:0;
     const _kme=document.getElementById('kickmeter');
     const _kvis=(_kk!==null)||(_kcd>0);
     if(_kme&&_kme._vis!==_kvis){_kme.style.display=_kvis?'flex':'none';_kme._vis=_kvis;}
     if(_kme&&_kvis){
       const _cool=(_kcd>0&&_kk===null);
       if(_kme._cool!==_cool){_kme.classList.toggle('cooling',_cool);_kme._cool=_cool;}
       const _kcde=document.getElementById('kickcd');
       const _kt=_cool?(Math.ceil(_kcd)+'s'):'';
       if(_kcde&&_kcde._t!==_kt){_kcde.textContent=_kt;_kcde._t=_kt;}
       const _kfe=document.getElementById('kickfill');
       const _kw=(_kk!==null)?Math.round(_kk*100):0;
       if(_kfe._w!==_kw){_kfe.style.width=_kw+'%';_kfe._w=_kw;}
       const _kfull=(_kk!==null)&&_kk>=1;
       if(_kfe._full!==_kfull){_kfe.classList.toggle('full',_kfull);_kfe._full=_kfull;}}}
    // cat bandolier (game.bandolier may not exist yet) + in-hand slot
    {const _bl=Array.isArray(game.bandolier)?game.bandolier:[];
     for(let _bi=0;_bi<4;_bi++){
       const _bs=document.getElementById('b'+(_bi+1));
       if(!_bs)continue;
       const _be=_bl[_bi];
       const _bst=_be?((typeof _be.wakeT==='number'&&_be.wakeT<5)?'waking':'filled'):'empty';
       if(_bs._st!==_bst){
         _bs.className=_bst==='empty'?'bslot':(_bst==='waking'?'bslot filled waking':'bslot filled');
         _bs.textContent=_be?'🐱':'🐾';
         _bs._st=_bst;}}
     const _bh=document.getElementById('bhand');
     if(_bh){const _hst=player.carrying?'filled':'empty';
       if(_bh._st!==_hst){
         _bh.className=_hst==='filled'?'bslot bhand filled':'bslot bhand';
         _bh.textContent=_hst==='filled'?'🐱':'🐾';
         _bh._st=_hst;}}}
    hudT-=dt;if(hudT<=0){hudT=0.2;updateHUD();}
  }
  // eaten-by-the-chipper sequence (game.eatenT may not exist yet; clears once game.over)
  {const _et=(!game.over&&typeof game.eatenT==='number')?game.eatenT:0;
   const _ee=document.getElementById('eaten');
   if(_ee){
     let _eop=0,_efl=false;
     if(_et>0){
       if(_et<1.2)_eop=_et/1.2;                       // fade to black in the belly
       else if(_et<1.8)_eop=1;                        // hold black
       else if(_et<2.2){_eop=1;_efl=true;}            // snap to blinding warm flash (out the chute)
       else{_eop=Math.max(0,1-(_et-2.2)/0.8);_efl=true;} // flash fades to reveal the end
     }
     if(_ee._fl!==_efl){_ee.classList.toggle('flash',_efl);_ee._fl=_efl;}
     if(_ee._op!==_eop){_ee.style.opacity=_eop;_ee._op=_eop;}}}
  updateMood(dt||0.016);
  updateViewmodels();
  renderer.render(scene,camera);
}
updateHUD();
tick();
