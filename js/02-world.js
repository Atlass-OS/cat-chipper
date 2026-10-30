/* ---------------- world ---------------- */
const props=[]; // {mesh, r, mass} manipulable/tumbleable world props, origin at CENTER
const colliders=[]; // circles {x,z,r} and fitted rects {rect:true,x,z,hw,hd,yaw} — both push the player out
function addCol(x,z,r){colliders.push({x,z,r});}
function addColRect(x,z,hw,hd,yaw=0){colliders.push({rect:true,x,z,hw,hd,yaw});}
// procedural-texture helper: clone a TEX entry with per-surface tiling (guarded — null-safe before TEX is built)
function texTile(key,rx,ry){
  const t=TEX[key]; if(!t) return null;
  const c=t.clone(); c.needsUpdate=true;
  c.wrapS=c.wrapT=THREE.RepeatWrapping;
  c.repeat.set(rx,ry);
  return c;
}
// ground plane: segmented + vertex-displaced by terrainRaw for gentle rolling hills
// (TERRAIN_SIZE/TERRAIN_SEGS are shared with terrainH in 01-core — it interpolates this exact grid)
const groundGeo=new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,TERRAIN_SEGS,TERRAIN_SEGS);
{const p=groundGeo.attributes.position;
 for(let i=0;i<p.count;i++){
   const gx=p.getX(i),gy=p.getY(i); // plane local; after -90° X rot, local +Y maps to world -Z
   p.setZ(i,terrainRaw(gx,-gy)); // displace along local Z (becomes world Y)
 }
 groundGeo.computeVertexNormals();}
const ground=new THREE.Mesh(groundGeo,M.grass);
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// dirt driveway — sits on the flattened corridor (terrainH≈0 along x≈-10), slight lift to avoid z-fight
const drive=new THREE.Mesh(new THREE.PlaneGeometry(8,60),M.dirt);
drive.rotation.x=-Math.PI/2;drive.position.set(-10,0.04,32);drive.receiveShadow=true;scene.add(drive);

/* ----- procedural texture application (guarded; safe before TEX is built) ----- */
// big grass plane (M.grass is used only by `ground`)
if(TEX.grass){ground.material.map=texTile('grass',40,40);ground.material.needsUpdate=true;}
if(TEX.grassBump){ground.material.bumpMap=texTile('grassBump',40,40);ground.material.bumpScale=0.15;ground.material.needsUpdate=true;}
// dirt driveway (M.dirt is used only by `drive`); ruts run the drive length (world Z / geometry-V), so tile more along V
if(TEX.dirt){drive.material.map=texTile('dirt',2,12);drive.material.needsUpdate=true;}
if(TEX.dirtBump){drive.material.bumpMap=texTile('dirtBump',2,12);drive.material.bumpScale=0.15;drive.material.needsUpdate=true;}
// shared leaf/bush materials — one assignment textures every tree canopy, limb, tuft & bush (do NOT clone per-mesh)
if(TEX.foliage){TEX.foliage.wrapS=TEX.foliage.wrapT=THREE.RepeatWrapping;TEX.foliage.repeat.set(2,2);
  for(const m of[M.leaf,M.leaf2,M.bush]){m.map=TEX.foliage;m.needsUpdate=true;}}
// shared bark material — every trunk, limb, flare, twig (repeat 1x2)
if(TEX.bark){TEX.bark.wrapS=TEX.bark.wrapT=THREE.RepeatWrapping;TEX.bark.repeat.set(1,2);M.bark.map=TEX.bark;M.bark.needsUpdate=true;}
if(TEX.barkBump){TEX.barkBump.wrapS=TEX.barkBump.wrapT=THREE.RepeatWrapping;TEX.barkBump.repeat.set(1,2);M.bark.bumpMap=TEX.barkBump;M.bark.bumpScale=0.3;M.bark.needsUpdate=true;}

// scattered grass tufts + rocks for texture (sit ON the rolling terrain)
for(let i=0;i<90;i++){
  const tx=rand(-70,70),tz=rand(-60,60);
  const t=cyl(0.02,0.28,rand(.25,.6),Math.random()<.5?M.bush:M.leaf2,tx,0.15+terrainH(tx,tz),tz,5);
  t.castShadow=false;scene.add(t);}
for(let i=0;i<14;i++){const rx=rand(-70,70),rz=rand(-60,60);const r=sph(rand(.3,.8),M.metal,rx,.15+terrainH(rx,rz),rz,6);r.material=M.rust;scene.add(r);}

/* ----- house (old lady's) ----- */
const house=new THREE.Group();
const houseWall=box(16,7,10,M.white,0,3.5,0);
if(TEX.siding){houseWall.material=new THREE.MeshStandardMaterial({color:0xe8e4da,roughness:.85,map:texTile('siding',6,4)});}
house.add(houseWall);
const roof=new THREE.Mesh(new THREE.ConeGeometry(11.5,4,4),new THREE.MeshStandardMaterial({color:0x704438,roughness:.9}));
if(TEX.shingle){roof.material.map=texTile('shingle',4,4);roof.material.needsUpdate=true;}
if(TEX.shingleBump){roof.material.bumpMap=texTile('shingleBump',4,4);roof.material.bumpScale=0.2;roof.material.needsUpdate=true;}
roof.position.y=9;roof.rotation.y=Math.PI/4;roof.castShadow=true;house.add(roof);
house.add(box(2.4,4.4,0.3,new THREE.MeshStandardMaterial({color:0x5a3a28}),3,2.2,5.05)); // door
house.add(box(3,2.2,0.2,M.glass,-3.5,4,5.05));
// window shutters flanking the window
const shutterMat=new THREE.MeshStandardMaterial({color:0x2e4a34,roughness:.85});
house.add(box(0.5,2.2,0.15,shutterMat,-5.25,4,5.08,false));
house.add(box(0.5,2.2,0.15,shutterMat,-1.75,4,5.08,false));
// chimney poking through the roof
const chimneyMat=new THREE.MeshStandardMaterial({color:0x7a4a3f,roughness:.95});
house.add(box(1.2,3.6,1.2,chimneyMat,4,8.6,-1.5));
house.position.set(-42,0,-34);scene.add(house);addColRect(-42,-34,8.2,5.2); // fitted: 16x10 box, porch (z>-29) stays walkable
const ladyDoorPos=V3(-39,0,-28.6);
// porch + table for tea
scene.add(box(8,0.5,4,M.wood,-39,0.25,-26.4));
const teaTable=box(1.6,1,1.6,M.wood,-36.4,0.75,-26.2);scene.add(teaTable);
// porch posts at the corners of the porch slab
for(const px of[-39-3.4,-39+3.4])for(const pz of[-26.4-1.6,-26.4+1.6])
  scene.add(cyl(0.15,0.15,1.4,M.wood,px,0.5+0.7,pz,6));

