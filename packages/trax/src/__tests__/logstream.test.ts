import { beforeEach, describe, expect, it } from 'vitest';
import { createLogFormatter, createLogStream, traxEvents } from '../logstream';
import { $LogEntry, $LogStream } from '../types';

describe('LogStream', () => {
    let log: $LogStream;
    let count = 0;
    const internalSrcKey = {};
    const formatter = createLogFormatter(() => "" + (++count), internalSrcKey);

    function error(id: number, msg: string): $LogEntry {
        return { id: "" + id, type: traxEvents.Error, data: msg };
    }

    function printLogs(): string[] {
        const arr: string[] = [];
        log.scan((itm) => {
            arr.push(`${itm.id} ${itm.type} - ${itm.data || "NO-DATA"}`);
        });
        return arr;
    }

    beforeEach(() => {
        count = 0;
        log = createLogStream(formatter);
    });

    describe('LogFormatter', () => {
        let itm: $LogEntry = { id: "", type: "" }

        beforeEach(() => {
            itm = { id: "", type: "" };
        });

        it('should generate errors for invalid types', async () => {
            formatter(itm, "", { foo: "bar" });
            expect(itm).toMatchObject(error(1, "Event type cannot be empty"));
        });

        it('should not accept unauthorized events', async () => {
            formatter(itm, traxEvents.New, { foo: "bar" });
            expect(itm).toMatchObject(error(1, "Event type cannot start with reserved prefix: !NEW"));
        });

        it('should accept authorized events', async () => {
            formatter(itm, traxEvents.New, { foo: "bar" }, internalSrcKey);
            expect(itm).toMatchObject({
                id: "1",
                type: traxEvents.New,
                data: '{"foo":"bar"}'
            });
        });

        it('should accept Info, warning and errors without authorization', async () => {
            formatter(itm, traxEvents.Info, { foo: "bar" });
            expect(itm).toMatchObject({
                id: "1",
                type: traxEvents.Info,
                data: '{"foo":"bar"}'
            });

            formatter(itm, traxEvents.Warning, { foo: "bar" });
            expect(itm).toMatchObject({
                id: "2",
                type: traxEvents.Warning,
                data: '{"foo":"bar"}'
            });

            formatter(itm, traxEvents.Error, { foo: "bar" });
            expect(itm).toMatchObject({
                id: "3",
                type: traxEvents.Error,
                data: '{"foo":"bar"}'
            });
        });

        it('should accept Info, warning and errors with authorization', async () => {
            formatter(itm, traxEvents.Info, { foo: "bar" }, internalSrcKey);
            expect(itm).toMatchObject({
                id: "1",
                type: traxEvents.Info,
                data: '{"foo":"bar"}'
            });

            formatter(itm, traxEvents.Warning, { foo: "bar" }, internalSrcKey);
            expect(itm).toMatchObject({
                id: "2",
                type: traxEvents.Warning,
                data: '{"foo":"bar"}'
            });

            formatter(itm, traxEvents.Error, { foo: "bar" }, internalSrcKey);
            expect(itm).toMatchObject({
                id: "3",
                type: traxEvents.Error,
                data: '{"foo":"bar"}'
            });
        });

        it('should generate error in case of stringification problem', async () => {
            formatter(itm, traxEvents.New, { foo: "bar", fn: BigInt(42) }, internalSrcKey);
            expect(itm).toMatchObject(error(1, "Event strinfication error: TypeError: Do not know how to serialize a BigInt"));
        });
    });

    describe('Events', () => {
        it('should log internal and custom events', async () => {
            expect(log.size).toBe(0);
            log.event("foo.bar");
            expect(log.size).toBe(1);
            log.event("blah", { v: "value" });
            expect(log.size).toBe(2);
            log.event(traxEvents.New, {}, internalSrcKey);
            expect(log.size).toBe(3);

            expect(printLogs()).toMatchObject([
                "1 foo.bar - NO-DATA",
                '2 blah - {"v":"value"}',
                "3 !NEW - {}",
            ]);
        });

        it('should log errors for non authorized events', async () => {
            log.event(traxEvents.New, {}, internalSrcKey);
            log.event(traxEvents.New, {}); // key not provided
            expect(log.size).toBe(2);

            expect(printLogs()).toMatchObject([
                "1 !NEW - {}",
                '2 !ERR - Event type cannot start with reserved prefix: !NEW',
            ]);
        });
    });

    describe('Scan', () => {
        it('should scan until processor return false', async () => {
            log.event("foo.bar");
            log.event("foo.bar");
            log.event("foo.bar");
            log.event("foo.bar");
            expect(log.size).toBe(4);

            expect(printLogs2()).toMatchObject([
                "1 foo.bar - NO-DATA",
                "2 foo.bar - NO-DATA"
            ]);

            function printLogs2(): string[] {
                const arr: string[] = [];
                let count = 0;
                log.scan((itm) => {
                    arr.push(`${itm.id} ${itm.type} - ${itm.data || "NO-DATA"}`);
                    count++;
                    return (count !== 2);
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
                '1 !LOG - "Hello World"',
                '2 !LOG - "Hello Trax !"',
            ]);
        });

        it('should log info messages', async () => {
            log.warning("A", 42, "x");
            log.warning("B", false, null, 321);
            expect(printLogs()).toMatchObject([
                '1 !WRN - "A 42 x"',
                '2 !WRN - "B false null 321"',
            ]);
        });

        it('should log error messages', async () => {
            log.error("Some error", { description: "!!!" });
            log.error({ desc: "Some Error" });
            log.error();
            log.error("Unexpected error");
            expect(printLogs()).toMatchObject([
                '1 !ERR - ["Some error",{"description":"!!!"}]',
                '2 !ERR - {"desc":"Some Error"}',
                '3 !ERR - NO-DATA',
                '4 !ERR - "Unexpected error"',
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
            log.maxSize = 3;
            log.info("A");
            log.info("B");
            log.info("C");
            expect(log.size).toBe(3);
            expect(printLogs()).toMatchObject([
                '1 !LOG - "A"',
                '2 !LOG - "B"',
                '3 !LOG - "C"',
            ]);
            log.info("D");
            expect(log.size).toBe(3);
            expect(printLogs()).toMatchObject([
                '2 !LOG - "B"',
                '3 !LOG - "C"',
                '4 !LOG - "D"',
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
            expect(printLogs()).toMatchObject([
                '3 !LOG - "C"',
                '4 !LOG - "D"',
                '5 !LOG - "E"',
                '6 !LOG - "F"',
                '7 !LOG - "G"',
            ]);
        });

        it('should manage size decrease (max reached)', async () => {
            log.maxSize = 4;
            log.info("A");
            log.info("B");
            log.info("C");
            log.info("D");
            expect(log.size).toBe(4);
            log.maxSize = 3;
            expect(log.size).toBe(3);
            expect(printLogs()).toMatchObject([
                '2 !LOG - "B"',
                '3 !LOG - "C"',
                '4 !LOG - "D"'
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
            expect(log.size).toBe(7);
            log.maxSize = 3;
            expect(log.size).toBe(3);
            expect(printLogs()).toMatchObject([
                '5 !LOG - "E"',
                '6 !LOG - "F"',
                '7 !LOG - "G"'
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
            expect(log.size).toBe(7);
            expect(printLogs()).toMatchObject([
                '1 !LOG - "A"',
                '2 !LOG - "B"',
                '3 !LOG - "C"',
                '4 !LOG - "D"',
                '5 !LOG - "E"',
                '6 !LOG - "F"',
                '7 !LOG - "G"'
            ]);

        });
    });

});
