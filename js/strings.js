// js/strings.js
// Renders puppet strings from an off-screen "ceiling" down to each anchor point
// on the knight. Uses a small vertical catenary/sag so strings look like thread,
// not rigid lines.

export function drawStrings(ctx, anchors, options) {
  const { ceilingY, canvasW, stringColor } = options;

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = stringColor;
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(246, 242, 234, 0.25)";
  ctx.shadowBlur = 4;

  for (const a of anchors) {
    // spread the top anchors horizontally across the ceiling so the strings
    // don't all converge to one point
    const topX = a.topX;
    const topY = ceilingY;
    const botX = a.x;
    const botY = a.y;

    // Quadratic bezier with a small horizontal lean for organic feel.
    // The control point sits along the line with a tiny sideways nudge
    // based on horizontal offset.
    const cpx = (topX + botX) / 2 + (botX - topX) * 0.05;
    const cpy = (topY + botY) / 2;

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cpx, cpy, botX, botY);
    ctx.stroke();

    // tiny peg on the ceiling
    ctx.beginPath();
    ctx.arc(topX, topY, 2, 0, Math.PI * 2);
    ctx.fillStyle = stringColor;
    ctx.fill();

    // tiny knot where the string attaches to the body
    ctx.beginPath();
    ctx.arc(botX, botY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