/* ----- wood chipper + truck ----- */
const chipperG=new THREE.Group();
const chBody=box(2.2,1.7,3.2,M.chipOrange,0,1.35,0);chipperG.add(chBody);
chipperG.add(box(2.4,0.35,3.4,M.metal,0,0.45,0));
[[-.9,-1.2],[.9,-1.2],[-.9,1.2],[.9,1.2]].forEach(([x,z])=>{
  const w=cyl(.42,.42,.3,new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.9}));
  w.rotation.z=Math.PI/2;w.position.set(x,0.42,z);chipperG.add(w);});
// intake hopper (back, -z) - chunky flared tray, readable from all sides (DoubleSide, closed collar)
const hopperMat=new THREE.MeshStandardMaterial({color:0xd96a1f,roughness:.6,metalness:.25,side:THREE.DoubleSide});
const funnel=new THREE.Mesh(new THREE.CylinderGeometry(1.25,0.6,1.6,4,1,true),hopperMat);
funnel.rotation.x=-Math.PI/2.6;funnel.rotation.y=Math.PI/4;funnel.position.set(0,1.6,-2.35);
funnel.castShadow=true;funnel.receiveShadow=true;chipperG.add(funnel);
// bottom collar closing the gap where the hopper meets the body (no see-through)
const collarMat=M.chipOrange;
const hopperCollar=cyl(0.62,0.62,0.4,collarMat,0,1.05,-1.75,8);
hopperCollar.rotation.x=-Math.PI/2.6;chipperG.add(hopperCollar);
// feed tray lip extending back/down from the mouth
const trayMat=new THREE.MeshStandardMaterial({color:0x2b2f33,roughness:.7,metalness:.4});
const feedTray=box(1.6,0.08,0.9,trayMat,0,1.15,-3.15,false);
feedTray.rotation.x=-Math.PI/2.6+Math.PI/2;chipperG.add(feedTray);
// feed rollers just inside the mouth
const rollerMat=new THREE.MeshStandardMaterial({color:0x151515,roughness:.8});
const rollerA=cyl(0.16,0.16,1.0,rollerMat,0,1.62,-2.55,8);rollerA.rotation.z=Math.PI/2;chipperG.add(rollerA);
const rollerB=cyl(0.16,0.16,1.0,rollerMat,0,1.98,-2.68,8);rollerB.rotation.z=Math.PI/2;chipperG.add(rollerB);
// warning stripe band around the hopper rim (alternating yellow/black, 2 per side of the square mouth)
const stripeYellow=new THREE.MeshStandardMaterial({color:0xf1c40f,roughness:.6});
const stripeBlack=new THREE.MeshStandardMaterial({color:0x111111,roughness:.6});
{const rimCenter=V3(0,1.75,-2.75);
 const rimAxis=new THREE.Euler(-Math.PI/2.6,Math.PI/4,0);
 for(let i=0;i<8;i++){
   const ang=(i/8)*Math.PI*2;
   const rx=Math.cos(ang)*1.15,ry=Math.sin(ang)*1.15;
   const s=box(0.28,0.1,0.06,i%2===0?stripeYellow:stripeBlack,0,0,0,false);
   s.position.set(rimCenter.x+rx,rimCenter.y+ry*0.55,rimCenter.z);
   s.rotation.copy(rimAxis);s.rotation.z+=ang;
   chipperG.add(s);
 }}
