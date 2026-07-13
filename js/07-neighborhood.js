/* ---------------- neighborhood: sky dome, parallax hills (CHUNK 1) ----------------
   Contract: exposes `skyEnv = {dome, hills:[FAR, NEAR]}`.
   updateMood (01-core) tints skyEnv.dome.material.color and each hill ring's
   material.color every frame (typeof-guarded). Loads LAST — after the render
   loop starts — but this top-level code still runs before the first frame.

   TEX (procedural CanvasTextures) is being filled asynchronously by another
   team, so EVERY TEX access is guarded with `|| null` — keys may not exist yet.
   No per-frame code is owned here; the mood system handles all live tinting. */

// ---------------------------------------------------------------------------
// 1) SKY DOME
// Big low-poly inside-out sphere. Unlit, no fog, no depth write.
// The camera far plane is 400 and the camera roams the lot (~±96 from the
// origin), so the far hemisphere of this radius-380 dome can exceed the far
// plane and clip. That is harmless: updateMood sets scene.background to the
// SAME bgC color as the dome material every frame, so any clipped region
// reveals an identical color — the seam is invisible. skyGrad is brightest at
// the horizon so it blends into the fog band; that is intended.
const domeGeo = new THREE.SphereGeometry(380, 16, 12);
const domeMat = new THREE.MeshBasicMaterial({
  map: TEX.skyGrad || null,
  color: 0xffffff,          // updateMood tints this to bgC live
  side: THREE.BackSide,     // render inside-out
  fog: false,               // dome ignores scene fog
  depthWrite: false
});
const dome = new THREE.Mesh(domeGeo, domeMat);
dome.castShadow = false;
dome.receiveShadow = false;
scene.add(dome);

// ---------------------------------------------------------------------------
// 2) PARALLAX HILLS
// Two concentric open-ended cylinder "silhouette rings" of forested ridges.
// Different radii => camera translation across the lot yields natural
// parallax. BackSide so the ridge strip texture faces inward toward the
// camera; alphaTest 0.3 clips the sky-transparent top of the RGBA strip so
// hilltops read as silhouettes. With no texture yet (null) it falls back to a
// solid tinted haze band — acceptable. fog:false keeps them crisp; the mood
// hook supplies their atmospheric tint. Each ring gets its OWN material so
// updateMood can tint them independently (i=0 far/foggier, i=1 near/darker).

// FAR ring: radius 330, height 60. base sits below ground (bottom ≈ -4.8),
// crest ≈ +55.  position.y = 60 * 0.42 ≈ 25.2
const farGeo = new THREE.CylinderGeometry(330, 330, 60, 32, 1, true);
const farMat = new THREE.MeshBasicMaterial({
  map: TEX.hillsFar || null,
  color: 0xffffff,
  side: THREE.BackSide,
  transparent: true,
  alphaTest: 0.3,
  fog: false,
  depthWrite: false
});
const farRing = new THREE.Mesh(farGeo, farMat);
farRing.position.y = 60 * 0.42; // ≈ 25.2
farRing.castShadow = false;
farRing.receiveShadow = false;
scene.add(farRing);

// NEAR ring: radius 270, height 46.  position.y = 46 * 0.42 ≈ 19.32
const nearGeo = new THREE.CylinderGeometry(270, 270, 46, 32, 1, true);
const nearMat = new THREE.MeshBasicMaterial({
  map: TEX.hillsNear || null,
  color: 0xffffff,
  side: THREE.BackSide,
  transparent: true,
  alphaTest: 0.3,
  fog: false,
  depthWrite: false
});
const nearRing = new THREE.Mesh(nearGeo, nearMat);
nearRing.position.y = 46 * 0.42; // ≈ 19.32
nearRing.castShadow = false;
nearRing.receiveShadow = false;
scene.add(nearRing);

// ---------------------------------------------------------------------------
// Contract global consumed by 01-core.js updateMood(dt).
// hills order MUST be [FAR, NEAR] (index 0 = far/foggier, 1 = near/darker).
const skyEnv = { dome, hills: [] };
skyEnv.hills.push(farRing, nearRing);

