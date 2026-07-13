/* ---------------- characters ---------------- */
const gloveMat=new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.85});
const bootMat=new THREE.MeshStandardMaterial({color:0x2a2018,roughness:.8});
// country-club polish: alternating polo collars on the crew
const poloMat1=new THREE.MeshStandardMaterial({color:0xf4b6c2,roughness:.6}); // pastel pink
const poloMat2=new THREE.MeshStandardMaterial({color:0x9fe0c7,roughness:.6}); // mint
let personCount=0;
// varied skin tones per person (fresh material each — gameplay clones/tints heads for the anger tell)
const SKINTONES=[0xf1c9a5,0xc98e63,0xa9713f,0x8a5a33,0x5c3a21];
function makePerson(shirtMat,helmet,pantsMat=M.denim,shoeMat=bootMat){
  const g=new THREE.Group();
  g.add(box(.7,.9,.4,shirtMat,0,1.25,0));
  g.add(box(.6,.8,.35,pantsMat,0,0.45,0));
  const skinMat=new THREE.MeshStandardMaterial({color:pick(SKINTONES),roughness:.8});
  const head=sph(.26,skinMat,0,1.95,0,8);g.add(head);
  if(helmet)g.add(sph(.29,M.helmet,0,2.02,0,8));
  // gloves
  g.add(box(.14,.14,.14,gloveMat,.45,1.2,0));
  g.add(box(.14,.14,.14,gloveMat,-.45,1.2,0));
  // boots
  g.add(box(.28,.12,.42,shoeMat,.16,.06,.02));
  g.add(box(.28,.12,.42,shoeMat,-.16,.06,.02));
  // polo collar peeking above the vest
  const collarMat=(personCount++%2)?poloMat2:poloMat1;
  g.add(box(.5,.08,.38,collarMat,0,1.72,0,false));
  g.traverse(o=>{o.castShadow=true;});
  return g;}
// crew: 1 arborist + 2 groundies
const arborist={mesh:makePerson(M.hivis,true),state:'walk',climbH:0,tree:null,t:0};
scene.add(arborist.mesh);arborist.mesh.position.set(2,0,29);
// climbing gear
const harnessMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.7});
const ropeMat=new THREE.MeshStandardMaterial({color:0x9c7a3c,roughness:.9});
const holsterMat=new THREE.MeshStandardMaterial({color:0x33291f,roughness:.8});
arborist.mesh.add(box(.74,.12,.44,harnessMat,0,1.0,0)); // waist harness
const rope=new THREE.Mesh(new THREE.TorusGeometry(.13,.045,6,10),ropeMat);
rope.rotation.x=Math.PI/2;rope.position.set(-.32,.98,.12);rope.castShadow=true;
arborist.mesh.add(rope);
arborist.mesh.add(box(.3,.42,.16,holsterMat,-.45,1.05,.15)); // chainsaw holster (opposite side from saw)
const groundies=[];
const earmuffMat=new THREE.MeshStandardMaterial({color:0x222222,roughness:.6});
// Tanner (groundie 0): khaki pants + boat shoes instead of denim/boots
const khakiMat=new THREE.MeshStandardMaterial({color:0xc3b091,roughness:.8});
const boatShoeMat=new THREE.MeshStandardMaterial({color:0xc68642,roughness:.7});
for(let i=0;i<2;i++){
  const gm={mesh:i===0?makePerson(M.hivis,true,khakiMat,boatShoeMat):makePerson(M.hivis,true),state:'idle',t:rand(0,2),carry:null,seat:V3(6+i*1.5,0,30.5)};
  gm.mesh.add(sph(.09,earmuffMat,.29,1.95,0,6));
  gm.mesh.add(sph(.09,earmuffMat,-.29,1.95,0,6));
  gm.mesh.position.set(5+i*2,0,29);scene.add(gm.mesh);groundies.push(gm);}
