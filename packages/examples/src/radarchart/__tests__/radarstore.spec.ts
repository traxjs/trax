import { trax } from '@traxjs/trax';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRadarStore, RadarStore } from '../radarstore';

describe('Radar Store', () => {
    let radarStore: RadarStore, data: RadarStore["data"];

    function createStore(includeData = true) {
        if (includeData) {
            radarStore = createRadarStore([{
                label: "A", value: 10
            }, {
                label: "B", value: 20
            }, {
                label: "C", value: 30
            }]);
        } else {
            radarStore = createRadarStore();
        }
        data = radarStore.data;
    };

    function printValues() {
        const r: string[] = [];
        r.push(`Min: ${data.min} / Max: ${data.max}`);
        for (let entry of data.values) {
            r.push(`- ${entry.label}: ${entry.value}`);
        }
        return r;
    }

    it('should load properly (no data)', async () => {
        createStore(false);
        expect(printValues()).toMatchObject([
            "Min: 0 / Max: 0",
        ]);
    });

    it('should load properly (data)', async () => {
        createStore();
        expect(printValues()).toMatchObject([
            "Min: 10 / Max: 30",
            "- A: 10",
            "- B: 20",
            "- C: 30",
        ]);
    });

    it('should add entries', async () => {
        createStore();
        radarStore.addEntry("D", 20);
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 10 / Max: 30",
            "- A: 10",
            "- B: 20",
            "- C: 30",
            "- D: 20",
        ]);

        radarStore.addEntry("E", 40);
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 10 / Max: 40",
            "- A: 10",
            "- B: 20",
            "- C: 30",
            "- D: 20",
            "- E: 40",
        ]);

        radarStore.addEntry("F", -5); // negative entry -> changed to 0
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 0 / Max: 40",
            "- A: 10",
            "- B: 20",
            "- C: 30",
            "- D: 20",
            "- E: 40",
            "- F: 0",
        ]);
    });

    it('should delete entries', async () => {
        createStore();

        radarStore.deleteEntry(data.values[1]);
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 10 / Max: 30",
            "- A: 10",
            "- C: 30",
        ]);

        radarStore.deleteEntry(data.values[1]);
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 10 / Max: 10",
            "- A: 10",
        ]);

        radarStore.deleteEntry(data.values[0]);
        await trax.reconciliation();
        expect(printValues()).toMatchObject([
            "Min: 0 / Max: 0",
        ]);
    });
});
