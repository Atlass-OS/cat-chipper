/* ---------------- world ---------------- */
const colliders=[]; // {x,z,r} push player out
function addCol(x,z,r){colliders.push({x,z,r});}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(320,320),M.grass);
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// dirt driveway
const drive=new THREE.Mesh(new THREE.PlaneGeometry(8,60),M.dirt);
drive.rotation.x=-Math.PI/2;drive.position.set(-10,0.02,32);drive.receiveShadow=true;scene.add(drive);
// scattered grass tufts + rocks for texture
for(let i=0;i<90;i++){
  const t=cyl(0.02,0.28,rand(.25,.6),Math.random()<.5?M.bush:M.leaf2,rand(-70,70),0.15,rand(-60,60),5);
  t.castShadow=false;scene.add(t);}
for(let i=0;i<14;i++){const r=sph(rand(.3,.8),M.metal,rand(-70,70),.15,rand(-60,60),6);r.material=M.rust;scene.add(r);}

/* ----- house (old lady's) ----- */
const house=new THREE.Group();
house.add(box(16,7,10,M.white,0,3.5,0));
const roof=new THREE.Mesh(new THREE.ConeGeometry(11.5,4,4),new THREE.MeshStandardMaterial({color:0x704438,roughness:.9}));
roof.position.y=9;roof.rotation.y=Math.PI/4;roof.castShadow=true;house.add(roof);
house.add(box(2.4,4.4,0.3,new THREE.MeshStandardMaterial({color:0x5a3a28}),3,2.2,5.05)); // door
house.add(box(3,2.2,0.2,M.glass,-3.5,4,5.05));
house.position.set(-42,0,-34);scene.add(house);addCol(-42,-34,11);
const ladyDoorPos=V3(-39,0,-28.6);
// porch + table for tea
scene.add(box(8,0.5,4,M.wood,-39,0.25,-26.4));
const teaTable=box(1.6,1,1.6,M.wood,-36.4,0.75,-26.2);scene.add(teaTable);

/* ----- wood chipper + truck ----- */
const chipperG=new THREE.Group();
const chBody=box(2.2,1.7,3.2,M.chipOrange,0,1.35,0);chipperG.add(chBody);
chipperG.add(box(2.4,0.35,3.4,M.metal,0,0.45,0));
[[-.9,-1.2],[.9,-1.2],[-.9,1.2],[.9,1.2]].forEach(([x,z])=>{
  const w=cyl(.42,.42,.3,new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.9}));
  w.rotation.z=Math.PI/2;w.position.set(x,0.42,z);chipperG.add(w);});
// intake funnel (back, -z)
const funnel=new THREE.Mesh(new THREE.CylinderGeometry(1.15,0.55,1.5,4,1,true),M.chipOrange);
funnel.rotation.x=-Math.PI/2.6;funnel.rotation.y=Math.PI/4;funnel.position.set(0,1.6,-2.35);
funnel.castShadow=true;chipperG.add(funnel);
const intakeGlow=new THREE.Mesh(new THREE.CircleGeometry(0.8,16),new THREE.MeshBasicMaterial({color:0x22ff55}));
intakeGlow.position.set(0,1.75,-2.7);intakeGlow.rotation.x=-Math.PI/2.6;chipperG.add(intakeGlow);
// outlet chute (front, +z, angled up)
const chute=cyl(0.42,0.42,2.6,M.chipOrange);chute.rotation.x=Math.PI/3.2;chute.position.set(0,2.7,1.9);chipperG.add(chute);
const chuteMouth=V3(0,3.4,3.0);
chipperG.position.set(4,0,26);chipperG.rotation.y=0.35;scene.add(chipperG);addCol(4,26,2.6);
chipperG.updateMatrixWorld(true);
// crew truck
const truck=new THREE.Group();
truck.add(box(2.6,1.5,4,new THREE.MeshStandardMaterial({color:0xdadde0,roughness:.5,metalness:.3}),0,1.15,0));
truck.add(box(2.5,1.2,1.8,new THREE.MeshStandardMaterial({color:0xdadde0,roughness:.4,metalness:.3}),0,2.35,-1));
truck.add(box(2.55,0.9,2.2,M.glass,0,2.2,-1).translateY(0.35));
[[-1.2,-1.4],[1.2,-1.4],[-1.2,1.4],[1.2,1.4]].forEach(([x,z])=>{
  const w=cyl(.5,.5,.35,new THREE.MeshStandardMaterial({color:0x141414}));w.rotation.z=Math.PI/2;w.position.set(x,.5,z);truck.add(w);});
