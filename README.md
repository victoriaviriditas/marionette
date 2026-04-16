# Marionette

> A hand-tracked duel. One puppeteer, two knights, one hand each.

A browser-based puppeteering toy built with [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) and HTML canvas. No install, no build step, no native dependencies. Clone, open, done.

![knight preview placeholder](./assets/preview.png)

## What it does

- Tracks both of your hands through the webcam in real time.
- Two white paper-doll knights face each other on a dark stage, each hanging from five visible strings.
- Your **left hand** commands the knight on the left — its sword-hand follows wherever your left hand goes.
- Your **right hand** commands the knight on the right — mirrored.
- Each knight's shield hand auto-poses in a defensive guard that rises and falls with the sword, so the free hand always looks alive.
- Bring your hands together and the blades meet in the middle. Pull them apart and the knights recoil into their stances.
- When a hand leaves the frame, that knight drifts back to a resting hang.

Everything is pure client-side — a single static site you can host on GitHub Pages with one click.

## Run it locally

No build step needed, but browsers block `getUserMedia` and ES modules on `file://`. Serve the folder over HTTP:

```bash
# any of these work:
python3 -m http.server 8000
# or
npx serve .
# or
npx http-server -p 8000
```

Then open http://localhost:8000 and grant camera access.

**Tip:** Chrome / Edge give the smoothest tracking. Safari works but may be a bit choppier.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → **Deploy from branch** → `main` / `root`.
3. Wait ~1 minute. Done.

Because everything is loaded from CDNs (MediaPipe models + wasm runtime), nothing else needs bundling.

## How it works

```
   webcam ──▶ MediaPipe HandLandmarker ──▶ smoothed Left / Right hand positions
                                                     │
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                              map into Knight One's      map into Knight Two's
                                 puppet space              (mirrored) space
                                        │                         │
                                        ▼                         ▼
                            sword-hand IK target         sword-hand IK target
                                        │                         │
                            shield auto-pose (guard)    shield auto-pose (guard)
                                        │                         │
                                        ▼                         ▼
                                 canvas render ──▶ strings + two bodies facing each other
```

### Files

| File | Role |
|---|---|
| `index.html` | Page shell, typography, HUD markup |
| `css/styles.css` | Dark theater aesthetic, grain, vignettes |
| `js/hands.js` | MediaPipe wrapper + exponential smoothing of hand positions |
| `js/knight.js` | Knight rig with IK, `facing` flip, and dual/single driver modes |
| `js/strings.js` | Quadratic bézier puppet strings with soft sag |
| `js/main.js` | Orchestrator: two knights, coord mapping per hand, render loop |

### How a knight is driven

Each `Knight` has a `facing` (+1 or −1) and a `mode`:

- **`"dual"`** — classic single-player: left hand drives shield, right hand drives sword. (Original Act I behavior — still supported by the class.)
- **`"single"`** — one external hand drives the sword; the shield hand auto-poses via `setSwordTarget()`. This is what the duel uses.

The two knights in the duel are symmetric: Knight One has `facing: +1` and is placed on the left; Knight Two has `facing: -1` (mirrored at draw-time) and is placed on the right. All body math is authored once in a canonical orientation.

### Tweakable knobs

- **Smoothing** — `HandTracker.smoothing` in `js/hands.js` (0 = raw, 1 = frozen).
- **Sword range of motion** — multipliers in `mapSwordTarget()` in `js/main.js`.
- **Knight separation** — the `separation` constant in the render loop (`js/main.js`).
- **Arm bone lengths** — `upperArm` / `forearm` in `js/knight.js`.
- **Shield calmness** — the `sk` (shield smoothing) constant inside `Knight.setSwordTarget()`. Lower = lazier shield.
- **String color** — `stringColor` passed to `drawStrings()` in `js/main.js`.

## Ideas for extending

- Swap the shield auto-pose for a real second-hand driver using pinch detection to "equip" / "unequip".
- Add sword-vs-sword collision with a satisfying clang sound.
- Record a duel to a GIF with `gif.js`.
- Add a third knight — `MediaPipe` can return up to 4 hands per frame, so two puppeteers can share the camera.
- Replace the paper-doll rendering with SVG assets loaded from `assets/`.

## License

MIT. Do whatever you want.
