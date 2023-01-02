import { describe, expect, it } from 'vitest';
import { counterStore } from '../counter';


describe('Counter Store', () => {
    it('should reset and support increment', async function () {
        expect(typeof counterStore.reset).toBe("function");
        expect(typeof counterStore.increment).toBe("function");
        // TODO
    });
});
