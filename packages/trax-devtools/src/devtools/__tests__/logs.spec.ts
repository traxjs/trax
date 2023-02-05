import { beforeEach, describe, expect, it } from 'vitest';
import { Store, trax, traxEvents } from '@traxjs/trax';
import { createClientEnv } from './clientmock';
import { createDevToolsStore } from '../devtoolsstore';
import { DtLogCycle, DtLogEvent } from '../types';

describe('Logs', () => {

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
                r.push(`${prefix}- ${tp} ${e.objectId}.${e.propName} --> ${e.propValue}`);
            } else if (tp === traxEvents.Set) {
                r.push(`${prefix}- ${tp} ${e.objectId}.${e.propName} = ${e.toValue} (previous: ${e.fromValue})`);
            } else if (tp === traxEvents.Error || tp === traxEvents.Info || tp === traxEvents.Warning) {
                r.push(`${prefix}- ${tp} ${e.data}`);
            } else if (tp === traxEvents.New || tp === traxEvents.Dispose) {
                r.push(`${prefix}- ${tp} ${e.objectId}(${e.objectType})`);
            } else if (tp === "!PCG") {
                r.push(`${prefix}- ${tp} ${e.name}`);
                printEvents(e.$$events, "  " + prefix, r);
            }
        }
    }

    it('should be activated/deactivated when the devtools start/stop', async () => {
        const ce = createClientEnv();
        expect(ce.active).toBe(false);
        const dts = createDevToolsStore(ce.clientAPI);
        expect(ce.active).toBe(true);
        const client = ce.init((trx) => {
            return trx.createStore("TestStore", (store: Store<{ count: number }>) => {
                const data = store.init({
                    count: 0
                });

                return {
                    increment(v: number = 1) {
                        data.count += v;
                    }
                }
            });
        });

        ce.log("A");
        client.increment();
        ce.log("B");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs)).toMatchObject([
            "Cycle #0 0/0",
            "  - !PCG !StoreInit",
            "    - !NEW TestStore(S)",
            "    - !NEW TestStore/root(O)",
            "  - !LOG A",
            "  - !PCG TestStore.increment()",
            "    - !GET TestStore/root.count --> 0",
            "    - !SET TestStore/root.count = 1 (previous: 0)",
            "  - !LOG B",
        ]);

        ce.log("C");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs, 1)).toMatchObject([
            "Cycle #1 0/0",
            "  - !LOG C",
        ]);

        expect(ce.active).toBe(true);
        dts.dispose();
        expect(ce.active).toBe(false);

        ce.log("D");

        await trax.reconciliation();
        expect(printLogs(dts.data.$$logs, 2)).toMatchObject([]);
    });

});

