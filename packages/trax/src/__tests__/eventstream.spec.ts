import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEventStream } from '../eventstream';
import { EventStream, StreamEvent, traxEvents } from '../types';
import { mockGlobalConsole, pause, printEvents, resetGlobalConsole } from './utils';

describe('Event Stream', () => {
    let log: EventStream;
    let count = 0;
    const internalSrcKey = {};

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(log, ignoreCycleEvents, minCycleId);
    }

    function getLogArray() {
        const arr: StreamEvent[] = [];
        log.scan((itm: StreamEvent) => {
            arr.push(itm);
        });
        return arr;
    }

    beforeEach(() => {
        count = 0;
        log = createEventStream(internalSrcKey);
    });

    describe('LogFormatter', () => {
        it('should generate errors for invalid types', async () => {
            log.event("", { foo: "bar" });
            expect(printLogs()).toMatchObject([
                "0:1 !ERR - Event type cannot be empty",
            ]);
        });

        it('should not accept unauthorized events', async () => {
            log.event(traxEvents.New, { foo: "bar" });
            expect(printLogs()).toMatchObject([
                "0:1 !ERR - Event type cannot start with reserved prefix: !NEW",
            ]);
        });

        it('should accept authorized events', async () => {
            log.event(traxEvents.New, { foo: "bar" }, internalSrcKey);
            expect(printLogs()).toMatchObject([
                '0:1 !NEW - {"foo":"bar"}',
            ]);
        });

        it('should accept Info, warning and errors without authorization', async () => {
            log.event(traxEvents.Info, { foo: "bar" });
            log.event(traxEvents.Warning, { foo: "bar" });
            log.event(traxEvents.Error, { foo: "bar" });
            expect(printLogs()).toMatchObject([
                '0:1 !LOG - {foo:bar}',
                '0:2 !WRN - {foo:bar}',
                '0:3 !ERR - {foo:bar}',
            ]);
        });

        it('should accept Info, warning and errors with authorization', async () => {
            log.event(traxEvents.Info, { foo: "bar" }, internalSrcKey);
            log.event(traxEvents.Warning, { foo: "bar" }, internalSrcKey);
            log.event(traxEvents.Error, { foo: "bar" }, internalSrcKey);
            expect(printLogs()).toMatchObject([
                '0:1 !LOG - {foo:bar}',
                '0:2 !WRN - {foo:bar}',
                '0:3 !ERR - {foo:bar}',
            ]);
        });

        it('should generate error in case of stringification problem', async () => {
            log.event(traxEvents.New, { foo: "bar", fn: BigInt(42) } as any, internalSrcKey);
            expect(printLogs()).toMatchObject([
                '0:1 !ERR - Event strinfication error: TypeError: Do not know how to serialize a BigInt',
            ]);
        });
    });

    describe('Events', () => {
        it('should log internal and custom events', async () => {
            expect(log.size).toBe(0);
            log.event("foo.bar");
            expect(log.size).toBe(2); // because of cycle start
            log.event("blah", { v: "value" });
            expect(log.size).toBe(3);
            log.event(traxEvents.New, {}, internalSrcKey);
            expect(log.size).toBe(4);

            expect(printLogs(0, false)).toMatchObject([
                "0:0 !CS - 0",
                "0:1 foo.bar - NO-DATA",
                '0:2 blah - {"v":"value"}',
                "0:3 !NEW - {}",
            ]);
        });

        it('should log errors for non authorized events', async () => {
            log.event(traxEvents.New, {}, internalSrcKey);
            log.event(traxEvents.New, {}); // key not provided
            expect(log.size).toBe(3);

            expect(printLogs()).toMatchObject([
                "0:1 !NEW - {}",
                '0:2 !ERR - Event type cannot start with reserved prefix: !NEW',
            ]);
        });
    });

    describe('Scan', () => {
        it('should scan until processor return false', async () => {
            log.event("foo.bar");
            log.event("foo.bar");
            log.event("foo.bar");
            log.event("foo.bar");
            expect(log.size).toBe(4 + 1);

            expect(printLogs2()).toMatchObject([
                "0:0 !CS - {\"elapsedTime\":0}",
                "0:1 foo.bar - NO-DATA",
                "0:2 foo.bar - NO-DATA"
            ]);

            function printLogs2(): string[] {
                const arr: string[] = [];
                let count = 0;
                log.scan((itm) => {
                    arr.push(`${itm.id} ${itm.type} - ${itm.data || "NO-DATA"}`);
                    count++;
                    return (count !== 3);
                });
                return arr;
            }

        });
    });

    describe('App logs', () => {
        it('should log info messages', async () => {
            log.info("Hello", "World");
            log.info("Hello", "Trax", "!");
            expect(printLogs()).toMatchObject([
                '0:1 !LOG - Hello World',
                '0:2 !LOG - Hello Trax !',
            ]);
        });

        it('should log info messages', async () => {
            log.warn("A", 42, "x");
            log.warn("B", false, null, 321);
            expect(printLogs()).toMatchObject([
                '0:1 !WRN - A 42 x',
                '0:2 !WRN - B false null 321',
            ]);
        });

        it('should log error messages', async () => {
            log.error("Some error", { description: "!!!" });
            log.error({ desc: "Some Error" });
            log.error();
            log.error("Unexpected error");
            expect(printLogs()).toMatchObject([
                '0:1 !ERR - [Some error,{description:!!!}]',
                '0:2 !ERR - {desc:Some Error}',
                '0:3 !ERR - NO-DATA',
                '0:4 !ERR - Unexpected error',
            ]);
        });
    });

    describe('Stream Maxsize', () => {
        it('should have a default maxSize of 1000', async () => {
            expect(log.maxSize).toBe(1000);
        });

        it('should consider negative values as no limits', async () => {
            log.maxSize = 4;
            expect(log.maxSize).toBe(4);
            log.maxSize = -4;
            expect(log.maxSize).toBe(-1);
        });

        it('should not accept values 0 and 1', async () => {
            log.maxSize = 1;
            expect(log.maxSize).toBe(2);
            log.maxSize = 9;
            expect(log.maxSize).toBe(9);
            log.maxSize = 0;
            expect(log.maxSize).toBe(2);
        });

        it('should start rotating entries when max size is reached', async () => {
            log.maxSize = 4;
            log.info("A");
            log.info("B");
            log.info("C");
            expect(log.size).toBe(3 + 1);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !LOG - C',
            ]);
            log.info("D");
            expect(log.size).toBe(3 + 1);
            expect(printLogs(0, false)).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !LOG - C',
                '0:4 !LOG - D',
            ]);
        });

        it('should accept max size increase', async () => {
            log.maxSize = 3;
            log.info("A");
            log.info("B");
            log.info("C");
            log.info("D");
            expect(log.size).toBe(3);
            log.maxSize = 5;
            log.info("E");
            log.info("F");
            log.info("G");
            expect(log.size).toBe(5);
            expect(printLogs(0, false)).toMatchObject([
                '0:3 !LOG - C',
                '0:4 !LOG - D',
                '0:5 !LOG - E',
                '0:6 !LOG - F',
                '0:7 !LOG - G',
            ]);
        });

        it('should manage size decrease (max reached)', async () => {
            log.maxSize = 4;
            log.info("A");
            log.info("B");
            log.info("C");
            expect(log.size).toBe(4);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !LOG - C'
            ]);
            log.maxSize = 2;
            expect(log.size).toBe(2);
            expect(printLogs(0, false)).toMatchObject([
                '0:2 !LOG - B',
                '0:3 !LOG - C'
            ]);
        });

        it('should manage size decrease (max not reached)', async () => {
            log.maxSize = 42;
            log.info("A");
            log.info("B");
            log.info("C");
            log.info("D");
            log.info("E");
            log.info("F");
            log.info("G");
            expect(log.size).toBe(7 + 1);
            log.maxSize = 3;
            expect(log.size).toBe(3);
            expect(printLogs(0, false)).toMatchObject([
                '0:5 !LOG - E',
                '0:6 !LOG - F',
                '0:7 !LOG - G'
            ]);
        });

        it('should support no limits', async () => {
            log.maxSize = -1;
            expect(log.maxSize).toBe(-1);

            log.info("A");
            log.info("B");
            log.info("C");
            log.info("D");
            log.info("E");
            log.info("F");
            log.info("G");
            expect(log.size).toBe(7 + 1);
            await Promise.resolve();
            expect(log.size).toBe(7 + 2);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !LOG - C',
                '0:4 !LOG - D',
                '0:5 !LOG - E',
                '0:6 !LOG - F',
                '0:7 !LOG - G',
                '0:8 !CC - 0',
            ]);

        });
    });

    describe('Cycle ids', () => {
        it('should incremented when a new cycle starts', async () => {
            log.info("A");
            log.info("B");
            await Promise.resolve();
            log.info("C");
            await Promise.resolve();
            // nothing logged here, so no new cycle in the logger
            await Promise.resolve();
            log.warn("D");
            log.info("E");

            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !CC - 0',
                '1:0 !CS - 0',
                '1:1 !LOG - C',
                '1:2 !CC - 0',
                '2:0 !CS - 0',
                '2:1 !WRN - D',
                '2:2 !LOG - E',
            ]);
        });
    });

    describe('Cycle events', () => {
        beforeEach(() => {
            count = 0;
            log = createEventStream(internalSrcKey, undefined, () => {
                log.info("BEFORE CC");
            });
        });

        it('should give elapsed time on cycle start / end', async () => {
            log.info("A");
            log.info("B");
            await pause(10);
            log.info("C");
            await Promise.resolve();
            // nothing logged here, so no new cycle in the logger
            await pause(20);
            log.warn("D");
            log.info("E");

            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !LOG - BEFORE CC',
                '0:4 !CC - 0',
                '1:0 !CS - 0', // >= 10
                '1:1 !LOG - C',
                '1:2 !LOG - BEFORE CC',
                '1:3 !CC - 0',
                '2:0 !CS - 0', // >= 20
                '2:1 !WRN - D',
                '2:2 !LOG - E',
            ]);

            const logs = getLogArray();
            expect(elapsed(0)).toBe(0); // first is always 0
            expect(elapsed(4)).toBeLessThan(10); // probably 0 or 1
            expect(elapsed(5)).toBeGreaterThan(10 - 2)
            expect(elapsed(8)).toBeLessThan(10); // probably 0 or 1
            expect(elapsed(9)).toBeGreaterThan(20 - 2)

            function elapsed(idx: number) {
                return JSON.parse("" + logs[idx]!.data!).elapsedTime;
            }
        });

        it('should return the last stream event', async () => {
            expect(log.lastEvent()).toBe(undefined);

            log.info("A");
            expect(log.lastEvent()!.type).toBe(traxEvents.Info);

            await log.awaitEvent(traxEvents.CycleComplete);
            expect(log.lastEvent()!.type).toBe(traxEvents.CycleComplete);
        });
    });

    describe('Subscription', () => {

        it('should allow to await a specific event', async () => {
            let count = 0, lastEvent: StreamEvent | null = null;

            log.awaitEvent(traxEvents.Warning).then((e) => {
                count++;
                lastEvent = e;
            });

            log.info("A");
            log.info("B");
            expect(count).toBe(0);
            await Promise.resolve(); // cycle ended

            expect(count).toBe(0);
            log.warn("C");
            expect(count).toBe(0);
            log.info("D");
            expect(count).toBe(0);
            log.warn("E"); // 2nd warning but won't trigger any callback
            expect(count).toBe(0);

            await pause(1); // flushes all pending promises
            expect(count).toBe(1);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !CC - 0',
                '1:0 !CS - 0',
                '1:1 !WRN - C',
                '1:2 !LOG - D',
                '1:3 !WRN - E',
                '1:4 !CC - 0',
            ]);
            expect(lastEvent).toMatchObject({
                id: '1:1',
                type: '!WRN',
                data: '"C"' // JSON stringified
            });
        });

        it('should allow to await cycle end', async () => {
            log.info("A");
            log.info("B");
            await log.awaitEvent(traxEvents.CycleComplete);


            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !LOG - B',
                '0:3 !CC - 0'
            ]);
        });

        it('should allow 2 listeners to await the same event', async () => {
            let count1 = 0,
                count2 = 0,
                lastEvent1: StreamEvent | null = null,
                lastEvent2: StreamEvent | null = null;

            log.awaitEvent(traxEvents.Warning).then((e) => {
                count1++;
                lastEvent1 = e;
            });

            log.awaitEvent(traxEvents.Warning).then((e) => {
                count2++;
                lastEvent2 = e;
            });

            log.info("A");
            log.info("B");
            expect(count1).toBe(0);

            await Promise.resolve(); // cycle ended
            log.warn("C");
            log.info("D");
            log.warn("E"); // 2nd warning but won't trigger any callback
            expect(count1).toBe(0);

            await pause(1); // flushes all pending promises
            expect(count1).toBe(1);
            expect(count2).toBe(1);
            expect(lastEvent1).toMatchObject(lastEvent2!);
        });

        it('should allow to await an event matching certain data properties (data object)', async () => {
            let count = 0, lastEvent: StreamEvent | null = null

            log.awaitEvent(traxEvents.ProcessingEnd, { name: "processX" }).then((e) => {
                count++;
                lastEvent = e;
            });

            log.info("A");
            let c = log.startProcessingContext({ name: "processA" });
            log.info("B");
            c.end();

            expect(count).toBe(0);
            await pause(1);
            expect(count).toBe(0); // would be 1 if name filter didn't work

            expect(printLogs()).toMatchObject([
                "0:1 !LOG - A",
                "0:2 !PCS - processA",
                "0:3 !LOG - B",
                "0:4 !PCE - 0:2",
            ]);

            log.info("C");
            let pc = log.startProcessingContext({ name: "processX" })
            pc.end()
            expect(count).toBe(0);
            log.info("D");

            await pause(1);
            expect(count).toBe(1); // was called

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - C",
                "1:2 !PCS - processX",
                "1:3 !PCE - 1:2",
                "1:4 !LOG - D",
            ]);
            expect(JSON.parse((lastEvent as any).data).processId).toBe("1:2")

            log.info("E");
            pc = log.startProcessingContext({ name: "processX" })
            pc.end()
            expect(count).toBe(1);
            log.info("F");

            await pause(1);
            expect(count).toBe(1); // no more calls (awaitEvent is only called once)
        });

        it('should allow to await an event matching certain data properties (object + regexp)', async () => {
            let count = 0, lastEvent: StreamEvent | null = null;

            log.awaitEvent(traxEvents.ProcessingEnd, { name: /process/, src: "abc" }).then((e) => {
                count++;
                lastEvent = e;
            });

            log.info("A");
            let c = log.startProcessingContext({ name: "processA" });
            log.info("B");
            c.end();

            expect(count).toBe(0);
            await pause(1);
            expect(count).toBe(0); // src doesn't match

            expect(printLogs()).toMatchObject([
                "0:1 !LOG - A",
                "0:2 !PCS - processA",
                "0:3 !LOG - B",
                "0:4 !PCE - 0:2",
            ]);

            log.info("C");
            let pc = log.startProcessingContext({ name: "XYZ/processX", src: "abc" });
            pc.end()
            expect(count).toBe(0);
            log.info("D");

            await pause(1);
            expect(count).toBe(1); // was called

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - C",
                "1:2 !PCS - XYZ/processX",
                "1:3 !PCE - 1:2",
                "1:4 !LOG - D",
            ]);
            expect(JSON.parse((lastEvent as any).data).processId).toBe("1:2")

            log.info("E");
            pc = log.startProcessingContext({ name: "XYZ/processX", src: "abc" })
            pc.end()
            expect(count).toBe(1);
            log.info("F");

            await pause(1);
            expect(count).toBe(1); // no more calls (awaitEvent is only called once)
        });

        it('should allow to await an event matching certain data properties (primitive type data)', async () => {
            let count = 0, lastEvent: StreamEvent | null = null

            log.awaitEvent("MyEvent", "MyData").then((e) => {
                count++;
                lastEvent = e;
            });

            log.info("A");
            log.event("MyEvent", "SomeData");
            log.info("B");

            expect(count).toBe(0);
            await pause(1);
            expect(count).toBe(0); // would be 1 if name filter didn't work

            expect(printLogs()).toMatchObject([
                "0:1 !LOG - A",
                "0:2 MyEvent - \"SomeData\"",
                "0:3 !LOG - B",
            ]);

            log.info("C");
            log.event("MyEvent", "MyData");
            expect(count).toBe(0);
            log.info("D");

            await pause(1);
            expect(count).toBe(1); // was called

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - C",
                "1:2 MyEvent - \"MyData\"",
                "1:3 !LOG - D",
            ]);
            expect((lastEvent as any).data).toBe('"MyData"'); // JSON stringified

            log.info("E");
            log.event("MyEvent", "MyData");
            expect(count).toBe(1);
            log.info("F");

            await pause(1);
            expect(count).toBe(1); // no more calls (awaitEvent is only called once)
        });

        it('should ignore await for unmatching types', async () => {
            let count = 0, lastEvent: StreamEvent | null = null

            log.awaitEvent("MyEvent", { value: "MyData" }).then((e) => {
                count++;
                lastEvent = e;
            });

            log.info("A");
            log.event("MyEvent", "MyData");
            log.info("B");

            expect(count).toBe(0);
            await pause(1);
            expect(count).toBe(0); // would be 1 if name filter didn't work

            expect(printLogs()).toMatchObject([
                "0:1 !LOG - A",
                "0:2 MyEvent - \"MyData\"",
                "0:3 !LOG - B",
            ]);
        });

        it('should accept multiple subscriptions with the same callback', async () => {
            let traces = "";
            function cb(e: StreamEvent) {
                traces += e.id + "/" + e.type + ";"
            }

            const s1 = log.subscribe("*", cb);
            log.info("A");
            expect(traces).toBe("0:0/!CS;0:1/!LOG;");

            traces = "";
            const s2 = log.subscribe("*", cb);
            expect(s2).not.toBe(s1);

            log.info("B");
            log.info("C");
            expect(traces).toBe("0:2/!LOG;0:2/!LOG;0:3/!LOG;0:3/!LOG;"); // double logging

            traces = "";
            let r2 = log.unsubscribe(s2);
            expect(r2).toBe(true);
            r2 = log.unsubscribe(s2);
            expect(r2).toBe(false); // already unsubscribed
            const r3 = log.unsubscribe(cb);
            expect(r3).toBe(false);

            log.info("D");
            expect(traces).toBe("0:4/!LOG;");

            traces = "";
            const r1 = log.unsubscribe(s1);
            expect(r1).toBe(true);
            log.info("E");
            expect(traces).toBe("");
        });

        it('should accept mixing * and specific event subscriptions', async () => {
            let traces = "", warnings = "";

            const s1 = log.subscribe("*", (e: StreamEvent) => {
                traces += e.id + "/" + e.type + ";"
            });

            const s2 = log.subscribe(traxEvents.Warning, (e: StreamEvent) => {
                warnings += e.id + "/" + e.type + ";"
            });

            log.info("A");
            expect(traces).toBe("0:0/!CS;0:1/!LOG;");
            expect(warnings).toBe("");
            traces = warnings = "";
            log.warn("B");
            expect(traces).toBe("0:2/!WRN;");
            expect(warnings).toBe("0:2/!WRN;");
            traces = warnings = "";
            log.info("C");
            expect(traces).toBe("0:3/!LOG;");
            expect(warnings).toBe("");
            traces = warnings = "";
            log.warn("D");
            expect(traces).toBe("0:4/!WRN;");
            expect(warnings).toBe("0:4/!WRN;");

            const r1 = log.unsubscribe(s1);
            expect(r1).toBe(true);

            traces = warnings = "";
            log.warn("E");
            expect(traces).toBe("");
            expect(warnings).toBe("0:5/!WRN;");

            await log.awaitEvent(traxEvents.CycleComplete);

            traces = warnings = "";
            log.warn("F");
            expect(traces).toBe("");
            expect(warnings).toBe("1:1/!WRN;");

            const r2 = log.unsubscribe(s2);
            expect(r2).toBe(true);

            traces = warnings = "";
            log.warn("G");
            expect(traces).toBe("");
            expect(warnings).toBe("");
        });

        it('should log an error in case of invalid subscription event', async () => {
            log.info("A");
            await log.awaitEvent("*");
            await log.awaitEvent("");


            expect(printLogs(0, false)).toMatchObject([
                "0:0 !CS - 0",
                "0:1 !LOG - A",
                "0:2 !ERR - [trax/eventStream.await] Invalid event type: '*'",
                "0:3 !CC - 0",
                "1:0 !CS - 0",
                "1:1 !ERR - [trax/eventStream.await] Invalid event type: ''",
                "1:2 !CC - 0",
            ]);
        });
    });

    describe('Processing Context', () => {
        it('should support synchronous contexts', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: 'MyAction' });
            log.info("B");
            log.warn("C");
            c.end();
            log.info("D");

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !PCS - MyAction',
                '0:3 !LOG - B',
                '0:4 !WRN - C',
                '0:5 !PCE - 0:2',
                '0:6 !LOG - D',
            ]);
        });

        it('should have a valid name', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: '!MyAction' });
            log.info("B");
            c.end();
            log.info("D");

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                "0:2 !ERR - Processing Context name cannot start with reserved prefix: !MyAction",
                "0:3 !PCS - MyAction",
                "0:4 !LOG - B",
                "0:5 !PCE - 0:3",
                "0:6 !LOG - D",
            ]);
        });

        it('should support async contexts', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: 'MyAsyncAction' });
            log.info("B");
            log.info("C");
            c.pause();
            log.info("D");

            await log.awaitEvent(traxEvents.CycleComplete);
            c.resume();
            log.info("E");
            c.pause();

            await log.awaitEvent(traxEvents.CycleComplete);
            c.resume();
            log.info("F");
            c.end();
            log.info("G");

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !PCS - MyAsyncAction',
                '0:3 !LOG - B',
                '0:4 !LOG - C',
                '0:5 !PCP - 0:2',
                '0:6 !LOG - D',
                '1:1 !PCR - 0:2',
                '1:2 !LOG - E',
                '1:3 !PCP - 0:2',
                '2:1 !PCR - 0:2',
                '2:2 !LOG - F',
                '2:3 !PCE - 0:2',
                '2:4 !LOG - G',
            ]);
        });

        it('should support contexts into contexts (sync)', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: 'MyAction' });
            log.info("B");
            const sc = log.startProcessingContext({ name: 'SubAction' });
            log.info("C");
            sc.end()
            c.end();
            log.info("D");
            expect(sc)

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !PCS - MyAction',
                '0:3 !LOG - B',
                '0:4 !PCS - SubAction - parentId=0:2',
                '0:5 !LOG - C',
                '0:6 !PCE - 0:4',
                '0:7 !PCE - 0:2',
                '0:8 !LOG - D',
            ]);
        });

        it('should support contexts into contexts (sync/async)', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: 'MyAction' });
            log.info("B");
            const sc = log.startProcessingContext({ name: 'SubAction' });
            log.info("C");
            sc.pause();
            log.info("D");
            c.end();
            log.info("E");

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !PCS - MyAction',
                '0:3 !LOG - B',
                '0:4 !PCS - SubAction - parentId=0:2',
                '0:5 !LOG - C',
                '0:6 !PCP - 0:4',
                '0:7 !LOG - D',
                '0:8 !PCE - 0:2',
                '0:9 !LOG - E',
            ]);
        });

        it('should support contexts into contexts (async/async)', async () => {
            log.info("A");
            const c = log.startProcessingContext({ name: 'MyAction' });
            log.info("B");
            const sc = log.startProcessingContext({ name: 'SubAction' });
            log.info("C");
            sc.pause();
            log.info("D");
            c.pause();
            log.info("E");

            expect(printLogs()).toMatchObject([
                '0:1 !LOG - A',
                '0:2 !PCS - MyAction',
                '0:3 !LOG - B',
                '0:4 !PCS - SubAction - parentId=0:2',
                '0:5 !LOG - C',
                '0:6 !PCP - 0:4',
                '0:7 !LOG - D',
                '0:8 !PCP - 0:2',
                '0:9 !LOG - E',
            ]);
        });

        describe('Console output', () => {

            afterEach(() => {
                resetGlobalConsole();
            });

            it('should support console output', async () => {
                expect(log.consoleOutput).toBe("None");
                const logs = mockGlobalConsole();
                log.consoleOutput = "All";
                expect(log.consoleOutput).toBe("All");

                log.info("A");
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.warn("B");
                const sc = log.startProcessingContext({ name: 'SubAction' });
                log.error("C");
                sc.pause();
                log.info("D");

                c.end();
                log.info("E");
                log.event("MyEvent", null);

                expect(log.consoleOutput).toBe("All");
                log.consoleOutput = "None";
                expect(log.consoleOutput).toBe("None");

                expect(logs).toMatchObject([
                    "0:1 !LOG - A",
                    "0:2 !PCS - MyAction",
                    "0:3 !WRN - B",
                    "0:4 !PCS - SubAction - parent:0:2",
                    "0:5 !ERR - C",
                    "0:6 !PCP - 0:4",
                    "0:7 !LOG - D",
                    "0:8 !PCE - 0:2",
                    "0:9 !LOG - E",
                    "0:10 MyEvent - null",
                ]);
                resetGlobalConsole();
            });
        });

        describe('Errors', () => {
            it('should be raised if pause() is done after end()', async () => {
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("A");
                c.end();
                log.info("B");
                c.pause();

                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - MyAction',
                    '0:2 !LOG - A',
                    '0:3 !PCE - 0:1',
                    '0:4 !LOG - B',
                    '0:5 !ERR - [trax/processing context] Only started or resumed contexts can be paused: 0:1',
                ]);
            });

            it('should be raised if end() is done after end()', async () => {
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("A");
                c.end();
                log.info("B");
                c.end();

                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - MyAction',
                    '0:2 !LOG - A',
                    '0:3 !PCE - 0:1',
                    '0:4 !LOG - B',
                    '0:5 !ERR - [trax/processing context] Contexts cannot be ended twice: 0:1',
                ]);
            });

            it('should be raised if resume() is improperly called', async () => {
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("A");
                c.resume();
                log.info("B");
                c.end();
                c.resume();

                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - MyAction',
                    '0:2 !LOG - A',
                    '0:3 !ERR - [trax/processing context] Only paused contexts can be resumed: 0:1',
                    '0:4 !LOG - B',
                    '0:5 !PCE - 0:1',
                    '0:6 !ERR - [trax/processing context] Only paused contexts can be resumed: 0:1',
                ]);
            });

            it('should be raised is end() or pause() is not called at cycle end', async () => {
                log.info("A");
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("B");
                log.warn("C");
                await log.awaitEvent(traxEvents.CycleComplete);

                expect(printLogs()).toMatchObject([
                    '0:1 !LOG - A',
                    '0:2 !PCS - MyAction',
                    '0:3 !LOG - B',
                    '0:4 !WRN - C',
                    '0:5 !ERR - [trax/processing context] Contexts must be ended or paused before cycle ends: 0:2',
                ]);
            });

            it('should be raised is end() or pause() is not called at cycle end (sub-processing context)', async () => {
                log.info("A");
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("B");
                const cs = log.startProcessingContext({ name: 'SubAction' });
                log.warn("C");
                await log.awaitEvent(traxEvents.CycleComplete);

                expect(printLogs()).toMatchObject([
                    '0:1 !LOG - A',
                    '0:2 !PCS - MyAction',
                    '0:3 !LOG - B',
                    '0:4 !PCS - SubAction - parentId=0:2',
                    '0:5 !WRN - C',
                    '0:6 !ERR - [trax/processing context] Contexts must be ended or paused before cycle ends: 0:4',
                    '0:7 !ERR - [trax/processing context] Contexts must be ended or paused before cycle ends: 0:2',
                ]);
            });

            it('should be raised if sub-context is not closed before parent context (sync)', async () => {
                log.info("A");
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("B");
                const cs = log.startProcessingContext({ name: 'SubAction' });
                log.warn("C");
                c.end();
                await log.awaitEvent(traxEvents.CycleComplete);

                expect(printLogs()).toMatchObject([
                    '0:1 !LOG - A',
                    '0:2 !PCS - MyAction',
                    '0:3 !LOG - B',
                    '0:4 !PCS - SubAction - parentId=0:2',
                    '0:5 !WRN - C',
                    '0:6 !ERR - [trax/processing context] Contexts must be ended or paused before parent: 0:4',
                    '0:7 !PCE - 0:2'
                ]);
            });

            it('should be raised if sub-context is not closed before parent context (async)', async () => {
                log.info("A");
                const c = log.startProcessingContext({ name: 'MyAction' });
                log.info("B");
                const cs = log.startProcessingContext({ name: 'SubAction' });
                log.warn("C");
                c.pause();
                await log.awaitEvent(traxEvents.CycleComplete);

                expect(printLogs()).toMatchObject([
                    '0:1 !LOG - A',
                    '0:2 !PCS - MyAction',
                    '0:3 !LOG - B',
                    '0:4 !PCS - SubAction - parentId=0:2',
                    '0:5 !WRN - C',
                    '0:6 !ERR - [trax/processing context] Contexts must be ended or paused before parent: 0:4',
                    '0:7 !PCP - 0:2'
                ]);
            });
        });

    });

});