// chainsaw prop
const saw=new THREE.Group();saw.add(box(.5,.25,.2,M.chipOrange));saw.add(box(.7,.08,.04,M.metal,.55,0,0));
arborist.mesh.add(saw);saw.position.set(.45,1.2,.2);
// old lady
const lady={mesh:new THREE.Group(),state:'inside',t:rand(20,30),throwCat:null,teaReady:false};
lady.mesh.add(box(.8,1.1,.5,M.robe,0,1.15,0));
lady.mesh.add(box(.7,.6,.45,M.robe,0,0.35,0));
lady.mesh.add(sph(.24,M.skin,0,1.95,0,8));
lady.mesh.add(sph(.27,M.hair,0,2.08,0,8));
// hair curlers dotted around the hair sphere
const curlerMat=new THREE.MeshStandardMaterial({color:0xd6a4c7,roughness:.5});
for(let i=0;i<5;i++){
  const a=i/5*Math.PI*2;
  lady.mesh.add(sph(.05,curlerMat,Math.cos(a)*.22,2.14+Math.sin(a)*.05,Math.sin(a)*.22,6));
}
// slippers
const slipperMat=new THREE.MeshStandardMaterial({color:0xb03a3a,roughness:.8});
lady.mesh.add(box(.24,.1,.38,slipperMat,.15,.06,.06));
lady.mesh.add(box(.24,.1,.38,slipperMat,-.15,.06,.06));
// floral robe pattern
const flowerMats=[
  new THREE.MeshStandardMaterial({color:0xe8a0c0,roughness:.6}),
  new THREE.MeshStandardMaterial({color:0xf2d24a,roughness:.6}),
  new THREE.MeshStandardMaterial({color:0x8ec8e8,roughness:.6}),
];
for(let i=0;i<6;i++){
  const fm=flowerMats[i%flowerMats.length];
  lady.mesh.add(sph(.045,fm,rand(-.3,.3),rand(0.75,1.55),.24,6));
}
// monogram patch on the robe chest
const monogramMat=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.5,metalness:.6});
lady.mesh.add(box(.12,.12,.02,monogramMat,.16,1.55,.26,false));
// pearl necklace: shallow arc of small spheres at the neckline
for(let i=0;i<7;i++){
  const t=i/6;
  const nx=lerp(-.2,.2,t),ny=1.78-Math.sin(t*Math.PI)*.05;
  lady.mesh.add(sph(.03,M.white,nx,ny,.22,6));
}
lady.mesh.traverse(o=>o.castShadow=true);
lady.mesh.position.copy(ladyDoorPos);lady.mesh.visible=false;scene.add(lady.mesh);
// tea tray
const tray=new THREE.Group();
tray.add(box(1,.06,.6,M.metal,0,0,0));
for(let i=0;i<3;i++)tray.add(cyl(.08,.06,.22,M.tea,-0.3+i*0.3,0.14,0,8));
tray.visible=false;scene.add(tray);
const teaState={phase:'none',t:0,carried:false}; // none -> onTable -> carried -> served

/* ----- dogs ----- */
function makeDog(col){
  const g=new THREE.Group();
  g.add(box(.8,.4,.35,col,0,0.5,0));
  g.add(box(.3,.3,.28,col,0.5,0.72,0)); // head
  g.add(box(.16,.14,.16,col,0.7,0.66,0)); // snout
  const ear1=box(.06,.18,.13,col,0.6,0.88,0.15);ear1.rotation.z=-0.55;g.add(ear1);
  const ear2=box(.06,.18,.13,col,0.6,0.88,-0.15);ear2.rotation.z=-0.55;g.add(ear2);
  const tail=box(.08,.28,.08,col,-0.45,0.75,0);tail.rotation.x=-0.4;g.add(tail); // wagging tail
  for(const x of[-.25,.25])for(const z of[-.12,.12])g.add(box(.09,.35,.09,col,x,0.2,z));
  g.traverse(o=>o.castShadow=true);return g;}
const dogMat=new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:.9});
const dogMat2=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.9});
const dogMat3=new THREE.MeshStandardMaterial({color:0xc9963f,roughness:.9}); // golden retriever
const dogs=[];
function addDog(x,z,inPen,col){
  const d={mesh:makeDog(col||(dogs.length%2?dogMat2:dogMat)),state:inPen?'penned':'roam',target:null,t:rand(0,2),vel:V3()};
  d.mesh.position.set(x,0,z);scene.add(d.mesh);dogs.push(d);return d;}
addDog(dogRun.x-1,dogRun.z,true);addDog(dogRun.x+1,dogRun.z+1,true);