// intake glow ring, sits just outside the rollers at the mouth plane, facing back(-z)/up so approach side reads it
const intakeGlow=new THREE.Mesh(new THREE.CircleGeometry(0.8,16),new THREE.MeshBasicMaterial({color:0x22ff55,side:THREE.DoubleSide}));
intakeGlow.position.set(0,1.78,-2.78);intakeGlow.rotation.x=-Math.PI/2.6;chipperG.add(intakeGlow);
// beefier engine housing on the body, front half (+z), clear of the hopper
const engineMat=new THREE.MeshStandardMaterial({color:0x2b2f33,roughness:.5,metalness:.5});
const engineBlock=box(1.0,0.7,0.9,engineMat,0,2.25,0.9);chipperG.add(engineBlock);
const stackMat=new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.6,metalness:.3});
const exhaustStack=cyl(0.08,0.08,0.9,stackMat,0.3,3.05,0.75,6);chipperG.add(exhaustStack);
chipperG.add(box(0.22,0.06,0.22,stackMat,0.3,3.52,0.75,false)); // rain cap
chipperG.add(box(0.5,0.05,0.05,engineMat,-0.3,2.65,0.9,false)); // vent hint
// outlet chute (front, +z, angled up)
const chute=cyl(0.42,0.42,2.6,M.chipOrange);chute.rotation.x=Math.PI/3.2;chute.position.set(0,2.7,1.9);chipperG.add(chute);
const chuteMouth=V3(0,3.4,3.0);
// feed drum - spins into the hopper throat, visible between rollers and body
const drumMat=new THREE.MeshStandardMaterial({color:0x3a3f45,roughness:.5,metalness:.6});
const toothMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.7});
const drumSpin=new THREE.Group();drumSpin.position.set(0,1.42,-2.05);
const drumMesh=cyl(0.35,0.35,1.0,drumMat,0,0,0,10);drumMesh.rotation.z=Math.PI/2;drumSpin.add(drumMesh);
for(let i=0;i<10;i++){
  const a=i/10*Math.PI*2;
  const t=box(.1,.1,.12,toothMat,(i%2? .28 : -.28),Math.cos(a)*0.36,Math.sin(a)*0.36,false);
  drumSpin.add(t);
}
chipperG.add(drumSpin);
// flywheel on the body's +x side
const flywheelMat=new THREE.MeshStandardMaterial({color:0x2f3338,roughness:.6,metalness:.5});
const flywheelSpin=new THREE.Group();flywheelSpin.position.set(1.18,1.35,0.3);
const flywheelDisc=cyl(0.55,0.55,0.1,flywheelMat,0,0,0,10);flywheelDisc.rotation.z=Math.PI/2;flywheelSpin.add(flywheelDisc);
const flywheelHub=cyl(0.09,0.09,0.16,rollerMat,0,0,0,8);flywheelHub.rotation.z=Math.PI/2;flywheelSpin.add(flywheelHub);
for(let i=0;i<5;i++){
  const sp=box(.05,1.0,.06,flywheelMat,0,0,0,false);
  sp.rotation.x=i/5*Math.PI;flywheelSpin.add(sp);
}
chipperG.add(flywheelSpin);
// engine pulley + belt guard hint
const pulleySpin=new THREE.Group();pulleySpin.position.set(1.18,2.25,0.9);
const pulleyDisc=cyl(0.16,0.16,0.1,flywheelMat,0,0,0,8);pulleyDisc.rotation.z=Math.PI/2;pulleySpin.add(pulleyDisc);
chipperG.add(pulleySpin);
const guardMat=new THREE.MeshStandardMaterial({color:0x181818,roughness:.7});
for(let i=0;i<6;i++){
  const gt=i/5;
  chipperG.add(box(.08,.08,.08,guardMat,1.2,lerp(1.9,2.25,gt),lerp(0.3,0.9,gt),false));
}
{const beltLen=Math.hypot(2.25-1.9,0.9-0.3);
 const beltAngle=Math.atan2(0.9-0.3,2.25-1.9);
 [1.28,1.12].forEach(gx=>{
   const rail=box(0.04,beltLen,0.04,guardMat,gx,2.075,0.6,false);
   rail.rotation.x=beltAngle;chipperG.add(rail);
 });}
// intake debris mound - hidden until fed
const debrisMound=new THREE.Group();debrisMound.position.set(0,1.35,-2.9);
const moundCone=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.3,8),M.chipWood);moundCone.castShadow=false;debrisMound.add(moundCone);
for(let i=0;i<4;i++){
  const twig=cyl(0.02,0.02,rand(.3,.45),M.bark,rand(-.3,.3),0.1,rand(-.3,.3),5);
  twig.rotation.z=Math.PI/2+rand(-.4,.4);twig.rotation.y=rand(0,Math.PI*2);twig.castShadow=false;
  debrisMound.add(twig);
}
debrisMound.visible=false;debrisMound.scale.setScalar(0.001);
chipperG.add(debrisMound);
// waiting-branch pallet, parked beside the chipper
const weatheredMat=new THREE.MeshStandardMaterial({color:0x6b5a42,roughness:.95});
const branchPallet=new THREE.Group();branchPallet.position.set(2.3,0,-2.3);
branchPallet.add(box(0.12,0.1,1.2,M.wood,-0.65,0.09,0,false));
branchPallet.add(box(0.12,0.1,1.2,M.wood,0.65,0.09,0,false));
[-0.48,-0.24,0,0.24,0.48].forEach(z=>{
  branchPallet.add(box(1.6,0.05,0.2,weatheredMat,0,0.17,z));
});
chipperG.add(branchPallet);
chipperG.position.set(4,0,26);chipperG.rotation.y=0.35;scene.add(chipperG);addCol(4,26,2.6);
chipperG.updateMatrixWorld(true);
// crew truck
const truck=new THREE.Group();
truck.add(box(2.6,1.5,4,new THREE.MeshStandardMaterial({color:0xdadde0,roughness:.5,metalness:.3}),0,1.15,0));
truck.add(box(2.5,1.2,1.8,new THREE.MeshStandardMaterial({color:0xdadde0,roughness:.4,metalness:.3}),0,2.35,-1));
truck.add(box(2.55,0.9,2.2,M.glass,0,2.2,-1).translateY(0.35));
[[-1.2,-1.4],[1.2,-1.4],[-1.2,1.4],[1.2,1.4]].forEach(([x,z])=>{
  const w=cyl(.5,.5,.35,new THREE.MeshStandardMaterial({color:0x141414}));w.rotation.z=Math.PI/2;w.position.set(x,.5,z);truck.add(w);});
