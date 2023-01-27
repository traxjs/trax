import { Store, trax } from "@traxjs/trax";
import { component, componentId, useStore } from "@traxjs/trax-react";

interface CounterData {
    count: number;
}

export function createCounterStore() {
    return trax.createStore("CounterStore", (store: Store<CounterData>) => {
        const data = store.init({ count: 0 });
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
        title="Click me to reset" onClick={cs.reset}>
        {cs.data.count}
    </div>
});
