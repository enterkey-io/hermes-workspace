/** Equal pointer distances from the face produce equal turns in either direction. */
export function pointerGaze(dx: number, dy: number, width: number, height: number) {
  return {
    x: Math.max(-6, Math.min(6, (dx / Math.max(12, width / 2)) * 6)),
    y: Math.max(-5, Math.min(5, (dy / Math.max(12, height / 2)) * 5)),
  };
}

export function projectEyes(yawDegrees: number, pitchDegrees: number) {
  const boundedYaw = Math.max(-32, Math.min(32, yawDegrees));
  const boundedPitch = Math.max(-22, Math.min(22, pitchDegrees));
  const yaw = (boundedYaw * Math.PI) / 180;
  const pitch = (boundedPitch * Math.PI) / 180;
  function eye(x: number) {
    const x1 = x * Math.cos(yaw) + 24 * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + 24 * Math.cos(yaw);
    const y2 = z1 * Math.sin(pitch);
    const z2 = z1 * Math.cos(pitch);
    const perspective = 180 / (180 - z2);
    const near = x * yaw < 0;
    const turn = Math.abs(Math.sin(yaw));
    return {
      x: 50 + x1 * perspective,
      y: 49 + y2 * perspective,
      width: (near ? 1 : 1 - 0.18 * turn) * perspective,
      height: (near ? 1 + 0.14 * turn : 1 - 0.22 * turn) * Math.cos(pitch) * perspective,
      tilt: -0.55 * boundedYaw + 0.5 * boundedPitch,
    };
  }
  const left = eye(-10.5),
    right = eye(10.5);
  const centerX = (left.x + right.x) / 2 - 50;
  const centerY = (left.y + right.y) / 2 - 49;
  const fit = Math.max(1, Math.hypot(centerX / 13, centerY / 10));
  for (const point of [left, right]) {
    point.x += centerX / fit - centerX;
    point.y += centerY / fit - centerY;
  }
  return {
    left,
    right,
    bodyX: 2.5 * Math.sin(yaw),
    bodyY: 1.5 * Math.sin(pitch),
    bodyRoll: -4 * Math.sin(yaw),
  };
}
