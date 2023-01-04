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

    it('should accept internal and custom events', async () => {
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

    it('should have a default maxSize of 500', async () => {
        expect(log.maxSize).toBe(500);
    });
});
