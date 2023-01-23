import { trax } from '@traxjs/trax';
import { beforeEach, describe, expect, it } from 'vitest';
import { counterStore } from '../counter';


describe('Counter Store', () => {
    const counter = counterStore.counter;

    beforeEach(() => {
        counterStore.reset();
    })

    it('shouldsupport increment', async function () {
        expect(counter.value).toBe(0);
        expect(counter.minValue).toBe(0);
        expect(counter.maxValue).toBe(0);

        counterStore.increment(42);
        await trax.reconciliation();

        expect(counter.value).toBe(42);
        expect(counter.minValue).toBe(0);
        expect(counter.maxValue).toBe(42);

        counterStore.increment(-50);
        await trax.reconciliation();

        expect(counter.value).toBe(-8);
        expect(counter.minValue).toBe(-8);
        expect(counter.maxValue).toBe(42);

        counterStore.increment(9);
        await trax.reconciliation();

        expect(counter.value).toBe(1);
        expect(counter.minValue).toBe(-8);
        expect(counter.maxValue).toBe(42);
    });
});