/* ----- cats ----- */
const CATCOLS=[0x2a2a2a,0xd98b2b,0xe8e4da,0x8a8a92,0xc77b4a,0x4a3a30];
const cats=[];
function makeCatMesh(){
  const col=new THREE.MeshStandardMaterial({color:pick(CATCOLS),roughness:.9});
  const g=new THREE.Group();
  g.add(box(.5,.26,.26,col,0,0.28,0));
  g.add(box(.24,.22,.24,col,0.33,0.42,0));
  const e1=new THREE.Mesh(new THREE.ConeGeometry(.06,.12,4),col);e1.position.set(.38,.58,.08);g.add(e1);
  const e2=e1.clone();e2.position.z=-.08;g.add(e2);
  const tail=cyl(.035,.05,.4,col);tail.rotation.z=-0.7;tail.position.set(-.35,.45,0);g.add(tail);
  // two-tone pattern on ~half the cats: cheap patch(es) in a contrasting color
  if(Math.random()<0.5){
    let patCol=pick(CATCOLS);
    if(patCol===col.color.getHex())patCol=0xf5f0e6;
    const patMat=new THREE.MeshStandardMaterial({color:patCol,roughness:.9});
    g.add(box(.2,.12,.2,patMat,0.28,0.3,0)); // chest/bib patch
  }
  g.traverse(o=>{o.castShadow=true;});
  // whiskers: very thin, no shadow cast (kept cheap for many instances)
  const wm=M.white;
  g.add(box(.16,.006,.006,wm,0.48,0.43,0.06,false));
  g.add(box(.16,.006,.006,wm,0.48,0.43,-0.06,false));
  g.scale.setScalar(rand(0.8,1.2));
  return g;}
function addCat(state,home){
  const c={mesh:makeCatMesh(),state,home,t:rand(0,3),vel:V3(),target:null,spot:null,stun:0,dead:false,meowT:rand(2,9)};
  scene.add(c.mesh);cats.push(c);return c;}
// populate: 2 per tree, 1 per few bushes, some walkers
for(const tr of trees)for(let i=0;i<2;i++){
  const limb=tr.limbs[randi(1,tr.limbs.length-1)];
  const c=addCat('tree',tr);c.limb=limb;tr.cats.push(c);
  c.mesh.position.copy(tr.pos).add(V3(rand(-1,1),limb.h+0.6,rand(-1,1)));
}
for(let i=0;i<5;i++){const b=bushes[i];const c=addCat('bush',b);b.cats.push(c);
  c.mesh.position.copy(b.pos).add(V3(rand(-.6,.6),0.05,rand(-.6,.6)));}
for(let i=0;i<4;i++){const c=addCat('walk',null);
  c.mesh.position.set(rand(-20,20),0,rand(-5,25));}
let totalCats=cats.length;

/* ----- sarah (athleisure suburban mom) ----- */
const sarahLeggingsMat=new THREE.MeshStandardMaterial({color:0xb8a6d9,roughness:.7}); // lavender
const sarahJacketMat=new THREE.MeshStandardMaterial({color:0xe8b4c8,roughness:.6}); // blush
const sarahHairMat=new THREE.MeshStandardMaterial({color:0x6b4a26,roughness:.7});
const sarahSneakerMat=new THREE.MeshStandardMaterial({color:0xf5f5f0,roughness:.5});
const sarahTumblerMat=new THREE.MeshStandardMaterial({color:0x2fb6a8,roughness:.4,metalness:.2}); // teal
const sarahStrawMat=new THREE.MeshStandardMaterial({color:0xf5f5f0,roughness:.6});
const sarahSkinMat=new THREE.MeshStandardMaterial({color:pick(SKINTONES),roughness:.8});
const sarah=new THREE.Group();
sarah.add(box(.68,.9,.38,sarahJacketMat,0,1.25,0)); // zip-up jacket torso
sarah.add(box(.5,.8,.3,sarahLeggingsMat,0,0.45,0)); // leggings
sarah.add(sph(.25,sarahSkinMat,0,1.95,0,8)); // head
sarah.add(sph(.27,sarahHairMat,0,2.06,0,8)); // hair
sarah.add(sph(.13,sarahHairMat,-.02,2.28,-.18,6)); // ponytail bun, high at the back
sarah.add(sph(.09,sarahHairMat,0,2.1,-.30,6)); // ponytail trailing down
sarah.add(box(.26,.12,.4,sarahSneakerMat,.16,.06,.02)); // sneaker
sarah.add(box(.26,.12,.4,sarahSneakerMat,-.16,.06,.02)); // sneaker
sarah.add(sph(.08,sarahSkinMat,.42,1.2,.02,6)); // hand
sarah.add(cyl(.09,.09,.3,sarahTumblerMat,.42,1.2,.1,8)); // insulated tumbler
sarah.traverse(o=>{o.castShadow=true;});
const sarahZipper=box(.04,.8,.04,M.metal,0,1.25,.2,false);sarah.add(sarahZipper); // zipper line
const sarahStraw=cyl(.015,.015,.2,sarahStrawMat,.42,1.45,.1,5);sarahStraw.rotation.z=.22;sarah.add(sarahStraw); // straw
sarahZipper.castShadow=false;sarahStraw.castShadow=false;
sarah.visible=false;scene.add(sarah);

