import { beforeEach, describe, expect, it } from 'vitest';
import { createLogStream, traxEvents } from '../logstream';
import { $LogEntry, $LogStream } from '../types';

describe('LogStream', () => {
    let log: $LogStream;
    let count = 0;
    const internalSrcKey = {};

    function printLogs(ignoreTaskEvents = true): string[] {
        const arr: string[] = [];
        log.scan((itm) => {
            if (!ignoreTaskEvents || (itm.type !== traxEvents.TaskStart && itm.type !== traxEvents.TaskComplete)) {
                if ((itm.type === traxEvents.TaskStart || itm.type === traxEvents.TaskComplete)) {
                    // item.data is a string - e.g.: '{"elapsedTime":0}'
                    itm.data = ("" + itm.data).replace(/"elapsedTime":\n+/, 'elapsedTime":0');
                }
                arr.push(`${itm.id} ${itm.type} - ${itm.data || "NO-DATA"}`);
            }
        });
        return arr;
    }

    beforeEach(() => {
        count = 0;
        log = createLogStream(internalSrcKey);
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
                '0:1 !LOG - {"foo":"bar"}',
                '0:2 !WRN - {"foo":"bar"}',
                '0:3 !ERR - {"foo":"bar"}',
            ]);
        });

        it('should accept Info, warning and errors with authorization', async () => {
            log.event(traxEvents.Info, { foo: "bar" }, internalSrcKey);
            log.event(traxEvents.Warning, { foo: "bar" }, internalSrcKey);
            log.event(traxEvents.Error, { foo: "bar" }, internalSrcKey);
            expect(printLogs()).toMatchObject([
                '0:1 !LOG - {"foo":"bar"}',
                '0:2 !WRN - {"foo":"bar"}',
                '0:3 !ERR - {"foo":"bar"}',
            ]);
        });

        it('should generate error in case of stringification problem', async () => {
            log.event(traxEvents.New, { foo: "bar", fn: BigInt(42) }, internalSrcKey);
            expect(printLogs()).toMatchObject([
                '0:1 !ERR - Event strinfication error: TypeError: Do not know how to serialize a BigInt',
            ]);
        });
    });

    describe('Events', () => {
        it('should log internal and custom events', async () => {
            expect(log.size).toBe(0);
            log.event("foo.bar");
            expect(log.size).toBe(2); // because of task start
            log.event("blah", { v: "value" });
            expect(log.size).toBe(3);
            log.event(traxEvents.New, {}, internalSrcKey);
            expect(log.size).toBe(4);

            expect(printLogs(false)).toMatchObject([
                "0:0 !TS - {\"elapsedTime\":0}",
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
                "0:0 !TS - {\"elapsedTime\":0}",
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
                '0:1 !LOG - "Hello World"',
                '0:2 !LOG - "Hello Trax !"',
            ]);
        });

        it('should log info messages', async () => {
            log.warning("A", 42, "x");
            log.warning("B", false, null, 321);
            expect(printLogs()).toMatchObject([
                '0:1 !WRN - "A 42 x"',
                '0:2 !WRN - "B false null 321"',
            ]);
        });

        it('should log error messages', async () => {
            log.error("Some error", { description: "!!!" });
            log.error({ desc: "Some Error" });
            log.error();
            log.error("Unexpected error");
            expect(printLogs()).toMatchObject([
                '0:1 !ERR - ["Some error",{"description":"!!!"}]',
                '0:2 !ERR - {"desc":"Some Error"}',
                '0:3 !ERR - NO-DATA',
                '0:4 !ERR - "Unexpected error"',
            ]);
        });
    });

    describe('Stream Maxsize', () => {
        it('should have a default maxSize of 500', async () => {
            expect(log.maxSize).toBe(500);
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
            expect(printLogs(false)).toMatchObject([
                '0:0 !TS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !LOG - "B"',
                '0:3 !LOG - "C"',
            ]);
            log.info("D");
            expect(log.size).toBe(3 + 1);
            expect(printLogs(false)).toMatchObject([
                '0:1 !LOG - "A"',
                '0:2 !LOG - "B"',
                '0:3 !LOG - "C"',
                '0:4 !LOG - "D"',
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
            expect(printLogs(false)).toMatchObject([
                '0:3 !LOG - "C"',
                '0:4 !LOG - "D"',
                '0:5 !LOG - "E"',
                '0:6 !LOG - "F"',
                '0:7 !LOG - "G"',
            ]);
        });

        it('should manage size decrease (max reached)', async () => {
            log.maxSize = 4;
            log.info("A");
            log.info("B");
            log.info("C");
            expect(log.size).toBe(4);
            expect(printLogs(false)).toMatchObject([
                '0:0 !TS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !LOG - "B"',
                '0:3 !LOG - "C"'
            ]);
            log.maxSize = 2;
            expect(log.size).toBe(2);
            expect(printLogs(false)).toMatchObject([
                '0:2 !LOG - "B"',
                '0:3 !LOG - "C"'
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
            expect(printLogs(false)).toMatchObject([
                '0:5 !LOG - "E"',
                '0:6 !LOG - "F"',
                '0:7 !LOG - "G"'
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
            expect(printLogs(false)).toMatchObject([
                '0:0 !TS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !LOG - "B"',
                '0:3 !LOG - "C"',
                '0:4 !LOG - "D"',
                '0:5 !LOG - "E"',
                '0:6 !LOG - "F"',
                '0:7 !LOG - "G"',
                '0:8 !TC - {"elapsedTime":0}',
            ]);

        });
    });

    describe('Task ids', () => {
        it('should be incremented when a new task starts', async () => {
            log.info("A");
            log.info("B");
            await Promise.resolve();
            log.info("C");
            await Promise.resolve();
            // nothing logged here, so no new task in the logger
            await Promise.resolve();
            log.warning("D");
            log.info("E");

            expect(printLogs(false)).toMatchObject([
                '0:0 !TS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !LOG - "B"',
                '0:3 !TC - {"elapsedTime":0}',
                '1:0 !TS - {"elapsedTime":0}',
                '1:1 !LOG - "C"',
                '1:2 !TC - {"elapsedTime":0}',
                '2:0 !TS - {"elapsedTime":0}',
                '2:1 !WRN - "D"',
                '2:2 !LOG - "E"',
            ]);
        });
    });

});
