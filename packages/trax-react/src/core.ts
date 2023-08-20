import { trax, TraxProcessor } from "@traxjs/trax";
import React, { useEffect, useRef, useState } from "react";

interface TraxReactCptCtxt {
    id?: string;
    props?: object;
    processor?: TraxProcessor;
    jsx?: JSX.Element | string;
}

const REACT_STORE_ID = "React";
export const REACT_DISPOSE_TIMEOUT = 50;

const creationCounts: Map<NamedCurve, number> = new Map();

/** Global counter used to trigger dirty state in react components */
let CHANGE_COUNT = 0;

function buildProcessorId(name: string, instanceCount: number) {
    return name + ":" + instanceCount;
}

function createReactStore() {
    const rs = trax.getStore(REACT_STORE_ID);
    // eslint-disable-next-line @typescript-eslint/ban-types
    return rs || trax.createStore<{}>(REACT_STORE_ID, {});
}

/** React store: gathers all react processors in the same store */
let reactStore = createReactStore();

function addProcessor(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reactFunctionCpt: (prop?: any) => JSX.Element,
    cc: TraxReactCptCtxt,
    setRefreshCount: (c: number) => void
) {
    cc.jsx = "";
    let instanceCount = creationCounts.get(name);
    if (!instanceCount || isNaN(instanceCount)) {
        instanceCount = 1;
    } else {
        instanceCount++;
    }
    creationCounts.set(name, instanceCount as number);

    const id = buildProcessorId(name, instanceCount as number);
    cc.id = id;

    const pr = reactStore.compute(
        id,
        () => {
            try {
                cc.jsx = reactFunctionCpt(cc.props);
            } catch (ex) {
                trax.log.error(`[@traxjs/trax-react] Processing Error: ${ex}`);
            }
        },
        false,
        true
    );
    pr.onDirty = () => {
        // onDirty is synchronous
        // mark react component as dirty
        queueMicrotask(() => setRefreshCount(++CHANGE_COUNT));
    };
    cc.processor = pr;
}

/**
 * Wrap a react function component into a trax processor
 * Note: the functional component will be then considered as a pure function and
 * will only be re-rendered if
 * - one of its trax dependencies changed (these dependencies can be passed by any means,
 * e.g. props, contexts or even global variables)
 * - a property reference changes (i.e. new reference for objects)
 * @param name the compontent name - usually the same as the component function
 * @param reactFunctionCpt the functional component
 * @returns
 */
export function component<T>(name: string, reactFunctionCpt: (props: T) => JSX.Element): (props: T) => JSX.Element {
    // Make the component pure (React.memo) to avoid re-processing if prop reference didn't change
    function fc(props: T) {
        // Use an internal state variable to trigger refresh
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [_traxRefreshCount, setTraxRefreshCount] = useState(0);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const c: React.MutableRefObject<TraxReactCptCtxt> = useRef({});
        const cc = c.current;
        if (!cc.processor || cc.processor.disposed) {
            addProcessor(name, reactFunctionCpt, cc, setTraxRefreshCount);
        }
        // add the processor as candidate for disposal (React Strict mode constraint - cf. next)
        disposalPool.addProcessor(cc.processor);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
            // processor cleanup
            // warning: we cannot dispose processors immediately due to side effects
            // in React Strict Mode (in this mode effects are not always called)
            // remove the processor from the pool as it must not be disposed yet
            disposalPool.removeProcessor(cc.processor);
            return function cleanup() {
                // add the procesoor to have it disposed
                disposalPool.addProcessor(cc.processor);
            };
        }); // change here: must run all the time
        cc.props = props as object;
        // compute must be forced as this function is called when component props have changed
        // console.log("COMPUTE", cc.processor!.id);
        cc.processor && cc.processor.compute(true);
        return cc.jsx || "";
    }

    // use a dynamic function to keep the component name (will show in react dev tools)
    const fcName = name.replace(/\:/g, "_");
    const func = new Function("fc", `return function ${fcName}(props){ return fc(props) }`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.memo(func(fc)) as any;
}

/**
 * Get the trax identifier associated to a trax object
 * Shortcut to trax.getTraxId(...)
 * @param o
 * @returns
 */
export function traxId(o: object) {
    return trax.getTraxId(o);
}

/**
 * Return the id of the trax processor associated to a react component
 * when called in in the component render function
 * Useful to insert the component id in the component HTML
 * (e.g. through the data-id attribute)
 */
export function componentId(): string {
    return trax.getActiveProcessor()?.id || "";
}

/**
 * Reset the internal React data to restart from a blank state
 * (Test environment only)
 */
export function resetReactEnv() {
    creationCounts.clear();
    reactStore.dispose();
    reactStore = createReactStore();
}

/**
 * Helper function to create or retrieve a store instance
 * attached to the caller component
 * @param factory a factory function to create the store instance
 * @returns the store object
 */
export function useStore<T extends { dispose?: () => void }, V extends Array<any>>(
    factory: (...args: V) => T,
    ...args: V
): T {
    const ref = useRef({} as { store?: T }).current;
    let store = ref.store;
    if (!store) {
        // create it
        ref.store = store = factory(...args);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        return () => {
            if (store && typeof store.dispose === "function") {
                store.dispose();
            }
        };
    }, [store]);
    return store;
}

/**
 * Create a trax state object to hold state values associated to a component.
 * Note: this function should only be called once in a given component as multiple state
 * values can be set in a given state object
 * @param state the default state value
 * @returns the current state value
 */
export function useTraxState<T extends object>(state: T): T {
    const store = useStore(() => {
        const name = "State[" + componentId().replace(/(^[^\/\#]+(\/|\#))|(\#)/g, "") + "]";
        return trax.createStore(name, state);
    });
    return store.data as T;
}

const disposalPool = (() => {
    const pool: Set<TraxProcessor> = new Set();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let timerId: any = undefined;

    function checkTimeout() {
        if (timerId) {
            clearTimeout(timerId);
            timerId = undefined;
        }
        if (pool.size) {
            timerId = setTimeout(disposeAll, REACT_DISPOSE_TIMEOUT);
        }
    }

    function disposeAll() {
        for (const p of pool) {
            // console.log("DISPOSE", p.id);
            p.dispose();
        }
        pool.clear();
    }

    return {
        addProcessor(p?: TraxProcessor) {
            if (p) {
                pool.add(p);
                checkTimeout();
            }
        },
        removeProcessor(p?: TraxProcessor) {
            if (p) {
                pool.delete(p);
                checkTimeout();
            }
        },
    };
})();