/* ---------------- neighborhood: road (CHUNK 2) ---------------- */
{
  // 1) ASPHALT STRIP — spans x -80..80, width 7 (z 64.5..71.5), centered z=68.
  const asphaltMat = new THREE.MeshStandardMaterial({ map: TEX.asphalt || null, color: 0x3a3d42, roughness: 0.95 });
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(160, 7), asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0.01, 68);
  asphalt.receiveShadow = true;
  asphalt.castShadow = false;
  scene.add(asphalt);

  // 2) DASHED YELLOW CENTERLINE — dashes share paintMat, on z=68.
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xd9c020, roughness: 0.6, emissive: 0x2a2600 });
  for (let x = -78; x <= 78; x += 6) {
    scene.add(box(2.2, 0.02, 0.18, paintMat, x, 0.03, 68, false));
  }

  // 3) GRAVEL SHOULDERS — south center z=65 (63.5..66.5), north center z=71 (69.5..72.5).
  const gravelMat = new THREE.MeshStandardMaterial({ map: TEX.dirt || null, color: 0x8a7f6a, roughness: 1 });
  const shoulderGeo = new THREE.PlaneGeometry(160, 3);
  const southShoulder = new THREE.Mesh(shoulderGeo, gravelMat);
  southShoulder.rotation.x = -Math.PI / 2;
  southShoulder.position.set(0, 0.005, 65);
  southShoulder.receiveShadow = true;
  southShoulder.castShadow = false;
  scene.add(southShoulder);
  const northShoulder = new THREE.Mesh(shoulderGeo, gravelMat);
  northShoulder.rotation.x = -Math.PI / 2;
  northShoulder.position.set(0, 0.005, 71);
  northShoulder.receiveShadow = true;
  northShoulder.castShadow = false;
  scene.add(northShoulder);

  // 4) CULVERT / DITCH HINT where the driveway (x=-10) meets the road's south edge.
  const culvertMat = new THREE.MeshStandardMaterial({ color: 0x44474b, roughness: 0.9, metalness: 0.3 });
  const culvert = cyl(0.35, 0.35, 4, culvertMat, -10, 0.3, 64.5, 10);
  culvert.rotation.z = Math.PI / 2; // axis along x
  culvert.castShadow = false;
  scene.add(culvert);
  // subtle ditch patches flanking the culvert mouth
  scene.add(box(3, 0.05, 1.2, gravelMat, -13, 0.02, 64.2, false));
  scene.add(box(3, 0.05, 1.2, gravelMat, -7, 0.02, 64.2, false));
}