truck.position.set(4,0,31.5);truck.rotation.y=0.35;scene.add(truck);addColRect(4,31.5,1.5,2.3,0.35); // fitted: crew truck
// chip pile under chute
const pile=new THREE.Mesh(new THREE.ConeGeometry(1.6,1.1,10),M.chipWood);
pile.castShadow=true;pile.receiveShadow=true;
const pilePos=chipperG.localToWorld(V3(0,0,4.6));pile.position.copy(pilePos);pile.position.y=0.05;pile.scale.set(.25,.25,.25);scene.add(pile);
const gooStain=new THREE.Mesh(new THREE.CircleGeometry(1,16),new THREE.MeshStandardMaterial({color:0x8e0c0c,roughness:.4,transparent:true,opacity:0}));
gooStain.rotation.x=-Math.PI/2;gooStain.position.copy(pilePos);gooStain.position.y=0.03;scene.add(gooStain);
const chipper={engineOn:false,queue:0,procT:0,busy:false,gooT:0,pileS:0.25,
  intake:chipperG.localToWorld(V3(0,1.8,-2.8)),
  catReady(){return this.engineOn&&!this.busy&&!game.over;}};

// visible working machinery on the chipper (monster-fidelity moving parts)
const chipperVis={
  drum:drumSpin, flywheel:flywheelSpin, pulley:pulleySpin,
  debrisMound, pallet:branchPallet,
  palletTop:branchPallet.getWorldPosition(new THREE.Vector3()).add(V3(0,0.2,0)),
  setDebris(x){
    x=clamp(x,0,1);
    debrisMound.visible=x>0.02;
    const s=Math.max(0.001,x);
    debrisMound.scale.set(s,0.4+0.6*s,s);
  },
  update(dt){
    let dr,ds;
    if(typeof engine!=='undefined'&&engine){dr=engine.drumRpm||0;ds=engine.dieselRpm||0;}
    else{dr=chipper.engineOn?800:0;ds=chipper.engineOn?3600:0;}
    const wDrum=Math.min(10,dr/60*Math.PI*2);   // visual cap ~10 rad/s (no strobe)
    const wPul =Math.min(16,ds/60*Math.PI*2);   // engine pulley faster but capped
    drumSpin.rotation.x+=wDrum*dt;
    flywheelSpin.rotation.x+=wDrum*dt;          // same shaft as drum
    pulleySpin.rotation.x+=wPul*dt;
  }
};

/* ----- hide structures ----- */
const hideSpots=[];
function addHide(name,x,z,mesh,r=3){const h={name,pos:V3(x,0,z),r,cats:[],mesh};hideSpots.push(h);return h;}
// mobile home (on blocks, gap under)
{const g=new THREE.Group();
 g.add(box(12,3.4,4.5,new THREE.MeshStandardMaterial({color:0xbfc8b4,roughness:.8}),0,2.6,0));
 g.add(box(12.4,0.4,4.9,M.metal,0,4.5,0));
 for(const x of[-5,0,5])for(const z of[-1.6,1.6])g.add(box(.5,.9,.5,M.metal,x,0.45,z));
 g.add(box(1.4,2,0.2,new THREE.MeshStandardMaterial({color:0x555}),-3,2,2.3));
 // gapped skirting (keeps the on-blocks crawlspace readable)
 const skirtMat=new THREE.MeshStandardMaterial({color:0x9a9186,roughness:.9});
 if(TEX.siding){skirtMat.map=texTile('siding',2,1);skirtMat.needsUpdate=true;}
 for(const zs of[-2.25,2.25])for(const xs of[-4.3,-1.5,1.5,4.3])
   g.add(box(2.0,0.55,0.12,skirtMat,xs,0.4,zs,false));
 // windows along the long south face
 for(const wx of[-0.5,2,4.5])g.add(box(1.1,1.0,0.15,M.glass,wx,2.9,2.28,false));
 // slanted awning over the door
 const awning=box(1.9,0.12,1.1,new THREE.MeshStandardMaterial({color:0x6a3b3b,roughness:.8}),-3,3.35,3.0,false);
 awning.rotation.x=-0.25;g.add(awning);
 g.position.set(38,0,-22);scene.add(g);addColRect(38,-22,6.2,2.5);addHide('the mobile home',38,-22,g,5.5);}
// deck
{const g=new THREE.Group();
 const plankMat=new THREE.MeshStandardMaterial({color:0x9c7b52,roughness:.9});
 if(TEX.plank){plankMat.map=texTile('plank',4,3);}
 if(TEX.plankBump){plankMat.bumpMap=texTile('plankBump',4,3);plankMat.bumpScale=0.2;}
 g.add(box(9,0.35,6,plankMat,0,1,0));
 for(const x of[-4,4])for(const z of[-2.5,2.5])g.add(box(.35,1,.35,plankMat,x,.5,z));
 for(let i=-4;i<=4;i+=1.6)g.add(box(.15,1,.15,plankMat,i,1.6,2.9));
 g.add(box(9,.12,.15,plankMat,0,2.1,2.9));
 g.position.set(-26,0,-18);scene.add(g);addHide('the deck',-26,-18,g,4.5);}
