import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store, Trax, trax, traxEvents } from '@traxjs/trax';
import { createClientEnv } from './clientmock';
import { createDevToolsStore, DevToolsStore } from '../devtoolsstore';
import { DtLogCycle, DtLogEvent } from '../types';

describe('Logs', () => {
    let ce: ReturnType<typeof createClientEnv>, dts: DevToolsStore;

    beforeEach(() => {
        ce = createClientEnv();
        dts = createDevToolsStore(ce.clientAPI);
    });

    afterEach(() => {
        dts.dispose();
    })

    function printLogs(logs: DtLogCycle[], minCycleId = 0) {
        const r: string[] = [];

        for (const cycle of logs) {
            if (cycle.cycleId >= minCycleId) {
                const ems = cycle.elapsedMs < 20 ? 0 : cycle.elapsedMs;
                const cms = cycle.computeMs < 20 ? 0 : cycle.computeMs;
                r.push(`Cycle #${cycle.cycleId} ${ems}/${cms}`);
                printEvents(cycle.$$events, "  ", r);
            }
        }
        return r;
    }

    function printEvents(events: DtLogEvent[], prefix: string, r: string[]) {
        for (const e of events) {
            const tp = e.type;
            if (tp === traxEvents.Get) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}.${e.propName} --> ${e.propValue}`);
            } else if (tp === traxEvents.Set) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}.${e.propName} = ${e.toValue} (previous: ${e.fromValue})`);
            } else if (tp === traxEvents.Error || tp === traxEvents.Info || tp === traxEvents.Warning) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.data}`);
            } else if (tp === traxEvents.New || tp === traxEvents.Dispose) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}(${e.objectType})`);
            } else if (tp === "!PCG") {
                r.push(`${prefix}- ${e.id} ${tp} ${e.name}`);
                printEvents(e.$$events, "  " + prefix, r);
            }
        }
    }

    function testStore1(trax: Trax) {
        return trax.createStore("TestStore", (store: Store<{ count: number }>) => {
            const data = store.init({
                count: 0
            });

            return {
                data,
                increment(v: number = 1) {
                    data.count += v;
                    trax.log.info("Log in increment");
                }
            }
        });
    }

    it('should be activated/deactivated when the devtools start/stop', async () => {
        ce = createClientEnv();
        expect(ce.active).toBe(false);
        dts = createDevToolsStore(ce.clientAPI);
        expect(ce.active).toBe(true);
        const client = ce.init(testStore1);

        ce.log("A");
        ce.log("B");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs)).toMatchObject([
            "Cycle #0 0/0",
            "  - 0:1 !PCG !StoreInit",
            "    - 0:2 !NEW TestStore(S)",
            "    - 0:3 !NEW TestStore/root(O)",
            "  - 0:5 !LOG A",
            "  - 0:6 !LOG B",
        ]);
        ce.log("C");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs, 1)).toMatchObject([
            "Cycle #1 0/0",
            "  - 1:1 !LOG C",
        ]);

        expect(ce.active).toBe(true);
        dts.dispose();
        expect(ce.active).toBe(false);

        ce.log("D");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs, 2)).toMatchObject([]);
        client.increment();
    });

    // describe('Processing Context Groups', () => {
    //     it('should be created for store actions (app)', async () => {
    //         const client = ce.init(testStore1);
    //         expect(client.data.count).toBe(0);

    //         ce.log("A");
    //         client.increment();
    //         ce.log("B");
    //         expect(client.data.count).toBe(1);

    //         await trax.reconciliation();
    //         expect(printLogs(dts.data.$$logs)).toMatchObject([
    //             "Cycle #0 0/0",
    //             "  - 0:1 !PCG !StoreInit",
    //             "    - 0:2 !NEW TestStore(S)",
    //             "    - 0:3 !NEW TestStore/root(O)",
    //             "  - 0:5 !GET TestStore/root.count --> 0",
    //             "  - 0:6 !LOG A",
    //             "  - 0:7 !PCG TestStore.increment()",
    //             "    - 0:8 !GET TestStore/root.count --> 0",
    //             "    - 0:9 !SET TestStore/root.count = 1 (previous: 0)",
    //             "    - 0:10 !LOG Log in increment",
    //             "  - 0:12 !LOG B",
    //             "  - 0:13 !GET TestStore/root.count --> 1",
    //         ]);

    //         ce.log("C");
    //         client.increment(2);
    //         expect(client.data.count).toBe(3);

    //         await trax.reconciliation();
    //         expect(printLogs(dts.data.$$logs, 1)).toMatchObject([
    //             "Cycle #1 0/0",
    //             "  - 1:1 !LOG C",
    //             "  - 1:2 !PCG TestStore.increment()",
    //             "    - 1:3 !GET TestStore/root.count --> 1",
    //             "    - 1:4 !SET TestStore/root.count = 3 (previous: 1)",
    //             "    - 1:5 !LOG Log in increment",
    //             "  - 1:7 !GET TestStore/root.count --> 3",
    //         ]);
    //     });
    // });



    // traxEvents.Dispose; traxEvents.Error/Warning; traxEvents.ProcessorDirty; traxEvents.ProcessingPause/Resume (async)
    // all !StoreInit "!Compute"; "!ArrayUpdate" | "!DictionaryUpdate"; "!Reconciliation";
    // app-specific PCG
    // app events
    // warning if gap in log cycles
    // filter: objectId (store / data / processor)


});

