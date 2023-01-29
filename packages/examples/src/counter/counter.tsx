import { Store, trax } from "@traxjs/trax";
import { component, componentId, useStore } from "@traxjs/trax-react";

// example adapted from https://www.solidjs.com/examples/counter
interface CounterData {
    count: number;
}

export function createCounterStore() {
    return trax.createStore("CounterStore", (store: Store<CounterData>) => {
        const data = store.init({ count: 0 }); // init the store root object
        const interval = setInterval(() => data.count++, 1000);
        return {
            data,
            dispose() {
                clearInterval(interval);
            },
            reset() {
                data.count = 0;
            }
        }
    });
}

export const Counter = component("Counter", () => {
    // get or create a CounterStore instance
    const cs = useStore(createCounterStore);

    return <div data-id={componentId()} className='counter'
        title="Click to reset" onClick={cs.reset}>
        <h1> Counter:  <span className="counter-value">{cs.data.count}</span></h1>
    </div>
});