// rusty old car (openable doors, tool inside)
const carDoors=[];
{const g=new THREE.Group();
 const carRustMat=new THREE.MeshStandardMaterial({color:0x8a4a2b,roughness:.85,metalness:.3});
 if(TEX.rust){carRustMat.map=texTile('rust',2,1.5);}
 g.add(box(4.6,1.1,2,carRustMat,0,0.95,0));
 g.add(box(2.6,0.95,1.9,carRustMat,-0.2,1.95,0));
 g.add(box(2.4,0.8,1.8,M.glass,-0.2,1.95,0));
 [[-2,-1],[-2,1],[2,-1],[2,1]].forEach(([x,z])=>{const w=cyl(.42,.42,.3,new THREE.MeshStandardMaterial({color:0x222}));w.rotation.x=Math.PI/2;w.position.set(x,0.42,z*1.05);g.add(w);});
 const door=box(1.7,1.0,0.12,carRustMat,0,0,0);
 const hinge=new THREE.Group();hinge.position.set(-1.2,1.0,1.02);hinge.add(door);door.position.set(0.85,0,0);
 g.add(hinge);
 // two-tone rust patches on the body
 const rustDark=new THREE.MeshStandardMaterial({color:0x3a1a10,roughness:1});
 [[1.4,0.7,-1.01,0],[1.6,1.4,1.0,Math.PI],[-1.8,0.6,1.0,Math.PI],[0.3,1.3,-1.0,0]].forEach(([x,y,z,ry])=>{
   const patch=box(rand(.4,.7),rand(.3,.5),0.04,rustDark,x,y,z,false);patch.rotation.y=ry;g.add(patch);});
 // cracked windshield overlay
 const crackMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.6});
 [[-0.6,-0.3],[0.4,0.5],[0.1,-0.6]].forEach(([ox,rz])=>{
   const crack=box(1.0,0.035,0.03,crackMat,-0.2+ox,1.95,0.86,false);crack.rotation.y=rz;g.add(crack);});
 g.position.set(30,0,12);g.rotation.y=-0.5;scene.add(g);addColRect(30,12,2.5,1.3,-0.5); // fitted: rusty car
 addHide('the rusty car',30,12,g,3.4);
 carDoors.push({hinge,open:false,group:g,label:'car door',contains:'lasso'});}
// boat on trailer
{const g=new THREE.Group();
 const hull=box(2.4,1.3,7,new THREE.MeshStandardMaterial({color:0x2e5f8a,roughness:.6}),0,1.6,0);g.add(hull);
 g.add(box(2.5,0.25,7.2,M.white,0,2.3,0));
 g.add(box(2,0.3,7.4,M.rust,0,0.75,0));
 [[-1,-2],[1,-2]].forEach(([x,z])=>{const w=cyl(.4,.4,.28,new THREE.MeshStandardMaterial({color:0x222}));w.rotation.z=Math.PI/2;w.position.set(x,.42,z);g.add(w);});
 // outboard motor at the stern
 const motorMat=new THREE.MeshStandardMaterial({color:0x1e1e22,roughness:.5,metalness:.4});
 g.add(box(0.55,0.9,0.4,motorMat,0,1.5,-3.55,false));
 const propShaft=cyl(0.08,0.08,0.9,M.metal,0,0.7,-3.65,6);propShaft.rotation.x=0.25;propShaft.castShadow=false;g.add(propShaft);
 // registration stripe along the hull
 g.add(box(0.06,0.3,6,M.hivis,1.23,1.6,0,false));
 g.position.set(48,0,2);g.rotation.y=0.9;scene.add(g);addColRect(48,2,1.5,3.8,0.9);addHide('the boat',48,2,g,3.6);}
// shed (openable door, tool inside)
const shedDoor={open:false,contains:'shovel'};
{const g=new THREE.Group();
 const shedWallMat=new THREE.MeshStandardMaterial({color:0x8c8375,roughness:.9});
 if(TEX.shedWood){shedWallMat.map=texTile('shedWood',3,2);}
 g.add(box(5,3.4,4,shedWallMat,0,1.7,0));
 g.add(new THREE.Mesh(new THREE.ConeGeometry(3.9,1.6,4),new THREE.MeshStandardMaterial({color:0x5a4a3a})).translateY(4.1));
 g.children[1].rotation.y=Math.PI/4;g.children[1].castShadow=true;
 const door=box(1.6,2.6,0.12,M.wood,0,0,0);
 const hinge=new THREE.Group();hinge.position.set(-0.8,1.4,2.02);door.position.set(0.8,0,0);hinge.add(door);g.add(hinge);
 // interior shelf clutter
 const shelfMat=new THREE.MeshStandardMaterial({color:0x6b5238,roughness:.9});
 g.add(box(4.2,0.08,0.5,shelfMat,0,1.3,-1.7,false));
 g.add(box(4.2,0.08,0.5,shelfMat,0,2.2,-1.7,false));
 const canMats=[new THREE.MeshStandardMaterial({color:0xb03030,roughness:.6}),new THREE.MeshStandardMaterial({color:0x3060b0,roughness:.6}),M.metal];
 [[-1.4,1.3],[0,1.3],[1.5,2.2],[-0.8,2.2]].forEach(([x,y],i)=>{
   const can=cyl(0.13,0.13,0.32,canMats[i%canMats.length],x,y+0.2,-1.7,8);can.castShadow=false;g.add(can);});
 g.position.set(-46,0,16);scene.add(g);addColRect(-46,16,2.7,2.2); // fitted: shed
 shedDoor.hinge=hinge;shedDoor.group=g;shedDoor.label='shed door';}

/* ----- dog run ----- */
const dogRun={x:-30,z:34,unlocked:false,released:false};
{const g=new THREE.Group();
 const fh=1.6;
 const mkChain=(w,h)=>{const m=new THREE.MeshStandardMaterial({color:0x777d84,roughness:.6,metalness:.5,transparent:true,alphaTest:0.35,side:THREE.DoubleSide});
   if(TEX.chainlink){m.map=texTile('chainlink',w,h);}return m;};
 const chainPanel=(w,h,x,y,z,ry)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mkChain(w,h));
   p.position.set(x,y,z);if(ry)p.rotation.y=ry;p.castShadow=false;p.receiveShadow=true;return p;};
 g.add(chainPanel(8,fh,0,fh/2,-2.5,0));
 g.add(chainPanel(8,fh,0,fh/2,2.5,0));
 g.add(chainPanel(5,fh,-4,fh/2,0,Math.PI/2));
 g.add(chainPanel(5,fh,4,fh/2,0,Math.PI/2));
 for(const x of[-4,0,4])for(const z of[-2.5,2.5])g.add(cyl(.06,.06,fh,M.metal,x,fh/2,z,6));
 const gate=chainPanel(1.6,1.5,0,0,0.8,0);
 const gh=new THREE.Group();gh.position.set(3.99,0.8,-0.8);gh.add(gate);g.add(gh);
 dogRun.gateHinge=gh;
 const lock=box(0.28,0.4,0.14,new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.8,roughness:.3}),4.05,0.9,0.05);
 g.add(lock);dogRun.lock=lock;
 g.add(box(1.8,1.2,1.4,M.wood,-2.8,0.6,0)); // dog house
 g.position.set(dogRun.x,0,dogRun.z);scene.add(g);dogRun.group=g;
 addCol(dogRun.x,dogRun.z,4.6);}

