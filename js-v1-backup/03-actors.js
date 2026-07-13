/* ---------------- characters ---------------- */
function makePerson(shirtMat,helmet){
  const g=new THREE.Group();
  g.add(box(.7,.9,.4,shirtMat,0,1.25,0));
  g.add(box(.6,.8,.35,M.denim,0,0.45,0));
  const head=sph(.26,M.skin,0,1.95,0,8);g.add(head);
  if(helmet)g.add(sph(.29,M.helmet,0,2.02,0,8));
  g.traverse(o=>{o.castShadow=true;});
  return g;}
// crew: 1 arborist + 2 groundies
const arborist={mesh:makePerson(M.hivis,true),state:'walk',climbH:0,tree:null,t:0};
scene.add(arborist.mesh);arborist.mesh.position.set(2,0,29);
const groundies=[];
for(let i=0;i<2;i++){
  const gm={mesh:makePerson(M.hivis,true),state:'idle',t:rand(0,2),carry:null,seat:V3(6+i*1.5,0,30.5)};
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
  g.add(box(.3,.3,.28,col,0.5,0.72,0));
  g.add(box(.08,.28,.08,col,-0.45,0.75,0)); // tail
  for(const x of[-.25,.25])for(const z of[-.12,.12])g.add(box(.09,.35,.09,col,x,0.2,z));
  g.traverse(o=>o.castShadow=true);return g;}
const dogMat=new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:.9});
const dogMat2=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.9});
const dogs=[];
function addDog(x,z,inPen){
  const d={mesh:makeDog(dogs.length%2?dogMat2:dogMat),state:inPen?'penned':'roam',target:null,t:rand(0,2),vel:V3()};
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
  g.traverse(o=>{o.castShadow=true;});
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

