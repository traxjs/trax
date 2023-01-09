import { beforeEach, describe, expect, it } from 'vitest';
import { $Trax } from '../types';
import { createTraxEnv } from '../core';
import { printEvents } from './utils';

describe('Trax Core', () => {
    let trax: $Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents);
    }

    it('should support cycleComplete', async () => {
        expect(trax.pendingChanges).toBe(false);
        trax.log.info("A");
        expect(trax.pendingChanges).toBe(false);
        await trax.cycleComplete();
        expect(trax.pendingChanges).toBe(false);

        expect(printLogs(false)).toMatchObject([
            '0:0 !CS - {"elapsedTime":0}',
            '0:1 !LOG - "A"',
            '0:2 !CC - {"elapsedTime":0}',
        ]);

        // no changes
        await trax.cycleComplete();
        expect(trax.pendingChanges).toBe(false);
        expect(printLogs(false)).toMatchObject([
            '0:0 !CS - {"elapsedTime":0}',
            '0:1 !LOG - "A"',
            '0:2 !CC - {"elapsedTime":0}',
        ]);

        trax.log.info("B");
        await trax.cycleComplete();
        expect(trax.pendingChanges).toBe(false);
        expect(printLogs(false)).toMatchObject([
            '0:0 !CS - {"elapsedTime":0}',
            '0:1 !LOG - "A"',
            '0:2 !CC - {"elapsedTime":0}',
            '1:0 !CS - {"elapsedTime":0}',
            '1:1 !LOG - "B"',
            '1:2 !CC - {"elapsedTime":0}',
        ]);

    });
});
