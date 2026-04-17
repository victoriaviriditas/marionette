// js/hands.js
// Thin wrapper around MediaPipe Tasks HandLandmarker.
// Exposes a simple getter for smoothed left/right hand positions in normalised [0..1] coords.

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.lastVideoTime = -1;
    this.results = null;

    // smoothed state — one entry per handedness
    // each entry: { x, y, open, present, lastSeen }
    this.hands = {
      Left: this._emptyHand(),
      Right: this._emptyHand(),
    };

    this.smoothing = 0.35; // 0 = raw, 1 = frozen. Lower = more responsive.
    this.lostThresholdMs = 350; // after this without a detection, hand is "gone"
  }

  _emptyHand() {
    return { x: 0.5, y: 0.5, open: 1, present: false, lastSeen: 0 };
  }

  async init(videoEl) {
    this.video = videoEl;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    this.landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });
  }

  // Called every animation frame. Mutates internal smoothed state.
  update(timestampMs) {
    if (!this.landmarker || !this.video || this.video.readyState < 2) return;

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.results = this.landmarker.detectForVideo(this.video, timestampMs);
    }

    if (!this.results) return;

    const seen = { Left: false, Right: false };

    if (this.results.landmarks && this.results.landmarks.length) {
      for (let i = 0; i < this.results.landmarks.length; i++) {
        const lm = this.results.landmarks[i];
        const handedness = this.results.handednesses?.[i]?.[0]?.categoryName ?? "Right";

        // MediaPipe reports handedness from the camera's POV. Because we
        // mirror the video for display, "Left" in the result corresponds to
        // the user's right physical hand. We swap so that the names match
        // the user's body — user's right hand = this.hands.Right.
        const key = handedness === "Left" ? "Right" : "Left";

        // anchor point: wrist (landmark 0). Mirror X since the displayed
        // video is mirrored.
        const wrist = lm[0];
        const x = 1 - wrist.x;
        const y = wrist.y;

        // openness heuristic: average distance of fingertips to wrist,
        // normalised by hand size (wrist -> middle MCP).
        const ref = dist(wrist, lm[9]) + 1e-6;
        const tipAvg =
          (dist(wrist, lm[8]) +
            dist(wrist, lm[12]) +
            dist(wrist, lm[16]) +
            dist(wrist, lm[20])) /
          4;
        const open = clamp((tipAvg / ref - 1.3) / 0.9, 0, 1);

        const h = this.hands[key];
        const s = this.smoothing;
        h.x = s * h.x + (1 - s) * x;
        h.y = s * h.y + (1 - s) * y;
        h.open = s * h.open + (1 - s) * open;
        h.present = true;
        h.lastSeen = timestampMs;
        seen[key] = true;
      }
    }

    // mark missing hands as gone after a short timeout
    for (const key of ["Left", "Right"]) {
      if (!seen[key] && timestampMs - this.hands[key].lastSeen > this.lostThresholdMs) {
        this.hands[key].present = false;
      }
    }
  }

  getHand(side /* "Left" | "Right" */) {
    return this.hands[side];
  }
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
