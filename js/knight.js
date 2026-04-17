// js/knight.js
// A 2D paper-doll medieval knight.
//
// Two modes:
//   - "dual"   : left hand → shield hand, right hand → sword hand (classic)
//   - "single" : ONE puppeteer hand drives the sword hand; the shield hand
//                auto-poses in a defensive guard that tracks the sword.
//
// `facing` is +1 (sword on the body's right, shield on the left — looking right)
// or -1 (mirrored, looking left). We apply the flip at draw-time with a scale
// transform so all internal math stays in a single canonical orientation.

export class Knight {
  constructor(options = {}) {
    this.facing = options.facing ?? 1;
    this.mode = options.mode ?? "dual"; // "dual" | "single"

    // Canonical puppet space (authored as if facing right)
    this.head = { x: 0, y: -170, angle: 0, size: 52 };
    this.torsoTop = { x: 0, y: -110 };
    this.torsoBottom = { x: 0, y: 20 };
    this.hipL = { x: -26, y: 20 };
    this.hipR = { x: 26, y: 20 };
    this.footL = { x: -38, y: 180 };
    this.footR = { x: 38, y: 180 };

    this.shoulderL = { x: -58, y: -100 };
    this.shoulderR = { x: 58, y: -100 };

    this.upperArm = 70;
    this.forearm = 80;

    // In canonical space: handL = shield, handR = sword.
    this.handL = { x: -120, y: 0 };
    this.handR = { x: 120, y: 0 };

    this.elbowL = { x: -90, y: -50 };
    this.elbowR = { x: 90, y: -50 };

    this.headTargetY = -170;

    this.swordPresent = false;
    this.shieldPresent = false;

    this.leftGrip = 1;
    this.rightGrip = 1;

    this.t = 0;
  }

  // --- Driver API ---

  // Drive both hands directly (dual-hand mode).
  // left / right: { x, y, present, open } in this knight's canonical puppet space.
  setHandTargets(left, right) {
    const k = 0.25;
    if (left.present) {
      this.handL.x += (left.x - this.handL.x) * k;
      this.handL.y += (left.y - this.handL.y) * k;
      this.leftGrip += (left.open - this.leftGrip) * 0.2;
    } else {
      this.handL.x += (-120 - this.handL.x) * 0.04;
      this.handL.y += (40 - this.handL.y) * 0.04;
    }
    if (right.present) {
      this.handR.x += (right.x - this.handR.x) * k;
      this.handR.y += (right.y - this.handR.y) * k;
      this.rightGrip += (right.open - this.rightGrip) * 0.2;
    } else {
      this.handR.x += (120 - this.handR.x) * 0.04;
      this.handR.y += (40 - this.handR.y) * 0.04;
    }
    this.shieldPresent = left.present;
    this.swordPresent = right.present;
  }

  // Drive only the sword hand; shield auto-poses.
  // sword: { x, y, present, open } in this knight's canonical puppet space.
  setSwordTarget(sword) {
    const k = 0.25;
    if (sword.present) {
      this.handR.x += (sword.x - this.handR.x) * k;
      this.handR.y += (sword.y - this.handR.y) * k;
      this.rightGrip += (sword.open - this.rightGrip) * 0.2;
    } else {
      this.handR.x += (120 - this.handR.x) * 0.04;
      this.handR.y += (40 - this.handR.y) * 0.04;
    }
    this.swordPresent = sword.present;
    this.shieldPresent = true;

    // Shield auto-pose: chest-height guard in front of the body, rising as the
    // sword rises so the knight looks engaged.
    const swordLift = clamp(map(this.handR.y, 80, -120, 0, 1), 0, 1);
    const idle = Math.sin(this.t * 1.1) * 4;
    const guardX = -55 + idle * 0.3;
    const guardY = -20 - swordLift * 60;

    const sk = 0.08; // gentle — shield is calmer than the sword
    this.handL.x += (guardX - this.handL.x) * sk;
    this.handL.y += (guardY - this.handL.y) * sk;
    this.leftGrip += (1 - this.leftGrip) * 0.1;
  }

