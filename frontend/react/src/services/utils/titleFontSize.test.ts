import { describe, expect, it } from 'vitest';
import { titleFontSize } from '../../../../shared/titleFontSize.ts';

const scale = { max: 2, min: 1, shrinkFrom: 10, shrinkTo: 30 };

describe('titleFontSize', () => {
    it('keeps short titles at full size', () => {
        expect(titleFontSize('Short', scale)).toBe(2);
        expect(titleFontSize('x'.repeat(10), scale)).toBe(2);
    });

    it('shrinks linearly between the two lengths', () => {
        expect(titleFontSize('x'.repeat(20), scale)).toBe(1.5);
    });

    it('never goes below the minimum, and ignores surrounding spaces', () => {
        expect(titleFontSize('x'.repeat(300), scale)).toBe(1);
        expect(titleFontSize(`   ${'x'.repeat(10)}   `, scale)).toBe(2);
    });
});
