// js/main.js
import { HandTracker } from "./hands.js";
import { Knight } from "./knight.js";
import { drawStrings } from "./strings.js";

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const video = document.getElementById("webcam");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const leftHandEl = document.getElementById("leftHand");
const rightHandEl = document.getElementById("rightHand");
const fpsEl = document.getElementById("fps");
const stage = document.querySelector(".stage");

const tracker = new HandTracker();

// Two knights, facing each other across the stage.
// Knight One (on the left) faces right  → driven by puppeteer's LEFT hand.
// Knight Two (on the right) faces left  → driven by puppeteer's RIGHT hand.
const knightOne = new Knight({ facing: +1, mode: "single" });
const knightTwo = new Knight({ facing: -1, mode: "single" });

let running = false;
let lastFrame = performance.now();
let fpsEMA = 0;

// --- canvas sizing ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- start flow ---
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  setStatus("loading model");
  try {
    await tracker.init(video);
    setStatus("starting camera");
    await tracker.startCamera();
    video.classList.add("visible");
    startBtn.classList.add("hidden");
    stage.classList.add("live");
    setStatus("live");
    running = true;
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    setStatus("camera blocked");
    startBtn.disabled = false;
  }
});

function setStatus(t) {
  statusEl.textContent = t;
}

// --- coordinate mapping ---
// Each knight's puppet space has the sword hand at roughly +120 at rest (right
// side of the body, in canonical orientation). We map the puppeteer's hand
// position so that raising the hand lifts the sword.
//
// The puppeteer's hand doesn't need to be on "their" side of the frame — using
// your left hand anywhere in the frame drives Knight One's sword. This keeps
// the mapping intuitive regardless of how you're standing.
function mapSwordTarget(hand) {
  // Horizontal range: expand the range of motion. Hands at the edges of the
  // frame push the sword to full extension.
  const px = (hand.x - 0.5) * 380;
  const py = (hand.y - 0.5) * 360;
  return { x: px, y: py, present: hand.present, open: hand.open };
}

// --- render loop ---
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  tracker.update(now);

  const leftHand = tracker.getHand("Left");
  const rightHand = tracker.getHand("Right");

  // Knight One's sword is driven by the puppeteer's LEFT hand.
  // Knight Two's sword is driven by the puppeteer's RIGHT hand.
  // Because Knight Two faces left, we mirror the sword target into its canonical
  // space so "hand moves right on screen" → "sword thrusts forward (toward center)".
  const k1Target = mapSwordTarget(leftHand);
  const k2Raw = mapSwordTarget(rightHand);
  const k2Target = { ...k2Raw, x: -k2Raw.x }; // mirror into k2's canonical space

  knightOne.setSwordTarget(k1Target);
  knightTwo.setSwordTarget(k2Target);

  knightOne.update(dt);
  knightTwo.update(dt);

  // --- draw ---
  const W = canvas.width / (window.devicePixelRatio || 1);
  const H = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, W, H);

  // subtle bottom shadow wash
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(20, 20, 26, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Stage positioning: the two knights stand equidistant from center.
  // Separation scales with viewport width but has sensible bounds.
  const stageY = H * 0.58;
  const separation = clamp(W * 0.22, 220, 380);
  const k1X = W / 2 - separation;
  const k2X = W / 2 + separation;

  // Single wide spotlight covering both knights
  const spot = ctx.createRadialGradient(W / 2, stageY - 40, 40, W / 2, stageY, Math.max(420, separation * 2));
  spot.addColorStop(0, "rgba(246, 242, 234, 0.06)");
  spot.addColorStop(1, "rgba(246, 242, 234, 0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // Draw strings for each knight
  drawKnightStrings(ctx, knightOne, k1X, stageY, W);
  drawKnightStrings(ctx, knightTwo, k2X, stageY, W);

  // Draw the knights
  ctx.save();
  ctx.translate(k1X, stageY);
  knightOne.draw(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(k2X, stageY);
  knightTwo.draw(ctx);
  ctx.restore();

  // Hand markers at the puppeteer's hand positions, in scene coordinates.
  // We place them at each knight's driven sword-hand location so you can see
  // exactly where "your hand" is influencing the puppet.
  drawHandMarker(
    ctx,
    k1X + knightOne.handR.x * knightOne.facing,
    stageY + knightOne.handR.y,
    knightOne.swordPresent
  );
  drawHandMarker(
    ctx,
    k2X + knightTwo.handR.x * knightTwo.facing,
    stageY + knightTwo.handR.y,
    knightTwo.swordPresent
  );

  // HUD
  leftHandEl.textContent = leftHand.present
    ? `${(leftHand.x * 100).toFixed(0)}, ${(leftHand.y * 100).toFixed(0)}`
    : "—";
  rightHandEl.textContent = rightHand.present
    ? `${(rightHand.x * 100).toFixed(0)}, ${(rightHand.y * 100).toFixed(0)}`
    : "—";

  const instFps = 1 / Math.max(dt, 0.001);
  fpsEMA = fpsEMA ? fpsEMA * 0.9 + instFps * 0.1 : instFps;
  fpsEl.textContent = fpsEMA.toFixed(0);

  requestAnimationFrame(loop);
}

// Draw the 5 strings for a single knight.
// localToScene: knight-local point p → scene coord (accounting for facing).
function drawKnightStrings(ctx, knight, originX, originY, W) {
  const localAnchors = knight.getStringAnchors();
  // Spread the top anchors over a beam above this knight. The beam width is
  // smaller than the single-knight version because there are two beams on stage.
  const beamSpread = Math.min(W * 0.16, 240);
  const topXs = [
    originX + 0,                  // head
    originX - beamSpread * 0.35,  // shoulderL
    originX + beamSpread * 0.35,  // shoulderR
    originX - beamSpread * 0.55,  // handL
    originX + beamSpread * 0.55,  // handR
  ];

  const sceneAnchors = localAnchors.map((a, i) => ({
    x: originX + a.x * knight.facing,
    y: originY + a.y,
    topX: topXs[i],
  }));

  drawStrings(ctx, sceneAnchors, {
    ceilingY: -20,
    canvasW: W,
    stringColor: "rgba(246, 242, 234, 0.55)",
  });
}

function drawHandMarker(ctx, x, y, present) {
  if (!present) return;
  ctx.save();
  ctx.strokeStyle = "rgba(232, 220, 196, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(232, 220, 196, 0.9)";
  ctx.fill();
  ctx.restore();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