  update(dt) {
    this.t += dt;

    const avgHandY = (this.handL.y + this.handR.y) / 2;
    const lift = clamp(map(avgHandY, 60, -100, 0, -40), -40, 10);
    const idleBob = Math.sin(this.t * 1.4) * 1.5;
    this.headTargetY = -170 + lift + idleBob;
    this.head.y += (this.headTargetY - this.head.y) * 0.12;

    const tilt = clamp((this.handL.y - this.handR.y) * 0.002, -0.25, 0.25);
    this.head.angle += (tilt - this.head.angle) * 0.1;

    const swayX = (this.handL.x + this.handR.x) * 0.08;
    this.torsoTop.x += (swayX - this.torsoTop.x) * 0.08;
    this.torsoBottom.x += (swayX * 0.5 - this.torsoBottom.x) * 0.06;

    this.shoulderL.x = this.torsoTop.x - 58;
    this.shoulderL.y = this.torsoTop.y + 10;
    this.shoulderR.x = this.torsoTop.x + 58;
    this.shoulderR.y = this.torsoTop.y + 10;

    solveTwoBoneIK(this.shoulderL, this.handL, this.upperArm, this.forearm, +1, this.elbowL);
    solveTwoBoneIK(this.shoulderR, this.handR, this.upperArm, this.forearm, -1, this.elbowR);

    this.hipL.x = this.torsoBottom.x - 26;
    this.hipR.x = this.torsoBottom.x + 26;
  }

  // String anchor points in LOCAL puppet space (canonical, pre-facing).
  // Order: head, shoulderL, shoulderR, handL (shield), handR (sword).
  getStringAnchors() {
    return [
      { x: this.head.x, y: this.head.y - this.head.size * 0.6, label: "head" },
      { x: this.shoulderL.x, y: this.shoulderL.y - 2, label: "shoulderL" },
      { x: this.shoulderR.x, y: this.shoulderR.y - 2, label: "shoulderR" },
      { x: this.handL.x, y: this.handL.y - 4, label: "handL" },
      { x: this.handR.x, y: this.handR.y - 4, label: "handR" },
    ];
  }

  // Apply facing to a canonical-space point.
  applyFacing(p) {
    return { x: p.x * this.facing, y: p.y, label: p.label };
  }

  // --- Rendering ---
  draw(ctx) {
    ctx.save();
    ctx.scale(this.facing, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const stroke = "rgba(246, 242, 234, 0.95)";
    const fill = "rgba(246, 242, 234, 0.06)";
    const fillSolid = "rgba(246, 242, 234, 0.92)";

    drawBone(ctx, this.hipL, this.footL, 8, fill, stroke);
    drawBone(ctx, this.hipR, this.footR, 8, fill, stroke);
    drawBoot(ctx, this.footL, stroke, fill);
    drawBoot(ctx, this.footR, stroke, fill);

    this._drawTorso(ctx, stroke, fill);

    drawBone(ctx, this.shoulderL, this.elbowL, 9, fill, stroke);
    drawBone(ctx, this.elbowL, this.handL, 8, fill, stroke);
    drawBone(ctx, this.shoulderR, this.elbowR, 9, fill, stroke);
    drawBone(ctx, this.elbowR, this.handR, 8, fill, stroke);

    drawPauldron(ctx, this.shoulderL, -1, stroke, fill);
    drawPauldron(ctx, this.shoulderR, +1, stroke, fill);

    this._drawShield(ctx, this.handL, stroke, fill, fillSolid);
    this._drawSword(ctx, this.handR, this.shoulderR, stroke, fill, fillSolid);
    this._drawHelm(ctx, stroke, fill, fillSolid);

    ctx.restore();
  }

  _drawTorso(ctx, stroke, fill) {
    const topL = { x: this.shoulderL.x + 6, y: this.shoulderL.y + 6 };
    const topR = { x: this.shoulderR.x - 6, y: this.shoulderR.y + 6 };
    const botL = this.hipL;
    const botR = this.hipR;

    ctx.beginPath();
    ctx.moveTo(topL.x, topL.y);
    ctx.lineTo(topR.x, topR.y);
    ctx.lineTo(botR.x + 4, botR.y);
    ctx.lineTo(this.torsoBottom.x, this.torsoBottom.y + 18);
    ctx.lineTo(botL.x - 4, botL.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo((topL.x + topR.x) / 2, topL.y + 4);
    ctx.lineTo(this.torsoBottom.x, this.torsoBottom.y + 16);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(botL.x - 4, botL.y - 4);
    ctx.lineTo(botR.x + 4, botR.y - 4);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawHelm(ctx, stroke, fill, fillSolid) {
    ctx.save();
    ctx.translate(this.head.x, this.head.y);
    ctx.rotate(this.head.angle);

    const s = this.head.size;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.55);
    ctx.quadraticCurveTo(-s * 0.58, s * 0.1, -s * 0.42, s * 0.55);
    ctx.lineTo(s * 0.42, s * 0.55);
    ctx.quadraticCurveTo(s * 0.58, s * 0.1, s * 0.5, -s * 0.55);
    ctx.quadraticCurveTo(0, -s * 0.78, -s * 0.5, -s * 0.55);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.05);
    ctx.lineTo(s * 0.34, -s * 0.05);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, s * 0.08);
    ctx.lineTo(0, s * 0.32);
    ctx.moveTo(-s * 0.12, s * 0.2);
    ctx.lineTo(s * 0.12, s * 0.2);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2, -s * 0.78);
    ctx.quadraticCurveTo(10, -s * 1.05, 2, -s * 1.25);
    ctx.quadraticCurveTo(-6, -s * 1.05, -2, -s * 0.78);
    ctx.fillStyle = fillSolid;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  _drawShield(ctx, hand, stroke, fill, fillSolid) {
    ctx.save();
    ctx.translate(hand.x, hand.y);

    const angle = Math.sin(this.t * 0.8) * 0.04 - 0.15;
    ctx.rotate(angle);

    const w = 52;
    const h = 72;

    ctx.beginPath();
    ctx.moveTo(-w, -h * 0.5);
    ctx.lineTo(w, -h * 0.5);
    ctx.lineTo(w * 0.92, h * 0.25);
    ctx.quadraticCurveTo(0, h * 0.72, -w * 0.92, h * 0.25);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -h * 0.32);
    ctx.lineTo(0, h * 0.42);
    ctx.moveTo(-w * 0.55, h * 0.02);
    ctx.lineTo(w * 0.55, h * 0.02);
    ctx.lineWidth = 4;
    ctx.strokeStyle = fillSolid;
    ctx.stroke();

