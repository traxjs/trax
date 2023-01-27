import { Store, trax } from "@traxjs/trax";

interface RadarChartEntry {
    label: string;
    value: number;
}
interface RadarStoreData {
    values: RadarChartEntry[];
    min: number; // computed
    max: number; // computed
}
export type RadarStore = ReturnType<typeof createRadarStore>;

export function createRadarStore(initData?: RadarChartEntry[]) {
    return trax.createStore("RadarStore", (store: Store<RadarStoreData>) => {
        // init the root object
        const data = store.init({
            values: initData || [],
            min: 0,
            max: 0
        });

        // Process both min an max in one pass
        store.compute("MinMax", () => {
            const values = data.values
            let min = values.length ? Number.MAX_SAFE_INTEGER : 0, max = 0; // value cannot be <0
            for (const entry of values) {
                let v = entry.value;
                if (entry.value < 0) {
                    v = entry.value = 0; // sanitize data
                }
                if (v < min) {
                    min = v;
                }
                if (v > max) {
                    max = v;
                }
            }
            data.min = min;
            data.max = max;
        });

        return {
            data,
            addEntry(label: string, value: number) {
                data.values.push({ label, value });
            },
            deleteEntry(entry: RadarChartEntry) {
                const values = data.values;
                const idx = values.indexOf(entry);
                (idx > -1) && values.splice(idx, 1);
            }
        }
    });
}
