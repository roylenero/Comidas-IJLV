import { describe, expect, it } from 'vitest';
import { fitWithin } from './image';

describe('fitWithin', () => {
  it('reduce el lado mayor a 1600 px manteniendo proporción', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 1920, 1600)).toEqual({ width: 900, height: 1600 });
  });
  it('no agranda imágenes pequeñas', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
