import { describe, expect, it } from 'vitest';
import { formatDuration } from '../format';

describe('Format', () => {

    it('should format durations', async () => {
        const s = 1000;
        const min = 60 * s;
        const hour = 60 * min;

        expect(formatDuration(10)).toBe("10ms");
        expect(formatDuration(3)).toBe("3ms");
        expect(formatDuration(345)).toBe("345ms");
        expect(formatDuration(1200)).toBe("1.2s");
        expect(formatDuration(3500)).toBe("3.5s");
        expect(formatDuration(46 * s + 400)).toBe("46.4s");
        expect(formatDuration(32 * min + 28 * s + 345)).toBe("32min 28s");
        expect(formatDuration(5 * hour + 32 * min + 28 * s + 345)).toBe("5h 32min");
        expect(formatDuration(25 * hour + 32 * min + 28 * s + 345)).toBe(">1 day");
    });

});