truck.position.set(4,0,31.5);truck.rotation.y=0.35;scene.add(truck);addCol(4,31.5,2.8);
// chip pile under chute
const pile=new THREE.Mesh(new THREE.ConeGeometry(1.6,1.1,10),M.chipWood);
pile.castShadow=true;pile.receiveShadow=true;
const pilePos=chipperG.localToWorld(V3(0,0,4.6));pile.position.copy(pilePos);pile.position.y=0.05;pile.scale.set(.25,.25,.25);scene.add(pile);
const gooStain=new THREE.Mesh(new THREE.CircleGeometry(1,16),new THREE.MeshStandardMaterial({color:0x8e0c0c,roughness:.4,transparent:true,opacity:0}));
gooStain.rotation.x=-Math.PI/2;gooStain.position.copy(pilePos);gooStain.position.y=0.03;scene.add(gooStain);
const chipper={engineOn:false,queue:0,procT:0,busy:false,gooT:0,pileS:0.25,
  intake:chipperG.localToWorld(V3(0,1.8,-2.8)),
  catReady(){return this.engineOn&&!this.busy&&!game.over;}};

/* ----- hide structures ----- */
const hideSpots=[];
function addHide(name,x,z,mesh,r=3){const h={name,pos:V3(x,0,z),r,cats:[],mesh};hideSpots.push(h);return h;}
// mobile home (on blocks, gap under)
{const g=new THREE.Group();
 g.add(box(12,3.4,4.5,new THREE.MeshStandardMaterial({color:0xbfc8b4,roughness:.8}),0,2.6,0));
 g.add(box(12.4,0.4,4.9,M.metal,0,4.5,0));
 for(const x of[-5,0,5])for(const z of[-1.6,1.6])g.add(box(.5,.9,.5,M.metal,x,0.45,z));
 g.add(box(1.4,2,0.2,new THREE.MeshStandardMaterial({color:0x555}),-3,2,2.3));
 g.position.set(38,0,-22);scene.add(g);addCol(38,-22,7);addHide('the mobile home',38,-22,g,5.5);}
// deck
{const g=new THREE.Group();
 g.add(box(9,0.35,6,M.wood,0,1,0));
 for(const x of[-4,4])for(const z of[-2.5,2.5])g.add(box(.35,1,.35,M.wood,x,.5,z));
 for(let i=-4;i<=4;i+=1.6)g.add(box(.15,1,.15,M.wood,i,1.6,2.9));
 g.add(box(9,.12,.15,M.wood,0,2.1,2.9));
 g.position.set(-26,0,-18);scene.add(g);addHide('the deck',-26,-18,g,4.5);}
// rusty old car (openable doors, tool inside)
const carDoors=[];
{const g=new THREE.Group();
 g.add(box(4.6,1.1,2,M.rust,0,0.95,0));
 g.add(box(2.6,0.95,1.9,M.rust,-0.2,1.95,0));
 g.add(box(2.4,0.8,1.8,M.glass,-0.2,1.95,0));
 [[-2,-1],[-2,1],[2,-1],[2,1]].forEach(([x,z])=>{const w=cyl(.42,.42,.3,new THREE.MeshStandardMaterial({color:0x222}));w.rotation.x=Math.PI/2;w.position.set(x,0.42,z*1.05);g.add(w);});
 const door=box(1.7,1.0,0.12,M.rust,0,0,0);
 const hinge=new THREE.Group();hinge.position.set(-1.2,1.0,1.02);hinge.add(door);door.position.set(0.85,0,0);
 g.add(hinge);
 g.position.set(30,0,12);g.rotation.y=-0.5;scene.add(g);addCol(30,12,3.4);
 addHide('the rusty car',30,12,g,3.4);
 carDoors.push({hinge,open:false,group:g,label:'car door',contains:'lasso'});}