/* ----- makeAgent (federal agent, no lettering) ----- */
const agentNavyMat=new THREE.MeshStandardMaterial({color:0x1c2a4a,roughness:.7});
const agentVestMat=new THREE.MeshStandardMaterial({color:0x14141a,roughness:.9});
const agentCapMat=new THREE.MeshStandardMaterial({color:0x0d0d12,roughness:.8});
const agentShadesMat=new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:.3});
function makeAgent(){
  const g=new THREE.Group();
  g.add(box(.7,.9,.4,agentNavyMat,0,1.25,0)); // dark navy polo torso
  g.add(box(.8,.7,.5,agentVestMat,0,1.3,0)); // oversized tactical vest over the polo
  g.add(box(.6,.8,.35,khakiMat,0,0.45,0)); // khaki slacks
  const agentSkinMat=new THREE.MeshStandardMaterial({color:pick(SKINTONES),roughness:.8});
  g.add(sph(.26,agentSkinMat,0,1.95,0,8)); // head
  g.add(cyl(.27,.28,.12,agentCapMat,0,2.12,0,8)); // cap
  g.add(box(.28,.12,.42,bootMat,.16,.06,.02)); // shoe
  g.add(box(.28,.12,.42,bootMat,-.16,.06,.02)); // shoe
  g.traverse(o=>{o.castShadow=true;});
  g.add(box(.3,.04,.18,agentCapMat,0,2.08,.2,false)); // cap brim
  g.add(box(.34,.07,.05,agentShadesMat,0,1.97,.22,false)); // sunglasses
  g.add(box(.12,.1,.05,agentVestMat,.22,1.15,.24,false)); // pouch
  g.add(box(.12,.1,.05,agentVestMat,-.22,1.15,.24,false)); // pouch
  return g;}

/* ----- protest picket line (cat-rights activists) ----- */
// shared bright tie-dye-ish shirt colors
const protShirtMats=[
  new THREE.MeshStandardMaterial({color:0xe84393,roughness:.7}), // magenta
  new THREE.MeshStandardMaterial({color:0x00b894,roughness:.7}), // teal
  new THREE.MeshStandardMaterial({color:0xfdcb6e,roughness:.7}), // amber
  new THREE.MeshStandardMaterial({color:0x6c5ce7,roughness:.7}), // purple
  new THREE.MeshStandardMaterial({color:0xd63031,roughness:.7}), // red
  new THREE.MeshStandardMaterial({color:0x55efc4,roughness:.7}), // mint
];
// shared hair colors
const protHairMats=[
  new THREE.MeshStandardMaterial({color:0x2b1b12,roughness:.8}), // dark brown
  new THREE.MeshStandardMaterial({color:0xd6b370,roughness:.8}), // blonde
  new THREE.MeshStandardMaterial({color:0xb0433a,roughness:.8}), // auburn
  new THREE.MeshStandardMaterial({color:0x555555,roughness:.8}), // grey
];
const protEarMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:.6}); // cat-ear headband cones
const protSneakerMat=new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.5}); // sneaker-ish alt to bootMat
const protPlainBoardMat=new THREE.MeshStandardMaterial({color:0xf5f2ea,roughness:.9}); // plain edges of the sign board (shared white)