/* ---------------- neighborhood: houses, yards, cars, poles (CHUNK 3) ---------------- */
{
  // Backdrop across the street (z >= 72). EVERYTHING here is flat (no shadows):
  // it sits outside the shadow camera range, so we strip the receiveShadow the
  // box/cyl/sph helpers set internally, plus castShadow, via flat().
  const flat = m => { m.castShadow = false; m.receiveShadow = false; return m; };

  // ---- shared local materials (NOT added to shared M) ----
  const windowMat   = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.4, metalness: 0.3 });
  const doorMat     = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.8 });
  const roofMat     = new THREE.MeshStandardMaterial({ map: TEX.shingle || null, color: 0x6b5648, roughness: 0.9 });
  const trimMat     = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 });
  const grassMat    = new THREE.MeshStandardMaterial({ map: TEX.grass || null, color: 0x5e7a3a, roughness: 1 });
  const drivewayMat = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.95 });
  const garageMat   = new THREE.MeshStandardMaterial({ color: 0xd7d3c8, roughness: 0.8 });
  const chimneyMat  = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.95 });
  const sidingMat   = tint => new THREE.MeshStandardMaterial({ map: TEX.siding || null, color: tint, roughness: 0.85 });

  // ---- HOUSE FACTORY ----
  // Builds a house Group at (x,0,z) plus its front yard (grass + driveway),
  // adds it to the scene, and registers a body collider. The road/camera lie at
  // LOWER z than the houses, so the "front" face that reads toward the player is
  // the -z face; windows/doors sit proud of that face and yards extend toward
  // the road (down to z~72).
  function makeHouse(x, z, o) {
    const g = new THREE.Group();
    const w = o.w, h = o.h, d = o.d;
    const smat = sidingMat(o.tint);

    // body
    g.add(flat(box(w, h, d, smat, 0, h / 2, 0, false)));

    // hip/pyramid roof (4-sided cone rotated 45° to square up to the footprint)
    const roofR = Math.max(w, d) * 0.72;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofR, o.roofH, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = h + o.roofH / 2;
    g.add(flat(roof));

    // front face plane (local -z), windows sit ~0.1 proud toward the road
    const fz = -d / 2;

    // windows: o.windows = [[localX, localY], ...]
    (o.windows || []).forEach(wv => {
      g.add(flat(box(1.2, 1.15, 0.1, windowMat, wv[0], wv[1], fz - 0.06, false)));
    });

    // door
    g.add(flat(box(1.1, 2.2, 0.12, doorMat, o.doorX || 0, 1.1, fz - 0.02, false)));

    // thin eave hint (trim) along the front top
    g.add(flat(box(w + 0.4, 0.18, 0.4, trimMat, 0, h + 0.05, fz - 0.1, false)));

    // optional attached garage door (rancher)
    if (o.garage) {
      g.add(flat(box(3.4, 2.9, 0.14, garageMat, o.garage[0], 1.45, fz - 0.03, false)));
    }

    // optional porch (bungalow): thin slab + 2 posts
    if (o.porch) {
      g.add(flat(box(w * 0.55, 0.2, 2.2, trimMat, 0, 0.12, fz - 1.1, false)));
      g.add(flat(box(0.25, 2.4, 0.25, trimMat, -w * 0.22, 1.2, fz - 2.0, false)));
      g.add(flat(box(0.25, 2.4, 0.25, trimMat,  w * 0.22, 1.2, fz - 2.0, false)));
    }

    // optional chimney (cottage): box poking up through the roof
    if (o.chimney) {
      g.add(flat(box(0.8, h * 0.9 + o.roofH, 0.8, chimneyMat, o.chimney, h / 2 + 0.5, 0.4, false)));
    }

    // ---- driveway: 3 wide, from the house front down to the road shoulder (~z72) ----
    const sign = o.drive || -1;
    const dwFrontZ = z - d / 2;      // world z at house front
    const dwEndZ = 72;               // world z at road shoulder (keeps yard at z>=72)
    const dwLen = dwFrontZ - dwEndZ; // >0

    // ---- front yard: grass patch filling house-front -> road (near edge at z=72) ----
    if (dwLen > 0) {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, dwLen), grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, 0.006, (( -d / 2) + (dwEndZ - z)) / 2);
      g.add(flat(grass));
    }

    if (dwLen > 0) {
      const dw = new THREE.Mesh(new THREE.PlaneGeometry(3, dwLen), drivewayMat);
      dw.rotation.x = -Math.PI / 2;
      // local coords (group is at world z): center between front and end
      dw.position.set(sign * (w / 2 - 1), 0.008, (( -d / 2) + (dwEndZ - z)) / 2);
      g.add(flat(dw));
    }

    g.position.set(x, 0, z);
    scene.add(g);
    addCol(x, z, o.colR || 6);
  }

  // 1) BUNGALOW (sage) — single story, low roof, porch, 3 windows + centered door
  makeHouse(-46, 82, {
    w: 10, h: 4.5, d: 8, tint: 0x9ab0a0, roofH: 2.2, colR: 6, drive: -1,
    doorX: 0, porch: true,
    windows: [[-4, 2.4], [4, 2.4], [0, 3.4]]
  });

  // 2) TWO-STORY (tan) — steeper roof, 2 up + 2 down windows + door
  makeHouse(-14, 88, {
    w: 9, h: 8, d: 8, tint: 0xc9a074, roofH: 2.8, colR: 5.5, drive: 1,
    doorX: 0,
    windows: [[-2.7, 2.2], [2.7, 2.2], [-2.7, 5.6], [2.7, 5.6]]
  });

  // 3) RANCHER (brick red) — long & low, 4 windows in a row + door + garage
  makeHouse(20, 80, {
    w: 14, h: 4, d: 8, tint: 0xb85c4a, roofH: 1.4, colR: 8, drive: 1,
    doorX: -6.2, garage: [4.6],
    windows: [[-4.5, 2.3], [-2.5, 2.3], [-0.5, 2.3], [1.5, 2.3]]
  });

  // 4) COTTAGE (cream) — compact, pointier roof, 2 windows + door + chimney
  makeHouse(52, 86, {
    w: 8, h: 5, d: 7, tint: 0xd8d2c0, roofH: 3.2, colR: 5, drive: -1,
    doorX: 0, chimney: 2.4,
    windows: [[-2.6, 2.6], [2.6, 2.6]]
  });

  // ---- PARKED CARS (2, on driveways) ----
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 });
  function makeCar(x, z, ry, bodyColor) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.4 });
    g.add(flat(box(4.4, 1.1, 1.9, bodyMat, 0, 0.9, 0, false)));       // body (length along x)
    g.add(flat(box(2.4, 0.9, 1.8, bodyMat, -0.2, 1.7, 0, false)));    // cabin
    const wy = 0.4;
    [[-1.5, 0.8], [-1.5, -0.8], [1.5, 0.8], [1.5, -0.8]].forEach(p => {
      const wheel = cyl(0.4, 0.4, 0.3, wheelMat, p[0], wy, p[1], 8);
      wheel.rotation.x = Math.PI / 2; // axis along z, wheels face outward on x/z
      g.add(flat(wheel));
    });
    g.rotation.y = ry;
    g.position.set(x, 0, z);
    scene.add(g);
    addCol(x, z, 2.6);
  }
  makeCar(26, 76, 0, 0x556070);      // rancher driveway
  makeCar(-10.5, 79, 0, 0x704040);   // two-story driveway

  // ---- MAILBOXES (one near each driveway, far road shoulder z=72.5) ----
  const mailMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.7, metalness: 0.3 });
  function makeMailbox(x) {
    scene.add(flat(cyl(0.08, 0.08, 1.2, mailMat, x, 0.6, 72.5, 6)));
    scene.add(flat(box(0.7, 0.4, 0.35, mailMat, x, 1.25, 72.5, false)));
  }
  makeMailbox(-50);  // bungalow
  makeMailbox(-10.5); // two-story
  makeMailbox(26);   // rancher
  makeMailbox(49);   // cottage

  // ---- POWER POLES + SAGGING LINES (far side of road, z=74) ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.95 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  function makePole(x) {
    scene.add(flat(cyl(0.15, 0.2, 9, poleMat, x, 4.5, 74, 6)));      // trunk (~9 tall)
    scene.add(flat(box(2.2, 0.15, 0.15, poleMat, x, 8, 74, false))); // crossarm near top
  }
  const poleXs = [-60, -30, 0, 30, 60];
  poleXs.forEach(makePole);

  // catenary sag: 2 tilted boxes per gap (attach y~8 at poles, sag to y~7 mid)
  function wireSeg(x1, y1, x2, y2) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = flat(box(len, 0.05, 0.05, wireMat, (x1 + x2) / 2, (y1 + y2) / 2, 74, false));
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    scene.add(m);
  }
  for (let i = 0; i < poleXs.length - 1; i++) {
    const a = poleXs[i], b = poleXs[i + 1], mid = (a + b) / 2;
    wireSeg(a, 8, mid, 7);
    wireSeg(mid, 7, b, 8);
  }
}
