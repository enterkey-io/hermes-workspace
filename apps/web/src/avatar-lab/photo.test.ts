import { describe, expect, it } from 'vitest';
import { photoDimensions } from './photo';
function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
describe('local photo preflight', () => {
  it('reads dimensions from raster content before decoding', () => {
    expect(photoDimensions(png(640, 480))).toEqual({ width: 640, height: 480 });
    const jpeg = new Uint8Array([255, 216, 255, 192, 0, 8, 8, 1, 224, 2, 128, 1]);
    expect(photoDimensions(jpeg)).toEqual({ width: 640, height: 480 });
    const webp = new Uint8Array(30);
    webp.set([82, 73, 70, 70]);
    webp.set([87, 69, 66, 80], 8);
    webp.set([86, 80, 56, 88], 12);
    webp[24] = 255;
    webp[25] = 1;
    webp[27] = 255;
    webp[28] = 1;
    expect(photoDimensions(webp)).toEqual({ width: 512, height: 512 });
  });
  it('rejects large decoded dimensions, invalid and active vector content', () => {
    expect(() => photoDimensions(png(100000, 100000))).toThrow('smaller');
    expect(() => photoDimensions(png(5000, 5000))).toThrow('smaller');
    expect(() =>
      photoDimensions(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
    ).toThrow('JPEG');
    expect(() => photoDimensions(new Uint8Array([255, 216, 255, 192, 0, 2]))).toThrow('JPEG');
  });
});