// canvas texture helper for picket sign faces
function signTexture(draw){
  const cv=document.createElement('canvas');cv.width=256;cv.height=160;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#f5f2ea';ctx.fillRect(0,0,256,160);
  draw(ctx);
  const tx=new THREE.CanvasTexture(cv);
  return tx;
}
// wrap a slogan across a few short lines so big bold text still fits 256px wide
function signWrapLines(text,maxChars){
  const words=text.split(' ');
  const lines=[];let cur='';
  for(const w of words){
    const test=cur?cur+' '+w:w;
    if(test.length>maxChars&&cur){lines.push(cur);cur=w;}
    else cur=test;
  }
  if(cur)lines.push(cur);
  return lines;
}
function signDrawSlogan(ctx,text){
  ctx.fillStyle='#20242c';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 40px Arial';
  const lines=signWrapLines(text,12);
  const lineH=44;
  const startY=80-((lines.length-1)*lineH)/2;
  lines.forEach((ln,i)=>ctx.fillText(ln,128,startY+i*lineH));
}
const protSlogans=['SAVE THE STRAYS','CATS ARE FRIENDS NOT MULCH','THE CHIPPER LIES','MEOW MEANS NO'];
const signTextures=protSlogans.map(s=>signTexture(c=>signDrawSlogan(c,s)));
signTextures.push(signTexture(ctx=>{ // fifth variant: blank board with a red pawprint
  ctx.fillStyle='#c0392b';
  ctx.beginPath();ctx.arc(128,100,34,0,Math.PI*2);ctx.fill();
  const toes=[[-34,-38],[-13,-52],[13,-52],[34,-38]];
  for(const[dx,dy]of toes){ctx.beginPath();ctx.arc(128+dx,100+dy,13,0,Math.PI*2);ctx.fill();}
}));
// one shared textured material per texture (front/back faces of the board)
const signBoardMats=signTextures.map(tx=>new THREE.MeshStandardMaterial({map:tx,roughness:.9}));
let protSignIdx=0; // rotates through signBoardMats across successive protesters (not randomized)

function makeProtester(){
  const g=new THREE.Group();
  const shirtMat=pick(protShirtMats);
  g.add(box(.7,.9,.4,shirtMat,0,1.25,0)); // torso
  g.add(box(.6,.8,.35,M.denim,0,0.45,0)); // legs
  const skinMat=new THREE.MeshStandardMaterial({color:pick(SKINTONES),roughness:.8});
  const head=sph(.26,skinMat,0,1.95,0,8);g.add(head);
  const hairMat=pick(protHairMats);
  g.add(sph(.27,hairMat,0,2.04,0,8)); // hair skull-cap
  const shoeMat=Math.random()<0.5?bootMat:protSneakerMat;
  g.add(box(.28,.12,.42,shoeMat,.16,.06,.02));
  g.add(box(.28,.12,.42,shoeMat,-.16,.06,.02));
  if(Math.random()<0.35){ // cat-ear headband on ~1 in 3
    const ear1=new THREE.Mesh(new THREE.ConeGeometry(.07,.16,4),protEarMat);ear1.position.set(.12,2.22,0);g.add(ear1);
    const ear2=new THREE.Mesh(new THREE.ConeGeometry(.07,.16,4),protEarMat);ear2.position.set(-.12,2.22,0);g.add(ear2);
  }
  // picket sign: stick + board with a rotating slogan/pawprint texture
  g.add(cyl(.03,.03,1.6,M.wood,.38,1.3,.15));
  const boardMat=signBoardMats[protSignIdx%signBoardMats.length];protSignIdx++;
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.1,.7,.04),[protPlainBoardMat,protPlainBoardMat,protPlainBoardMat,protPlainBoardMat,boardMat,boardMat]);
  board.position.set(.38,2.35,.15);board.castShadow=true;
  g.add(board);
  g.traverse(o=>o.castShadow=true);
  return g;
}

const protesters=[];
const protSlots=[-18,-14.5,-6.5,-3.5,-2];
for(const sx of protSlots){
  const p=makeProtester();
  const x=sx+rand(-0.6,0.6);
  const z=rand(55,60);
  p.position.set(x,0,z);
  p.rotation.y=Math.PI+rand(-.3,.3); // face -z, into the lot
  p.visible=true;
  scene.add(p);
  protesters.push({mesh:p,phase:rand(0,Math.PI*2),t:0});
}

