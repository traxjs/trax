
import { createStore } from "@traxjs/trax";

interface Counter {
    value: number;
    nbrOfOperations: number;
    maxValue: number;
    minValue: number;
}

export const counterStore = createStore("Counter", (store) => {
    const counter: Counter = store.object("root", {
        value: 0,
        nbrOfOperations: 0,
        maxValue: 0,
        minValue: 0
    });

    // store.compute("MinMax", () => {
    //     if (counter.value > counter.maxValue) {
    //         // update max
    //         counter.maxValue = counter.value;
    //     } else if (counter.value < counter.minValue) {
    //         // update min
    //         counter.minValue = counter.value;
    //     }
    // });

    return {
        /** Expose the counter object */
        counter,
        /** Increment/Decrement the counter value */
        increment(v: number) {
            counter.value += v;
            counter.nbrOfOperations++;
        },
        /** Reset all counter values */
        reset() {
            counter.value = 0;
            counter.nbrOfOperations = 0;
            counter.maxValue = 0;
            counter.minValue = 0;
        }
    }
});


