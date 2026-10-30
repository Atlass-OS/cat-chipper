# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Cat Chipper** — a single-page 3D dark-comedy game (three.js). A tree crew fells the trees on an estate lot; stray cats scatter; the player yeets them into the wood chipper. No build step, no package.json, no framework — plain classic scripts.

## Running

```
node server.js                    # from repo root (port 8321), then open http://localhost:8321
```

`server.js` is the dev server: static files plus the SFX Lab API (`GET /api/clips`, `POST /api/upload`, `POST /api/labels` → writes `audio/labels.json`). `npx -y http-server -p 8321 -c-1` also serves the game but not the SFX Lab API. Must be served over HTTP (browser-extension/automation tooling can't drive `file://`). No tests; verification is `node --check js/*.js` for syntax plus loading the game in Chrome and watching the console.

**Publishing:** GitHub Pages serves `master:/` of `Atlass-OS/cat-chipper` at https://atlass-os.github.io/cat-chipper/ — publishing = commit + push `master` (Pages rebuilds in ~1 min). The site lives under a `/cat-chipper/` subpath, so every asset path must stay relative.

`sfx-lab.html` (http://localhost:8321/sfx-lab.html) is the tool for uploading MP3s and labelling clip segments into `audio/labels.json`.

## Architecture

`index.html` (HTML + all CSS + HUD elements) loads three.js **r128 UMD** from CDN (global `THREE` — no ES modules, no importmaps, no post-processing libs), then ten classic scripts **in order** (00 → 09). Top-level `const`/`let` in one script are visible to all later scripts (shared global lexical scope) — this is the entire module system. All cross-file references rely on load order: a later file may reference an earlier file's names at top level, and any file may reference any other's names inside function bodies (resolved at call time).

| File | Contents |
|---|---|
| `js/00-textures.js` | procedural texture library: `TEX` object of CanvasTextures drawn once at load (`TEX.mk(w,h,drawFn,opts)` helper) |
| `js/01-core.js` | utils (V3/rand/clamp/lerp/pick), **terrain** (`terrainRaw` analytic hills + flat zones; `terrainH` = the rendered ground surface, see contracts), renderer/scene/camera, **mood lighting rig** (MOODS presets, `moodTarget`, `updateMood(dt)` — called every frame, also applies `fxShake` camera shake), shared materials `M`, box/cyl/sph helpers |
| `js/02-world.js` | terrain, house, **chipper** (`chipper` object + `chipperG`; `chipper.intake` is computed after `chipperG.updateMatrixWorld(true)` — keep that ordering), truck, hide structures (`hideSpots`), openable doors (`carDoors`, `shedDoor`), `dogRun`, `bushes`, `trees`, `pickups`, `clothesline`, `colliders`/`addCol`, protest set dressing |
| `js/03-actors.js` | `makePerson`/`makeDog`/`makeCatMesh`/`makeAgent`/`makeProtester` factories, `arborist`, `groundies`, `lady`, `sarah`, `tray`/`teaState`, `dogs`/`addDog(x,z,inPen,col?)`, `cats`/`addCat`, `totalCats`, `SKINTONES`, `protesters` |
| `js/04-fx-audio.js` | particle pool (bounded ~400: `spawnPart`, `chipBurst`, `poof`, `updateParts`) and the WebAudio synth, plus async HD-sample loading from `audio/labels.json` + `audio/*.mp3` (the synth is the fallback — missing/404 samples are expected and must stay non-fatal): `initAudio`, `blip`, `meow`, `bark`, `chipSound`, `grind`, `hornSound`, `sirenStart/Stop`, `scratchSound`, `yelp`, `crackSound`, `thudSound`, `heartbeat(on)` |
| `js/05-gameplay.js` | the big one: `game` state object, `msg()`/`banner()`, player input (LMB-first controls; E = world interactions), interaction prompts (`computePrompt`/`promptText`), all AI state machines (cats, dogs, crew, lady/Sarah), `chipCat` scoring, event chains (tea break → HOA raid frenzy; tickle/anger; accusation; Braxton's-mom → ICE), peril systems (scratch/knockdown via `game.hurtT`/`game.down`, chipper suicide, widow-makers, clothesline trip, dog friendly-fire), all `update*(dt)` functions |
| `js/06-main.js` | `updateHUD`, `endGame(annihilation)` (reads `game.failed`/`game.failTitle` for death variants; localStorage best score `catchipper_best`), overlay/pause/pointer-lock handling (click-anywhere resume; `showPauseCard()` is the one pause path shared by 06/08/09), damage overlay rendering (`#hurt`, canvas `dazed` class), the `tick()` main loop |
| `js/07-neighborhood.js` | sky dome + parallax hill rings: exposes `skyEnv = {dome, hills:[FAR, NEAR]}`, tinted every frame by `updateMood` (typeof-guarded); every `TEX` access is `|| null`-guarded |
| `js/08-mobile.js` | touch: gesture/zoom/scroll lockdown (runs everywhere), and on coarse-pointer devices (`body.touch`) the control surface — virtual joystick mapped onto `keys`, look-drag on canvas, buttons calling 05's shared `pressLMB`/`releaseLMB`/`pressRMB`/`releaseRMB`/`startKick`/`releaseKick`/`interact`, QTE tap-mash, mobile pause button (no pointer lock on touch) |
| `js/09-gamepad.js` | Xbox / standard-mapping controller: `pollGamepad(dt)` (called from `tick()`), drives the same shared 05 actions as touch, writes `keys` only on edges (never stomps a held keyboard key), last-used-device `body.pad` mode (cheat-sheet `#padkeys`, `padLabel()` swaps `E —` prompts to `Ⓐ —`, D-pad tool caps), aim slowdown over cats, rumble driven by `fxShake` rises, pause on disconnect. Tunables: `PAD_LOOK_YAW`/`PAD_LOOK_PITCH` |

### Contracts that break the game if violated
- **Ground height = `terrainH(x,z)`, always.** It interpolates `terrainRaw` on the ground mesh's own grid (`TERRAIN_SIZE`/`TERRAIN_SEGS`, same triangle split as PlaneGeometry), so it equals the grass you see (the raw curve is up to ~0.6m off at flat-zone edges). Never land/walk/place anything at a constant y (the old `y=0` plane is gone); only the ground mesh vertices sample `terrainRaw`. `moveToward` carries a mover's Y by the terrain delta; particles land at `terrainH+0.04`; the blood decal is a segmented plane draped onto `terrainH`.
- `tick()` in 06 first calls `pollGamepad(dt)` (typeof-guarded, runs even while paused), then, in order: updatePlayer, updateCats, updateDogs, updateCrew, updateFallingLimbs, updateChipper, updateLady, updateFrenzy, updateDoors, updateParts, computePrompt — then unconditionally updateMood, updateViewmodels, render.
- `trees[i] = {group, pos, H, trunk, limbs:[{group, cut, h}], top, topCut, state, fallT, cats}`. Gameplay animates `trunk.rotation.z`/`trunk.position` for felling and detaches limbs via `scene.attach(limb.group)` — limbs must remain self-contained Object3Ds at their attachment heights.
- Cat mesh roots are Groups with origin at ground level (~0.5 long); gameplay sets `rotation.z=PI/2` for stun and lerps positions directly.
- `chipper.catReady()` gates cat chipping; `intakeGlow.material.color` is set every frame by gameplay.
- HUD element IDs in index.html are read by `getElementById` from 05 and 06 (score, catcount, combo, treestat/treecount/chipstat/eventstat, cross, prompt, msgs, eventbanner, tools/t1–t4, overlay, introtext, endstats, rank, playbtn, noflash, hurt, and the pause/end-screen IDs). Never rename/remove; `#chipstat` contains lamp children — don't overwrite its textContent.
- `moodTarget = MOODS.x` is assigned from gameplay to drive scene mood; frenzy strobe respects the `reduceFlash` accessibility flag (keep it).
- Crew names are drawn 3-from-9 at load (`arborist.name`, `groundies[i].name`); events branch on drawn names (Braxton chain, Tanner/Carter arrests) and must no-op cleanly when a name wasn't drawn.

### Conventions
- r128 API only (`outputEncoding`/`sRGBEncoding`, `ACESFilmicToneMapping`); no `Date.now` needs, timing flows from `THREE.Clock` dt with `dt=Math.min(delta,0.05)` clamp.
- Performance target: 60fps on integrated graphics — reuse geometries/materials, segment counts ≤10, castShadow only on significant meshes, no per-frame allocations in hot loops, particle pool stays bounded.
- New materials for new props are defined locally in the file that uses them (don't grow `M` from other files).
- Physics is hand-rolled: gravity + ground plane + circle colliders (`colliders` array pushes the player out). No physics engine.
- Comedy register: trade-identity self-owned humor and fictional-faction satire; grawlix instead of profanity; no real-world groups/organizations depicted.

### Backups
`js-v1-backup/` and `index-v1-backup.html` are the frozen first playable build — don't edit them; they're the rollback point.
