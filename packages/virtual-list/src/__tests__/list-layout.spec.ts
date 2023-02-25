import { beforeEach, describe, expect, it } from 'vitest';
import { checkListLayout, ListItem } from '../list-layout';

describe('List layout', () => {
    let containerSize = 100, bufferSize = 2;

    beforeEach(() => {
        bufferSize = 2;
        containerSize = 100;
    })

    function renderItems(mode: string, scrollPos: number, focusKey?: string) {
        let items: ListItem[] = [];

        if (mode === "A5.0") {
            items = [
                { key: "A", pos: -1, size: 20 },
                { key: "B", pos: -1, size: 40 },
                { key: "C", pos: -1, size: 20 },
                { key: "D", pos: -1, size: 40 },
                { key: "E", pos: -1, size: 20 },
            ]
        }

        if (mode === "A5.1") {
            items = [
                { key: "Y", pos: -1, size: 20 },
                { key: "Z", pos: -1, size: 20 },
                { key: "A", pos: 0, size: 20 },
                { key: "B", pos: 20, size: 40 },
                { key: "C", pos: 60, size: 20 },
                { key: "D", pos: 80, size: 40 },
                { key: "E", pos: 120, size: 20 },
                { key: "F", pos: -1, size: 20 },
            ]
        }

        if (mode === "A5.2") {
            items = [
                { key: "Y", pos: 0, size: 20 },
                { key: "Z", pos: 20, size: 20 },
                { key: "A", pos: 40, size: 20 },
                { key: "B", pos: 60, size: 40 },
                { key: "C", pos: 100, size: 20 },
                { key: "D", pos: 120, size: 40 },
                { key: "E", pos: 160, size: 20 },
                { key: "F", pos: 180, size: 20 },
            ]
        }

        if (mode === "A5.3") {
            items = [
                { key: "A", pos: 40, size: 20 },
                { key: "B", pos: 60, size: 40 },
                { key: "C", pos: 100, size: 20 },
                { key: "D", pos: 120, size: 40 },
                { key: "E", pos: 160, size: 20 },
                { key: "F", pos: 180, size: 20 },
                { key: "G", pos: -1, size: 40 },
                { key: "H", pos: -1, size: 20 },
            ]
        }

        if (mode === "A5.4") {
            items = [
                { key: "A", pos: 0, size: 20 },
                { key: "B", pos: 20, size: 40 },
                { key: "C", pos: 60, size: 20 },
                { key: "D", pos: 80, size: 40 },
                { key: "E", pos: 120, size: 20 },
                { key: "F", pos: 140, size: 20 },
                { key: "G", pos: 160, size: 40 },
                { key: "H", pos: 200, size: 20 },
            ]
        }

        if (mode === "A5.5") {
            items = [
                { key: "Z", pos: -1, size: 20 },
                { key: "A", pos: 0, size: 20 },
                { key: "B", pos: 20, size: 40 },
                { key: "C", pos: 60, size: 20 },
                { key: "D", pos: 80, size: 40 },
                { key: "E", pos: 120, size: 20 },
                { key: "F", pos: 140, size: 20 }
            ]
        }

        if (mode === "A5.6") {
            items = [
                { key: "Z", pos: 0, size: 20 },
                { key: "A", pos: 20, size: 20 },
                { key: "B", pos: 40, size: 40 },
                { key: "C", pos: 80, size: 20 },
                { key: "D", pos: 100, size: 40 },
                { key: "E", pos: 140, size: 20 },
                { key: "F", pos: 160, size: 20 }
            ]
        }


        const r = checkListLayout(items, scrollPos, containerSize, bufferSize, focusKey);
        if (r === null) {
            return "NULL"
        }
        const arr = items.map((item) => `${item.key}:${item.pos}`);
        return `${r.scrollPos}/${r.startShift}/${r.endShift};ps=${r.pageSize};ls=${arr.join(":")}`;
    }

    it('should return null in case of empty list', async () => {
        expect(checkListLayout([], 0, 50, 3)).toBe(null);
    });

    it('should return null if some items size are not defined', async () => {
        expect(checkListLayout([{ key: "A", pos: -1, size: 10 }, { key: "B", pos: 10, size: -1 }], 0, 50, 3)).toBe(null);
    });

    describe('First Display', () => {
        it('should render initial items from start', async () => {
            expect(renderItems("A5.0", 10)).toBe("0/-2/1;ps=8;ls=A:0:B:20:C:60:D:80:E:120");

            containerSize = 70;
            expect(renderItems("A5.0", 10)).toBe("0/-2/0;ps=7;ls=A:0:B:20:C:60:D:80:E:120");

            containerSize = 30;
            expect(renderItems("A5.0", 10)).toBe("0/-2/-1;ps=6;ls=A:0:B:20:C:60:D:80:E:120");
        });

        it('should complement existing set', async () => {
            expect(renderItems("A5.1", 10)).toBe("50/0/0;ps=8;ls=Y:0:Z:20:A:40:B:60:C:100:D:120:E:160:F:180");

            // no changes
            expect(renderItems("A5.2", 50)).toBe("50/0/0;ps=8;ls=Y:0:Z:20:A:40:B:60:C:100:D:120:E:160:F:180");
        });
    });

    describe('Scroll', () => {
        it('should scroll fwd', async () => {
            // 100 instead of 50 -> scroll bottom/right
            expect(renderItems("A5.2", 100)).toBe("100/2/2;ps=8;ls=Y:0:Z:20:A:40:B:60:C:100:D:120:E:160:F:180");
            // dom update
            expect(renderItems("A5.3", 100)).toBe("60/0/0;ps=8;ls=A:0:B:20:C:60:D:80:E:120:F:140:G:160:H:200");

            // no changes
            expect(renderItems("A5.4", 60)).toBe("60/0/0;ps=8;ls=A:0:B:20:C:60:D:80:E:120:F:140:G:160:H:200");
        });

        it('should scroll bwd', async () => {
            // 20 instead of 60 -> scroll up/left
            expect(renderItems("A5.4", 20)).toBe("20/-1/-2;ps=7;ls=A:0:B:20:C:60:D:80:E:120:F:140:G:160:H:200");
            // dom update
            expect(renderItems("A5.5", 20)).toBe("40/0/0;ps=7;ls=Z:0:A:20:B:40:C:80:D:100:E:140:F:160");

            // no changes
            expect(renderItems("A5.6", 40)).toBe("40/0/0;ps=7;ls=Z:0:A:20:B:40:C:80:D:100:E:140:F:160");
        });

        // TODO: overshoot fwd / bwd
    });

});