/* ----- bushes ----- */
const bushes=[];
const bushPos=[[-8,-8],[14,-14],[-20,4],[22,4],[-4,14],[16,18],[-16,-24],[8,-30]];
for(const[x,z]of bushPos){
  const g=new THREE.Group();
  for(let i=0;i<4;i++)g.add(sph(rand(.8,1.3),Math.random()<.5?M.bush:M.leaf2,rand(-.8,.8),rand(.5,1),rand(-.8,.8),7));
  const by=terrainH(x,z);g.position.set(x,by,z);scene.add(g);bushes.push({pos:V3(x,by,z),group:g,cats:[]});addCol(x,z,1.6);}

/* ----- mature trees ----- */
const trees=[];
const treePos=[[-14,-16],[4,-24],[20,-8],[-28,8],[10,6],[-6,24],[-34,-6],[26,-30]];
for(const[x,z]of treePos){
  const g=new THREE.Group();g.position.set(x,terrainH(x,z),z);
  g.rotation.y=rand(0,Math.PI*2);
  g.rotation.x=rand(-0.06,0.06);
  g.rotation.z=rand(-0.06,0.06);
  const broad=Math.random()<0.5;
  const H=broad?rand(9,12):rand(13,16);
  const botR=broad?rand(.85,1.0):rand(.6,.75);
  const topR=broad?0.45:0.35;
  const trunk=cyl(topR,botR,H,M.bark,0,H/2,0);g.add(trunk);
  // root flare (child of trunk so it falls with it, no floating)
  const flare=new THREE.Mesh(new THREE.ConeGeometry(botR*1.5,1.4,6),M.bark);
  flare.position.set(0,-H/2+0.5,0);flare.castShadow=true;flare.receiveShadow=true;trunk.add(flare);
  const limbs=[];
  const nL=broad?randi(4,6):randi(3,4);
  for(let i=0;i<nL;i++){
    const h=lerp(3.2,H-1.5,nL>1?i/(nL-1):0.5);
    const ang=rand(0,Math.PI*2)+i*2.1;
    const lg=new THREE.Group();lg.position.set(0,h,0);lg.rotation.y=ang;
    const brLen=broad?rand(2.6,3.4):rand(2.0,2.8);
    const br=cyl(0.14,0.24,brLen,M.bark);br.rotation.z=Math.PI/2.4;br.position.set(brLen*0.42,0.5,0);lg.add(br);
    const tipX=brLen*0.85,tipY=1.0;
    const lv1=sph(rand(1.0,1.5),Math.random()<.5?M.leaf:M.leaf2,tipX,tipY,rand(-.3,.3),8);lg.add(lv1);
    const lv2=sph(rand(1.0,1.4),Math.random()<.5?M.leaf:M.leaf2,tipX-0.6,tipY+0.4,rand(-.5,.5),8);lg.add(lv2);
    g.add(lg);limbs.push({group:lg,cut:false,h});
  }
  const top=sph(broad?rand(2.0,2.6):rand(1.6,2.0),M.leaf,0,H+0.6,0,9);g.add(top);
  const ex1=sph(rand(1.0,1.4),M.leaf2,rand(-1,1),rand(-0.6,0.2),rand(-1,1),8);top.add(ex1);
  const ex2=sph(rand(0.9,1.3),Math.random()<.5?M.leaf:M.leaf2,rand(-1,1),rand(-0.6,0.2),rand(-1,1),8);top.add(ex2);
  scene.add(g);addCol(x,z,1.2);
  trees.push({group:g,pos:V3(x,terrainH(x,z),z),H,trunk,limbs,top,topCut:false,state:'standing',fallT:0,cats:[]});
}

/* ----- split-rail fence along two lot edges ----- */
{const fenceEdge=(axis,fixed,a0,a1)=>{
  const n=Math.max(1,Math.round(Math.abs(a1-a0)/8));
  const pts=[];
  for(let i=0;i<=n;i++){
    const t=a0+(a1-a0)*(i/n);pts.push(t);
    if(axis==='x')scene.add(cyl(0.1,0.1,1.4,M.wood,t,0.7,fixed,6));
    else scene.add(cyl(0.1,0.1,1.4,M.wood,fixed,0.7,t,6));
  }
  for(let i=0;i<n;i++){
    const mid=(pts[i]+pts[i+1])/2,segLen=Math.abs(pts[i+1]-pts[i])-0.5;
    [0.5,0.95].forEach(h=>{
      if(axis==='x')scene.add(box(segLen,0.08,0.08,M.wood,mid,h,fixed,false));
      else scene.add(box(0.08,0.08,segLen,M.wood,fixed,h,mid,false));
    });
  }
 };
 fenceEdge('x',-64,-40,8);
 fenceEdge('z',64,-20,28);}

