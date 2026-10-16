import { describe, it, expect } from 'vitest';
import { projectEyes, pointerGaze } from './projection';

describe('projected avatar gaze', () => {
  it('responds equally to equal left/right/up/down pointer distances independent of row width', () => {
    for (const width of [32, 44, 56, 88, 104]) {
      const a = pointerGaze(-width / 2, -width / 2, width, width),
        b = pointerGaze(width / 2, width / 2, width, width);
      expect(a.x).toBe(-b.x);
      expect(a.y).toBe(-b.y);
      expect(b).toEqual({ x: 6, y: 5 });
      expect(pointerGaze(width / 4, 0, width, width).x).toBe(
        -pointerGaze(-width / 4, 0, width, width).x,
      );
    }
  });
  it('turns both ways and makes the near eye longer than the far eye', () => {
    const left = projectEyes(-32, 0),
      right = projectEyes(32, 0);
    expect(right.left.x + right.right.x).toBeGreaterThan(left.left.x + left.right.x + 20);
    expect(right.left.height / right.right.height).toBeGreaterThan(1.15);
    expect(left.right.height / left.left.height).toBeGreaterThan(1.15);
    expect(projectEyes(18, -12).left.tilt).toBeLessThan(-10);
  });
  it('keeps finite separated eye geometry across the allowed range and clamps excess', () => {
    for (const yaw of [-32, 0, 32])
      for (const pitch of [-22, 0, 22]) {
        const p = projectEyes(yaw, pitch);
        expect(p.right.x - p.left.x).toBeGreaterThan(8);
        for (const e of [p.left, p.right])
          for (const value of Object.values(e)) expect(Number.isFinite(value)).toBe(true);
      }
    const clamped = projectEyes(32, 22),
      excess = projectEyes(200, 200);
    expect(excess.left.x).toBe(clamped.left.x);
    expect(excess.right.height).toBe(clamped.right.height);
  });
});
