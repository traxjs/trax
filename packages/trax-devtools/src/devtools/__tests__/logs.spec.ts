import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store, Trax, trax, traxEvents } from '@traxjs/trax';
import { createClientEnv } from './clientmock';
import { createDevToolsStore, DevToolsStore } from '../devtoolsstore';
import { DtDevToolsData, DtLogCycle, DtLogEvent, DtTraxPgCollectionUpdate, DtTraxPgCompute, DtTraxPgStoreInit } from '../types';
import { createPStore, EVENT_GET_AVATAR_COMPLETE } from './utils';

describe('Logs', () => {
    let ce: ReturnType<typeof createClientEnv>, dts: DevToolsStore, output = "", logFilters: DtDevToolsData["logFilters"];

    beforeEach(() => {
        ce = createClientEnv();
        dts = createDevToolsStore(ce.clientAPI);
        logFilters = dts.data.logFilters;
    });

    afterEach(() => {
        dts.dispose();
    })

    function printLogs(logs: DtLogCycle[], minCycleId = 0, viewMode = false) {
        const r: string[] = [];

        for (const cycle of logs) {
            if (cycle.cycleId >= minCycleId) {
                const ems = cycle.elapsedMs < 20 ? 0 : cycle.elapsedMs;
                const cms = cycle.computeMs < 20 ? 0 : cycle.computeMs;
                if (viewMode) {
                    if (cycle.matchFilter) {
                        const exp = cycle.expanded ? "▼ " : "▶ ";
                        r.push(`${exp}[${cycle.contentSize}] Cycle #${cycle.cycleId} ${ems}/${cms}`);
                        if (cycle.expanded) {
                            printEvents(cycle.events, "  ", r, true);
                        }
                    }
                } else {
                    r.push(`Cycle #${cycle.cycleId} ${ems}/${cms}`);
                    printEvents(cycle.events, "  ", r);
                }
            }
        }
        return r;
    }

    function printEvents(events: DtLogEvent[], prefix: string, r: string[], viewMode = false) {
        for (const e of events) {
            const tp = e.type;
            if (viewMode && !e.matchFilter) {
                continue;
            }
            if (tp === traxEvents.Get) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}.${e.propName} --> ${e.propValue}`);
            } else if (tp === traxEvents.Set) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}.${e.propName} = ${e.toValue} (previous: ${e.fromValue})`);
            } else if (tp === traxEvents.Error || tp === traxEvents.Info || tp === traxEvents.Warning) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.data}`);
            } else if (tp === traxEvents.New) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}(${e.objectType})`);
            } else if (tp === traxEvents.Dispose) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}`);
            } else if (tp === traxEvents.ProcessorDirty) {
                r.push(`${prefix}- ${e.id} ${tp} ${e.objectId}.${e.propName} => ${e.processorId}`);
            } else if (tp === "!PCG") {
                const as = e.async ? " ASYNC" : "";
                const rs = e.resume ? ":RESUME" : "";
                let exp = "-";
                if (viewMode && e.contentSize > 0) {
                    exp = e.expanded ? "▼" : "▶";
                }
                if (e.name === "!StoreInit") {
                    const evt = e as DtTraxPgStoreInit;
                    r.push(`${prefix}${exp} ${e.id} ${tp} !StoreInit${rs} ${evt.storeId}${as}`);
                } else if (e.name === "!Compute") {
                    const evt = e as DtTraxPgCompute;
                    const renderer = evt.isRenderer ? " RENDERER" : "";
                    r.push(`${prefix}${exp} ${e.id} ${tp} !Compute${rs} ${evt.processorId} (${evt.trigger}) #${evt.computeCount} P${evt.processorPriority}${renderer}${as}`);
                } else if (e.name === "!ArrayUpdate" || e.name === "!DictionaryUpdate") {
                    const evt = e as DtTraxPgCollectionUpdate;
                    r.push(`${prefix}${exp} ${e.id} ${tp} ${evt.name}${rs} ${evt.objectId}${as}`);
                } else {
                    r.push(`${prefix}${exp} ${e.id} ${tp} ${e.name}${rs}${as}`);
                }

                if (!viewMode) {
                    if (e.events) {
                        printEvents(e.events, "  " + prefix, r);
                    }
                } else {
                    if (e.expanded) {
                        if (e.events) {
                            printEvents(e.events, "  " + prefix, r, true);
                        }
                    }
                }

            } else if (tp === "!EVT") {
                let d = e.data !== '' ? JSON.stringify(e.data) : '';
                if (d) {
                    d = " data:" + d.replace(/\"/g, "'");
                }
                r.push(`${prefix}- ${e.id} ${tp} ${e.eventType}${d}`);
            } else {
                r.push(`Unknown type: ${tp}`);
            }
        }
    }

    function logComputeCount(cycleId: number) {
        const pr = trax.getProcessor(dts.id + "%LogView:" + cycleId);
        return pr ? pr.computeCount : 0;
    }

    function expandCycle(idx: number, expanded: boolean) {
        const logs = dts.data.logs, len = logs.length;
        if (idx < len) {
            logs[idx].expanded = expanded;
        }
    }

    function expandPCG(id: string, expanded: boolean) {
        const m = id.match(/^(\d+)\:/);
        if (m) {
            const cycleId = parseInt(m[1], 10);
            const logs = dts.data.logs, len = logs.length;
            for (let i = 0; len > i; i++) {
                if (logs[i].cycleId === cycleId) {
                    const e = findEvent(id, logs[i].events)
                    if (e && e.type === "!PCG") {
                        e.expanded = expanded;
                    }
                    return;
                }
            }
        }

        function findEvent(id: string, events?: DtLogEvent[]): DtLogEvent | null {
            if (!events) return null;
            const len = events.length;
            for (const e of events) {
                if (e.id === id) return e;
                if (e.type === "!PCG") {
                    const e2 = findEvent(id, e.events);
                    if (e2) return e2;
                }
            }
            return null;
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

    function testStore2(trax: Trax) {
        return trax.createStore("TestStore", (store: Store<{ count: number; min: number; max: number }>) => {
            const data = store.init({
                count: 0,
                min: 0,
                max: 0
            });

            store.compute("MinMax", () => {
                let min = Number.MAX_SAFE_INTEGER, max = Number.MIN_SAFE_INTEGER;
                const count = data.count;
                if (count < min) {
                    min = count;
                }
                if (count > max) {
                    max = count;
                }
                data.min = min;
                data.max = max;
            });

            store.compute("Render", () => {
                output = `${data.min} <= ${data.count} <= ${data.max}`;
            }, true, true);

            return {
                data,
                increment(v: number = 1) {
                    data.count += v;
                }
            }
        });
    }

    describe('Basics', () => {
        it('should be activated/deactivated when the devtools start/stop', async () => {
            ce = createClientEnv();
            expect(ce.active).toBe(false);
            dts = createDevToolsStore(ce.clientAPI);
            expect(ce.active).toBe(true);
            const client = ce.init(testStore1);

            ce.log("A");
            ce.log("B");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "  - 0:5 !LOG A",
                "  - 0:6 !LOG B",
            ]);
            ce.log("C");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 1)).toMatchObject([
                "Cycle #1 0/0",
                "  - 1:1 !LOG C",
            ]);

            expect(ce.active).toBe(true);
            dts.dispose();
            expect(ce.active).toBe(false);

            ce.log("D");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 2)).toMatchObject([]);
            client.increment();
        });

        it('should support info/warning/error logs', async () => {
            ce.init(testStore1);

            await trax.reconciliation();
            ce.trx.log.info("Info Msg");
            ce.trx.log.warn("Warning Msg");
            ce.trx.log.error("Error Msg");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 1)).toMatchObject([
                "Cycle #1 0/0",
                "  - 1:1 !LOG Info Msg",
                "  - 1:2 !WRN Warning Msg",
                "  - 1:3 !ERR Error Msg",
            ]);
        });

        it('should support custom events', async () => {
            ce.init(testStore1);

            await trax.reconciliation();
            ce.log("A");
            ce.trx.log.event("CUSTOM EVENT", { v1: "value1", v2: 123, v3: true });
            ce.log("B");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 1)).toMatchObject([
                "Cycle #1 0/0",
                "  - 1:1 !LOG A",
                "  - 1:2 !EVT CUSTOM EVENT data:{'v1':'value1','v2':123,'v3':true}",
                "  - 1:3 !LOG B",
            ]);
        });
    });

    describe('Processing Context Groups', () => {
        it('should be created for store actions (app)', async () => {
            const client = ce.init(testStore1);
            expect(client.data.count).toBe(0);

            ce.log("A");
            client.increment();
            ce.log("B");
            expect(client.data.count).toBe(1);

            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "  - 0:5 !GET TestStore/root.count --> 0",
                "  - 0:6 !LOG A",
                "  - 0:7 !PCG TestStore.increment()",
                "    - 0:8 !GET TestStore/root.count --> 0",
                "    - 0:9 !SET TestStore/root.count = 1 (previous: 0)",
                "    - 0:10 !LOG Log in increment",
                "  - 0:12 !LOG B",
                "  - 0:13 !GET TestStore/root.count --> 1",
            ]);

            ce.log("C");
            client.increment(2);
            expect(client.data.count).toBe(3);

            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 1)).toMatchObject([
                "Cycle #1 0/0",
                "  - 1:1 !LOG C",
                "  - 1:2 !PCG TestStore.increment()",
                "    - 1:3 !GET TestStore/root.count --> 1",
                "    - 1:4 !SET TestStore/root.count = 3 (previous: 1)",
                "    - 1:5 !LOG Log in increment",
                "  - 1:7 !GET TestStore/root.count --> 3",
            ]);
        });

        it('should be created for Processor Compute & Reconciliation', async () => {
            const client = ce.init(testStore2);

            ce.log("A");
            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore%MinMax(P)",
                "    - 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "      - 0:6 !GET TestStore/root.count --> 0",
                "    - 0:8 !NEW TestStore%Render(P)",
                "    - 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "      - 0:10 !GET TestStore/root.min --> 0",
                "      - 0:11 !GET TestStore/root.count --> 0",
                "      - 0:12 !GET TestStore/root.max --> 0",
                "  - 0:15 !LOG A",
            ]);

            client.increment(3);
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 1)).toMatchObject([
                "Cycle #1 0/0",
                "  - 1:1 !PCG TestStore.increment()",
                "    - 1:2 !GET TestStore/root.count --> 0",
                "    - 1:3 !SET TestStore/root.count = 3 (previous: 0)",
                "    - 1:4 !DRT TestStore/root.count => TestStore%MinMax",
                "    - 1:5 !DRT TestStore/root.count => TestStore%Render",
                "  - 1:7 !PCG !Reconciliation",
                "    - 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
                "      - 1:9 !GET TestStore/root.count --> 3",
                "      - 1:10 !SET TestStore/root.min = 3 (previous: 0)",
                "      - 1:11 !SET TestStore/root.max = 3 (previous: 0)",
                "    - 1:13 !PCG !Compute TestStore%Render (Reconciliation) #2 P2 RENDERER",
                "      - 1:14 !GET TestStore/root.min --> 3",
                "      - 1:15 !GET TestStore/root.count --> 3",
                "      - 1:16 !GET TestStore/root.max --> 3",
            ]);

            client.dispose();
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 2)).toMatchObject([
                "Cycle #2 0/0",
                "  - 2:1 !DEL TestStore/root",
                "  - 2:2 !DEL TestStore%MinMax",
                "  - 2:3 !DEL TestStore%Render",
                "  - 2:4 !DEL TestStore",
            ]);

        });

        it('should support async processors', async () => {
            const client = ce.init(createPStore);

            await ce.trx.log.awaitEvent(EVENT_GET_AVATAR_COMPLETE);
            await ce.trx.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit PStore",
                "    - 0:2 !NEW PStore(S)",
                "    - 0:3 !NEW PStore/root(O)",
                "    - 0:4 !NEW PStore%PrettyName(P)",
                "    - 0:5 !PCG !Compute PStore%PrettyName (Init) #1 P1 ASYNC", // ASYNC DETECTED
                "      - 0:6 !GET PStore/root.firstName --> Homer",
                "      - 0:7 !GET PStore/root.lastName --> Simpson",
                "      - 0:8 !SET PStore/root.prettyName = Homer Simpson (previous: undefined)",
                "      - 0:9 !SET PStore/root.prettyNameLength = 13 (previous: undefined)",
                "      - 0:10 !GET PStore/root.firstName --> Homer",
                "Cycle #1 0/0",
                "  - 1:1 !EVT @traxjs/trax-devtools/test/getAvatarComplete",
                "Cycle #2 0/0",
                "  - 2:1 !PCG !Compute:RESUME PStore%PrettyName (Init) #1 P1 ASYNC",
                "    - 2:2 !SET PStore/root.avatar = Avatar(Homer) (previous: undefined)",
            ]);
        });

        it('should support Array update', async () => {
            ce.init((trax: Trax) => trax.createStore("TestStore", (store: Store<any>) => {
                const data = store.init({
                    items: []
                });
                trax.updateArray(data.items, ["a", "b", "c"]);
            }));

            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore/root*items(A)",
                "    - 0:5 !GET TestStore/root.items --> [TRAX TestStore/root*items]",
                "    - 0:6 !PCG !ArrayUpdate TestStore/root*items",
                "      - 0:7 !GET TestStore/root*items.length --> 0",
                "      - 0:8 !SET TestStore/root*items.0 = a (previous: undefined)",
                "      - 0:9 !SET TestStore/root*items.1 = b (previous: undefined)",
                "      - 0:10 !SET TestStore/root*items.2 = c (previous: undefined)",
            ]);
        });

        it('should support Dictionary update', async () => {
            ce.init((trax: Trax) => trax.createStore("TestStore", (store: Store<any>) => {
                const data = store.init({
                    dict: {}
                });
                trax.updateDictionary(data.dict, { a: "ValueA", b: "ValueB" });
            }));

            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore/root*dict(O)",
                "    - 0:5 !GET TestStore/root.dict --> [TRAX TestStore/root*dict]",
                "    - 0:6 !PCG !DictionaryUpdate TestStore/root*dict",
                "      - 0:7 !GET TestStore/root*dict.☆trax.dictionary.size☆ --> 0",
                "      - 0:8 !SET TestStore/root*dict.a = ValueA (previous: undefined)",
                "      - 0:9 !SET TestStore/root*dict.b = ValueB (previous: undefined)",
            ]);
        });
    });

    describe('Errors and warnings', () => {
        it('should be ingested when a missing cycle is detected', async () => {
            ce.init(testStore1);
            ce.skipCycle(1);
            ce.trx.log.info("Info Msg in Cycle 0");

            await trax.reconciliation();
            ce.trx.log.info("Info Msg in Cycle 1");

            await trax.reconciliation();
            ce.trx.log.info("Info Msg in Cycle 2");

            await trax.reconciliation();
            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "  - 0:5 !LOG Info Msg in Cycle 0",
                "Cycle #1 0/0",
                "  - 1:1 !ERR Missing log cycles detected: expected cycle #1 instead of #2",
                "Cycle #2 0/0",
                "  - 2:1 !LOG Info Msg in Cycle 2",
            ]);
        });
    });

    describe('Filters', () => {
        it('should start with default values', async () => {
            const client = ce.init(testStore2);
            await trax.reconciliation();

            expect(dts.data.logFilters.key).toBe("YNNN");

            expect(printLogs(dts.data.logs)).toMatchObject([
                "Cycle #0 0/0",
                "  - 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore%MinMax(P)",
                "    - 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "      - 0:6 !GET TestStore/root.count --> 0",
                "    - 0:8 !NEW TestStore%Render(P)",
                "    - 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "      - 0:10 !GET TestStore/root.min --> 0",
                "      - 0:11 !GET TestStore/root.count --> 0",
                "      - 0:12 !GET TestStore/root.max --> 0",
            ]);

            // No new / no get
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
            ]);



            logFilters.includeNew = true;
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
            ]);

            logFilters.includeNew = false;
            logFilters.includePropertyGet = true;
            logFilters.includeEmptyProcessingGroups = false;
            await trax.reconciliation();
            expect(dts.data.logFilters.key).toBe("NYNN");
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
            ]);

            client.increment(1);
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
                "▼ [2] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▶ 1:7 !PCG !Reconciliation",
            ]);

            logFilters.includePropertyGet = false;
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [2] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▶ 1:7 !PCG !Reconciliation",
            ]);
        });

        it('should allow to expand content views', async () => {
            const client = ce.init(testStore2);
            await trax.reconciliation();

            expect(dts.data.logFilters.key).toBe("YNNN");

            // No new / no get
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
            ]);

            expandPCG("0:1", true);
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [3] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    - 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "    - 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
            ]);

            logFilters.includeNew = true;
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [7] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore%MinMax(P)",
                "    - 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "    - 0:8 !NEW TestStore%Render(P)",
                "    - 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
            ]);

            logFilters.includeNew = false;
            logFilters.includePropertyGet = true;
            logFilters.includeEmptyProcessingGroups = false;
            await trax.reconciliation();
            expect(dts.data.logFilters.key).toBe("NYNN");
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [3] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    ▶ 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "    ▶ 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
            ]);
            expandPCG("0:9", true);
            expandPCG("0:5", true);
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [7] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    ▼ 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "      - 0:6 !GET TestStore/root.count --> 0",
                "    ▼ 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "      - 0:10 !GET TestStore/root.min --> 0",
                "      - 0:11 !GET TestStore/root.count --> 0",
                "      - 0:12 !GET TestStore/root.max --> 0",
            ]);

            client.increment(1);
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [7] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    ▼ 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "      - 0:6 !GET TestStore/root.count --> 0",
                "    ▼ 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "      - 0:10 !GET TestStore/root.min --> 0",
                "      - 0:11 !GET TestStore/root.count --> 0",
                "      - 0:12 !GET TestStore/root.max --> 0",
                "▼ [2] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▶ 1:7 !PCG !Reconciliation",
            ]);
            expandPCG("1:7", true);
            expandPCG("1:13", true);
            await trax.reconciliation();

            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [7] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    ▼ 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "      - 0:6 !GET TestStore/root.count --> 0",
                "    ▼ 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "      - 0:10 !GET TestStore/root.min --> 0",
                "      - 0:11 !GET TestStore/root.count --> 0",
                "      - 0:12 !GET TestStore/root.max --> 0",
                "▼ [7] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▼ 1:7 !PCG !Reconciliation",
                "    ▶ 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
                "    ▼ 1:13 !PCG !Compute TestStore%Render (Reconciliation) #2 P2 RENDERER",
                "      - 1:14 !GET TestStore/root.min --> 1",
                "      - 1:15 !GET TestStore/root.count --> 1",
                "      - 1:16 !GET TestStore/root.max --> 1",
            ]);

            expandPCG("0:1", false);
            expandPCG("1:7", false);
            await trax.reconciliation();

            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
                "▼ [2] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▶ 1:7 !PCG !Reconciliation",
            ]);

            expandPCG("1:7", true);
            await trax.reconciliation();

            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
                "▼ [7] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▼ 1:7 !PCG !Reconciliation",
                "    ▶ 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
                "    ▼ 1:13 !PCG !Compute TestStore%Render (Reconciliation) #2 P2 RENDERER", // still open
                "      - 1:14 !GET TestStore/root.min --> 1",
                "      - 1:15 !GET TestStore/root.count --> 1",
                "      - 1:16 !GET TestStore/root.max --> 1",
            ]);

            logFilters.includePropertyGet = false;
            await trax.reconciliation();
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [3] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▼ 1:7 !PCG !Reconciliation",
                "    ▶ 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
            ]);
        });

        it('should support resetFilters()', async () => {
            const client = ce.init(testStore2);
            await trax.reconciliation();
            client.increment(42);
            await trax.reconciliation();

            const startKey = "YNNN";

            expect(logFilters.key).toBe(startKey);
            dts.resetFilters(); await trax.reconciliation();
            expect(logFilters.key).toBe(startKey); // no changes

            expect(logComputeCount(0)).toBe(1);
            expect(logComputeCount(1)).toBe(1);


            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [1] Cycle #0 0/0",
                "  ▶ 0:1 !PCG !StoreInit TestStore",
                "▼ [2] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▶ 1:7 !PCG !Reconciliation",
            ]);

            expandPCG("0:1", true);
            expandPCG("1:7", true);
            await trax.reconciliation();

            const startLogs = [
                "▼ [3] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    - 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "    - 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "▼ [4] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▼ 1:7 !PCG !Reconciliation",
                "    ▶ 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
                "    - 1:13 !PCG !Compute TestStore%Render (Reconciliation) #2 P2 RENDERER",
            ];
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject(startLogs);

            logFilters.includeEmptyProcessingGroups = false;
            logFilters.includeDispose = true;
            logFilters.includeNew = true;
            logFilters.includePropertyGet = true;

            await trax.reconciliation();

            expect(logComputeCount(0)).toBe(3);
            expect(logComputeCount(1)).toBe(3);

            expect(logFilters.key).toBe("NYYY");
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject([
                "▼ [7] Cycle #0 0/0",
                "  ▼ 0:1 !PCG !StoreInit TestStore",
                "    - 0:2 !NEW TestStore(S)",
                "    - 0:3 !NEW TestStore/root(O)",
                "    - 0:4 !NEW TestStore%MinMax(P)",
                "    ▶ 0:5 !PCG !Compute TestStore%MinMax (Init) #1 P1",
                "    - 0:8 !NEW TestStore%Render(P)",
                "    ▶ 0:9 !PCG !Compute TestStore%Render (Init) #1 P2 RENDERER",
                "▼ [4] Cycle #1 0/0",
                "  ▶ 1:1 !PCG TestStore.increment()",
                "  ▼ 1:7 !PCG !Reconciliation",
                "    ▶ 1:8 !PCG !Compute TestStore%MinMax (Reconciliation) #2 P1",
                "    ▶ 1:13 !PCG !Compute TestStore%Render (Reconciliation) #2 P2 RENDERER", 
            ]);

            dts.resetFilters();
            await trax.reconciliation();
            expect(logComputeCount(0)).toBe(4);
            expect(logComputeCount(1)).toBe(4);
            expect(logComputeCount(2)).toBe(0);
            expect(logFilters.key).toBe(startKey);
            expect(printLogs(dts.data.logs, 0, true)).toMatchObject(startLogs);

            client.increment(12);
            await trax.reconciliation();
            expect(logComputeCount(0)).toBe(4);
            expect(logComputeCount(1)).toBe(4);
            expect(logComputeCount(2)).toBe(1); // new log added without triggering new compute on previous logs
        });
    });

    // TODO: filters e.g. objectId (store / data / processor)

});