/* ----- mailbox near the driveway ----- */
{scene.add(cyl(0.05,0.06,1.1,M.wood,-13.5,0.55,60,6));
 const mbHeadMat=new THREE.MeshStandardMaterial({color:0xb7b9bb,roughness:.5,metalness:.3});
 scene.add(box(0.4,0.35,0.9,mbHeadMat,-13.5,1.15,60,false));
 const flagMat=new THREE.MeshStandardMaterial({color:0xcc2222,roughness:.6});
 scene.add(box(0.05,0.2,0.05,flagMat,-13.72,1.25,60.45,false));}

/* ----- bird bath near the house ----- */
{const bbMat=new THREE.MeshStandardMaterial({color:0x9a9a9a,roughness:.6});
 scene.add(cyl(0.18,0.28,1.0,bbMat,-34,0.5,-29,8));
 scene.add(cyl(0.9,0.75,0.28,bbMat,-34,1.14,-29,10));
 addCol(-34,-29,0.8);}

/* ----- clothesline in the backyard ----- */
// exposed for gameplay: sprint-through trip hazard (endpoints at the posts, y = wire height)
const clothesline={a:new THREE.Vector3(-20,2.15,-6),b:new THREE.Vector3(-14,2.15,-6),y:2.15};
{scene.add(cyl(0.08,0.08,2.2,M.wood,-20,1.1,-6,6));
 scene.add(cyl(0.08,0.08,2.2,M.wood,-14,1.1,-6,6));
 scene.add(box(6.02,0.05,0.05,new THREE.MeshStandardMaterial({color:0xd8d4c8,roughness:.8}),-17,2.15,-6,false));
 const clothMats=[M.hivis,M.denim,M.white,M.robe];
 [-19,-17.7,-16.3,-15].forEach((x,i)=>scene.add(box(0.5,0.55,0.05,clothMats[i%clothMats.length],x,1.85,-6,false)));}

/* ----- garden gnomes (props: origin at CENTER so gameplay can tumble them) ----- */
{const gnomeBodyMat=new THREE.MeshStandardMaterial({color:0x3d5fa0,roughness:.7});
 const gnomeHatMat=new THREE.MeshStandardMaterial({color:0xc0392b,roughness:.6});
 const halfH=0.5; // half of the gnome's ~1.0 total height (ground to hat tip)
 [[-37,-24.5],[-44.5,-19.5]].forEach(([x,z])=>{
   const g=new THREE.Group();
   g.add(sph(0.32,gnomeBodyMat,0,0.32-halfH,0,8));
   const hat=new THREE.Mesh(new THREE.ConeGeometry(0.24,0.5,8),gnomeHatMat);hat.position.y=0.75-halfH;hat.castShadow=true;g.add(hat);
   g.add(sph(0.1,M.skin,0,0.5-halfH,0.26,6));
   g.position.set(x,halfH,z);g.rotation.y=rand(0,Math.PI*2);scene.add(g);
   props.push({mesh:g,r:0.45,mass:1.2});
 });}

/* ----- rock clusters ----- */
{[[-20,20],[24,-4],[-8,-40]].forEach(([x,z])=>{
   for(let i=0;i<3;i++){
     const rk=sph(rand(.3,.6),Math.random()<.5?M.rust:M.metal,x+rand(-.6,.6),rand(.2,.35),z+rand(-.6,.6),6);
     rk.castShadow=false;scene.add(rk);
   }
 });}

/* ----- flower clusters ----- */
{const stemMat=new THREE.MeshStandardMaterial({color:0x3d6b2f,roughness:.9});
 const flowerMats=[new THREE.MeshStandardMaterial({color:0xe0507a}),new THREE.MeshStandardMaterial({color:0xe8c93a}),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5})];
 [[-10,-5],[6,-16],[-30,-2]].forEach(([x,z])=>{
   for(let i=0;i<5;i++){
     const fx=x+rand(-.9,.9),fz=z+rand(-.9,.9),h=rand(.3,.45);
     const stem=cyl(0.015,0.02,h,stemMat,fx,h/2,fz,4);stem.castShadow=false;scene.add(stem);
     scene.add(box(0.09,0.09,0.09,pick(flowerMats),fx,h+0.05,fz,false));
   }
 });}

/* ----- firewood logs near the shed (props) ----- */
{const firewoodMat=new THREE.MeshStandardMaterial({color:0x6b4a30,roughness:.95});
 [[-42,14],[-41,13.4],[-40,14.6]].forEach(([x,z])=>{
   const log=cyl(0.14,0.14,0.7,firewoodMat,0,0,0,8);
   log.rotation.z=Math.PI/2;log.rotation.y=rand(0,Math.PI*2);
   log.position.set(x,0.14,z);log.castShadow=true;scene.add(log);
   props.push({mesh:log,r:0.4,mass:0.8});
 });}

/* ----- watering can near the flowers (prop) ----- */
{const canBodyMat=new THREE.MeshStandardMaterial({color:0x4a7a4f,roughness:.55,metalness:.3});
 const g=new THREE.Group();
 const body=cyl(0.18,0.18,0.3,canBodyMat,0,0,0,8);g.add(body);
 const spout=cyl(0.035,0.05,0.5,canBodyMat,0.32,0.12,0,6);spout.rotation.z=Math.PI/2.6;g.add(spout);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.02,6,10,Math.PI),canBodyMat);
 handle.position.set(-0.05,0.2,0);handle.rotation.z=Math.PI/2;handle.castShadow=false;g.add(handle);
 g.position.set(-29,0.16,-3.5);g.rotation.y=rand(0,Math.PI*2);scene.add(g);
 props.push({mesh:g,r:0.3,mass:0.5});}

