import { describe, expect, it } from 'vitest'
import { $Store, createStore } from '../trax';

interface $Person {
    id: string;
    name: string;
    age?: number;
    displayName?: string;
}

describe('Trax Stores', () => {
    it('should create simple stores', async function () {
        const st = createStore("test", (store: $Store<$Person>) => {
            return {
                doSomething() {

                }
            }
        });

        expect(typeof st.dispose).toBe("function");
        // expect(typeof st.doSomething).toBe("function")
    });
});