    ctx.restore();
  }

  _drawSword(ctx, hand, shoulder, stroke, fill, fillSolid) {
    ctx.save();
    ctx.translate(hand.x, hand.y);

    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const angle = Math.atan2(dy, dx);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(-4, 14);
    ctx.lineTo(4, 14);
    ctx.lineTo(4, -14);
    ctx.closePath();
    ctx.fillStyle = fillSolid;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(-18, -3, 14, 6);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-22, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = fillSolid;
    ctx.fill();
    ctx.stroke();

    const bladeLen = 110;
    ctx.beginPath();
    ctx.moveTo(6, -5);
    ctx.lineTo(6 + bladeLen, -1.5);
    ctx.lineTo(6 + bladeLen + 8, 0);
    ctx.lineTo(6 + bladeLen, 1.5);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(6 + bladeLen - 6, 0);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  }
}

// --- helpers ---

function drawBone(ctx, a, b, thickness, fill, stroke) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(angle);
  ctx.beginPath();
  const r = thickness / 2;
  ctx.moveTo(0, -r);
  ctx.lineTo(len, -r);
  ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPauldron(ctx, shoulder, side, stroke, fill) {
  ctx.save();
  ctx.translate(shoulder.x, shoulder.y);
  ctx.beginPath();
  ctx.ellipse(side * 4, -2, 18, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBoot(ctx, foot, stroke, fill) {
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(14, -6);
  ctx.lineTo(18, 4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function solveTwoBoneIK(origin, target, l1, l2, bend, outElbow) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  let d = Math.hypot(dx, dy);
  const maxReach = l1 + l2 - 1;
  if (d > maxReach) d = maxReach;
  if (d < 0.0001) d = 0.0001;

  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);

  const baseAngle = Math.atan2(dy, dx);
  const elbowAngle = baseAngle + a * bend;

  outElbow.x = origin.x + Math.cos(elbowAngle) * l1;
  outElbow.y = origin.y + Math.sin(elbowAngle) * l1;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function map(v, a, b, c, d) {
  return c + ((v - a) * (d - c)) / (b - a);
}