/* ----- pickups (tools in world) ----- */
const pickups=[]; // {name, mesh, taken, visible-when}
function makePickup(name,parent,x,y,z){
  let mesh;
  if(name==='lasso'){mesh=new THREE.Mesh(new THREE.TorusGeometry(.4,.07,8,16),M.tea);}
  else if(name==='shovel'){mesh=new THREE.Group();
    const s=cyl(.04,.04,1.4,M.wood);mesh.add(s);
    mesh.add(box(.4,.5,.05,M.metal,0,-0.9,0));}
  else{mesh=box(.2,.2,1,M.metal);}
  mesh.position.set(x,y,z);parent.add(mesh);
  const p={name,mesh,taken:false,worldPos:V3()};pickups.push(p);return p;}
const pkLasso=makePickup('lasso',carDoors[0].group,0.2,1.4,0);pkLasso.gated=carDoors[0];
const pkShovel=makePickup('shovel',shedDoor.group,0.6,1.2,0.8);pkShovel.gated=shedDoor;

/* ----- estate sign at the driveway mouth ----- */
{const signBoardMat=new THREE.MeshStandardMaterial({color:0xf7f2e8,roughness:.5});
 const signGoldMat=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.35,metalness:.7});
 const sx=-10,sz=58;
 scene.add(cyl(0.09,0.09,1.6,M.wood,sx-1.3,0.8,sz,8));
 scene.add(cyl(0.09,0.09,1.6,M.wood,sx+1.3,0.8,sz,8));
 scene.add(box(2.2,0.9,0.08,signBoardMat,sx,1.5,sz));
 scene.add(box(2.3,0.05,0.1,signGoldMat,sx,1.5+0.44,sz,false));
 scene.add(box(2.3,0.05,0.1,signGoldMat,sx,1.5-0.44,sz,false));
 addCol(sx,sz,0.9);}

/* ----- croquet set on the lawn ----- */
{const hoopMat=M.metal;
 const ballMat=new THREE.MeshStandardMaterial({color:0xd93a5c,roughness:.4});
 const stripeMat=new THREE.MeshStandardMaterial({color:0x2255cc,roughness:.5});
 const wicket=(x,z,ry)=>{
   const h=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.02,6,10),hoopMat);
   h.position.set(x,0.15,z);h.rotation.y=ry;h.castShadow=false;h.receiveShadow=false;
   scene.add(h);};
 wicket(5,11,0.3);wicket(9,16,-0.5);
 // mallets lying on the grass - Group origin at CENTER so gameplay can tumble them
 const mallet=(x,z,ry)=>{
   const g=new THREE.Group();
   const handle=cyl(0.025,0.025,0.85,M.wood,-0.21,0,0,6);handle.rotation.z=Math.PI/2;
   const head=cyl(0.06,0.06,0.24,M.wood,0.21,0,0,8);head.rotation.z=Math.PI/2;
   const stripe=box(0.02,0.02,0.26,stripeMat,0.21,0.04,0,false);
   g.add(handle,head,stripe);
   g.position.set(x,0.06,z);g.rotation.y=ry; // children already rotated flat (cyl axis horizontal)
   scene.add(g);
   props.push({mesh:g,r:0.45,mass:0.8});};
 mallet(6,13,0.4);mallet(10,14,-0.6);
 // croquet ball - sphere origin is already its center
 const ball=sph(0.12,ballMat,7,0.12,12,8);ball.castShadow=true;scene.add(ball);
 props.push({mesh:ball,r:0.12,mass:0.3});}
// lift every prop onto the rolling terrain at its resting spot (one pass; gameplay physics keeps them there)
for(const p of props){p.mesh.position.y+=terrainH(p.mesh.position.x,p.mesh.position.z);}

/* ----- flagpole near the house ----- */
{const poleMat=M.metal;
 const finialMat=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.3,metalness:.7});
 const px=-30,pz=-34;
 scene.add(cyl(0.06,0.08,7,poleMat,px,3.5,pz,8));
 const finial=sph(0.12,finialMat,px,7.05,pz,8);finial.castShadow=false;scene.add(finial);
 scene.add(box(0.1,0.14,0.1,poleMat,px+0.1,1,pz,false));
 addCol(px,pz,0.5);}

/* ----- puddles (specular sun-catchers at low spots) ----- */
{const mkPuddle=(x,z,sx,sz)=>{
   const m=new THREE.MeshStandardMaterial({color:0x1a2430,roughness:0.05,metalness:0.6});
   if(TEX.puddleBump){m.bumpMap=TEX.puddleBump;m.bumpScale=0.02;}
   const p=new THREE.Mesh(new THREE.CircleGeometry(1,12),m);
   p.rotation.x=-Math.PI/2;p.position.set(x,terrainH(x,z)+0.03,z);p.scale.set(sx,sz,1);
   p.receiveShadow=true;scene.add(p);};
 mkPuddle(-10,40,2.2,3.4);  // on the driveway
 mkPuddle(-25,31,1.8,1.4);  // near the dog run
 mkPuddle(2,-12,2.6,1.9);   // on the grass
 mkPuddle(18,8,1.5,2.2);    // on the grass
}

/* ----- packed-soil crawlspace patches under the deck / mobile home / boat ----- */
{const mkSoil=(x,z,w,d)=>{
   const m=new THREE.MeshStandardMaterial({color:0x2a2018,roughness:1});
   if(TEX.soil){m.map=texTile('soil',Math.max(1,Math.round(w/2)),Math.max(1,Math.round(d/2)));}
   const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);
   p.rotation.x=-Math.PI/2;p.position.set(x,0.02,z);p.receiveShadow=true;scene.add(p);};
 mkSoil(-26,-18,9,6);    // under the deck
 mkSoil(38,-22,12,4.6);  // under the mobile home
 mkSoil(48,2,5.5,7.4);   // under the boat
}