// boat on trailer
{const g=new THREE.Group();
 const hull=box(2.4,1.3,7,new THREE.MeshStandardMaterial({color:0x2e5f8a,roughness:.6}),0,1.6,0);g.add(hull);
 g.add(box(2.5,0.25,7.2,M.white,0,2.3,0));
 g.add(box(2,0.3,7.4,M.rust,0,0.75,0));
 [[-1,-2],[1,-2]].forEach(([x,z])=>{const w=cyl(.4,.4,.28,new THREE.MeshStandardMaterial({color:0x222}));w.rotation.z=Math.PI/2;w.position.set(x,.42,z);g.add(w);});
 g.position.set(48,0,2);g.rotation.y=0.9;scene.add(g);addCol(48,2,3.6);addHide('the boat',48,2,g,3.6);}
// shed (openable door, tool inside)
const shedDoor={open:false,contains:'shovel'};
{const g=new THREE.Group();
 g.add(box(5,3.4,4,new THREE.MeshStandardMaterial({color:0x8c8375,roughness:.9}),0,1.7,0));
 g.add(new THREE.Mesh(new THREE.ConeGeometry(3.9,1.6,4),new THREE.MeshStandardMaterial({color:0x5a4a3a})).translateY(4.1));
 g.children[1].rotation.y=Math.PI/4;g.children[1].castShadow=true;
 const door=box(1.6,2.6,0.12,M.wood,0,0,0);
 const hinge=new THREE.Group();hinge.position.set(-0.8,1.4,2.02);door.position.set(0.8,0,0);hinge.add(door);g.add(hinge);
 g.position.set(-46,0,16);scene.add(g);addCol(-46,16,3.4);
 shedDoor.hinge=hinge;shedDoor.group=g;shedDoor.label='shed door';}

/* ----- dog run ----- */
const dogRun={x:-30,z:34,unlocked:false,released:false};
{const g=new THREE.Group();
 const fh=1.6;
 g.add(box(8,fh,.08,M.fence,0,fh/2,-2.5,false));
 g.add(box(8,fh,.08,M.fence,0,fh/2,2.5,false));
 g.add(box(.08,fh,5,M.fence,-4,fh/2,0,false));
 g.add(box(.08,fh,5,M.fence,4,fh/2,0,false));
 for(const x of[-4,0,4])for(const z of[-2.5,2.5])g.add(cyl(.06,.06,fh,M.metal,x,fh/2,z,6));
 const gate=box(1.6,1.5,0.1,M.fence,0,0,0,false);
 const gh=new THREE.Group();gh.position.set(3.99,0.8,-0.8);gate.position.set(0,0,0.8);gh.add(gate);g.add(gh);
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
  g.position.set(x,0,z);scene.add(g);bushes.push({pos:V3(x,0,z),group:g,cats:[]});addCol(x,z,1.6);}

/* ----- mature trees ----- */
const trees=[];
const treePos=[[-14,-16],[4,-24],[20,-8],[-28,8],[10,6],[-6,24]];
for(const[x,z]of treePos){
  const g=new THREE.Group();g.position.set(x,0,z);
  const H=rand(11,14);
  const trunk=cyl(0.55,0.85,H,M.bark,0,H/2,0);g.add(trunk);
  const limbs=[];
  const nL=randi(4,5);
  for(let i=0;i<nL;i++){
    const h=3.2+ (H-5.5)*(i/(nL-1));
    const ang=rand(0,Math.PI*2)+i*2.2;
    const lg=new THREE.Group();lg.position.set(0,h,0);lg.rotation.y=ang;
    const br=cyl(0.14,0.24,3.2,M.bark);br.rotation.z=Math.PI/2.4;br.position.set(1.35,0.5,0);lg.add(br);
    const lv=sph(rand(1.3,1.8),Math.random()<.5?M.leaf:M.leaf2,2.6,1.2,0,8);lg.add(lv);
    g.add(lg);limbs.push({group:lg,cut:false,h});
  }
  const top=sph(rand(1.8,2.4),M.leaf,0,H+0.6,0,9);g.add(top);
  scene.add(g);addCol(x,z,1.2);
  trees.push({group:g,pos:V3(x,0,z),H,trunk,limbs,top,topCut:false,state:'standing',fallT:0,cats:[]});
}

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

